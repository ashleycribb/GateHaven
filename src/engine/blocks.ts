import * as THREE from 'three';
import { BlockId, BlockShape, PlaceableBlockId } from '../types/blockhaven';

export interface BlockDefinition {
  id: PlaceableBlockId;
  key: string;
  keyCode: string;
  name: string;
  shortLabel: string;
  swatchColor: string;
  solid: boolean;
  transparent: boolean;
  shape: BlockShape;
  fluid?: boolean;
  emissive?: boolean;
  damagesPlayer?: boolean;
  hardness?: number;
  /** Resource yielded when gathered in Play Mode */
  gatherResource?: 'wood' | 'stone' | 'ore';
  /** Atlas tile indices (0..24 in 5x5 grid) for [top, side, bottom] */
  tiles: [number, number, number];
}

// 5x5 tile grid inside a 320x320 canvas (each tile is 64x64 drawn on a 32x32 fine micro-voxel grid)
export const ATLAS_GRID = 5;
const TILE_PX = 64;
const PIXEL_RES = 32;

export const TILE = {
  GRASS_TOP: 0,
  GRASS_SIDE: 1,
  DIRT: 2,
  STONE: 3,
  WOOD_TOP: 4,
  WOOD_SIDE: 5,
  LEAVES: 6,
  SAND: 7,
  WATER: 8,
  GLASS: 9,
  BRICK: 10,
  OBSIDIAN: 11,
  DIAMOND_ORE: 12,
  GOLD_ORE: 13,
  LAVA: 14,
  BOOKSHELF_SIDE: 15,
  THATCH_ROOF: 16,
  CARVED_STONE: 17,
  LANTERN: 18,
  BANNER: 19,
} as const;

