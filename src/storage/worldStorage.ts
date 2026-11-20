import {
  AvatarConfig,
  BlockId,
  NpcDefinition,
  RpgPlayerState,
  SafetyReportStub,
  SavedWorldMeta,
  SavedWorldRecord,
  UiPrefs,
  Vec3,
  WORLD_SIZE_X,
  WORLD_SIZE_Y,
  WORLD_SIZE_Z,
  WorldTemplateId,
} from '../types/blockhaven';
import { DEFAULT_AVATAR } from '../engine/avatarBuilder';
import { countSolidBlocks, generateWorldFromTemplate, TOTAL_VOXELS } from '../engine/worldGen';
import { createInitialRpgState } from '../rpg/rpgData';

const DB_NAME = 'blockhaven_v1_db';
const DB_VERSION = 1;
const WORLDS_STORE = 'worlds';

const LS_WORLDS_KEY = 'blockhaven_v1_worlds_fallback';
const LS_AVATAR_KEY = 'blockhaven_v1_avatar';
const LS_SAFETY_KEY = 'blockhaven_v1_safety_log';
const LS_RPG_KEY = 'blockhaven_v2_isekai_rpg';
const LS_UI_PREFS_KEY = 'gatehaven_v1_ui_prefs';

/* ============================================================================
 * RLE Encoding / Decoding for Local Persistence
 * ============================================================================ */

export function encodeRle(blocks: Uint8Array): number[] {
  const out: number[] = [];
  if (blocks.length === 0) return out;
  let cur = blocks[0];
  let run = 1;
  for (let i = 1; i < blocks.length; i++) {
    const v = blocks[i];
    if (v === cur) {
      run++;
    } else {
      out.push(cur, run);
      cur = v;
      run = 1;
    }
  }
  out.push(cur, run);
  return out;
}

export function decodeRle(rle: number[]): Uint8Array {
  const out = new Uint8Array(TOTAL_VOXELS);
  let pos = 0;
  for (let i = 0; i < rle.length; i += 2) {
    const val = rle[i] & 0xff;
    const count = rle[i + 1] ?? 0;
    const end = Math.min(pos + count, TOTAL_VOXELS);
    out.fill(val, pos, end);
    pos = end;
  }
  return out;
}

/* ============================================================================
 * Compact Shareable World Code ("BH1:...")
 * Uses delta-encoding against the starter template when smaller,
 * so typical edited 64x64 worlds export as short, easy-to-share codes!
 * ============================================================================ */

const TEMPLATE_CODES: WorldTemplateId[] = ['village', 'hills', 'obby', 'flat'];

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

function writeVarint(buf: number[], n: number) {
  let v = n >>> 0;
  while (v >= 0x80) {
    buf.push((v & 0x7f) | 0x80);
    v >>>= 7;
  }
  buf.push(v);
}

function readVarint(bytes: Uint8Array, state: { offset: number }): number {
  let result = 0;
  let shift = 0;
  while (state.offset < bytes.length) {
    const b = bytes[state.offset++];
    result |= (b & 0x7f) << shift;
    if ((b & 0x80) === 0) return result >>> 0;
    shift += 7;
    if (shift > 35) throw new Error('Invalid code format');
  }
  throw new Error('Unexpected end of world code');
}

async function compressDeflate(input: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === 'undefined') return null;
  try {
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(new Uint8Array(input));
    writer.close();
    const res = new Response(cs.readable);
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

async function decompressDeflate(input: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Browser does not support compressed world codes');
  }
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(new Uint8Array(input));
  writer.close();
  const res = new Response(ds.readable);
  return new Uint8Array(await res.arrayBuffer());
}

export async function exportWorldCode(params: {
  name: string;
  template: WorldTemplateId;
  blocks: Uint8Array;
  spawn: Vec3;
}): Promise<string> {
  const tplIdx = Math.max(0, TEMPLATE_CODES.indexOf(params.template));
  const base = generateWorldFromTemplate(params.template).blocks;

  // Build delta payload: [gapVarint, blockId, ...]
  const deltaBytes: number[] = [];
  let prevIdx = -1;
  let diffCount = 0;
  for (let i = 0; i < TOTAL_VOXELS; i++) {
    if (params.blocks[i] !== base[i]) {
      writeVarint(deltaBytes, i - prevIdx - 1);
      deltaBytes.push(params.blocks[i] & 0xff);
      prevIdx = i;
      diffCount++;
    }
  }

  // Build full RLE payload: [blockId, runLenVarint, ...]
  const rleBytes: number[] = [];
  let cur = params.blocks[0];
  let run = 1;
  for (let i = 1; i < TOTAL_VOXELS; i++) {
    if (params.blocks[i] === cur) {
      run++;
    } else {
      rleBytes.push(cur & 0xff);
      writeVarint(rleBytes, run);
      cur = params.blocks[i];
      run = 1;
    }
  }
  rleBytes.push(cur & 0xff);
  writeVarint(rleBytes, run);

  const useDelta = diffCount < 12000 && deltaBytes.length <= rleBytes.length;
  const modeByte = useDelta ? 1 : 0; // 1 = delta, 0 = full RLE
  const nameBytes = new TextEncoder().encode(params.name.slice(0, 32));

  const rawHeader: number[] = [
    tplIdx,
    modeByte,
    Math.max(0, Math.min(WORLD_SIZE_X - 1, Math.round(params.spawn.x))),
    Math.max(0, Math.min(WORLD_SIZE_Y - 1, Math.round(params.spawn.y))),
    Math.max(0, Math.min(WORLD_SIZE_Z - 1, Math.round(params.spawn.z))),
    nameBytes.length,
    ...nameBytes,
  ];
  const rawPayload = new Uint8Array([...rawHeader, ...(useDelta ? deltaBytes : rleBytes)]);

  const compressed = await compressDeflate(rawPayload);
  if (compressed && compressed.length + 1 < rawPayload.length) {
    const out = new Uint8Array(compressed.length + 1);
    out[0] = 1; // deflated
    out.set(compressed, 1);
    return `BH1:${bytesToBase64Url(out)}`;
  }

  const out = new Uint8Array(rawPayload.length + 1);
  out[0] = 0; // raw
  out.set(rawPayload, 1);
  return `BH1:${bytesToBase64Url(out)}`;
}

