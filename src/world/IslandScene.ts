import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { CascadedShadowGenerator } from '@babylonjs/core/Lights/Shadows/cascadedShadowGenerator';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color';
import { Matrix, Quaternion, Vector2, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Texture } from '@babylonjs/core/Materials/Textures/texture';
import { HDRCubeTexture } from '@babylonjs/core/Materials/Textures/hdrCubeTexture';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh';
import type { AssetContainer } from '@babylonjs/core/assetContainer';
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader';
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateGroundFromHeightMap } from '@babylonjs/core/Meshes/Builders/groundBuilder';
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder';
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder';
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder';
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import { Ray } from '@babylonjs/core/Culling/ray';
import { WaterMaterial } from '@babylonjs/materials/water/waterMaterial';
import '@babylonjs/loaders/glTF';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent';
import '@babylonjs/core/Collisions/collisionCoordinator';
import '@babylonjs/core/Particles/particleSystemComponent';
import '@babylonjs/core/Culling/ray';
import '@babylonjs/core/Misc/dds';
import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader';

import { ENGINE, type QualityPreset, type QualityPresetName, type WeatherKind } from '../../shared/engine';
import { resolveQualityPreset } from '../../shared/quality';
import { getMarinaSlipPose } from '../../shared/marina';
import assetManifest from '../../shared/assetManifest.json';
import type { BaseState, BoatState, CrateState, PlayerState, SocketState } from '../../shared/schema';
import type { PlayerController } from '../entities/PlayerController';
import type { BattleIslandConnection } from '../net/client';
import { OceanAudioController } from '../audio/OceanAudio';
import { resolveCharacterAnimationClips, type CharacterClipMap } from './islandSceneHarness';

// Muted Nordic heraldry colors — applied ONLY to team banners, boat sails/trim, and shoulder cloth
const TEAM_HERALDRY_PALETTE: readonly Color3[] = [
  new Color3(0.66, 0.25, 0.18), // team_0: Weathered Rust Ember
  new Color3(0.18, 0.38, 0.54), // team_1: Fjord Slate Blue
  new Color3(0.28, 0.45, 0.27), // team_2: Pine Moss
  new Color3(0.68, 0.54, 0.22), // team_3: Burnished Ochre
  new Color3(0.46, 0.28, 0.50), // team_4: Heather Plum
];

function teamHeraldryColor(teamId: string): Color3 {
  const idx = Number(teamId.replace('team_', ''));
  if (Number.isInteger(idx) && idx >= 0 && idx < TEAM_HERALDRY_PALETTE.length) {
    return TEAM_HERALDRY_PALETTE[idx];
  }
  return TEAM_HERALDRY_PALETTE[0];
}

function getManifestPath(id: string): string {
  const entry = assetManifest.assets.find((a) => a.id === id);
  if (!entry) {
    throw new Error(`Required manifest asset "${id}" is missing from shared/assetManifest.json`);
  }
  return entry.path;
}

function splitAssetPath(url: string): { rootUrl: string; filename: string } {
  const idx = url.lastIndexOf('/');
  if (idx === -1) return { rootUrl: '/', filename: url };
  return { rootUrl: url.slice(0, idx + 1), filename: url.slice(idx + 1) };
}

