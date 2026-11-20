import * as THREE from 'three';
import {
  BlockId,
  CHUNK_SIZE,
  VOXEL_SIZE,
  WORLD_SIZE_X,
  WORLD_SIZE_Y,
  WORLD_SIZE_Z,
} from '../types/blockhaven';
import {
  ATLAS_GRID,
  BLOCK_BY_ID,
  isBlockFluid,
  isBlockFullOpaqueCube,
  TILE,
} from './blocks';
import { getBlock } from './worldGen';

export interface ChunkLightSource {
  x: number;
  y: number;
  z: number;
  color: string;
}

export interface ChunkMeshPair {
  opaqueGeo: THREE.BufferGeometry;
  transparentGeo: THREE.BufferGeometry;
  emissiveGeo: THREE.BufferGeometry;
  lightSources: ChunkLightSource[];
}

interface FaceSpec {
  dir: [number, number, number];
  tileSlot: 0 | 1 | 2;
  shade: number;
  corners: Array<[number, number, number, number, number]>;
}

const FACES: FaceSpec[] = [
  // +Y (Top)
  {
    dir: [0, 1, 0],
    tileSlot: 0,
    shade: 1.0,
    corners: [
      [0, 1, 1, 0, 0],
      [1, 1, 1, 1, 0],
      [1, 1, 0, 1, 1],
      [0, 1, 0, 0, 1],
    ],
  },
  // -Y (Bottom)
  {
    dir: [0, -1, 0],
    tileSlot: 2,
    shade: 0.54,
    corners: [
      [0, 0, 0, 0, 0],
      [1, 0, 0, 1, 0],
      [1, 0, 1, 1, 1],
      [0, 0, 1, 0, 1],
    ],
  },
  // +X (East — warm low sun side)
  {
    dir: [1, 0, 0],
    tileSlot: 1,
    shade: 0.86,
    corners: [
      [1, 0, 1, 0, 0],
      [1, 0, 0, 1, 0],
      [1, 1, 0, 1, 1],
      [1, 1, 1, 0, 1],
    ],
  },
  // -X (West — cool shadow side)
  {
    dir: [-1, 0, 0],
    tileSlot: 1,
    shade: 0.74,
    corners: [
      [0, 0, 0, 0, 0],
      [0, 0, 1, 1, 0],
      [0, 1, 1, 1, 1],
      [0, 1, 0, 0, 1],
    ],
  },
  // +Z (South)
  {
    dir: [0, 0, 1],
    tileSlot: 1,
    shade: 0.9,
    corners: [
      [0, 0, 1, 0, 0],
      [1, 0, 1, 1, 0],
      [1, 1, 1, 1, 1],
      [0, 1, 1, 0, 1],
    ],
  },
  // -Z (North)
  {
    dir: [0, 0, -1],
    tileSlot: 1,
    shade: 0.8,
    corners: [
      [1, 0, 0, 0, 0],
      [0, 0, 0, 1, 0],
      [0, 1, 0, 1, 1],
      [1, 1, 0, 0, 1],
    ],
  },
];

/** Deterministic per-voxel subtle brightness & warmth variance for tactile micro-voxel realism */
function voxelMicroShade(x: number, y: number, z: number): [number, number, number] {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const v = ((h ^ (h >>> 16)) >>> 0) / 4294967295; // 0..1
  const v2 = (((h >>> 8) ^ (h >>> 21)) >>> 0) / 4294967295;
  const lum = 0.945 + v * 0.1; // 0.945 .. 1.045
  const warm = (v2 - 0.5) * 0.028;
  return [lum + warm, lum, lum - warm];
}

interface MeshBuffers {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

function createBuffers(): MeshBuffers {
  return { positions: [], normals: [], uvs: [], colors: [], indices: [] };
}

function finalizeGeometry(buf: MeshBuffers): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(buf.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3));
  geo.setIndex(buf.indices);
  geo.computeBoundingSphere();
  return geo;
}

