import {
  BlockId,
  CreatureSpecies,
  DungeonId,
  DungeonRoomMeta,
  GearRarity,
  LootChestPoint,
  NpcDefinition,
  RealmId,
  Vec3,
  VOXEL_SIZE,
  WORLD_SIZE_X,
  WORLD_SIZE_Y,
  WORLD_SIZE_Z,
  WorldPortalPoint,
  WorldTemplateId,
} from '../types/blockhaven';
import { isBlockSolid } from './blocks';
import { createHomeWorldNpcs, DUNGEON_BY_ID, REALM_BY_ID } from '../rpg/rpgData';
import { TreePropSpec } from './treeBuilder';

export type { TreePropSpec };

export interface CreatureSpawnSpec {
  species: CreatureSpecies;
  name: string;
  level: number;
  hostile: boolean;
  tameable: boolean;
  isBoss: boolean;
  position: Vec3;
  accentColor?: string;
}

export interface BoulderPropSpec {
  x: number;
  y: number;
  z: number;
  scale: number;
  seed: number;
}

export interface GeneratedWorld {
  blocks: Uint8Array;
  /** World-space spawn position in meters */
  spawn: Vec3;
  npcs: NpcDefinition[];
  portals: WorldPortalPoint[];
  creatures: CreatureSpawnSpec[];
  chests: LootChestPoint[];
  trapCoords: Array<[number, number, number]>;
  dungeonRooms?: DungeonRoomMeta[];
  trees?: TreePropSpec[];
  boulders?: BoulderPropSpec[];
  campfirePos?: Vec3 | null;
  template: WorldTemplateId;
  realmId: RealmId;
  dungeonId: DungeonId | null;
  suggestedName: string;
}

export interface TemplateMetadata {
  id: WorldTemplateId;
  name: string;
  tagline: string;
  description: string;
  accentColor: string;
}

export const WORLD_TEMPLATES: TemplateMetadata[] = [
  {
    id: 'village',
    name: 'Elderglen Village',
    tagline: 'Awakening Shrine, NPCs, forest, river, cave & portals',
    description: 'The full Voxel RPG home world with fine-block cottages, 5 skill teachers, quest board, dungeons, and portals.',
    accentColor: '#10B981',
  },
  {
    id: 'hills',
    name: 'Hills & Trees',
    tagline: 'Rolling meadows, tall trees, ore ridge & lava pool',
    description: 'A scenic 64x64 fine-block landscape ideal for cabins, treehouses, and hillside forts.',
    accentColor: '#4A9C48',
  },
  {
    id: 'obby',
    name: 'Sky Obby',
    tagline: 'Fine-block jumps, glass bridges, and summit tower',
    description: 'Hop across timber stairs, obsidian checkpoints, and glass walkways to reach the gazebo.',
    accentColor: '#D97706',
  },
  {
    id: 'flat',
    name: 'Flat Creative',
    tagline: 'Wide open sunlit meadow for detailed fine builds',
    description: 'A level 64x64 fine-block canvas with a carved stone pad—ideal for castles, slopes, and lanterns.',
    accentColor: '#2563EB',
  },
];

export const TOTAL_VOXELS = WORLD_SIZE_X * WORLD_SIZE_Y * WORLD_SIZE_Z;

export function inBounds(x: number, y: number, z: number): boolean {
  return x >= 0 && x < WORLD_SIZE_X && y >= 0 && y < WORLD_SIZE_Y && z >= 0 && z < WORLD_SIZE_Z;
}

export function voxelIndex(x: number, y: number, z: number): number {
  return (y * WORLD_SIZE_Z + z) * WORLD_SIZE_X + x;
}

export function getBlock(blocks: Uint8Array, x: number, y: number, z: number): BlockId {
  if (!inBounds(x, y, z)) return BlockId.Air;
  return blocks[voxelIndex(x, y, z)] as BlockId;
}

export function setBlock(blocks: Uint8Array, x: number, y: number, z: number, id: BlockId): void {
  if (!inBounds(x, y, z)) return;
  blocks[voxelIndex(x, y, z)] = id;
}

/** Returns ground height in WORLD METERS at world coordinate (wx, wz) */
export function getSurfaceHeightMeters(blocks: Uint8Array, wx: number, wz: number): number {
  const gx = Math.max(0, Math.min(WORLD_SIZE_X - 1, Math.floor(wx / VOXEL_SIZE)));
  const gz = Math.max(0, Math.min(WORLD_SIZE_Z - 1, Math.floor(wz / VOXEL_SIZE)));
  for (let y = WORLD_SIZE_Y - 1; y >= 0; y--) {
    const id = blocks[voxelIndex(gx, y, gz)] as BlockId;
    if (isBlockSolid(id)) {
      return (y + 1) * VOXEL_SIZE;
    }
  }
  return 2 * VOXEL_SIZE;
}

/** Returns ground height in VOXEL UNITS at grid coordinate (gx, gz) */
export function getSurfaceHeightVoxel(blocks: Uint8Array, gx: number, gz: number): number {
  const cx = Math.max(0, Math.min(WORLD_SIZE_X - 1, Math.floor(gx)));
  const cz = Math.max(0, Math.min(WORLD_SIZE_Z - 1, Math.floor(gz)));
  for (let y = WORLD_SIZE_Y - 1; y >= 0; y--) {
    const id = blocks[voxelIndex(cx, y, cz)] as BlockId;
    if (isBlockSolid(id)) return y + 1;
  }
  return 2;
}

export function countSolidBlocks(blocks: Uint8Array): number {
  let count = 0;
  for (let i = 0; i < blocks.length; i++) {
    if (blocks[i] !== BlockId.Air) count++;
  }
  return count;
}

