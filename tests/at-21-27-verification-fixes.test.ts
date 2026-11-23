import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { DISPLAY_DESCRIPTION, DISPLAY_NAME } from '../shared/branding';
import { ENGINE } from '../shared/engine';

let testServer: ColyseusTestServer | null = null;

afterEach(async () => {
  if (testServer) {
    await testServer.shutdown();
    testServer = null;
  }
});

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

describe('AT-21..AT-27: Pass 1B Verification Fixes & Locked Schema Allowlist', () => {
  it('AT-21: handleBuildSocket rejects friendly sockets beyond ENGINE.baseBuildRange and succeeds in range', async () => {
    const { default: appConfig } = await import('../server/app.config');
    testServer = await boot(appConfig);
    const room = (await testServer.createRoom('island')) as any;
    const client = await testServer.connectTo(room);
    await room.waitForNextPatch();

    // Advance to match phase if phase machine is active
    if (typeof room.advancePhaseForTest === 'function') {
      room.advancePhaseForTest('match');
    } else {
      room.state.phase = 'match';
    }

    const player = room.state.players.get(client.sessionId)!;
    const base = room.state.bases.get(player.teamId)!;
    const wallSocket = Array.from(base.sockets.values()).find((s: any) => s.type === 'wall') as any;
    const pointsBefore = base.points;
    const logCountBefore = room.matchLog.entries.length;

    // Place player strictly beyond ENGINE.baseBuildRange from wallSocket
    player.x = wallSocket.x + ENGINE.baseBuildRange + 5;
    player.z = wallSocket.z;

    const farResult = room.handleBuildSocket(client.sessionId, wallSocket.id, 'wall', 1);
    expect(farResult.ok).toBe(false);
    expect(wallSocket.occupied).toBe(false);
    expect(wallSocket.tier).toBe(0);
    expect(base.points).toBe(pointsBefore);
    expect(room.matchLog.entries.length).toBe(logCountBefore);

    // Move player within ENGINE.baseBuildRange -> succeeds
    player.x = wallSocket.x + ENGINE.baseBuildRange * 0.4;
    player.z = wallSocket.z;
    const nearResult = room.handleBuildSocket(client.sessionId, wallSocket.id, 'wall', 1);
    expect(nearResult.ok).toBe(true);
    expect(wallSocket.occupied).toBe(true);
    expect(wallSocket.tier).toBe(1);
    expect(base.points).toBe(pointsBefore + ENGINE.points.upgrade);
  });

  it('AT-22: POST /api/generate over 32 KB returns 413 Request body too large BEFORE 503 missing-key check', async () => {
    const { createGeminiHandler } = await import('../server/geminiHandler');
    // Missing GEMINI_API_KEY and GEMINI_MOCK not "1"
    const handler = createGeminiHandler({});
    const server = http.createServer((req, res) => handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      const oversized = JSON.stringify({ prompt: 'z'.repeat(ENGINE.maxGeminiBodyBytes + 2048) });
      const res = await sendRawHttpRequest({
        port,
        method: 'POST',
        path: '/api/generate',
        headers: {
          'Content-Type': 'application/json',
          Origin: `http://127.0.0.1:${port}`,
        },
        body: oversized,
      });
      expect(res.statusCode).toBe(413);
      expect(res.body).toContain('Request body too large');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('AT-23: POST /api/generate with missing Origin header returns 403 cleanly without throwing or dropping socket', async () => {
    const { createGeminiHandler } = await import('../server/geminiHandler');
    const handler = createGeminiHandler({ GEMINI_MOCK: '1' });
    const server = http.createServer((req, res) => handler(req, res));
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    const addr = server.address();
    const port = typeof addr === 'object' && addr ? addr.port : 0;

    try {
      const res = await sendRawHttpRequest({
        port,
        method: 'POST',
        path: '/api/generate',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'hello' }),
      });
      expect(res.statusCode).toBe(403);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('AT-24: No magic 80 or 100 in applyInput, client reconciler, or BaseSystem; core upgrade adds ENGINE.coreUpgradeHpBonus', async () => {
    const applySrc = fs.readFileSync(path.resolve(process.cwd(), 'shared/applyInput.ts'), 'utf8');
    const clientSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/net/client.ts'), 'utf8');
    const baseSysSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/systems/BaseSystem.ts'), 'utf8');

    expect(applySrc).not.toMatch(/islandRadius\s*=\s*80/);
    expect(clientSrc).not.toMatch(/\|\|\s*80\b|\?\?\s*80\b/);
    expect(baseSysSrc).not.toMatch(/\+=\s*100\b/);
    expect(baseSysSrc).toContain('ENGINE.coreUpgradeHpBonus');

    // Runtime check: missing/invalid islandRadius in applyInput fails closed
    const { applyInput } = await import('../shared/applyInput');
    expect(() =>
      (applyInput as any)({ x: 0, y: 0, z: 0, rotY: 0 }, { moveX: 1, moveZ: 0 }, 1 / 30, undefined),
    ).toThrow();

    // Runtime check: core upgrade bumps coreHp by exactly ENGINE.coreUpgradeHpBonus
    const { buildOnSocket } = await import('../src/systems/BaseSystem');
    const { IslandState } = await import('../shared/schema');
    const { PASS1_ISLAND_CONFIG, buildRadialIslandLayout } = await import('../shared/islandConfig');
    const { initializeIslandState } = await import('../server/rooms/stateInit');

    const state = new IslandState();
    initializeIslandState(state, PASS1_ISLAND_CONFIG, buildRadialIslandLayout(PASS1_ISLAND_CONFIG));
    const base0 = state.bases.get('team_0')!;
    const startHp = base0.coreHp;
    const coreSock = Array.from(base0.sockets.values()).find((s) => s.type === 'core_upgrade')!;
    const res = buildOnSocket(base0, coreSock.id, 'team_0', 'core_upgrade', 1);
    expect(res.ok).toBe(true);
    expect(base0.coreHp).toBe(startHp + ENGINE.coreUpgradeHpBonus);
  });

  it('AT-25: DISPLAY_NAME and DISPLAY_DESCRIPTION drive index.html, metadata.json via build-time injector and server logs', () => {
    const viteConfigSrc = fs.readFileSync(path.resolve(process.cwd(), 'vite.config.ts'), 'utf8');
    const prodServerSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/index.ts'), 'utf8');
    const devServerSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/dev.ts'), 'utf8');
    const htmlSrc = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');
    const metaJson = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'metadata.json'), 'utf8')) as {
      name: string;
      description: string;
    };

    // Build-time injection plugin or prebuild script reads shared/branding.ts
    expect(viteConfigSrc).toContain('DISPLAY_NAME');
    expect(viteConfigSrc).toContain('DISPLAY_DESCRIPTION');

    // Server log strings must reference DISPLAY_NAME, not hardcoded "Battle Island"
    expect(prodServerSrc).toContain('DISPLAY_NAME');
    expect(prodServerSrc).not.toMatch(/console\.log\([^)]*Battle Island/);
    expect(devServerSrc).toContain('DISPLAY_NAME');
    expect(devServerSrc).not.toMatch(/console\.log\([^)]*Battle Island/);

    // Emitted/checked-in index.html and metadata.json match branding constants
    expect(htmlSrc).toContain(`<title>${DISPLAY_NAME}</title>`);
    expect(htmlSrc).toContain(`property="og:title" content="${DISPLAY_NAME}"`);
    expect(htmlSrc).toContain(`name="description" content="${DISPLAY_DESCRIPTION}"`);
    expect(metaJson.name).toBe(DISPLAY_NAME);
    expect(metaJson.description).toBe(DISPLAY_DESCRIPTION);
  });

  it('AT-26: Consistent package-lock.json exists with no three/@types/three and no unused dotenv in package.json', () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(pkg.dependencies?.dotenv).toBeUndefined();
    expect(pkg.devDependencies?.dotenv).toBeUndefined();
    expect(pkg.dependencies?.three).toBeUndefined();
    expect(pkg.devDependencies?.['@types/three']).toBeUndefined();

    const lockPath = path.resolve(process.cwd(), 'package-lock.json');
    expect(fs.existsSync(lockPath), 'package-lock.json must exist at repo root').toBe(true);
    const lockText = fs.readFileSync(lockPath, 'utf8');
    expect(lockText).not.toMatch(/"node_modules\/three"|"@types\/three"/);

    const bunLockPath = path.resolve(process.cwd(), 'bun.lock');
    if (fs.existsSync(bunLockPath)) {
      const bunText = fs.readFileSync(bunLockPath, 'utf8');
      expect(bunText).not.toContain('@types/three');
      expect(bunText).not.toMatch(/"three":/);
    }
  });

  it('AT-27: Synced schema room.state.toJSON() exposes exact Part A allowlist keys with no missing or extra keys', async () => {
    const { default: appConfig } = await import('../server/app.config');
    testServer = await boot(appConfig);
    const room = (await testServer.createRoom('island')) as any;
    const client = await testServer.connectTo(room);
    await room.waitForNextPatch();

    // Ensure a trap exists so we can verify Trap schema keys too
    room.placeServerTrap(client.sessionId, 'blast_mine', 1, [], 2, 2);

    const json = room.state.toJSON() as Record<string, any>;
    const sorted = (obj: Record<string, any>) => Object.keys(obj).sort();

    expect(sorted(json)).toEqual([
      'bases',
      'boats',
      'crates',
      'islandConfig',
      'matchTimeRemaining',
      'phase',
      'players',
      'traps',
      'weather',
      'winnerTeamId',
    ]);

    expect(sorted(json.islandConfig)).toEqual(['baseRadius', 'centerRadius', 'radius', 'teamCount']);

    const player = json.players[client.sessionId];
    expect(player).toBeDefined();
    expect(sorted(player)).toEqual([
      'activeWeaponIndex',
      'alive',
      'boatId',
      'hp',
      'id',
      'isBot',
      'landed',
      'maxHp',
      'rotY',
      'shieldHp',
      'skillSlots',
      'teamId',
      'trapSlots',
      'weaponSlots',
      'x',
      'y',
      'z',
    ]);

    expect(player.weaponSlots.length).toBeGreaterThan(0);
    expect(sorted(player.weaponSlots[0])).toEqual(['itemId', 'level', 'modifiers']);

    const firstBase = Object.values(json.bases)[0] as Record<string, any>;
    expect(sorted(firstBase)).toEqual(['coreHp', 'points', 'sockets', 'teamId', 'tier', 'x', 'z']);

    const firstSocket = Object.values(firstBase.sockets)[0] as Record<string, any>;
    expect(sorted(firstSocket)).toEqual(['id', 'occupied', 'tier', 'type', 'x', 'z']);

    const firstCrate = Object.values(json.crates)[0] as Record<string, any>;
    expect(sorted(firstCrate)).toEqual(['id', 'opened', 'tier', 'x', 'z']);

    const firstTrap = Object.values(json.traps)[0] as Record<string, any>;
    expect(sorted(firstTrap)).toEqual(['id', 'itemId', 'ownerId', 'teamId', 'triggered', 'x', 'z']);

    const firstBoat = Object.values(json.boats)[0] as Record<string, any>;
    expect(firstBoat).toBeDefined();
    expect(sorted(firstBoat)).toEqual(['id', 'rotY', 'teamId', 'x', 'y', 'z']);

    expect(json.weather).toBeDefined();
    expect(sorted(json.weather)).toEqual(['fogDensity', 'kind', 'rainIntensity', 'wind']);
  });
});
