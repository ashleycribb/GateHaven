import type { CrateTier } from './engine';

export type SlotKind = 'weapon' | 'skill' | 'trap';
export type WeaponSubKind = 'ranged' | 'melee';
export type SkillSubKind = 'dash' | 'shield_bubble' | 'turret';
export type TrapSubKind = 'mine' | 'snare' | 'spike';
export type ItemSubKind = WeaponSubKind | SkillSubKind | TrapSubKind;

export type ModifierId =
  | 'overcharge'
  | 'long_barrel'
  | 'quick_cycle'
  | 'heavy_edge'
  | 'fortified_shell'
  | 'extended_flux'
  | 'wide_trigger';

export interface ModifierDefinition {
  readonly id: ModifierId;
  readonly name: string;
  readonly damageMultiplier: number;
  readonly cooldownMultiplier: number;
  readonly rangeBonus: number;
  readonly durationMultiplier: number;
  readonly radiusBonus: number;
}

export interface ItemLevelStats {
  readonly damage: number;
  readonly range: number;
  readonly cooldownMs: number;
  readonly durationMs?: number;
  readonly shieldHp?: number;
  readonly slowFactor?: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly slotKind: SlotKind;
  readonly subKind: ItemSubKind;
  readonly minTier: CrateTier;
  readonly maxLevel: number;
  readonly levels: Readonly<Record<number, ItemLevelStats>>;
  readonly maxModifierSlots: number;
  readonly allowedModifiers: readonly ModifierId[];
}

export const MODIFIER_REGISTRY: Readonly<Record<ModifierId, ModifierDefinition>> = {
  overcharge: {
    id: 'overcharge',
    name: 'Overcharge Core',
    damageMultiplier: 1.2,
    cooldownMultiplier: 1.0,
    rangeBonus: 0,
    durationMultiplier: 1.0,
    radiusBonus: 0,
  },
  long_barrel: {
    id: 'long_barrel',
    name: 'Extended Barrel',
    damageMultiplier: 1.0,
    cooldownMultiplier: 1.0,
    rangeBonus: 6,
    durationMultiplier: 1.0,
    radiusBonus: 0,
  },
  quick_cycle: {
    id: 'quick_cycle',
    name: 'Quick Cycle',
    damageMultiplier: 1.0,
    cooldownMultiplier: 0.85,
    rangeBonus: 0,
    durationMultiplier: 1.0,
    radiusBonus: 0,
  },
  heavy_edge: {
    id: 'heavy_edge',
    name: 'Heavy Edge',
    damageMultiplier: 1.25,
    cooldownMultiplier: 1.05,
    rangeBonus: 0.5,
    durationMultiplier: 1.0,
    radiusBonus: 0,
  },
  fortified_shell: {
    id: 'fortified_shell',
    name: 'Fortified Shell',
    damageMultiplier: 1.0,
    cooldownMultiplier: 1.0,
    rangeBonus: 0,
    durationMultiplier: 1.25,
    radiusBonus: 0,
  },
  extended_flux: {
    id: 'extended_flux',
    name: 'Extended Flux',
    damageMultiplier: 1.0,
    cooldownMultiplier: 0.95,
    rangeBonus: 2,
    durationMultiplier: 1.3,
    radiusBonus: 0,
  },
  wide_trigger: {
    id: 'wide_trigger',
    name: 'Wide Trigger',
    damageMultiplier: 1.0,
    cooldownMultiplier: 1.0,
    rangeBonus: 0,
    durationMultiplier: 1.0,
    radiusBonus: 1.2,
  },
} as const;