function hash2d(ix: number, iz: number, seed: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function smoothNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uz = fz * fz * (3 - 2 * fz);

  const a = hash2d(ix, iz, seed);
  const b = hash2d(ix + 1, iz, seed);
  const c = hash2d(ix, iz + 1, seed);
  const d = hash2d(ix + 1, iz + 1, seed);

  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

function fbm(x: number, z: number, seed: number): number {
  return (
    smoothNoise(x * 0.065, z * 0.065, seed) * 0.62 +
    smoothNoise(x * 0.14, z * 0.14, seed + 17) * 0.28 +
    smoothNoise(x * 0.28, z * 0.28, seed + 31) * 0.1
  );
}

function fillBox(
  blocks: Uint8Array,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  id: BlockId,
) {
  for (let y = y0; y <= y1; y++) {
    for (let z = z0; z <= z1; z++) {
      for (let x = x0; x <= x1; x++) {
        setBlock(blocks, x, y, z, id);
      }
    }
  }
}

function placeNordicTree(
  blocks: Uint8Array,
  trees: TreePropSpec[],
  tx: number,
  baseY: number,
  tz: number,
  kind: 'pine' | 'oak' | 'birch',
  scale = 1.0,
) {
  if (baseY + 3 >= WORLD_SIZE_Y) return;
  // Leave a 2-voxel harvestable timber base so wood gathering works seamlessly
  setBlock(blocks, tx, baseY, tz, BlockId.Wood);
  setBlock(blocks, tx, baseY + 1, tz, BlockId.Wood);
  trees.push({
    x: (tx + 0.5) * VOXEL_SIZE,
    y: baseY * VOXEL_SIZE,
    z: (tz + 0.5) * VOXEL_SIZE,
    kind,
    scale,
    seed: Math.imul(tx + 17, 73856093) ^ Math.imul(tz + 31, 19349663),
  });
}

/**
 * Smooths natural stair-step voxel hills into rolling Valheim terrain by placing
 * auto-oriented Slope wedges along 1-voxel natural elevation transitions.
 */
function applyTerrainSlopes(
  blocks: Uint8Array,
  isProtected?: (x: number, z: number) => boolean,
) {
  const isNatural = (id: BlockId) =>
    id === BlockId.Grass ||
    id === BlockId.Dirt ||
    id === BlockId.Stone ||
    id === BlockId.Sand ||
    id === BlockId.Obsidian;

  const toSlope: Array<[number, number, number]> = [];

  for (let z = 2; z < WORLD_SIZE_Z - 2; z++) {
    for (let x = 2; x < WORLD_SIZE_X - 2; x++) {
      if (isProtected && isProtected(x, z)) continue;
      const topY = getSurfaceHeightVoxel(blocks, x, z) - 1;
      if (topY < 3 || topY >= WORLD_SIZE_Y - 3) continue;
      const topId = getBlock(blocks, x, topY, z);
      if (!isNatural(topId)) continue;
      if (getBlock(blocks, x, topY + 1, z) !== BlockId.Air) continue;

      // Count how many cardinal neighbors are 1 voxel higher (natural terrain)
      let higherCount = 0;
      const dirs: Array<[number, number]> = [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ];
      for (const [dx, dz] of dirs) {
        const nb = getBlock(blocks, x + dx, topY + 1, z + dz);
        const nbAbove = getBlock(blocks, x + dx, topY + 2, z + dz);
        if (isNatural(nb) && nbAbove === BlockId.Air) {
          higherCount++;
        }
      }
      if (higherCount >= 1 && higherCount <= 2) {
        toSlope.push([x, topY + 1, z]);
      }
    }
  }

  for (const [sx, sy, sz] of toSlope) {
    if (getBlock(blocks, sx, sy, sz) === BlockId.Air) {
      setBlock(blocks, sx, sy, sz, BlockId.Slope);
    }
  }
}

function buildFineCottage(
  blocks: Uint8Array,
  ox: number,
  baseY: number,
  oz: number,
  w: number,
  d: number,
  wallBlock: BlockId,
  doorSide: 'south' | 'north' | 'east' | 'west',
) {
  fillBox(blocks, ox, baseY - 2, oz, ox + w - 1, baseY - 1, oz + d - 1, BlockId.Stone);
  fillBox(blocks, ox, baseY, oz, ox + w - 1, baseY + 7, oz + d - 1, BlockId.Air);

  // Fine walls (5 fine voxels high = 2.5m ceiling!)
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        const edgeX = x === 0 || x === w - 1;
        const edgeZ = z === 0 || z === d - 1;
        if (!edgeX && !edgeZ) continue;
        const corner = edgeX && edgeZ;
        setBlock(blocks, ox + x, baseY + y, oz + z, corner ? BlockId.Wood : wallBlock);
      }
    }
  }

  // Fine glass windows & interior bookshelves
  const midX = Math.floor(w / 2);
  const midZ = Math.floor(d / 2);
  setBlock(blocks, ox + midX, baseY + 2, oz, BlockId.Glass);
  setBlock(blocks, ox + midX, baseY + 2, oz + d - 1, BlockId.Glass);
  setBlock(blocks, ox, baseY + 2, oz + midZ, BlockId.Glass);
  setBlock(blocks, ox + w - 1, baseY + 2, oz + midZ, BlockId.Glass);
  setBlock(blocks, ox + 1, baseY, oz + 1, BlockId.Bookshelf);
  setBlock(blocks, ox + 1, baseY + 1, oz + 1, BlockId.Bookshelf);
  setBlock(blocks, ox + w - 2, baseY + 3, oz + midZ, BlockId.Lantern);

  // Doorway (4 fine voxels tall, 2 wide) + front stairs
  if (doorSide === 'south') {
    fillBox(blocks, ox + midX - 1, baseY, oz + d - 1, ox + midX, baseY + 3, oz + d - 1, BlockId.Air);
    setBlock(blocks, ox + midX - 1, baseY, oz + d, BlockId.HalfSlab);
    setBlock(blocks, ox + midX, baseY, oz + d, BlockId.HalfSlab);
    setBlock(blocks, ox + midX + 1, baseY + 2, oz + d, BlockId.Lantern);
  } else if (doorSide === 'north') {
    fillBox(blocks, ox + midX - 1, baseY, oz, ox + midX, baseY + 3, oz, BlockId.Air);
    setBlock(blocks, ox + midX - 1, baseY, oz - 1, BlockId.HalfSlab);
    setBlock(blocks, ox + midX, baseY, oz - 1, BlockId.HalfSlab);
    setBlock(blocks, ox + midX + 1, baseY + 2, oz - 1, BlockId.Lantern);
  } else if (doorSide === 'west') {
    fillBox(blocks, ox, baseY, oz + midZ - 1, ox, baseY + 3, oz + midZ, BlockId.Air);
    setBlock(blocks, ox - 1, baseY, oz + midZ, BlockId.HalfSlab);
    setBlock(blocks, ox - 1, baseY + 2, oz + midZ + 1, BlockId.Lantern);
  } else {
    fillBox(blocks, ox + w - 1, baseY, oz + midZ - 1, ox + w - 1, baseY + 3, oz + midZ, BlockId.Air);
    setBlock(blocks, ox + w, baseY, oz + midZ, BlockId.HalfSlab);
  }

  // Fine pitched roof using Slope & HalfSlab pieces
  const steps = Math.ceil(Math.min(w, d) / 2);
  for (let s = 0; s < steps; s++) {
    const ry = baseY + 5 + s;
    const x0 = ox - 1 + s;
    const x1 = ox + w - s;
    const z0 = oz - 1 + s;
    const z1 = oz + d - s;
    if (x0 > x1 || z0 > z1) break;
    fillBox(blocks, x0, ry, z0, x1, ry, z1, s === steps - 1 ? BlockId.HalfSlab : BlockId.Slope);
  }
}

/* ============================================================================
 * 1. HOME WORLD (Elderglen) — Village, Forest, River, Mountain Cave, Portals
 * ============================================================================ */

