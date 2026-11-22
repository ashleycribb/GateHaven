import React, { useEffect, useRef, useState } from 'react';
import {
  Compass,
  Expand,
  Map as MapIcon,
  Minimize2,
  Scroll,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  BlockId,
  DungeonId,
  MinimapSnapshot,
  WORLD_SIZE_X,
  WORLD_SIZE_Y,
  WORLD_SIZE_Z,
} from '../types/blockhaven';
import { BLOCK_BY_ID, isBlockSolid } from '../engine/blocks';
import { DUNGEON_BY_ID, REALM_BY_ID } from '../rpg/rpgData';
import { getBlock } from '../engine/worldGen';

interface MinimapHudProps {
  getSnapshot: () => MinimapSnapshot | null;
  expanded: boolean;
  onSetExpanded: (open: boolean) => void;
  dungeonMapScrolls: number;
  hasTracking: boolean;
  onUseDungeonMapScroll: () => void;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const n = parseInt(clean, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function getDungeonPalette(dungeonId: DungeonId | null): {
  floor: [number, number, number];
  floorAlt: [number, number, number];
  wall: [number, number, number];
  accent: string;
} {
  const theme = dungeonId ? DUNGEON_BY_ID[dungeonId]?.theme : 'crypt';
  switch (theme) {
    case 'ember':
      return { floor: [66, 44, 42], floorAlt: [56, 36, 35], wall: [168, 108, 92], accent: '#F97316' };
    case 'frost':
      return { floor: [36, 62, 86], floorAlt: [30, 52, 74], wall: [125, 196, 232], accent: '#38BDF8' };
    case 'sand':
      return { floor: [84, 70, 44], floorAlt: [72, 60, 38], wall: [214, 184, 122], accent: '#EAB308' };
    case 'sky':
      return { floor: [52, 54, 88], floorAlt: [44, 46, 76], wall: [167, 152, 234], accent: '#A78BFA' };
    case 'abyss':
      return { floor: [48, 30, 56], floorAlt: [38, 24, 46], wall: [176, 98, 134], accent: '#F43F5E' };
    default:
      return { floor: [42, 58, 76], floorAlt: [35, 49, 66], wall: [138, 164, 192], accent: '#38BDF8' };
  }
}

/** Bakes a 64x64 top-down color canvas for the World terrain or Dungeon blueprint */
function bakeBaseTerrain(
  blocks: Uint8Array,
  isDungeon: boolean,
  dungeonId: DungeonId | null,
): { canvas: HTMLCanvasElement; walkableMask: Uint8Array; wallMask: Uint8Array } {
  const canvas = document.createElement('canvas');
  canvas.width = WORLD_SIZE_X;
  canvas.height = WORLD_SIZE_Z;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(WORLD_SIZE_X, WORLD_SIZE_Z);
  const data = img.data;
  const walkableMask = new Uint8Array(WORLD_SIZE_X * WORLD_SIZE_Z);
  const wallMask = new Uint8Array(WORLD_SIZE_X * WORLD_SIZE_Z);

  if (isDungeon) {
    const pal = getDungeonPalette(dungeonId);

    // First pass: mark walkable cells
    for (let z = 0; z < WORLD_SIZE_Z; z++) {
      for (let x = 0; x < WORLD_SIZE_X; x++) {
        const floor = getBlock(blocks, x, 1, z);
        const mid = getBlock(blocks, x, 3, z);
        if (floor !== BlockId.Air && !isBlockSolid(mid)) {
          walkableMask[z * WORLD_SIZE_X + x] = 1;
        }
      }
    }

    // Second pass: paint walkable floor, traps, and perimeter walls bordering walkable rooms
    for (let z = 0; z < WORLD_SIZE_Z; z++) {
      for (let x = 0; x < WORLD_SIZE_X; x++) {
        const idx = z * WORLD_SIZE_X + x;
        const p = idx * 4;
        if (walkableMask[idx] === 1) {
          const floor = getBlock(blocks, x, 1, z);
          if (floor === BlockId.Lava) {
            data[p] = 249;
            data[p + 1] = 115;
            data[p + 2] = 22;
            data[p + 3] = 255;
          } else {
            const checker = (x + z) % 2 === 0;
            const c = checker ? pal.floor : pal.floorAlt;
            data[p] = c[0];
            data[p + 1] = c[1];
            data[p + 2] = c[2];
            data[p + 3] = 255;
          }
          continue;
        }

        // Check if adjacent (8-way) to any walkable floor tile -> perimeter wall or pillar
        let bordersRoom = false;
        for (let dz = -1; dz <= 1 && !bordersRoom; dz++) {
          for (let dx = -1; dx <= 1 && !bordersRoom; dx++) {
            const nx = x + dx;
            const nz = z + dz;
            if (nx >= 0 && nx < WORLD_SIZE_X && nz >= 0 && nz < WORLD_SIZE_Z) {
              if (walkableMask[nz * WORLD_SIZE_X + nx] === 1) bordersRoom = true;
            }
          }
        }

        if (bordersRoom) {
          wallMask[idx] = 1;
          data[p] = pal.wall[0];
          data[p + 1] = pal.wall[1];
          data[p + 2] = pal.wall[2];
          data[p + 3] = 255;
        } else {
          data[p] = 7;
          data[p + 1] = 11;
          data[p + 2] = 20;
          data[p + 3] = 255;
        }
      }
    }
  } else {
    // Overworld / Other Realm top-down elevation-shaded voxel map
    for (let z = 0; z < WORLD_SIZE_Z; z++) {
      for (let x = 0; x < WORLD_SIZE_X; x++) {
        const idx = z * WORLD_SIZE_X + x;
        const p = idx * 4;
        let foundBlock: BlockId = BlockId.Air;
        let foundY = 0;
        for (let y = WORLD_SIZE_Y - 1; y >= 0; y--) {
          const b = getBlock(blocks, x, y, z);
          if (b !== BlockId.Air) {
            foundBlock = b;
            foundY = y;
            break;
          }
        }
        if (foundBlock === BlockId.Air) {
          // Sky void (Aether Isles)
          data[p] = 15;
          data[p + 1] = 28;
          data[p + 2] = 48;
          data[p + 3] = 255;
          continue;
        }

        const def = BLOCK_BY_ID[foundBlock];
        const [r, g, b] = hexToRgb(def?.swatchColor ?? '#64748B');
        // Subtle height shading so hills, cottages, bridges, and rivers pop clearly
        const shade =
          foundBlock === BlockId.Water || foundBlock === BlockId.Lava
            ? 1.0
            : 0.72 + Math.min(0.45, (foundY / 22) * 0.45);
        data[p] = Math.min(255, Math.round(r * shade));
        data[p + 1] = Math.min(255, Math.round(g * shade));
        data[p + 2] = Math.min(255, Math.round(b * shade));
        data[p + 3] = 255;
      }
    }
  }

  ctx.putImageData(img, 0, 0);
  return { canvas, walkableMask, wallMask };
}

interface DrawMapOptions {
  canvas: HTMLCanvasElement;
  snapshot: MinimapSnapshot;
  baseTerrain: HTMLCanvasElement;
  zoom: 1 | 2;
  showLabels: boolean;
  hasTracking: boolean;
}

function drawMapCanvas({
  canvas,
  snapshot,
  baseTerrain,
  zoom,
  showLabels,
  hasTracking,
}: DrawMapOptions): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssSize = canvas.clientWidth || 176;
  const targetPx = Math.round(cssSize * dpr);
  if (canvas.width !== targetPx || canvas.height !== targetPx) {
    canvas.width = targetPx;
    canvas.height = targetPx;
  }

  ctx.save();
  ctx.scale(dpr, dpr);
  const size = cssSize;

  // Background fill (dark cartographic slate)
  ctx.fillStyle = '#060A12';
  ctx.fillRect(0, 0, size, size);

  // Viewport math (zoom=1 shows full 64x64 grid; zoom=2 centers smoothly on player)
  const viewTiles = zoom === 2 ? 30 : WORLD_SIZE_X;
  const halfView = viewTiles / 2;
  const centerX =
    zoom === 2
      ? Math.max(halfView, Math.min(WORLD_SIZE_X - halfView, snapshot.playerX))
      : WORLD_SIZE_X / 2;
  const centerZ =
    zoom === 2
      ? Math.max(halfView, Math.min(WORLD_SIZE_Z - halfView, snapshot.playerZ))
      : WORLD_SIZE_Z / 2;

  const tilePx = size / viewTiles;
  const worldToCanvasX = (gx: number) => (gx - (centerX - halfView)) * tilePx;
  const worldToCanvasY = (gz: number) => (gz - (centerZ - halfView)) * tilePx;

  // 1. Draw base terrain or dungeon blueprint
  ctx.imageSmoothingEnabled = false;
  const originX = worldToCanvasX(0);
  const originY = worldToCanvasY(0);
  const fullW = WORLD_SIZE_X * tilePx;
  const fullH = WORLD_SIZE_Z * tilePx;
  ctx.drawImage(baseTerrain, originX, originY, fullW, fullH);

  // 2. If in a Dungeon, apply Fog of War (dark unless explored OR Dungeon Map obtained!)
  if (snapshot.isDungeon) {
    const startX = Math.max(0, Math.floor(centerX - halfView));
    const endX = Math.min(WORLD_SIZE_X - 1, Math.ceil(centerX + halfView));
    const startZ = Math.max(0, Math.floor(centerZ - halfView));
    const endZ = Math.min(WORLD_SIZE_Z - 1, Math.ceil(centerZ + halfView));

    for (let gz = startZ; gz <= endZ; gz++) {
      const cy = worldToCanvasY(gz);
      for (let gx = startX; gx <= endX; gx++) {
        const fog = snapshot.exploredGrid[gz * WORLD_SIZE_X + gx];
        if (!snapshot.dungeonRevealed) {
          if (fog === 0) {
            ctx.fillStyle = '#060A12';
            ctx.fillRect(worldToCanvasX(gx) - 0.3, cy - 0.3, tilePx + 0.6, tilePx + 0.6);
          } else if (fog === 1) {
            // Explored memory: dim slightly so active line-of-sight stands out
            ctx.fillStyle = 'rgba(6, 10, 18, 0.32)';
            ctx.fillRect(worldToCanvasX(gx), cy, tilePx + 0.4, tilePx + 0.4);
          }
        } else if (fog !== 2) {
          // Dungeon Map active: subtle veil over rooms outside immediate LOS
          ctx.fillStyle = 'rgba(6, 10, 18, 0.16)';
          ctx.fillRect(worldToCanvasX(gx), cy, tilePx + 0.4, tilePx + 0.4);
        }
      }
    }

    // Subtle cartographic grid lines over dungeon map
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    const gridStep = 8;
    for (let g = 0; g <= WORLD_SIZE_X; g += gridStep) {
      const gx = worldToCanvasX(g);
      const gy = worldToCanvasY(g);
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(size, gy);
      ctx.stroke();
    }
  }

  const isCellRevealed = (gx: number, gz: number): boolean => {
    if (!snapshot.isDungeon || snapshot.dungeonRevealed) return true;
    const ix = Math.max(0, Math.min(WORLD_SIZE_X - 1, Math.floor(gx)));
    const iz = Math.max(0, Math.min(WORLD_SIZE_Z - 1, Math.floor(gz)));
    return snapshot.exploredGrid[iz * WORLD_SIZE_X + ix] > 0;
  };

  const isCellActiveLos = (gx: number, gz: number): boolean => {
    if (!snapshot.isDungeon) return true;
    const ix = Math.max(0, Math.min(WORLD_SIZE_X - 1, Math.floor(gx)));
    const iz = Math.max(0, Math.min(WORLD_SIZE_Z - 1, Math.floor(gz)));
    return snapshot.exploredGrid[iz * WORLD_SIZE_X + ix] === 2;
  };

  // 3. Draw Discovered Procedural Room Labels (Expanded Map)
  if (showLabels && snapshot.isDungeon && snapshot.rooms.length > 0) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 10px ui-sans-serif, system-ui, sans-serif';
    for (const room of snapshot.rooms) {
      const rx = (room.x0 + room.x1) / 2;
      const rz = (room.z0 + room.z1) / 2;
      // Show label if Dungeon Map active or if at least 2 corners / center of room explored
      const roomKnown =
        snapshot.dungeonRevealed ||
        isCellRevealed(rx, rz) ||
        isCellRevealed(room.x0 + 2, room.z0 + 2) ||
        isCellRevealed(room.x1 - 2, room.z1 - 2);
      if (!roomKnown) continue;

      const cx = worldToCanvasX(rx);
      const cy = worldToCanvasY(rz);
      const textW = ctx.measureText(room.label).width;
      ctx.fillStyle = 'rgba(6, 10, 18, 0.72)';
      ctx.fillRect(cx - textW / 2 - 4, cy - 8, textW + 8, 16);
      ctx.fillStyle = room.kind === 'boss' ? '#FDA4AF' : room.kind === 'map_room' ? '#FDE68A' : '#E2E8F0';
      ctx.fillText(room.label, cx, cy);
    }
  }