export const ITEM_REGISTRY: Readonly<Record<string, ItemDefinition>> = {
  // Weapons (ranged | melee)
  plasma_carbine: {
    id: 'plasma_carbine',
    name: 'Sunbolt Carbine',
    slotKind: 'weapon',
    subKind: 'ranged',
    minTier: 1,
    maxLevel: 3,
    levels: {
      1: { damage: 18, range: 28, cooldownMs: 360 },
      2: { damage: 25, range: 31, cooldownMs: 320 },
      3: { damage: 34, range: 34, cooldownMs: 280 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['overcharge', 'long_barrel', 'quick_cycle'],
  },
  pulse_longbow: {
    id: 'pulse_longbow',
    name: 'Gale Longbow',
    slotKind: 'weapon',
    subKind: 'ranged',
    minTier: 2,
    maxLevel: 3,
    levels: {
      1: { damage: 28, range: 38, cooldownMs: 600 },
      2: { damage: 38, range: 42, cooldownMs: 550 },
      3: { damage: 50, range: 46, cooldownMs: 500 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['overcharge', 'long_barrel'],
  },
  reef_spear: {
    id: 'reef_spear',
    name: 'Coral Halberd',
    slotKind: 'weapon',
    subKind: 'melee',
    minTier: 1,
    maxLevel: 3,
    levels: {
      1: { damage: 26, range: 4.5, cooldownMs: 440 },
      2: { damage: 36, range: 4.8, cooldownMs: 400 },
      3: { damage: 48, range: 5.2, cooldownMs: 360 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['heavy_edge', 'quick_cycle'],
  },

  // Skills (dash | shield_bubble | turret)
  gale_dash: {
    id: 'gale_dash',
    name: 'Gale Dash',
    slotKind: 'skill',
    subKind: 'dash',
    minTier: 1,
    maxLevel: 3,
    levels: {
      1: { damage: 0, range: 8, cooldownMs: 4000, durationMs: 260 },
      2: { damage: 0, range: 10, cooldownMs: 3400, durationMs: 300 },
      3: { damage: 0, range: 12, cooldownMs: 2800, durationMs: 340 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['quick_cycle', 'extended_flux'],
  },
  aegis_bubble: {
    id: 'aegis_bubble',
    name: 'Aegis Bubble',
    slotKind: 'skill',
    subKind: 'shield_bubble',
    minTier: 1,
    maxLevel: 3,
    levels: {
      1: { damage: 0, range: 4, cooldownMs: 8000, durationMs: 3000, shieldHp: 45 },
      2: { damage: 0, range: 4.5, cooldownMs: 7200, durationMs: 3800, shieldHp: 70 },
      3: { damage: 0, range: 5, cooldownMs: 6500, durationMs: 4500, shieldHp: 100 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['fortified_shell', 'extended_flux'],
  },
  beacon_turret: {
    id: 'beacon_turret',
    name: 'Beacon Turret',
    slotKind: 'skill',
    subKind: 'turret',
    minTier: 2,
    maxLevel: 3,
    levels: {
      1: { damage: 12, range: 18, cooldownMs: 10000, durationMs: 8000 },
      2: { damage: 18, range: 22, cooldownMs: 9000, durationMs: 10000 },
      3: { damage: 25, range: 26, cooldownMs: 8000, durationMs: 12000 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['overcharge', 'long_barrel'],
  },

  // Traps (mine | snare | spike)
  blast_mine: {
    id: 'blast_mine',
    name: 'Sandburst Mine',
    slotKind: 'trap',
    subKind: 'mine',
    minTier: 1,
    maxLevel: 3,
    levels: {
      1: { damage: 30, range: 2.5, cooldownMs: 5000 },
      2: { damage: 42, range: 3.0, cooldownMs: 4500 },
      3: { damage: 56, range: 3.5, cooldownMs: 4000 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['overcharge', 'wide_trigger'],
  },
  tangle_snare: {
    id: 'tangle_snare',
    name: 'Kelp Snare',
    slotKind: 'trap',
    subKind: 'snare',
    minTier: 1,
    maxLevel: 3,
    levels: {
      1: { damage: 8, range: 2.6, cooldownMs: 5500, durationMs: 2000, slowFactor: 0.45 },
      2: { damage: 14, range: 3.0, cooldownMs: 5000, durationMs: 2600, slowFactor: 0.35 },
      3: { damage: 20, range: 3.4, cooldownMs: 4500, durationMs: 3200, slowFactor: 0.25 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['extended_flux', 'wide_trigger'],
  },
  thorn_spike: {
    id: 'thorn_spike',
    name: 'Obsidian Spikes',
    slotKind: 'trap',
    subKind: 'spike',
    minTier: 1,
    maxLevel: 3,
    levels: {
      1: { damage: 22, range: 2.2, cooldownMs: 4500 },
      2: { damage: 32, range: 2.5, cooldownMs: 4000 },
      3: { damage: 44, range: 2.8, cooldownMs: 3500 },
    },
    maxModifierSlots: 2,
    allowedModifiers: ['heavy_edge', 'wide_trigger'],
  },
} as const;

export const ITEM_IDS_BY_SLOT: Readonly<Record<SlotKind, readonly string[]>> = {
  weapon: Object.values(ITEM_REGISTRY)
    .filter((item) => item.slotKind === 'weapon')
    .map((item) => item.id),
  skill: Object.values(ITEM_REGISTRY)
    .filter((item) => item.slotKind === 'skill')
    .map((item) => item.id),
  trap: Object.values(ITEM_REGISTRY)
    .filter((item) => item.slotKind === 'trap')
    .map((item) => item.id),
} as const;

export const ALL_ITEM_IDS: readonly string[] = Object.keys(ITEM_REGISTRY);