function generateHomeWorld(): GeneratedWorld {
  const blocks = new Uint8Array(TOTAL_VOXELS);
  const waterLevel = 5;

  for (let z = 0; z < WORLD_SIZE_Z; z++) {
    for (let x = 0; x < WORLD_SIZE_X; x++) {
      const distVillage = Math.hypot(x - 32, z - 34);
      // Curving river along western/southern valley
      const riverCenterX = 16 + Math.sin(z * 0.14) * 3.5;
      const distRiver = Math.abs(x - riverCenterX);
      // Northern mountain massif (z < 18)
      const mountainFactor = Math.max(0, 1 - z / 20);

      const n = fbm(x, z, 42);
      let h = Math.round(7 + n * 5 + mountainFactor * 9);

      // Smooth village plateau around y = 7
      if (distVillage < 18) {
        const t = Math.max(0, Math.min(1, (distVillage - 12) / 6));
        const st = t * t * (3 - 2 * t);
        h = Math.round(7 * (1 - st) + h * st);
      }

      // Carve crystal river channel
      if (distRiver < 4.2 && z > 12) {
        const rd = Math.max(0, 1 - distRiver / 4.2);
        h = Math.min(h, Math.round(6 - rd * 3.8));
      }

      h = Math.max(2, Math.min(WORLD_SIZE_Y - 7, h));

      for (let y = 0; y <= h; y++) {
        if (y <= 1) setBlock(blocks, x, y, z, BlockId.Stone);
        else if (y < h - 2) setBlock(blocks, x, y, z, BlockId.Stone);
        else if (y < h) setBlock(blocks, x, y, z, BlockId.Dirt);
        else {
          if (h <= waterLevel) setBlock(blocks, x, y, z, BlockId.Sand);
          else if (distRiver < 5.5 && h === waterLevel + 1) setBlock(blocks, x, y, z, BlockId.Sand);
          else if (h >= 15) setBlock(blocks, x, y, z, BlockId.Stone);
          else setBlock(blocks, x, y, z, BlockId.Grass);
        }
      }

      if (h < waterLevel) {
        for (let y = h + 1; y <= waterLevel; y++) {
          setBlock(blocks, x, y, z, BlockId.Water);
        }
      }
    }
  }

  // Carve an explorable Mountain Cave in the northern ridge (x=30..36, z=4..16) with Gold & Diamond Ore!
  fillBox(blocks, 31, 8, 5, 35, 13, 17, BlockId.Air);
  fillBox(blocks, 30, 7, 5, 36, 7, 17, BlockId.Stone);
  setBlock(blocks, 30, 9, 9, BlockId.GoldOre);
  setBlock(blocks, 30, 10, 8, BlockId.DiamondOre);
  setBlock(blocks, 36, 9, 11, BlockId.GoldOre);
  setBlock(blocks, 36, 10, 7, BlockId.DiamondOre);
  setBlock(blocks, 33, 9, 5, BlockId.DiamondOre);
  setBlock(blocks, 31, 8, 15, BlockId.Lantern);
  setBlock(blocks, 35, 8, 15, BlockId.Lantern);
  setBlock(blocks, 33, 8, 7, BlockId.Lantern);

  // Village stone square & fine-block roads at y = 7
  for (let z = 28; z <= 42; z++) {
    for (let x = 24; x <= 42; x++) {
      if (Math.hypot(x - 32, z - 35) <= 8.5) {
        setBlock(blocks, x, 7, z, BlockId.Stone);
      }
    }
  }
  // Roads to river bridge, northern cave, and portal terrace
  fillBox(blocks, 12, 7, 34, 48, 7, 36, BlockId.Stone);
  fillBox(blocks, 31, 7, 18, 33, 7, 48, BlockId.Stone);

  // Fine Timber Footbridge over the Crystal River (x = 11..21, z = 34..36)
  fillBox(blocks, 12, 7, 34, 21, 7, 36, BlockId.Wood);
  for (let x = 12; x <= 21; x++) {
    setBlock(blocks, x, 8, 33, BlockId.Fence);
    setBlock(blocks, x, 8, 37, BlockId.Fence);
  }
  setBlock(blocks, 12, 9, 33, BlockId.Lantern);
  setBlock(blocks, 21, 9, 33, BlockId.Lantern);

  // Village Street Lanterns & Royal Banners lining the square
  for (const [lx, lz] of [
    [28, 31],
    [36, 31],
    [28, 39],
    [36, 39],
  ]) {
    setBlock(blocks, lx, 8, lz, BlockId.Fence);
    setBlock(blocks, lx, 9, lz, BlockId.Lantern);
  }
  setBlock(blocks, 30, 8, 31, BlockId.Banner);
  setBlock(blocks, 34, 8, 31, BlockId.Banner);

  // Three detailed weathered timber, stone & thatch cottages around the square
  buildFineCottage(blocks, 22, 8, 41, 8, 7, BlockId.Wood, 'north');
  buildFineCottage(blocks, 38, 8, 22, 8, 7, BlockId.Stone, 'south');
  buildFineCottage(blocks, 41, 8, 38, 7, 8, BlockId.Wood, 'west');

  // Bram's Obsidian Forge with glowing Lava (x = 43..47, z = 29..33)
  fillBox(blocks, 43, 7, 29, 47, 7, 33, BlockId.Obsidian);
  fillBox(blocks, 44, 8, 30, 46, 8, 32, BlockId.Obsidian);
  setBlock(blocks, 45, 8, 31, BlockId.Lava);
  setBlock(blocks, 46, 8, 28, BlockId.GoldOre);

  // Portal Terrace in the eastern meadow (x = 50..58, z = 22..44)
  fillBox(blocks, 49, 7, 22, 58, 7, 46, BlockId.Stone);
  fillBox(blocks, 49, 8, 22, 58, 12, 46, BlockId.Air);
  setBlock(blocks, 49, 8, 22, BlockId.Lantern);
  setBlock(blocks, 49, 8, 46, BlockId.Lantern);

  // Smooth rolling Valheim slopes across surrounding hills, ridges, and riverbanks
  applyTerrainSlopes(blocks, (x, z) => {
    const inVillageSquare = Math.hypot(x - 32, z - 35) <= 10.5;
    const onRoads = (z >= 33 && z <= 37 && x >= 11 && x <= 49) || (x >= 30 && x <= 34 && z >= 17 && z <= 49);
    const inPortalTerrace = x >= 48 && x <= 59 && z >= 21 && z <= 47;
    const inCave = x >= 29 && x <= 37 && z >= 4 && z <= 18;
    const nearCottages =
      (x >= 20 && x <= 31 && z >= 39 && z <= 49) ||
      (x >= 36 && x <= 47 && z >= 20 && z <= 30) ||
      (x >= 39 && x <= 49 && z >= 36 && z <= 47);
    return inVillageSquare || onRoads || inPortalTerrace || inCave || nearCottages;
  });

  // Procedural low-poly Nordic pines, weathered oaks & silver birches (no cube trees!)
  const treeProps: TreePropSpec[] = [];
  const treeSpecs: Array<[number, number, 'pine' | 'oak' | 'birch', number]> = [
    [6, 18, 'pine', 1.15],
    [9, 25, 'pine', 0.95],
    [6, 32, 'pine', 1.2],
    [8, 44, 'oak', 1.05],
    [13, 52, 'pine', 1.1],
    [22, 55, 'birch', 0.95],
    [34, 54, 'oak', 1.08],
    [45, 53, 'pine', 1.05],
    [54, 52, 'pine', 1.18],
    [21, 22, 'birch', 0.92],
    [10, 12, 'pine', 1.22],
    [52, 14, 'pine', 1.12],
    [4, 24, 'pine', 1.05],
    [5, 40, 'pine', 1.12],
    [10, 49, 'pine', 0.98],
    [26, 56, 'pine', 1.14],
    [40, 56, 'birch', 0.9],
    [57, 48, 'pine', 1.06],
    [44, 15, 'pine', 1.16],
    [18, 14, 'pine', 1.08],
    [25, 19, 'oak', 0.92],
    [56, 19, 'pine', 1.02],
  ];
  for (const [tx, tz, kind, scale] of treeSpecs) {
    const sy = getSurfaceHeightVoxel(blocks, tx, tz);
    const ground = getBlock(blocks, tx, sy - 1, tz);
    if (ground === BlockId.Grass || ground === BlockId.Slope) {
      placeNordicTree(blocks, treeProps, tx, sy, tz, kind, scale);
    }
  }

  // Mossy valley boulders along river shores & ridge slopes
  const boulders: BoulderPropSpec[] = [];
  for (const [bx, bz, sc] of [
    [12, 29, 0.9],
    [21, 30, 0.75],
    [13, 41, 1.05],
    [22, 46, 0.85],
    [26, 22, 0.95],
    [41, 18, 1.1],
    [11, 20, 0.8],
    [48, 50, 0.9],
  ]) {
    boulders.push({
      x: bx * VOXEL_SIZE,
      y: getSurfaceHeightMeters(blocks, bx * VOXEL_SIZE, bz * VOXEL_SIZE),
      z: bz * VOXEL_SIZE,
      scale: sc,
      seed: bx * 97 + bz * 31,
    });
  }

  // Interactive Landmarks, Dungeons, and Dimensional World Portals (world coordinates in meters!)
  const portals: WorldPortalPoint[] = [
    {
      id: 'shrine-home',
      kind: 'shrine',
      label: 'Awakening Shrine',
      subtitle: 'Heal · Soulbind · Set Home',
      targetId: 'home',
      position: { x: 32 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 34.5 * VOXEL_SIZE },
      color: '#38BDF8',
    },
    {
      id: 'quest-board-home',
      kind: 'quest_board',
      label: 'Quest Board',
      subtitle: 'Fetch · Hunt · Escort · Dungeons',
      targetId: 'home',
      position: { x: 27.5 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 38.5 * VOXEL_SIZE },
      color: '#F59E0B',
    },
    {
      id: 'dungeon-crypt',
      kind: 'dungeon',
      label: 'Sunken Crypt',
      subtitle: 'Dungeon · Lv 1–5',
      targetId: 'sunken_crypt',
      position: { x: 33 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 18 * VOXEL_SIZE },
      color: '#22C55E',
      minLevel: 1,
    },
    {
      id: 'dungeon-ember',
      kind: 'dungeon',
      label: 'Ember Mines',
      subtitle: 'Dungeon · Lv 5–10',
      targetId: 'ember_mines',
      position: { x: 46 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 26 * VOXEL_SIZE },
      color: '#F97316',
      minLevel: 5,
    },
    {
      id: 'portal-desert',
      kind: 'realm',
      label: 'Sunscar Desert',
      subtitle: 'Other World · Lv 6–12',
      targetId: 'desert',
      position: { x: 54 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 25 * VOXEL_SIZE },
      color: '#F59E0B',
      minLevel: 6,
    },
    {
      id: 'portal-ice',
      kind: 'realm',
      label: 'Frostveil Tundra',
      subtitle: 'Other World · Lv 10–16',
      targetId: 'ice',
      position: { x: 54 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 31.5 * VOXEL_SIZE },
      color: '#38BDF8',
      minLevel: 10,
    },
    {
      id: 'portal-sky',
      kind: 'realm',
      label: 'Aether Isles',
      subtitle: 'Sky World · Lv 12–18',
      targetId: 'sky',
      position: { x: 54 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 38 * VOXEL_SIZE },
      color: '#A78BFA',
      minLevel: 12,
    },
    {
      id: 'portal-dark',
      kind: 'realm',
      label: 'Shadowreach',
      subtitle: 'Dark World · Lv 16–22',
      targetId: 'dark',
      position: { x: 54 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 44.5 * VOXEL_SIZE },
      color: '#E11D48',
      minLevel: 16,
    },
  ];

  // Wildlife across the Whispering Forest & southern meadows
  const creatures: CreatureSpawnSpec[] = [
    { species: 'deer', name: 'Meadow Deer', level: 1, hostile: false, tameable: true, isBoss: false, position: { x: 5.5, y: 4, z: 14.5 } },
    { species: 'deer', name: 'Forest Stag', level: 2, hostile: false, tameable: true, isBoss: false, position: { x: 6.5, y: 4, z: 23.0 } },
    { species: 'rabbit', name: 'Clover Rabbit', level: 1, hostile: false, tameable: true, isBoss: false, position: { x: 10.5, y: 4, z: 24.5 } },
    { species: 'rabbit', name: 'Snowtail Rabbit', level: 1, hostile: false, tameable: true, isBoss: false, position: { x: 24.0, y: 4, z: 26.5 } },
    { species: 'boar', name: 'Bristle Boar', level: 2, hostile: false, tameable: true, isBoss: false, position: { x: 14.5, y: 4, z: 27.0 } },
    { species: 'wolf', name: 'Ridge Wolf', level: 2, hostile: true, tameable: true, isBoss: false, position: { x: 5.5, y: 4, z: 9.5 } },
    { species: 'wolf', name: 'Timber Wolf', level: 3, hostile: true, tameable: true, isBoss: false, position: { x: 26.5, y: 4, z: 8.5 } },
    { species: 'slime', name: 'Meadow Slime', level: 1, hostile: true, tameable: false, isBoss: false, position: { x: 18.0, y: 4, z: 26.5 } },
  ];

  const chests: LootChestPoint[] = [
    {
      id: 'home-cave-chest',
      position: { x: 33 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 6.5 * VOXEL_SIZE },
      opened: false,
      rarity: 'Uncommon',
    },
  ];

  return {
    blocks,
    spawn: { x: 32 * VOXEL_SIZE, y: 8.2 * VOXEL_SIZE, z: 38.5 * VOXEL_SIZE },
    npcs: createHomeWorldNpcs(),
    portals,
    creatures,
    chests,
    trapCoords: [],
    trees: treeProps,
    boulders,
    campfirePos: { x: 34.5 * VOXEL_SIZE, y: 8 * VOXEL_SIZE, z: 36.2 * VOXEL_SIZE },
    template: 'village',
    realmId: 'home',
    dungeonId: null,
    suggestedName: 'Elderglen (Home World)',
  };
}

