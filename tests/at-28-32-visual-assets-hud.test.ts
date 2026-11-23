import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Scene } from '@babylonjs/core/scene';
import { DISPLAY_NAME } from '../shared/branding';
import { ENGINE } from '../shared/engine';

const VERIFIED_CC0_HOSTS = new Set([
  'quaternius.com',
  'kenney.nl',
  'polyhaven.com',
  'dl.polyhaven.org',
]);

describe('AT-28..AT-32: Asset Manifest Provenance, Headless Babylon Scene, Rig/Camera, Quality Presets & HUD Reskin', () => {
  it('AT-28: shared/assetManifest.json lists every vendored asset with valid CC0 or AI Studio provenance and existing local files', () => {
    const manifestPath = path.resolve(process.cwd(), 'shared/assetManifest.json');
    expect(fs.existsSync(manifestPath), 'Missing shared/assetManifest.json').toBe(true);

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
      assets: Array<{
        id: string;
        path: string;
        usedFor: string;
        source?: string;
        sourceUrl?: string;
        license?: string;
        author?: string;
        prompt?: string;
        date?: string;
      }>;
    };

    expect(Array.isArray(manifest.assets)).toBe(true);
    expect(manifest.assets.length).toBeGreaterThanOrEqual(8);

    const ids = new Set<string>();
    const pathsInManifest = new Set<string>();

    for (const entry of manifest.assets) {
      expect(typeof entry.id).toBe('string');
      expect(entry.id.trim().length).toBeGreaterThan(0);
      expect(ids.has(entry.id), `Duplicate manifest id ${entry.id}`).toBe(false);
      ids.add(entry.id);

      expect(typeof entry.usedFor).toBe('string');
      expect(entry.usedFor.trim().length).toBeGreaterThan(0);

      // Local path must exist on disk
      const normalizedRel = entry.path.replace(/^\/+/, '');
      const fullDiskPath = path.resolve(process.cwd(), 'public', normalizedRel);
      const altDiskPath = path.resolve(process.cwd(), normalizedRel);
      const exists = fs.existsSync(fullDiskPath) || fs.existsSync(altDiskPath);
      expect(exists, `Missing vendored asset on disk: ${entry.path}`).toBe(true);
      pathsInManifest.add(normalizedRel);

      // No Poly Pizza anywhere
      expect((entry.sourceUrl ?? '').toLowerCase()).not.toContain('poly.pizza');
      expect((entry.author ?? '').toLowerCase()).not.toContain('poly pizza');

      if (entry.source === 'AI Studio generated') {
        expect(typeof entry.prompt).toBe('string');
        expect((entry.prompt ?? '').trim().length).toBeGreaterThan(0);
        expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      } else {
        expect(entry.license).toBe('CC0-1.0');
        expect(typeof entry.author).toBe('string');
        expect((entry.author ?? '').trim().length).toBeGreaterThan(0);
        expect(typeof entry.sourceUrl).toBe('string');
        const parsed = new URL(entry.sourceUrl!);
        expect(
          VERIFIED_CC0_HOSTS.has(parsed.hostname),
          `Unverified CC0 source host: ${parsed.hostname}`,
        ).toBe(true);
      }
    }
  });

  it('AT-29: Headless NullEngine constructs island scene with exponential fog, cascaded shadows, and manifest glTF mesh via SceneLoader', async () => {
    const { buildHeadlessIslandHarness } = await import('../src/world/islandSceneHarness');
    const engine = new NullEngine();
    try {
      const harness = await buildHeadlessIslandHarness(engine, 'medium');
      expect(harness.scene.fogMode).toBe(Scene.FOGMODE_EXP2);
      expect(harness.shadowGenerator).toBeDefined();
      expect(harness.shadowGenerator.getClassName()).toBe('CascadedShadowGenerator');
      expect(harness.loadedManifestGltfCount).toBeGreaterThanOrEqual(1);
      expect(harness.importedMeshes.length).toBeGreaterThanOrEqual(1);
      harness.dispose();
    } finally {
      engine.dispose();
    }
  });

  it('AT-30: Loaded character exposes idle/run/jump/attack clips and over-the-shoulder camera uses ENGINE.cameraOffset with collision enabled', async () => {
    const { buildHeadlessIslandHarness } = await import('../src/world/islandSceneHarness');
    const engine = new NullEngine();
    try {
      const harness = await buildHeadlessIslandHarness(engine, 'medium');
      for (const clip of ['idle', 'run', 'jump', 'attack'] as const) {
        expect(harness.characterClips[clip], `Missing character clip "${clip}"`).toBeDefined();
      }
      expect(harness.camera.checkCollisions).toBe(true);
      expect(harness.cameraOffsetUsed.right).toBe(ENGINE.cameraOffset.right);
      expect(harness.cameraOffsetUsed.height).toBe(ENGINE.cameraOffset.height);
      expect(harness.cameraOffsetUsed.distance).toBe(ENGINE.cameraOffset.distance);
      harness.dispose();
    } finally {
      engine.dispose();
    }
  });

  it('AT-31: ENGINE defines low/medium/high quality presets, explicit resolver fails closed, and no silent FPS auto-downgrade exists', async () => {
    const { resolveQualityPreset } = await import('../shared/quality');

    for (const key of ['low', 'medium', 'high'] as const) {
      const preset = resolveQualityPreset(key);
      expect(preset.maxDrawCalls).toBeGreaterThan(0);
      expect(preset.maxTriangles).toBeGreaterThan(0);
      expect(preset.shadowCascades).toBeGreaterThanOrEqual(2);
      expect(preset.scatterDensity).toBeGreaterThan(0);
      expect(preset.maxParticles).toBeGreaterThan(0);
    }

    expect(() => resolveQualityPreset(undefined)).toThrow();
    expect(() => resolveQualityPreset('')).toThrow();
    expect(() => resolveQualityPreset('ultra' as any)).toThrow();
    expect(() => resolveQualityPreset('auto' as any)).toThrow();

    // Ensure no silent hardware/fps auto-downgrade in scene code
    const sceneSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/world/IslandScene.ts'), 'utf8');
    expect(sceneSrc).not.toMatch(/getFps\s*\(\s*\)\s*<|fps\s*<\s*\d+/i);
    expect(sceneSrc).not.toMatch(/autoDowngrade|adaptiveQuality|hardwareScalingLevel/i);
  });

  it('AT-32: HUD uses dark translucent tokens, bottom-center hotbar, top scoreboard, no bubbly fonts, and DISPLAY_NAME title', () => {
    const appSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/App.tsx'), 'utf8');
    const cssSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/index.css'), 'utf8');
    const htmlSrc = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8');

    expect(appSrc).toContain('DISPLAY_NAME');
    expect(appSrc).toContain('data-hud-hotbar');
    expect(appSrc).toContain('data-hud-scoreboard');
    expect(cssSrc).toContain('--hud-panel-bg');

    const combinedStyles = `${cssSrc}\n${htmlSrc}\n${appSrc}`.toLowerCase();
    for (const banned of ENGINE.hudBannedFonts) {
      expect(combinedStyles).not.toContain(banned.toLowerCase());
    }
  });
});