function deterministicHash(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

type AnimState = 'idle' | 'run' | 'jump' | 'attack' | 'sit';

interface UnitVisual {
  root: TransformNode;
  modelRoot: TransformNode;
  clips: CharacterClipMap | null;
  sitClip: { start: (loop?: boolean) => void; stop: () => void } | null;
  activeAnim: AnimState;
  shieldDome: Mesh;
  teamCrest: Mesh;
  helperRing?: Mesh;
  teamId: string;
  lastX: number;
  lastZ: number;
  lastHp: number;
  attackTimerSec: number;
}

interface BaseVisual {
  root: TransformNode;
  coreRoot: TransformNode;
  bannerMat: PBRMaterial;
  sockets: Map<string, { pad: Mesh; builtRoot: TransformNode | null; lastTier: number }>;
}

interface BoatVisual {
  root: TransformNode;
  hullRoot: TransformNode;
  teamId: string;
}

interface AssetContainers {
  character: AssetContainer | null;
  pine1: AssetContainer | null;
  pine2: AssetContainer | null;
  rock: AssetContainer | null;
  grass: AssetContainer | null;
  boat: AssetContainer | null;
  dock: AssetContainer | null;
  wallWood: AssetContainer | null;
  towerWood: AssetContainer | null;
  wallStone: AssetContainer | null;
  towerStone: AssetContainer | null;
  banner: AssetContainer | null;
  crate: AssetContainer | null;
}

export interface IslandSceneOptions {
  quality?: QualityPresetName;
  audioEnabled?: boolean;
}

export class IslandScene {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: FreeCamera;
  private readonly sunLight: DirectionalLight;
  private readonly hemiLight: HemisphericLight;
  private shadowGenerator: CascadedShadowGenerator;
  private readonly connection: BattleIslandConnection;
  private readonly controller: PlayerController;
  private qualityPreset: QualityPreset;

  private readonly oceanAudio: OceanAudioController;
  private audioInitialized = false;

  private readonly containers: AssetContainers = {
    character: null,
    pine1: null,
    pine2: null,
    rock: null,
    grass: null,
    boat: null,
    dock: null,
    wallWood: null,
    towerWood: null,
    wallStone: null,
    towerStone: null,
    banner: null,
    crate: null,
  };
  private assetsReady = false;

  private readonly unitVisuals = new Map<string, UnitVisual>();
  private readonly baseVisuals = new Map<string, BaseVisual>();
  private readonly boatVisuals = new Map<string, BoatVisual>();
  private readonly crateVisuals = new Map<string, TransformNode>();
  private readonly trapVisuals = new Map<string, Mesh>();

  private islandBuiltRadius = 0;
  private islandBuiltTeams = 0;
  private readonly islandNodes: TransformNode[] = [];
  private readonly scatterRoots: TransformNode[] = [];
  private waterMaterial: WaterMaterial | null = null;
  private terrainMesh: Mesh | null = null;
  private skyboxMesh: Mesh | null = null;
  private rainParticles: ParticleSystem | null = null;
  private hitSparkTex: DynamicTexture;

  private readonly teamBannerMaterials = new Map<string, PBRMaterial>();
  private readonly crateTierMaterials = new Map<number, PBRMaterial>();
  private readonly shieldMat: PBRMaterial;
  private readonly trapMat: PBRMaterial;
  private readonly socketPadMat: PBRMaterial;
  private readonly weatheredWoodMat: PBRMaterial;
  private readonly darkStoneMat: PBRMaterial;
  private readonly skyOvercastEnv: HDRCubeTexture;
  private readonly skyClearEnv: HDRCubeTexture;
  private activeWeatherKind: WeatherKind = ENGINE.defaultWeatherKind;

  private lastFrameMs = performance.now();
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    connection: BattleIslandConnection,
    controller: PlayerController,
    options: IslandSceneOptions = {},
  ) {
    this.connection = connection;
    this.controller = controller;
    this.qualityPreset = resolveQualityPreset(options.quality ?? ENGINE.defaultQuality);

    this.engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false });
    this.scene = new Scene(this.engine);
    this.scene.collisionsEnabled = true;
    this.scene.clearColor = new Color4(0.18, 0.22, 0.25, 1);

    // Exponential atmospheric fog synced dynamically to server weather
    this.scene.fogMode = Scene.FOGMODE_EXP2;
    this.scene.fogColor = new Color3(0.41, 0.47, 0.50);
    this.scene.fogDensity = ENGINE.weatherPresets[ENGINE.defaultWeatherKind].fogDensity;

    // Poly Haven 1k HDRI environments for overcast/storm and clear skies
    this.skyOvercastEnv = new HDRCubeTexture(
      getManifestPath('sky_misty_pines'),
      this.scene,
      256,
      false,
      true,
      false,
      true,
    );
    this.skyClearEnv = new HDRCubeTexture(
      getManifestPath('sky_dalkey_view'),
      this.scene,
      256,
      false,
      true,
      false,
      true,
    );
    this.scene.environmentTexture = this.skyOvercastEnv;
    this.scene.environmentIntensity = 0.72;
    this.skyboxMesh = this.scene.createDefaultSkybox(this.skyOvercastEnv, true, 650, 0.25, false);

    // Muted Valheim coastal sun + overcast hemispheric fill
    this.hemiLight = new HemisphericLight('hemi', new Vector3(0.12, 1, 0.08), this.scene);
    this.hemiLight.intensity = 0.56;
    this.hemiLight.diffuse = new Color3(0.75, 0.81, 0.84);
    this.hemiLight.groundColor = new Color3(0.22, 0.25, 0.20);

    this.sunLight = new DirectionalLight(
      'sun',
      new Vector3(-0.56, -0.78, 0.40).normalize(),
      this.scene,
    );
    this.sunLight.position = new Vector3(70, 95, -50);
    this.sunLight.intensity = 1.65;
    this.sunLight.diffuse = new Color3(0.95, 0.87, 0.72);
    this.sunLight.specular = new Color3(0.85, 0.80, 0.72);

    this.shadowGenerator = this.createShadowGenerator(this.qualityPreset);

    // Over-the-shoulder camera configured from ENGINE.cameraOffset with collision enabled
    this.camera = new FreeCamera(
      'otsCam',
      new Vector3(
        ENGINE.cameraOffset.right,
        ENGINE.cameraOffset.height + 2,
        ENGINE.marina.centerZ - ENGINE.cameraOffset.distance,
      ),
      this.scene,
    );
    this.camera.checkCollisions = true;
    this.camera.ellipsoid = new Vector3(0.45, 0.45, 0.45);
    this.camera.minZ = 0.25;
    this.camera.maxZ = 520;

    // Shared PBR Materials (muted Nordic timber, wet slate, aged iron)
    this.weatheredWoodMat = new PBRMaterial('weatheredWoodMat', this.scene);
    const woodTex = new Texture(getManifestPath('tex_wooden_planks'), this.scene);
    woodTex.uScale = 3;
    woodTex.vScale = 3;
    this.weatheredWoodMat.albedoTexture = woodTex;
    this.weatheredWoodMat.albedoColor = new Color3(0.68, 0.61, 0.52);
    this.weatheredWoodMat.roughness = 0.88;
    this.weatheredWoodMat.metallic = 0.04;

    this.darkStoneMat = new PBRMaterial('darkStoneMat', this.scene);
    const rockTex = new Texture(getManifestPath('tex_rocky_trail'), this.scene);
    rockTex.uScale = 2.5;
    rockTex.vScale = 2.5;
    this.darkStoneMat.albedoTexture = rockTex;
    this.darkStoneMat.albedoColor = new Color3(0.55, 0.58, 0.58);
    this.darkStoneMat.roughness = 0.92;
    this.darkStoneMat.metallic = 0.06;

    this.shieldMat = new PBRMaterial('shieldMat', this.scene);
    this.shieldMat.albedoColor = new Color3(0.35, 0.68, 0.78);
    this.shieldMat.emissiveColor = new Color3(0.08, 0.24, 0.30);
    this.shieldMat.alpha = 0.32;
    this.shieldMat.roughness = 0.22;
    this.shieldMat.metallic = 0.15;

    this.trapMat = new PBRMaterial('trapMat', this.scene);
    this.trapMat.albedoColor = new Color3(0.46, 0.22, 0.17);
    this.trapMat.emissiveColor = new Color3(0.22, 0.06, 0.03);
    this.trapMat.roughness = 0.72;
    this.trapMat.metallic = 0.35;

    this.socketPadMat = new PBRMaterial('socketPadMat', this.scene);
    this.socketPadMat.albedoColor = new Color3(0.44, 0.41, 0.36);
    this.socketPadMat.roughness = 0.94;
    this.socketPadMat.metallic = 0.08;

    this.initCrateTierMaterials();
    this.hitSparkTex = this.createSoftParticleTexture('hitSparkTex', '#f0b86c');
    this.setupRainSystem();

    // Web Audio positional coastal wave ambience (loads manifest audio buffer)
    this.oceanAudio = new OceanAudioController({
      audioEnabled: options.audioEnabled ?? true,
      bufferUrl: getManifestPath('ocean_waves_audio'),
    });

    // Load all vendored CC0 glTF containers asynchronously
    void this.loadManifestContainers();

    window.addEventListener('resize', this.onResize);
    canvas.addEventListener('pointerdown', this.unlockAudioOnGesture, { once: true });
    window.addEventListener('keydown', this.unlockAudioOnGesture, { once: true });
    this.engine.runRenderLoop(this.renderFrame);
  }

  private unlockAudioOnGesture = (): void => {
    if (this.audioInitialized || this.disposed) return;
    this.audioInitialized = true;
    void this.oceanAudio.init().catch(() => {
      // AudioContext gesture policy or headless audio backend; explicit toggle can retry
    });
  };

  public setAudioEnabled(enabled: boolean): void {
    this.oceanAudio.setMuted(!enabled);
    if (enabled && !this.audioInitialized) {
      this.audioInitialized = true;
      void this.oceanAudio.init().catch(() => {});
    } else if (enabled) {
      this.oceanAudio.resumeOnGesture();
    }
  }

  public setQualityPreset(name: QualityPresetName): void {
    const next = resolveQualityPreset(name);
    if (next.name === this.qualityPreset.name) return;
    this.qualityPreset = next;

    // Rebuild cascaded shadow generator with new explicit cascade/map settings
    this.shadowGenerator.dispose();
    this.shadowGenerator = this.createShadowGenerator(next);
    if (this.terrainMesh) {
      this.terrainMesh.receiveShadows = true;
    }

    // Re-register active unit/boat/base shadow casters
    for (const vis of this.unitVisuals.values()) {
      for (const m of vis.root.getChildMeshes()) {
        if (m.getTotalVertices() > 0 && m !== vis.shieldDome) {
          this.shadowGenerator.addShadowCaster(m, false);
        }
      }
    }

    // Rebuild instanced scatter at new explicit density
    if (this.islandBuiltRadius > 0 && this.assetsReady) {
      this.rebuildInstancedScatter(this.islandBuiltRadius, this.islandBuiltTeams);
    }

    // Rebuild rain particle capacity for new preset
    if (this.rainParticles) {
      this.rainParticles.dispose();
      this.rainParticles = null;
    }
    this.setupRainSystem();
  }

  private createShadowGenerator(preset: QualityPreset): CascadedShadowGenerator {
    const csm = new CascadedShadowGenerator(preset.shadowMapSize, this.sunLight);
    csm.numCascades = preset.shadowCascades;
    csm.stabilizeCascades = true;
    csm.usePercentageCloserFiltering = true;
    csm.lambda = 0.72;
    csm.bias = 0.003;
    csm.cascadeBlendPercentage = 0.12;
    csm.shadowMaxZ = 180;
    return csm;
  }

  private createSoftParticleTexture(name: string, colorHex: string): DynamicTexture {
    const tex = new DynamicTexture(name, 64, this.scene, false);
    const ctx = tex.getContext();
    const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, colorHex);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    tex.update();
    tex.hasAlpha = true;
    return tex;
  }

  private setupRainSystem(): void {
    const ps = new ParticleSystem('weatherRain', this.qualityPreset.maxParticles, this.scene);
    ps.particleTexture = this.createSoftParticleTexture('rainDropTex', '#b8cdd9');
    ps.emitter = new Vector3(0, 22, 0);
    ps.minEmitBox = new Vector3(-36, 0, -36);
    ps.maxEmitBox = new Vector3(36, 4, 36);
    ps.color1 = new Color4(0.72, 0.80, 0.86, 0.45);
    ps.color2 = new Color4(0.60, 0.70, 0.78, 0.30);
    ps.colorDead = new Color4(0.55, 0.65, 0.72, 0.0);
    ps.minSize = 0.08;
    ps.maxSize = 0.18;
    ps.minScaleY = 5.5;
    ps.maxScaleY = 8.5;
    ps.minLifeTime = 0.9;
    ps.maxLifeTime = 1.4;
    ps.emitRate = 0;
    ps.direction1 = new Vector3(-2, -26, -1);
    ps.direction2 = new Vector3(-4, -30, 1);
    ps.gravity = new Vector3(0, -14, 0);
    ps.start();
    this.rainParticles = ps;
  }

  private spawnHitBurst(pos: Vector3, isKill: boolean): void {
    const burst = new ParticleSystem('hitBurst', isKill ? 42 : 20, this.scene);
    burst.particleTexture = this.hitSparkTex;
    burst.emitter = pos.add(new Vector3(0, 1.2, 0));
    burst.minEmitBox = new Vector3(-0.25, -0.25, -0.25);
    burst.maxEmitBox = new Vector3(0.25, 0.25, 0.25);
    burst.color1 = isKill ? new Color4(0.95, 0.45, 0.22, 1) : new Color4(0.95, 0.78, 0.42, 1);
    burst.color2 = new Color4(0.76, 0.32, 0.18, 0.9);
    burst.colorDead = new Color4(0.25, 0.15, 0.10, 0);
    burst.minSize = 0.18;
    burst.maxSize = isKill ? 0.55 : 0.36;
    burst.minLifeTime = 0.18;
    burst.maxLifeTime = 0.42;
    burst.manualEmitCount = isKill ? 36 : 18;
    burst.minEmitPower = 3.2;
    burst.maxEmitPower = 7.5;
    burst.direction1 = new Vector3(-1, 0.6, -1);
    burst.direction2 = new Vector3(1, 2.2, 1);
    burst.gravity = new Vector3(0, -9.8, 0);
    burst.disposeOnStop = true;
    burst.targetStopDuration = 0.45;
    burst.start();
  }

  private async loadManifestContainers(): Promise<void> {
    const entries: Array<[keyof AssetContainers, string]> = [
      ['character', 'character_rigged'],
      ['pine1', 'pine_tree_1'],
      ['pine2', 'pine_tree_2'],
      ['rock', 'rock_moss_1'],
      ['grass', 'grass_tuft'],
      ['boat', 'team_boat'],
      ['dock', 'marina_dock'],
      ['wallWood', 'base_wall_wood'],
      ['towerWood', 'base_tower_wood'],
      ['wallStone', 'stone_wall'],
      ['towerStone', 'base_tower_stone'],
      ['banner', 'team_banner'],
      ['crate', 'supply_crate'],
    ];

    await Promise.all(
      entries.map(async ([slot, manifestId]) => {
        const { rootUrl, filename } = splitAssetPath(getManifestPath(manifestId));
        const container = await SceneLoader.LoadAssetContainerAsync(
          rootUrl,
          filename,
          this.scene,
        );
        if (!this.disposed) {
          this.containers[slot] = container;
        }
      }),
    );

    if (this.disposed) return;
    this.assetsReady = true;

    // Refresh any already-created dynamic entities so they upgrade to full glTF visuals
    if (this.islandBuiltRadius > 0) {
      this.rebuildInstancedScatter(this.islandBuiltRadius, this.islandBuiltTeams);
      this.buildMarinaDockProps(this.islandBuiltTeams);
    }
    this.refreshExistingEntityMeshes();
  }

  private refreshExistingEntityMeshes(): void {
    // Rebuild bases, boats, crates, and units cleanly once glTF containers arrive
    for (const vis of this.baseVisuals.values()) vis.root.dispose();
    this.baseVisuals.clear();

    for (const vis of this.boatVisuals.values()) vis.root.dispose();
    this.boatVisuals.clear();

    for (const node of this.crateVisuals.values()) node.dispose();
    this.crateVisuals.clear();

    for (const vis of this.unitVisuals.values()) vis.root.dispose();
    this.unitVisuals.clear();
  }

  private initCrateTierMaterials(): void {
    const specs: Array<[number, Color3, Color3, number]> = [
      [1, new Color3(0.45, 0.34, 0.22), new Color3(0.03, 0.02, 0.01), 0.85],
      [2, new Color3(0.25, 0.44, 0.38), new Color3(0.03, 0.09, 0.07), 0.68],
      [3, new Color3(0.68, 0.54, 0.24), new Color3(0.14, 0.09, 0.02), 0.42],
    ];
    for (const [tier, albedo, emissive, roughness] of specs) {
      const mat = new PBRMaterial(`crateTierMat_${tier}`, this.scene);
      mat.albedoColor = albedo;
      mat.emissiveColor = emissive;
      mat.roughness = roughness;
      mat.metallic = tier === 3 ? 0.55 : 0.18;
      this.crateTierMaterials.set(tier, mat);
    }
  }

  private getTeamBannerMaterial(teamId: string): PBRMaterial {
    let mat = this.teamBannerMaterials.get(teamId);
    if (!mat) {
      mat = new PBRMaterial(`teamBannerMat_${teamId}`, this.scene);
      const c = teamHeraldryColor(teamId);
      mat.albedoColor = c;
      mat.emissiveColor = c.scale(0.10);
      mat.roughness = 0.84;
      mat.metallic = 0.06;
      this.teamBannerMaterials.set(teamId, mat);
    }
    return mat;
  }

  private instantiateContainer(
    container: AssetContainer,
    namePrefix: string,
    parent: TransformNode,
    scale: number,
    castShadows: boolean,
  ): TransformNode {
    const holder = new TransformNode(namePrefix, this.scene);
    holder.parent = parent;
    holder.scaling.setAll(scale);
    const inst = container.instantiateModelsToScene(
      (srcName) => `${namePrefix}_${srcName}`,
      false,
    );
    for (const node of inst.rootNodes) {
      node.parent = holder;
    }
    for (const m of holder.getChildMeshes()) {
      m.receiveShadows = true;
      if (castShadows && m.getTotalVertices() > 0) {
        this.shadowGenerator.addShadowCaster(m, false);
      }
    }
    return holder;
  }

  private buildIslandEnvironment(radius: number, centerRadius: number, teamCount: number): void {
    for (const node of this.islandNodes) {
      node.dispose();
    }
    this.islandNodes.length = 0;

    const root = new TransformNode('islandEnv', this.scene);
    this.islandNodes.push(root);

    // 1. Checked-in original heightmap terrain (200x200 matching radius 80 + shoreline slope)
    const terrainMat = new PBRMaterial('islandTerrainMat', this.scene);
    const forestTex = new Texture(getManifestPath('tex_forest_ground'), this.scene);
    forestTex.uScale = 16;
    forestTex.vScale = 16;
    terrainMat.albedoTexture = forestTex;
    terrainMat.albedoColor = new Color3(0.62, 0.66, 0.56);
    terrainMat.roughness = 0.94;
    terrainMat.metallic = 0.02;

    const terrain = CreateGroundFromHeightMap(
      'islandHeightmapTerrain',
      getManifestPath('island_heightmap'),
      {
        width: radius * 2.5,
        height: radius * 2.5,
        subdivisions: ENGINE.terrain.subdivisions,
        minHeight: ENGINE.terrain.minHeight,
        maxHeight: ENGINE.terrain.maxHeight,
      },
      this.scene,
    );
    terrain.material = terrainMat;
    terrain.receiveShadows = true;
    terrain.checkCollisions = true;
    terrain.parent = root;
    this.terrainMesh = terrain;

    // 2. Wet coastal sand shoreline collar around the island perimeter
    const sandMat = new PBRMaterial('wetSandMat', this.scene);
    const sandTex = new Texture(getManifestPath('tex_coast_sand'), this.scene);
    sandTex.uScale = 18;
    sandTex.vScale = 18;
    sandMat.albedoTexture = sandTex;
    sandMat.albedoColor = new Color3(0.68, 0.64, 0.54);
    sandMat.roughness = 0.78;
    sandMat.metallic = 0.04;

    const beachRing = CreateCylinder(
      'beachShoreline',
      { diameterTop: radius * 1.98, diameterBottom: radius * 2.18, height: 1.4, tessellation: 64 },
      this.scene,
    );
    beachRing.position.y = -0.78;
    beachRing.material = sandMat;
    beachRing.receiveShadows = true;
    beachRing.parent = root;

    // 3. Center rocky stronghold plateau
    const stronghold = CreateCylinder(
      'centerStronghold',
      { diameter: centerRadius * 2.0, height: 0.45, tessellation: 48 },
      this.scene,
    );
    stronghold.position.y = 0.04;
    stronghold.material = this.darkStoneMat;
    stronghold.receiveShadows = true;
    stronghold.parent = root;

    const strongholdRing = CreateTorus(
      'centerStrongholdRing',
      { diameter: centerRadius * 1.96, thickness: 0.55, tessellation: 48 },
      this.scene,
    );
    strongholdRing.position.y = 0.24;
    strongholdRing.material = this.weatheredWoodMat;
    strongholdRing.receiveShadows = true;
    strongholdRing.parent = root;

    // 4. Weathered stone-gravel lanes connecting radial bases to center
    for (let i = 0; i < teamCount; i++) {
      const angle = (2 * Math.PI * i) / teamCount;
      const laneLen = radius * 0.68;
      const lane = CreateBox(`lane_${i}`, { width: 4.2, height: 0.1, depth: laneLen }, this.scene);
      lane.position.set(
        Math.cos(angle) * (laneLen * 0.5),
        0.04,
        Math.sin(angle) * (laneLen * 0.5),
      );
      lane.rotation.y = Math.atan2(Math.cos(angle), Math.sin(angle));
      lane.material = this.darkStoneMat;
      lane.receiveShadows = true;
      lane.parent = root;
    }

    // 5. Animated coastal WaterMaterial ocean plane
    const waterGround = CreateGround(
      'oceanWater',
      { width: radius * 7.5, height: radius * 7.5, subdivisions: 48 },
      this.scene,
    );
    waterGround.position.y = ENGINE.water.baseY;
    const waterMat = new WaterMaterial('oceanWaterMat', this.scene, new Vector2(512, 512));
    waterMat.bumpTexture = new Texture(getManifestPath('tex_coast_sand'), this.scene);
    waterMat.windForce = ENGINE.water.windForce;
    waterMat.waveHeight = ENGINE.water.waveHeight;
    waterMat.bumpHeight = 0.16;
    waterMat.waveLength = ENGINE.water.waveLength;
    waterMat.colorBlendFactor = ENGINE.water.colorBlendFactor;
    waterMat.waterColor = new Color3(0.08, 0.20, 0.25);
    waterMat.windDirection = new Vector2(0.8, 0.55);
    if (this.skyboxMesh) waterMat.addToRenderList(this.skyboxMesh);
    waterMat.addToRenderList(terrain);
    waterMat.addToRenderList(beachRing);
    waterGround.material = waterMat;
    waterGround.parent = root;
    this.waterMaterial = waterMat;

    // 6. Shared coastal marina deck & pilings (Part C.1)
    const marinaDeck = CreateBox(
      'marinaDeck',
      {
        width: ENGINE.marina.halfWidth * 2,
        height: 0.6,
        depth: ENGINE.marina.halfDepth * 2,
      },
      this.scene,
    );
    marinaDeck.position.set(
      ENGINE.marina.centerX,
      ENGINE.marina.deckY - 0.3,
      ENGINE.marina.centerZ,
    );
    marinaDeck.material = this.weatheredWoodMat;
    marinaDeck.receiveShadows = true;
    marinaDeck.checkCollisions = true;
    marinaDeck.parent = root;

    // Support timber pilings under marina deck
    for (let px = -ENGINE.marina.halfWidth + 2; px <= ENGINE.marina.halfWidth - 2; px += 6) {
      for (const pz of [-ENGINE.marina.halfDepth + 1.2, ENGINE.marina.halfDepth - 1.2]) {
        const post = CreateCylinder(
          `marinaPost_${px}_${pz}`,
          { diameter: 0.55, height: 3.8, tessellation: 8 },
          this.scene,
        );
        post.position.set(
          ENGINE.marina.centerX + px,
          ENGINE.marina.deckY - 1.2,
          ENGINE.marina.centerZ + pz,
        );
        post.material = this.weatheredWoodMat;
        post.parent = root;
      }
    }

    // Slip finger piers for each team
    for (let i = 0; i < teamCount; i++) {
      const slip = getMarinaSlipPose(i, teamCount);
      const finger = CreateBox(
        `slipPier_${i}`,
        { width: 2.2, height: 0.45, depth: 7.5 },
        this.scene,
      );
      finger.position.set(slip.x - 2.6, ENGINE.marina.deckY - 0.22, slip.z - 2.4);
      finger.material = this.weatheredWoodMat;
      finger.receiveShadows = true;
      finger.parent = root;
    }

    this.islandBuiltRadius = radius;
    this.islandBuiltTeams = teamCount;

    if (this.assetsReady) {
      this.rebuildInstancedScatter(radius, teamCount);
      this.buildMarinaDockProps(teamCount);
    }
  }

  private buildMarinaDockProps(teamCount: number): void {
    const parent = this.islandNodes[0];
    if (!parent || !this.containers.dock) return;
    for (let i = 0; i < teamCount; i++) {
      const slip = getMarinaSlipPose(i, teamCount);
      const dockProp = this.instantiateContainer(
        this.containers.dock,
        `marinaDockProp_${i}`,
        parent,
        1.1,
        true,
      );
      dockProp.position.set(slip.x, ENGINE.marina.deckY - 0.5, ENGINE.marina.centerZ + 4.5);
    }
  }

  private rebuildInstancedScatter(radius: number, teamCount: number): void {
    for (const s of this.scatterRoots) {
      s.dispose();
    }
    this.scatterRoots.length = 0;

    const scatterParent = new TransformNode('instancedScatter', this.scene);
    this.scatterRoots.push(scatterParent);

    const density = this.qualityPreset.scatterDensity;
    const isClearZone = (x: number, z: number): boolean => {
      const r = Math.hypot(x, z);
      if (r < 20 || r > radius * 0.90) return true;
      // Keep radial base clearings and center lanes clear
      for (let i = 0; i < teamCount; i++) {
        const ang = (2 * Math.PI * i) / teamCount;
        const bx = Math.cos(ang) * (radius * 0.70);
        const bz = Math.sin(ang) * (radius * 0.70);
        if (Math.hypot(x - bx, z - bz) < 16) return true;
        // Lane corridor
        const ux = Math.cos(ang);
        const uz = Math.sin(ang);
        const proj = x * ux + z * uz;
        if (proj > 0 && proj < radius * 0.75) {
          const perp = Math.abs(x * -uz + z * ux);
          if (perp < 5.5) return true;
        }
      }
      return false;
    };

    const scatterContainer = (
      container: AssetContainer | null,
      tag: string,
      baseCount: number,
      seedOffset: number,
      scaleRange: [number, number],
      cullDist: number,
      castShadows: boolean,
    ) => {
      if (!container) return;
      const targetCount = Math.max(4, Math.round(baseCount * density));
      const matrices: Matrix[] = [];
      let attempts = 0;
      while (matrices.length < targetCount && attempts < targetCount * 6) {
        attempts += 1;
        const s = seedOffset + attempts * 17.3;
        const angle = deterministicHash(s) * Math.PI * 2;
        const dist = 22 + Math.sqrt(deterministicHash(s + 1.7)) * (radius * 0.66);
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        if (isClearZone(x, z)) continue;

        const scale =
          scaleRange[0] + deterministicHash(s + 3.1) * (scaleRange[1] - scaleRange[0]);
        const rotY = deterministicHash(s + 5.9) * Math.PI * 2;
        const m = Matrix.Compose(
          new Vector3(scale, scale, scale),
          Quaternion.FromEulerAngles(0, rotY, 0),
          new Vector3(x, 0, z),
        );
        matrices.push(m);
      }

      if (matrices.length === 0) return;

      const inst = container.instantiateModelsToScene((n) => `${tag}_${n}`, false);
      const holder = new TransformNode(`${tag}_holder`, this.scene);
      holder.parent = scatterParent;
      for (const rn of inst.rootNodes) rn.parent = holder;

      const buffer = new Float32Array(matrices.length * 16);
      for (let i = 0; i < matrices.length; i++) {
        matrices[i].copyToArray(buffer, i * 16);
      }

      for (const child of holder.getChildMeshes()) {
        if (child instanceof Mesh && child.getTotalVertices() > 0) {
          child.thinInstanceSetBuffer('matrix', buffer, 16, true);
          child.thinInstanceRefreshBoundingInfo(true);
          child.addLODLevel(cullDist, null);
          child.receiveShadows = true;
          if (castShadows) {
            this.shadowGenerator.addShadowCaster(child, false);
          }
        }
      }
    };

    scatterContainer(
      this.containers.pine1,
      'pineA',
      42,
      101,
      [1.35, 2.05],
      ENGINE.scatterLod.pineFarDistance,
      true,
    );
    scatterContainer(
      this.containers.pine2,
      'pineB',
      38,
      409,
      [1.25, 1.95],
      ENGINE.scatterLod.pineFarDistance,
      true,
    );
    scatterContainer(
      this.containers.rock,
      'mossRock',
      28,
      719,
      [0.85, 1.65],
      ENGINE.scatterLod.rockFarDistance,
      true,
    );
    scatterContainer(
      this.containers.grass,
      'meadowGrass',
      55,
      997,
      [0.9, 1.5],
      ENGINE.scatterLod.grassFarDistance,
      false,
    );
  }

  private syncWeather(nowSec: number): void {
    const w = this.connection.room.state.weather;
    if (!w) return;

    this.scene.fogDensity = w.fogDensity;

    const kind = (w.kind || ENGINE.defaultWeatherKind) as WeatherKind;
    if (kind !== this.activeWeatherKind) {
      this.activeWeatherKind = kind;
      const env = kind === 'clear' ? this.skyClearEnv : this.skyOvercastEnv;
      this.scene.environmentTexture = env;
      if (this.skyboxMesh) {
        this.skyboxMesh.dispose();
      }
      this.skyboxMesh = this.scene.createDefaultSkybox(env, true, 650, 0.25, false);
      if (this.waterMaterial && this.skyboxMesh) {
        this.waterMaterial.addToRenderList(this.skyboxMesh);
      }
    }

    if (kind === 'clear') {
      this.scene.fogColor.set(0.56, 0.64, 0.69);
      this.sunLight.intensity = 1.95;
      this.hemiLight.intensity = 0.68;
      this.scene.environmentIntensity = 0.88;
    } else if (kind === 'overcast') {
      this.scene.fogColor.set(0.41, 0.47, 0.50);
      this.sunLight.intensity = 1.45;
      this.hemiLight.intensity = 0.56;
      this.scene.environmentIntensity = 0.70;
    } else if (kind === 'rain') {
      this.scene.fogColor.set(0.32, 0.37, 0.41);
      this.sunLight.intensity = 0.95;
      this.hemiLight.intensity = 0.48;
      this.scene.environmentIntensity = 0.52;
    } else {
      // Storm
      this.scene.fogColor.set(0.22, 0.26, 0.30);
      this.sunLight.intensity = 0.72;
      this.hemiLight.intensity = 0.40;
      this.scene.environmentIntensity = 0.40;
    }

    if (this.waterMaterial) {
      this.waterMaterial.waveHeight = ENGINE.water.waveHeight * (0.8 + w.wind * 0.9);
      this.waterMaterial.windForce = ENGINE.water.windForce * (0.75 + w.wind * 1.1);
    }

    if (this.rainParticles) {
      const pose = this.connection.getLocalPose();
      if (pose) {
        this.rainParticles.emitter = new Vector3(pose.x, pose.y + 20, pose.z);
      }
      this.rainParticles.emitRate = Math.round(w.rainIntensity * this.qualityPreset.maxParticles);
      const sway = -2.0 - w.wind * 7.5 + Math.sin(nowSec * 1.3) * 0.8;
      this.rainParticles.direction1 = new Vector3(sway, -26, -1);
      this.rainParticles.direction2 = new Vector3(sway - 2, -30, 1);
    }
  }

  private syncBoats(nowSec: number): void {
    const boats = this.connection.room.state.boats;
    if (!boats) return;

    const wind = this.connection.room.state.weather?.wind ?? 0.35;
    const activeIds = new Set<string>();

    for (const [boatId, boat] of boats.entries()) {
      activeIds.add(boatId);
      let vis = this.boatVisuals.get(boatId);
      if (!vis) {
        vis = this.createBoatVisual(boat);
        this.boatVisuals.set(boatId, vis);
      }

      const bob = Math.sin(nowSec * (2.1 + wind * 1.4) + boat.x * 0.25) * (0.09 + wind * 0.08);
      const roll = Math.cos(nowSec * 1.7 + boat.z * 0.2) * (0.04 + wind * 0.04);
      vis.root.position.set(boat.x, ENGINE.water.baseY + 0.35 + bob, boat.z);
      vis.root.rotation.y = boat.rotY;
      vis.hullRoot.rotation.z = roll;
    }

    for (const [id, vis] of this.boatVisuals.entries()) {
      if (!activeIds.has(id)) {
        vis.root.dispose();
        this.boatVisuals.delete(id);
      }
    }
  }

  private createBoatVisual(boat: BoatState): BoatVisual {
    const root = new TransformNode(`boat_${boat.id}`, this.scene);
    const hullRoot = new TransformNode(`boatHull_${boat.id}`, this.scene);
    hullRoot.parent = root;

    if (this.containers.boat) {
      const model = this.instantiateContainer(
        this.containers.boat,
        `boatModel_${boat.id}`,
        hullRoot,
        1.15,
        true,
      );
      model.position.y = 0.2;
    } else {
      const hull = CreateBox(`boatFallback_${boat.id}`, { width: 2.2, height: 0.9, depth: 5.0 }, this.scene);
      hull.material = this.weatheredWoodMat;
      hull.parent = hullRoot;
    }

    // Heraldic team banner mounted on the stern so players identify their squad's boat at a glance
    const bannerMat = this.getTeamBannerMaterial(boat.teamId);
    if (this.containers.banner) {
      const b = this.instantiateContainer(
        this.containers.banner,
        `boatBanner_${boat.id}`,
        hullRoot,
        1.25,
        true,
      );
      b.position.set(0, 1.35, -1.6);
      for (const m of b.getChildMeshes()) {
        m.material = bannerMat;
      }
    } else {
      const flag = CreateBox(`boatFlag_${boat.id}`, { width: 0.14, height: 1.4, depth: 0.9 }, this.scene);
      flag.position.set(0, 1.8, -1.5);
      flag.material = bannerMat;
      flag.parent = hullRoot;
    }

    return { root, hullRoot, teamId: boat.teamId };
  }

  private syncBases(): void {
    const bases = this.connection.room.state.bases;
    if (!bases) return;

    for (const [teamId, base] of bases.entries()) {
      let vis = this.baseVisuals.get(teamId);
      if (!vis) {
        vis = this.createBaseVisual(base);
        this.baseVisuals.set(teamId, vis);
      }

      const hpRatio = Math.max(0.2, base.coreHp / ENGINE.baseCoreMaxHp);
      vis.coreRoot.scaling.y = hpRatio * (1 + (base.tier - 1) * 0.18);

      for (const [sockId, sock] of base.sockets.entries()) {
        const entry = vis.sockets.get(sockId);
        if (!entry) continue;
        if (sock.tier !== entry.lastTier) {
          entry.lastTier = sock.tier;
          if (entry.builtRoot) {
            entry.builtRoot.dispose();
            entry.builtRoot = null;
          }
          if (sock.occupied && sock.tier > 0) {
            entry.builtRoot = this.createBuiltStructure(teamId, sock, vis.root);
          }
        }
      }
    }
  }

  private createBaseVisual(base: BaseState): BaseVisual {
    const root = new TransformNode(`base_${base.teamId}`, this.scene);
    const bannerMat = this.getTeamBannerMaterial(base.teamId);

    // Stone foundation courtyard (muted stone, NOT neon team color)
    const pad = CreateCylinder(
      `basePad_${base.teamId}`,
      { diameter: 14.5, height: 0.35, tessellation: 24 },
      this.scene,
    );
    pad.position.set(base.x, 0.15, base.z);
    pad.material = this.darkStoneMat;
    pad.receiveShadows = true;
    pad.parent = root;

    // Central keep/core tower (Kenney Castle stone tower or weathered timber)
    const coreRoot = new TransformNode(`baseCore_${base.teamId}`, this.scene);
    coreRoot.position.set(base.x, 0.3, base.z);
    coreRoot.parent = root;

    if (this.containers.towerStone) {
      this.instantiateContainer(
        this.containers.towerStone,
        `coreStone_${base.teamId}`,
        coreRoot,
        2.6,
        true,
      );
    } else {
      const pillar = CreateCylinder(
        `corePillar_${base.teamId}`,
        { diameterTop: 2.2, diameterBottom: 3.2, height: 5.0, tessellation: 8 },
        this.scene,
      );
      pillar.position.y = 2.5;
      pillar.material = this.darkStoneMat;
      pillar.parent = coreRoot;
    }

    // Two heraldic team banners flanking the core (team color accent only)
    for (const side of [-2.4, 2.4]) {
      if (this.containers.banner) {
        const banner = this.instantiateContainer(
          this.containers.banner,
          `baseBanner_${base.teamId}_${side}`,
          root,
          1.6,
          true,
        );
        banner.position.set(base.x + side, 0.35, base.z);
        for (const m of banner.getChildMeshes()) {
          m.material = bannerMat;
        }
      } else {
        const flag = CreateBox(`baseFlag_${base.teamId}_${side}`, { width: 0.25, height: 2.4, depth: 1.1 }, this.scene);
        flag.position.set(base.x + side, 2.2, base.z);
        flag.material = bannerMat;
        flag.parent = root;
      }
    }

    const sockets = new Map<string, { pad: Mesh; builtRoot: TransformNode | null; lastTier: number }>();
    for (const [sockId, sock] of base.sockets.entries()) {
      const sockPad = CreateCylinder(
        `sockPad_${sockId}`,
        { diameter: 2.8, height: 0.16, tessellation: 12 },
        this.scene,
      );
      sockPad.position.set(sock.x, 0.08, sock.z);
      sockPad.material = this.socketPadMat;
      sockPad.receiveShadows = true;
      sockPad.parent = root;
      sockets.set(sockId, { pad: sockPad, builtRoot: null, lastTier: 0 });
    }

    return { root, coreRoot, bannerMat, sockets };
  }

  private createBuiltStructure(
    teamId: string,
    sock: SocketState,
    parent: TransformNode,
  ): TransformNode {
    const holder = new TransformNode(`built_${sock.id}`, this.scene);
    holder.position.set(sock.x, 0.1, sock.z);
    holder.rotation.y = Math.atan2(-sock.x, -sock.z);
    holder.parent = parent;

    const bannerMat = this.getTeamBannerMaterial(teamId);
    const tierScale = 1 + (sock.tier - 1) * 0.22;

    // Tier 1 = wooden timber walls/towers; Tier 2-3 = reinforced stone masonry!
    if (sock.type === 'wall') {
      const container = sock.tier >= 2 ? this.containers.wallStone : this.containers.wallWood;
      if (container) {
        this.instantiateContainer(container, `wall_${sock.id}`, holder, 1.35 * tierScale, true);
      } else {
        const w = CreateBox(`wallBox_${sock.id}`, { width: 3.8, height: 2.3 * tierScale, depth: 0.9 }, this.scene);
        w.position.y = 1.15 * tierScale;
        w.material = sock.tier >= 2 ? this.darkStoneMat : this.weatheredWoodMat;
        w.checkCollisions = true;
        w.parent = holder;
      }
    } else if (sock.type === 'tower') {
      const container = sock.tier >= 2 ? this.containers.towerStone : this.containers.towerWood;
      if (container) {
        this.instantiateContainer(container, `tower_${sock.id}`, holder, 1.55 * tierScale, true);
      } else {
        const t = CreateCylinder(
          `towerCyl_${sock.id}`,
          { diameterTop: 1.5, diameterBottom: 2.2, height: 4.0 * tierScale, tessellation: 8 },
          this.scene,
        );
        t.position.y = 2.0 * tierScale;
        t.material = sock.tier >= 2 ? this.darkStoneMat : this.weatheredWoodMat;
        t.parent = holder;
      }
    } else if (sock.type === 'trap_pad') {
      const pad = CreateCylinder(
        `trapPad_${sock.id}`,
        { diameter: 2.9, height: 0.35 * tierScale, tessellation: 16 },
        this.scene,
      );
      pad.position.y = 0.2;
      pad.material = this.trapMat;
      pad.parent = holder;
    } else {
      const ring = CreateTorus(
        `coreUpgrade_${sock.id}`,
        { diameter: 4.2 + sock.tier * 0.55, thickness: 0.42, tessellation: 24 },
        this.scene,
      );
      ring.position.y = 2.8 + sock.tier * 0.45;
      ring.material = bannerMat;
      ring.parent = holder;
    }

    // Small team pennant trim on upgraded structures
    if (this.containers.banner && sock.type !== 'core_upgrade') {
      const pen = this.instantiateContainer(
        this.containers.banner,
        `sockBanner_${sock.id}`,
        holder,
        0.75,
        false,
      );
      pen.position.set(1.2, 0.2, 0);
      for (const m of pen.getChildMeshes()) m.material = bannerMat;
    }

    return holder;
  }

  private syncCrates(nowSec: number): void {
    const crates = this.connection.room.state.crates;
    if (!crates) return;

    const activeIds = new Set<string>();
    for (const [id, crate] of crates.entries()) {
      activeIds.add(id);
      let node = this.crateVisuals.get(id);
      if (!node) {
        node = this.createCrateVisual(crate);
        this.crateVisuals.set(id, node);
      }

      if (crate.opened) {
        node.setEnabled(false);
      } else {
        node.setEnabled(true);
        node.position.set(
          crate.x,
          0.18 + Math.sin(nowSec * 2.0 + crate.x) * 0.08,
          crate.z,
        );
        node.rotation.y = nowSec * 0.55 + crate.z * 0.1;
      }
    }

    for (const [id, node] of this.crateVisuals.entries()) {
      if (!activeIds.has(id)) {
        node.dispose();
        this.crateVisuals.delete(id);
      }
    }
  }

  private createCrateVisual(crate: CrateState): TransformNode {
    const root = new TransformNode(`crate_${crate.id}`, this.scene);
    const scale = crate.tier === 3 ? 1.35 : crate.tier === 2 ? 1.15 : 0.95;

    if (this.containers.crate) {
      this.instantiateContainer(this.containers.crate, `crateModel_${crate.id}`, root, scale, true);
    } else {
      const box = CreateBox(`crateBox_${crate.id}`, { size: scale }, this.scene);
      box.position.y = scale * 0.5;
      box.material = this.weatheredWoodMat;
      box.parent = root;
    }

    // Subtle tier rim marker so players can distinguish outer vs mid vs center crates
    const rim = CreateTorus(
      `crateRim_${crate.id}`,
      { diameter: 1.45 * scale, thickness: 0.10, tessellation: 18 },
      this.scene,
    );
    rim.position.y = 0.08;
    rim.material = this.crateTierMaterials.get(crate.tier) ?? this.crateTierMaterials.get(1)!;
    rim.parent = root;

    return root;
  }

  private syncTraps(): void {
    const traps = this.connection.room.state.traps;
    if (!traps) return;

    const activeIds = new Set<string>();
    for (const [id, trap] of traps.entries()) {
      if (trap.triggered) continue;
      activeIds.add(id);
      let mesh = this.trapVisuals.get(id);
      if (!mesh) {
        mesh = CreateCylinder(
          `trap_${id}`,
          { diameter: 1.5, height: 0.18, tessellation: 16 },
          this.scene,
        );
        mesh.material = this.trapMat;
        this.trapVisuals.set(id, mesh);
      }
      mesh.position.set(trap.x, 0.1, trap.z);
    }

    for (const [id, mesh] of this.trapVisuals.entries()) {
      if (!activeIds.has(id)) {
        mesh.dispose();
        this.trapVisuals.delete(id);
      }
    }
  }

  private setUnitAnimation(vis: UnitVisual, next: AnimState): void {
    if (!vis.clips || vis.activeAnim === next) return;
    vis.clips.idle.stop();
    vis.clips.run.stop();
    vis.clips.jump.stop();
    vis.clips.attack.stop();
    vis.sitClip?.stop();

    vis.activeAnim = next;
    if (next === 'sit' && vis.sitClip) {
      vis.sitClip.start(true);
    } else if (next === 'attack') {
      vis.clips.attack.start(false);
    } else if (next === 'jump') {
      vis.clips.jump.start(true);
    } else if (next === 'run') {
      vis.clips.run.start(true);
    } else {
      vis.clips.idle.start(true);
    }
  }

  private syncPlayers(dtSec: number): void {
    const players = this.connection.room.state.players;
    if (!players) return;

    const mySessionId = this.connection.room.sessionId;
    const activeIds = new Set<string>();

    for (const [id, entity] of players.entries()) {
      activeIds.add(id);
      let vis = this.unitVisuals.get(id);
      if (!vis) {
        vis = this.createUnitVisual(entity);
        this.unitVisuals.set(id, vis);
      } else if (vis.teamId !== entity.teamId) {
        vis.teamCrest.material = this.getTeamBannerMaterial(entity.teamId);
        vis.teamId = entity.teamId;
      }

      // Hit / kill spark VFX on HP drop
      if (entity.hp < vis.lastHp) {
        this.spawnHitBurst(new Vector3(entity.x, entity.y, entity.z), entity.hp <= 0);
      }
      vis.lastHp = entity.hp;

      const isSelf = id === mySessionId;
      const pose = isSelf
        ? this.connection.getLocalPose() ?? { x: entity.x, y: entity.y, z: entity.z, rotY: entity.rotY }
        : this.connection.getRemotePose(entity);

      const moveDist = Math.hypot(pose.x - vis.lastX, pose.z - vis.lastZ);
      const speed = moveDist / Math.max(0.001, dtSec);
      vis.lastX = pose.x;
      vis.lastZ = pose.z;

      const phase = this.connection.room.state.phase;
      let groundY = pose.y;
      if (entity.boatId) {
        groundY = ENGINE.water.baseY + 0.72;
      } else if (phase === 'dock' || phase === 'boarding') {
        groundY = ENGINE.marina.deckY;
      }

      vis.root.setEnabled(entity.alive);
      vis.root.position.set(pose.x, groundY, pose.z);
      vis.root.rotation.y = pose.rotY;
      vis.shieldDome.isVisible = entity.alive && entity.shieldHp > 0;

      if (isSelf && (this.connection.input.data as { attack?: boolean }).attack) {
        vis.attackTimerSec = 0.35;
      }
      if (vis.attackTimerSec > 0) {
        vis.attackTimerSec = Math.max(0, vis.attackTimerSec - dtSec);
      }

      const desiredAnim: AnimState = entity.boatId
        ? 'sit'
        : vis.attackTimerSec > 0
          ? 'attack'
          : speed > 0.75
            ? 'run'
            : 'idle';
      this.setUnitAnimation(vis, desiredAnim);
    }

    for (const [id, vis] of this.unitVisuals.entries()) {
      if (!activeIds.has(id)) {
        vis.root.dispose();
        this.unitVisuals.delete(id);
      }
    }
  }

  private createUnitVisual(entity: PlayerState): UnitVisual {
    const root = new TransformNode(`unit_${entity.id}`, this.scene);
    const modelRoot = new TransformNode(`unitModel_${entity.id}`, this.scene);
    modelRoot.parent = root;

    let clips: CharacterClipMap | null = null;
    let sitClip: { start: (loop?: boolean) => void; stop: () => void } | null = null;

    if (this.containers.character) {
      const inst = this.containers.character.instantiateModelsToScene(
        (n) => `char_${entity.id}_${n}`,
        false,
      );
      for (const rn of inst.rootNodes) {
        rn.parent = modelRoot;
      }
      for (const m of modelRoot.getChildMeshes()) {
        m.receiveShadows = true;
        if (m.getTotalVertices() > 0) {
          this.shadowGenerator.addShadowCaster(m, false);
        }
      }
      try {
        clips = resolveCharacterAnimationClips(inst.animationGroups);
        for (const ag of inst.animationGroups) ag.stop();
        clips.idle.start(true);
        const sitting = inst.animationGroups.find((g) => /sitting_idle/i.test(g.name));
        if (sitting) sitClip = sitting;
      } catch {
        clips = null;
      }
    } else {
      // Brief load-in silhouette while GLB container finishes fetching
      const placeholder = CreateCylinder(
        `unitLoad_${entity.id}`,
        { diameter: 0.75, height: 1.75, tessellation: 10 },
        this.scene,
      );
      placeholder.position.y = 0.88;
      placeholder.material = this.weatheredWoodMat;
      placeholder.parent = modelRoot;
    }

    // Muted team-colored shoulder cloak / crest accent (no neon body suit)
    const teamCrest = CreateBox(
      `unitCrest_${entity.id}`,
      { width: 0.56, height: 0.16, depth: 0.34 },
      this.scene,
    );
    teamCrest.position.set(0, 1.44, -0.06);
    teamCrest.material = this.getTeamBannerMaterial(entity.teamId);
    teamCrest.parent = root;

    const shieldDome = CreateSphere(`unitShield_${entity.id}`, { diameter: 2.35 }, this.scene);
    shieldDome.position.y = 1.05;
    shieldDome.material = this.shieldMat;
    shieldDome.isVisible = false;
    shieldDome.parent = root;

    let helperRing: Mesh | undefined;
    if (entity.id.startsWith('helper_')) {
      helperRing = CreateTorus(
        `helperRing_${entity.id}`,
        { diameter: 0.9, thickness: 0.10, tessellation: 16 },
        this.scene,
      );
      helperRing.position.y = 2.15;
      helperRing.material = this.crateTierMaterials.get(3)!;
      helperRing.parent = root;
    }

    return {
      root,
      modelRoot,
      clips,
      sitClip,
      activeAnim: 'idle',
      shieldDome,
      teamCrest,
      helperRing,
      teamId: entity.teamId,
      lastX: entity.x,
      lastZ: entity.z,
      lastHp: entity.hp,
      attackTimerSec: 0,
    };
  }

  private updateOverTheShoulderCamera(): void {
    const pose = this.connection.getLocalPose();
    if (!pose) return;

    const phase = this.connection.room.state.phase;
    const self = this.connection.room.state.players?.get(this.connection.room.sessionId);
    let baseY = pose.y;
    if (self?.boatId) {
      baseY = ENGINE.water.baseY + 0.72;
    } else if (phase === 'dock' || phase === 'boarding') {
      baseY = ENGINE.marina.deckY;
    }

    const yaw = this.controller.cameraYaw;
    const pitch = this.controller.cameraPitch;

    const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));

    // Shoulder anchor above and slightly right of the player
    const pivot = new Vector3(pose.x, baseY + ENGINE.cameraOffset.height, pose.z).add(
      right.scale(ENGINE.cameraOffset.right),
    );

    const desiredOffset = forward
      .scale(-Math.cos(pitch) * ENGINE.cameraOffset.distance)
      .add(new Vector3(0, Math.sin(pitch) * ENGINE.cameraOffset.distance * 0.65, 0));

    let camDist = desiredOffset.length();
    const rayDir = desiredOffset.normalize();

    // Collision pull-in so the over-the-shoulder camera never clips inside terrain or walls
    const pick = this.scene.pickWithRay(
      new Ray(pivot, rayDir, camDist),
      (mesh) => mesh.checkCollisions && mesh.isVisible,
    );
    if (pick?.hit && pick.distance > 0) {
      camDist = Math.max(
        ENGINE.cameraOffset.minCollisionDistance,
        pick.distance - ENGINE.cameraOffset.collisionMargin,
      );
    }

    const camPos = pivot.add(rayDir.scale(camDist));
    this.camera.position.copyFrom(camPos);
    const lookTarget = new Vector3(pose.x, baseY + 1.55, pose.z)
      .add(right.scale(ENGINE.cameraOffset.right * 0.42))
      .add(forward.scale(4.5));
    this.camera.setTarget(lookTarget);
  }

  private renderFrame = (): void => {
    if (this.disposed) return;

    const nowMs = performance.now();
    const dtSec = Math.min(0.05, Math.max(0.001, (nowMs - this.lastFrameMs) / 1000));
    this.lastFrameMs = nowMs;
    const nowSec = nowMs / 1000;

    // 1. Poll local input device -> room.input
    this.controller.update(nowMs, dtSec);

    // 2. Step Colyseus Predict interpolation & local reconciliation
    this.connection.predict.tick(nowMs);

    // 3. Build island environment & marina once IslandConfig is hydrated
    const cfg = this.connection.room.state.islandConfig;
    if (
      cfg &&
      cfg.radius > 0 &&
      (cfg.radius !== this.islandBuiltRadius || cfg.teamCount !== this.islandBuiltTeams)
    ) {
      this.buildIslandEnvironment(cfg.radius, cfg.centerRadius, cfg.teamCount);
    }

    // 4. Sync visuals from authoritative state
    this.syncWeather(nowSec);
    this.syncBoats(nowSec);
    this.syncBases();
    this.syncCrates(nowSec);
    this.syncTraps();
    this.syncPlayers(dtSec);
    this.updateOverTheShoulderCamera();

    // 5. Update positional Web Audio ocean surf from local distance to shoreline
    const pose = this.connection.getLocalPose();
    if (pose && cfg && cfg.radius > 0) {
      const w = this.connection.room.state.weather;
      this.oceanAudio.updateListener(pose.x, pose.z, cfg.radius, w?.wind ?? 0.35);
    }

    this.scene.render();
  };

  private onResize = (): void => {
    this.engine.resize();
  };

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.unlockAudioOnGesture);
    this.oceanAudio.dispose();
    this.engine.stopRenderLoop(this.renderFrame);
    this.rainParticles?.dispose();
    this.shadowGenerator.dispose();
    this.scene.dispose();
    this.engine.dispose();
  }
}