/* ============================================================================
 * 2. OTHER WORLDS (Randomly Generated Realms via Portals)
 * ============================================================================ */

export function generateRealmWorld(realmId: RealmId, seed = 101): GeneratedWorld {
  if (realmId === 'home') return generateHomeWorld();

  const meta = REALM_BY_ID[realmId];
  const blocks = new Uint8Array(TOTAL_VOXELS);
  const dungeonId = meta.dungeons[0];
  const dungeonMeta = DUNGEON_BY_ID[dungeonId];

  const treeProps: TreePropSpec[] = [];

  if (realmId === 'sky') {
    // Floating Sky Islands suspended above the clouds!
    const islands: Array<[number, number, number, number, number]> = [
      [32, 14, 32, 10, 4], // Central arrival island
      [16, 16, 22, 8, 3], // NW island
      [48, 17, 22, 8, 3], // NE dungeon island
      [20, 15, 48, 7, 3], // SW meadow island
      [46, 16, 46, 7, 3], // SE treasure island
    ];
    for (const [ix, iy, iz, rad, depth] of islands) {
      for (let dz = -rad; dz <= rad; dz++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const d = Math.hypot(dx, dz);
          if (d > rad) continue;
          const thickness = Math.max(1, Math.round((1 - d / (rad + 1)) * depth));
          for (let dy = 0; dy < thickness; dy++) {
            const mat = dy === 0 ? BlockId.Grass : dy === 1 ? BlockId.Dirt : BlockId.Stone;
            setBlock(blocks, ix + dx, iy - dy, iz + dz, mat);
          }
        }
      }
      placeNordicTree(blocks, treeProps, ix + 2, iy + 1, iz - 2, 'birch', 0.95);
    }
    // Timber & glass sky bridges linking islands
    const bridge = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(z1 - z0));
      for (let i = 0; i <= steps; i++) {
        const t = i / (steps || 1);
        const bx = Math.round(x0 + (x1 - x0) * t);
        const by = Math.round(y0 + (y1 - y0) * t);
        const bz = Math.round(z0 + (z1 - z0) * t);
        fillBox(blocks, bx - 1, by, bz - 1, bx + 1, by, bz + 1, BlockId.Wood);
        if (i % 4 === 0) setBlock(blocks, bx + 1, by + 1, bz, BlockId.Lantern);
      }
    };
    bridge(32, 14, 32, 16, 16, 22);
    bridge(32, 14, 32, 48, 17, 22);
    bridge(32, 14, 32, 20, 15, 48);
    bridge(32, 14, 32, 46, 16, 46);
  } else {
    // Grounded realms: Desert, Ice, Dark
    const waterLevel = 5;
    for (let z = 0; z < WORLD_SIZE_Z; z++) {
      for (let x = 0; x < WORLD_SIZE_X; x++) {
        const n = fbm(x, z, seed);
        const distCenter = Math.hypot(x - 32, z - 32);
        let h = Math.round(6 + n * (realmId === 'dark' ? 11 : 8));
        if (distCenter < 11) h = 7;
        h = Math.max(2, Math.min(WORLD_SIZE_Y - 8, h));

        for (let y = 0; y <= h; y++) {
          if (realmId === 'desert') {
            const top = y === h ? BlockId.Sand : y > h - 3 ? BlockId.Sand : BlockId.Stone;
            setBlock(blocks, x, y, z, top);
          } else if (realmId === 'ice') {
            const top =
              y === h
                ? n > 0.62
                  ? BlockId.Glass
                  : BlockId.HalfSlab
                : y > h - 2
                  ? BlockId.Stone
                  : BlockId.Obsidian;
            setBlock(blocks, x, y, z, y === h && distCenter < 11 ? BlockId.Stone : top);
          } else {
            // Dark world: obsidian crags & ore veins
            const top = y === h ? BlockId.Obsidian : BlockId.Stone;
            setBlock(blocks, x, y, z, top);
          }
        }

        if (realmId === 'desert' && distCenter > 15 && distCenter < 20 && x < 24 && h <= waterLevel + 1) {
          setBlock(blocks, x, waterLevel, z, BlockId.Water);
        }
        if (realmId === 'dark' && Math.abs(x - 20 - Math.sin(z * 0.2) * 3) < 2.2) {
          setBlock(blocks, x, 6, z, BlockId.Lava);
        }
      }
    }

    // Add landmarks per realm
    if (realmId === 'desert') {
      // Sandstone ruin pillars & banners
      for (const [rx, rz] of [[24, 24], [40, 24], [24, 40], [40, 40]]) {
        fillBox(blocks, rx, 8, rz, rx + 1, 13, rz + 1, BlockId.Sand);
        setBlock(blocks, rx, 14, rz, BlockId.Lantern);
      }
      setBlock(blocks, 36, 8, 28, BlockId.GoldOre);
      setBlock(blocks, 37, 8, 28, BlockId.GoldOre);
    } else if (realmId === 'ice') {
      for (const [rx, rz] of [[18, 18], [46, 20], [18, 46], [44, 46]]) {
        fillBox(blocks, rx, 8, rz, rx + 1, 15, rz + 1, BlockId.Glass);
        setBlock(blocks, rx, 16, rz, BlockId.Lantern);
      }
      setBlock(blocks, 26, 8, 26, BlockId.DiamondOre);
      setBlock(blocks, 27, 8, 26, BlockId.DiamondOre);
    } else if (realmId === 'dark') {
      for (const [rx, rz] of [[24, 24], [42, 24], [42, 42]]) {
        fillBox(blocks, rx, 8, rz, rx + 1, 14, rz + 1, BlockId.Obsidian);
        setBlock(blocks, rx, 15, rz, BlockId.Lava);
      }
      setBlock(blocks, 35, 8, 26, BlockId.DiamondOre);
      setBlock(blocks, 36, 8, 26, BlockId.GoldOre);
    }

    // Smooth rolling dune / frost / basalt slopes in grounded realms
    applyTerrainSlopes(blocks, (x, z) => Math.hypot(x - 32, z - 32) < 11.5);
  }

  const centerY = getSurfaceHeightMeters(blocks, 32 * VOXEL_SIZE, 32 * VOXEL_SIZE);
  const dungX = realmId === 'sky' ? 48 * VOXEL_SIZE : 44 * VOXEL_SIZE;
  const dungZ = realmId === 'sky' ? 22 * VOXEL_SIZE : 20 * VOXEL_SIZE;
  const dungY = getSurfaceHeightMeters(blocks, dungX, dungZ);

  const portals: WorldPortalPoint[] = [
    {
      id: `return-home-${realmId}`,
      kind: 'realm',
      label: 'Return to Elderglen',
      subtitle: 'Home World Portal',
      targetId: 'home',
      position: { x: 28 * VOXEL_SIZE, y: centerY, z: 32 * VOXEL_SIZE },
      color: '#10B981',
    },
    {
      id: `dungeon-${dungeonId}`,
      kind: 'dungeon',
      label: dungeonMeta.name,
      subtitle: `Dungeon · Lv ${dungeonMeta.minLevel}–${dungeonMeta.maxLevel}`,
      targetId: dungeonId,
      position: { x: dungX, y: dungY, z: dungZ },
      color: dungeonMeta.portalColor,
      minLevel: dungeonMeta.minLevel,
    },
  ];

  const baseLvl = meta.minLevel;
  const accent =
    realmId === 'ice'
      ? '#38BDF8'
      : realmId === 'desert'
        ? '#F59E0B'
        : realmId === 'dark'
          ? '#E11D48'
          : '#A78BFA';

  const creatures: CreatureSpawnSpec[] = [
    { species: 'slime', name: `${meta.name.split(' ')[0]} Slime`, level: baseLvl, hostile: true, tameable: false, isBoss: false, position: { x: 10, y: 5, z: 12 }, accentColor: accent },
    { species: 'skeleton', name: `${meta.name.split(' ')[0]} Stalker`, level: baseLvl + 1, hostile: true, tameable: false, isBoss: false, position: { x: 22, y: 5, z: 12 } },
    { species: 'goblin', name: `${meta.name.split(' ')[0]} Raider`, level: baseLvl + 2, hostile: true, tameable: false, isBoss: false, position: { x: 21, y: 5, z: 22 } },
    { species: 'wolf', name: `${meta.name.split(' ')[0]} Hound`, level: baseLvl + 1, hostile: true, tameable: true, isBoss: false, position: { x: 10, y: 5, z: 22 }, accentColor: accent },
    { species: 'boar', name: 'Wild Boar', level: baseLvl, hostile: false, tameable: true, isBoss: false, position: { x: 16, y: 5, z: 24 } },
  ];

  const chestX = realmId === 'sky' ? 46 * VOXEL_SIZE : 18 * VOXEL_SIZE;
  const chestZ = realmId === 'sky' ? 46 * VOXEL_SIZE : 44 * VOXEL_SIZE;
  const chestY = getSurfaceHeightMeters(blocks, chestX, chestZ);

  const chests: LootChestPoint[] = [
    {
      id: `realm-chest-${realmId}-${seed}`,
      position: { x: chestX, y: chestY, z: chestZ },
      opened: false,
      rarity: realmId === 'dark' ? 'Epic' : 'Rare',
    },
  ];

  return {
    blocks,
    spawn: { x: 32 * VOXEL_SIZE, y: centerY + 0.5, z: 34 * VOXEL_SIZE },
    npcs: [],
    portals,
    creatures,
    chests,
    trapCoords: [],
    trees: treeProps,
    template: 'hills',
    realmId,
    dungeonId: null,
    suggestedName: meta.name,
  };
}