export interface ImportedWorldData {
  name: string;
  template: WorldTemplateId;
  blocks: Uint8Array;
  spawn: Vec3;
  npcs: NpcDefinition[];
}

export async function importWorldCode(rawCode: string): Promise<ImportedWorldData> {
  const cleaned = rawCode.trim().replace(/\s+/g, '');
  if (!cleaned.startsWith('BH1:')) {
    throw new Error('World code must start with "BH1:". Please check and try again.');
  }
  const encoded = cleaned.slice(4);
  if (!encoded) {
    throw new Error('World code is empty.');
  }

  const outer = base64UrlToBytes(encoded);
  if (outer.length < 7) {
    throw new Error('World code looks incomplete.');
  }

  const isCompressed = outer[0] === 1;
  const payload = isCompressed ? await decompressDeflate(outer.subarray(1)) : outer.subarray(1);

  const state = { offset: 0 };
  const tplIdx = payload[state.offset++];
  const modeByte = payload[state.offset++];
  const sx = payload[state.offset++];
  const sy = payload[state.offset++];
  const sz = payload[state.offset++];
  const nameLen = payload[state.offset++];

  const template: WorldTemplateId = TEMPLATE_CODES[tplIdx] ?? 'flat';
  const nameSlice = payload.subarray(state.offset, state.offset + nameLen);
  state.offset += nameLen;
  const name = new TextDecoder().decode(nameSlice) || 'Shared World';

  const baseGen = generateWorldFromTemplate(template);
  let blocks: Uint8Array;

  if (modeByte === 1) {
    blocks = new Uint8Array(baseGen.blocks);
    let idx = -1;
    while (state.offset < payload.length) {
      const gap = readVarint(payload, state);
      if (state.offset >= payload.length) break;
      const val = payload[state.offset++] as BlockId;
      idx += gap + 1;
      if (idx >= 0 && idx < TOTAL_VOXELS) {
        blocks[idx] = val;
      }
    }
  } else {
    blocks = new Uint8Array(TOTAL_VOXELS);
    let pos = 0;
    while (state.offset < payload.length && pos < TOTAL_VOXELS) {
      const val = payload[state.offset++] & 0xff;
      const run = readVarint(payload, state);
      const end = Math.min(pos + run, TOTAL_VOXELS);
      blocks.fill(val, pos, end);
      pos = end;
    }
  }

  return {
    name,
    template,
    blocks,
    spawn: { x: sx + 0.5, y: Math.max(2, sy), z: sz + 0.5 },
    npcs: baseGen.npcs,
  };
}