function getTileUv(tileIdx: number) {
  const tileSize = 1 / ATLAS_GRID;
  const uvPad = 0.0025;
  const col = tileIdx % ATLAS_GRID;
  const row = Math.floor(tileIdx / ATLAS_GRID);
  return {
    uMin: col * tileSize + uvPad,
    uMax: (col + 1) * tileSize - uvPad,
    vMax: 1 - row * tileSize - uvPad,
    vMin: 1 - (row + 1) * tileSize + uvPad,
  };
}

/** Emits a scaled sub-box inside voxel (bx, by, bz) in local [0..1] coords */
function pushSubBox(
  target: MeshBuffers,
  bx: number,
  by: number,
  bz: number,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
  tiles: [number, number, number],
  fullBright: boolean,
) {
  const [vr, vg, vb] = fullBright ? [1, 1, 1] : voxelMicroShade(bx, by, bz);
  for (let f = 0; f < FACES.length; f++) {
    const face = FACES[f];
    const [dx, dy, dz] = face.dir;
    const uv = getTileUv(tiles[face.tileSlot]);
    const baseVertex = target.positions.length / 3;
    const brightness = fullBright ? 1.0 : face.shade;

    for (let c = 0; c < 4; c++) {
      const [cx, cy, cz, cu, cv] = face.corners[c];
      const lx = cx === 0 ? x0 : x1;
      const ly = cy === 0 ? y0 : y1;
      const lz = cz === 0 ? z0 : z1;
      target.positions.push((bx + lx) * VOXEL_SIZE, (by + ly) * VOXEL_SIZE, (bz + lz) * VOXEL_SIZE);
      target.normals.push(dx, dy, dz);
      target.uvs.push(cu === 0 ? uv.uMin : uv.uMax, cv === 0 ? uv.vMin : uv.vMax);
      target.colors.push(brightness * vr, brightness * vg, brightness * vb);
    }

    target.indices.push(
      baseVertex,
      baseVertex + 1,
      baseVertex + 2,
      baseVertex,
      baseVertex + 2,
      baseVertex + 3,
    );
  }
}

function isNaturalTerrainBlock(id: BlockId): boolean {
  return (
    id === BlockId.Grass ||
    id === BlockId.Dirt ||
    id === BlockId.Stone ||
    id === BlockId.Sand ||
    id === BlockId.Obsidian
  );
}

/**
 * Determines auto-orientation (0: high at -Z, 1: high at +Z, 2: high at -X, 3: high at +X)
 * and adaptive material (natural terrain moss/stone/sand vs weathered thatch roof).
 */
