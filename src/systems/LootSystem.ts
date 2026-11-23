import type { ArraySchema } from '@colyseus/schema';
import { ENGINE, type CrateTier } from '../../shared/engine';
import {
  ITEM_IDS_BY_SLOT,
  ITEM_REGISTRY,
  MODIFIER_REGISTRY,
  type ModifierId,
  type SlotKind,
} from '../../shared/itemRegistry';
import {
  OwnedItemSchema,
  type BaseState,
  type CrateState,
  type OwnedItemState,
  type PlayerState,
} from '../../shared/schema';
import type { MatchLog } from '../../server/MatchLog';

export interface RolledLootItem {
  readonly itemId: string;
  readonly slotKind: SlotKind;
  readonly level: number;
  readonly modifiers: readonly ModifierId[];
}

export interface ItemGrantSpec {
  readonly itemId: string;
  readonly level: number;
  readonly modifiers: readonly string[];
}

export interface EffectiveItemStats {
  readonly damage: number;
  readonly range: number;
  readonly cooldownMs: number;
  readonly durationMs: number;
  readonly shieldHp: number;
  readonly slowFactor: number;
  readonly triggerRadius: number;
}

export type LootActionResult<T = Record<string, never>> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

function getSlotArrayAndCap(
  player: PlayerState,
  slotKind: SlotKind,
): { slots: ArraySchema<OwnedItemState>; maxSlots: number } {
  switch (slotKind) {
    case 'weapon':
      return { slots: player.weaponSlots, maxSlots: ENGINE.maxWeaponSlots };
    case 'skill':
      return { slots: player.skillSlots, maxSlots: ENGINE.maxSkillSlots };
    case 'trap':
      return { slots: player.trapSlots, maxSlots: ENGINE.maxTrapSlots };
  }
}

function isCrateTier(value: number): value is CrateTier {
  return value === 1 || value === 2 || value === 3;
}

export function rollCrateItem(tier: CrateTier, rng: () => number = Math.random): RolledLootItem {
  if (!isCrateTier(tier)) {
    throw new Error(`Invalid crate tier: ${String(tier)}`);
  }

  const odds = ENGINE.crateTierOdds[tier];
  const categoryRoll = rng();
  let slotKind: SlotKind;
  if (categoryRoll < odds.weapon) {
    slotKind = 'weapon';
  } else if (categoryRoll < odds.weapon + odds.skill) {
    slotKind = 'skill';
  } else {
    slotKind = 'trap';
  }

  const candidates = ITEM_IDS_BY_SLOT[slotKind].filter((id) => ITEM_REGISTRY[id].minTier <= tier);
  if (candidates.length === 0) {
    throw new Error(`No registered items for slot "${slotKind}" at tier ${tier}`);
  }

  const rawIndex = Math.floor(rng() * candidates.length);
  const clampedIndex = Math.max(0, Math.min(candidates.length - 1, rawIndex));
  const itemId = candidates[clampedIndex];
  const def = ITEM_REGISTRY[itemId];
  const level = Math.min(def.maxLevel, ENGINE.crateStartingLevelByTier[tier]);

  return {
    itemId,
    slotKind,
    level,
    modifiers: [],
  };
}

export function equipItem(
  player: PlayerState,
  slotKind: SlotKind,
  slotIndex: number,
  spec: ItemGrantSpec,
): LootActionResult<{ item: OwnedItemState }> {
  const def = ITEM_REGISTRY[spec.itemId];
  if (!def) {
    return { ok: false, error: `Unknown itemId: ${spec.itemId}` };
  }
  if (def.slotKind !== slotKind) {
    return { ok: false, error: `Item ${spec.itemId} belongs in ${def.slotKind} slot, not ${slotKind}` };
  }
  if (!Number.isInteger(spec.level) || spec.level < 1 || spec.level > def.maxLevel) {
    return { ok: false, error: `Illegal item level ${spec.level} for ${spec.itemId}` };
  }

  const { slots, maxSlots } = getSlotArrayAndCap(player, slotKind);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= maxSlots) {
    return { ok: false, error: `Invalid slot index ${slotIndex} for ${slotKind}` };
  }
  if (slotIndex > slots.length) {
    return { ok: false, error: `Slot index ${slotIndex} skips unoccupied slot` };
  }

  if (spec.modifiers.length > def.maxModifierSlots) {
    return { ok: false, error: `Too many modifiers for ${spec.itemId}` };
  }
  const seenMods = new Set<string>();
  for (const modId of spec.modifiers) {
    if (!(modId in MODIFIER_REGISTRY)) {
      return { ok: false, error: `Unknown modifier: ${modId}` };
    }
    if (!def.allowedModifiers.includes(modId as ModifierId)) {
      return { ok: false, error: `Modifier ${modId} is not allowed on ${spec.itemId}` };
    }
    if (seenMods.has(modId)) {
      return { ok: false, error: `Duplicate modifier: ${modId}` };
    }
    seenMods.add(modId);
  }

  const owned = new OwnedItemSchema();
  owned.itemId = def.id;
  owned.level = spec.level;
  for (const modId of spec.modifiers) {
    owned.modifiers.push(modId);
  }

  if (slotIndex < slots.length) {
    slots[slotIndex] = owned;
  } else {
    slots.push(owned);
  }

  return { ok: true, item: owned };
}