/* ============================================================================
 * 3. PROCEDURAL DUNGEONS (Rooms, Traps, Loot Chests, Boss Chamber)
 * ============================================================================ */

export function generateDungeonWorld(dungeonId: DungeonId, seed = 77): GeneratedWorld {
  const meta = DUNGEON_BY_ID[dungeonId];
  const blocks = new Uint8Array(TOTAL_VOXELS);

  const wallMat =
    meta.theme === 'ember' || meta.theme === 'abyss'
      ? BlockId.Obsidian
      : meta.theme === 'sand'
        ? BlockId.Sand
        : meta.theme === 'frost'
          ? BlockId.Glass
          : BlockId.Stone;
  const floorMat =
    meta.theme === 'sand'
      ? BlockId.Sand
      : meta.theme === 'ember'
        ? BlockId.Stone
        : meta.theme === 'abyss'
          ? BlockId.Obsidian
          : BlockId.Stone;
  const trimMat =
    meta.theme === 'ember' || meta.theme === 'abyss'
      ? BlockId.Lava
      : meta.theme === 'frost'
        ? BlockId.DiamondOre
        : meta.theme === 'sand'
          ? BlockId.GoldOre
          : BlockId.Brick;

  // Fill solid outer dungeon shell from y = 0..14
  fillBox(blocks, 4, 0, 4, 60, 13, 60, wallMat);

  const carveRoom = (x0: number, z0: number, x1: number, z1: number, ceilY = 9) => {
    fillBox(blocks, x0, 2, z0, x1, ceilY, z1, BlockId.Air);
    fillBox(blocks, x0, 1, z0, x1, 1, z1, floorMat);
  };

  const rooms: DungeonRoomMeta[] = [];
  const trapCoords: Array<[number, number, number]> = [];
  const variant = Math.abs(seed) % 4;
  const mapOnWest = variant % 2 === 0;
  const hasNorthLoop = variant >= 2;

  // Room 1 (Entrance Hall): x=26..38, z=45..55
  carveRoom(26, 45, 38, 55, 10);
  rooms.push({
    id: 'room-entrance',
    label: 'Entrance Hall',
    x0: 26,
    z0: 45,
    x1: 38,
    z1: 55,
    kind: 'entrance',
  });

  // South Corridor 1 -> 2
  carveRoom(30, 37, 34, 45, 8);

  // Room 2 (Central Trap Gallery): x=23..41, z=27..37
  carveRoom(23, 27, 41, 37, 10);
  rooms.push({
    id: 'room-trap-hall',
    label: 'Trap Gallery',
    x0: 23,
    z0: 27,
    x1: 41,
    z1: 37,
    kind: 'hall',
  });

  // Floor Lava / Trap Trenches in Room 2 (with safe center walkway!)
  for (let x = 25; x <= 39; x++) {
    if (x >= 30 && x <= 34) continue;
    setBlock(blocks, x, 1, 32, BlockId.Lava);
    trapCoords.push([x, 1, 32]);
  }

  // Procedural West Wing: Corridor from Entrance or Trap Gallery into West Chamber
  const westZ0 = mapOnWest ? 38 : 26;
  const westZ1 = westZ0 + 10;
  carveRoom(9, westZ0, 19, westZ1, 9);
  if (mapOnWest) {
    // Connects off Entrance Hall west wall + connects up into Trap Gallery
    carveRoom(19, 46, 26, 48, 7);
    carveRoom(13, 31, 15, westZ0, 7);
    carveRoom(13, 31, 23, 33, 7);
  } else {
    // Connects straight from Trap Gallery west wall
    carveRoom(19, 30, 23, 33, 7);
  }
  rooms.push({
    id: 'room-west-wing',
    label: mapOnWest ? 'Cartographer Study' : 'West Treasury',
    x0: 9,
    z0: westZ0,
    x1: 19,
    z1: westZ1,
    kind: mapOnWest ? 'map_room' : 'alcove',
  });

  // Procedural East Wing: Mirror branching wing with randomized offset & loop
  const eastZ0 = mapOnWest ? 26 : 38;
  const eastZ1 = eastZ0 + 10;
  carveRoom(45, eastZ0, 55, eastZ1, 9);
  if (!mapOnWest) {
    carveRoom(38, 46, 45, 48, 7);
    carveRoom(49, 31, 51, eastZ0, 7);
    carveRoom(41, 31, 51, 33, 7);
  } else {
    carveRoom(41, 30, 45, 33, 7);
  }
  rooms.push({
    id: 'room-east-wing',
    label: mapOnWest ? 'East Vault' : 'Cartographer Study',
    x0: 45,
    z0: eastZ0,
    x1: 55,
    z1: eastZ1,
    kind: mapOnWest ? 'alcove' : 'map_room',
  });

  // Optional Upper Side Crypt (adds procedural branching off one flank toward Boss Sanctum)
  const northSideX0 = hasNorthLoop ? 9 : 46;
  const northSideX1 = northSideX0 + 8;
  carveRoom(northSideX0, 13, northSideX1, 21, 9);
  if (hasNorthLoop) {
    // Connect West Wing north -> Upper Crypt -> Boss Sanctum west flank
    carveRoom(12, 21, 15, westZ0, 7);
    carveRoom(17, 15, 21, 17, 7);
  } else {
    // Connect East Wing north -> Upper Crypt -> Boss Sanctum east flank
    carveRoom(49, 21, 52, eastZ0, 7);
    carveRoom(43, 15, 46, 17, 7);
  }
  rooms.push({
    id: 'room-upper-crypt',
    label: hasNorthLoop ? 'Northwest Guardroom' : 'Northeast Guardroom',
    x0: northSideX0,
    z0: 13,
    x1: northSideX1,
    z1: 21,
    kind: 'hall',
  });

  // Center Corridor 2 -> Boss Chamber
  carveRoom(30, 20, 34, 27, 8);

  // Room 3 (Grand Boss Sanctum): x=21..43, z=7..20
  carveRoom(21, 7, 43, 20, 12);
  rooms.push({
    id: 'room-boss',
    label: 'Boss Sanctum',
    x0: 21,
    z0: 7,
    x1: 43,
    z1: 20,
    kind: 'boss',
  });

  // Pillars, glowing Lanterns, and thematic trim in Boss Sanctum & Side Chambers
  for (const [px, pz] of [[25, 10], [39, 10], [25, 17], [39, 17]]) {
    fillBox(blocks, px, 2, pz, px, 11, pz, wallMat);
    setBlock(blocks, px, 6, pz, BlockId.Lantern);
    setBlock(blocks, px, 2, pz + 1, trimMat);
  }
  for (const [lx, lz] of [
    [28, 49],
    [36, 49],
    [26, 35],
    [38, 35],
    [32, 23],
    [14, westZ0 + 5],
    [50, eastZ0 + 5],
    [northSideX0 + 4, 17],
  ]) {
    setBlock(blocks, lx, 6, lz, BlockId.Lantern);
  }
  setBlock(blocks, 28, 2, 45, BlockId.Banner);
  setBlock(blocks, 36, 2, 45, BlockId.Banner);

  // Bookshelves in the Cartographer Study so it looks authentic in 3D
  const mapRoomX = mapOnWest ? 10 : 54;
  const mapRoomZ = mapOnWest ? westZ0 + 2 : eastZ0 + 2;
  setBlock(blocks, mapRoomX, 2, mapRoomZ, BlockId.Bookshelf);
  setBlock(blocks, mapRoomX, 3, mapRoomZ, BlockId.Bookshelf);
  setBlock(blocks, mapRoomX, 2, mapRoomZ + 1, BlockId.Bookshelf);

  const floorY = 2 * VOXEL_SIZE;

  const mapPedestalX = (mapOnWest ? 14 : 50) * VOXEL_SIZE;
  const mapPedestalZ = (mapOnWest ? westZ0 + 5 : eastZ0 + 5) * VOXEL_SIZE;
  const vaultChestX = (mapOnWest ? 50 : 14) * VOXEL_SIZE;
  const vaultChestZ = (mapOnWest ? eastZ0 + 5 : westZ0 + 5) * VOXEL_SIZE;

  const portals: WorldPortalPoint[] = [
    {
      id: 'dungeon-exit-portal',
      kind: 'dungeon_exit',
      label: 'Exit Dungeon',
      subtitle: `Return to ${REALM_BY_ID[meta.realmId].name}`,
      targetId: meta.realmId,
      position: { x: 32 * VOXEL_SIZE, y: floorY, z: 53.5 * VOXEL_SIZE },
      color: '#10B981',
    },
    {
      id: `dungeon-map-pedestal-${dungeonId}-${seed}`,
      kind: 'map_pedestal',
      label: 'Dungeon Map Pedestal',
      subtitle: 'Reveal Full Dungeon Map',
      targetId: dungeonId,
      position: { x: mapPedestalX, y: floorY, z: mapPedestalZ },
      color: '#F59E0B',
    },
  ];

  const lvl = meta.minLevel;
  const bossAccent =
    meta.theme === 'ember'
      ? '#EA580C'
      : meta.theme === 'frost'
        ? '#0284C7'
        : meta.theme === 'abyss'
          ? '#BE123C'
          : meta.theme === 'sand'
            ? '#CA8A04'
            : '#4338CA';

  const creatures: CreatureSpawnSpec[] = [
    {
      species: 'slime',
      name: 'Crypt Slime',
      level: lvl,
      hostile: true,
      tameable: false,
      isBoss: false,
      position: { x: 28 * VOXEL_SIZE, y: floorY, z: 34 * VOXEL_SIZE },
      accentColor: bossAccent,
    },
    {
      species: 'skeleton',
      name: 'Dungeon Skeleton',
      level: lvl + 1,
      hostile: true,
      tameable: false,
      isBoss: false,
      position: { x: 36 * VOXEL_SIZE, y: floorY, z: 29 * VOXEL_SIZE },
    },
    {
      species: 'goblin',
      name: 'Vault Goblin',
      level: lvl + 1,
      hostile: true,
      tameable: false,
      isBoss: false,
      position: { x: vaultChestX, y: floorY, z: vaultChestZ + 1.2 },
    },
    {
      species: 'skeleton',
      name: 'Hall Sentinel',
      level: lvl + 2,
      hostile: true,
      tameable: false,
      isBoss: false,
      position: { x: (northSideX0 + 4) * VOXEL_SIZE, y: floorY, z: 17 * VOXEL_SIZE },
    },
    {
      species: 'boss',
      name: meta.bossName,
      level: meta.maxLevel,
      hostile: true,
      tameable: false,
      isBoss: true,
      position: { x: 32 * VOXEL_SIZE, y: floorY, z: 13 * VOXEL_SIZE },
      accentColor: bossAccent,
    },
  ];

  const chestRarity: GearRarity =
    meta.maxLevel >= 18 ? 'Legendary' : meta.maxLevel >= 12 ? 'Epic' : 'Rare';

  const chests: LootChestPoint[] = [
    {
      id: `dung-side-chest-${dungeonId}`,
      position: { x: vaultChestX, y: floorY, z: vaultChestZ },
      opened: false,
      rarity: meta.maxLevel >= 12 ? 'Rare' : 'Uncommon',
    },
    {
      id: `dung-guard-chest-${dungeonId}`,
      position: { x: (northSideX0 + 4) * VOXEL_SIZE, y: floorY, z: 15 * VOXEL_SIZE },
      opened: false,
      rarity: meta.maxLevel >= 14 ? 'Epic' : 'Rare',
    },
    {
      id: `dung-boss-chest-${dungeonId}`,
      position: { x: 32 * VOXEL_SIZE, y: floorY, z: 9 * VOXEL_SIZE },
      opened: false,
      rarity: chestRarity,
    },
  ];

  return {
    blocks,
    spawn: { x: 32 * VOXEL_SIZE, y: floorY + 0.2, z: 50.5 * VOXEL_SIZE },
    npcs: [],
    portals,
    creatures,
    chests,
    trapCoords,
    dungeonRooms: rooms,
    template: 'flat',
    realmId: meta.realmId,
    dungeonId,
    suggestedName: `${meta.name} (Lv ${meta.minLevel}–${meta.maxLevel})`,
  };
}

