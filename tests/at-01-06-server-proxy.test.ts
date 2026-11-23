import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { ENGINE } from '../shared/engine';

function sendRawHttpRequest(options: {
  port: number;
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: string;
}): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: options.port,
        method: options.method,
        path: options.path,
        headers: options.headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      },
    );
    req.on('error', reject);
    if (options.body !== undefined) {
      req.write(options.body);
    }
    req.end();
  });
}

describe('AT-01..AT-06: Single-Port Server & Fail-Closed Gemini Proxy', () => {
  it('AT-01: WebSocket connects on single app port from page origin with no hardcoded second port', async () => {
    const clientSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/net/client.ts'), 'utf8');
    const prodServerSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/index.ts'), 'utf8');
    const devServerSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/dev.ts'), 'utf8');

    expect(clientSrc).toContain('window.location.origin');
    expect(clientSrc).not.toMatch(/\b2567\b|\b5173\b/);
    expect(prodServerSrc).not.toMatch(/\b2567\b|\b5173\b/);
    expect(devServerSrc).not.toMatch(/\b2567\b|\b5173\b/);
    expect(ENGINE.port).toBe(3000);

    const { createBattleIslandServer } = await import('../server/index');
    const { Client } = await import('@colyseus/sdk');

    const handle = await createBattleIslandServer({
      port: 0,
      host: '127.0.0.1',
      serveStatic: false,
      env: { GEMINI_MOCK: '1' },
    });

    try {
      const origin = `http://127.0.0.1:${handle.port}`;
      const sdkClient = new Client(origin);
      const room = await sdkClient.joinOrCreate('island');
      expect(room.roomId).toBeTruthy();
      expect(room.sessionId).toBeTruthy();
      await room.leave();
    } finally {
      await handle.close();
    }
  });

  it('AT-02: /api/generate returns 503 when GEMINI_API_KEY is missing or placeholder and GEMINI_MOCK !== "1"', async () => {
    const { createGeminiHandler } = await import('../server/geminiHandler');

    const startWithEnv = async (env: Record<string, string | undefined>) => {
      const handler = createGeminiHandler(env);
      const server = http.createServer((req, res) => {
        if (req.url === '/api/generate' && req.method === 'POST') {
          handler(req, res);
        } else {
          res.statusCode = 404;
          res.end();
        }
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      return {
        port,
        close: () => new Promise<void>((resolve) => server.close(() => resolve())),
      };
    };

    // Missing key, no mock -> 503
    const s1 = await startWithEnv({});
    try {
      const r1 = await sendRawHttpRequest({
        port: s1.port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      expect(r1.statusCode).toBe(503);
    } finally {
      await s1.close();
    }

    // Placeholder key from .env.example -> 503
    const s2 = await startWithEnv({ GEMINI_API_KEY: 'MY_GEMINI_API_KEY' });
    try {
      const r2 = await sendRawHttpRequest({
        port: s2.port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      expect(r2.statusCode).toBe(503);
    } finally {
      await s2.close();
    }

    // Non-"1" GEMINI_MOCK -> 503
    const s3 = await startWithEnv({ GEMINI_MOCK: 'true' });
    try {
      const r3 = await sendRawHttpRequest({
        port: s3.port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      expect(r3.statusCode).toBe(503);
    } finally {
      await s3.close();
    }

    // Exact GEMINI_MOCK="1" -> 200 NDJSON stream
    const s4 = await startWithEnv({ GEMINI_MOCK: '1' });
    try {
      const r4 = await sendRawHttpRequest({
        port: s4.port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      expect(r4.statusCode).toBe(200);
      expect(r4.headers['content-type']).toContain('application/x-ndjson');
      const lines = r4.body
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      expect(lines.length).toBeGreaterThan(0);
    } finally {
      await s4.close();
    }
  });

  it('AT-03: Origin: null and unparsable Origin return 403 cleanly without throwing or dropping socket', async () => {
    const { createGeminiHandler } = await import('../server/geminiHandler');
    const handler = createGeminiHandler({ GEMINI_MOCK: '1' });
    const server = http.createServer((req, res) => handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      const nullOrigin = await sendRawHttpRequest({
        port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json', Origin: 'null' },
        body: JSON.stringify({ prompt: 'hi' }),
      });
      expect(nullOrigin.statusCode).toBe(403);

      const badOrigin = await sendRawHttpRequest({
        port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json', Origin: 'http://[::invalid-origin' },
        body: JSON.stringify({ prompt: 'hi' }),
      });
      expect(badOrigin.statusCode).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('AT-04: Request body over 32 KB returns 413 with Request body too large before closing', async () => {
    const { createGeminiHandler } = await import('../server/geminiHandler');
    const handler = createGeminiHandler({ GEMINI_MOCK: '1' });
    const server = http.createServer((req, res) => handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      const oversized = JSON.stringify({ prompt: 'x'.repeat(ENGINE.maxGeminiBodyBytes + 1024) });
      const res = await sendRawHttpRequest({
        port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json' },
        body: oversized,
      });
      expect(res.statusCode).toBe(413);
      expect(res.body).toContain('Request body too large');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('AT-05: GEMINI_RATE_LIMIT of 0 or non-numeric value throws at startup', async () => {
    const { createGeminiHandler } = await import('../server/geminiHandler');
    expect(() => createGeminiHandler({ GEMINI_MOCK: '1', GEMINI_RATE_LIMIT: '0' })).toThrow();
    expect(() => createGeminiHandler({ GEMINI_MOCK: '1', GEMINI_RATE_LIMIT: 'abc' })).toThrow();
    expect(() => createGeminiHandler({ GEMINI_MOCK: '1', GEMINI_RATE_LIMIT: 'NaN' })).toThrow();
    expect(() => createGeminiHandler({ GEMINI_MOCK: '1', GEMINI_RATE_LIMIT: '-5' })).toThrow();
  });

  it('AT-06: Production server module must not import vite or call vite.loadEnv', () => {
    const filesToCheck = [
      'server/index.ts',
      'server/geminiHandler.ts',
      'server/app.config.ts',
    ];
    for (const rel of filesToCheck) {
      const fullPath = path.resolve(process.cwd(), rel);
      expect(fs.existsSync(fullPath), `Missing ${rel}`).toBe(true);
      const src = fs.readFileSync(fullPath, 'utf8');
      expect(src).not.toMatch(/from\s+['"]vite['"]/);
      expect(src).not.toMatch(/import\s*\(\s*['"]vite['"]\s*\)/);
      expect(src).not.toMatch(/\bloadEnv\b/);
    }
  });
});