/* ============================================================================
 * IndexedDB Persistence (with transparent localStorage fallback)
 * ============================================================================ */

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(WORLDS_STORE)) {
        db.createObjectStore(WORLDS_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

function readLocalFallback(): SavedWorldRecord[] {
  try {
    const raw = localStorage.getItem(LS_WORLDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalFallback(records: SavedWorldRecord[]): void {
  try {
    localStorage.setItem(LS_WORLDS_KEY, JSON.stringify(records));
  } catch {
    // Ignore quota errors in fallback mode
  }
}

export async function listSavedWorlds(): Promise<SavedWorldMeta[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(WORLDS_STORE, 'readonly');
      const store = tx.objectStore(WORLDS_STORE);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = (req.result as SavedWorldRecord[]) || [];
        const metas: SavedWorldMeta[] = rows
          .map(({ id, name, template, createdAt, updatedAt, blockCount, notes }) => ({
            id,
            name,
            template,
            createdAt,
            updatedAt,
            blockCount,
            notes: notes ?? '',
          }))
          .sort((a, b) => b.updatedAt - a.updatedAt);
        resolve(metas);
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readLocalFallback()
      .map(({ id, name, template, createdAt, updatedAt, blockCount, notes }) => ({
        id,
        name,
        template,
        createdAt,
        updatedAt,
        blockCount,
        notes: notes ?? '',
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

export async function saveWorldRecord(params: {
  id?: string;
  name: string;
  template: WorldTemplateId;
  blocks: Uint8Array;
  spawn: Vec3;
  npcs: NpcDefinition[];
  notes: string;
}): Promise<SavedWorldMeta> {
  const now = Date.now();
  const id = params.id || `world-${now}-${Math.random().toString(36).slice(2, 7)}`;

  const existing = params.id ? await loadWorldRecord(params.id) : null;
  const record: SavedWorldRecord = {
    id,
    name: params.name.trim() || 'Untitled World',
    template: params.template,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    blockCount: countSolidBlocks(params.blocks),
    notes: params.notes,
    rleBlocks: encodeRle(params.blocks),
    spawn: params.spawn,
    npcs: params.npcs,
  };

  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORLDS_STORE, 'readwrite');
      tx.objectStore(WORLDS_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const list = readLocalFallback().filter((w) => w.id !== record.id);
    list.push(record);
    writeLocalFallback(list);
  }

  return {
    id: record.id,
    name: record.name,
    template: record.template,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    blockCount: record.blockCount,
    notes: record.notes,
  };
}

export async function loadWorldRecord(id: string): Promise<SavedWorldRecord | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(WORLDS_STORE, 'readonly');
      const req = tx.objectStore(WORLDS_STORE).get(id);
      req.onsuccess = () => resolve((req.result as SavedWorldRecord) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return readLocalFallback().find((w) => w.id === id) ?? null;
  }
}

export async function deleteWorldRecord(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(WORLDS_STORE, 'readwrite');
      tx.objectStore(WORLDS_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    const list = readLocalFallback().filter((w) => w.id !== id);
    writeLocalFallback(list);
  }
}

/* ============================================================================
 * Avatar & Safety Stub Local Persistence
 * ============================================================================ */

export function loadSavedAvatar(): AvatarConfig {
  try {
    const raw = localStorage.getItem(LS_AVATAR_KEY);
    if (!raw) return DEFAULT_AVATAR;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_AVATAR, ...parsed };
  } catch {
    return DEFAULT_AVATAR;
  }
}

export function saveAvatarConfig(avatar: AvatarConfig): void {
  try {
    localStorage.setItem(LS_AVATAR_KEY, JSON.stringify(avatar));
  } catch {
    // Ignore storage error
  }
}

export function loadSafetyLogs(): SafetyReportStub[] {
  try {
    const raw = localStorage.getItem(LS_SAFETY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function addSafetyLog(entry: Omit<SafetyReportStub, 'id' | 'createdAt'>): SafetyReportStub[] {
  const existing = loadSafetyLogs();
  const next: SafetyReportStub[] = [
    {
      ...entry,
      id: `safety-${Date.now()}`,
      createdAt: Date.now(),
    },
    ...existing,
  ].slice(0, 20);
  try {
    localStorage.setItem(LS_SAFETY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage error
  }
  return next;
}

export function loadRpgState(): RpgPlayerState {
  const fresh = createInitialRpgState();
  try {
    const raw = localStorage.getItem(LS_RPG_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<RpgPlayerState>;
    return {
      ...fresh,
      ...parsed,
      playstyle: { ...fresh.playstyle, ...(parsed.playstyle ?? {}) },
      resources: { ...fresh.resources, ...(parsed.resources ?? {}) },
      equipped: { ...fresh.equipped, ...(parsed.equipped ?? {}) },
      worldChests: { ...fresh.worldChests, ...(parsed.worldChests ?? {}) },
      homeSpawn: parsed.homeSpawn ?? fresh.homeSpawn,
      skills: Array.isArray(parsed.skills) ? parsed.skills : fresh.skills,
      inventory: Array.isArray(parsed.inventory) ? parsed.inventory : fresh.inventory,
      graves: Array.isArray(parsed.graves) ? parsed.graves : fresh.graves,
      quests: Array.isArray(parsed.quests) ? parsed.quests : fresh.quests,
      clearedDungeons: Array.isArray(parsed.clearedDungeons) ? parsed.clearedDungeons : fresh.clearedDungeons,
      dungeonMapScrolls:
        typeof parsed.dungeonMapScrolls === 'number'
          ? parsed.dungeonMapScrolls
          : fresh.dungeonMapScrolls,
    };
  } catch {
    return fresh;
  }
}

export function saveRpgState(state: RpgPlayerState): void {
  try {
    localStorage.setItem(LS_RPG_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage error
  }
}

export function resetRpgState(): RpgPlayerState {
  const fresh = createInitialRpgState();
  saveRpgState(fresh);
  return fresh;
}

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(LS_UI_PREFS_KEY);
    if (!raw) return { showOverheadLabels: true };
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      showOverheadLabels: typeof parsed.showOverheadLabels === 'boolean' ? parsed.showOverheadLabels : true,
    };
  } catch {
    return { showOverheadLabels: true };
  }
}

export function saveUiPrefs(prefs: UiPrefs): void {
  try {
    localStorage.setItem(LS_UI_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage error
  }
}