/* ============================================================================
 * 4. CREATE MODE STARTER TEMPLATES (Hills, Obby, Flat)
 * ============================================================================ */

function generateHillsWorld(): GeneratedWorld {
  const blocks = new Uint8Array(TOTAL_VOXELS);
  const waterLevel = 5;

  for (let z = 0; z < WORLD_SIZE_Z; z++) {
    for (let x = 0; x < WORLD_SIZE_X; x++) {
      const n = fbm(x, z, 109);
      const ridge = smoothNoise(x * 0.045, z * 0.045, 211);
      const distLake = Math.hypot((x - 36) * 0.9, (z - 28) * 1.15);

      let h = Math.round(4 + n * 10 + ridge * 3);
      if (distLake < 11) {
        const t = 1 - distLake / 11;
        h = Math.min(h, Math.round(6 - t * 4.5));
      }
      h = Math.max(2, Math.min(WORLD_SIZE_Y - 7, h));

      for (let y = 0; y <= h; y++) {
        if (y < h - 2) setBlock(blocks, x, y, z, BlockId.Stone);
        else if (y < h) setBlock(blocks, x, y, z, BlockId.Dirt);
        else {
          if (h <= waterLevel) setBlock(blocks, x, y, z, BlockId.Sand);
          else if (h === waterLevel + 1 && distLake < 13) setBlock(blocks, x, y, z, BlockId.Sand);
          else setBlock(blocks, x, y, z, BlockId.Grass);
        }
      }

      if (h < waterLevel) {
        for (let y = h + 1; y <= waterLevel; y++) setBlock(blocks, x, y, z, BlockId.Water);
      }
    }
  }

  // Smooth rolling Nordic hills across the entire Hills & Trees template
  applyTerrainSlopes(blocks, (x, z) => Math.hypot(x - 18, z - 16) < 4);

  const treeProps: TreePropSpec[] = [];
  for (let z = 6; z < WORLD_SIZE_Z - 6; z += 7) {
    for (let x = 6; x < WORLD_SIZE_X - 6; x += 7) {
      const r = hash2d(x, z, 555);
      if (r > 0.42) {
        const sy = getSurfaceHeightVoxel(blocks, x, z);
        const ground = getBlock(blocks, x, sy - 1, z);
        if (ground === BlockId.Grass || ground === BlockId.Slope) {
          const kind = r > 0.72 ? 'pine' : r > 0.56 ? 'oak' : 'birch';
          placeNordicTree(blocks, treeProps, x, sy, z, kind, 0.95 + (r - 0.42) * 0.6);
        }
      }
    }
  }

  const ridgeY = getSurfaceHeightVoxel(blocks, 18, 16);
  fillBox(blocks, 16, ridgeY - 1, 14, 20, ridgeY - 1, 18, BlockId.Obsidian);
  setBlock(blocks, 18, ridgeY - 1, 16, BlockId.Lava);
  setBlock(blocks, 15, ridgeY, 15, BlockId.GoldOre);
  setBlock(blocks, 21, ridgeY, 17, BlockId.DiamondOre);

  const spawnY = getSurfaceHeightMeters(blocks, 12, 18);
  return {
    blocks,
    spawn: { x: 12, y: spawnY + 0.5, z: 18 },
    npcs: [],
    portals: [],
    creatures: [
      { species: 'deer', name: 'Hillside Deer', level: 1, hostile: false, tameable: true, isBoss: false, position: { x: 16, y: 5, z: 14 } },
      { species: 'rabbit', name: 'Meadow Rabbit', level: 1, hostile: false, tameable: true, isBoss: false, position: { x: 14, y: 5, z: 20 } },
    ],
    chests: [],
    trapCoords: [],
    trees: treeProps,
    template: 'hills',
    realmId: 'home',
    dungeonId: null,
    suggestedName: 'Emerald Hills',
  };
}