export const BLOCK_LIST: BlockDefinition[] = [
  {
    id: BlockId.Grass,
    key: '1',
    keyCode: 'Digit1',
    name: 'Nordic Moss Turf',
    shortLabel: 'Moss',
    swatchColor: '#485A3B',
    solid: true,
    transparent: false,
    shape: 'cube',
    tiles: [TILE.GRASS_TOP, TILE.GRASS_SIDE, TILE.DIRT],
  },
  {
    id: BlockId.Dirt,
    key: '2',
    keyCode: 'Digit2',
    name: 'Peat Loam',
    shortLabel: 'Soil',
    swatchColor: '#544537',
    solid: true,
    transparent: false,
    shape: 'cube',
    tiles: [TILE.DIRT, TILE.DIRT, TILE.DIRT],
  },
  {
    id: BlockId.Stone,
    key: '3',
    keyCode: 'Digit3',
    name: 'Weathered Slate',
    shortLabel: 'Stone',
    swatchColor: '#696E72',
    solid: true,
    transparent: false,
    shape: 'cube',
    gatherResource: 'stone',
    tiles: [TILE.STONE, TILE.STONE, TILE.STONE],
  },
  {
    id: BlockId.Wood,
    key: '4',
    keyCode: 'Digit4',
    name: 'Weathered Pine',
    shortLabel: 'Timber',
    swatchColor: '#6B5540',
    solid: true,
    transparent: false,
    shape: 'cube',
    gatherResource: 'wood',
    tiles: [TILE.WOOD_TOP, TILE.WOOD_SIDE, TILE.WOOD_TOP],
  },
  {
    id: BlockId.Leaves,
    key: '5',
    keyCode: 'Digit5',
    name: 'Dark Pine Boughs',
    shortLabel: 'Pine',
    swatchColor: '#2E432C',
    solid: true,
    transparent: false,
    shape: 'cube',
    gatherResource: 'wood',
    tiles: [TILE.LEAVES, TILE.LEAVES, TILE.LEAVES],
  },
  {
    id: BlockId.Sand,
    key: '6',
    keyCode: 'Digit6',
    name: 'Fjord Silt & Sand',
    shortLabel: 'Sand',
    swatchColor: '#988C75',
    solid: true,
    transparent: false,
    shape: 'cube',
    tiles: [TILE.SAND, TILE.SAND, TILE.SAND],
  },
  {
    id: BlockId.Water,
    key: '7',
    keyCode: 'Digit7',
    name: 'Dark Fjord Water',
    shortLabel: 'Water',
    swatchColor: '#223A46',
    solid: false,
    transparent: true,
    fluid: true,
    shape: 'cube',
    tiles: [TILE.WATER, TILE.WATER, TILE.WATER],
  },
  {
    id: BlockId.Glass,
    key: '8',
    keyCode: 'Digit8',
    name: 'Iron-Leaded Glass',
    shortLabel: 'Glass',
    swatchColor: '#7B8E99',
    solid: true,
    transparent: true,
    shape: 'cube',
    tiles: [TILE.GLASS, TILE.GLASS, TILE.GLASS],
  },
  {
    id: BlockId.Brick,
    key: '9',
    keyCode: 'Digit9',
    name: 'Hearthstone Clay',
    shortLabel: 'Hearth',
    swatchColor: '#75483C',
    solid: true,
    transparent: false,
    shape: 'cube',
    gatherResource: 'stone',
    tiles: [TILE.BRICK, TILE.BRICK, TILE.BRICK],
  },
  {
    id: BlockId.Obsidian,
    key: '0',
    keyCode: 'Digit0',
    name: 'Dark Basalt (Tough — 2 hits)',
    shortLabel: 'Basalt',
    swatchColor: '#23242C',
    solid: true,
    transparent: false,
    shape: 'cube',
    hardness: 2,
    gatherResource: 'ore',
    tiles: [TILE.OBSIDIAN, TILE.OBSIDIAN, TILE.OBSIDIAN],
  },
  {
    id: BlockId.DiamondOre,
    key: '-',
    keyCode: 'Minus',
    name: 'Frost Crystal Vein',
    shortLabel: 'Crystal',
    swatchColor: '#4E8FA0',
    solid: true,
    transparent: false,
    shape: 'cube',
    gatherResource: 'ore',
    tiles: [TILE.DIAMOND_ORE, TILE.DIAMOND_ORE, TILE.DIAMOND_ORE],
  },
  {
    id: BlockId.GoldOre,
    key: '=',
    keyCode: 'Equal',
    name: 'Burnished Gold Vein',
    shortLabel: 'Gold',
    swatchColor: '#A8863E',
    solid: true,
    transparent: false,
    shape: 'cube',
    gatherResource: 'ore',
    tiles: [TILE.GOLD_ORE, TILE.GOLD_ORE, TILE.GOLD_ORE],
  },
  {
    id: BlockId.Lava,
    key: '[',
    keyCode: 'BracketLeft',
    name: 'Molten Magma (Glows & Burns)',
    shortLabel: 'Magma',
    swatchColor: '#C8501A',
    solid: false,
    transparent: false,
    fluid: true,
    emissive: true,
    damagesPlayer: true,
    shape: 'cube',
    tiles: [TILE.LAVA, TILE.LAVA, TILE.LAVA],
  },
  {
    id: BlockId.Bookshelf,
    key: ']',
    keyCode: 'BracketRight',
    name: 'Runic Timber Shelf',
    shortLabel: 'Tomes',
    swatchColor: '#664B34',
    solid: true,
    transparent: false,
    shape: 'cube',
    gatherResource: 'wood',
    tiles: [TILE.WOOD_TOP, TILE.BOOKSHELF_SIDE, TILE.WOOD_TOP],
  },
  {
    id: BlockId.Stairs,
    key: 'Z',
    keyCode: 'KeyZ',
    name: 'Hewn Stone Stairs',
    shortLabel: 'Stairs',
    swatchColor: '#757A7D',
    solid: true,
    transparent: false,
    shape: 'stairs',
    gatherResource: 'stone',
    tiles: [TILE.CARVED_STONE, TILE.CARVED_STONE, TILE.CARVED_STONE],
  },
  {
    id: BlockId.Slope,
    key: 'X',
    keyCode: 'KeyX',
    name: 'Thatch & Terrain Slope',
    shortLabel: 'Slope',
    swatchColor: '#73644B',
    solid: true,
    transparent: false,
    shape: 'slope',
    gatherResource: 'wood',
    tiles: [TILE.THATCH_ROOF, TILE.WOOD_SIDE, TILE.WOOD_SIDE],
  },
  {
    id: BlockId.HalfSlab,
    key: 'B',
    keyCode: 'KeyB',
    name: 'Hewn Flagstone Slab',
    shortLabel: 'Slab',
    swatchColor: '#7C8083',
    solid: true,
    transparent: false,
    shape: 'slab',
    gatherResource: 'stone',
    tiles: [TILE.CARVED_STONE, TILE.CARVED_STONE, TILE.CARVED_STONE],
  },
  {
    id: BlockId.Fence,
    key: 'N',
    keyCode: 'KeyN',
    name: 'Split Timber Fence',
    shortLabel: 'Fence',
    swatchColor: '#644F3B',
    solid: true,
    transparent: false,
    shape: 'fence',
    gatherResource: 'wood',
    tiles: [TILE.WOOD_TOP, TILE.WOOD_SIDE, TILE.WOOD_TOP],
  },
  {
    id: BlockId.Lantern,
    key: 'L',
    keyCode: 'KeyL',
    name: 'Iron Hearth Lantern',
    shortLabel: 'Lantern',
    swatchColor: '#D99938',
    solid: false,
    transparent: false,
    emissive: true,
    shape: 'lantern',
    tiles: [TILE.LANTERN, TILE.LANTERN, TILE.LANTERN],
  },
  {
    id: BlockId.Banner,
    key: ',',
    keyCode: 'Comma',
    name: 'Nordic Clan Banner',
    shortLabel: 'Banner',
    swatchColor: '#73362F',
    solid: false,
    transparent: false,
    shape: 'banner',
    tiles: [TILE.BANNER, TILE.BANNER, TILE.BANNER],
  },
];

export const BLOCK_BY_ID: Record<number, BlockDefinition> = Object.fromEntries(
  BLOCK_LIST.map((b) => [b.id, b]),
);

