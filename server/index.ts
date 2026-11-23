import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { DISPLAY_NAME, ENGINE } from '../shared/engine';
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

export interface BattleIslandServerOptions {
  port?: number;
  host?: string;
  serveStatic?: boolean;
  distDir?: string;
  env?: Record<string, string | undefined>;
}

export interface BattleIslandServerHandle {
  readonly port: number;
  readonly host: string;
  readonly server: Server;
  readonly httpServer: http.Server;
  readonly close: () => Promise<void>;
}

export async function createBattleIslandServer(
  options: BattleIslandServerOptions = {},
): Promise<BattleIslandServerHandle> {
  const host = options.host ?? ENGINE.host;
  const requestedPort = options.port ?? (process.env.PORT ? Number(process.env.PORT) : ENGINE.port);
  if (!Number.isInteger(requestedPort) || requestedPort < 0 || requestedPort > 65535) {
    throw new Error(`Invalid server port: ${requestedPort}`);
  }

  const mergedEnv: Record<string, string | undefined> = options.env
    ? { ...options.env }
    : { ...loadDotEnvFile(process.cwd()), ...process.env };

  const geminiHandler = createGeminiHandler(mergedEnv);
  const serveStatic = options.serveStatic ?? true;
  const distDir = options.distDir ?? path.resolve(process.cwd(), 'dist');

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

      if (serveStatic && fs.existsSync(distDir)) {
        app.use(express.static(distDir));
        app.use((req, res, next) => {
          if (req.method !== 'GET' || req.path.startsWith('/api/') || req.path.startsWith('/matchmake')) {
            next();
            return;
          }
          res.sendFile(path.join(distDir, 'index.html'));
        });
      }
    },
  });

  gameServer.define('island', IslandRoom);

  await gameServer.listen(requestedPort, host);
  const addr = httpServer.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : requestedPort;

  return {
    port: boundPort,
    host,
    server: gameServer,
    httpServer,
    close: async () => {
      await gameServer.gracefullyShutdown(false);
    },
  };
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  createBattleIslandServer()
    .then((handle) => {
      console.log(`${DISPLAY_NAME} server listening on http://${handle.host}:${handle.port}`);
    })
    .catch((err) => {
      console.error(`Failed to start ${DISPLAY_NAME} server:`, err);
      process.exit(1);
    });
}