function resolveSlopeContext(
  blocks: Uint8Array,
  bx: number,
  by: number,
  bz: number,
  defaultTiles: [number, number, number],
): { dir: 0 | 1 | 2 | 3; tiles: [number, number, number] } {
  const nN = getBlock(blocks, bx, by, bz - 1);
  const nS = getBlock(blocks, bx, by, bz + 1);
  const nW = getBlock(blocks, bx - 1, by, bz);
  const nE = getBlock(blocks, bx + 1, by, bz);
  const below = getBlock(blocks, bx, by - 1, bz);

  // Score each cardinal side for whether it forms the "high back" of the wedge
  const isBacking = (id: BlockId) =>
    id !== BlockId.Air && !isBlockFluid(id) && id !== BlockId.Fence && id !== BlockId.Lantern && id !== BlockId.Banner;

  const sN = isBacking(nN) && nN !== BlockId.Slope ? 2 : nN === BlockId.Slope ? 1 : 0;
  const sS = isBacking(nS) && nS !== BlockId.Slope ? 2 : nS === BlockId.Slope ? 1 : 0;
  const sW = isBacking(nW) && nW !== BlockId.Slope ? 2 : nW === BlockId.Slope ? 1 : 0;
  const sE = isBacking(nE) && nE !== BlockId.Slope ? 2 : nE === BlockId.Slope ? 1 : 0;

  let dir: 0 | 1 | 2 | 3 = 0;
  let backingId: BlockId = nN;

  // Prefer the side opposite an open face so ramps face downhill / outward
  const openN = nN === BlockId.Air || isBlockFluid(nN);
  const openS = nS === BlockId.Air || isBlockFluid(nS);
  const openW = nW === BlockId.Air || isBlockFluid(nW);
  const openE = nE === BlockId.Air || isBlockFluid(nE);

  if (sN > 0 && openS) {
    dir = 0;
    backingId = nN;
  } else if (sS > 0 && openN) {
    dir = 1;
    backingId = nS;
  } else if (sW > 0 && openE) {
    dir = 2;
    backingId = nW;
  } else if (sE > 0 && openW) {
    dir = 3;
    backingId = nE;
  } else {
    // Fallback to whichever neighbor is highest-priority solid
    const best = Math.max(sN, sS, sW, sE);
    if (best > 0) {
      if (sN === best) {
        dir = 0;
        backingId = nN;
      } else if (sS === best) {
        dir = 1;
        backingId = nS;
      } else if (sW === best) {
        dir = 2;
        backingId = nW;
      } else {
        dir = 3;
        backingId = nE;
      }
    } else {
      // Check roof ridge above-neighbor (for eaves overhanging cottage walls)
      const upN = getBlock(blocks, bx, by + 1, bz - 1);
      const upS = getBlock(blocks, bx, by + 1, bz + 1);
      const upW = getBlock(blocks, bx - 1, by + 1, bz);
      const upE = getBlock(blocks, bx + 1, by + 1, bz);
      if (isBacking(upN)) dir = 0;
      else if (isBacking(upS)) dir = 1;
      else if (isBacking(upW)) dir = 2;
      else if (isBacking(upE)) dir = 3;
    }
  }

  // Adaptive material: if this slope hugs natural terrain (not a cottage wall/roof), match the hillside!
  const onNatural = isNaturalTerrainBlock(below);
  const backedByNatural = isNaturalTerrainBlock(backingId);
  if (onNatural && backedByNatural) {
    if (backingId === BlockId.Grass || below === BlockId.Grass) {
      return { dir, tiles: [TILE.GRASS_TOP, TILE.GRASS_SIDE, TILE.DIRT] };
    }
    if (backingId === BlockId.Sand || below === BlockId.Sand) {
      return { dir, tiles: [TILE.SAND, TILE.SAND, TILE.SAND] };
    }
    if (backingId === BlockId.Obsidian || below === BlockId.Obsidian) {
      return { dir, tiles: [TILE.OBSIDIAN, TILE.OBSIDIAN, TILE.OBSIDIAN] };
    }
    if (backingId === BlockId.Stone || below === BlockId.Stone) {
      return { dir, tiles: [TILE.STONE, TILE.STONE, TILE.STONE] };
    }
    return { dir, tiles: [TILE.DIRT, TILE.DIRT, TILE.DIRT] };
  }

  return { dir, tiles: defaultTiles };
}

/** Rotates local [0..1] point (x, y, z) around center (0.5, y, 0.5) for 4 slope orientations */
function rotateSlopePt(p: [number, number, number], dir: 0 | 1 | 2 | 3): [number, number, number] {
  const [x, y, z] = p;
  if (dir === 0) return [x, y, z]; // High at -Z, slopes down to +Z
  if (dir === 1) return [1 - x, y, 1 - z]; // High at +Z, slopes down to -Z
  if (dir === 2) return [1 - z, y, x]; // High at -X, slopes down to +X
  return [z, y, 1 - x]; // High at +X, slopes down to -X
}

function rotateSlopeNorm(n: [number, number, number], dir: 0 | 1 | 2 | 3): [number, number, number] {
  const [x, y, z] = n;
  if (dir === 0) return [x, y, z];
  if (dir === 1) return [-x, y, -z];
  if (dir === 2) return [-z, y, x];
  return [z, y, -x];
}

