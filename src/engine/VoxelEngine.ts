import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import {
  AvatarConfig,
  BlockId,
  BrushSize,
  CameraViewMode,
  CHUNK_SIZE,
  CreatureHudTarget,
  CreatureSpecies,
  DroppedGrave,
  DungeonId,
  DungeonRoomMeta,
  EditorTool,
  InspectResult,
  LootChestPoint,
  MinimapSnapshot,
  NpcDefinition,
  PlaceableBlockId,
  RealmId,
  TamedPet,
  TimeOfDayState,
  Vec3,
  VOXEL_SIZE,
  VoxelChange,
  WORLD_SIZE_X,
  WORLD_SIZE_Y,
  WORLD_SIZE_Z,
  WorldMode,
  WorldPortalPoint,
} from '../types/blockhaven';
import {
  BLOCK_BY_ID,
  BLOCK_BY_KEYCODE,
  createVoxelAtlasTexture,
  createVoxelBumpTexture,
  createVoxelRoughnessTexture,
  getBlockHardness,
  isBlockSolid,
} from './blocks';
import { DUNGEON_BY_ID, REALM_BY_ID, SKILL_CATALOG } from '../rpg/rpgData';
import { animateCharacterRig, buildCharacterRig, CharacterRig } from './avatarBuilder';
import { buildChunkGeometry, ChunkLightSource } from './voxelMesher';
import {
  CreatureSpawnSpec,
  GeneratedWorld,
  getBlock,
  getSurfaceHeightMeters,
  inBounds,
  voxelIndex,
} from './worldGen';
import {
  buildCreatureRig,
  buildLootChestProp,
  buildPortalProp,
  CreatureRig,
  PropRig,
} from './creatureBuilder';
import { buildNordicFoliageAndProps, FoliageCollection } from './treeBuilder';
import { SkyBias, SkySystem } from './skySystem';
import { sfx } from './audio';

export interface CreatureKilledPayload {
  id: string;
  species: CreatureSpecies;
  name: string;
  level: number;
  hostile: boolean;
  isBoss: boolean;
  attackKind: 'melee' | 'bow' | 'magic';
  hadStolenGraveId?: string;
}

export interface EngineCallbacks {
  onUndoRedoChange: (undoCount: number, redoCount: number) => void;
  onPointerLockChange: (locked: boolean) => void;
  onNpcClick: (npc: NpcDefinition) => void;
  onPortalInteract: (portal: WorldPortalPoint) => void;
  onChestOpen: (chest: LootChestPoint) => void;
  onGraveRecover: (grave: DroppedGrave) => void;
  onSelectedBlockChange: (blockId: PlaceableBlockId) => void;
  onCameraViewChange: (view: CameraViewMode) => void;
  onWorldModified: () => void;
  onWebglContextLost: (lost: boolean) => void;
  onTimeOfDayChange: (state: TimeOfDayState) => void;
  onPlayerDamage: (amount: number, source: string, position: Vec3) => void;
  onSurvivalTick: (dt: number, isSprinting: boolean, isMoving: boolean) => void;
  onResourceGathered: (resource: 'wood' | 'stone' | 'ore', blockId: BlockId) => void;
  onBlockPlacedInPlay: () => void;
  onCreatureTargetChange: (target: CreatureHudTarget | null) => void;
  onCreatureHit: (attackKind: 'melee' | 'bow' | 'magic', damage: number, isCrit: boolean) => void;
  onCreatureKilled: (payload: CreatureKilledPayload) => void;
  onSkillHotkey: (skill: 'bow' | 'firebolt' | 'mend' | 'tame' | 'inspect') => void;
  onTameResult: (species: 'deer' | 'rabbit' | 'wolf' | 'boar', name: string, level: number) => void;
  onInteractPromptChange: (prompt: string | null) => void;
  onStatusHint: (message: string) => void;
  onToggleMap: () => void;
}

interface ChunkEntry {
  cx: number;
  cz: number;
  opaqueMesh: THREE.Mesh;
  transparentMesh: THREE.Mesh;
  emissiveMesh: THREE.Mesh;
  lightSources: ChunkLightSource[];
}

interface NpcRuntime {
  def: NpcDefinition;
  rig: CharacterRig;
  pos: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  pauseTimer: number;
  facingPlayerTimer: number;
  hitbox: THREE.Mesh;
}

interface PortalRuntime {
  def: WorldPortalPoint;
  prop: PropRig;
  hitbox: THREE.Mesh;
}

interface ChestRuntime {
  def: LootChestPoint;
  prop: PropRig;
  hitbox: THREE.Mesh;
}

interface GraveRuntime {
  def: DroppedGrave;
  prop: PropRig;
  hitbox: THREE.Mesh;
}

interface CreatureRuntime {
  id: string;
  species: CreatureSpecies;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  hostile: boolean;
  tameable: boolean;
  isBoss: boolean;
  nightSpawn: boolean;
  rig: CreatureRig;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  target: THREE.Vector3;
  yaw: number;
  pauseTimer: number;
  attackCooldown: number;
  hitFlashTimer: number;
  fleeTimer: number;
  hitbox: THREE.Mesh;
  stolenGraveId?: string;
}

interface ProjectileRuntime {
  kind: 'bow' | 'magic';
  mesh: THREE.Mesh;
  light?: THREE.PointLight;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  damage: number;
  life: number;
}

interface VoxelHit {
  bx: number;
  by: number;
  bz: number;
  nx: number;
  ny: number;
  nz: number;
  distance: number;
}

const MAX_UNDO_STEPS = 50;
const MAX_DYNAMIC_LIGHTS = 6;
const CHUNKS_X = Math.ceil(WORLD_SIZE_X / CHUNK_SIZE);
const CHUNKS_Z = Math.ceil(WORLD_SIZE_Z / CHUNK_SIZE);
const WORLD_METERS_X = WORLD_SIZE_X * VOXEL_SIZE;
const WORLD_METERS_Z = WORLD_SIZE_Z * VOXEL_SIZE;