  // 4. Draw Portals, Shrine, Quest Board, Exit, Map Pedestal
  for (const p of snapshot.portals) {
    if (!isCellRevealed(p.x, p.z)) continue;
    const cx = worldToCanvasX(p.x);
    const cy = worldToCanvasY(p.z);
    const r = showLabels ? 6 : 4;

    ctx.save();
    ctx.translate(cx, cy);
    if (p.kind === 'shrine') {
      // Bright sky star/diamond
      ctx.fillStyle = '#38BDF8';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -r - 1.5);
      ctx.lineTo(r + 1, 0);
      ctx.lineTo(0, r + 1.5);
      ctx.lineTo(-r - 1, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (p.kind === 'quest_board') {
      ctx.fillStyle = '#F59E0B';
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 1.2;
      ctx.fillRect(-r + 0.5, -r + 0.5, (r - 0.5) * 2, (r - 0.5) * 2);
      ctx.strokeRect(-r + 0.5, -r + 0.5, (r - 0.5) * 2, (r - 0.5) * 2);
    } else if (p.kind === 'map_pedestal') {
      // Glowing amber scroll marker
      ctx.fillStyle = '#FBBF24';
      ctx.strokeStyle = '#FEF3C7';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else {
      // Portal / Dungeon Gate / Dungeon Exit diamond
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    if (showLabels) {
      ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(p.label, cx, cy + r + 3);
    }
  }

  // 5. Draw Unopened Loot Chests
  for (const ch of snapshot.chests) {
    if (ch.opened || !isCellRevealed(ch.x, ch.z)) continue;
    const cx = worldToCanvasX(ch.x);
    const cy = worldToCanvasY(ch.z);
    const s = showLabels ? 4.5 : 3;
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = '#78350F';
    ctx.lineWidth = 1.2;
    ctx.fillRect(cx - s, cy - s, s * 2, s * 2);
    ctx.strokeRect(cx - s, cy - s, s * 2, s * 2);
  }

  // 6. Draw Dropped Graves
  for (const g of snapshot.graves) {
    const cx = worldToCanvasX(g.x);
    const cy = worldToCanvasY(g.z);
    ctx.strokeStyle = '#FB7185';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 4);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.moveTo(cx + 4, cy - 4);
    ctx.lineTo(cx - 4, cy + 4);
    ctx.stroke();
  }

  // 7. Draw Friendly NPCs (World Mode)
  for (const npc of snapshot.npcs) {
    const cx = worldToCanvasX(npc.x);
    const cy = worldToCanvasY(npc.z);
    const r = showLabels ? 4 : 2.8;
    ctx.fillStyle = '#2DD4BF';
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    if (showLabels) {
      ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#99F6E4';
      ctx.fillText(npc.name, cx, cy + r + 2);
    }
  }

  // 8. Draw Creatures / Monsters / Boss
  const creatureRadarDist = hasTracking ? 24 : 15;
  for (const cr of snapshot.creatures) {
    const dist = Math.hypot(cr.x - snapshot.playerX, cr.z - snapshot.playerZ);
    if (snapshot.isDungeon) {
      // In dungeons: show boss when Dungeon Map active OR in LOS; normal mobs in LOS (or close with Tracking)
      const visibleMob = cr.isBoss
        ? snapshot.dungeonRevealed || isCellActiveLos(cr.x, cr.z)
        : isCellActiveLos(cr.x, cr.z) || (snapshot.dungeonRevealed && dist < 24);
      if (!visibleMob) continue;
    } else {
      if (!cr.isBoss && dist > creatureRadarDist) continue;
    }

    const cx = worldToCanvasX(cr.x);
    const cy = worldToCanvasY(cr.z);
    if (cr.isBoss) {
      const r = showLabels ? 6.5 : 4.8;
      ctx.fillStyle = '#F43F5E';
      ctx.strokeStyle = '#FFF1F2';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (showLabels) {
        ctx.font = '700 10px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#FDA4AF';
        ctx.fillText(`BOSS: ${cr.name}`, cx, cy - r - 3);
      }
    } else {
      const r = showLabels ? 3.5 : 2.5;
      ctx.fillStyle = cr.hostile ? '#FB7185' : '#86EFAC';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 9. Draw Player View Cone & Directional Arrow
  const px = worldToCanvasX(snapshot.playerX);
  const py = worldToCanvasY(snapshot.playerZ);
  const fx = -Math.sin(snapshot.playerYaw);
  const fy = -Math.cos(snapshot.playerYaw);
  const heading = Math.atan2(fy, fx);

  // Subtle vision cone
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(heading);
  const coneLen = showLabels ? 28 : 18;
  const coneGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, coneLen);
  coneGrad.addColorStop(0, 'rgba(56, 189, 248, 0.34)');
  coneGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = coneGrad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, coneLen, -0.52, 0.52);
  ctx.closePath();
  ctx.fill();

  // Player directional chevron
  const arrowSize = showLabels ? 7.5 : 5.8;
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0284C7';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(arrowSize, 0);
  ctx.lineTo(-arrowSize * 0.72, -arrowSize * 0.62);
  ctx.lineTo(-arrowSize * 0.32, 0);
  ctx.lineTo(-arrowSize * 0.72, arrowSize * 0.62);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 10. Crisp Cardinal Compass Letters (N/E/S/W)
  ctx.font = '700 9px ui-monospace, SFMono-Regular, monospace';
  ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('N', size / 2, 4);
  ctx.textBaseline = 'bottom';
  ctx.fillText('S', size / 2, size - 3);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('W', 5, size / 2);
  ctx.textAlign = 'right';
  ctx.fillText('E', size - 5, size / 2);

  ctx.restore();
}

export const MinimapHud: React.FC<MinimapHudProps> = ({
  getSnapshot,
  expanded,
  onSetExpanded,
  dungeonMapScrolls,
  hasTracking,
  onUseDungeonMapScroll,
}) => {
  const miniCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullCanvasRef = useRef<HTMLCanvasElement>(null);
  const baseCacheRef = useRef<{
    version: number;
    isDungeon: boolean;
    dungeonId: DungeonId | null;
    canvas: HTMLCanvasElement;
  } | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [zoom, setZoom] = useState<1 | 2>(1);
  const [hudMeta, setHudMeta] = useState<{
    isDungeon: boolean;
    dungeonId: DungeonId | null;
    realmId: MinimapSnapshot['realmId'];
    dungeonRevealed: boolean;
    exploredPercent: number;
    playerX: number;
    playerZ: number;
    discoveredRooms: Array<{ id: string; label: string; kind: string; discovered: boolean }>;
    portalList: Array<{ id: string; label: string; color: string; kind: string }>;
    unopenedChests: number;
  }>({
    isDungeon: false,
    dungeonId: null,
    realmId: 'home',
    dungeonRevealed: false,
    exploredPercent: 100,
    playerX: 32,
    playerZ: 32,
    discoveredRooms: [],
    portalList: [],
    unopenedChests: 0,
  });

  // Automatically switch to 2x zoom inside dungeons if desired, or keep user's choice
  useEffect(() => {
    let rafId = 0;
    let lastDraw = 0;
    let lastMetaUpdate = 0;

    const tick = (now: number) => {
      rafId = window.requestAnimationFrame(tick);
      if (now - lastDraw < 60) return;
      lastDraw = now;

      const snap = getSnapshot();
      if (!snap) return;

      // Rebuild cached 64x64 base terrain only when world/dungeon loads or blocks change
      let cache = baseCacheRef.current;
      if (
        !cache ||
        cache.version !== snap.terrainVersion ||
        cache.isDungeon !== snap.isDungeon ||
        cache.dungeonId !== snap.dungeonId
      ) {
        const baked = bakeBaseTerrain(snap.blocks, snap.isDungeon, snap.dungeonId);
        cache = {
          version: snap.terrainVersion,
          isDungeon: snap.isDungeon,
          dungeonId: snap.dungeonId,
          canvas: baked.canvas,
        };
        baseCacheRef.current = cache;
      }

      const baseTerrain = cache.canvas;

      if (!collapsed && miniCanvasRef.current) {
        drawMapCanvas({
          canvas: miniCanvasRef.current,
          snapshot: snap,
          baseTerrain,
          zoom,
          showLabels: false,
          hasTracking,
        });
      }

      if (expanded && fullCanvasRef.current) {
        drawMapCanvas({
          canvas: fullCanvasRef.current,
          snapshot: snap,
          baseTerrain,
          zoom: 1,
          showLabels: true,
          hasTracking,
        });
      }

      // Refresh React metadata readout at ~5Hz to avoid needless re-renders
      if (now - lastMetaUpdate > 200) {
        lastMetaUpdate = now;
        const discoveredRooms = snap.rooms.map((room) => {
          const cx = Math.floor((room.x0 + room.x1) / 2);
          const cz = Math.floor((room.z0 + room.z1) / 2);
          const discovered =
            snap.dungeonRevealed ||
            snap.exploredGrid[cz * WORLD_SIZE_X + cx] > 0 ||
            snap.exploredGrid[(room.z0 + 2) * WORLD_SIZE_X + (room.x0 + 2)] > 0 ||
            snap.exploredGrid[(room.z1 - 2) * WORLD_SIZE_X + (room.x1 - 2)] > 0;
          return { id: room.id, label: room.label, kind: room.kind, discovered };
        });

        setHudMeta({
          isDungeon: snap.isDungeon,
          dungeonId: snap.dungeonId,
          realmId: snap.realmId,
          dungeonRevealed: snap.dungeonRevealed,
          exploredPercent: snap.exploredPercent,
          playerX: Math.round(snap.playerX),
          playerZ: Math.round(snap.playerZ),
          discoveredRooms,
          portalList: snap.portals.map((p) => ({
            id: p.id,
            label: p.label,
            color: p.color,
            kind: p.kind,
          })),
          unopenedChests: snap.chests.filter((c) => !c.opened).length,
        });
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [getSnapshot, collapsed, expanded, zoom, hasTracking]);

  // Close expanded map on Escape or M
  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyM' || e.code === 'Tab') {
        e.preventDefault();
        onSetExpanded(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onSetExpanded]);

  const locationTitle =
    hudMeta.isDungeon && hudMeta.dungeonId
      ? DUNGEON_BY_ID[hudMeta.dungeonId]?.name ?? 'Dungeon'
      : REALM_BY_ID[hudMeta.realmId]?.name ?? 'World';

  return (
    <>
      {/* CORNER MINI-MAP HUD (Top-Right) */}
      <aside
        aria-label={hudMeta.isDungeon ? 'Dungeon Auto-Map' : 'World Mini-Map'}
        className="pointer-events-auto fixed right-3 top-14 z-20"
      >
        {collapsed ? (
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            title="Show Mini-Map"
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#5E4D3B] bg-[#1A1511]/94 px-3 py-2 text-xs font-semibold text-[#EDE2CC] shadow-lg hover:bg-[#272019] cursor-pointer"
          >
            <MapIcon className="h-3.5 w-3.5 text-[#D4A65C]" />
            <span>{hudMeta.isDungeon ? `Dungeon Map (${hudMeta.exploredPercent}%)` : 'World Map'}</span>
          </button>
        ) : (
          <div className="w-[184px] sm:w-[202px] overflow-hidden rounded-xl border border-[#5E4D3B] bg-[#1A1511]/94 text-[#EDE2CC] shadow-xl">
            {/* Compact Header */}
            <div className="flex items-center justify-between gap-1 border-b border-[#3F3327] bg-[#221C16] px-2.5 py-1.5">
              <div className="min-w-0">
                <p className="font-[var(--font-display)] truncate text-[11px] font-bold text-[#F3E9D6] leading-tight">
                  {hudMeta.isDungeon ? 'Dungeon Auto-Map' : 'World Map'}
                </p>
                <p className="truncate text-[10px] text-[#B8A990] tabular-nums leading-tight">
                  {hudMeta.isDungeon
                    ? hudMeta.dungeonRevealed
                      ? 'Full Map Active'
                      : `Explored ${hudMeta.exploredPercent}%`
                    : locationTitle.split(' (')[0]}
                </p>
              </div>
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setZoom((z) => (z === 1 ? 2 : 1))}
                  title={zoom === 1 ? 'Zoom In (2×)' : 'Full Overview (1×)'}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
                >
                  {zoom === 1 ? <ZoomIn className="h-3.5 w-3.5" /> : <ZoomOut className="h-3.5 w-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => onSetExpanded(true)}
                  title="Expand Full Map (Key M)"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
                >
                  <Expand className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  title="Minimize Map"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Live Map Canvas */}
            <div
              className="relative aspect-square w-full cursor-pointer bg-[#120F0C]"
              onClick={() => onSetExpanded(true)}
              title="Click or press M to expand full map"
            >
              <canvas ref={miniCanvasRef} className="block h-full w-full" />
            </div>

            {/* Footer: Coords + Dungeon Map Scroll Action */}
            <div className="border-t border-[#3F3327] bg-[#1E1813] px-2.5 py-1.5 space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-[#B8A990] tabular-nums">
                <span>
                  X {hudMeta.playerX} · Z {hudMeta.playerZ}
                </span>
                <button
                  type="button"
                  onClick={() => onSetExpanded(true)}
                  className="font-semibold text-[#D9AD62] hover:text-[#EBC47D] cursor-pointer"
                >
                  [M] Full Map
                </button>
              </div>

              {hudMeta.isDungeon && !hudMeta.dungeonRevealed && (
                dungeonMapScrolls > 0 ? (
                  <button
                    type="button"
                    onClick={onUseDungeonMapScroll}
                    className="flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E2BA72] bg-[#B7833B] px-2.5 py-1.5 text-[11px] font-bold text-[#1A140F] hover:bg-[#C89347] transition-colors cursor-pointer"
                  >
                    <Scroll className="h-3.5 w-3.5" />
                    Use Dungeon Map ({dungeonMapScrolls})
                  </button>
                ) : (
                  <p className="text-[10px] leading-snug text-[#B0A188]">
                    Uncharted · Explore rooms or find the Map Pedestal
                  </p>
                )
              )}
            </div>
          </div>
        )}
      </aside>

      {/* EXPANDED FULL MAP OVERLAY ([M] or Click Expand) */}
      {expanded && (
        <div
          data-gamepad-scope="modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#0D0A08]/84 p-4"
          onClick={() => onSetExpanded(false)}
        >
          <div
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#65523D] bg-[#1C1713] text-[#EDE2CC] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#46392C] bg-[#231C16] px-5 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <Compass className="h-5 w-5 shrink-0 text-[#D4A65C]" />
                <div className="min-w-0">
                  <h2 className="truncate font-[var(--font-display)] text-lg font-bold text-[#F3E9D6]">
                    {locationTitle}
                  </h2>
                  <p className="text-xs text-[#B8A990] tabular-nums">
                    {hudMeta.isDungeon
                      ? hudMeta.dungeonRevealed
                        ? 'Dungeon Map Active · All Procedural Rooms Revealed'
                        : `Auto-Mapping Active · ${hudMeta.exploredPercent}% Explored`
                      : `World Terrain Map · Position X ${hudMeta.playerX}, Z ${hudMeta.playerZ}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onSetExpanded(false)}
                aria-label="Close Full Map"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#B8A990] hover:bg-[#322820] hover:text-[#F3E9D6] cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* 2-Column Body: Large Map Canvas + Cartographic Directory & Legend */}
            <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-[minmax(0,1fr)_236px]">
              <div className="relative aspect-square w-full max-w-[440px] justify-self-center overflow-hidden rounded-xl border border-[#4E4032] bg-[#120F0C]">
                <canvas ref={fullCanvasRef} className="block h-full w-full" />
              </div>

              <div className="flex flex-col justify-between gap-4">
                <div className="space-y-4">
                  {/* Dungeon Exploration Progress & Scroll Activation */}
                  {hudMeta.isDungeon && (
                    <div className="space-y-2.5 border-b border-[#46392C] pb-4">
                      <div className="flex items-center justify-between text-xs tabular-nums">
                        <span className="font-semibold text-[#D6C8AF]">Exploration</span>
                        <span className="font-bold text-[#D9AD62]">
                          {hudMeta.dungeonRevealed ? '100% (Mapped)' : `${hudMeta.exploredPercent}%`}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded bg-[#2D251E]">
                        <div
                          className={`h-full transition-all ${
                            hudMeta.dungeonRevealed ? 'bg-[#D4A65C]' : 'bg-[#9E875E]'
                          }`}
                          style={{ width: `${hudMeta.exploredPercent}%` }}
                        />
                      </div>

                      {!hudMeta.dungeonRevealed && (
                        dungeonMapScrolls > 0 ? (
                          <button
                            type="button"
                            onClick={onUseDungeonMapScroll}
                            className="mt-1 flex w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[#E2BA72] bg-[#B7833B] px-3 py-2 text-xs font-bold text-[#1A140F] hover:bg-[#C89347] transition-colors cursor-pointer"
                          >
                            <Scroll className="h-3.5 w-3.5" />
                            Use Dungeon Map Scroll ({dungeonMapScrolls})
                          </button>
                        ) : (
                          <p className="text-xs leading-relaxed text-[#B8A990]">
                            Dark corridors populate automatically as you walk. Find the glowing{' '}
                            <strong className="text-[#D9AD62]">Map Pedestal</strong> inside this
                            dungeon—or buy a <strong className="text-[#EDE2CC]">Dungeon Map Scroll</strong>{' '}
                            from Kael in Elderglen—to reveal all rooms at once.
                          </p>
                        )
                      )}
                    </div>
                  )}

                  {/* Discovered Rooms (Dungeon) or Landmarks (World) */}
                  {hudMeta.isDungeon ? (
                    <div className="space-y-2 border-b border-[#46392C] pb-4">
                      <p className="text-xs font-semibold text-[#D6C8AF]">Procedural Chambers</p>
                      <ul className="space-y-1.5 text-xs">
                        {hudMeta.discoveredRooms.map((r) => (
                          <li key={r.id} className="flex items-center justify-between gap-2">
                            <span className={r.discovered ? 'text-[#EFE4CE]' : 'text-[#7F7362]'}>
                              {r.discovered ? r.label : 'Uncharted Chamber'}
                            </span>
                            <span className="text-[11px] text-[#B0A188]">
                              {r.discovered
                                ? r.kind === 'boss'
                                  ? 'Boss'
                                  : r.kind === 'map_room'
                                    ? 'Map'
                                    : 'Mapped'
                                : 'Dark'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    hudMeta.portalList.length > 0 && (
                      <div className="space-y-2 border-b border-[#46392C] pb-4">
                        <p className="text-xs font-semibold text-[#D6C8AF]">Realm Landmarks</p>
                        <ul className="space-y-1.5 text-xs">
                          {hudMeta.portalList.slice(0, 7).map((p) => (
                            <li key={p.id} className="flex items-center gap-2 text-[#E8DCC5]">
                              <span
                                className="inline-block h-2.5 w-2.5 shrink-0 rotate-45"
                                style={{ backgroundColor: p.color }}
                              />
                              <span className="truncate">{p.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  )}

                  {/* Clean Cartographic Legend */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-[#D6C8AF]">Map Key</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] text-[#CFC2AA]">
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rounded-xs bg-[#F3E9D6] ring-1 ring-[#C99A4E]" />
                        You
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#7EA56E]" />
                        {hudMeta.isDungeon ? 'Exit Portal' : 'Portals'}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-2.5 w-2.5 bg-[#D4A65C]" />
                        Loot Chest ({hudMeta.unopenedChests})
                      </span>
                      {hudMeta.isDungeon ? (
                        <>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#DFB461]" />
                            Map Pedestal
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 bg-[#C46B34]" />
                            Lava Trap
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#B54B3E] ring-1 ring-[#F3E9D6]" />
                            Dungeon Boss
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rotate-45 bg-[#CBB58D]" />
                            Shrine
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#77A89D]" />
                            Villagers
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#C76759]" />
                            Hostiles
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-[#46392C] pt-3 text-[11px] text-[#B0A188]">
                  <span>Scrolls: {dungeonMapScrolls}</span>
                  <span>Press M / Esc / B to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