function generateObbyWorld(): GeneratedWorld {
  const blocks = new Uint8Array(TOTAL_VOXELS);

  for (let z = 0; z < WORLD_SIZE_Z; z++) {
    for (let x = 0; x < WORLD_SIZE_X; x++) {
      setBlock(blocks, x, 0, z, BlockId.Stone);
      setBlock(blocks, x, 1, z, BlockId.Sand);
      setBlock(blocks, x, 2, z, BlockId.Water);
    }
  }

  // Starting plaza with fine banners & lanterns
  fillBox(blocks, 10, 3, 28, 16, 4, 36, BlockId.Stone);
  fillBox(blocks, 11, 5, 29, 15, 5, 35, BlockId.Grass);
  setBlock(blocks, 15, 6, 29, BlockId.Banner);
  setBlock(blocks, 15, 6, 35, BlockId.Banner);

  const pads: Array<[number, number, number, BlockId]> = [
    [19, 6, 32, BlockId.Wood],
    [23, 7, 30, BlockId.HalfSlab],
    [27, 8, 32, BlockId.Wood],
    [31, 9, 34, BlockId.Stairs],
    [35, 10, 32, BlockId.Obsidian],
    [35, 11, 26, BlockId.Glass],
    [35, 12, 20, BlockId.Glass],
    [29, 13, 18, BlockId.Brick],
    [23, 15, 18, BlockId.Sand],
  ];
  for (const [px, py, pz, mat] of pads) {
    fillBox(blocks, px - 1, py, pz - 1, px + 1, py, pz + 1, mat);
  }

  // Victory gazebo
  fillBox(blocks, 12, 16, 15, 18, 16, 21, BlockId.GoldOre);
  setBlock(blocks, 12, 17, 15, BlockId.Lantern);
  setBlock(blocks, 18, 17, 15, BlockId.Lantern);
  setBlock(blocks, 12, 17, 21, BlockId.Lantern);
  setBlock(blocks, 18, 17, 21, BlockId.Lantern);

  return {
    blocks,
    spawn: { x: 13 * VOXEL_SIZE, y: 6.5 * VOXEL_SIZE, z: 32 * VOXEL_SIZE },
    npcs: [],
    portals: [],
    creatures: [],
    chests: [
      {
        id: 'obby-summit-chest',
        position: { x: 15 * VOXEL_SIZE, y: 17 * VOXEL_SIZE, z: 18 * VOXEL_SIZE },
        opened: false,
        rarity: 'Epic',
      },
    ],
    trapCoords: [],
    template: 'obby',
    realmId: 'home',
    dungeonId: null,
    suggestedName: 'Sky Obby',
  };
}