// Pre-allocated scratch vectors for zero GC in render loop
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _move = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _rayDir = new THREE.Vector3();
const _camGoal = new THREE.Vector3();
const _camLook = new THREE.Vector3();
const _pointerNdc = new THREE.Vector2();
const _tmpVec = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) ?? '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class VoxelEngine {
  private container: HTMLElement;
  private callbacks: EngineCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private composer: EffectComposer | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private timer = new THREE.Timer();

  private atlasTexture: THREE.CanvasTexture;
  private bumpTexture: THREE.CanvasTexture;
  private roughnessTexture: THREE.CanvasTexture;
  private opaqueMaterial: THREE.MeshStandardMaterial;
  private transparentMaterial: THREE.MeshStandardMaterial;
  private emissiveMaterial: THREE.MeshBasicMaterial;
  private envTexture: THREE.Texture;
  private showOverheadLabels = true;

  private keyLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skySystem: SkySystem;
  private cloudMat: THREE.MeshStandardMaterial;
  private oceanMat: THREE.MeshStandardMaterial;
  private oceanMesh: THREE.Mesh;
  private cloudsGroup: THREE.Group;
  private mistGroup: THREE.Group;
  private mistMat: THREE.MeshBasicMaterial;
  private godRaysGroup: THREE.Group;
  private godRayMat: THREE.MeshBasicMaterial;
  private foliage: FoliageCollection | null = null;
  private campfireLightSource: ChunkLightSource | null = null;
  private dynamicLights: THREE.PointLight[] = [];
  private allLightSources: ChunkLightSource[] = [];

  private worldGroup = new THREE.Group();
  private chunks = new Map<string, ChunkEntry>();
  private blocks = new Uint8Array(WORLD_SIZE_X * WORLD_SIZE_Y * WORLD_SIZE_Z);
  private spawnPoint: Vec3 = { x: 16, y: 5, z: 19 };
  private activeRealmId: RealmId = 'home';
  private activeDungeonId: DungeonId | null = null;
  private trapCoordSet = new Set<string>();
  private trapCoordList: Array<[number, number]> = [];
  private dungeonRooms: DungeonRoomMeta[] = [];

  // Auto-mapping & Fog-of-War state (64x64 grid: 0 = dark, 1 = explored, 2 = active LOS)
  private exploredGrid = new Uint8Array(WORLD_SIZE_X * WORLD_SIZE_Z);
  private dungeonWalkableMask = new Uint8Array(WORLD_SIZE_X * WORLD_SIZE_Z);
  private dungeonTotalWalkable = 1;
  private exploredWalkableCount = 0;
  private dungeonRevealed = false;
  private terrainVersion = 0;
  private lastFogUpdateX = -999;
  private lastFogUpdateZ = -999;

  // Player state (in world meters)
  private playerPos = new THREE.Vector3(16, 5, 19);
  private playerVel = new THREE.Vector3();
  private playerYaw = 0;
  private playerPitch = -0.1;
  private onGround = false;
  private inWater = false;
  private avatarConfig: AvatarConfig;
  private playerRig: CharacterRig;
  private heldBlockMesh: THREE.Mesh;
  private swingAnim = 0;
  private playerWalkSpeedMult = 1.0;
  private playerMeleeDamage = 14;
  private playerCanSprint = true;
  private playerHasTracking = false;

  // Entities & Interactive Props
  private npcDefs: NpcDefinition[] = [];
  private npcs: NpcRuntime[] = [];
  private portals: PortalRuntime[] = [];
  private chests: ChestRuntime[] = [];
  private graves: GraveRuntime[] = [];
  private creatures: CreatureRuntime[] = [];
  private projectiles: ProjectileRuntime[] = [];
  private petRig: CreatureRig | null = null;
  private petPos = new THREE.Vector3();
  private petSpec: TamedPet | null = null;

  private interactRaycaster = new THREE.Raycaster();
  private lastTargetCreatureId: string | null = null;
  private lastInteractPrompt: string | null = null;
  private creatureSpawnSeq = 1;
  private nightSpawnTimer = 0;

  // Hazards & Survival timers
  private hazardCooldown = 0;
  private survivalAccum = 0;
  private meleeCooldown = 0;
  private crackedVoxelKey = '';
  private crackedHits = 0;

  // Modes & tools
  private showcaseMode = true;
  private showcaseAngle = 0.65;
  private worldMode: WorldMode = 'play';
  private cameraView: CameraViewMode = 'first-person';
  private selectedBlock: PlaceableBlockId = BlockId.Wood;
  private editorTool: EditorTool = 'paint';
  private brushSize: BrushSize = 1;
  private paused = false;

  // Hover highlight wireframe
  private hoverWireframe: THREE.LineSegments;
  private hoverHit: VoxelHit | null = null;

  // Undo / Redo stacks
  private undoStack: VoxelChange[][] = [];
  private redoStack: VoxelChange[][] = [];

  // Input state (Keyboard/Mouse + Touch + Gamepad)
  private keys = new Set<string>();
  private pointerLocked = false;
  private isDraggingLook = false;
  private dragMoved = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private gpMoveX = 0;
  private gpMoveY = 0;
  private gpLookX = 0;
  private gpLookY = 0;
  private gpJumpHeld = false;
  private gpFlyDownHeld = false;
  private isAimBlocking = false;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private dodgeDir = new THREE.Vector3();

  // Frame loop state
  private frameId = 0;
  private disposed = false;

  constructor(container: HTMLElement, initialAvatar: AvatarConfig, callbacks: EngineCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.avatarConfig = { ...initialAvatar };
    this.isSoftwareGl = detectSoftwareGl();

    // 1. Renderer setup (moody Nordic tone mapping + soft bloom on hardware GPU)
    const initW = container.clientWidth || window.innerWidth;
    const initH = Math.max(1, container.clientHeight || window.innerHeight);
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.setSize(initW, initH);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // 2. Scene & Camera (Valheim misty Nordic atmospheric perspective)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#A69D8B');
    this.scene.fog = new THREE.FogExp2('#A69D8B', 0.0175);

    const aspect = initW / initH;
    this.camera = new THREE.PerspectiveCamera(68, aspect, 0.08, 280);
    this.scene.add(this.camera);

    // 3. Soft Environment Reflections (dark fjord water & damp slate sheen)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    this.scene.environmentIntensity = 0.34;
    pmrem.dispose();

    // 4. Lighting (Low golden Nordic sun + subdued cool slate skylight fill)
    this.hemiLight = new THREE.HemisphereLight('#9BB1C4', '#3F4639', 0.68);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight('#FFD296', 2.05);
    this.keyLight.position.set(52, 28, -22);
    this.keyLight.target.position.set(16, 4, 16);
    this.scene.add(this.keyLight.target);
    if (!this.isSoftwareGl) {
      this.keyLight.castShadow = true;
      this.keyLight.shadow.mapSize.set(2048, 2048);
      this.keyLight.shadow.camera.near = 6;
      this.keyLight.shadow.camera.far = 150;
      const d = 30;
      this.keyLight.shadow.camera.left = -d;
      this.keyLight.shadow.camera.right = d;
      this.keyLight.shadow.camera.top = d;
      this.keyLight.shadow.camera.bottom = -d;
      this.keyLight.shadow.bias = -0.0005;
      this.keyLight.shadow.normalBias = 0.028;
      this.keyLight.shadow.radius = 3.5;
    }
    this.scene.add(this.keyLight);

    // 5. Dark reflective Nordic fjord water, layered mist & sunlit god rays
    this.oceanMat = new THREE.MeshStandardMaterial({
      color: '#1B303B',
      roughness: 0.12,
      metalness: 0.28,
    });
    const oceanGeo = new THREE.PlaneGeometry(360, 360);
    this.oceanMesh = new THREE.Mesh(oceanGeo, this.oceanMat);
    this.oceanMesh.rotation.x = -Math.PI / 2;
    this.oceanMesh.position.set(16, 1.35, 16);
    this.oceanMesh.receiveShadow = true;
    this.scene.add(this.oceanMesh);

    this.cloudMat = new THREE.MeshStandardMaterial({
      color: '#CFC4B0',
      roughness: 0.98,
      metalness: 0,
      transparent: true,
      opacity: 0.26,
      depthWrite: false,
    });
    this.cloudsGroup = this.buildClouds();
    this.scene.add(this.cloudsGroup);

    this.mistMat = new THREE.MeshBasicMaterial({
      map: this.createMistTexture(),
      color: '#C7BFB0',
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.mistGroup = this.buildValleyMist();
    this.scene.add(this.mistGroup);

    this.godRayMat = new THREE.MeshBasicMaterial({
      map: this.createGodRayTexture(),
      color: '#FFE0A6',
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.godRaysGroup = this.buildGodRays();
    this.scene.add(this.godRaysGroup);

    // 6. Dynamic Skybox
    this.skySystem = new SkySystem(this.scene, this.keyLight, this.hemiLight, this.cloudMat, this.oceanMat);

    // 7. Pooled warm firelight point lights for Lanterns, Campfire & Lava
    for (let i = 0; i < MAX_DYNAMIC_LIGHTS; i++) {
      const pl = new THREE.PointLight('#FF9838', 0, 14, 1.5);
      pl.visible = false;
      this.scene.add(pl);
      this.dynamicLights.push(pl);
    }

    // 8. Voxel Atlas & Nordic PBR Materials (32x32 micro-grain albedo + bump + roughness)
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.atlasTexture = createVoxelAtlasTexture(maxAniso);
    this.bumpTexture = createVoxelBumpTexture(maxAniso);
    this.roughnessTexture = createVoxelRoughnessTexture(maxAniso);

    this.opaqueMaterial = new THREE.MeshStandardMaterial({
      map: this.atlasTexture,
      bumpMap: this.bumpTexture,
      bumpScale: 0.036,
      roughnessMap: this.roughnessTexture,
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.05,
    });
    this.transparentMaterial = new THREE.MeshStandardMaterial({
      map: this.atlasTexture,
      bumpMap: this.bumpTexture,
      bumpScale: 0.016,
      vertexColors: true,
      transparent: true,
      opacity: 0.78,
      roughness: 0.08,
      metalness: 0.22,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.emissiveMaterial = new THREE.MeshBasicMaterial({
      map: this.atlasTexture,
      vertexColors: true,
    });

    this.scene.add(this.worldGroup);

    // 8b. Soft Atmospheric Bloom on Hardware GPU (bypassed on SwiftShader/Software GL)
    if (!this.isSoftwareGl) {
      this.composer = new EffectComposer(this.renderer);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(initW, initH), 0.24, 0.55, 0.84);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }

    // 9. Hover outline scaled to VOXEL_SIZE
    const boxEdges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(VOXEL_SIZE + 0.015, VOXEL_SIZE + 0.015, VOXEL_SIZE + 0.015),
    );
    this.hoverWireframe = new THREE.LineSegments(
      boxEdges,
      new THREE.LineBasicMaterial({ color: '#E8D5A8', transparent: true, opacity: 0.82 }),
    );
    this.hoverWireframe.visible = false;
    this.scene.add(this.hoverWireframe);

    // 10. Player Avatar Rig & First-Person Held Tool/Block
    this.playerRig = buildCharacterRig(this.avatarConfig, {
      showNameTag: false,
      castShadow: !this.isSoftwareGl,
    });
    this.scene.add(this.playerRig.root);

    this.heldBlockMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.16),
      new THREE.MeshStandardMaterial({ color: BLOCK_BY_ID[this.selectedBlock].swatchColor, roughness: 0.75 }),
    );
    this.heldBlockMesh.position.set(0.32, -0.25, -0.45);
    this.heldBlockMesh.rotation.set(0.22, 0.55, 0.08);
    this.camera.add(this.heldBlockMesh);

    this.bindEvents();
    this.startLoop();
  }

  private createMistTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, 'rgba(222, 224, 218, 0.72)');
    grad.addColorStop(0.45, 'rgba(204, 210, 206, 0.34)');
    grad.addColorStop(1, 'rgba(186, 196, 198, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private createGodRayTexture(): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const ctx = c.getContext('2d')!;
    const gradV = ctx.createLinearGradient(0, 0, 0, 128);
    gradV.addColorStop(0, 'rgba(255, 226, 168, 0.0)');
    gradV.addColorStop(0.2, 'rgba(255, 224, 162, 0.58)');
    gradV.addColorStop(0.7, 'rgba(255, 214, 148, 0.25)');
    gradV.addColorStop(1, 'rgba(255, 204, 134, 0.0)');
    ctx.fillStyle = gradV;
    ctx.fillRect(0, 0, 64, 128);

    // Soften left/right edges into a feathered volumetric beam
    ctx.globalCompositeOperation = 'destination-in';
    const gradH = ctx.createLinearGradient(0, 0, 64, 0);
    gradH.addColorStop(0, 'rgba(0,0,0,0)');
    gradH.addColorStop(0.5, 'rgba(0,0,0,1)');
    gradH.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradH;
    ctx.fillRect(0, 0, 64, 128);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  private buildValleyMist(): THREE.Group {
    const group = new THREE.Group();
    const sheetGeo = new THREE.PlaneGeometry(14, 14);
    const specs: Array<[number, number, number, number]> = [
      [7.5, 3.0, 14, 1.15],
      [8.5, 2.9, 20, 1.3],
      [8.0, 3.1, 26, 1.25],
      [14.5, 2.8, 28, 1.2],
      [4.0, 3.3, 18, 1.05],
      [28.0, 3.2, 26, 1.15],
      [22.0, 3.1, 10, 1.1],
      [2.5, 2.4, 8, 1.4],
      [30.0, 2.4, 12, 1.45],
      [16.0, 2.3, 31, 1.5],
      [16.0, 2.3, 1, 1.4],
    ];
    for (let i = 0; i < specs.length; i++) {
      const [x, y, z, sc] = specs[i];
      const mesh = new THREE.Mesh(sheetGeo, this.mistMat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(x, y, z);
      mesh.scale.setScalar(sc);
      mesh.userData = { baseX: x, phase: i * 1.13, speed: 0.22 + (i % 3) * 0.08 };
      mesh.renderOrder = 3;
      group.add(mesh);
    }
    return group;
  }

  private buildGodRays(): THREE.Group {
    const group = new THREE.Group();
    const beamGeo = new THREE.PlaneGeometry(2.6, 13.5);
    const spots: Array<[number, number, number, number]> = [
      [4.5, 8.2, 10.5, 1.0],
      [5.8, 8.0, 15.5, 1.15],
      [6.4, 8.2, 22.5, 0.95],
      [11.5, 8.4, 26.5, 1.05],
      [18.5, 8.2, 26.8, 1.0],
      [25.5, 8.5, 24.5, 1.1],
      [22.5, 8.8, 8.5, 0.95],
      [10.8, 8.4, 11.2, 1.0],
    ];
    for (let i = 0; i < spots.length; i++) {
      const [x, y, z, sc] = spots[i];
      const pair = new THREE.Group();
      const p1 = new THREE.Mesh(beamGeo, this.godRayMat);
      const p2 = new THREE.Mesh(beamGeo, this.godRayMat);
      p2.rotation.y = Math.PI / 2;
      pair.add(p1, p2);
      pair.position.set(x, y, z);
      pair.scale.setScalar(sc);
      pair.rotation.z = -0.34;
      pair.rotation.x = 0.14;
      pair.userData = { phase: i * 0.9 };
      group.add(pair);
    }
    return group;
  }

  private buildClouds(): THREE.Group {
    const group = new THREE.Group();
    const specs: Array<[number, number, number, number, number]> = [
      [6, 30, 4, 18, 6.2],
      [26, 34, 12, 22, 7.0],
      [38, 29, 29, 19, 6.4],
      [4, 32, 28, 16, 5.5],
      [19, 36, 40, 23, 7.2],
      [-8, 31, 18, 18, 6.2],
    ];
    for (const [x, y, z, w, d] of specs) {
      const puff = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(w, 0.28, d), this.cloudMat);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 0.24, d * 0.72), this.cloudMat);
      mid.position.set(w * 0.08, 0.26, -d * 0.06);
      puff.add(base, mid);
      puff.position.set(x, y, z);
      group.add(puff);
    }
    return group;
  }

  /* ============================================================================
   * Public API
   * ============================================================================ */

  public loadGeneratedWorld(world: GeneratedWorld, skyBiasOverride?: SkyBias): void {
    this.blocks = new Uint8Array(world.blocks);
    this.spawnPoint = { ...world.spawn };
    this.npcDefs = world.npcs.map((n) => ({ ...n, home: { ...n.home }, avatar: { ...n.avatar } }));
    this.activeRealmId = world.realmId;
    this.activeDungeonId = world.dungeonId;

    this.trapCoordSet.clear();
    this.trapCoordList = [];
    for (const [tx, ty, tz] of world.trapCoords) {
      this.trapCoordSet.add(`${tx},${ty},${tz}`);
      this.trapCoordList.push([tx, tz]);
    }
    this.dungeonRooms = world.dungeonRooms ? world.dungeonRooms.map((r) => ({ ...r })) : [];

    // Reset auto-map & fog-of-war for newly loaded world/dungeon
    this.exploredGrid.fill(0);
    this.dungeonWalkableMask.fill(0);
    this.dungeonTotalWalkable = 1;
    this.exploredWalkableCount = 0;
    this.dungeonRevealed = false;
    this.lastFogUpdateX = -999;
    this.lastFogUpdateZ = -999;
    this.terrainVersion += 1;

    this.undoStack = [];
    this.redoStack = [];
    this.callbacks.onUndoRedoChange(0, 0);

    // Adjust sky atmosphere & outdoor visibility
    const isDungeon = world.dungeonId !== null;
    const bias: SkyBias =
      skyBiasOverride ??
      (isDungeon
        ? 'dungeon'
        : world.realmId === 'desert'
          ? 'desert'
          : world.realmId === 'ice'
            ? 'ice'
            : world.realmId === 'sky'
              ? 'sky'
              : world.realmId === 'dark'
                ? 'dark'
                : 'normal');
    this.skySystem.setRealmAtmosphere(bias);
    this.oceanMesh.visible = !isDungeon && world.realmId !== 'sky';
    this.cloudsGroup.visible = !isDungeon;
    this.mistGroup.visible = !isDungeon && world.realmId !== 'sky';
    this.godRaysGroup.visible = !isDungeon && world.realmId !== 'dark';

    // Mount low-poly Nordic pines, rounded oaks/birches, mossy boulders, and warm village campfire
    if (this.foliage) {
      this.scene.remove(this.foliage.root);
      this.foliage.dispose();
      this.foliage = null;
    }
    this.campfireLightSource = world.campfirePos
      ? {
          x: world.campfirePos.x,
          y: world.campfirePos.y + 0.55,
          z: world.campfirePos.z,
          color: '#FF9233',
        }
      : null;

    if ((world.trees && world.trees.length > 0) || world.campfirePos || (world.boulders && world.boulders.length > 0)) {
      this.foliage = buildNordicFoliageAndProps(world.trees ?? [], {
        castShadow: !this.isSoftwareGl,
        includeVillageCampfire: world.campfirePos ?? null,
        boulders: world.boulders ?? [],
      });
      this.scene.add(this.foliage.root);
    }

    if (isDungeon) {
      this.computeDungeonWalkableMask();
    }

    this.rebuildAllChunks();
    this.rebuildNpcs();
    this.rebuildPortals(world.portals);
    this.rebuildChests(world.chests);
    this.rebuildCreatures(world.creatures);
    this.clearProjectiles();
    this.respawnPlayer();
    if (isDungeon) {
      this.updateDungeonFogOfWar(true);
    }
    this.callbacks.onTimeOfDayChange(this.skySystem.getState());
  }

  public loadWorld(blocks: Uint8Array, spawn: Vec3, npcs: NpcDefinition[]): void {
    this.loadGeneratedWorld({
      blocks,
      spawn,
      npcs,
      portals: [],
      creatures: [],
      chests: [],
      trapCoords: [],
      template: 'flat',
      realmId: 'home',
      dungeonId: null,
      suggestedName: 'Saved World',
    });
  }

  public syncGraves(graves: DroppedGrave[]): void {
    for (const g of this.graves) {
      this.scene.remove(g.prop.root, g.hitbox);
      g.prop.dispose();
      g.hitbox.geometry.dispose();
      (g.hitbox.material as THREE.Material).dispose();
    }
    this.graves = [];

    if (this.activeDungeonId !== null) return; // Graves placed in realm where player fell
    const visible = graves.filter((g) => g.realmId === this.activeRealmId && !g.stolenByCreatureId);
    for (const def of visible) {
      const prop = buildLootChestProp('Epic', true);
      const gy = getSurfaceHeightMeters(this.blocks, def.position.x, def.position.z);
      prop.root.position.set(def.position.x, gy, def.position.z);
      this.applyLabelVisibility(prop.root);
      this.scene.add(prop.root);

      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.1, 1.1),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitbox.position.set(def.position.x, gy + 0.5, def.position.z);
      hitbox.userData = { interactType: 'grave', graveId: def.id };
      this.scene.add(hitbox);
      this.graves.push({ def, prop, hitbox });
    }
  }

  public syncTamedPet(pet: TamedPet | null): void {
    this.petSpec = pet;
    if (this.petRig) {
      this.scene.remove(this.petRig.root);
      this.petRig.dispose();
      this.petRig = null;
    }
    if (!pet) return;
    this.petRig = buildCreatureRig(pet.species, `${pet.name} (Pet)`, pet.level, {
      castShadow: !this.isSoftwareGl,
      accentColor: '#14B8A6',
    });
    this.petPos.set(this.playerPos.x + 1.2, this.playerPos.y, this.playerPos.z + 1.2);
    this.petRig.root.position.copy(this.petPos);
    this.applyLabelVisibility(this.petRig.root);
    this.scene.add(this.petRig.root);
  }

  private applyLabelVisibility(root: THREE.Object3D): void {
    root.traverse((obj) => {
      if (obj.userData && obj.userData.isOverheadLabel === true) {
        obj.visible = this.showOverheadLabels;
      }
    });
  }

  public setShowOverheadLabels(show: boolean): void {
    this.showOverheadLabels = show;
    this.applyLabelVisibility(this.scene);
  }

  public inspectAimTarget(skillLevel: number): InspectResult | null {
    if (this.showcaseMode || this.paused) return null;
    const effLevel = Math.max(1, skillLevel);
    const maxRange = 12 + Math.min(8, effLevel) * 4;

    const targets: THREE.Object3D[] = [
      ...this.creatures.map((c) => c.hitbox),
      ...this.npcs.map((n) => n.hitbox),
      ...this.portals.map((p) => p.hitbox),
      ...this.chests.filter((c) => !c.def.opened).map((c) => c.hitbox),
      ...this.graves.map((g) => g.hitbox),
    ];

    let entityHit: THREE.Intersection | null = null;
    if (targets.length > 0) {
      _pointerNdc.set(0, 0);
      this.interactRaycaster.setFromCamera(_pointerNdc, this.camera);
      this.interactRaycaster.far = maxRange;
      const hits = this.interactRaycaster.intersectObjects(targets, false);
      if (hits.length > 0) entityHit = hits[0];
    }

    const { origin, dir } = this.getCurrentAimRay();
    const voxelHit = this.raycastVoxel(origin, dir, maxRange);

    const pickEntity =
      entityHit !== null && (voxelHit === null || entityHit.distance <= voxelHit.distance + 0.35);

    if (pickEntity && entityHit) {
      const dist = Number(entityHit.distance.toFixed(1));
      const data = entityHit.object.userData as {
        interactType: string;
        creatureId?: string;
        npcId?: string;
        portalId?: string;
        chestId?: string;
        graveId?: string;
      };

      if (data.interactType === 'creature' && data.creatureId) {
        const c = this.creatures.find((cr) => cr.id === data.creatureId);
        if (c) {
          const estAtk = c.isBoss ? 14 + c.level * 2 : c.hostile ? 6 + c.level * 2 : 0;
          const drops = c.isBoss
            ? 'Boss Gear Chest + High Gold & XP'
            : !c.hostile || c.species === 'wolf' || c.species === 'boar'
              ? 'Raw Meat, Hide, Gold'
              : 'Combat XP & Gold';
          const stats: Array<{ label: string; value: string }> = [
            { label: 'Level', value: `Lv ${c.level}` },
            {
              label: 'Behavior',
              value: c.isBoss ? 'Dungeon Boss' : c.hostile ? 'Hostile' : 'Passive Wildlife',
            },
            { label: 'Attack', value: estAtk > 0 ? `${estAtk} DMG` : 'Non-hostile' },
            { label: 'Tameable', value: c.tameable ? 'Yes ([Y] Tame)' : 'No' },
          ];
          if (effLevel >= 2) {
            stats.push({ label: 'Likely Drops', value: drops });
          }
          const tip =
            effLevel >= 2
              ? c.isBoss
                ? 'Watch the boss lunge radius; ranged Bow [R] or Firebolt [G] keeps you safe.'
                : c.tameable
                  ? 'Learn Beast Bond from Kael or choose Tamer to recruit this animal with [Y].'
                  : c.hostile
                    ? 'Strike with melee or ranged skills; armor and Arcane Shield cut incoming hits.'
                    : 'Passive wildlife flees when struck. Tracking doubles harvested meat.'
              : 'Use Inspect on more targets to reach Lv 2 and unlock drop & combat intel.';
          return {
            targetKey: `creature:${c.id}`,
            kind: 'creature',
            title: c.name,
            subtitle: c.isBoss ? `Boss · ${c.species}` : `${c.species.charAt(0).toUpperCase()}${c.species.slice(1)}`,
            accentColor: c.isBoss ? '#F43F5E' : c.hostile ? '#F97316' : '#10B981',
            distanceMeters: dist,
            inspectLevel: effLevel,
            hp: Math.max(0, c.hp),
            maxHp: c.maxHp,
            stats,
            notes: c.isBoss
              ? 'Guarding this dungeon sanctum. Defeating it clears the dungeon and awards high-tier gear.'
              : c.hostile
                ? 'Will pursue travelers who step into aggro range outside Elderglen’s safe Shrine.'
                : 'Grazes peacefully across the terrain unless startled.',
            tip,
          };
        }
      }

      if (data.interactType === 'npc' && data.npcId) {
        const npc = this.npcs.find((n) => n.def.id === data.npcId);
        if (npc) {
          const teaches = npc.def.teachableSkillIds
            .map((id) => SKILL_CATALOG[id]?.name)
            .filter(Boolean)
            .join(', ');
          const stats: Array<{ label: string; value: string }> = [
            { label: 'Role', value: npc.def.role },
            { label: 'Disposition', value: 'Friendly Villager' },
            { label: 'Teaches', value: teaches || 'Guidance' },
          ];
          if (effLevel >= 2) {
            stats.push({ label: 'Temperament', value: npc.def.personality.split('.')[0] });
          }
          return {
            targetKey: `npc:${npc.def.id}`,
            kind: 'npc',
            title: npc.def.name,
            subtitle: npc.def.role,
            accentColor: '#38BDF8',
            distanceMeters: dist,
            inspectLevel: effLevel,
            stats,
            notes: npc.def.backstory,
            tip: 'Approach and press [E] or click to open dialogue, quests, and skill training.',
          };
        }
      }

      if (data.interactType === 'portal' && data.portalId) {
        const p = this.portals.find((pr) => pr.def.id === data.portalId);
        if (p) {
          const stats: Array<{ label: string; value: string }> = [
            {
              label: 'Structure',
              value:
                p.def.kind === 'dungeon'
                  ? 'Dungeon Gate'
                  : p.def.kind === 'realm'
                    ? 'Realm Portal'
                    : p.def.kind === 'shrine'
                      ? 'Awakening Shrine'
                      : p.def.kind === 'quest_board'
                        ? 'Village Quest Board'
                        : p.def.kind === 'map_pedestal'
                          ? 'Cartographer Pedestal'
                          : 'Exit Gate',
            },
          ];
          let notes = p.def.subtitle;
          let tip = 'Move closer and press [E] to interact.';
          if (p.def.kind === 'dungeon') {
            const dMeta = DUNGEON_BY_ID[p.def.targetId as DungeonId];
            if (dMeta) {
              stats.push(
                { label: 'Rec. Level', value: `Lv ${dMeta.minLevel}–${dMeta.maxLevel}` },
                { label: 'Boss', value: dMeta.bossName },
              );
              notes = dMeta.description;
              tip = 'Dungeons start unmapped—explore rooms, touch the Map Pedestal, or use a Map Scroll.';
            }
          } else if (p.def.kind === 'realm') {
            const rMeta = REALM_BY_ID[p.def.targetId as RealmId];
            if (rMeta) {
              stats.push(
                { label: 'Rec. Level', value: `Lv ${rMeta.minLevel}–${rMeta.maxLevel}` },
                { label: 'Gear Rule', value: 'Soulbound crosses' },
              );
              notes = rMeta.description;
              tip = 'Unbound gear is safely stored in this realm’s World Chest when you cross.';
            }
          } else if (p.def.kind === 'map_pedestal') {
            stats.push({ label: 'Effect', value: 'Reveals 100% Map' });
            notes = 'Ancient surveyor stone inscribed with the full blueprint of this dungeon.';
          } else if (p.def.kind === 'shrine') {
            stats.push({ label: 'Services', value: 'Heal, Spawn, Soulbind' });
          }
          return {
            targetKey: `portal:${p.def.id}`,
            kind: 'portal',
            title: p.def.label,
            subtitle: p.def.subtitle,
            accentColor: p.def.color || '#38BDF8',
            distanceMeters: dist,
            inspectLevel: effLevel,
            stats,
            notes,
            tip,
          };
        }
      }

      if (data.interactType === 'chest' && data.chestId) {
        const ch = this.chests.find((c) => c.def.id === data.chestId);
        if (ch) {
          const goldEst = ch.def.rarity === 'Legendary' ? '120g' : ch.def.rarity === 'Epic' ? '75g' : '35g';
          return {
            targetKey: `chest:${ch.def.id}`,
            kind: 'chest',
            title: `${ch.def.rarity} Loot Chest`,
            subtitle: 'Unopened Treasure',
            accentColor: '#F59E0B',
            distanceMeters: dist,
            inspectLevel: effLevel,
            stats: [
              { label: 'Rarity', value: ch.def.rarity },
              { label: 'Estimated Gold', value: goldEst },
              { label: 'Contents', value: `${ch.def.rarity} Gear + XP` },
            ],
            notes: 'A reinforced treasure chest sealed with iron bands. Scales with your current level.',
            tip: 'Step within 3.4m and press [E] or click to claim its contents.',
          };
        }
      }

      if (data.interactType === 'grave' && data.graveId) {
        const gr = this.graves.find((g) => g.def.id === data.graveId);
        if (gr) {
          return {
            targetKey: `grave:${gr.def.id}`,
            kind: 'grave',
            title: 'Traveler’s Grave Marker',
            subtitle: 'Recoverable Dropped Gear',
            accentColor: '#A855F7',
            distanceMeters: dist,
            inspectLevel: effLevel,
            stats: [
              { label: 'Stored Items', value: `${gr.def.items.length} item(s)` },
              { label: 'Status', value: 'Ready to Recover' },
            ],
            notes: 'Holds unbound gear dropped during your last defeat.',
            tip: 'Press [E] nearby to retrieve every dropped item back into your bag.',
          };
        }
      }
    }

    if (voxelHit) {
      const id = getBlock(this.blocks, voxelHit.bx, voxelHit.by, voxelHit.bz);
      if (id !== BlockId.Air) {
        const def = BLOCK_BY_ID[id];
        const hardness = getBlockHardness(id);
        const shapeLabel =
          def.shape === 'slab'
            ? 'Half Slab'
            : def.shape === 'stairs'
              ? 'Stepped Stairs'
              : def.shape === 'slope'
                ? 'Angled Roof Slope'
                : def.shape === 'fence'
                  ? 'Timber Post / Fence'
                  : def.shape === 'lantern'
                    ? 'Emissive Lantern'
                    : def.shape === 'banner'
                      ? 'Hanging Banner'
                      : 'Fine Cube (0.5m)';
        const stats: Array<{ label: string; value: string }> = [
          { label: 'Material', value: shapeLabel },
          { label: 'Hardness', value: `${hardness} strike${hardness > 1 ? 's' : ''}` },
          {
            label: 'Yields',
            value: def.gatherResource
              ? def.gatherResource.charAt(0).toUpperCase() + def.gatherResource.slice(1)
              : 'Building Block',
          },
          {
            label: 'Properties',
            value: def.damagesPlayer
              ? 'Hazard (Burns)'
              : def.emissive
                ? 'Light Source'
                : def.transparent
                  ? 'Translucent'
                  : 'Solid',
          },
        ];
        if (effLevel >= 2) {
          stats.push({ label: 'Voxel Coords', value: `${voxelHit.bx}, ${voxelHit.by}, ${voxelHit.bz}` });
        }
        return {
          targetKey: `block:${id}:${voxelHit.bx},${voxelHit.by},${voxelHit.bz}`,
          kind: 'block',
          title: def.name,
          subtitle: `Fine Architectural Voxel · Key [${def.key}]`,
          accentColor: def.swatchColor,
          distanceMeters: Number(voxelHit.distance.toFixed(1)),
          inspectLevel: effLevel,
          stats,
          notes: def.damagesPlayer
            ? 'Superheated hazard! Touching this surface deals burn damage.'
            : def.gatherResource
              ? `Mine with Left-Click to harvest ${def.gatherResource} for crafting weapons, armor, and tools.`
              : 'Structural material usable in both Play Mode and Create Mode.',
          tip:
            effLevel >= 2 && def.gatherResource === 'ore'
              ? 'Artificers harvest double resources from every ore vein.'
              : undefined,
        };
      }
    }

    return null;
  }

  public syncPlayerCombatStats(params: {
    meleeDamage: number;
    walkSpeedMult: number;
    canSprint: boolean;
    hasTracking?: boolean;
  }): void {
    this.playerMeleeDamage = params.meleeDamage;
    this.playerWalkSpeedMult = params.walkSpeedMult;
    this.playerCanSprint = params.canSprint;
    this.playerHasTracking = Boolean(params.hasTracking);
  }

  public revealDungeonMap(): void {
    if (this.activeDungeonId === null) return;
    this.dungeonRevealed = true;
    // Remove any remaining map pedestal prop in the dungeon
    const pedestals = this.portals.filter((p) => p.def.kind === 'map_pedestal');
    for (const ped of pedestals) {
      this.removePortalById(ped.def.id);
    }
    this.updateDungeonFogOfWar(true);
  }

  public removePortalById(portalId: string): void {
    const idx = this.portals.findIndex((p) => p.def.id === portalId);
    if (idx === -1) return;
    const p = this.portals[idx];
    this.scene.remove(p.prop.root, p.hitbox);
    p.prop.dispose();
    p.hitbox.geometry.dispose();
    (p.hitbox.material as THREE.Material).dispose();
    this.portals.splice(idx, 1);
  }

  public getMinimapSnapshot(): MinimapSnapshot {
    const isDungeon = this.activeDungeonId !== null;
    const exploredPercent = !isDungeon
      ? 100
      : this.dungeonRevealed
        ? 100
        : Math.min(100, Math.round((this.exploredWalkableCount / Math.max(1, this.dungeonTotalWalkable)) * 100));

    return {
      playerX: this.playerPos.x / VOXEL_SIZE,
      playerZ: this.playerPos.z / VOXEL_SIZE,
      playerYaw: this.playerYaw,
      isDungeon,
      dungeonId: this.activeDungeonId,
      realmId: this.activeRealmId,
      dungeonRevealed: this.dungeonRevealed,
      exploredGrid: this.exploredGrid,
      exploredPercent,
      terrainVersion: this.terrainVersion,
      blocks: this.blocks,
      portals: this.portals.map((p) => ({
        id: p.def.id,
        kind: p.def.kind,
        label: p.def.label,
        x: p.prop.root.position.x / VOXEL_SIZE,
        z: p.prop.root.position.z / VOXEL_SIZE,
        color: p.def.color,
      })),
      npcs: this.npcs.map((n) => ({
        id: n.def.id,
        name: n.def.name,
        x: n.pos.x / VOXEL_SIZE,
        z: n.pos.z / VOXEL_SIZE,
      })),
      chests: this.chests.map((c) => ({
        id: c.def.id,
        x: c.prop.root.position.x / VOXEL_SIZE,
        z: c.prop.root.position.z / VOXEL_SIZE,
        rarity: c.def.rarity,
        opened: c.def.opened,
      })),
      graves: this.graves.map((g) => ({
        id: g.def.id,
        x: g.prop.root.position.x / VOXEL_SIZE,
        z: g.prop.root.position.z / VOXEL_SIZE,
      })),
      creatures: this.creatures.map((c) => ({
        id: c.id,
        name: c.name,
        species: c.species,
        x: c.pos.x / VOXEL_SIZE,
        z: c.pos.z / VOXEL_SIZE,
        hostile: c.hostile,
        isBoss: c.isBoss,
      })),
      trapCoords: this.trapCoordList,
      rooms: this.dungeonRooms,
    };
  }

  public getBlocksSnapshot(): Uint8Array {
    return new Uint8Array(this.blocks);
  }

  public getSpawnPoint(): Vec3 {
    return { ...this.spawnPoint };
  }

  public getPlayerPosition(): Vec3 {
    return { x: this.playerPos.x, y: this.playerPos.y, z: this.playerPos.z };
  }

  public getNpcs(): NpcDefinition[] {
    return this.npcDefs;
  }

  public setShowcaseMode(enabled: boolean): void {
    this.showcaseMode = enabled;
    if (enabled) {
      this.exitPointerLock();
      this.hoverWireframe.visible = false;
      this.heldBlockMesh.visible = false;
    } else {
      this.updateAvatarVisibility();
    }
  }

  public setWorldMode(mode: WorldMode): void {
    this.worldMode = mode;
    this.playerVel.set(0, 0, 0);
    if (mode === 'create' && this.playerPos.y < 6) {
      this.playerPos.y += 1.5;
    }
    this.updateAvatarVisibility();
  }

  public setCameraView(view: CameraViewMode): void {
    this.cameraView = view;
    this.updateAvatarVisibility();
  }

  public setSelectedBlock(blockId: PlaceableBlockId): void {
    this.selectedBlock = blockId;
    const mat = this.heldBlockMesh.material as THREE.MeshStandardMaterial;
    mat.color.set(BLOCK_BY_ID[blockId].swatchColor);
  }

  public setEditorTool(tool: EditorTool): void {
    this.editorTool = tool;
  }

  public setBrushSize(size: BrushSize): void {
    this.brushSize = size;
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.keys.clear();
      this.exitPointerLock();
    }
  }

  public updateAvatar(config: AvatarConfig): void {
    this.avatarConfig = { ...config };
    this.scene.remove(this.playerRig.root);
    this.playerRig.dispose();
    this.playerRig = buildCharacterRig(this.avatarConfig, {
      showNameTag: false,
      castShadow: !this.isSoftwareGl,
    });
    this.scene.add(this.playerRig.root);
    this.updateAvatarVisibility();
  }

  public respawnPlayer(customPos?: Vec3): void {
    const target = customPos ?? this.spawnPoint;
    const groundY = getSurfaceHeightMeters(this.blocks, target.x, target.z);
    this.playerPos.set(target.x, Math.max(target.y, groundY + 0.05), target.z);
    this.playerVel.set(0, 0, 0);
    this.playerYaw = 0;
    this.playerPitch = -0.08;
    this.hazardCooldown = 1.0;
    if (this.petRig) {
      this.petPos.set(this.playerPos.x + 1.2, this.playerPos.y, this.playerPos.z + 1.2);
    }
  }

  public cycleTimeOfDay(): TimeOfDayState {
    const state = this.skySystem.cyclePresetPhase();
    this.callbacks.onTimeOfDayChange(state);
    return state;
  }

  public toggleTimePaused(): TimeOfDayState {
    const state = this.skySystem.togglePaused();
    this.callbacks.onTimeOfDayChange(state);
    return state;
  }

  public fireProjectile(kind: 'bow' | 'magic', damage: number): void {
    if (this.showcaseMode || this.paused) return;
    if (kind === 'bow') sfx.playBow();
    else sfx.playFirebolt();

    this.swingAnim = 1;
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    const start = new THREE.Vector3(
      this.playerPos.x,
      this.playerPos.y + 1.38,
      this.playerPos.z,
    ).addScaledVector(dir, 0.55);

    const mesh =
      kind === 'magic'
        ? new THREE.Mesh(
            new THREE.SphereGeometry(0.16, 10, 8),
            new THREE.MeshBasicMaterial({ color: '#FB923C' }),
          )
        : new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.06, 0.55),
            new THREE.MeshStandardMaterial({ color: '#E2E8F0', roughness: 0.4, metalness: 0.4 }),
          );

    mesh.position.copy(start);
    mesh.lookAt(start.clone().add(dir));
    this.scene.add(mesh);

    let light: THREE.PointLight | undefined;
    if (kind === 'magic' && !this.isSoftwareGl) {
      light = new THREE.PointLight('#F97316', 2.4, 7);
      light.position.copy(start);
      this.scene.add(light);
    }

    this.projectiles.push({
      kind,
      mesh,
      light,
      pos: start,
      vel: dir.multiplyScalar(kind === 'magic' ? 22 : 28),
      damage,
      life: 2.2,
    });
  }

  public attemptTameNearest(canTame: boolean): void {
    let best: CreatureRuntime | null = null;
    let bestDist = 5.5;
    for (const c of this.creatures) {
      if (!c.tameable) continue;
      const d = c.pos.distanceTo(this.playerPos);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    if (!best) {
      this.callbacks.onStatusHint('Move closer to a deer, rabbit, boar, or wolf to tame it.');
      return;
    }
    if (!canTame) {
      this.callbacks.onStatusHint('Learn Beast Bond from Kael or awaken as a Tamer (Lv 5) to tame animals.');
      return;
    }

    sfx.playHeal();
    const tamedSpecies = best.species as 'deer' | 'rabbit' | 'wolf' | 'boar';
    const name = best.name;
    const lvl = best.level;
    this.removeCreature(best);
    this.callbacks.onTameResult(tamedSpecies, name, lvl);
  }

  public interactNearest(): boolean {
    if (this.showcaseMode || this.paused) return false;

    // 1. Check nearby Graves
    for (const g of this.graves) {
      if (g.prop.root.position.distanceTo(this.playerPos) < 3.4) {
        sfx.playOreSparkle();
        this.callbacks.onGraveRecover(g.def);
        return true;
      }
    }
    // 2. Check nearby Loot Chests
    for (const ch of this.chests) {
      if (!ch.def.opened && ch.prop.root.position.distanceTo(this.playerPos) < 3.4) {
        ch.def.opened = true;
        this.scene.remove(ch.prop.root, ch.hitbox);
        ch.prop.dispose();
        sfx.playOreSparkle();
        this.callbacks.onChestOpen(ch.def);
        return true;
      }
    }
    // 3. Check nearby NPCs
    let closestNpc: NpcRuntime | null = null;
    let bestNpcDist = 4.0;
    for (const npc of this.npcs) {
      const d = npc.pos.distanceTo(this.playerPos);
      if (d < bestNpcDist) {
        bestNpcDist = d;
        closestNpc = npc;
      }
    }
    if (closestNpc) {
      closestNpc.facingPlayerTimer = 5;
      sfx.playChime();
      this.exitPointerLock();
      this.callbacks.onNpcClick(closestNpc.def);
      return true;
    }
    // 4. Check nearby Portals / Shrine / Quest Board
    let closestPortal: PortalRuntime | null = null;
    let bestPortalDist = 4.0;
    for (const p of this.portals) {
      const d = p.prop.root.position.distanceTo(this.playerPos);
      if (d < bestPortalDist) {
        bestPortalDist = d;
        closestPortal = p;
      }
    }
    if (closestPortal) {
      sfx.playChime();
      this.exitPointerLock();
      this.callbacks.onPortalInteract(closestPortal.def);
      return true;
    }
    return false;
  }

  public requestPointerLock(): void {
    if (this.showcaseMode || this.paused) return;
    try {
      const el = this.renderer.domElement;
      if (el.requestPointerLock && document.pointerLockElement !== el) {
        const maybePromise = el.requestPointerLock() as unknown as Promise<void> | undefined;
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {});
        }
      }
    } catch {
      // Fallback drag-look stays active
    }
  }

  public exitPointerLock(): void {
    try {
      if (document.pointerLockElement === this.renderer.domElement && document.exitPointerLock) {
        document.exitPointerLock();
      }
    } catch {
      // Ignore
    }
  }

  public setTouchJoystick(x: number, y: number): void {
    this.touchMoveX = x;
    this.touchMoveY = y;
  }

  public setGamepadAxes(moveX: number, moveY: number, lookX: number, lookY: number): void {
    this.gpMoveX = moveX;
    this.gpMoveY = moveY;
    this.gpLookX = lookX;
    this.gpLookY = lookY;
  }

  public setGamepadVertical(jumpHeld: boolean, flyDownHeld: boolean): void {
    this.gpJumpHeld = jumpHeld;
    this.gpFlyDownHeld = flyDownHeld;
  }

  public setAimBlock(active: boolean): void {
    this.isAimBlocking = active;
  }

  public isBlocking(): boolean {
    return this.isAimBlocking && this.worldMode === 'play' && !this.showcaseMode && !this.paused;
  }

  public triggerDodge(): boolean {
    if (this.showcaseMode || this.paused || this.worldMode !== 'play') return false;
    if (this.dodgeCooldown > 0) return false;
    this.dodgeCooldown = 0.85;
    this.dodgeTimer = 0.22;

    // Dash along current stick/key direction, or nimble back-step if neutral
    const fwd =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      this.touchMoveY -
      this.gpMoveY;
    const str =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touchMoveX +
      this.gpMoveX;

    _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));
    this.dodgeDir.set(0, 0, 0);
    if (Math.abs(fwd) > 0.1 || Math.abs(str) > 0.1) {
      this.dodgeDir.addScaledVector(_forward, fwd).addScaledVector(_right, str).normalize();
    } else {
      this.dodgeDir.copy(_forward).multiplyScalar(-1);
    }
    sfx.playJump();
    return true;
  }

  public triggerJump(): void {
    if (this.worldMode === 'create') {
      this.playerPos.y = Math.min(WORLD_SIZE_Y * VOXEL_SIZE + 5, this.playerPos.y + 1.0);
      return;
    }
    if (this.onGround || this.inWater) {
      this.playerVel.y = this.inWater ? 5.2 : 7.6;
      this.onGround = false;
      sfx.playJump();
    }
  }

  public triggerPrimaryAction(): void {
    if (this.showcaseMode || this.paused) return;
    if (this.worldMode === 'create') {
      this.performCreateAction(false);
    } else {
      this.performPlayPrimary();
    }
  }

  public triggerSecondaryAction(): void {
    if (this.showcaseMode || this.paused) return;
    if (this.worldMode === 'create') {
      this.performCreateAction(true);
    } else {
      this.performPlayPlace();
    }
  }

  public triggerCreatePaint(): void {
    if (this.showcaseMode || this.paused || this.worldMode !== 'create') return;
    const prev = this.editorTool;
    this.editorTool = 'paint';
    this.performCreateAction(false);
    this.editorTool = prev;
  }

  public triggerCreateErase(): void {
    if (this.showcaseMode || this.paused || this.worldMode !== 'create') return;
    const prev = this.editorTool;
    this.editorTool = 'erase';
    this.performCreateAction(false);
    this.editorTool = prev;
  }

  public undo(): boolean {
    const batch = this.undoStack.pop();
    if (!batch) return false;
    const dirty = new Set<string>();
    for (let i = batch.length - 1; i >= 0; i--) {
      const ch = batch[i];
      this.blocks[ch.idx] = ch.prev;
      this.markChunksForIdx(ch.idx, dirty);
    }
    this.redoStack.push(batch);
    this.rebuildDirtyChunks(dirty);
    sfx.playBreak();
    this.callbacks.onUndoRedoChange(this.undoStack.length, this.redoStack.length);
    this.callbacks.onWorldModified();
    return true;
  }

  public redo(): boolean {
    const batch = this.redoStack.pop();
    if (!batch) return false;
    const dirty = new Set<string>();
    for (let i = 0; i < batch.length; i++) {
      const ch = batch[i];
      this.blocks[ch.idx] = ch.next;
      this.markChunksForIdx(ch.idx, dirty);
    }
    this.undoStack.push(batch);
    this.rebuildDirtyChunks(dirty);
    sfx.playPlace();
    this.callbacks.onUndoRedoChange(this.undoStack.length, this.redoStack.length);
    this.callbacks.onWorldModified();
    return true;
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.unbindEvents();
    this.timer.dispose();

    for (const entry of this.chunks.values()) {
      entry.opaqueMesh.geometry.dispose();
      entry.transparentMesh.geometry.dispose();
      entry.emissiveMesh.geometry.dispose();
    }
    this.chunks.clear();
    this.clearNpcs();
    this.clearPortals();
    this.clearChests();
    this.clearCreatures();
    this.clearProjectiles();
    for (const g of this.graves) {
      this.scene.remove(g.prop.root, g.hitbox);
      g.prop.dispose();
    }
    if (this.petRig) {
      this.scene.remove(this.petRig.root);
      this.petRig.dispose();
    }
    if (this.foliage) {
      this.scene.remove(this.foliage.root);
      this.foliage.dispose();
      this.foliage = null;
    }
    this.mistMat.map?.dispose();
    this.mistMat.dispose();
    this.godRayMat.map?.dispose();
    this.godRayMat.dispose();
    if (this.composer) {
      this.composer.dispose();
      this.composer = null;
      this.bloomPass = null;
    }
    this.playerRig.dispose();
    this.skySystem.dispose();
    this.atlasTexture.dispose();
    this.bumpTexture.dispose();
    this.roughnessTexture.dispose();
    this.opaqueMaterial.dispose();
    this.transparentMaterial.dispose();
    this.emissiveMaterial.dispose();
    this.envTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }

  /* ============================================================================
   * Chunks & Dynamic Lighting
   * ============================================================================ */

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private rebuildAllChunks(): void {
    for (const entry of this.chunks.values()) {
      this.worldGroup.remove(entry.opaqueMesh, entry.transparentMesh, entry.emissiveMesh);
      entry.opaqueMesh.geometry.dispose();
      entry.transparentMesh.geometry.dispose();
      entry.emissiveMesh.geometry.dispose();
    }
    this.chunks.clear();

    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      for (let cx = 0; cx < CHUNKS_X; cx++) {
        this.buildOrUpdateChunk(cx, cz);
      }
    }
    this.refreshLightSourceCache();
  }

  private buildOrUpdateChunk(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    const { opaqueGeo, transparentGeo, emissiveGeo, lightSources } = buildChunkGeometry(this.blocks, cx, cz);
    const existing = this.chunks.get(key);

    if (existing) {
      existing.opaqueMesh.geometry.dispose();
      existing.transparentMesh.geometry.dispose();
      existing.emissiveMesh.geometry.dispose();
      existing.opaqueMesh.geometry = opaqueGeo;
      existing.transparentMesh.geometry = transparentGeo;
      existing.emissiveMesh.geometry = emissiveGeo;
      existing.lightSources = lightSources;
      return;
    }

    const opaqueMesh = new THREE.Mesh(opaqueGeo, this.opaqueMaterial);
    opaqueMesh.castShadow = !this.isSoftwareGl;
    opaqueMesh.receiveShadow = true;

    const transparentMesh = new THREE.Mesh(transparentGeo, this.transparentMaterial);
    transparentMesh.renderOrder = 2;

    const emissiveMesh = new THREE.Mesh(emissiveGeo, this.emissiveMaterial);
    emissiveMesh.renderOrder = 1;

    this.worldGroup.add(opaqueMesh, transparentMesh, emissiveMesh);
    this.chunks.set(key, { cx, cz, opaqueMesh, transparentMesh, emissiveMesh, lightSources });
  }

  private refreshLightSourceCache(): void {
    const all: ChunkLightSource[] = [];
    if (this.campfireLightSource) {
      all.push(this.campfireLightSource);
    }
    for (const entry of this.chunks.values()) {
      for (const ls of entry.lightSources) {
        all.push(ls);
      }
    }
    this.allLightSources = all;
    if (all.length === 0) {
      for (const pl of this.dynamicLights) {
        pl.visible = false;
        pl.intensity = 0;
      }
    }
  }

  private updateDynamicLights(elapsed: number): void {
    if (this.allLightSources.length === 0) return;
    const refX = this.showcaseMode ? 16 : this.playerPos.x;
    const refY = this.showcaseMode ? 6 : this.playerPos.y;
    const refZ = this.showcaseMode ? 16 : this.playerPos.z;
    const nightBoost = 1 + this.skySystem.getNightFactor() * 1.15;

    const picked: Array<{ ls: ChunkLightSource; d2: number }> = [];
    for (let i = 0; i < this.allLightSources.length; i++) {
      const ls = this.allLightSources[i];
      const dx = ls.x - refX;
      const dy = ls.y - refY;
      const dz = ls.z - refZ;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > 480) continue;

      let tooClose = false;
      for (let j = 0; j < picked.length; j++) {
        const p = picked[j].ls;
        if ((p.x - ls.x) ** 2 + (p.y - ls.y) ** 2 + (p.z - ls.z) ** 2 < 4.0) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      if (picked.length < MAX_DYNAMIC_LIGHTS) {
        picked.push({ ls, d2 });
      } else {
        let worstIdx = 0;
        for (let j = 1; j < picked.length; j++) {
          if (picked[j].d2 > picked[worstIdx].d2) worstIdx = j;
        }
        if (d2 < picked[worstIdx].d2) {
          picked[worstIdx] = { ls, d2 };
        }
      }
    }

    for (let i = 0; i < this.dynamicLights.length; i++) {
      const pl = this.dynamicLights[i];
      if (i < picked.length) {
        const { ls } = picked[i];
        pl.visible = true;
        pl.position.set(ls.x, ls.y + 0.35, ls.z);
        pl.color.set(ls.color);
        const flicker = 0.9 + Math.sin(elapsed * 6.2 + i * 2.1) * 0.12 + Math.cos(elapsed * 11.3 + i) * 0.04;
        pl.distance = this.activeDungeonId ? 14 : 11 + this.skySystem.getNightFactor() * 6;
        pl.intensity = (this.activeDungeonId ? 4.2 : 2.6 * nightBoost) * flicker;
      } else {
        pl.visible = false;
        pl.intensity = 0;
      }
    }
  }

  private markChunksForIdx(idx: number, dirty: Set<string>): void {
    const x = idx % WORLD_SIZE_X;
    const rem = Math.floor(idx / WORLD_SIZE_X);
    const z = rem % WORLD_SIZE_Z;
    const cx = Math.floor(x / CHUNK_SIZE);
    const cz = Math.floor(z / CHUNK_SIZE);
    dirty.add(this.chunkKey(cx, cz));
    if (x % CHUNK_SIZE === 0 && cx > 0) dirty.add(this.chunkKey(cx - 1, cz));
    if (x % CHUNK_SIZE === CHUNK_SIZE - 1 && cx < CHUNKS_X - 1) dirty.add(this.chunkKey(cx + 1, cz));
    if (z % CHUNK_SIZE === 0 && cz > 0) dirty.add(this.chunkKey(cx, cz - 1));
    if (z % CHUNK_SIZE === CHUNK_SIZE - 1 && cz < CHUNKS_Z - 1) dirty.add(this.chunkKey(cx, cz + 1));
  }

  private rebuildDirtyChunks(dirty: Set<string>): void {
    for (const key of dirty) {
      const [cx, cz] = key.split(',').map(Number);
      this.buildOrUpdateChunk(cx, cz);
    }
    this.refreshLightSourceCache();
    this.terrainVersion += 1;
  }

  /** Precomputes walkable dungeon tiles (floor at y=1, open corridor/room at y=2..3) for auto-map % */
  private computeDungeonWalkableMask(): void {
    let total = 0;
    for (let z = 0; z < WORLD_SIZE_Z; z++) {
      for (let x = 0; x < WORLD_SIZE_X; x++) {
        const floor = getBlock(this.blocks, x, 1, z);
        const mid = getBlock(this.blocks, x, 3, z);
        const walkable = floor !== BlockId.Air && !isBlockSolid(mid);
        const idx = z * WORLD_SIZE_X + x;
        this.dungeonWalkableMask[idx] = walkable ? 1 : 0;
        if (walkable) total++;
      }
    }
    this.dungeonTotalWalkable = Math.max(1, total);
  }

  /** Raycasted 2D Fog-of-War auto-mapping: populates procedural rooms & walls as player explores */
  private updateDungeonFogOfWar(force = false): void {
    if (this.activeDungeonId === null) return;
    const px = this.playerPos.x / VOXEL_SIZE;
    const pz = this.playerPos.z / VOXEL_SIZE;
    if (!force && Math.hypot(px - this.lastFogUpdateX, pz - this.lastFogUpdateZ) < 0.45) {
      return;
    }
    this.lastFogUpdateX = px;
    this.lastFogUpdateZ = pz;

    // Downgrade previously active LOS tiles (2) to explored memory (1)
    for (let i = 0; i < this.exploredGrid.length; i++) {
      if (this.exploredGrid[i] === 2) this.exploredGrid[i] = 1;
    }

    const markVisible = (gx: number, gz: number) => {
      if (gx < 0 || gx >= WORLD_SIZE_X || gz < 0 || gz >= WORLD_SIZE_Z) return;
      const idx = gz * WORLD_SIZE_X + gx;
      if (this.exploredGrid[idx] === 0 && this.dungeonWalkableMask[idx] === 1) {
        this.exploredWalkableCount += 1;
      }
      this.exploredGrid[idx] = 2;
    };

    const radius = this.playerHasTracking ? 12.5 : 9.5;
    const rays = 96;
    const step = 0.35;

    // Immediate personal footprint
    const cx = Math.floor(px);
    const cz = Math.floor(pz);
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        if (dx * dx + dz * dz <= 5) {
          markVisible(cx + dx, cz + dz);
        }
      }
    }

    // Cast rays outward; stop at solid dungeon walls (while marking the wall face itself!)
    for (let i = 0; i < rays; i++) {
      const ang = (i / rays) * Math.PI * 2;
      const dirX = Math.cos(ang);
      const dirZ = Math.sin(ang);
      for (let d = 0.5; d <= radius; d += step) {
        const gx = Math.floor(px + dirX * d);
        const gz = Math.floor(pz + dirZ * d);
        if (gx < 0 || gx >= WORLD_SIZE_X || gz < 0 || gz >= WORLD_SIZE_Z) break;
        markVisible(gx, gz);
        // Check wall occlusion at head height (y = 3)
        const wallBlock = getBlock(this.blocks, gx, 3, gz);
        if (isBlockSolid(wallBlock) && wallBlock !== BlockId.Glass) {
          break;
        }
      }
    }
  }

  private commitChanges(changes: VoxelChange[]): void {
    if (changes.length === 0) return;
    const dirty = new Set<string>();
    for (const ch of changes) {
      this.blocks[ch.idx] = ch.next;
      this.markChunksForIdx(ch.idx, dirty);
    }
    this.rebuildDirtyChunks(dirty);

    this.undoStack.push(changes);
    if (this.undoStack.length > MAX_UNDO_STEPS) {
      this.undoStack.shift();
    }
    this.redoStack = [];
    this.callbacks.onUndoRedoChange(this.undoStack.length, this.redoStack.length);
    this.callbacks.onWorldModified();
  }

  /* ============================================================================
   * Entity Builders & Spawners (NPCs, Portals, Chests, Wildlife, Monsters)
   * ============================================================================ */

  private clearNpcs(): void {
    for (const npc of this.npcs) {
      this.scene.remove(npc.rig.root, npc.hitbox);
      npc.rig.dispose();
      npc.hitbox.geometry.dispose();
      (npc.hitbox.material as THREE.Material).dispose();
    }
    this.npcs = [];
  }

  private rebuildNpcs(): void {
    this.clearNpcs();
    for (const def of this.npcDefs) {
      const rig = buildCharacterRig(def.avatar, {
        showNameTag: true,
        subtitle: def.role,
        castShadow: !this.isSoftwareGl,
      });
      const y = getSurfaceHeightMeters(this.blocks, def.home.x, def.home.z);
      const pos = new THREE.Vector3(def.home.x, y, def.home.z);
      rig.root.position.copy(pos);
      this.applyLabelVisibility(rig.root);
      this.scene.add(rig.root);

      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 1.95, 0.95),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitbox.position.set(pos.x, pos.y + 0.95, pos.z);
      hitbox.userData = { interactType: 'npc', npcId: def.id };
      this.scene.add(hitbox);

      this.npcs.push({
        def,
        rig,
        pos,
        target: pos.clone(),
        yaw: Math.random() * Math.PI * 2,
        pauseTimer: 1 + Math.random() * 2,
        facingPlayerTimer: 0,
        hitbox,
      });
    }
  }

  private clearPortals(): void {
    for (const p of this.portals) {
      this.scene.remove(p.prop.root, p.hitbox);
      p.prop.dispose();
      p.hitbox.geometry.dispose();
      (p.hitbox.material as THREE.Material).dispose();
    }
    this.portals = [];
  }

  private rebuildPortals(defs: WorldPortalPoint[]): void {
    this.clearPortals();
    for (const def of defs) {
      const prop = buildPortalProp(def.label, def.subtitle, def.color, def.kind);
      const y = this.activeDungeonId
        ? def.position.y
        : getSurfaceHeightMeters(this.blocks, def.position.x, def.position.z);
      prop.root.position.set(def.position.x, y, def.position.z);
      this.applyLabelVisibility(prop.root);
      this.scene.add(prop.root);

      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 2.6, 1.3),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitbox.position.set(def.position.x, y + 1.2, def.position.z);
      hitbox.userData = { interactType: 'portal', portalId: def.id };
      this.scene.add(hitbox);

      this.portals.push({ def, prop, hitbox });
    }
  }

  private clearChests(): void {
    for (const ch of this.chests) {
      this.scene.remove(ch.prop.root, ch.hitbox);
      ch.prop.dispose();
      ch.hitbox.geometry.dispose();
      (ch.hitbox.material as THREE.Material).dispose();
    }
    this.chests = [];
  }

  private rebuildChests(defs: LootChestPoint[]): void {
    this.clearChests();
    for (const def of defs) {
      if (def.opened) continue;
      const prop = buildLootChestProp(def.rarity, false);
      const y = this.activeDungeonId
        ? def.position.y
        : getSurfaceHeightMeters(this.blocks, def.position.x, def.position.z);
      prop.root.position.set(def.position.x, y, def.position.z);
      this.applyLabelVisibility(prop.root);
      this.scene.add(prop.root);

      const hitbox = new THREE.Mesh(
        new THREE.BoxGeometry(1.1, 1.0, 1.1),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      hitbox.position.set(def.position.x, y + 0.45, def.position.z);
      hitbox.userData = { interactType: 'chest', chestId: def.id };
      this.scene.add(hitbox);

      this.chests.push({ def: { ...def }, prop, hitbox });
    }
  }

  private clearCreatures(): void {
    for (const c of this.creatures) {
      this.scene.remove(c.rig.root, c.hitbox);
      c.rig.dispose();
      c.hitbox.geometry.dispose();
      (c.hitbox.material as THREE.Material).dispose();
    }
    this.creatures = [];
  }

  private spawnCreature(spec: CreatureSpawnSpec, nightSpawn = false): CreatureRuntime {
    const id = `cr-${this.creatureSpawnSeq++}`;
    const rig = buildCreatureRig(spec.species, spec.name, spec.level, {
      castShadow: !this.isSoftwareGl,
      accentColor: spec.accentColor,
    });
    const y = this.activeDungeonId
      ? spec.position.y
      : getSurfaceHeightMeters(this.blocks, spec.position.x, spec.position.z);
    const pos = new THREE.Vector3(spec.position.x, y, spec.position.z);
    rig.root.position.copy(pos);
    this.applyLabelVisibility(rig.root);
    this.scene.add(rig.root);

    const maxHp = spec.isBoss
      ? Math.round(95 + spec.level * 22)
      : spec.hostile
        ? Math.round(28 + spec.level * 10)
        : Math.round(18 + spec.level * 6);

    const hSize = spec.isBoss ? 1.8 : 1.05;
    const hHeight = spec.isBoss ? 2.8 : 1.45;
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(hSize, hHeight, hSize),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.set(pos.x, pos.y + hHeight * 0.5, pos.z);
    hitbox.userData = { interactType: 'creature', creatureId: id };
    this.scene.add(hitbox);

    const runtime: CreatureRuntime = {
      id,
      species: spec.species,
      name: spec.name,
      level: spec.level,
      hp: maxHp,
      maxHp,
      hostile: spec.hostile,
      tameable: spec.tameable,
      isBoss: spec.isBoss,
      nightSpawn,
      rig,
      pos,
      home: pos.clone(),
      target: pos.clone(),
      yaw: Math.random() * Math.PI * 2,
      pauseTimer: 1 + Math.random() * 2,
      attackCooldown: 1.0,
      hitFlashTimer: 0,
      fleeTimer: 0,
      hitbox,
    };
    this.creatures.push(runtime);
    return runtime;
  }

  private rebuildCreatures(specs: CreatureSpawnSpec[]): void {
    this.clearCreatures();
    for (const s of specs) {
      this.spawnCreature(s, false);
    }
  }

  private removeCreature(target: CreatureRuntime): void {
    this.scene.remove(target.rig.root, target.hitbox);
    target.rig.dispose();
    target.hitbox.geometry.dispose();
    (target.hitbox.material as THREE.Material).dispose();
    this.creatures = this.creatures.filter((c) => c.id !== target.id);
    if (this.lastTargetCreatureId === target.id) {
      this.lastTargetCreatureId = null;
      this.callbacks.onCreatureTargetChange(null);
    }
  }

  private clearProjectiles(): void {
    for (const p of this.projectiles) {
      this.scene.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
      if (p.light) this.scene.remove(p.light);
    }
    this.projectiles = [];
  }

  /* ============================================================================
   * Voxel DDA Raycasting (Half-Voxel Scale)
   * ============================================================================ */

  private raycastVoxel(origin: THREE.Vector3, dir: THREE.Vector3, maxDistMeters: number): VoxelHit | null {
    const maxDistVox = maxDistMeters / VOXEL_SIZE;
    let x = Math.floor(origin.x / VOXEL_SIZE);
    let y = Math.floor(origin.y / VOXEL_SIZE);
    let z = Math.floor(origin.z / VOXEL_SIZE);

    const stepX = dir.x > 0 ? 1 : dir.x < 0 ? -1 : 0;
    const stepY = dir.y > 0 ? 1 : dir.y < 0 ? -1 : 0;
    const stepZ = dir.z > 0 ? 1 : dir.z < 0 ? -1 : 0;

    const ox = origin.x / VOXEL_SIZE;
    const oy = origin.y / VOXEL_SIZE;
    const oz = origin.z / VOXEL_SIZE;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dir.z) : Infinity;

    let tMaxX = stepX > 0 ? (x + 1 - ox) * tDeltaX : stepX < 0 ? (ox - x) * tDeltaX : Infinity;
    let tMaxY = stepY > 0 ? (y + 1 - oy) * tDeltaY : stepY < 0 ? (oy - y) * tDeltaY : Infinity;
    let tMaxZ = stepZ > 0 ? (z + 1 - oz) * tDeltaZ : stepZ < 0 ? (oz - z) * tDeltaZ : Infinity;

    let nx = 0;
    let ny = 0;
    let nz = 0;
    let distVox = 0;

    for (let i = 0; i < 64 && distVox <= maxDistVox; i++) {
      if (inBounds(x, y, z)) {
        const id = getBlock(this.blocks, x, y, z);
        if (id !== BlockId.Air && id !== BlockId.Water) {
          return { bx: x, by: y, bz: z, nx, ny, nz, distance: distVox * VOXEL_SIZE };
        }
      }
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          distVox = tMaxX;
          x += stepX;
          tMaxX += tDeltaX;
          nx = -stepX;
          ny = 0;
          nz = 0;
        } else {
          distVox = tMaxZ;
          z += stepZ;
          tMaxZ += tDeltaZ;
          nx = 0;
          ny = 0;
          nz = -stepZ;
        }
      } else if (tMaxY < tMaxZ) {
        distVox = tMaxY;
        y += stepY;
        tMaxY += tDeltaY;
        nx = 0;
        ny = -stepY;
        nz = 0;
      } else {
        distVox = tMaxZ;
        z += stepZ;
        tMaxZ += tDeltaZ;
        nx = 0;
        ny = 0;
        nz = -stepZ;
      }
    }
    return null;
  }

  private getCurrentAimRay(): { origin: THREE.Vector3; dir: THREE.Vector3 } {
    _rayOrigin.copy(this.camera.position);
    _rayDir.set(0, 0, -1).applyQuaternion(this.camera.quaternion).normalize();
    return { origin: _rayOrigin, dir: _rayDir };
  }

  /* ============================================================================
   * Combat, Interactions & Voxel Editing Actions
   * ============================================================================ */

  private damageCreature(
    creature: CreatureRuntime,
    rawDamage: number,
    attackKind: 'melee' | 'bow' | 'magic',
  ): void {
    const isCrit = Math.random() < 0.16;
    const damage = Math.max(1, Math.round(rawDamage * (isCrit ? 1.5 : 1)));
    creature.hp -= damage;
    creature.hitFlashTimer = 0.16;
    creature.fleeTimer = creature.hostile ? 0 : 4.0;

    // Small knockback away from player
    _tmpVec.subVectors(creature.pos, this.playerPos);
    _tmpVec.y = 0;
    if (_tmpVec.lengthSq() > 0.001) {
      _tmpVec.normalize().multiplyScalar(0.35);
      creature.pos.x = THREE.MathUtils.clamp(creature.pos.x + _tmpVec.x, 1, WORLD_METERS_X - 1);
      creature.pos.z = THREE.MathUtils.clamp(creature.pos.z + _tmpVec.z, 1, WORLD_METERS_Z - 1);
    }

    this.callbacks.onCreatureHit(attackKind, damage, isCrit);

    if (creature.hp <= 0) {
      const payload: CreatureKilledPayload = {
        id: creature.id,
        species: creature.species,
        name: creature.name,
        level: creature.level,
        hostile: creature.hostile,
        isBoss: creature.isBoss,
        attackKind,
        hadStolenGraveId: creature.stolenGraveId,
      };
      this.removeCreature(creature);
      sfx.playOreSparkle();
      this.callbacks.onCreatureKilled(payload);
    } else {
      this.emitCreatureTarget(creature);
    }
  }

  private raycastInteractiveAtNdc(ndcX: number, ndcY: number): THREE.Intersection | null {
    const targets: THREE.Object3D[] = [
      ...this.npcs.map((n) => n.hitbox),
      ...this.portals.map((p) => p.hitbox),
      ...this.chests.filter((c) => !c.def.opened).map((c) => c.hitbox),
      ...this.graves.map((g) => g.hitbox),
      ...this.creatures.map((c) => c.hitbox),
    ];
    if (targets.length === 0) return null;
    _pointerNdc.set(ndcX, ndcY);
    this.interactRaycaster.setFromCamera(_pointerNdc, this.camera);
    this.interactRaycaster.far = 6.5;
    const hits = this.interactRaycaster.intersectObjects(targets, false);
    return hits.length > 0 ? hits[0] : null;
  }

  private performPlayPrimary(clientX?: number, clientY?: number): void {
    let ndcX = 0;
    let ndcY = 0;
    if (!this.pointerLocked && clientX !== undefined && clientY !== undefined) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    // 1. Raycast NPCs, Portals, Chests, Graves, and Creatures first
    const hitObj = this.raycastInteractiveAtNdc(ndcX, ndcY);
    if (hitObj) {
      const data = hitObj.object.userData as {
        interactType: string;
        npcId?: string;
        portalId?: string;
        chestId?: string;
        graveId?: string;
        creatureId?: string;
      };
      if (data.interactType === 'npc' && hitObj.distance < 5.5) {
        const npc = this.npcs.find((n) => n.def.id === data.npcId);
        if (npc) {
          npc.facingPlayerTimer = 5;
          sfx.playChime();
          this.exitPointerLock();
          this.callbacks.onNpcClick(npc.def);
          return;
        }
      }
      if (data.interactType === 'portal' && hitObj.distance < 5.5) {
        const portal = this.portals.find((p) => p.def.id === data.portalId);
        if (portal) {
          sfx.playChime();
          this.exitPointerLock();
          this.callbacks.onPortalInteract(portal.def);
          return;
        }
      }
      if (data.interactType === 'chest' && hitObj.distance < 4.5) {
        const chest = this.chests.find((c) => c.def.id === data.chestId && !c.def.opened);
        if (chest) {
          chest.def.opened = true;
          this.scene.remove(chest.prop.root, chest.hitbox);
          chest.prop.dispose();
          sfx.playOreSparkle();
          this.callbacks.onChestOpen(chest.def);
          return;
        }
      }
      if (data.interactType === 'grave' && hitObj.distance < 4.5) {
        const grave = this.graves.find((g) => g.def.id === data.graveId);
        if (grave) {
          sfx.playOreSparkle();
          this.callbacks.onGraveRecover(grave.def);
          return;
        }
      }
      if (data.interactType === 'creature' && hitObj.distance < 4.2) {
        const cr = this.creatures.find((c) => c.id === data.creatureId);
        if (cr && this.meleeCooldown <= 0) {
          this.meleeCooldown = 0.36;
          this.swingAnim = 1;
          sfx.playSlash();
          this.damageCreature(cr, this.playerMeleeDamage, 'melee');
          return;
        }
      }
    }

    // 2. Break / Mine targeted voxel block
    const { origin, dir } = this.getCurrentAimRay();
    const hit = this.raycastVoxel(origin, dir, 5.5);
    if (!hit || hit.by <= 0) return;

    const idx = voxelIndex(hit.bx, hit.by, hit.bz);
    const prev = this.blocks[idx] as BlockId;
    if (prev === BlockId.Air) return;

    const hardness = getBlockHardness(prev);
    const voxelKey = `${hit.bx},${hit.by},${hit.bz}`;
    if (hardness > 1) {
      if (this.crackedVoxelKey !== voxelKey) {
        this.crackedVoxelKey = voxelKey;
        this.crackedHits = 1;
        this.swingAnim = 1;
        sfx.playHeavyThud();
        this.callbacks.onStatusHint(`${BLOCK_BY_ID[prev].name} is hard — strike once more to mine!`);
        return;
      }
      this.crackedHits += 1;
      if (this.crackedHits < hardness) {
        this.swingAnim = 1;
        sfx.playHeavyThud();
        return;
      }
      this.crackedVoxelKey = '';
      this.crackedHits = 0;
    }

    this.commitChanges([{ idx, prev, next: BlockId.Air }]);
    this.swingAnim = 1;

    const def = BLOCK_BY_ID[prev];
    if (def.gatherResource) {
      this.callbacks.onResourceGathered(def.gatherResource, prev);
    }

    if (prev === BlockId.DiamondOre || prev === BlockId.GoldOre) {
      sfx.playOreSparkle();
    } else if (prev === BlockId.Obsidian) {
      sfx.playHeavyThud();
    } else {
      sfx.playBreak();
    }
  }

  private performPlayPlace(): void {
    const { origin, dir } = this.getCurrentAimRay();
    const hit = this.raycastVoxel(origin, dir, 5.5);
    if (!hit) return;

    const tx = hit.bx + hit.nx;
    const ty = hit.by + hit.ny;
    const tz = hit.bz + hit.nz;
    if (!inBounds(tx, ty, tz)) return;

    if (this.voxelIntersectsPlayer(tx, ty, tz)) return;
    const idx = voxelIndex(tx, ty, tz);
    const prev = this.blocks[idx] as BlockId;
    if (prev === this.selectedBlock) return;

    this.commitChanges([{ idx, prev, next: this.selectedBlock }]);
    this.swingAnim = 1;
    sfx.playPlace();
    this.callbacks.onBlockPlacedInPlay();
  }

  private performCreateAction(isSecondary: boolean): void {
    const { origin, dir } = this.getCurrentAimRay();
    const hit = this.raycastVoxel(origin, dir, 18);
    if (!hit) return;

    const effectiveTool: EditorTool = isSecondary
      ? this.editorTool === 'erase'
        ? 'paint'
        : 'erase'
      : this.editorTool;

    if (effectiveTool === 'fill') {
      this.floodFill(hit.bx, hit.by, hit.bz, this.selectedBlock);
      return;
    }

    const radius = this.brushSize === 3 ? 1 : 0;
    const changes: VoxelChange[] = [];

    if (effectiveTool === 'erase') {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = hit.bx + dx;
            const y = hit.by + dy;
            const z = hit.bz + dz;
            if (!inBounds(x, y, z) || y <= 0) continue;
            const idx = voxelIndex(x, y, z);
            const prev = this.blocks[idx] as BlockId;
            if (prev !== BlockId.Air) {
              changes.push({ idx, prev, next: BlockId.Air });
            }
          }
        }
      }
      if (changes.length > 0) {
        this.commitChanges(changes);
        sfx.playBreak();
      }
    } else {
      const cx = hit.bx + hit.nx;
      const cy = hit.by + hit.ny;
      const cz = hit.bz + hit.nz;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = cx + dx;
            const y = cy + dy;
            const z = cz + dz;
            if (!inBounds(x, y, z)) continue;
            const idx = voxelIndex(x, y, z);
            const prev = this.blocks[idx] as BlockId;
            if (prev !== this.selectedBlock) {
              changes.push({ idx, prev, next: this.selectedBlock });
            }
          }
        }
      }
      if (changes.length > 0) {
        this.commitChanges(changes);
        sfx.playPlace();
      }
    }
  }

  private floodFill(startX: number, startY: number, startZ: number, fillId: PlaceableBlockId): void {
    const targetId = getBlock(this.blocks, startX, startY, startZ);
    if (targetId === fillId || targetId === BlockId.Air) return;

    const maxFill = 160;
    const queue: Array<[number, number, number]> = [[startX, startY, startZ]];
    const visited = new Set<number>([voxelIndex(startX, startY, startZ)]);
    const changes: VoxelChange[] = [];

    while (queue.length > 0 && changes.length < maxFill) {
      const [x, y, z] = queue.shift()!;
      const idx = voxelIndex(x, y, z);
      changes.push({ idx, prev: targetId, next: fillId });

      const neighbors: Array<[number, number, number]> = [
        [x + 1, y, z],
        [x - 1, y, z],
        [x, y, z + 1],
        [x, y, z - 1],
        [x, y + 1, z],
        [x, y - 1, z],
      ];
      for (const [nx, ny, nz] of neighbors) {
        if (!inBounds(nx, ny, nz) || ny <= 0) continue;
        const nIdx = voxelIndex(nx, ny, nz);
        if (visited.has(nIdx)) continue;
        if (this.blocks[nIdx] === targetId) {
          visited.add(nIdx);
          queue.push([nx, ny, nz]);
        }
      }
    }

    if (changes.length > 0) {
      this.commitChanges(changes);
      sfx.playPlace();
    }
  }

  /* ============================================================================
   * Physics & Half-Voxel AABB Collision
   * ============================================================================ */

  private voxelIntersectsPlayer(bx: number, by: number, bz: number): boolean {
    const minX = bx * VOXEL_SIZE;
    const maxX = minX + VOXEL_SIZE;
    const minY = by * VOXEL_SIZE;
    const maxY = minY + VOXEL_SIZE;
    const minZ = bz * VOXEL_SIZE;
    const maxZ = minZ + VOXEL_SIZE;

    const pr = 0.28;
    const ph = 1.65;
    return (
      maxX > this.playerPos.x - pr &&
      minX < this.playerPos.x + pr &&
      maxY > this.playerPos.y &&
      minY < this.playerPos.y + ph &&
      maxZ > this.playerPos.z - pr &&
      minZ < this.playerPos.z + pr
    );
  }

  private collidesAt(px: number, py: number, pz: number): boolean {
    const r = 0.28;
    const h = 1.62;
    const minX = Math.floor((px - r) / VOXEL_SIZE);
    const maxX = Math.floor((px + r) / VOXEL_SIZE);
    const minY = Math.floor((py + 0.02) / VOXEL_SIZE);
    const maxY = Math.floor((py + h) / VOXEL_SIZE);
    const minZ = Math.floor((pz - r) / VOXEL_SIZE);
    const maxZ = Math.floor((pz + r) / VOXEL_SIZE);

    for (let y = minY; y <= maxY; y++) {
      for (let z = minZ; z <= maxZ; z++) {
        for (let x = minX; x <= maxX; x++) {
          if (x < 0 || x >= WORLD_SIZE_X || z < 0 || z >= WORLD_SIZE_Z) return true;
          if (y < 0) return true;
          if (y >= WORLD_SIZE_Y) continue;
          if (isBlockSolid(getBlock(this.blocks, x, y, z))) return true;
        }
      }
    }
    return false;
  }

  private isTouchHazard(px: number, py: number, pz: number): string | null {
    const gx = Math.floor(px / VOXEL_SIZE);
    const gyFeet = Math.floor((py + 0.08) / VOXEL_SIZE);
    const gyBelow = Math.floor((py - 0.12) / VOXEL_SIZE);
    const gz = Math.floor(pz / VOXEL_SIZE);

    if (
      getBlock(this.blocks, gx, gyFeet, gz) === BlockId.Lava ||
      getBlock(this.blocks, gx, gyBelow, gz) === BlockId.Lava
    ) {
      return 'Lava';
    }
    if (this.trapCoordSet.has(`${gx},${gyBelow},${gz}`)) {
      return 'Dungeon Trap';
    }
    return null;
  }

  private updatePlayer(dt: number): void {
    // Apply smooth gamepad right-stick camera look (with deadzone already applied by gamepadManager)
    if (Math.abs(this.gpLookX) > 0.001 || Math.abs(this.gpLookY) > 0.001) {
      const lookSpeed = this.isAimBlocking ? 1.55 : 2.45;
      this.playerYaw -= this.gpLookX * lookSpeed * dt;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - this.gpLookY * lookSpeed * 0.78 * dt,
        -Math.PI / 2 + 0.06,
        Math.PI / 2 - 0.06,
      );
    }

    if (this.dodgeCooldown > 0) this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    if (this.dodgeTimer > 0) this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);

    const moveForward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      this.touchMoveY -
      this.gpMoveY;
    const moveStrafe =
      (this.keys.has('KeyD') || this.keys.has('ArrowRight') ? 1 : 0) -
      (this.keys.has('KeyA') || this.keys.has('ArrowLeft') ? 1 : 0) +
      this.touchMoveX +
      this.gpMoveX;

    _forward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    _right.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    _move.set(0, 0, 0);
    _move.addScaledVector(_forward, moveForward);
    _move.addScaledVector(_right, moveStrafe);
    if (_move.lengthSq() > 1) _move.normalize();

    const isMoving = _move.lengthSq() > 0.02;
    const isSprinting =
      this.worldMode === 'play' &&
      isMoving &&
      this.playerCanSprint &&
      !this.isAimBlocking &&
      (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));

    if (this.worldMode === 'create') {
      const flySpeed = this.keys.has('ShiftLeft') ? 11.5 : 7.5;
      this.playerPos.addScaledVector(_move, flySpeed * dt);
      if (this.keys.has('Space') || this.gpJumpHeld) this.playerPos.y += flySpeed * 0.8 * dt;
      if (this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.gpFlyDownHeld) {
        this.playerPos.y -= flySpeed * 0.8 * dt;
      }

      this.playerPos.x = THREE.MathUtils.clamp(this.playerPos.x, 0.5, WORLD_METERS_X - 0.5);
      this.playerPos.z = THREE.MathUtils.clamp(this.playerPos.z, 0.5, WORLD_METERS_Z - 0.5);
      this.playerPos.y = THREE.MathUtils.clamp(this.playerPos.y, 1.0, WORLD_SIZE_Y * VOXEL_SIZE + 8);
      this.playerVel.set(0, 0, 0);
    } else {
      const gx = Math.floor(this.playerPos.x / VOXEL_SIZE);
      const gy = Math.floor((this.playerPos.y + 0.45) / VOXEL_SIZE);
      const gz = Math.floor(this.playerPos.z / VOXEL_SIZE);
      this.inWater = getBlock(this.blocks, gx, gy, gz) === BlockId.Water;

      if (this.dodgeTimer > 0) {
        this.playerVel.x = this.dodgeDir.x * 11.5;
        this.playerVel.z = this.dodgeDir.z * 11.5;
      } else {
        const baseSpeed = this.inWater ? 3.2 : this.isAimBlocking ? 3.1 : isSprinting ? 7.0 : 4.8;
        const walkSpeed = baseSpeed * this.playerWalkSpeedMult;
        const targetVx = _move.x * walkSpeed;
        const targetVz = _move.z * walkSpeed;
        const accel = this.onGround ? 18 : 7;
        const blend = 1 - Math.exp(-accel * dt);
        this.playerVel.x = THREE.MathUtils.lerp(this.playerVel.x, targetVx, blend);
        this.playerVel.z = THREE.MathUtils.lerp(this.playerVel.z, targetVz, blend);
      }

      if (this.inWater) {
        this.playerVel.y -= 5.8 * dt;
        if (this.keys.has('Space') || this.gpJumpHeld) this.playerVel.y = 3.8;
        this.playerVel.y = THREE.MathUtils.clamp(this.playerVel.y, -3.5, 4.5);
      } else {
        this.playerVel.y -= 21 * dt;
        if ((this.keys.has('Space') || this.gpJumpHeld) && this.onGround) {
          this.playerVel.y = 7.6;
          this.onGround = false;
          sfx.playJump();
        }
      }

      // X axis with smooth auto half-block step-up (0.52m)
      const nextX = this.playerPos.x + this.playerVel.x * dt;
      if (!this.collidesAt(nextX, this.playerPos.y, this.playerPos.z)) {
        this.playerPos.x = nextX;
      } else if (this.onGround && !this.collidesAt(nextX, this.playerPos.y + VOXEL_SIZE + 0.04, this.playerPos.z)) {
        this.playerPos.x = nextX;
        this.playerPos.y += VOXEL_SIZE + 0.02;
      } else {
        this.playerVel.x = 0;
      }

      // Z axis with smooth auto half-block step-up
      const nextZ = this.playerPos.z + this.playerVel.z * dt;
      if (!this.collidesAt(this.playerPos.x, this.playerPos.y, nextZ)) {
        this.playerPos.z = nextZ;
      } else if (this.onGround && !this.collidesAt(this.playerPos.x, this.playerPos.y + VOXEL_SIZE + 0.04, nextZ)) {
        this.playerPos.z = nextZ;
        this.playerPos.y += VOXEL_SIZE + 0.02;
      } else {
        this.playerVel.z = 0;
      }

      // Y axis
      const nextY = this.playerPos.y + this.playerVel.y * dt;
      if (!this.collidesAt(this.playerPos.x, nextY, this.playerPos.z)) {
        this.playerPos.y = nextY;
        this.onGround = false;
      } else {
        if (this.playerVel.y < 0) {
          this.onGround = true;
          this.playerPos.y = Math.ceil((nextY - 0.02) / VOXEL_SIZE) * VOXEL_SIZE;
        }
        this.playerVel.y = 0;
      }

      // Void safety (e.g. falling off Sky Isles)
      if (this.playerPos.y < -3) {
        this.callbacks.onPlayerDamage(25, 'Abyss Fall', this.getPlayerPosition());
        this.respawnPlayer();
      }

      // Lava & dungeon traps
      if (this.hazardCooldown > 0) this.hazardCooldown = Math.max(0, this.hazardCooldown - dt);
      const hazard = this.isTouchHazard(this.playerPos.x, this.playerPos.y, this.playerPos.z);
      if (hazard && this.hazardCooldown <= 0) {
        this.hazardCooldown = 0.9;
        this.playerVel.y = 5.4;
        sfx.playSizzle();
        this.callbacks.onPlayerDamage(hazard === 'Lava' ? 18 : 15, hazard, this.getPlayerPosition());
      }

      // Survival tick (stamina/hunger/regen)
      this.survivalAccum += dt;
      if (this.survivalAccum >= 0.25) {
        this.callbacks.onSurvivalTick(this.survivalAccum, isSprinting, isMoving);
        this.survivalAccum = 0;
      }
    }

    if (this.meleeCooldown > 0) this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);

    // Update Dungeon Auto-Map Fog of War as player explores
    if (this.activeDungeonId !== null) {
      this.updateDungeonFogOfWar(false);
    }

    // Sync player avatar
    const horizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
    this.playerRig.root.position.copy(this.playerPos);
    this.playerRig.root.rotation.y = this.playerYaw + Math.PI;
    animateCharacterRig(this.playerRig, horizSpeed, !this.onGround && this.worldMode === 'play', dt);
    this.updateCameraTransform(dt);
  }

  private updateCameraTransform(dt: number): void {
    const eyeY = this.playerPos.y + 1.48;
    if (this.cameraView === 'first-person') {
      this.camera.position.set(this.playerPos.x, eyeY, this.playerPos.z);
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.y = this.playerYaw;
      this.camera.rotation.x = this.playerPitch;
      this.camera.rotation.z = 0;
    } else {
      const dist = 3.6;
      const backX = Math.sin(this.playerYaw) * Math.cos(this.playerPitch);
      const backY = -Math.sin(this.playerPitch);
      const backZ = Math.cos(this.playerYaw) * Math.cos(this.playerPitch);
      _camGoal.set(
        this.playerPos.x + backX * dist,
        Math.max(this.playerPos.y + 0.9, eyeY + backY * dist + 0.65),
        this.playerPos.z + backZ * dist,
      );
      const damp = 1 - Math.exp(-14 * dt);
      this.camera.position.lerp(_camGoal, damp);
      _camLook.set(this.playerPos.x, eyeY - 0.1, this.playerPos.z);
      this.camera.lookAt(_camLook);
    }

    // Smooth aim/block FOV zoom & guard posture
    const targetFov = this.isAimBlocking && this.worldMode === 'play' ? 58 : 68;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-12 * dt));
      this.camera.updateProjectionMatrix();
    }

    if (this.swingAnim > 0) {
      this.swingAnim = Math.max(0, this.swingAnim - dt * 5.2);
    }
    const swingOffset = Math.sin(this.swingAnim * Math.PI) * 0.14;
    const guardShift = this.isAimBlocking && this.worldMode === 'play' ? 1 : 0;
    this.heldBlockMesh.position.set(
      0.32 - guardShift * 0.14,
      -0.25 + guardShift * 0.06 - swingOffset * 0.4,
      -0.45 - swingOffset,
    );
    this.heldBlockMesh.rotation.x = 0.22 + swingOffset * 2.5 - guardShift * 0.3;
  }

  private updateAvatarVisibility(): void {
    if (this.showcaseMode) {
      this.playerRig.root.visible = false;
      this.heldBlockMesh.visible = false;
      return;
    }
    this.playerRig.root.visible = this.cameraView === 'third-person';
    this.heldBlockMesh.visible = this.cameraView === 'first-person';
  }

  /* ============================================================================
   * AI Loops: NPCs, Portals, Wildlife, Night Monsters, Projectiles, Pet
   * ============================================================================ */

  private updateNpcs(dt: number): void {
    for (const npc of this.npcs) {
      if (npc.facingPlayerTimer > 0) {
        npc.facingPlayerTimer -= dt;
        const dx = this.playerPos.x - npc.pos.x;
        const dz = this.playerPos.z - npc.pos.z;
        npc.yaw = Math.atan2(dx, dz);
        npc.rig.root.rotation.y = npc.yaw;
        animateCharacterRig(npc.rig, 0, false, dt);
        continue;
      }

      if (npc.pauseTimer > 0) {
        npc.pauseTimer -= dt;
        animateCharacterRig(npc.rig, 0, false, dt);
        if (npc.pauseTimer <= 0) {
          const angle = Math.random() * Math.PI * 2;
          const dist = Math.random() * npc.def.wanderRadius;
          const tx = THREE.MathUtils.clamp(npc.def.home.x + Math.cos(angle) * dist, 1.5, WORLD_METERS_X - 1.5);
          const tz = THREE.MathUtils.clamp(npc.def.home.z + Math.sin(angle) * dist, 1.5, WORLD_METERS_Z - 1.5);
          npc.target.set(tx, getSurfaceHeightMeters(this.blocks, tx, tz), tz);
        }
        continue;
      }

      const dx = npc.target.x - npc.pos.x;
      const dz = npc.target.z - npc.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.22) {
        npc.pauseTimer = 2 + Math.random() * 2.8;
        animateCharacterRig(npc.rig, 0, false, dt);
      } else {
        const speed = 0.95;
        const step = Math.min(dist, speed * dt);
        const nx = npc.pos.x + (dx / dist) * step;
        const nz = npc.pos.z + (dz / dist) * step;
        const ny = getSurfaceHeightMeters(this.blocks, nx, nz);
        if (Math.abs(ny - npc.pos.y) <= 1.1) {
          npc.pos.set(nx, ny, nz);
          npc.yaw = Math.atan2(dx, dz);
          npc.rig.root.position.copy(npc.pos);
          npc.rig.root.rotation.y = npc.yaw;
          npc.hitbox.position.set(nx, ny + 0.95, nz);
          animateCharacterRig(npc.rig, speed, false, dt);
        } else {
          npc.pauseTimer = 1.5;
        }
      }
    }
  }

  private updatePortalsAndProps(dt: number, elapsed: number): void {
    for (const p of this.portals) {
      if (p.prop.spinTarget) {
        p.prop.spinTarget.rotation.y += dt * 1.4;
        p.prop.spinTarget.position.y += Math.sin(elapsed * 2.5) * 0.0015;
      }
    }
  }

  private updateNightSpawns(dt: number): void {
    if (this.showcaseMode || this.worldMode !== 'play' || this.activeDungeonId !== null) return;
    const isNight = this.skySystem.isNighttime();

    if (!isNight) {
      // Despawn nocturnal monsters at dawn
      const nocturnals = this.creatures.filter((c) => c.nightSpawn);
      for (const n of nocturnals) this.removeCreature(n);
      return;
    }

    this.nightSpawnTimer += dt;
    if (this.nightSpawnTimer < 7) return;
    this.nightSpawnTimer = 0;

    const currentNightCount = this.creatures.filter((c) => c.nightSpawn).length;
    if (currentNightCount >= 3) return;

    const angle = Math.random() * Math.PI * 2;
    const dist = 8 + Math.random() * 5;
    const sx = THREE.MathUtils.clamp(this.playerPos.x + Math.cos(angle) * dist, 2, WORLD_METERS_X - 2);
    const sz = THREE.MathUtils.clamp(this.playerPos.z + Math.sin(angle) * dist, 2, WORLD_METERS_Z - 2);

    // Keep immediate Village Shrine safe zone calm
    if (this.activeRealmId === 'home' && Math.hypot(sx - 16, sz - 17) < 6.5) return;

    const types: Array<{ species: CreatureSpecies; name: string }> = [
      { species: 'slime', name: 'Night Slime' },
      { species: 'skeleton', name: 'Shadow Skeleton' },
      { species: 'goblin', name: 'Dusk Goblin' },
    ];
    const pick = types[Math.floor(Math.random() * types.length)];
    this.spawnCreature(
      {
        species: pick.species,
        name: pick.name,
        level: this.activeRealmId === 'home' ? 2 : 6,
        hostile: true,
        tameable: false,
        isBoss: false,
        position: { x: sx, y: 4, z: sz },
      },
      true,
    );
  }

  private updateCreatures(dt: number, elapsed: number): void {
    const safeShrineDist =
      this.activeRealmId === 'home' && !this.activeDungeonId
        ? Math.hypot(this.playerPos.x - 16, this.playerPos.z - 17)
        : 999;
    const playerInSafeShrine = safeShrineDist < 5.2;

    for (const c of this.creatures) {
      // Hit flash decay
      if (c.hitFlashTimer > 0) {
        c.hitFlashTimer = Math.max(0, c.hitFlashTimer - dt);
        const flashIntensity = c.hitFlashTimer > 0 ? 0.65 : 0;
        for (const m of c.rig.hitFlashMaterials) {
          m.emissiveIntensity = Math.max(flashIntensity, m.userData?.baseEmissive ?? 0);
          if (flashIntensity > 0) m.emissive.set('#EF4444');
          else m.emissive.set('#000000');
        }
      }

      if (c.attackCooldown > 0) c.attackCooldown = Math.max(0, c.attackCooldown - dt);
      if (c.fleeTimer > 0) c.fleeTimer = Math.max(0, c.fleeTimer - dt);

      const distToPlayer = c.pos.distanceTo(this.playerPos);
      let moveSpeed = 0;

      if (
        !this.showcaseMode &&
        this.worldMode === 'play' &&
        c.hostile &&
        !playerInSafeShrine &&
        distToPlayer < (c.isBoss ? 11.5 : 7.5)
      ) {
        // Chase player
        const dx = this.playerPos.x - c.pos.x;
        const dz = this.playerPos.z - c.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        c.yaw = Math.atan2(dx, dz);

        if (d > (c.isBoss ? 1.7 : 1.15)) {
          moveSpeed = c.isBoss ? 2.4 : c.species === 'wolf' ? 3.1 : 2.1;
          const nx = THREE.MathUtils.clamp(c.pos.x + (dx / d) * moveSpeed * dt, 1.5, WORLD_METERS_X - 1.5);
          const nz = THREE.MathUtils.clamp(c.pos.z + (dz / d) * moveSpeed * dt, 1.5, WORLD_METERS_Z - 1.5);
          const ny = this.activeDungeonId ? c.pos.y : getSurfaceHeightMeters(this.blocks, nx, nz);
          if (Math.abs(ny - c.pos.y) <= 1.2) {
            c.pos.set(nx, ny, nz);
          }
        } else if (c.attackCooldown <= 0) {
          c.attackCooldown = c.isBoss ? 1.45 : 1.25;
          const dmg = c.isBoss ? 14 + c.level * 2 : 6 + c.level * 2;
          sfx.playHeavyThud();
          this.callbacks.onPlayerDamage(dmg, c.name, this.getPlayerPosition());
        }
      } else if (c.fleeTimer > 0) {
        // Passive wildlife flees briefly
        const dx = c.pos.x - this.playerPos.x;
        const dz = c.pos.z - this.playerPos.z;
        const d = Math.hypot(dx, dz) || 1;
        moveSpeed = 3.2;
        const nx = THREE.MathUtils.clamp(c.pos.x + (dx / d) * moveSpeed * dt, 1.5, WORLD_METERS_X - 1.5);
        const nz = THREE.MathUtils.clamp(c.pos.z + (dz / d) * moveSpeed * dt, 1.5, WORLD_METERS_Z - 1.5);
        const ny = this.activeDungeonId ? c.pos.y : getSurfaceHeightMeters(this.blocks, nx, nz);
        if (Math.abs(ny - c.pos.y) <= 1.2) {
          c.pos.set(nx, ny, nz);
          c.yaw = Math.atan2(dx, dz);
        }
      } else {
        // Peaceful patrol near home point
        if (c.pauseTimer > 0) {
          c.pauseTimer -= dt;
          if (c.pauseTimer <= 0) {
            const ang = Math.random() * Math.PI * 2;
            const rad = c.isBoss ? 2.5 : 3.8;
            const tx = THREE.MathUtils.clamp(c.home.x + Math.cos(ang) * rad, 1.5, WORLD_METERS_X - 1.5);
            const tz = THREE.MathUtils.clamp(c.home.z + Math.sin(ang) * rad, 1.5, WORLD_METERS_Z - 1.5);
            c.target.set(tx, this.activeDungeonId ? c.pos.y : getSurfaceHeightMeters(this.blocks, tx, tz), tz);
          }
        } else {
          const dx = c.target.x - c.pos.x;
          const dz = c.target.z - c.pos.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.25) {
            c.pauseTimer = 1.6 + Math.random() * 2.4;
          } else {
            moveSpeed = 1.05;
            const nx = c.pos.x + (dx / d) * Math.min(d, moveSpeed * dt);
            const nz = c.pos.z + (dz / d) * Math.min(d, moveSpeed * dt);
            const ny = this.activeDungeonId ? c.pos.y : getSurfaceHeightMeters(this.blocks, nx, nz);
            if (Math.abs(ny - c.pos.y) <= 1.1) {
              c.pos.set(nx, ny, nz);
              c.yaw = Math.atan2(dx, dz);
            } else {
              c.pauseTimer = 1.5;
            }
          }
        }
      }

      // Sync visual transform + playful bobbing / limb swing
      c.rig.root.position.copy(c.pos);
      c.rig.root.rotation.y = c.yaw;
      const hHeight = c.isBoss ? 2.8 : 1.45;
      c.hitbox.position.set(c.pos.x, c.pos.y + hHeight * 0.5, c.pos.z);

      if (c.species === 'slime' || c.species === 'rabbit') {
        const hop = Math.abs(Math.sin(elapsed * (moveSpeed > 0.2 ? 6.5 : 2.8) + c.rig.phase));
        c.rig.bodyGroup.position.y = hop * (moveSpeed > 0.2 ? 0.28 : 0.08);
      } else {
        const swing = moveSpeed > 0.15 ? Math.sin(elapsed * 8.5 + c.rig.phase) * 0.45 : 0;
        c.rig.limbs.forEach((limb, idx) => {
          limb.rotation.x = idx % 2 === 0 ? swing : -swing;
        });
      }
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.kind === 'bow') {
        p.vel.y -= 7.5 * dt;
      }
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      if (p.light) p.light.position.copy(p.pos);

      let hit = false;
      // Check creature collision
      for (const c of this.creatures) {
        const rad = c.isBoss ? 1.15 : 0.72;
        const dy = Math.abs(p.pos.y - (c.pos.y + (c.isBoss ? 1.2 : 0.65)));
        if (Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z) < rad && dy < (c.isBoss ? 1.4 : 0.85)) {
          this.damageCreature(c, p.damage, p.kind);
          hit = true;
          break;
        }
      }

      // Check solid block collision
      if (!hit) {
        const gx = Math.floor(p.pos.x / VOXEL_SIZE);
        const gy = Math.floor(p.pos.y / VOXEL_SIZE);
        const gz = Math.floor(p.pos.z / VOXEL_SIZE);
        if (inBounds(gx, gy, gz) && isBlockSolid(getBlock(this.blocks, gx, gy, gz))) {
          hit = true;
        }
      }

      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        if (p.light) this.scene.remove(p.light);
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updateTamedPet(dt: number, elapsed: number): void {
    if (!this.petRig || !this.petSpec) return;
    const goalX = this.playerPos.x + Math.cos(this.playerYaw) * 1.4;
    const goalZ = this.playerPos.z - Math.sin(this.playerYaw) * 1.4;
    const dx = goalX - this.petPos.x;
    const dz = goalZ - this.petPos.z;
    const dist = Math.hypot(dx, dz);

    if (dist > 7.5) {
      this.petPos.set(goalX, this.playerPos.y, goalZ);
    } else if (dist > 0.65) {
      const speed = Math.min(5.5, dist * 2.2);
      this.petPos.x += (dx / dist) * speed * dt;
      this.petPos.z += (dz / dist) * speed * dt;
      this.petRig.root.rotation.y = Math.atan2(dx, dz);
      const swing = Math.sin(elapsed * 9) * 0.45;
      this.petRig.limbs.forEach((l, i) => {
        l.rotation.x = i % 2 === 0 ? swing : -swing;
      });
    }
    this.petPos.y = this.activeDungeonId
      ? this.playerPos.y
      : getSurfaceHeightMeters(this.blocks, this.petPos.x, this.petPos.z);
    this.petRig.root.position.copy(this.petPos);
  }

  private emitCreatureTarget(c: CreatureRuntime | null): void {
    if (!c) {
      if (this.lastTargetCreatureId !== null) {
        this.lastTargetCreatureId = null;
        this.callbacks.onCreatureTargetChange(null);
      }
      return;
    }
    this.lastTargetCreatureId = c.id;
    this.callbacks.onCreatureTargetChange({
      id: c.id,
      name: c.name,
      species: c.species,
      level: c.level,
      hp: Math.max(0, c.hp),
      maxHp: c.maxHp,
      hostile: c.hostile,
      tameable: c.tameable,
      isBoss: c.isBoss,
    });
  }

  private updateHoverAndPrompts(): void {
    if (this.showcaseMode || this.paused) {
      this.hoverWireframe.visible = false;
      return;
    }

    // Voxel hover wireframe
    const { origin, dir } = this.getCurrentAimRay();
    const reach = this.worldMode === 'create' ? 18 : 5.5;
    this.hoverHit = this.raycastVoxel(origin, dir, reach);
    if (this.hoverHit) {
      this.hoverWireframe.visible = true;
      this.hoverWireframe.position.set(
        (this.hoverHit.bx + 0.5) * VOXEL_SIZE,
        (this.hoverHit.by + 0.5) * VOXEL_SIZE,
        (this.hoverHit.bz + 0.5) * VOXEL_SIZE,
      );
    } else {
      this.hoverWireframe.visible = false;
    }

    if (this.worldMode !== 'play') {
      if (this.lastInteractPrompt !== null) {
        this.lastInteractPrompt = null;
        this.callbacks.onInteractPromptChange(null);
      }
      this.emitCreatureTarget(null);
      return;
    }

    // Center-aim creature target HUD
    const centerHit = this.raycastInteractiveAtNdc(0, 0);
    if (centerHit && centerHit.object.userData?.interactType === 'creature') {
      const cr = this.creatures.find((c) => c.id === centerHit.object.userData.creatureId) ?? null;
      this.emitCreatureTarget(cr);
    } else {
      // Fallback: show nearest boss or hostile within 5m
      const nearBoss = this.creatures.find((c) => c.isBoss && c.pos.distanceTo(this.playerPos) < 11);
      if (nearBoss) this.emitCreatureTarget(nearBoss);
      else this.emitCreatureTarget(null);
    }

    // Proximity interact prompt ([E] Talk to Sera / Open Chest / Enter Sunken Crypt)
    let prompt: string | null = null;
    for (const g of this.graves) {
      if (g.prop.root.position.distanceTo(this.playerPos) < 3.4) {
        prompt = '[E] Recover Dropped Gear';
        break;
      }
    }
    if (!prompt) {
      for (const ch of this.chests) {
        if (!ch.def.opened && ch.prop.root.position.distanceTo(this.playerPos) < 3.4) {
          prompt = `[E] Open ${ch.def.rarity} Loot Chest`;
          break;
        }
      }
    }
    if (!prompt) {
      for (const npc of this.npcs) {
        if (npc.pos.distanceTo(this.playerPos) < 3.8) {
          prompt = `[E] Talk to ${npc.def.name} (${npc.def.role})`;
          break;
        }
      }
    }
    if (!prompt) {
      for (const p of this.portals) {
        if (p.prop.root.position.distanceTo(this.playerPos) < 3.8) {
          prompt = `[E] ${p.def.label}`;
          break;
        }
      }
    }
    if (prompt !== this.lastInteractPrompt) {
      this.lastInteractPrompt = prompt;
      this.callbacks.onInteractPromptChange(prompt);
    }
  }

  /* ============================================================================
   * Render Loop (Software-WebGL afterDraw Pacing)
   * ============================================================================ */

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || typeof gl.fenceSync !== 'function') {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private startLoop(): void {
    this.timer.connect(document);
    this.timer.reset();
    const tick = () => {
      if (this.disposed) return;
      this.timer.update();
      const dt = Math.min(this.timer.getDelta(), 0.08);
      const elapsed = this.timer.getElapsed();

      // Drift clouds & low valley mist sheets
      for (const child of this.cloudsGroup.children) {
        child.position.x += dt * 0.32;
        if (child.position.x > 46) child.position.x = -12;
      }

      if (this.mistGroup.visible) {
        const mistOpacity = 0.2 + this.skySystem.getNightFactor() * 0.14;
        this.mistMat.opacity = mistOpacity;
        if (this.scene.fog instanceof THREE.FogExp2) {
          this.mistMat.color.copy(this.scene.fog.color).lerp(new THREE.Color('#E6DFD0'), 0.28);
        }
        for (const sheet of this.mistGroup.children) {
          const ud = sheet.userData as { baseX: number; phase: number; speed: number };
          sheet.position.x = ud.baseX + Math.sin(elapsed * ud.speed + ud.phase) * 2.6;
          sheet.rotation.z = elapsed * 0.03 * (ud.phase % 2 > 1 ? 1 : -1);
        }
      }

      // Shimmering volumetric god rays slanted along the low golden sun (fade cleanly at night)
      if (this.godRaysGroup.visible) {
        const dayFactor = this.skySystem.getDaylightFactor();
        this.godRayMat.opacity = Math.max(0, dayFactor * 0.15 * (0.85 + Math.sin(elapsed * 0.9) * 0.15));
        this.skySystem.getSunDirection(_tmpVec);
        const tiltZ = THREE.MathUtils.clamp(-_tmpVec.x * 0.55, -0.55, 0.55);
        for (const beam of this.godRaysGroup.children) {
          beam.rotation.z = tiltZ;
        }
      }

      // Subtle campfire flame flicker in Elderglen square
      if (this.foliage && this.foliage.campfireFlames.length > 0) {
        for (let i = 0; i < this.foliage.campfireFlames.length; i++) {
          const f = this.foliage.campfireFlames[i];
          const s = 0.88 + Math.sin(elapsed * 12 + i * 2.3) * 0.14;
          f.scale.set(0.92 + Math.cos(elapsed * 9 + i) * 0.08, s, 0.92 + Math.sin(elapsed * 10 + i) * 0.08);
        }
      }

      // Dynamic Skybox
      const timeUpdate = this.skySystem.update(dt);
      if (timeUpdate) {
        this.callbacks.onTimeOfDayChange(timeUpdate);
      }

      this.updateDynamicLights(elapsed);
      this.updateNpcs(dt);
      this.updatePortalsAndProps(dt, elapsed);
      this.updateCreatures(dt, elapsed);
      this.updateProjectiles(dt);
      this.updateTamedPet(dt, elapsed);
      this.updateNightSpawns(dt);

      if (this.showcaseMode) {
        this.showcaseAngle += dt * 0.11;
        const r = 17.5;
        const cx = 16;
        const cz = 16;
        this.camera.position.set(
          cx + Math.cos(this.showcaseAngle) * r,
          11.2 + Math.sin(this.showcaseAngle * 0.7) * 1.1,
          cz + Math.sin(this.showcaseAngle) * r,
        );
        this.camera.lookAt(cx, 4.8, cz);
      } else if (!this.paused) {
        this.updatePlayer(dt);
        this.updateHoverAndPrompts();
      }

      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }

      if (this.isSoftwareGl) {
        this.afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    if (this.isSoftwareGl) {
      this.frameId = requestAnimationFrame(tick);
    } else {
      this.frameId = requestAnimationFrame(tick);
    }
  }

  /* ============================================================================
   * DOM Events
   * ============================================================================ */

  private onResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = Math.max(1, this.container.clientHeight || window.innerHeight);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    if (this.composer) {
      this.composer.setSize(w, h);
    }
    if (this.bloomPass) {
      this.bloomPass.setSize(w, h);
    }
  };

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.showcaseMode || this.paused) return;
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    this.keys.add(e.code);

    if (e.code === 'Space') {
      e.preventDefault();
    }

    // Block hotkeys
    const blockByCode = BLOCK_BY_KEYCODE[e.code];
    if (blockByCode) {
      this.setSelectedBlock(blockByCode.id);
      this.callbacks.onSelectedBlockChange(blockByCode.id);
      return;
    }

    if (e.code === 'KeyV') {
      const next: CameraViewMode = this.cameraView === 'first-person' ? 'third-person' : 'first-person';
      this.setCameraView(next);
      this.callbacks.onCameraViewChange(next);
      return;
    }

    if (e.code === 'KeyM' || e.code === 'Tab') {
      e.preventDefault();
      this.exitPointerLock();
      this.callbacks.onToggleMap();
      return;
    }

    if (e.code === 'KeyE') {
      this.interactNearest();
      return;
    }

    if (this.worldMode === 'play') {
      if (e.code === 'KeyR') {
        this.callbacks.onSkillHotkey('bow');
        return;
      }
      if (e.code === 'KeyG') {
        this.callbacks.onSkillHotkey('firebolt');
        return;
      }
      if (e.code === 'KeyC') {
        this.callbacks.onSkillHotkey('mend');
        return;
      }
      if (e.code === 'KeyY') {
        this.callbacks.onSkillHotkey('tame');
        return;
      }
      if (e.code === 'KeyI') {
        this.callbacks.onSkillHotkey('inspect');
        return;
      }
    }

    if (e.code === 'KeyT') {
      this.cycleTimeOfDay();
      return;
    }

    if (e.code === 'KeyZ' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) this.redo();
      else this.undo();
      return;
    }

    if (e.code === 'KeyF' && this.worldMode === 'play') {
      this.performPlayPlace();
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.callbacks.onPointerLockChange(this.pointerLocked);
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.showcaseMode || this.paused) return;
    const sensitivity = 0.0024;
    if (this.pointerLocked) {
      this.playerYaw -= e.movementX * sensitivity;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - e.movementY * sensitivity,
        -Math.PI / 2 + 0.06,
        Math.PI / 2 - 0.06,
      );
      return;
    }
    if (this.isDraggingLook) {
      const dx = e.clientX - this.lastPointerX;
      const dy = e.clientY - this.lastPointerY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.dragMoved = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      this.playerYaw -= dx * sensitivity * 1.45;
      this.playerPitch = THREE.MathUtils.clamp(
        this.playerPitch - dy * sensitivity * 1.45,
        -Math.PI / 2 + 0.06,
        Math.PI / 2 - 0.06,
      );
    }
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.showcaseMode || this.paused) return;
    if (e.target !== this.renderer.domElement) return;

    if (e.pointerType === 'touch') {
      this.isDraggingLook = true;
      this.dragMoved = false;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      if (this.worldMode === 'create') this.performCreateAction(true);
      else this.performPlayPlace();
      return;
    }

    if (e.button === 0) {
      if (this.pointerLocked) {
        if (this.worldMode === 'create') this.performCreateAction(false);
        else this.performPlayPrimary();
      } else {
        this.isDraggingLook = true;
        this.dragMoved = false;
        this.lastPointerX = e.clientX;
        this.lastPointerY = e.clientY;
      }
    }
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (this.showcaseMode || this.paused) return;
    if (this.isDraggingLook) {
      const wasClick = !this.dragMoved && e.target === this.renderer.domElement;
      this.isDraggingLook = false;
      if (wasClick) {
        if (this.worldMode === 'create') {
          this.performCreateAction(false);
        } else {
          this.performPlayPrimary(e.clientX, e.clientY);
        }
      }
    }
  };

  private onContextMenu = (e: MouseEvent): void => {
    if (e.target === this.renderer.domElement) e.preventDefault();
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.callbacks.onWebglContextLost(true);
  };

  private onContextRestored = (): void => {
    this.callbacks.onWebglContextLost(false);
    this.rebuildAllChunks();
  };

  private bindEvents(): void {
    window.addEventListener('resize', this.onResize);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('pointerup', this.onPointerUp);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    const el = this.renderer.domElement;
    el.addEventListener('pointerdown', this.onPointerDown);
    el.addEventListener('contextmenu', this.onContextMenu);
    el.addEventListener('webglcontextlost', this.onContextLost);
    el.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private unbindEvents(): void {
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    const el = this.renderer.domElement;
    el.removeEventListener('pointerdown', this.onPointerDown);
    el.removeEventListener('contextmenu', this.onContextMenu);
    el.removeEventListener('webglcontextlost', this.onContextLost);
    el.removeEventListener('webglcontextrestored', this.onContextRestored);
  }
}
