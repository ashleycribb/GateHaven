import type { IncomingMessage, ServerResponse } from 'node:http';
import { GoogleGenAI } from '@google/genai';
import { ENGINE } from '../shared/engine';

const PLACEHOLDER_KEYS = new Set([
  'MY_GEMINI_API_KEY',
  'YOUR_GEMINI_API_KEY',
  'YOUR_API_KEY',
  'REPLACE_ME',
  'CHANGE_ME',
  'PLACEHOLDER',
]);

function parseRateLimit(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return ENGINE.defaultGeminiRateLimit;
  }
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new Error(`Invalid GEMINI_RATE_LIMIT: "${raw}" must be a positive integer`);
  }
  const parsed = Number(trimmed);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid GEMINI_RATE_LIMIT: "${raw}" must be greater than 0`);
  }
  return parsed;
}

function isUsableApiKey(raw: string | undefined): raw is string {
  if (!raw) return false;
  const trimmed = raw.trim();
  if (trimmed.length < 8) return false;
  if (PLACEHOLDER_KEYS.has(trimmed.toUpperCase())) return false;
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) return false;
  return true;
}

function isOriginAllowed(originHeader: string, allowedOrigin: string | null, hostHeader?: string): boolean {
  if (!originHeader || originHeader === 'null') {
    return false;
  }
  let parsed: URL;
  try {
    parsed = new URL(originHeader);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }
  if (allowedOrigin && parsed.origin === allowedOrigin) {
    return true;
  }
  if (hostHeader && parsed.host === hostHeader) {
    return true;
  }
  if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
    return true;
  }
  return false;
}

function sendJson(res: ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(payload));
}

export type GeminiHttpHandler = (req: IncomingMessage, res: ServerResponse) => void;

export function createGeminiHandler(
  env: Record<string, string | undefined> = process.env,
): GeminiHttpHandler {
  const rateLimitPerMinute = parseRateLimit(env.GEMINI_RATE_LIMIT);
  const isMock = env.GEMINI_MOCK === '1';
  const apiKey = isUsableApiKey(env.GEMINI_API_KEY) ? env.GEMINI_API_KEY.trim() : null;
  const modelName = env.GEMINI_MODEL?.trim() || ENGINE.geminiModel;

  let allowedOrigin: string | null = null;
  if (env.APP_URL) {
    try {
      allowedOrigin = new URL(env.APP_URL).origin;
    } catch {
      allowedOrigin = null;
    }
  }

  const aiClient =
    !isMock && apiKey
      ? new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build',
            },
          },
        })
      : null;

  const requestBuckets = new Map<string, number[]>();

  function checkRateLimit(clientKey: string): boolean {
    const now = Date.now();
    const cutoff = now - 60_000;
    const timestamps = (requestBuckets.get(clientKey) ?? []).filter((ts) => ts > cutoff);
    if (timestamps.length >= rateLimitPerMinute) {
      requestBuckets.set(clientKey, timestamps);
      return false;
    }
    timestamps.push(now);
    requestBuckets.set(clientKey, timestamps);
    return true;
  }

  return (req: IncomingMessage, res: ServerResponse): void => {
    // 1. Validate Origin header strictly before anything else
    const rawOrigin = req.headers.origin;
    if (rawOrigin !== undefined) {
      const originValue = Array.isArray(rawOrigin) ? rawOrigin[0] : rawOrigin;
      if (!isOriginAllowed(originValue, allowedOrigin, req.headers.host)) {
        res.removeHeader('Access-Control-Allow-Origin');
        res.removeHeader('Access-Control-Allow-Credentials');
        sendJson(res, 403, { error: 'Forbidden origin' });
        req.resume();
        return;
      }
      res.setHeader('Access-Control-Allow-Origin', originValue);
      res.setHeader('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.end();
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 405, { error: 'Method not allowed' });
      req.resume();
      return;
    }

    // 2. Per-IP rate limit
    const clientIp = req.socket?.remoteAddress || 'unknown';
    if (!checkRateLimit(clientIp)) {
      sendJson(res, 429, { error: 'Rate limit exceeded' });
      req.resume();
      return;
    }

    // 3. Fail closed when Gemini is unavailable and mock is not strictly "1"
    if (!isMock && !aiClient) {
      sendJson(res, 503, { error: 'Gemini proxy unavailable: GEMINI_API_KEY is not configured' });
      req.resume();
      return;
    }

    // 4. Incremental byte cap (32 KB) — send 413 cleanly before draining/closing
    const declaredLength = Number(req.headers['content-length']);
    if (Number.isFinite(declaredLength) && declaredLength > ENGINE.maxGeminiBodyBytes) {
      sendJson(res, 413, { error: 'Request body too large' });
      req.resume();
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let rejected = false;

    req.on('data', (chunk: Buffer | string) => {
      if (rejected) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > ENGINE.maxGeminiBodyBytes) {
        rejected = true;
        chunks.length = 0;
        sendJson(res, 413, { error: 'Request body too large' });
        return;
      }
      chunks.push(buf);
    });

    req.on('error', () => {
      if (!res.writableEnded) {
        sendJson(res, 400, { error: 'Request stream error' });
      }
    });

    req.on('end', () => {
      if (rejected || res.writableEnded) return;

      let parsedBody: unknown;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        parsedBody = raw.length > 0 ? JSON.parse(raw) : {};
      } catch {
        sendJson(res, 400, { error: 'Invalid JSON request body' });
        return;
      }

      if (
        typeof parsedBody !== 'object' ||
        parsedBody === null ||
        typeof (parsedBody as { prompt?: unknown }).prompt !== 'string' ||
        (parsedBody as { prompt: string }).prompt.trim().length === 0
      ) {
        sendJson(res, 400, { error: 'Missing non-empty prompt string' });
        return;
      }

      const prompt = (parsedBody as { prompt: string }).prompt;

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Content-Type-Options', 'nosniff');

      if (isMock) {
        res.write(`${JSON.stringify({ text: `[mock] ${prompt.slice(0, 64)}`, done: false })}\n`);
        res.end(`${JSON.stringify({ text: '', done: true })}\n`);
        return;
      }

      void (async () => {
        try {
          const stream = await aiClient!.models.generateContentStream({
            model: modelName,
            contents: prompt,
          });
          for await (const chunk of stream) {
            if (res.writableEnded) break;
            if (chunk.text) {
              res.write(`${JSON.stringify({ text: chunk.text, done: false })}\n`);
            }
          }
          if (!res.writableEnded) {
            res.end(`${JSON.stringify({ text: '', done: true })}\n`);
          }
        } catch {
          if (!res.writableEnded) {
            res.write(`${JSON.stringify({ error: 'Gemini upstream error', done: true })}\n`);
            res.end();
          }
        }
      })();
    });
  };
}
