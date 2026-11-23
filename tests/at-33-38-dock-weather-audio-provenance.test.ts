import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';
import { boot, type ColyseusTestServer } from '@colyseus/testing';
import { ENGINE } from '../shared/engine';
import { ITEM_REGISTRY } from '../shared/itemRegistry';

let testServer: ColyseusTestServer | null = null;

afterEach(async () => {
  if (testServer) {
    await testServer.shutdown();
    testServer = null;
  }
});

describe('AT-33..AT-38: Dock/Marina Arrival, Boats, Weather, Ocean Audio & Build-Time-Only AI Studio Tools', () => {
  it('AT-33: Room starts in dock phase, advances strictly dock->boarding->sailing->landing->match, guards boarding, and ticks match clock only after all land', async () => {
    const { default: appConfig } = await import('../server/app.config');
    testServer = await boot(appConfig);
    const room = (await testServer.createRoom('island')) as any;
    const c1 = await testServer.connectTo(room);
    await room.waitForNextPatch();

    expect(room.state.phase).toBe('dock');
    const p1 = room.state.players.get(c1.sessionId)!;
    expect(p1.landed).toBe(false);
    expect(p1.boatId).toBe('');
    expect(room.state.matchTimeRemaining).toBe(ENGINE.matchDurationSec);

    // Must reject skipping dock -> sailing and jumping backward
    expect(room.tryAdvancePhase('sailing').ok).toBe(false);
    expect(room.tryAdvancePhase('match').ok).toBe(false);
    expect(room.tryAdvancePhase('invalid_phase' as any).ok).toBe(false);

    // Combat, crates, and building rejected before match
    const firstCrate = Array.from(room.state.crates.values())[0] as any;
    expect(room.handleOpenCrate(c1.sessionId, firstCrate.id).ok).toBe(false);

    // Advance dock -> boarding
    expect(room.tryAdvancePhase('boarding').ok).toBe(true);
    expect(room.state.phase).toBe('boarding');

    // Cannot jump backward boarding -> dock
    expect(room.tryAdvancePhase('dock').ok).toBe(false);

    // Cannot enter sailing while a non-helper player still has empty boatId
    expect(room.tryAdvancePhase('sailing').ok).toBe(false);
    expect(room.state.phase).toBe('boarding');

    // Timer must NOT decrement during dock/boarding
    await room.waitForNextTimestep();
    await room.waitForNextTimestep();
    expect(room.state.matchTimeRemaining).toBe(ENGINE.matchDurationSec);

    // Board all non-helper players on their team's boat -> sailing allowed
    expect(room.boardAllPendingPlayers().ok).toBe(true);
    expect(p1.boatId).toBeTruthy();
    expect(p1.landed).toBe(false);
    expect(room.tryAdvancePhase('sailing').ok).toBe(true);
    expect(room.state.phase).toBe('sailing');
    expect(room.state.matchTimeRemaining).toBe(ENGINE.matchDurationSec);

    // Advance sailing -> landing -> match
    expect(room.tryAdvancePhase('landing').ok).toBe(true);
    expect(room.state.phase).toBe('landing');
    expect(room.state.matchTimeRemaining).toBe(ENGINE.matchDurationSec);

    room.completeBoatLandings();
    expect(p1.landed).toBe(true);
    expect(p1.boatId).toBe('');
    expect(room.tryAdvancePhase('match').ok).toBe(true);
    expect(room.state.phase).toBe('match');

    // Now matchTimeRemaining decrements on timesteps
    await room.waitForNextTimestep();
    await room.waitForNextTimestep();
    expect(room.state.matchTimeRemaining).toBeLessThan(ENGINE.matchDurationSec);
  });

  it('AT-34: Each team boat starts at marina slip, sails to own radial base shore, and lands players on own shore inside island radius', async () => {
    const { default: appConfig } = await import('../server/app.config');
    const { getTeamShoreLandingPoint } = await import('../shared/marina');
    testServer = await boot(appConfig);
    const room = (await testServer.createRoom('island')) as any;
    const c1 = await testServer.connectTo(room);
    const c2 = await testServer.connectTo(room);
    await room.waitForNextPatch();

    expect(room.state.boats.size).toBe(room.state.islandConfig.teamCount);

    // Boats start at marina slips (near ENGINE.marina.centerZ)
    for (const boat of room.state.boats.values()) {
      expect(Math.abs(boat.z - (ENGINE.marina.centerZ + ENGINE.marina.slipOffsetZ))).toBeLessThan(4);
    }

    // Walk through dock -> boarding -> sailing -> landing
    expect(room.tryAdvancePhase('boarding').ok).toBe(true);
    expect(room.boardAllPendingPlayers().ok).toBe(true);
    expect(room.tryAdvancePhase('sailing').ok).toBe(true);

    // Complete boat transit along deterministic path to shore
    room.advanceBoatsToShore();
    expect(room.tryAdvancePhase('landing').ok).toBe(true);
    room.completeBoatLandings();

    for (const sessionId of [c1.sessionId, c2.sessionId]) {
      const p = room.state.players.get(sessionId)!;
      const ownBase = room.state.bases.get(p.teamId)!;
      const otherBase = Array.from(room.state.bases.values()).find(
        (b: any) => b.teamId !== p.teamId,
      ) as any;
      const landingPt = getTeamShoreLandingPoint(room.state.islandConfig, p.teamId);

      expect(p.landed).toBe(true);
      expect(p.boatId).toBe('');
      expect(Math.hypot(p.x - landingPt.x, p.z - landingPt.z)).toBeLessThanOrEqual(ENGINE.landingRadius);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(room.state.islandConfig.radius);
      expect(Math.hypot(p.x - ownBase.x, p.z - ownBase.z)).toBeLessThan(
        Math.hypot(p.x - otherBase.x, p.z - otherBase.z),
      );
    }
  });

  it('AT-35: Weather kind/values validate fail-closed against ENGINE bounds and never alter movement or combat stats', async () => {
    const { default: appConfig } = await import('../server/app.config');
    const { getEffectiveItemStats } = await import('../src/systems/LootSystem');
    testServer = await boot(appConfig);
    const room = (await testServer.createRoom('island')) as any;

    expect(ENGINE.weatherKinds).toContain(room.state.weather.kind);

    const speedBefore = ENGINE.moveSpeed;
    const damageBefore = getEffectiveItemStats({ itemId: 'plasma_carbine', level: 1, modifiers: [] }).damage;

    // Invalid kind fails closed
    expect(room.setWeather({ kind: 'blizzard' as any, wind: 0.5, fogDensity: 0.01, rainIntensity: 0.5 }).ok).toBe(false);
    // Out-of-bounds values fail closed (no silent clamp)
    expect(room.setWeather({ kind: 'storm', wind: 5.0, fogDensity: 0.01, rainIntensity: 0.5 }).ok).toBe(false);
    expect(room.setWeather({ kind: 'rain', wind: 0.5, fogDensity: -0.1, rainIntensity: 0.5 }).ok).toBe(false);
    expect(room.setWeather({ kind: 'rain', wind: 0.5, fogDensity: 0.01, rainIntensity: 2.0 }).ok).toBe(false);

    // Valid storm weather succeeds
    expect(room.setWeather({ kind: 'storm', wind: 0.9, fogDensity: 0.022, rainIntensity: 0.95 }).ok).toBe(true);
    expect(room.state.weather.kind).toBe('storm');
    expect(room.state.weather.wind).toBeCloseTo(0.9, 4);

    // Gameplay sim numbers unaffected by weather
    expect(ENGINE.moveSpeed).toBe(speedBefore);
    expect(getEffectiveItemStats({ itemId: 'plasma_carbine', level: 1, modifiers: [] }).damage).toBe(damageBefore);
    expect(ITEM_REGISTRY.plasma_carbine.levels[1].damage).toBe(damageBefore);
  });

  it('AT-36: Pure ocean gain curve uses ENGINE constants and Web Audio controller fails closed on missing buffers unless audio is off', async () => {
    const { computeOceanAudioGain } = await import('../shared/oceanAudio');
    const { OceanAudioController } = await import('../src/audio/OceanAudio');

    const atShore = computeOceanAudioGain(0);
    const midInland = computeOceanAudioGain(ENGINE.oceanAudioMaxDistance * 0.5);
    const atMax = computeOceanAudioGain(ENGINE.oceanAudioMaxDistance);
    const beyondMax = computeOceanAudioGain(ENGINE.oceanAudioMaxDistance + 25);

    expect(atShore).toBeCloseTo(ENGINE.oceanAudio.maxGain, 4);
    expect(midInland).toBeLessThan(atShore);
    expect(midInland).toBeGreaterThan(atMax);
    expect(atMax).toBeCloseTo(ENGINE.oceanAudio.minGain, 4);
    expect(beyondMax).toBeCloseTo(ENGINE.oceanAudio.minGain, 4);

    // Missing buffer fails closed when audioEnabled is true
    const failingAudio = new OceanAudioController({
      audioEnabled: true,
      bufferUrl: '/assets/audio/does_not_exist.wav',
      fetcher: async () => new Response(null, { status: 404 }),
    });
    await expect(failingAudio.init()).rejects.toThrow();

    // Explicit audioEnabled: false skips loading cleanly
    const mutedAudio = new OceanAudioController({
      audioEnabled: false,
      bufferUrl: '/assets/audio/does_not_exist.wav',
    });
    await expect(mutedAudio.init()).resolves.toBeUndefined();
  });

  it('AT-37: Client runtime and room do not import Google Maps or call /api/generate or @google/genai; heightmap is checked-in manifest file', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'shared/assetManifest.json'), 'utf8'),
    ) as { assets: Array<{ id: string; path: string }> };

    const heightmapEntry = manifest.assets.find((a) => a.id === 'island_heightmap');
    expect(heightmapEntry, 'Missing island_heightmap entry in shared/assetManifest.json').toBeDefined();
    const hmDisk = path.resolve(process.cwd(), 'public', heightmapEntry!.path.replace(/^\/+/, ''));
    expect(fs.existsSync(hmDisk), `Heightmap file missing: ${hmDisk}`).toBe(true);

    const filesToAudit = [
      'src/App.tsx',
      'src/net/client.ts',
      'src/world/IslandScene.ts',
      'server/rooms/IslandRoom.ts',
    ];
    for (const rel of filesToAudit) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      expect(content).not.toMatch(/maps\.googleapis\.com|@googlemaps|google\.maps/i);
      expect(content).not.toMatch(/\/api\/generate|@google\/genai/);
    }
  });

  it('AT-38: AI Studio generated manifest entries record prompt and ISO date; runtime invokes no live generation', () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'shared/assetManifest.json'), 'utf8'),
    ) as {
      assets: Array<{
        id: string;
        source?: string;
        sourceUrl?: string;
        license?: string;
        prompt?: string;
        date?: string;
      }>;
    };

    const aiEntries = manifest.assets.filter((a) => a.source === 'AI Studio generated');
    expect(aiEntries.length).toBeGreaterThanOrEqual(1);
    for (const entry of aiEntries) {
      expect(typeof entry.prompt).toBe('string');
      expect(entry.prompt!.trim().length).toBeGreaterThan(5);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(entry.sourceUrl).toBeUndefined();
    }

    const cc0Entries = manifest.assets.filter((a) => a.source !== 'AI Studio generated');
    expect(cc0Entries.length).toBeGreaterThanOrEqual(5);
    for (const entry of cc0Entries) {
      expect(entry.license).toBe('CC0-1.0');
      expect(entry.sourceUrl).toBeTruthy();
    }
  });
});