/** Emits a smooth auto-oriented 45-degree wedge inside voxel (bx, by, bz) */
function pushSlope(
  target: MeshBuffers,
  bx: number,
  by: number,
  bz: number,
  tiles: [number, number, number],
  dir: 0 | 1 | 2 | 3,
) {
  const topUv = getTileUv(tiles[0]);
  const sideUv = getTileUv(tiles[1]);
  const S = VOXEL_SIZE;
  const [vr, vg, vb] = voxelMicroShade(bx, by, bz);

  const addQuad = (
    pts: Array<[number, number, number]>,
    norm: [number, number, number],
    uv: ReturnType<typeof getTileUv>,
    shade: number,
  ) => {
    const base = target.positions.length / 3;
    const rn = rotateSlopeNorm(norm, dir);
    const uvs: Array<[number, number]> = [
      [uv.uMin, uv.vMin],
      [uv.uMax, uv.vMin],
      [uv.uMax, uv.vMax],
      [uv.uMin, uv.vMax],
    ];
    for (let i = 0; i < 4; i++) {
      const rp = rotateSlopePt(pts[i], dir);
      target.positions.push((bx + rp[0]) * S, (by + rp[1]) * S, (bz + rp[2]) * S);
      target.normals.push(rn[0], rn[1], rn[2]);
      target.uvs.push(uvs[i][0], uvs[i][1]);
      target.colors.push(shade * vr, shade * vg, shade * vb);
    }
    target.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  const addTri = (
    pts: Array<[number, number, number]>,
    norm: [number, number, number],
    uv: ReturnType<typeof getTileUv>,
    shade: number,
  ) => {
    const base = target.positions.length / 3;
    const rn = rotateSlopeNorm(norm, dir);
    const uvs: Array<[number, number]> = [
      [uv.uMin, uv.vMin],
      [uv.uMax, uv.vMin],
      [uv.uMax, uv.vMax],
    ];
    for (let i = 0; i < 3; i++) {
      const rp = rotateSlopePt(pts[i], dir);
      target.positions.push((bx + rp[0]) * S, (by + rp[1]) * S, (bz + rp[2]) * S);
      target.normals.push(rn[0], rn[1], rn[2]);
      target.uvs.push(uvs[i][0], uvs[i][1]);
      target.colors.push(shade * vr, shade * vg, shade * vb);
    }
    target.indices.push(base, base + 1, base + 2);
  };

  // Sloped top surface rising from z=1 (y=0) to z=0 (y=1)
  addQuad(
    [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 0],
      [0, 1, 0],
    ],
    [0, 0.707, 0.707],
    topUv,
    0.96,
  );
  // Back vertical face (-Z)
  addQuad(
    [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    [0, 0, -1],
    sideUv,
    0.82,
  );
  // Bottom face (-Y)
  addQuad(
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    [0, -1, 0],
    sideUv,
    0.62,
  );
  // Left & Right triangular side caps
  addTri(
    [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
    ],
    [1, 0, 0],
    sideUv,
    0.84,
  );
  addTri(
    [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
    ],
    [-1, 0, 0],
    sideUv,
    0.78,
  );
}

function vertexAO(
  blocks: Uint8Array,
  bx: number,
  by: number,
  bz: number,
  nx: number,
  ny: number,
  nz: number,
  cx: number,
  cy: number,
  cz: number,
): number {
  const ox = bx + nx;
  const oy = by + ny;
  const oz = bz + nz;
  const sx = cx === 1 ? 1 : -1;
  const sy = cy === 1 ? 1 : -1;
  const sz = cz === 1 ? 1 : -1;

  let side1 = false;
  let side2 = false;
  let corner = false;

  if (ny !== 0) {
    side1 = isBlockFullOpaqueCube(getBlock(blocks, ox + sx, oy, oz));
    side2 = isBlockFullOpaqueCube(getBlock(blocks, ox, oy, oz + sz));
    corner = isBlockFullOpaqueCube(getBlock(blocks, ox + sx, oy, oz + sz));
  } else if (nx !== 0) {
    side1 = isBlockFullOpaqueCube(getBlock(blocks, ox, oy + sy, oz));
    side2 = isBlockFullOpaqueCube(getBlock(blocks, ox, oy, oz + sz));
    corner = isBlockFullOpaqueCube(getBlock(blocks, ox, oy + sy, oz + sz));
  } else {
    side1 = isBlockFullOpaqueCube(getBlock(blocks, ox + sx, oy, oz));
    side2 = isBlockFullOpaqueCube(getBlock(blocks, ox, oy + sy, oz));
    corner = isBlockFullOpaqueCube(getBlock(blocks, ox + sx, oy + sy, oz));
  }

  const occ = side1 && side2 ? 3 : (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
  if (occ === 0) return 1.0;
  if (occ === 1) return 0.78;
  if (occ === 2) return 0.59;
  return 0.42;
}

/**
 * Builds face-culled opaque, transparent, and emissive geometries for one 16x32x16 fine-voxel chunk.
 */
export function buildChunkGeometry(
  blocks: Uint8Array,
  chunkX: number,
  chunkZ: number,
): ChunkMeshPair {
  const opaque = createBuffers();
  const transparent = createBuffers();
  const emissive = createBuffers();
  const lightSources: ChunkLightSource[] = [];

  const startX = chunkX * CHUNK_SIZE;
  const endX = Math.min(startX + CHUNK_SIZE, WORLD_SIZE_X);
  const startZ = chunkZ * CHUNK_SIZE;
  const endZ = Math.min(startZ + CHUNK_SIZE, WORLD_SIZE_Z);

  for (let y = 0; y < WORLD_SIZE_Y; y++) {
    for (let z = startZ; z < endZ; z++) {
      for (let x = startX; x < endX; x++) {
        const id = getBlock(blocks, x, y, z);
        if (id === BlockId.Air) continue;
        const def = BLOCK_BY_ID[id];
        if (!def) continue;

        if (id === BlockId.Lava) {
          lightSources.push({
            x: (x + 0.5) * VOXEL_SIZE,
            y: (y + 0.9) * VOXEL_SIZE,
            z: (z + 0.5) * VOXEL_SIZE,
            color: '#FF7624',
          });
        } else if (id === BlockId.Lantern) {
          lightSources.push({
            x: (x + 0.5) * VOXEL_SIZE,
            y: (y + 0.6) * VOXEL_SIZE,
            z: (z + 0.5) * VOXEL_SIZE,
            color: '#FFB44C',
          });
        }

        // Custom fine non-cube architectural & terrain shapes
        if (def.shape === 'slab') {
          pushSubBox(opaque, x, y, z, 0, 0, 0, 1, 0.5, 1, def.tiles, false);
          continue;
        }
        if (def.shape === 'stairs') {
          pushSubBox(opaque, x, y, z, 0, 0, 0, 1, 0.5, 1, def.tiles, false);
          pushSubBox(opaque, x, y, z, 0, 0.5, 0, 1, 1, 0.5, def.tiles, false);
          continue;
        }
        if (def.shape === 'slope') {
          const { dir, tiles } = resolveSlopeContext(blocks, x, y, z, def.tiles);
          pushSlope(opaque, x, y, z, tiles, dir);
          continue;
        }
        if (def.shape === 'fence') {
          pushSubBox(opaque, x, y, z, 0.36, 0, 0.36, 0.64, 1, 0.64, def.tiles, false);
          const nE = getBlock(blocks, x + 1, y, z);
          const nW = getBlock(blocks, x - 1, y, z);
          const nS = getBlock(blocks, x, y, z + 1);
          const nN = getBlock(blocks, x, y, z - 1);
          if (nE !== BlockId.Air && !isBlockFluid(nE)) {
            pushSubBox(opaque, x, y, z, 0.5, 0.25, 0.43, 1.0, 0.42, 0.57, def.tiles, false);
            pushSubBox(opaque, x, y, z, 0.5, 0.68, 0.43, 1.0, 0.85, 0.57, def.tiles, false);
          }
          if (nW !== BlockId.Air && !isBlockFluid(nW)) {
            pushSubBox(opaque, x, y, z, 0.0, 0.25, 0.43, 0.5, 0.42, 0.57, def.tiles, false);
            pushSubBox(opaque, x, y, z, 0.0, 0.68, 0.43, 0.5, 0.85, 0.57, def.tiles, false);
          }
          if (nS !== BlockId.Air && !isBlockFluid(nS)) {
            pushSubBox(opaque, x, y, z, 0.43, 0.25, 0.5, 0.57, 0.42, 1.0, def.tiles, false);
            pushSubBox(opaque, x, y, z, 0.43, 0.68, 0.5, 0.57, 0.85, 1.0, def.tiles, false);
          }
          if (nN !== BlockId.Air && !isBlockFluid(nN)) {
            pushSubBox(opaque, x, y, z, 0.43, 0.25, 0.0, 0.57, 0.42, 0.5, def.tiles, false);
            pushSubBox(opaque, x, y, z, 0.43, 0.68, 0.0, 0.57, 0.85, 0.5, def.tiles, false);
          }
          continue;
        }
        if (def.shape === 'lantern') {
          pushSubBox(emissive, x, y, z, 0.24, 0.14, 0.24, 0.76, 0.78, 0.76, def.tiles, true);
          pushSubBox(opaque, x, y, z, 0.18, 0.0, 0.18, 0.82, 0.14, 0.82, [11, 11, 11], false);
          pushSubBox(opaque, x, y, z, 0.18, 0.78, 0.18, 0.82, 0.92, 0.82, [11, 11, 11], false);
          continue;
        }
        if (def.shape === 'banner') {
          pushSubBox(opaque, x, y, z, 0.43, 0, 0.43, 0.57, 1.0, 0.57, [4, 5, 4], false);
          pushSubBox(opaque, x, y, z, 0.12, 0.22, 0.48, 0.88, 0.94, 0.62, def.tiles, false);
          continue;
        }

        // Standard fine cube (with face culling + AO)
        const isEmissive = Boolean(def.emissive);
        const isFluid = Boolean(def.fluid);
        const target = isEmissive ? emissive : def.transparent ? transparent : opaque;

        for (let f = 0; f < FACES.length; f++) {
          const face = FACES[f];
          const [dx, dy, dz] = face.dir;
          const neighbor = getBlock(blocks, x + dx, y + dy, z + dz);

          if (def.transparent || isFluid) {
            if (neighbor === id) continue;
            if (isFluid && isBlockFullOpaqueCube(neighbor)) continue;
          } else {
            if (isBlockFullOpaqueCube(neighbor)) continue;
          }

          const fluidDrop = isFluid && getBlock(blocks, x, y + 1, z) !== id ? 0.12 : 0;
          const uv = getTileUv(def.tiles[face.tileSlot]);
          const baseVertex = target.positions.length / 3;
          const aoValues: number[] = [];

          const [vr, vg, vb] =
            def.transparent || isEmissive ? [1, 1, 1] : voxelMicroShade(x, y, z);

          for (let c = 0; c < 4; c++) {
            const [cx, cy, cz, cu, cv] = face.corners[c];
            const py = cy === 1 ? y + cy - fluidDrop : y + cy;
            target.positions.push((x + cx) * VOXEL_SIZE, py * VOXEL_SIZE, (z + cz) * VOXEL_SIZE);
            target.normals.push(dx, dy, dz);
            target.uvs.push(cu === 0 ? uv.uMin : uv.uMax, cv === 0 ? uv.vMin : uv.vMax);

            const ao =
              def.transparent || isEmissive
                ? 1.0
                : vertexAO(blocks, x, y, z, dx, dy, dz, cx, cy, cz);
            aoValues.push(ao);
            const brightness = isEmissive ? 1.0 : face.shade * ao;
            target.colors.push(brightness * vr, brightness * vg, brightness * vb);
          }

          if (aoValues[0] + aoValues[2] > aoValues[1] + aoValues[3]) {
            target.indices.push(
              baseVertex,
              baseVertex + 1,
              baseVertex + 2,
              baseVertex,
              baseVertex + 2,
              baseVertex + 3,
            );
          } else {
            target.indices.push(
              baseVertex + 1,
              baseVertex + 2,
              baseVertex + 3,
              baseVertex + 1,
              baseVertex + 3,
              baseVertex,
            );
          }
        }
      }
    }
  }

  return {
    opaqueGeo: finalizeGeometry(opaque),
    transparentGeo: finalizeGeometry(transparent),
    emissiveGeo: finalizeGeometry(emissive),
    lightSources,
  };
}