export const BLOCK_BY_KEYCODE: Record<string, BlockDefinition> = Object.fromEntries(
  BLOCK_LIST.map((b) => [b.keyCode, b]),
);

export function isBlockSolid(id: BlockId): boolean {
  if (id === BlockId.Air) return false;
  return BLOCK_BY_ID[id]?.solid ?? false;
}

export function isBlockFullOpaqueCube(id: BlockId): boolean {
  if (id === BlockId.Air) return false;
  const def = BLOCK_BY_ID[id];
  if (!def) return false;
  return def.shape === 'cube' && !def.transparent && !def.fluid && !def.emissive;
}

export function isBlockTransparent(id: BlockId): boolean {
  if (id === BlockId.Air) return true;
  return BLOCK_BY_ID[id]?.transparent ?? false;
}

export function isBlockEmissive(id: BlockId): boolean {
  if (id === BlockId.Air) return false;
  return BLOCK_BY_ID[id]?.emissive ?? false;
}

export function isBlockFluid(id: BlockId): boolean {
  if (id === BlockId.Air) return false;
  return BLOCK_BY_ID[id]?.fluid ?? false;
}

export function getBlockHardness(id: BlockId): number {
  return BLOCK_BY_ID[id]?.hardness ?? 1;
}

function hash2(x: number, y: number, seed: number): number {
  let n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function clampByte(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function rgbShift(r: number, g: number, b: number, delta: number, a?: number): string {
  const rr = clampByte(r + delta);
  const gg = clampByte(g + delta);
  const bb = clampByte(b + delta);
  if (a !== undefined) return `rgba(${rr}, ${gg}, ${bb}, ${a})`;
  return `rgb(${rr}, ${gg}, ${bb})`;
}

interface TileSample {
  color: string;
  /** Height value 0..255 for physical bump relief */
  bump: number;
  /** Roughness value 0..255 (255 = pure matte, 60 = polished/glossy) */
  rough: number;
}

interface AtlasSet {
  albedo: HTMLCanvasElement;
  bump: HTMLCanvasElement;
  roughness: HTMLCanvasElement;
}

function drawTilePbr(
  aCtx: CanvasRenderingContext2D,
  bCtx: CanvasRenderingContext2D,
  rCtx: CanvasRenderingContext2D,
  tileIndex: number,
  sample: (px: number, py: number) => TileSample,
) {
  const col = tileIndex % ATLAS_GRID;
  const row = Math.floor(tileIndex / ATLAS_GRID);
  const ox = col * TILE_PX;
  const oy = row * TILE_PX;
  const step = TILE_PX / PIXEL_RES;

  for (let py = 0; py < PIXEL_RES; py++) {
    for (let px = 0; px < PIXEL_RES; px++) {
      const s = sample(px, py);
      const dx = ox + px * step;
      const dy = oy + py * step;

      aCtx.fillStyle = s.color;
      aCtx.fillRect(dx, dy, step, step);

      const bv = clampByte(s.bump);
      bCtx.fillStyle = `rgb(${bv},${bv},${bv})`;
      bCtx.fillRect(dx, dy, step, step);

      const rv = clampByte(s.rough);
      rCtx.fillStyle = `rgb(${rv},${rv},${rv})`;
      rCtx.fillRect(dx, dy, step, step);
    }
  }
}

let cachedAtlasSet: AtlasSet | null = null;
let cachedIconUrls: Record<PlaceableBlockId, string> | null = null;

/**
 * Generates a cohesive Valheim-graded Nordic 32x32 micro-grain texture suite:
 * muted, desaturated moss, weathered pine, dark slate, reed thatch, and dark fjord water
 * with paired bump relief and PBR roughness maps.
 */
function buildAtlasSet(): AtlasSet {
  if (cachedAtlasSet) return cachedAtlasSet;

  const size = ATLAS_GRID * TILE_PX;
  const albedo = document.createElement('canvas');
  const bump = document.createElement('canvas');
  const roughness = document.createElement('canvas');
  albedo.width = bump.width = roughness.width = size;
  albedo.height = bump.height = roughness.height = size;

  const aCtx = albedo.getContext('2d')!;
  const bCtx = bump.getContext('2d')!;
  const rCtx = roughness.getContext('2d')!;
  aCtx.clearRect(0, 0, size, size);
  bCtx.fillStyle = 'rgb(128,128,128)';
  bCtx.fillRect(0, 0, size, size);
  rCtx.fillStyle = 'rgb(225,225,225)';
  rCtx.fillRect(0, 0, size, size);

  // 0: Grass Top — Muted Nordic meadow moss, damp olive turf & dry heather flecks
  drawTilePbr(aCtx, bCtx, rCtx, TILE.GRASS_TOP, (x, y) => {
    const n1 = hash2(x, y, 11);
    const n2 = hash2(Math.floor(x / 2), Math.floor(y / 2), 19);
    const patch = hash2(Math.floor(x / 4), Math.floor(y / 4), 27);
    const blade = (n1 - 0.5) * 16 + (n2 - 0.5) * 12;
    if (n1 > 0.92) {
      // Dry golden-brown autumn grass / heather speck
      return { color: rgbShift(106, 98, 66, blade * 0.4), bump: 158, rough: 240 };
    }
    if (patch < 0.24) {
      // Deep damp pine-shadow moss patch
      return { color: rgbShift(58, 72, 47, blade * 0.8), bump: 112 + n1 * 40, rough: 238 };
    }
    return {
      color: rgbShift(74, 90, 58, blade),
      bump: 122 + n1 * 46,
      rough: 234 + n2 * 16,
    };
  });

  // 1: Grass Side — Overhanging mossy Nordic turf lip over dark damp peat loam
  drawTilePbr(aCtx, bCtx, rCtx, TILE.GRASS_SIDE, (x, y) => {
    const lip = 5 + Math.floor(hash2(x, 0, 23) * 3.5 + hash2(Math.floor(x / 2), 1, 29) * 2.5);
    const n = hash2(x, y, 31);
    if (y < lip) {
      const shade = y === lip - 1 ? -14 : (n - 0.5) * 14;
      return { color: rgbShift(70, 86, 55, shade), bump: 148 + n * 24, rough: 238 };
    }
    if (y === lip) {
      return { color: rgbShift(54, 44, 36, (n - 0.5) * 10), bump: 92, rough: 244 };
    }
    const clump = hash2(Math.floor(x / 2), Math.floor(y / 2), 37);
    const pebble = n > 0.91 ? 18 : (n - 0.5) * 14 + (clump - 0.5) * 12;
    return { color: rgbShift(82, 67, 54, pebble), bump: 110 + n * 42, rough: 240 };
  });

  // 2: Dirt — Damp Nordic peat loam with slate gravel specks
  drawTilePbr(aCtx, bCtx, rCtx, TILE.DIRT, (x, y) => {
    const n = hash2(x, y, 41);
    const c = hash2(Math.floor(x / 2), Math.floor(y / 2), 43);
    if (n > 0.92) {
      return { color: rgbShift(104, 102, 98, (c - 0.5) * 10), bump: 172, rough: 222 };
    }
    const d = (n - 0.5) * 16 + (c - 0.5) * 12;
    return { color: rgbShift(82, 68, 55, d), bump: 110 + n * 44, rough: 240 };
  });

  // 3: Stone — Weathered Nordic slate-granite blocks with moss-darkened seams
  drawTilePbr(aCtx, bCtx, rCtx, TILE.STONE, (x, y) => {
    const course = Math.floor(y / 16);
    const seamY = y === 0 || y === 16;
    const seamX = (course === 0 && (x === 0 || x === 18)) || (course === 1 && (x === 9 || x === 27));
    const n = hash2(x, y, 53);
    const blockTint = (hash2(course, seamX ? 1 : Math.floor((x + course * 9) / 16), 59) - 0.5) * 12;
    if (seamY || seamX) {
      return { color: rgbShift(68, 73, 75, (n - 0.5) * 8), bump: 60, rough: 244 };
    }
    // Subtle lichen / damp moss near mortar lines
    if ((y === 1 || y === 17) && n > 0.62) {
      return { color: rgbShift(78, 86, 74, (n - 0.5) * 10), bump: 122, rough: 236 };
    }
    const speck = (n - 0.5) * 16 + blockTint;
    return {
      color: rgbShift(104, 109, 113, speck),
      bump: 130 + (n - 0.5) * 32,
      rough: 214 + n * 24,
    };
  });

  // 4: Wood Top — Weathered Nordic pine plank decking (silvered aged brown)
  drawTilePbr(aCtx, bCtx, rCtx, TILE.WOOD_TOP, (x, y) => {
    const n = hash2(x, y, 61);
    const plankSeam = y % 8 === 0;
    const grain = Math.sin(x * 0.45 + hash2(0, Math.floor(y / 8), 67) * 6) * 5;
    if (plankSeam) {
      return { color: rgbShift(64, 51, 39, (n - 0.5) * 6), bump: 64, rough: 240 };
    }
    const pTint = (hash2(Math.floor(y / 8), 2, 71) - 0.5) * 12;
    return {
      color: rgbShift(106, 85, 65, grain + pTint + (n - 0.5) * 10),
      bump: 134 + grain * 2 + (n - 0.5) * 16,
      rough: 210 + n * 24,
    };
  });

  // 5: Wood Side — Hewn dark-pine log siding & weathered Nordic timber planks
  drawTilePbr(aCtx, bCtx, rCtx, TILE.WOOD_SIDE, (x, y) => {
    const plank = Math.floor(y / 8);
    const seamY = y % 8 === 0;
    const grooveShadow = y % 8 === 1;
    const jointX = (plank % 2 === 0 && x === 21) || (plank % 2 === 1 && x === 9);
    const n = hash2(x, y, 73);
    if (seamY || jointX) {
      return { color: rgbShift(58, 46, 35, (n - 0.5) * 6), bump: 58, rough: 242 };
    }
    const fiber = (hash2(Math.floor(x / 4), y, 79) - 0.5) * 12 + (n - 0.5) * 8;
    const plankShift = (hash2(plank, 5, 81) - 0.5) * 14 + (grooveShadow ? -9 : 0);
    return {
      color: rgbShift(102, 81, 62, fiber + plankShift),
      bump: grooveShadow ? 108 : 140 + fiber * 1.4,
      rough: 208 + n * 28,
    };
  });

  // 6: Leaves — Deep dark Nordic spruce & pine boughs (subdued, moody evergreen)
  drawTilePbr(aCtx, bCtx, rCtx, TILE.LEAVES, (x, y) => {
    const n = hash2(x, y, 83);
    const cluster = hash2(Math.floor(x / 2), Math.floor(y / 2), 89);
    const d = (n - 0.5) * 18 + (cluster - 0.5) * 16;
    if (cluster < 0.25) {
      return { color: rgbShift(28, 41, 27, (n - 0.5) * 8), bump: 74, rough: 246 };
    }
    return {
      color: rgbShift(45, 63, 42, d),
      bump: 126 + n * 54,
      rough: 230 + n * 20,
    };
  });

  // 7: Sand — Damp muted Nordic coastal silt & shoreline pebbles
  drawTilePbr(aCtx, bCtx, rCtx, TILE.SAND, (x, y) => {
    const ripple = Math.sin(y * 0.65 + Math.sin(x * 0.25) * 1.6) * 5;
    const n = hash2(x, y, 97);
    if (n > 0.93) {
      return { color: rgbShift(118, 114, 106, (n - 0.5) * 10), bump: 164, rough: 224 };
    }
    return {
      color: rgbShift(152, 140, 117, ripple + (n - 0.5) * 12),
      bump: 128 + ripple * 2.5 + (n - 0.5) * 16,
      rough: 232 + n * 18,
    };
  });

  // 8: Water — Dark reflective Nordic fjord water with muted misty surface ripples
  drawTilePbr(aCtx, bCtx, rCtx, TILE.WATER, (x, y) => {
    const wave = Math.sin(x * 0.42 + y * 0.28) * Math.cos(y * 0.36 - x * 0.16);
    const n = hash2(x, y, 107);
    const crest = wave > 0.76 && n > 0.48;
    if (crest) {
      return { color: 'rgba(128, 152, 162, 0.64)', bump: 154, rough: 24 };
    }
    return {
      color: rgbShift(28, 54, 67, wave * 9 + (n - 0.5) * 6, 0.8),
      bump: 126 + wave * 14,
      rough: 22,
    };
  });

  // 9: Glass — Aged wrought-iron mullioned cottage pane
  drawTilePbr(aCtx, bCtx, rCtx, TILE.GLASS, (x, y) => {
    const outerFrame = x <= 1 || x >= 30 || y <= 1 || y >= 30 || x === 15 || y === 15;
    const innerBevel = x === 2 || x === 29 || y === 2 || y === 29;
    if (outerFrame) {
      return { color: 'rgba(46, 48, 52, 0.94)', bump: 180, rough: 120 };
    }
    if (innerBevel) {
      return { color: 'rgba(96, 108, 116, 0.6)', bump: 150, rough: 92 };
    }
    const sheen =
      (x + y >= 11 && x + y <= 13 && x >= 4 && x <= 11) ||
      (x + y === 46 && x >= 20 && x <= 26);
    if (sheen) {
      return { color: 'rgba(218, 224, 226, 0.44)', bump: 128, rough: 24 };
    }
    return { color: 'rgba(130, 148, 158, 0.26)', bump: 128, rough: 28 };
  });

  // 10: Brick — Soot-weathered Nordic hearth clay & muted mortar
  drawTilePbr(aCtx, bCtx, rCtx, TILE.BRICK, (x, y) => {
    const row = Math.floor(y / 8);
    const mortarY = y % 8 === 0;
    const offset = row % 2 === 0 ? 0 : 8;
    const mortarX = (x + offset) % 16 === 0;
    const n = hash2(x, y, 127);
    if (mortarY || mortarX) {
      return { color: rgbShift(116, 112, 104, (n - 0.5) * 10), bump: 64, rough: 244 };
    }
    const brickId = Math.floor((x + offset) / 16) + row * 7;
    const brickVar = (hash2(brickId, row, 131) - 0.5) * 20;
    const soot = y % 8 === 1 ? -10 : 0;
    return {
      color: rgbShift(116, 70, 58, brickVar + soot + (n - 0.5) * 12),
      bump: 146 + (n - 0.5) * 24,
      rough: 224 + n * 20,
    };
  });

  // 11: Obsidian / Volcanic Basalt — Matte dark columnar stone
  drawTilePbr(aCtx, bCtx, rCtx, TILE.OBSIDIAN, (x, y) => {
    const n = hash2(x, y, 149);
    const fracture = Math.abs(Math.sin(x * 0.26 + y * 0.19) + Math.cos(x * 0.15 - y * 0.31)) < 0.09;
    if (fracture) {
      return { color: rgbShift(56, 54, 72, (n - 0.5) * 12), bump: 98, rough: 120 };
    }
    const d = (n - 0.5) * 14;
    return {
      color: rgbShift(34, 35, 42, d),
      bump: 132 + (n - 0.5) * 26,
      rough: 148 + n * 34,
    };
  });

  // 12: Crystal / Diamond Ore — Dark Nordic granite with glacial blue-silver veins
  drawTilePbr(aCtx, bCtx, rCtx, TILE.DIAMOND_ORE, (x, y) => {
    const n = hash2(x, y, 163);
    const pocket =
      (Math.hypot(x - 8, y - 9) < 3.1 && n > 0.2) ||
      (Math.hypot(x - 22, y - 14) < 3.4 && n > 0.22) ||
      (Math.hypot(x - 13, y - 24) < 3.0 && n > 0.25) ||
      (Math.hypot(x - 25, y - 25) < 2.2 && n > 0.3);
    if (pocket) {
      const glint = n > 0.72;
      return {
        color: glint ? '#C0E2EA' : rgbShift(76, 142, 160, (n - 0.5) * 24),
        bump: 176,
        rough: 56,
      };
    }
    return {
      color: rgbShift(90, 95, 100, (n - 0.5) * 16),
      bump: 128 + (n - 0.5) * 32,
      rough: 218,
    };
  });

  // 13: Gold Ore — Slate granite with antique burnished gold seams
  drawTilePbr(aCtx, bCtx, rCtx, TILE.GOLD_ORE, (x, y) => {
    const n = hash2(x, y, 179);
    const vein =
      (Math.hypot(x - 7, y - 12) < 3.2 && n > 0.22) ||
      (Math.hypot(x - 21, y - 7) < 3.5 && n > 0.2) ||
      (Math.hypot(x - 19, y - 23) < 3.3 && n > 0.24) ||
      (Math.hypot(x - 8, y - 25) < 2.1 && n > 0.3);
    if (vein) {
      const glint = n > 0.74;
      return {
        color: glint ? '#E8D28C' : rgbShift(172, 134, 60, (n - 0.5) * 22),
        bump: 170,
        rough: 74,
      };
    }
    return {
      color: rgbShift(92, 96, 100, (n - 0.5) * 16),
      bump: 128 + (n - 0.5) * 32,
      rough: 220,
    };
  });

  // 14: Molten Magma — Charred basalt plates cracked by warm incandescent fire veins
  drawTilePbr(aCtx, bCtx, rCtx, TILE.LAVA, (x, y) => {
    const flow = Math.sin(x * 0.34 + y * 0.19) + Math.cos(y * 0.31 - x * 0.17);
    const n = hash2(x, y, 197);
    if (flow > 0.95 || (n > 0.92 && flow > 0.35)) {
      return { color: '#FFE49E', bump: 115, rough: 90 };
    }
    if (flow > 0.32) {
      return { color: '#F08E2C', bump: 120, rough: 110 };
    }
    if (flow > -0.28) {
      return { color: '#C44516', bump: 126, rough: 150 };
    }
    if (flow > -0.78) {
      return { color: '#692112', bump: 146, rough: 205 };
    }
    return { color: rgbShift(42, 26, 23, (n - 0.5) * 10), bump: 164, rough: 234 };
  });

  // 15: Bookshelf Side — Aged dark oak shelves with muted leather & parchment volumes
  drawTilePbr(aCtx, bCtx, rCtx, TILE.BOOKSHELF_SIDE, (x, y) => {
    const n = hash2(x, y, 211);
    const shelfBoard = y <= 2 || (y >= 14 && y <= 17) || y >= 29;
    if (shelfBoard) {
      return { color: rgbShift(94, 70, 48, (n - 0.5) * 10), bump: 156, rough: 205 };
    }
    if (x <= 1 || x >= 30) {
      return { color: rgbShift(78, 58, 40, (n - 0.5) * 8), bump: 152, rough: 210 };
    }
    if (y === 3 || y === 4 || y === 18 || y === 19) {
      return { color: '#211914', bump: 64, rough: 245 };
    }
    const rowIdx = y < 15 ? 0 : 1;
    const bookCol = Math.floor((x - 2) / 3);
    const isSpineEdge = (x - 2) % 3 === 0;
    const palette = [
      [104, 52, 46],
      [52, 68, 86],
      [126, 100, 56],
      [52, 76, 56],
      [154, 144, 124],
      [78, 56, 78],
      [108, 66, 44],
      [56, 62, 70],
    ];
    const [br, bg, bb] = palette[(bookCol + rowIdx * 3) % palette.length];
    const goldBand = (rowIdx === 0 && y === 8) || (rowIdx === 1 && y === 23);
    if (goldBand && !isSpineEdge && (bookCol + rowIdx) % 2 === 0) {
      return { color: '#B5985A', bump: 146, rough: 120 };
    }
    return {
      color: rgbShift(br, bg, bb, (isSpineEdge ? -16 : 0) + (n - 0.5) * 8),
      bump: isSpineEdge ? 104 : 142,
      rough: 222,
    };
  });

  // 16: Weathered Nordic Thatch Roof (layered golden-grey reeds & dark overlapping eaves)
  drawTilePbr(aCtx, bCtx, rCtx, TILE.THATCH_ROOF, (x, y) => {
    const bundleRow = Math.floor(y / 8);
    const eaveShadow = y % 8 === 7;
    const reed = Math.sin(x * 1.45 + bundleRow * 2.3) * 7;
    const n = hash2(x, y, 223);
    const streak = (hash2(x, bundleRow, 229) - 0.5) * 18;
    if (eaveShadow) {
      return { color: rgbShift(68, 58, 42, (n - 0.5) * 8), bump: 64, rough: 244 };
    }
    // Occasional dark weather-worn straw or pale dry reed
    const mossSpeck = y % 8 === 6 && n > 0.78;
    if (mossSpeck) {
      return { color: rgbShift(74, 82, 54, (n - 0.5) * 8), bump: 118, rough: 242 };
    }
    return {
      color: rgbShift(116, 101, 74, reed + streak + (n - 0.5) * 12),
      bump: 132 + reed * 2.5 + (y % 8) * 3,
      rough: 232 + n * 18,
    };
  });

  // 17: Hewn Nordic Flagstone (Stairs & Slabs)
  drawTilePbr(aCtx, bCtx, rCtx, TILE.CARVED_STONE, (x, y) => {
    const n = hash2(x, y, 239);
    const outerEdge = x === 0 || y === 0 || x === 31 || y === 31;
    const highlightBevel = x === 1 || y === 1;
    if (outerEdge) return { color: rgbShift(76, 80, 84, (n - 0.5) * 6), bump: 80, rough: 232 };
    if (highlightBevel) return { color: rgbShift(134, 138, 140, (n - 0.5) * 6), bump: 162, rough: 196 };
    return {
      color: rgbShift(116, 120, 124, (n - 0.5) * 12),
      bump: 136 + (n - 0.5) * 18,
      rough: 204 + n * 22,
    };
  });

  // 18: Forged Iron & Warm Amber Hearth Lantern
  drawTilePbr(aCtx, bCtx, rCtx, TILE.LANTERN, (x, y) => {
    const frame = x <= 4 || x >= 27 || y <= 4 || y >= 27 || x === 15 || x === 16;
    if (frame) return { color: '#212226', bump: 178, rough: 145 };
    const dist = Math.hypot(x - 15.5, y - 15.5);
    if (dist < 6.5) return { color: '#FFF0B8', bump: 128, rough: 40 };
    if (dist < 10.5) return { color: '#F0AE42', bump: 128, rough: 52 };
    return { color: '#C97A22', bump: 128, rough: 68 };
  });

  // 19: Woven Nordic Clan Banner (muted rust-crimson wool & tarnished bronze rune)
  drawTilePbr(aCtx, bCtx, rCtx, TILE.BANNER, (x, y) => {
    const n = hash2(x, y, 251);
    const weave = ((x + y) % 2 === 0 ? 4 : -4) + (n - 0.5) * 6;
    if (x <= 2 || x >= 29 || y <= 2) {
      return { color: rgbShift(168, 132, 68, weave), bump: 146, rough: 180 };
    }
    const emblem =
      (x >= 14 && x <= 17 && y >= 7 && y <= 24) ||
      (x >= 10 && x <= 21 && y >= 11 && y <= 14) ||
      (Math.abs(x - 15.5) === Math.abs(y - 19) && y >= 15 && y <= 23);
    if (emblem) {
      return { color: rgbShift(206, 186, 134, weave), bump: 142, rough: 192 };
    }
    return {
      color: rgbShift(112, 50, 44, weave),
      bump: 128 + weave,
      rough: 234,
    };
  });

  cachedAtlasSet = { albedo, bump, roughness };
  return cachedAtlasSet;
}

export function createVoxelAtlasTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const { albedo } = buildAtlasSet();
  const texture = new THREE.CanvasTexture(albedo);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.anisotropy = Math.min(maxAnisotropy, 8);
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

export function createVoxelBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const { bump } = buildAtlasSet();
  const texture = new THREE.CanvasTexture(bump);
  // Data texture: leave in linear space (NoColorSpace)
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(maxAnisotropy, 8);
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

export function createVoxelRoughnessTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const { roughness } = buildAtlasSet();
  const texture = new THREE.CanvasTexture(roughness);
  // Data texture: leave in linear space (NoColorSpace)
  texture.colorSpace = THREE.NoColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(maxAnisotropy, 8);
  texture.flipY = true;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Generates crisp 2D icons for all 20 blocks (cubes + fine architectural silhouettes).
 */
export function getBlockIconUrls(): Record<PlaceableBlockId, string> {
  if (cachedIconUrls) return cachedIconUrls;

  const { albedo: atlas } = buildAtlasSet();
  const icons = {} as Record<PlaceableBlockId, string>;

  for (const def of BLOCK_LIST) {
    const c = document.createElement('canvas');
    c.width = 48;
    c.height = 48;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    const [topTile, sideTile] = def.tiles;
    const getSrc = (idx: number) => ({
      sx: (idx % ATLAS_GRID) * TILE_PX,
      sy: Math.floor(idx / ATLAS_GRID) * TILE_PX,
    });

    const topSrc = getSrc(topTile);
    const sideSrc = getSrc(sideTile);

    if (def.shape === 'slab') {
      ctx.save();
      ctx.translate(24, 17);
      ctx.transform(0.86, 0.43, -0.86, 0.43, 0, 0);
      ctx.drawImage(atlas, topSrc.sx, topSrc.sy, TILE_PX, TILE_PX, 0, 0, 21, 21);
      ctx.restore();
      ctx.save();
      ctx.translate(6, 26);
      ctx.transform(0.86, 0.43, 0, 0.5, 0, 0);
      ctx.drawImage(atlas, sideSrc.sx, sideSrc.sy, TILE_PX, TILE_PX, 0, 0, 21, 21);
      ctx.restore();
      ctx.save();
      ctx.translate(24, 35);
      ctx.transform(0.86, -0.43, 0, 0.5, 0, 0);
      ctx.drawImage(atlas, sideSrc.sx, sideSrc.sy, TILE_PX, TILE_PX, 0, 0, 21, 21);
      ctx.restore();
    } else if (def.shape === 'stairs') {
      ctx.fillStyle = '#6E7377';
      ctx.fillRect(8, 28, 32, 12);
      ctx.fillStyle = '#7D8286';
      ctx.fillRect(8, 18, 21, 10);
      ctx.fillStyle = '#8C9195';
      ctx.fillRect(8, 10, 11, 8);
      ctx.strokeStyle = '#3B3F42';
      ctx.lineWidth = 2;
      ctx.strokeRect(8, 28, 32, 12);
      ctx.strokeRect(8, 18, 21, 10);
      ctx.strokeRect(8, 10, 11, 8);
    } else if (def.shape === 'slope') {
      ctx.beginPath();
      ctx.moveTo(8, 38);
      ctx.lineTo(40, 38);
      ctx.lineTo(40, 10);
      ctx.closePath();
      ctx.fillStyle = '#7A6A4E';
      ctx.fill();
      ctx.strokeStyle = '#473D2D';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (def.shape === 'fence') {
      ctx.fillStyle = '#5B4734';
      ctx.fillRect(10, 10, 7, 30);
      ctx.fillRect(31, 10, 7, 30);
      ctx.fillStyle = '#735B44';
      ctx.fillRect(7, 16, 34, 5);
      ctx.fillRect(7, 27, 34, 5);
    } else if (def.shape === 'lantern') {
      ctx.fillStyle = '#232428';
      ctx.fillRect(19, 6, 10, 5);
      ctx.fillRect(14, 11, 20, 4);
      ctx.fillStyle = '#D99938';
      ctx.fillRect(16, 15, 16, 20);
      ctx.fillStyle = '#FFF0B8';
      ctx.fillRect(19, 18, 10, 14);
      ctx.fillStyle = '#232428';
      ctx.fillRect(14, 35, 20, 5);
    } else if (def.shape === 'banner') {
      ctx.fillStyle = '#5A4532';
      ctx.fillRect(22, 6, 4, 36);
      ctx.fillStyle = '#73362F';
      ctx.fillRect(13, 10, 22, 24);
      ctx.fillStyle = '#B08A47';
      ctx.fillRect(13, 10, 22, 3);
      ctx.fillStyle = '#D2BE8A';
      ctx.fillRect(21, 17, 6, 10);
    } else {
      ctx.save();
      ctx.translate(24, 6);
      ctx.transform(0.86, 0.43, -0.86, 0.43, 0, 0);
      ctx.drawImage(atlas, topSrc.sx, topSrc.sy, TILE_PX, TILE_PX, 0, 0, 21, 21);
      ctx.restore();

      ctx.save();
      ctx.translate(6, 15);
      ctx.transform(0.86, 0.43, 0, 1, 0, 0);
      ctx.drawImage(atlas, sideSrc.sx, sideSrc.sy, TILE_PX, TILE_PX, 0, 0, 21, 21);
      if (!def.emissive) {
        ctx.fillStyle = 'rgba(15, 20, 26, 0.18)';
        ctx.fillRect(0, 0, 21, 21);
      }
      ctx.restore();

      ctx.save();
      ctx.translate(24, 24);
      ctx.transform(0.86, -0.43, 0, 1, 0, 0);
      ctx.drawImage(atlas, sideSrc.sx, sideSrc.sy, TILE_PX, TILE_PX, 0, 0, 21, 21);
      if (!def.emissive) {
        ctx.fillStyle = 'rgba(15, 20, 26, 0.34)';
        ctx.fillRect(0, 0, 21, 21);
      }
      ctx.restore();
    }

    icons[def.id] = c.toDataURL('image/png');
  }

  cachedIconUrls = icons;
  return icons;
}
