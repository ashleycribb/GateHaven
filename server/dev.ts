import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { ENGINE } from '../shared/engine';
import { createGeminiHandler } from './geminiHandler';
import { IslandRoom } from './rooms/IslandRoom';

function loadDotEnvFile(cwd: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const filename of ['.env', '.env.local']) {
    const filePath = path.resolve(cwd, filename);
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const eqIdx = line.indexOf('=');
      if (eqIdx <= 0) continue;
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

async function startDevServer(): Promise<void> {
  const host = ENGINE.host;
  const port = process.env.PORT ? Number(process.env.PORT) : ENGINE.port;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid dev server port: ${port}`);
  }

  const mergedEnv: Record<string, string | undefined> = {
    ...loadDotEnvFile(process.cwd()),
    ...process.env,
  };
  const geminiHandler = createGeminiHandler(mergedEnv);

  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: process.env.DISABLE_HMR === 'true' ? false : undefined,
      watch: process.env.DISABLE_HMR === 'true' ? null : undefined,
    },
    appType: 'spa',
  });

  const httpServer = http.createServer();
  const gameServer = new Server({
    transport: new WebSocketTransport({ server: httpServer }),
    greet: false,
    express: (app) => {
      app.disable('x-powered-by');
      app.post('/api/generate', (req, res) => {
        geminiHandler(req, res);
      });
      app.options('/api/generate', (req, res) => {
        geminiHandler(req, res);
      });
      app.use(vite.middlewares);
    },
  });

  gameServer.define('island', IslandRoom);
  await gameServer.listen(port, host);
  console.log(`Battle Island dev server listening on http://${host}:${port}`);
}

startDevServer().catch((err) => {
  console.error('Failed to start Battle Island dev server:', err);
  process.exit(1);
});
