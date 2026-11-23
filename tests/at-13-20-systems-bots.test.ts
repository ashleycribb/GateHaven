import { describe, it, expect, afterEach } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { ENGINE } from '../shared/engine';
import { ALL_ITEM_IDS, ITEM_REGISTRY, MODIFIER_REGISTRY } from '../shared/itemRegistry';

let testServer: ColyseusTestServer | null = null;

afterEach(async () => {
  if (testServer) {
    await testServer.shutdown();
    testServer = null;
  }
});

describe('AT-13..AT-20: BaseSystem, LootSystem, Upgrades, Scoring, Bots & MatchLog', () => {
  it('AT-13: Only legal socket types accept builds; wrong team, missing socket, or illegal tier rejected', async () => {
    const { buildOnSocket } = await import('../src/systems/BaseSystem');
    const { MatchLog } = await import('../server/MatchLog');
    const { IslandState } = await import('../shared/schema');
    const { PASS1_ISLAND_CONFIG, buildRadialIslandLayout } = await import('../shared/islandConfig');
    const { initializeIslandState } = await import('../server/rooms/stateInit');

    const state = new IslandState();
    initializeIslandState(state, PASS1_ISLAND_CONFIG, buildRadialIslandLayout(PASS1_ISLAND_CONFIG));
    const log = new MatchLog();

    const base0 = state.bases.get('team_0')!;
    const wallSocket = Array.from(base0.sockets.values()).find((s) => s.type === 'wall')!;
    const coreSocket = Array.from(base0.sockets.values()).find((s) => s.type === 'core_upgrade')!;

    // Wrong team rejected
    expect(buildOnSocket(base0, wallSocket.id, 'team_1', 'wall', 1, log).ok).toBe(false);
    // Missing socket rejected
    expect(buildOnSocket(base0, 'nonexistent_socket', 'team_0', 'wall', 1, log).ok).toBe(false);
    // Bogus socket type rejected
    expect(buildOnSocket(base0, wallSocket.id, 'team_0', 'laser_cannon' as any, 1, log).ok).toBe(false);
    // Mismatched socket type rejected
    expect(buildOnSocket(base0, wallSocket.id, 'team_0', 'tower', 1, log).ok).toBe(false);
    // Illegal tier rejected (0, jumping to 2, exceeding maxBaseTier)
    expect(buildOnSocket(base0, wallSocket.id, 'team_0', 'wall', 0, log).ok).toBe(false);
    expect(buildOnSocket(base0, wallSocket.id, 'team_0', 'wall', 2, log).ok).toBe(false);
    expect(buildOnSocket(base0, wallSocket.id, 'team_0', 'wall', ENGINE.maxBaseTier + 1, log).ok).toBe(false);

    // Legal build succeeds and mutates occupancy & tier
    const r1 = buildOnSocket(base0, wallSocket.id, 'team_0', 'wall', 1, log);
    expect(r1.ok).toBe(true);
    expect(wallSocket.occupied).toBe(true);
    expect(wallSocket.tier).toBe(1);

    // Legal core upgrade updates base tier
    const r2 = buildOnSocket(base0, coreSocket.id, 'team_0', 'core_upgrade', 1, log);
    expect(r2.ok).toBe(true);
    expect(base0.tier).toBeGreaterThanOrEqual(2);
  });

  it('AT-14: Opening crates yields only registry items per engine odds, cannot be looted twice, and logs crate_opened', async () => {
    const { rollCrateItem, openCrate } = await import('../src/systems/LootSystem');
    const { MatchLog } = await import('../server/MatchLog');
    const { BaseSchema, CrateSchema, PlayerSchema } = await import('../shared/schema');

    // Verify odds follow ENGINE.crateTierOdds across deterministic rolls
    const counts = { weapon: 0, skill: 0, trap: 0 };
    const total = 1000;
    for (let i = 0; i < total; i++) {
      const u = (i + 0.5) / total;
      let calls = 0;
      const rolled = rollCrateItem(3, () => (calls++ === 0 ? u : 0.1));
      expect(ALL_ITEM_IDS).toContain(rolled.itemId);
      counts[rolled.slotKind]++;
    }
    expect(counts.weapon / total).toBeCloseTo(ENGINE.crateTierOdds[3].weapon, 2);
    expect(counts.skill / total).toBeCloseTo(ENGINE.crateTierOdds[3].skill, 2);
    expect(counts.trap / total).toBeCloseTo(ENGINE.crateTierOdds[3].trap, 2);

    // Open crate once -> succeeds, logs crate_opened; second open -> rejected
    const crate = new CrateSchema();
    crate.id = 'crate_0';
    crate.x = 4;
    crate.z = -3;
    crate.tier = 2;
    crate.opened = false;

    const player = new PlayerSchema();
    player.id = 'p1';
    player.teamId = 'team_0';
    const base = new BaseSchema();
    base.teamId = 'team_0';
    const log = new MatchLog();

    const first = openCrate(crate, player, base, log, () => 0.1);
    expect(first.ok).toBe(true);
    expect(crate.opened).toBe(true);
    expect(log.entries.some((e) => e.type === 'crate_opened' && e.x === 4 && e.z === -3)).toBe(true);

    const second = openCrate(crate, player, base, log, () => 0.1);
    expect(second.ok).toBe(false);
  });

  it('AT-15: Unknown itemId fails closed; registry item granted from crate updates matching loadout slot', async () => {
    const { equipItem, openCrate } = await import('../src/systems/LootSystem');
    const { MatchLog } = await import('../server/MatchLog');
    const { BaseSchema, CrateSchema, PlayerSchema } = await import('../shared/schema');

    const player = new PlayerSchema();
    player.id = 'p1';
    player.teamId = 'team_0';

    // Unknown itemId rejected
    const bad = equipItem(player, 'weapon', 0, { itemId: 'unknown_mega_laser', level: 1, modifiers: [] });
    expect(bad.ok).toBe(false);
    expect(player.weaponSlots.length).toBe(0);

    // Wrong slot kind rejected (trap in weapon slot)
    const wrongSlot = equipItem(player, 'weapon', 0, { itemId: 'blast_mine', level: 1, modifiers: [] });
    expect(wrongSlot.ok).toBe(false);

    // Opening crate grants a valid registry item and equips it in matching loadout slot
    const crate = new CrateSchema();
    crate.id = 'crate_1';
    crate.x = 0;
    crate.z = 0;
    crate.tier = 2;
    crate.opened = false;
    const base = new BaseSchema();
    base.teamId = 'team_0';
    const log = new MatchLog();

    const res = openCrate(crate, player, base, log, () => 0.1); // forces weapon roll
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(player.weaponSlots.length).toBeGreaterThan(0);
      const equipped = player.weaponSlots[0];
      expect(equipped.itemId).toBe(res.granted.itemId);
      expect(equipped.level).toBe(res.granted.level);
    }
  });

  it('AT-16: Upgrading past maxLevel or applying unknown/illegal modifier fails closed; valid upgrade updates combat stats', async () => {
    const { equipItem, upgradeItem, applyModifier, getEffectiveItemStats } = await import(
      '../src/systems/LootSystem'
    );
    const { PlayerSchema } = await import('../shared/schema');

    const player = new PlayerSchema();
    player.id = 'p1';
    player.teamId = 'team_0';

    const def = ITEM_REGISTRY.plasma_carbine;
    expect(equipItem(player, 'weapon', 0, { itemId: def.id, level: 1, modifiers: [] }).ok).toBe(true);

    // Base level 1 damage matches registry
    expect(getEffectiveItemStats(player.weaponSlots[0]).damage).toBe(def.levels[1].damage);

    // Upgrade 1 -> 2 -> 3 succeeds and updates combat damage
    expect(upgradeItem(player, 'weapon', 0).ok).toBe(true);
    expect(player.weaponSlots[0].level).toBe(2);
    expect(getEffectiveItemStats(player.weaponSlots[0]).damage).toBe(def.levels[2].damage);

    expect(upgradeItem(player, 'weapon', 0).ok).toBe(true);
    expect(player.weaponSlots[0].level).toBe(3);
    expect(getEffectiveItemStats(player.weaponSlots[0]).damage).toBe(def.levels[3].damage);

    // Upgrading past maxLevel fails closed (no silent clamp)
    expect(upgradeItem(player, 'weapon', 0).ok).toBe(false);
    expect(player.weaponSlots[0].level).toBe(def.maxLevel);

    // Unknown modifier fails closed
    expect(applyModifier(player, 'weapon', 0, 'imaginary_mod').ok).toBe(false);

    // Legal modifier on wrong item fails closed ('wide_trigger' is for traps, not plasma_carbine)
    expect(applyModifier(player, 'weapon', 0, 'wide_trigger').ok).toBe(false);

    // Allowed modifier succeeds and scales effective combat damage
    expect(applyModifier(player, 'weapon', 0, 'overcharge').ok).toBe(true);
    expect(getEffectiveItemStats(player.weaponSlots[0]).damage).toBeCloseTo(
      def.levels[3].damage * MODIFIER_REGISTRY.overcharge.damageMultiplier,
      4,
    );
  });

  it('AT-17: Hybrid scoring adds engine points and bonuses; win/draw follows threshold and timer', async () => {
    const { awardPoints, evaluateMatchEnd } = await import('../server/rooms/scoring');
    const { IslandState } = await import('../shared/schema');
    const { PASS1_ISLAND_CONFIG, buildRadialIslandLayout } = await import('../shared/islandConfig');
    const { initializeIslandState } = await import('../server/rooms/stateInit');

    const state = new IslandState();
    initializeIslandState(state, PASS1_ISLAND_CONFIG, buildRadialIslandLayout(PASS1_ISLAND_CONFIG));

    awardPoints(state, 'team_0', 'loot');
    awardPoints(state, 'team_0', 'upgrade');
    awardPoints(state, 'team_0', 'tag');
    awardPoints(state, 'team_0', 'coreBreach');
    awardPoints(state, 'team_0', 'squadWipe');

    const expectedSum =
      ENGINE.points.loot +
      ENGINE.points.upgrade +
      ENGINE.points.tag +
      ENGINE.points.coreBreach +
      ENGINE.points.squadWipe;
    expect(state.bases.get('team_0')!.points).toBe(expectedSum);

    // Threshold check
    state.bases.get('team_0')!.points = ENGINE.winScoreThreshold;
    evaluateMatchEnd(state);
    expect(state.phase).toBe('ended');
    expect(state.winnerTeamId).toBe('team_0');

    // Timer tie -> draw
    const tieState = new IslandState();
    initializeIslandState(tieState, PASS1_ISLAND_CONFIG, buildRadialIslandLayout(PASS1_ISLAND_CONFIG));
    tieState.bases.get('team_0')!.points = 120;
    tieState.bases.get('team_1')!.points = 120;
    tieState.matchTimeRemaining = 0;
    evaluateMatchEnd(tieState);
    expect(tieState.phase).toBe('ended');
    expect(tieState.winnerTeamId).toBe('draw');

    // Timer strict leader -> winner
    const winState = new IslandState();
    initializeIslandState(winState, PASS1_ISLAND_CONFIG, buildRadialIslandLayout(PASS1_ISLAND_CONFIG));
    winState.bases.get('team_0')!.points = 120;
    winState.bases.get('team_1')!.points = 180;
    winState.matchTimeRemaining = 0;
    evaluateMatchEnd(winState);
    expect(winState.phase).toBe('ended');
    expect(winState.winnerTeamId).toBe('team_1');
  });

  it('AT-18: Bots tick on server at 60 Hz with isBot: true, transition across patrol/loot/build/fight, and mutate state with zero clients', async () => {
    const { default: appConfig } = await import('../server/app.config');
    const { selectBotState } = await import('../src/entities/BotController');

    expect(ENGINE.tickRate * ENGINE.subSteps).toBe(60);

    // State machine covers all 4 transitions
    expect(selectBotState({ hasEnemyInRange: true, hasNearbyCrate: true, hasFreeSocketNearBase: true, isHelper: false })).toBe('fight');
    expect(selectBotState({ hasEnemyInRange: false, hasNearbyCrate: true, hasFreeSocketNearBase: false, isHelper: false })).toBe('loot');
    expect(selectBotState({ hasEnemyInRange: false, hasNearbyCrate: false, hasFreeSocketNearBase: true, isHelper: false })).toBe('build');
    expect(selectBotState({ hasEnemyInRange: false, hasNearbyCrate: false, hasFreeSocketNearBase: false, isHelper: false })).toBe('patrol');

    testServer = await boot(appConfig);
    const room = await testServer.createRoom('island');

    const bots = Array.from(room.state.players.values()).filter((p: any) => p.isBot);
    expect(bots.length).toBeGreaterThan(0);

    const before = bots.map((b: any) => ({ id: b.id, x: b.x, z: b.z }));
    for (let i = 0; i < 8; i++) {
      await room.waitForNextTimestep();
    }

    const moved = before.some((snap) => {
      const live = room.state.players.get(snap.id) as any;
      return live && Math.hypot(live.x - snap.x, live.z - snap.z) > 0.05;
    });
    expect(moved).toBe(true);
  });

  it('AT-19: Each base has a server-authoritative helper NPC (isBot: true) in the unit map for clients to render', async () => {
    const { default: appConfig } = await import('../server/app.config');
    testServer = await boot(appConfig);

    const room = await testServer.createRoom('island');
    const client = await testServer.connectTo(room);
    await client.waitForNextPatch();

    for (const [teamId, base] of room.state.bases.entries() as Iterable<[string, any]>) {
      const helperId = `helper_${teamId}`;
      const serverHelper = room.state.players.get(helperId) as any;
      const clientHelper = client.state.players.get(helperId) as any;
      expect(serverHelper).toBeDefined();
      expect(serverHelper.isBot).toBe(true);
      expect(serverHelper.teamId).toBe(teamId);
      expect(Math.hypot(serverHelper.x - base.x, serverHelper.z - base.z)).toBeLessThanOrEqual(
        ENGINE.helperLeashRadius,
      );
      expect(clientHelper).toBeDefined();
      expect(clientHelper.isBot).toBe(true);
    }
  });

  it('AT-20: MatchLog records crate_opened, base_upgraded, trap_triggered, player_eliminated with coords and server timestamp', async () => {
    const { default: appConfig } = await import('../server/app.config');
    testServer = await boot(appConfig);

    const room = (await testServer.createRoom('island')) as any;
    const c1 = await testServer.connectTo(room);
    const c2 = await testServer.connectTo(room);
    await room.waitForNextPatch();

    const p1 = room.state.players.get(c1.sessionId)!;
    const p2 = room.state.players.get(c2.sessionId)!;
    // Ensure opposing teams
    p1.teamId = 'team_0';
    p2.teamId = 'team_1';

    // 1. crate_opened
    const firstCrate = Array.from(room.state.crates.values())[0] as any;
    p1.x = firstCrate.x;
    p1.z = firstCrate.z;
    expect(room.handleOpenCrate(c1.sessionId, firstCrate.id).ok).toBe(true);

    // 2. base_upgraded
    const base0 = room.state.bases.get('team_0')!;
    const wallSocket = Array.from(base0.sockets.values()).find((s: any) => s.type === 'wall') as any;
    expect(room.handleBuildSocket(c1.sessionId, wallSocket.id, 'wall', 1).ok).toBe(true);

    // 3. trap_triggered
    room.placeServerTrap(c1.sessionId, 'blast_mine', 1, [], p2.x, p2.z);
    room.checkTraps();

    // 4. player_eliminated
    p2.hp = 5;
    room.applyServerDamage(c1.sessionId, c2.sessionId, 50);

    const types = new Set(room.matchLog.entries.map((e: any) => e.type));
    for (const required of ['crate_opened', 'base_upgraded', 'trap_triggered', 'player_eliminated']) {
      expect(types.has(required), `Missing MatchLog event ${required}`).toBe(true);
      const entry = room.matchLog.entries.find((e: any) => e.type === required);
      expect(Number.isFinite(entry.x)).toBe(true);
      expect(Number.isFinite(entry.y)).toBe(true);
      expect(Number.isFinite(entry.z)).toBe(true);
      expect(typeof entry.timestamp).toBe('number');
      expect(entry.timestamp).toBeGreaterThan(0);
    }

    // MatchLog is server-only, NOT synced on Schema
    expect(room.state.toJSON()).not.toHaveProperty('matchLog');
  });
});
