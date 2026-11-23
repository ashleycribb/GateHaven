import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { Predict } from '@colyseus/sdk';
import { ENGINE } from '../shared/engine';

let testServer: ColyseusTestServer | null = null;

afterEach(async () => {
  if (testServer) {
    await testServer.shutdown();
    testServer = null;
  }
  vi.restoreAllMocks();
});

describe('AT-07..AT-12: Radial Island, Schema, Input Sanitization, Prediction & Rewind', () => {
  it('AT-07: Valid IslandConfig builds radial island at equal angles and high-loot center; teamCount 1 or 6 rejected', async () => {
    const {
      validateIslandConfig,
      buildRadialIslandLayout,
      PASS1_ISLAND_CONFIG,
    } = await import('../shared/islandConfig');

    expect(PASS1_ISLAND_CONFIG.teamCount).toBe(2);
    expect(() => validateIslandConfig({ ...PASS1_ISLAND_CONFIG, teamCount: 1 })).toThrow();
    expect(() => validateIslandConfig({ ...PASS1_ISLAND_CONFIG, teamCount: 6 })).toThrow();
    expect(() => validateIslandConfig({ radius: 80 })).toThrow();

    for (const teamCount of [2, 3, 5] as const) {
      const cfg = validateIslandConfig({ ...PASS1_ISLAND_CONFIG, teamCount });
      const layout = buildRadialIslandLayout(cfg);
      expect(layout.bases).toHaveLength(teamCount);
      for (let i = 0; i < teamCount; i++) {
        const expectedAngle = (2 * Math.PI * i) / teamCount;
        const base = layout.bases[i];
        expect(base.x).toBeCloseTo(Math.cos(expectedAngle) * cfg.baseRadius, 4);
        expect(base.z).toBeCloseTo(Math.sin(expectedAngle) * cfg.baseRadius, 4);
      }

      const tier3 = layout.crates.filter((c) => c.tier === 3);
      expect(tier3.length).toBeGreaterThan(0);
      for (const crate of tier3) {
        expect(Math.hypot(crate.x, crate.z)).toBeLessThan(cfg.centerRadius);
      }
    }
  });

  it('AT-08: Synced schema exposes only allowed gameplay fields with loadout slots and no engine/registry tables', async () => {
    const { default: appConfig } = await import('../server/app.config');
    testServer = await boot(appConfig);
    const room = await testServer.createRoom('island');
    const client = await testServer.connectTo(room);
    await room.waitForNextPatch();

    const json = room.state.toJSON() as Record<string, any>;
    expect(json).toHaveProperty('players');
    expect(json).toHaveProperty('bases');
    expect(json).toHaveProperty('crates');
    expect(json).toHaveProperty('islandConfig');

    // No engine tables, registry tables, matchLog, AI director, or old RPG fields
    expect(json).not.toHaveProperty('matchLog');
    expect(json).not.toHaveProperty('itemRegistry');
    expect(json).not.toHaveProperty('crateTierOdds');
    expect(json).not.toHaveProperty('aiDirector');
    expect(json).not.toHaveProperty('quests');

    const player = json.players[client.sessionId];
    expect(player).toBeDefined();
    for (const key of ['id', 'teamId', 'isBot', 'x', 'y', 'z', 'rotY', 'hp', 'weaponSlots', 'skillSlots', 'trapSlots']) {
      expect(player).toHaveProperty(key);
    }
    expect(player).not.toHaveProperty('equippedWeapon');
    expect(player).not.toHaveProperty('activeSkill');

    const firstBase = Object.values(json.bases)[0] as Record<string, any>;
    for (const key of ['teamId', 'tier', 'coreHp', 'points', 'sockets']) {
      expect(firstBase).toHaveProperty(key);
    }
    const firstSocket = Object.values(firstBase.sockets)[0] as Record<string, any>;
    for (const key of ['type', 'tier', 'occupied']) {
      expect(firstSocket).toHaveProperty(key);
    }

    const firstCrate = Object.values(json.crates)[0] as Record<string, any>;
    for (const key of ['id', 'x', 'z', 'tier', 'opened']) {
      expect(firstCrate).toHaveProperty(key);
    }
  });

  it('AT-09: defineInput sanitize clamps illegal and NaN move axes so applyInput never exceeds legal speed', async () => {
    const { default: appConfig } = await import('../server/app.config');
    const { MoveInput } = await import('../shared/MoveInput');
    testServer = await boot(appConfig);

    const room = await testServer.createRoom('island');
    const client = await testServer.connectTo(room);
    await room.waitForNextPatch();

    const input = client.input({ type: MoveInput, mode: 'reliable' });
    const serverPlayer = room.state.players.get(client.sessionId)!;

    // Send wildly out-of-range axes
    const x0 = serverPlayer.x;
    const z0 = serverPlayer.z;
    input.data.moveX = 999;
    input.data.moveZ = -999;
    input.data.rotY = 999;
    input.send();

    await room.waitForNextTimestep();
    await room.waitForNextTimestep();

    const dist1 = Math.hypot(serverPlayer.x - x0, serverPlayer.z - z0);
    const maxPerStep = ENGINE.moveSpeed * (1 / ENGINE.tickRate);
    expect(Number.isFinite(serverPlayer.x)).toBe(true);
    expect(Number.isFinite(serverPlayer.z)).toBe(true);
    expect(dist1).toBeLessThanOrEqual(maxPerStep + 0.05);

    // Send NaN axes
    const x1 = serverPlayer.x;
    const z1 = serverPlayer.z;
    input.data.moveX = Number.NaN;
    input.data.moveZ = Number.NaN;
    input.data.rotY = Number.NaN;
    input.send();

    await room.waitForNextTimestep();
    await room.waitForNextTimestep();

    expect(Number.isFinite(serverPlayer.x)).toBe(true);
    expect(Number.isFinite(serverPlayer.z)).toBe(true);
    expect(Number.isFinite(serverPlayer.rotY)).toBe(true);
    const dist2 = Math.hypot(serverPlayer.x - x1, serverPlayer.z - z1);
    expect(dist2).toBeLessThanOrEqual(maxPerStep + 0.05);
  });

  it('AT-10: Server and predicted client call the same applyInput and tampered client position reconciles to server', async () => {
    const roomSrc = fs.readFileSync(path.resolve(process.cwd(), 'server/rooms/IslandRoom.ts'), 'utf8');
    const clientSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/net/client.ts'), 'utf8');
    expect(roomSrc).toContain('applyInput');
    expect(clientSrc).toContain('applyInput');

    const { default: appConfig } = await import('../server/app.config');
    const { MoveInput } = await import('../shared/MoveInput');
    const { applyInput } = await import('../shared/applyInput');
    testServer = await boot(appConfig);

    const room = await testServer.createRoom('island');
    const client = await testServer.connectTo(room);
    await client.waitForNextPatch();

    const predict = Predict.get(client, { mode: 'lerp', delay: ENGINE.interpDelayMs });
    const self = client.state.players.get(client.sessionId)!;
    const input = client.input({ type: MoveInput, mode: 'reliable' });
    const me = predict.reconciler(self, {
      input,
      fields: ['x', 'y', 'z', 'rotY'],
      step: (ctx, s, cmd) => applyInput(s, cmd, ctx.dt, client.state.islandConfig.radius),
    });

    // Tamper client local predicted state far away from server truth
    me.state.x += 25;
    me.state.z += 25;

    // Send legal input and allow server tick + patch reconciliation
    input.data.moveX = 1;
    input.data.moveZ = 0;
    input.send();

    for (let i = 0; i < 6; i++) {
      await room.waitForNextTimestep();
    }
    await client.waitForNextPatch();
    predict.tick(performance.now() + 50);

    const serverPlayer = room.state.players.get(client.sessionId)!;
    expect(Math.abs(me.state.x - serverPlayer.x)).toBeLessThan(0.5);
    expect(Math.abs(me.state.z - serverPlayer.z)).toBeLessThan(0.5);

    predict.dispose();
  });

  it('AT-11: Remotes attach via predict.attachAll while local unit uses predict.reconciler and room.input', async () => {
    const clientSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/net/client.ts'), 'utf8');
    expect(clientSrc).toContain('Predict.get');
    expect(clientSrc).toContain('attachAll');
    expect(clientSrc).toContain('reconciler');
    expect(clientSrc).toContain('room.input');

    const { default: appConfig } = await import('../server/app.config');
    const { MoveInput } = await import('../shared/MoveInput');
    const { applyInput } = await import('../shared/applyInput');
    testServer = await boot(appConfig);

    const room = await testServer.createRoom('island');
    const c1 = await testServer.connectTo(room);
    const c2 = await testServer.connectTo(room);
    await c1.waitForNextPatch();
    await c2.waitForNextPatch();

    const predict = Predict.get(c1, { mode: 'lerp', delay: ENGINE.interpDelayMs });
    predict.attachAll('players', { mode: 'lerp', fields: ['x', 'y', 'z', 'rotY'] });
    const self = c1.state.players.get(c1.sessionId)!;
    const input1 = c1.input({ type: MoveInput, mode: 'reliable' });
    const me = predict.reconciler(self, {
      input: input1,
      fields: ['x', 'y', 'z', 'rotY'],
      step: (ctx, s, cmd) => applyInput(s, cmd, ctx.dt, c1.state.islandConfig.radius),
    });

    const input2 = c2.input({ type: MoveInput, mode: 'reliable' });
    const remote = c1.state.players.get(c2.sessionId)!;
    expect(remote).toBeDefined();
    const remoteStartX = remote.x;

    for (let i = 0; i < 6; i++) {
      input2.data.moveX = 1;
      input2.data.moveZ = 0;
      input2.send();
      await room.waitForNextTimestep();
    }
    await c1.waitForNextPatch();
    predict.tick(performance.now() + 200);

    expect(Number.isFinite(predict.value(remote, 'x'))).toBe(true);
    expect(Math.abs(remote.x - remoteStartX)).toBeGreaterThan(0.1);
    expect(me.state).toBeDefined();

    predict.dispose();
  });

  it('AT-12: Hit tests use lastSeenBy wrapper; logs warning on live fallback and stays silent when stamped', async () => {
    const { default: appConfig } = await import('../server/app.config');
    const { MoveInput } = await import('../shared/MoveInput');
    const { applyInput } = await import('../shared/applyInput');
    testServer = await boot(appConfig);

    const room = (await testServer.createRoom('island')) as any;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // 1. Unknown session -> live fallback warning naming rewind.lastSeenBy, session id, and live position
    room.getLastSeenBy('unstamped-ghost-id');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const msg1 = String(warnSpy.mock.calls[0]?.[0] ?? '');
    expect(msg1).toContain('rewind.lastSeenBy');
    expect(msg1).toContain('unstamped-ghost-id');
    expect(msg1.toLowerCase()).toContain('live position');

    warnSpy.mockClear();

    // 2. Real client wired with Predict + reconciler + room.input -> stamped renderTime (> 0) -> no warning
    const client = await testServer.connectTo(room);
    await client.waitForNextPatch();

    const predict = Predict.get(client, { mode: 'lerp', delay: ENGINE.interpDelayMs });
    predict.attachAll('players', { mode: 'lerp', fields: ['x', 'y', 'z', 'rotY'] });
    const self = client.state.players.get(client.sessionId)!;
    const input = client.input({ type: MoveInput, mode: 'reliable' });
    predict.reconciler(self, {
      input,
      fields: ['x', 'y', 'z', 'rotY'],
      step: (ctx, s, cmd) => applyInput(s, cmd, ctx.dt, client.state.islandConfig.radius),
    });

    // Pump inputs and wait for clock sync + stamped renderTime on server
    for (let i = 0; i < 15; i++) {
      predict.tick(performance.now() + i * 35);
      input.data.moveX = 0;
      input.data.moveZ = 0;
      input.send();
      await room.waitForNextTimestep();
      if (room.inputs.get(client.sessionId).renderTime > 0) {
        break;
      }
    }

    expect(room.inputs.get(client.sessionId).renderTime).toBeGreaterThan(0);
    warnSpy.mockClear();

    const seen = room.getLastSeenBy(client.sessionId);
    expect(seen).toBeDefined();
    expect(warnSpy).not.toHaveBeenCalled();

    predict.dispose();
  });
});
