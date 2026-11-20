/**
 * Core domain types for Gate Haven — Voxel RPG & Creative Sandbox.
 * Organized cleanly so real multiplayer, accounts, and AI NPCs can attach in v2.
 */

export const WORLD_SIZE_X = 64;
export const WORLD_SIZE_Y = 32;
export const WORLD_SIZE_Z = 64;
export const CHUNK_SIZE = 16;
/** Half-size fine voxels (0.5m per voxel) for higher architectural detail */
export const VOXEL_SIZE = 0.5;

export enum BlockId {
  Air = 0,
  Grass = 1,
  Dirt = 2,
  Stone = 3,
  Wood = 4,
  Leaves = 5,
  Sand = 6,
  Water = 7,
  Glass = 8,
  Brick = 9,
  Obsidian = 10,
  DiamondOre = 11,
  GoldOre = 12,
  Lava = 13,
  Bookshelf = 14,
  Stairs = 15,
  Slope = 16,
  HalfSlab = 17,
  Fence = 18,
  Lantern = 19,
  Banner = 20,
}

export type PlaceableBlockId = Exclude<BlockId, BlockId.Air>;
export type BlockShape = 'cube' | 'stairs' | 'slope' | 'slab' | 'fence' | 'lantern' | 'banner';

export type TimePhase = 'Dawn' | 'Day' | 'Sunset' | 'Night';

export interface TimeOfDayState {
  cycle: number;
  phase: TimePhase;
  paused: boolean;
}

export type AppScreen = 'home' | 'world';
export type WorldMode = 'play' | 'create';
export type CameraViewMode = 'first-person' | 'third-person';
export type EditorTool = 'paint' | 'erase' | 'fill';
export type BrushSize = 1 | 3;

export type WorldTemplateId = 'village' | 'hills' | 'obby' | 'flat';
export type RealmId = 'home' | 'desert' | 'ice' | 'sky' | 'dark';
export type DungeonId =
  | 'sunken_crypt'
  | 'ember_mines'
  | 'frostspire'
  | 'sunscorched_tomb'
  | 'cloud_citadel'
  | 'abyssal_sanctum';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type ShirtStyle = 'classic' | 'striped' | 'overalls' | 'hoodie';
export type HatStyle = 'none' | 'cap' | 'sunhat' | 'crown' | 'wizard' | 'beanie';

export interface AvatarConfig {
  displayName: string;
  bodyColor: string;
  shirtColor: string;
  shirtStyle: ShirtStyle;
  pantsColor: string;
  hat: HatStyle;
  hatColor: string;
}

/* ============================================================================
 * Voxel RPG Types: Classes, Skills, Quests, Gear, Creatures, Dungeons, Portals
 * ============================================================================ */

export type CharacterClassId =
  | 'unawakened'
  | 'warrior'
  | 'mage'
  | 'ranger'
  | 'rogue'
  | 'cleric'
  | 'artificer'
  | 'tamer';

export type GearRarity = 'Common' | 'Uncommon' | 'Rare' | 'Epic' | 'Legendary';
export type GearSlot = 'weapon' | 'armor' | 'accessory';
export type WeaponKind = 'melee' | 'bow' | 'magic' | 'tool';

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  weaponKind?: WeaponKind;
  rarity: GearRarity;
  attack: number;
  defense: number;
  bonusHp: number;
  durability: number;
  maxDurability: number;
  soulbound: boolean;
  value: number;
}

export interface LearnedSkill {
  id: string;
  name: string;
  description: string;
  teacherNpcId: string;
  category: 'combat' | 'magic' | 'ranged' | 'craft' | 'survival' | 'tame';
  level: number;
  xp: number;
  maxXp: number;
}

export interface PlaystyleStats {
  meleeHits: number;
  magicCasts: number;
  bowShots: number;
  stealthCrits: number;
  healsDone: number;
  craftsAndBuilds: number;
  tamesAndAnimals: number;
}

export type QuestKind = 'fetch' | 'hunt' | 'escort' | 'dungeon';

export interface QuestDefinition {
  id: string;
  title: string;
  kind: QuestKind;
  giverName: string;
  description: string;
  minLevel: number;
  targetKey: string; // e.g. 'wood', 'wolf', 'slime', 'escort_trail', 'sunken_crypt'
  targetCount: number;
  rewardXp: number;
  rewardGold: number;
  rewardRarity?: GearRarity;
}