export function openCrate(
  crate: CrateState | undefined,
  player: PlayerState | undefined,
  base: BaseState | undefined,
  matchLog: MatchLog | undefined,
  rng: () => number = Math.random,
): LootActionResult<{ granted: RolledLootItem }> {
  if (!crate) {
    return { ok: false, error: 'Crate not found' };
  }
  if (crate.opened) {
    return { ok: false, error: 'Crate already opened' };
  }
  if (!player) {
    return { ok: false, error: 'Player not found' };
  }
  if (!isCrateTier(crate.tier)) {
    return { ok: false, error: `Invalid crate tier: ${crate.tier}` };
  }

  const granted = rollCrateItem(crate.tier, rng);
  const { slots, maxSlots } = getSlotArrayAndCap(player, granted.slotKind);

  let targetIndex = slots.length;
  if (targetIndex >= maxSlots) {
    // Replace lowest-level slot (or slot 0 on tie)
    targetIndex = 0;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].level < slots[targetIndex].level) {
        targetIndex = i;
      }
    }
  }

  const equipRes = equipItem(player, granted.slotKind, targetIndex, {
    itemId: granted.itemId,
    level: granted.level,
    modifiers: granted.modifiers,
  });
  if (!equipRes.ok) {
    return equipRes;
  }

  crate.opened = true;
  if (base && base.teamId === player.teamId) {
    base.points += ENGINE.points.loot;
  }

  if (matchLog) {
    matchLog.record({
      type: 'crate_opened',
      x: crate.x,
      y: 0,
      z: crate.z,
      actorId: player.id,
      teamId: player.teamId,
      detail: `${crate.id}:${granted.itemId}:lv${granted.level}`,
    });
  }

  return { ok: true, granted };
}

export function upgradeItem(
  player: PlayerState,
  slotKind: SlotKind,
  slotIndex: number,
): LootActionResult<{ level: number }> {
  const { slots } = getSlotArrayAndCap(player, slotKind);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slots.length) {
    return { ok: false, error: `No item in ${slotKind} slot ${slotIndex}` };
  }

  const owned = slots[slotIndex];
  const def = ITEM_REGISTRY[owned.itemId];
  if (!def) {
    return { ok: false, error: `Unknown itemId: ${owned.itemId}` };
  }
  if (owned.level >= def.maxLevel) {
    return { ok: false, error: `Item ${owned.itemId} is already at max level ${def.maxLevel}` };
  }

  owned.level += 1;
  return { ok: true, level: owned.level };
}

export function applyModifier(
  player: PlayerState,
  slotKind: SlotKind,
  slotIndex: number,
  modifierId: string,
): LootActionResult<{ modifierId: ModifierId }> {
  if (!(modifierId in MODIFIER_REGISTRY)) {
    return { ok: false, error: `Unknown modifier: ${modifierId}` };
  }

  const { slots } = getSlotArrayAndCap(player, slotKind);
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= slots.length) {
    return { ok: false, error: `No item in ${slotKind} slot ${slotIndex}` };
  }

  const owned = slots[slotIndex];
  const def = ITEM_REGISTRY[owned.itemId];
  if (!def) {
    return { ok: false, error: `Unknown itemId: ${owned.itemId}` };
  }
  if (!def.allowedModifiers.includes(modifierId as ModifierId)) {
    return { ok: false, error: `Modifier ${modifierId} is not allowed on ${owned.itemId}` };
  }
  if (owned.modifiers.length >= def.maxModifierSlots) {
    return { ok: false, error: `No remaining modifier slots on ${owned.itemId}` };
  }
  for (let i = 0; i < owned.modifiers.length; i++) {
    if (owned.modifiers[i] === modifierId) {
      return { ok: false, error: `Modifier ${modifierId} already applied` };
    }
  }

  owned.modifiers.push(modifierId);
  return { ok: true, modifierId: modifierId as ModifierId };
}

export function getEffectiveItemStats(item: {
  itemId: string;
  level: number;
  modifiers: Iterable<string>;
}): EffectiveItemStats {
  const def = ITEM_REGISTRY[item.itemId];
  if (!def) {
    throw new Error(`Unknown itemId in getEffectiveItemStats: ${item.itemId}`);
  }
  const levelStats = def.levels[item.level];
  if (!levelStats) {
    throw new Error(`Illegal level ${item.level} for item ${item.itemId}`);
  }

  let damage = levelStats.damage;
  let range = levelStats.range;
  let cooldownMs = levelStats.cooldownMs;
  let durationMs = levelStats.durationMs ?? 0;
  let triggerRadius = def.slotKind === 'trap' ? levelStats.range : ENGINE.trapTriggerRadius;

  for (const modId of item.modifiers) {
    const mod = MODIFIER_REGISTRY[modId as ModifierId];
    if (!mod) {
      throw new Error(`Unknown modifier in getEffectiveItemStats: ${modId}`);
    }
    damage *= mod.damageMultiplier;
    cooldownMs *= mod.cooldownMultiplier;
    range += mod.rangeBonus;
    durationMs *= mod.durationMultiplier;
    triggerRadius += mod.radiusBonus;
  }

  return {
    damage,
    range,
    cooldownMs,
    durationMs,
    shieldHp: levelStats.shieldHp ?? 0,
    slowFactor: levelStats.slowFactor ?? 1,
    triggerRadius,
  };
}