function generateFlatWorld(): GeneratedWorld {
  const blocks = new Uint8Array(TOTAL_VOXELS);

  for (let z = 0; z < WORLD_SIZE_Z; z++) {
    for (let x = 0; x < WORLD_SIZE_X; x++) {
      setBlock(blocks, x, 0, z, BlockId.Stone);
      setBlock(blocks, x, 1, z, BlockId.Dirt);
      setBlock(blocks, x, 2, z, BlockId.Dirt);
      setBlock(blocks, x, 3, z, BlockId.Grass);
    }
  }

  for (let z = 28; z <= 35; z++) {
    for (let x = 28; x <= 35; x++) {
      setBlock(blocks, x, 3, z, BlockId.Stone);
    }
  }
  setBlock(blocks, 28, 4, 28, BlockId.Lantern);
  setBlock(blocks, 35, 4, 28, BlockId.Lantern);
  setBlock(blocks, 28, 4, 35, BlockId.Lantern);
  setBlock(blocks, 35, 4, 35, BlockId.Lantern);

  return {
    blocks,
    spawn: { x: 32 * VOXEL_SIZE, y: 4.5 * VOXEL_SIZE, z: 32 * VOXEL_SIZE },
    npcs: [],
    portals: [],
    creatures: [],
    chests: [],
    trapCoords: [],
    template: 'flat',
    realmId: 'home',
    dungeonId: null,
    suggestedName: 'Flat Creative World',
  };
}

export function generateWorldFromTemplate(template: WorldTemplateId): GeneratedWorld {
  switch (template) {
    case 'village':
      return generateHomeWorld();
    case 'hills':
      return generateHillsWorld();
    case 'obby':
      return generateObbyWorld();
    case 'flat':
      return generateFlatWorld();
  }
}
