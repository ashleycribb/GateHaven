import fs from 'node:fs';
import path from 'node:path';
import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3, Color4 } from '@babylonjs/core/Maths/math';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AnimationGroup } from '@babylonjs/core/Animations/animationGroup';
import '@babylonjs/loaders/glTF';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Collisions/collisionCoordinator';
import { InternalTexture, InternalTextureSource } from '@babylonjs/core/Materials/Textures/internalTexture';
import { ENGINE, type QualityPresetName } from '../../shared/engine';
import { resolveQualityPreset } from '../../shared/quality';
import assetManifest from '../../shared/assetManifest.json';

export type CharacterClipMap = {
  idle: AnimationGroup;
  run: AnimationGroup;
  jump: AnimationGroup;
  attack: AnimationGroup;
};

export interface HeadlessIslandHarness {
  scene: Scene;
  sunLight: DirectionalLight;
  shadowGenerator: CascadedShadowGenerator;
  camera: FreeCamera;
  cameraOffsetUsed: {
    right: number;
    height: number;
    distance: number;
  };
  loadedManifestGltfCount: number;
  importedMeshes: AbstractMesh[];
  characterClips: CharacterClipMap;
  dispose: () => void;
}

export function resolveCharacterAnimationClips(
  groups: AnimationGroup[],
): CharacterClipMap {
  const findClip = (patterns: RegExp[], label: string): AnimationGroup => {
    for (const pat of patterns) {
      const hit = groups.find((g) => pat.test(g.name));
      if (hit) return hit;
    }
    throw new Error(
      `Rigged character is missing required "${label}" animation clip (found: ${groups.map((g) => g.name).join(', ')})`,
    );
  };

  return {
    idle: findClip([/^idle_loop$/i, /idle/i], 'idle'),
    run: findClip([/^jog_fwd_loop$/i, /^sprint_loop$/i, /run|walk/i], 'run'),
    jump: findClip([/^jump_start$/i, /^jump_loop$/i, /jump/i], 'jump'),
    attack: findClip([/^sword_attack$/i, /^punch_cross$/i, /attack|shoot/i], 'attack'),
  };
}

function getManifestAssetDiskPath(id: string): string {
  const entry = assetManifest.assets.find((a) => a.id === id);
  if (!entry) {
    throw new Error(`Asset "${id}" not found in shared/assetManifest.json`);
  }
  const rel = entry.path.replace(/^\/+/, '');
  const fullPath = path.resolve(process.cwd(), 'public', rel);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Manifest asset "${id}" missing on disk at ${fullPath}`);
  }
  return fullPath;
}

/**
 * Headless Babylon scene harness used by AT-29 and AT-30 to verify real
 * SceneLoader glTF import, exponential fog, CascadedShadowGenerator,
 * character animation clips, and over-the-shoulder camera collision setup.
 */
export async function buildHeadlessIslandHarness(
  engine: AbstractEngine,
  qualityName: QualityPresetName,
): Promise<HeadlessIslandHarness> {
  const preset = resolveQualityPreset(qualityName);
  // NullEngine has no WebGL2 context; enable headless CSM & depth-stencil texture creation
  const nullTarget = engine as unknown as {
    _features?: { supportCSM?: boolean };
    _gl?: unknown;
    _createDepthStencilTexture?: (size: number | { width: number; height: number }) => InternalTexture;
  };
  if (!nullTarget._gl) {
    if (nullTarget._features) {
      nullTarget._features.supportCSM = true;
    }
    nullTarget._createDepthStencilTexture = (size) => {
      const tex = new InternalTexture(engine, InternalTextureSource.DepthStencil);
      const w = typeof size === 'number' ? size : size.width;
      const h = typeof size === 'number' ? size : size.height;
      tex.width = w;
      tex.height = h;
      tex.isReady = true;
      return tex;
    };
  }
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.18, 0.22, 0.26, 1);
  scene.collisionsEnabled = true;

  // Exponential fog driven by default server weather preset
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogColor = new Color3(0.42, 0.48, 0.52);
  scene.fogDensity = ENGINE.weatherPresets[ENGINE.defaultWeatherKind].fogDensity;

  // Lighting: directional sun + cool overcast hemispheric fill
  const hemi = new HemisphericLight('hemi', new Vector3(0, 1, 0), scene);
  hemi.intensity = 0.58;
  hemi.diffuse = new Color3(0.76, 0.82, 0.86);
  hemi.groundColor = new Color3(0.24, 0.27, 0.22);

  const sunLight = new DirectionalLight('sun', new Vector3(-0.55, -0.82, 0.38).normalize(), scene);
  sunLight.position = new Vector3(65, 95, -45);
  sunLight.intensity = 1.65;
  sunLight.diffuse = new Color3(0.95, 0.90, 0.80);

  const shadowGenerator = new CascadedShadowGenerator(preset.shadowMapSize, sunLight);
  shadowGenerator.numCascades = preset.shadowCascades;
  shadowGenerator.stabilizeCascades = true;
  shadowGenerator.lambda = 0.72;
  shadowGenerator.bias = 0.004;

  // Over-the-shoulder camera configured from ENGINE.cameraOffset with collision enabled
  const cameraOffsetUsed = {
    right: ENGINE.cameraOffset.right,
    height: ENGINE.cameraOffset.height,
    distance: ENGINE.cameraOffset.distance,
  };
  const camera = new FreeCamera(
    'otsCamera',
    new Vector3(cameraOffsetUsed.right, cameraOffsetUsed.height, -cameraOffsetUsed.distance),
    scene,
  );
  camera.checkCollisions = true;
  camera.ellipsoid = new Vector3(0.45, 0.45, 0.45);
  camera.minZ = 0.25;
  camera.maxZ = 450;
  camera.setTarget(new Vector3(cameraOffsetUsed.right * 0.4, 1.55, 4));
  scene.activeCamera = camera;

  // Import real manifest glTF assets via SceneLoader (character + pine prop)
  const importedMeshes: AbstractMesh[] = [];
  let loadedManifestGltfCount = 0;

  const charBuf = new Uint8Array(fs.readFileSync(getManifestAssetDiskPath('character_rigged')));
  const charResult = await SceneLoader.ImportMeshAsync('', '', charBuf, scene, undefined, '.glb');
  if (charResult.meshes.length === 0) {
    throw new Error('SceneLoader imported zero meshes for character_rigged');
  }
  loadedManifestGltfCount += 1;
  importedMeshes.push(...charResult.meshes);
  const characterClips = resolveCharacterAnimationClips(charResult.animationGroups);
  // Stop auto-playing all clips and start idle cleanly
  for (const ag of charResult.animationGroups) ag.stop();
  characterClips.idle.start(true);

  const pineBuf = new Uint8Array(fs.readFileSync(getManifestAssetDiskPath('pine_tree_1')));
  const pineResult = await SceneLoader.ImportMeshAsync('', '', pineBuf, scene, undefined, '.glb');
  if (pineResult.meshes.length === 0) {
    throw new Error('SceneLoader imported zero meshes for pine_tree_1');
  }
  loadedManifestGltfCount += 1;
  importedMeshes.push(...pineResult.meshes);

  for (const mesh of importedMeshes) {
    if (mesh.getTotalVertices() > 0) {
      shadowGenerator.addShadowCaster(mesh, false);
    }
  }

  return {
    scene,
    sunLight,
    shadowGenerator,
    camera,
    cameraOffsetUsed,
    loadedManifestGltfCount,
    importedMeshes,
    characterClips,
    dispose: () => {
      shadowGenerator.dispose();
      scene.dispose();
    },
  };
}