export interface ActiveQuestState {
  questId: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

export interface ResourceBag {
  wood: number;
  stone: number;
  ore: number;
  meat: number;
  hide: number;
}

export interface DroppedGrave {
  id: string;
  realmId: RealmId;
  position: Vec3;
  items: GearItem[];
  createdAt: number;
  stolenByCreatureId?: string;
}

export interface TamedPet {
  species: 'deer' | 'rabbit' | 'wolf' | 'boar';
  name: string;
  level: number;
}

export interface RpgPlayerState {
  rebirthCompleted: boolean;
  level: number;
  xp: number;
  xpToNext: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  hunger: number;
  maxHunger: number;
  gold: number;
  playerClass: CharacterClassId;
  classChoicePending: boolean;
  pvpEnabled: boolean;
  deaths: number;
  homeSpawn: Vec3;
  homeRealm: RealmId;
  activeRealm: RealmId;
  activeDungeon: DungeonId | null;
  clearedDungeons: DungeonId[];
  skills: LearnedSkill[];
  playstyle: PlaystyleStats;
  resources: ResourceBag;
  equipped: {
    weapon: GearItem | null;
    armor: GearItem | null;
    accessory: GearItem | null;
  };
  inventory: GearItem[];
  /** Non-soulbound gear stored per world when crossing portals */
  worldChests: Record<RealmId, GearItem[]>;
  graves: DroppedGrave[];
  quests: ActiveQuestState[];
  tamedPet: TamedPet | null;
  /** Consumable scrolls that reveal an entire dark dungeon map */
  dungeonMapScrolls: number;
}

export interface SystemNotice {
  id: string;
  title: string;
  body: string;
  tone: 'system' | 'level' | 'quest' | 'warning' | 'death';
}

export interface NpcDialogueBranch {
  label: string;
  response: string;
  action?:
    | 'teach_skill'
    | 'open_quests'
    | 'open_shrine'
    | 'repair_gear'
    | 'open_craft'
    | 'buy_dungeon_map';
  skillId?: string;
}

export interface NpcDefinition {
  id: string;
  name: string;
  role: string;
  personality: string;
  backstory: string;
  greeting: string;
  dialogue: string[];
  branches: NpcDialogueBranch[];
  teachableSkillIds: string[];
  home: Vec3;
  wanderRadius: number;
  avatar: AvatarConfig;
}

export type CreatureSpecies =
  | 'deer'
  | 'rabbit'
  | 'boar'
  | 'wolf'
  | 'slime'
  | 'skeleton'
  | 'goblin'
  | 'boss';

export interface CreatureHudTarget {
  id: string;
  name: string;
  species: CreatureSpecies;
  level: number;
  hp: number;
  maxHp: number;
  hostile: boolean;
  tameable: boolean;
  isBoss: boolean;
}

export type InspectTargetKind = 'creature' | 'npc' | 'portal' | 'chest' | 'grave' | 'block';

export interface InspectResult {
  targetKey: string;
  kind: InspectTargetKind;
  title: string;
  subtitle: string;
  accentColor: string;
  distanceMeters: number;
  inspectLevel: number;
  hp?: number;
  maxHp?: number;
  stats: Array<{ label: string; value: string }>;
  notes: string;
  tip?: string;
}

export interface UiPrefs {
  showOverheadLabels: boolean;
}

export interface WorldPortalPoint {
  id: string;
  kind: 'realm' | 'dungeon' | 'shrine' | 'quest_board' | 'dungeon_exit' | 'map_pedestal';
  label: string;
  subtitle: string;
  targetId: RealmId | DungeonId | 'home';
  position: Vec3;
  color: string;
  minLevel?: number;
}

export interface LootChestPoint {
  id: string;
  position: Vec3;
  opened: boolean;
  rarity: GearRarity;
}

export interface DungeonRoomMeta {
  id: string;
  label: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  kind: 'entrance' | 'hall' | 'alcove' | 'map_room' | 'boss';
}

export interface MinimapSnapshot {
  playerX: number;
  playerZ: number;
  playerYaw: number;
  isDungeon: boolean;
  dungeonId: DungeonId | null;
  realmId: RealmId;
  dungeonRevealed: boolean;
  exploredGrid: Uint8Array;
  exploredPercent: number;
  terrainVersion: number;
  blocks: Uint8Array;
  portals: Array<{
    id: string;
    kind: WorldPortalPoint['kind'];
    label: string;
    x: number;
    z: number;
    color: string;
  }>;
  npcs: Array<{ id: string; name: string; x: number; z: number }>;
  chests: Array<{ id: string; x: number; z: number; rarity: GearRarity; opened: boolean }>;
  graves: Array<{ id: string; x: number; z: number }>;
  creatures: Array<{
    id: string;
    name: string;
    species: CreatureSpecies;
    x: number;
    z: number;
    hostile: boolean;
    isBoss: boolean;
  }>;
  trapCoords: Array<[number, number]>;
  rooms: DungeonRoomMeta[];
}

export interface SavedWorldMeta {
  id: string;
  name: string;
  template: WorldTemplateId;
  createdAt: number;
  updatedAt: number;
  blockCount: number;
  notes: string;
}

export interface SavedWorldRecord extends SavedWorldMeta {
  rleBlocks: number[];
  spawn: Vec3;
  npcs: NpcDefinition[];
}

export interface VoxelChange {
  idx: number;
  prev: BlockId;
  next: BlockId;
}

export interface SafetyReportStub {
  id: string;
  type: 'report' | 'block';
  targetLabel: string;
  reason: string;
  createdAt: number;
}

/* ============================================================================
 * V2 EXTENSION INTERFACES (Intentionally unused in v1 — ready for future hooks)
 * ============================================================================ */

export interface RemotePlayerState {
  playerId: string;
  avatar: AvatarConfig;
  position: Vec3;
  yaw: number;
  pitch: number;
}

export interface MultiplayerAdapter {
  connect(roomId: string, localAvatar: AvatarConfig): Promise<void>;
  disconnect(): void;
  broadcastVoxelChanges(changes: VoxelChange[]): void;
  broadcastPlayerTransform(pos: Vec3, yaw: number, pitch: number): void;
  onRemoteVoxelChanges(cb: (changes: VoxelChange[]) => void): () => void;
  onRemotePlayersUpdate(cb: (players: RemotePlayerState[]) => void): () => void;
}

export interface AccountProfile {
  uid: string;
  displayName: string;
  isMinorSafeMode: boolean;
  avatar: AvatarConfig;
}

export interface AccountProvider {
  getCurrentUser(): Promise<AccountProfile | null>;
  signIn(): Promise<AccountProfile>;
  signOut(): Promise<void>;
}

export interface NpcBrainAdapter {
  getNextLine(npc: NpcDefinition, playerName: string, turnIndex: number): Promise<string>;
}
