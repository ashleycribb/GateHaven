import {
  CharacterClassId,
  DungeonId,
  GearItem,
  GearRarity,
  GearSlot,
  LearnedSkill,
  NpcDefinition,
  PlaystyleStats,
  QuestDefinition,
  RealmId,
  RpgPlayerState,
  WeaponKind,
} from '../types/blockhaven';

export interface ClassMetadata {
  id: CharacterClassId;
  name: string;
  title: string;
  description: string;
  bonusSummary: string;
  accentColor: string;
  starterSkillId?: string;
}

export const CLASS_LIST: ClassMetadata[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    title: 'Vanguard of Steel',
    description: 'Stalwart frontline fighter with high vitality and heavy melee strikes.',
    bonusSummary: '+25 Max HP · +30% Melee Damage',
    accentColor: '#DC2626',
  },
  {
    id: 'mage',
    name: 'Mage',
    title: 'Weaver of Embers',
    description: 'Channels arcane firebolts and shields with superior stamina recovery.',
    bonusSummary: '+35% Magic Power · +20 Max Stamina',
    accentColor: '#7C3AED',
    starterSkillId: 'firebolt',
  },
  {
    id: 'ranger',
    name: 'Ranger',
    title: 'Horizon Tracker',
    description: 'Swift woodland archer who excels at long-range bow combat and tracking.',
    bonusSummary: '+30% Bow Damage · +15% Move Speed',
    accentColor: '#16A34A',
    starterSkillId: 'bow_mastery',
  },
  {
    id: 'rogue',
    name: 'Rogue',
    title: 'Whisperblade',
    description: 'Agile skirmisher with rapid critical hits and nimble footwork.',
    bonusSummary: '+25% Crit Chance · +20% Move Speed',
    accentColor: '#334155',
  },
  {
    id: 'cleric',
    name: 'Cleric',
    title: 'Shrine Lightbearer',
    description: 'Blessed guardian who mends wounds and resists dungeon hazards.',
    bonusSummary: '+20 Max HP · Enhanced Shrine Mend',
    accentColor: '#D97706',
    starterSkillId: 'shrine_mend',
  },
  {
    id: 'artificer',
    name: 'Artificer',
    title: 'Master Crafter',
    description: 'Resourceful builder who harvests extra materials and crafts superior gear.',
    bonusSummary: '2x Gather Yield · Cheaper Crafting & Repair',
    accentColor: '#2563EB',
    starterSkillId: 'smithing',
  },
  {
    id: 'tamer',
    name: 'Tamer',
    title: 'Kindred Shepherd',
    description: 'Befriends wild deer, wolves, rabbits, and boars as loyal companions.',
    bonusSummary: 'Guaranteed Wildlife Taming · Companion Boost',
    accentColor: '#0D9488',
    starterSkillId: 'beast_bond',
  },
];

export const CLASS_BY_ID: Record<CharacterClassId, ClassMetadata> = Object.fromEntries(
  CLASS_LIST.map((c) => [c.id, c]),
) as Record<CharacterClassId, ClassMetadata>;

export interface SkillTemplate {
  id: string;
  name: string;
  description: string;
  teacherNpcId: string;
  category: LearnedSkill['category'];
  costGold: number;
}

export const SKILL_CATALOG: Record<string, SkillTemplate> = {
  smithing: {
    id: 'smithing',
    name: 'Smithing',
    description: 'Craft stronger tools, blades, and armor with higher rarity chances.',
    teacherNpcId: 'npc-bram',
    category: 'craft',
    costGold: 0,
  },
  repair: {
    id: 'repair',
    name: 'Repair',
    description: 'Restore worn weapon and armor durability at half the gold cost.',
    teacherNpcId: 'npc-bram',
    category: 'craft',
    costGold: 15,
  },
  tracking: {
    id: 'tracking',
    name: 'Tracking',
    description: 'Sense wildlife and dungeon monsters farther away and harvest extra meat & hide.',
    teacherNpcId: 'npc-kael',
    category: 'survival',
    costGold: 0,
  },
  bow_mastery: {
    id: 'bow_mastery',
    name: 'Bow Mastery',
    description: 'Unlocks and strengthens ranged bow shots (Key R). Improves with every hit.',
    teacherNpcId: 'npc-kael',
    category: 'ranged',
    costGold: 10,
  },
  beast_bond: {
    id: 'beast_bond',
    name: 'Beast Bond',
    description: 'Allows taming friendly wildlife (Key Y) to follow you as a pet or mount.',
    teacherNpcId: 'npc-kael',
    category: 'tame',
    costGold: 20,
  },
  firebolt: {
    id: 'firebolt',
    name: 'Firebolt',
    description: 'Launch a glowing arcane flame orb (Key G) that damages monsters at range.',
    teacherNpcId: 'npc-lyra',
    category: 'magic',
    costGold: 0,
  },
  arcane_shield: {
    id: 'arcane_shield',
    name: 'Arcane Shield',
    description: 'Reduces incoming monster and trap damage by 10% + 4% per skill level.',
    teacherNpcId: 'npc-lyra',
    category: 'magic',
    costGold: 20,
  },
  inspect: {
    id: 'inspect',
    name: 'Inspect',
    description: 'Scan creatures, villagers, portals, chests, and blocks (Key I) to reveal stats, drops, and tips. Range & detail grow as it levels up.',
    teacherNpcId: 'npc-lyra',
    category: 'survival',
    costGold: 10,
  },
  shrine_mend: {
    id: 'shrine_mend',
    name: 'Shrine Mend',
    description: 'Channel soothing shrine light (Key C) to recover HP using Stamina.',
    teacherNpcId: 'npc-sera',
    category: 'survival',
    costGold: 0,
  },
};

export interface RealmMetadata {
  id: RealmId;
  name: string;
  subtitle: string;
  minLevel: number;
  maxLevel: number;
  description: string;
  portalColor: string;
  dungeons: DungeonId[];
  skyBias: 'normal' | 'desert' | 'ice' | 'sky' | 'dark';
}

export const REALM_LIST: RealmMetadata[] = [
  {
    id: 'home',
    name: 'Elderglen (Home World)',
    subtitle: 'Lv 1–8 · Village, Forests, River & Caves',
    minLevel: 1,
    maxLevel: 8,
    description: 'The sunlit valley where travelers awaken. Houses the Village Shrine, teachers, and entry dungeons.',
    portalColor: '#10B981',
    dungeons: ['sunken_crypt', 'ember_mines'],
    skyBias: 'normal',
  },
  {
    id: 'desert',
    name: 'Sunscar Desert',
    subtitle: 'Lv 6–12 · Golden Dunes & Sand Dungeons',
    minLevel: 6,
    maxLevel: 12,
    description: 'Windswept sandstone mesas, hidden oasis palms, fierce boars, and ancient sand crypts.',
    portalColor: '#F59E0B',
    dungeons: ['sunscorched_tomb'],
    skyBias: 'desert',
  },
  {
    id: 'ice',
    name: 'Frostveil Tundra',
    subtitle: 'Lv 10–16 · Glaciers & Frozen Spire',
    minLevel: 10,
    maxLevel: 16,
    description: 'Crystalline frozen ridges, snowy spruce groves, frost wolves, and the towering Frostspire.',
    portalColor: '#38BDF8',
    dungeons: ['frostspire'],
    skyBias: 'ice',
  },
  {
    id: 'sky',
    name: 'Aether Isles',
    subtitle: 'Lv 12–18 · Floating Sky Islands',
    minLevel: 12,
    maxLevel: 18,
    description: 'Suspended cloud-kissed meadows linked by timber bridges above an endless sunlit horizon.',
    portalColor: '#A78BFA',
    dungeons: ['cloud_citadel'],
    skyBias: 'sky',
  },
  {
    id: 'dark',
    name: 'Shadowreach',
    subtitle: 'Lv 16–22 · Eternal Twilight & Epic Loot',
    minLevel: 16,
    maxLevel: 22,
    description: 'Obsidian crags veined with glowing lava and high-tier monsters guarding Legendary relics.',
    portalColor: '#E11D48',
    dungeons: ['abyssal_sanctum'],
    skyBias: 'dark',
  },
];

export const REALM_BY_ID: Record<RealmId, RealmMetadata> = Object.fromEntries(
  REALM_LIST.map((r) => [r.id, r]),
) as Record<RealmId, RealmMetadata>;

export interface DungeonMetadata {
  id: DungeonId;
  name: string;
  realmId: RealmId;
  minLevel: number;
  maxLevel: number;
  floors: number;
  bossName: string;
  theme: 'crypt' | 'ember' | 'frost' | 'sand' | 'sky' | 'abyss';
  description: string;
  requiresCleared?: DungeonId;
  portalColor: string;
}

export const DUNGEON_LIST: DungeonMetadata[] = [
  {
    id: 'sunken_crypt',
    name: 'Sunken Crypt',
    realmId: 'home',
    minLevel: 1,
    maxLevel: 5,
    floors: 2,
    bossName: 'Crypt Lord Malakor',
    theme: 'crypt',
    description: 'Mossy stone chambers patrolled by slimes and skeletons. Ideal first trial.',
    portalColor: '#22C55E',
  },
  {
    id: 'ember_mines',
    name: 'Ember Mines',
    realmId: 'home',
    minLevel: 5,
    maxLevel: 10,
    floors: 2,
    bossName: 'Forgemaster Ignis',
    theme: 'ember',
    description: 'Volcanic shafts lined with lava trenches, gold veins, and goblin raiders.',
    requiresCleared: 'sunken_crypt',
    portalColor: '#F97316',
  },
  {
    id: 'sunscorched_tomb',
    name: 'Sunscorched Tomb',
    realmId: 'desert',
    minLevel: 6,
    maxLevel: 12,
    floors: 2,
    bossName: 'Dune Sovereign Khepri',
    theme: 'sand',
    description: 'Sandstone labyrinth hiding gilded chests and restless tomb guardians.',
    portalColor: '#EAB308',
  },
  {
    id: 'frostspire',
    name: 'Frostspire',
    realmId: 'ice',
    minLevel: 10,
    maxLevel: 15,
    floors: 3,
    bossName: 'Glacier Warden Boreas',
    theme: 'frost',
    description: 'Frozen halls of crystalline glass and obsidian traps guarded by ancient ice knights.',
    portalColor: '#0EA5E9',
  },
  {
    id: 'cloud_citadel',
    name: 'Cloud Citadel',
    realmId: 'sky',
    minLevel: 12,
    maxLevel: 18,
    floors: 3,
    bossName: 'Sky Titan Aetheris',
    theme: 'sky',
    description: 'High-altitude sanctum of floating stone decks and arcane storm guardians.',
    portalColor: '#8B5CF6',
  },
  {
    id: 'abyssal_sanctum',
    name: 'Abyssal Sanctum',
    realmId: 'dark',
    minLevel: 16,
    maxLevel: 22,
    floors: 3,
    bossName: 'Abyssal Knight Nyx',
    theme: 'abyss',
    description: 'The deepest obsidian stronghold. Tremendous danger, guaranteed Epic or Legendary loot.',
    portalColor: '#E11D48',
  },
];

export const DUNGEON_BY_ID: Record<DungeonId, DungeonMetadata> = Object.fromEntries(
  DUNGEON_LIST.map((d) => [d.id, d]),
) as Record<DungeonId, DungeonMetadata>;

export const QUEST_BOARD_LIST: QuestDefinition[] = [
  {
    id: 'q-timber-harvest',
    title: 'Timber & Stone for the Village',
    kind: 'fetch',
    giverName: 'Alden',
    description: 'Gather 6 Wood by chopping nearby oak trees to help repair the river footbridge.',
    minLevel: 1,
    targetKey: 'wood',
    targetCount: 6,
    rewardXp: 70,
    rewardGold: 30,
    rewardRarity: 'Uncommon',
  },
  {
    id: 'q-wolf-hunt',
    title: 'Clear the Forest Wolves',
    kind: 'hunt',
    giverName: 'Kael',
    description: 'Defeat 3 hostile creatures (wolves, slimes, skeletons, or goblins) prowling the valley.',
    minLevel: 1,
    targetKey: 'monster_or_wolf',
    targetCount: 3,
    rewardXp: 110,
    rewardGold: 45,
    rewardRarity: 'Uncommon',
  },
  {
    id: 'q-escort-scout',
    title: 'Escort Patrol: Shrine to River',
    kind: 'escort',
    giverName: 'Sera',
    description: 'Patrol the village perimeter and clear 2 threats while inspecting the river bridge.',
    minLevel: 2,
    targetKey: 'escort_patrol',
    targetCount: 2,
    rewardXp: 140,
    rewardGold: 60,
    rewardRarity: 'Rare',
  },
  {
    id: 'q-sunken-crypt',
    title: 'Dungeon Trial: Sunken Crypt',
    kind: 'dungeon',
    giverName: 'Alden',
    description: 'Enter the Sunken Crypt (Lv 1–5) and defeat Crypt Lord Malakor.',
    minLevel: 1,
    targetKey: 'sunken_crypt',
    targetCount: 1,
    rewardXp: 220,
    rewardGold: 95,
    rewardRarity: 'Rare',
  },
  {
    id: 'q-ember-mines',
    title: 'Dungeon Trial: Ember Mines',
    kind: 'dungeon',
    giverName: 'Bram',
    description: 'Conquer the Ember Mines (Lv 5–10) and defeat Forgemaster Ignis.',
    minLevel: 5,
    targetKey: 'ember_mines',
    targetCount: 1,
    rewardXp: 360,
    rewardGold: 160,
    rewardRarity: 'Epic',
  },
  {
    id: 'q-ore-prospect',
    title: 'Sparkling Veins',
    kind: 'fetch',
    giverName: 'Bram',
    description: 'Mine 4 Ore (Gold, Diamond, or Obsidian) from the mountain ridge or caves.',
    minLevel: 3,
    targetKey: 'ore',
    targetCount: 4,
    rewardXp: 160,
    rewardGold: 75,
    rewardRarity: 'Rare',
  },
];

export const RARITY_COLORS: Record<GearRarity, { text: string; bg: string; border: string }> = {
  Common: { text: '#475569', bg: '#F1F5F9', border: '#CBD5E1' },
  Uncommon: { text: '#15803D', bg: '#DCFCE7', border: '#86EFAC' },
  Rare: { text: '#1D4ED8', bg: '#DBEAFE', border: '#93C5FD' },
  Epic: { text: '#7E22CE', bg: '#F3E8FF', border: '#D8B4FE' },
  Legendary: { text: '#B45309', bg: '#FEF3C7', border: '#FCD34D' },
};

const RARITY_MULT: Record<GearRarity, number> = {
  Common: 1.0,
  Uncommon: 1.28,
  Rare: 1.65,
  Epic: 2.15,
  Legendary: 2.8,
};

export function rollRarity(tierBonus = 0): GearRarity {
  const r = Math.random() + tierBonus * 0.14;
  if (r > 1.15) return 'Legendary';
  if (r > 0.92) return 'Epic';
  if (r > 0.68) return 'Rare';
  if (r > 0.35) return 'Uncommon';
  return 'Common';
}

export function generateGearItem(params: {
  level: number;
  rarity?: GearRarity;
  slot?: GearSlot;
  weaponKind?: WeaponKind;
  soulbound?: boolean;
  customName?: string;
}): GearItem {
  const rarity = params.rarity ?? rollRarity(params.level * 0.03);
  const mult = RARITY_MULT[rarity];
  const slots: GearSlot[] = ['weapon', 'armor', 'accessory'];
  const slot = params.slot ?? slots[Math.floor(Math.random() * slots.length)];
  const weaponKinds: WeaponKind[] = ['melee', 'bow', 'magic'];
  const weaponKind = slot === 'weapon' ? (params.weaponKind ?? weaponKinds[Math.floor(Math.random() * weaponKinds.length)]) : undefined;

  const prefixes: Record<GearRarity, string[]> = {
    Common: ['Sturdy', 'Traveler', 'Ironwood'],
    Uncommon: ['Honed', 'Meadow', 'Tempered'],
    Rare: ['Runed', 'Sunforged', 'Starlight'],
    Epic: ['Aether', 'Obsidian', 'Dragonbane'],
    Legendary: ['Sovereign', 'Celestial', 'Eternal'],
  };
  const prefix = prefixes[rarity][Math.floor(Math.random() * prefixes[rarity].length)];

  let baseName = 'Charm';
  if (slot === 'weapon') {
    baseName = weaponKind === 'bow' ? 'Longbow' : weaponKind === 'magic' ? 'Ember Staff' : 'Blade';
  } else if (slot === 'armor') {
    baseName = 'Tunic Plate';
  } else {
    baseName = 'Shrine Amulet';
  }

  const lvlScale = 1 + (params.level - 1) * 0.22;
  const maxDurability = Math.round(45 * mult);

  return {
    id: `gear-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: params.customName ?? `${prefix} ${baseName}`,
    slot,
    weaponKind,
    rarity,
    attack: slot === 'weapon' ? Math.round(9 * lvlScale * mult) : slot === 'accessory' ? Math.round(3 * lvlScale * mult) : 0,
    defense: slot === 'armor' ? Math.round(6 * lvlScale * mult) : slot === 'accessory' ? Math.round(2 * lvlScale * mult) : 0,
    bonusHp: slot === 'armor' ? Math.round(14 * lvlScale * mult) : slot === 'accessory' ? Math.round(10 * lvlScale * mult) : 0,
    durability: maxDurability,
    maxDurability,
    soulbound: Boolean(params.soulbound),
    value: Math.round(20 * lvlScale * mult),
  };
}

export interface CraftRecipe {
  id: string;
  name: string;
  description: string;
  cost: Partial<RpgPlayerState['resources']>;
  resultType: 'gear' | 'food' | 'lanterns';
  slot?: GearSlot;
  weaponKind?: WeaponKind;
  rarity?: GearRarity;
}

export const CRAFT_RECIPES: CraftRecipe[] = [
  {
    id: 'craft-wood-sword',
    name: 'Traveler Timber Blade',
    description: 'Reliable melee blade for clearing forest wolves and crypt slimes.',
    cost: { wood: 4, stone: 2 },
    resultType: 'gear',
    slot: 'weapon',
    weaponKind: 'melee',
    rarity: 'Uncommon',
  },
  {
    id: 'craft-hunter-bow',
    name: 'Ashwood Hunter Bow',
    description: 'Balanced ranged bow that pairs cleanly with Kael’s Bow Mastery.',
    cost: { wood: 5, hide: 2 },
    resultType: 'gear',
    slot: 'weapon',
    weaponKind: 'bow',
    rarity: 'Uncommon',
  },
  {
    id: 'craft-ember-staff',
    name: 'Crystal Ember Staff',
    description: 'Focuses Firebolt magic with extra arcane power.',
    cost: { wood: 3, ore: 3 },
    resultType: 'gear',
    slot: 'weapon',
    weaponKind: 'magic',
    rarity: 'Rare',
  },
  {
    id: 'craft-ranger-armor',
    name: 'Reinforced Hide Armor',
    description: 'Protective tunic crafted from woodland hide and stone clasps.',
    cost: { hide: 4, stone: 3 },
    resultType: 'gear',
    slot: 'armor',
    rarity: 'Uncommon',
  },
  {
    id: 'craft-obsidian-blade',
    name: 'Obsidian Starblade',
    description: 'High-tier volcanic sword forged from rare ores.',
    cost: { ore: 6, stone: 4 },
    resultType: 'gear',
    slot: 'weapon',
    weaponKind: 'melee',
    rarity: 'Epic',
  },
  {
    id: 'craft-hearty-stew',
    name: 'Cook Hearty Stew',
    description: 'Restores +45 Hunger and +35 HP immediately.',
    cost: { meat: 1, wood: 1 },
    resultType: 'food',
  },
];

export function suggestClassFromPlaystyle(stats: PlaystyleStats, skills: LearnedSkill[]): CharacterClassId {
  const scores: Record<Exclude<CharacterClassId, 'unawakened'>, number> = {
    warrior: stats.meleeHits * 2,
    mage: stats.magicCasts * 3 + (skills.some((s) => s.id === 'firebolt') ? 5 : 0),
    ranger: stats.bowShots * 3 + (skills.some((s) => s.id === 'bow_mastery') ? 5 : 0),
    rogue: stats.stealthCrits * 3 + stats.meleeHits * 0.6,
    cleric: stats.healsDone * 4 + (skills.some((s) => s.id === 'shrine_mend') ? 4 : 0),
    artificer: stats.craftsAndBuilds * 1.5 + (skills.some((s) => s.id === 'smithing') ? 5 : 0),
    tamer: stats.tamesAndAnimals * 4 + (skills.some((s) => s.id === 'beast_bond') ? 5 : 0),
  };

  let best: Exclude<CharacterClassId, 'unawakened'> = 'warrior';
  let bestScore = -1;
  (Object.keys(scores) as Array<Exclude<CharacterClassId, 'unawakened'>>).forEach((k) => {
    if (scores[k] > bestScore) {
      bestScore = scores[k];
      best = k;
    }
  });
  return best;
}

export function xpRequiredForLevel(level: number): number {
  return Math.round(90 + (level - 1) * 65);
}

export function createInitialRpgState(): RpgPlayerState {
  const starterBlade = generateGearItem({
    level: 1,
    rarity: 'Common',
    slot: 'weapon',
    weaponKind: 'melee',
    soulbound: true,
    customName: 'Awakened Wooden Sword',
  });

  return {
    rebirthCompleted: false,
    level: 1,
    xp: 0,
    xpToNext: xpRequiredForLevel(1),
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    hunger: 100,
    maxHunger: 100,
    gold: 50,
    playerClass: 'unawakened',
    classChoicePending: false,
    pvpEnabled: false,
    deaths: 0,
    homeSpawn: { x: 16, y: 5, z: 19 },
    homeRealm: 'home',
    activeRealm: 'home',
    activeDungeon: null,
    clearedDungeons: [],
    skills: [],
    playstyle: {
      meleeHits: 0,
      magicCasts: 0,
      bowShots: 0,
      stealthCrits: 0,
      healsDone: 0,
      craftsAndBuilds: 0,
      tamesAndAnimals: 0,
    },
    resources: {
      wood: 4,
      stone: 4,
      ore: 1,
      meat: 2,
      hide: 1,
    },
    equipped: {
      weapon: starterBlade,
      armor: null,
      accessory: null,
    },
    inventory: [],
    worldChests: {
      home: [],
      desert: [],
      ice: [],
      sky: [],
      dark: [],
    },
    graves: [],
    quests: [
      { questId: 'q-timber-harvest', progress: 0, completed: false, claimed: false },
    ],
    tamedPet: null,
    dungeonMapScrolls: 0,
  };
}

/**
 * 5 original NPCs with fixed written personalities, backstories, dialogue trees, and teachable skills.
 */
export function createHomeWorldNpcs(): NpcDefinition[] {
  return [
    {
      id: 'npc-sera',
      name: 'Sera',
      role: 'Shrine Keeper & Guide',
      personality: 'Calm, observant, gently encouraging; speaks with quiet wonder about reborn travelers.',
      backstory: 'Sera has tended the Awakening Shrine of Elderglen for thirty seasons, greeting every soul who wakes without memories.',
      greeting: 'Easy now, traveler. You woke beside the Awakening Shrine with the System halo still fading around your shoulders.',
      dialogue: [
        'No one remembers the crossing into Gate Haven—only that you start with no class and shape your own destiny by Level 5.',
        'Bind your favorite gear at the Shrine with gold so it becomes Soulbound. Unbound gear drops where you fall!',
        'When you feel ready, inspect the Quest Board or visit Bram, Kael, and Lyra to learn real skills.',
      ],
      branches: [
        {
          label: 'Learn Shrine Mend (Free)',
          response: 'Focus your breath and press C to mend your wounds. It will grow stronger every time you heal.',
          action: 'teach_skill',
          skillId: 'shrine_mend',
        },
        {
          label: 'Use the Awakening Shrine (Heal / Soulbind / Set Home)',
          response: 'May the Shrine remember your spirit and protect what matters most.',
          action: 'open_shrine',
        },
        {
          label: 'How does Level 5 Class Evolution work?',
          response: 'The System watches every swing, arrow, spell, craft, and animal you befriend. At Level 5 it suggests a class—though the final choice is always yours.',
        },
      ],
      teachableSkillIds: ['shrine_mend'],
      home: { x: 16.0, y: 4, z: 17.5 },
      wanderRadius: 2.2,
      avatar: {
        displayName: 'Sera',
        bodyColor: '#F3C6A5',
        shirtColor: '#0D9488',
        shirtStyle: 'hoodie',
        pantsColor: '#1E293B',
        hat: 'sunhat',
        hatColor: '#FEF3C7',
      },
    },
    {
      id: 'npc-bram',
      name: 'Bram',
      role: 'Village Blacksmith',
      personality: 'Gruff but warm-hearted, fiercely proud of clean welds and well-kept blades.',
      backstory: 'Bram built Elderglen’s obsidian forge after surviving the Ember Mines and refuses to let any adventurer leave with dull steel.',
      greeting: 'Hah! Another freshly awakened adventurer swinging a twig. Step up to the forge and let us get some proper iron in your hands.',
      dialogue: [
        'Every sword and chestplate wears down in dungeons. Bring them back to me before they snap.',
        'Mine Gold or Diamond Ore up on the northern ridge if you want to craft Epic blades.',
        'Learn Smithing from me and every piece you forge will come off the anvil stronger.',
      ],
      branches: [
        {
          label: 'Learn Smithing (Free)',
          response: 'Watch the sparks, strike true! Your Smithing skill is now unlocked and will level up as you craft.',
          action: 'teach_skill',
          skillId: 'smithing',
        },
        {
          label: 'Learn Repair (15 Gold)',
          response: 'Smart choice. With Repair learned, fixing worn gear costs half as much gold.',
          action: 'teach_skill',
          skillId: 'repair',
        },
        {
          label: 'Repair All Equipped Gear',
          response: 'Let me hammer those dents out for you right now.',
          action: 'repair_gear',
        },
        {
          label: 'Open Crafting Anvil',
          response: 'Use the anvil anytime to turn wood, stone, hide, and ore into real gear.',
          action: 'open_craft',
        },
      ],
      teachableSkillIds: ['smithing', 'repair'],
      home: { x: 20.5, y: 4, z: 15.0 },
      wanderRadius: 2.0,
      avatar: {
        displayName: 'Bram',
        bodyColor: '#D89E72',
        shirtColor: '#DC2626',
        shirtStyle: 'overalls',
        pantsColor: '#334155',
        hat: 'beanie',
        hatColor: '#334155',
      },
    },
    {
      id: 'npc-kael',
      name: 'Kael',
      role: 'Woodland Hunter',
      personality: 'Sharp-eyed, dry-humored, deeply respectful of wildlife and patient with rookies.',
      backstory: 'Kael mapped every deer trail and wolf den across Elderglen and tamed his first silver wolf before he turned sixteen.',
      greeting: 'Quiet step—good. Keep your eyes on the treeline. Deer and rabbits mean dinner; wolves after dusk mean trouble.',
      dialogue: [
        'Press R to fire an arrow once you learn Bow Mastery. Aim ahead of moving targets!',
        'Want a loyal wolf or swift deer at your side? Learn Beast Bond or awaken as a Tamer at Level 5, then press Y near wildlife.',
        'Cook raw meat at the Crafting panel so your Hunger stays topped up in dungeons.',
        'Dungeons start completely dark on your auto-map until you explore each room—or bring one of my Dungeon Map Scrolls to reveal every corridor at once.',
      ],
      branches: [
        {
          label: 'Learn Tracking (Free)',
          response: 'Look for bent grass and pawprints. Tracking is yours—you will harvest extra meat and hide now, and spot creatures farther on your mini-map.',
          action: 'teach_skill',
          skillId: 'tracking',
        },
        {
          label: 'Learn Bow Mastery (10 Gold)',
          response: 'Steady breathing, clean release. Press R to loose arrows at monsters!',
          action: 'teach_skill',
          skillId: 'bow_mastery',
        },
        {
          label: 'Learn Beast Bond (20 Gold)',
          response: 'Approach a deer, rabbit, boar, or wolf and press Y to offer friendship.',
          action: 'teach_skill',
          skillId: 'beast_bond',
        },
        {
          label: 'Buy Dungeon Map Scroll (30 Gold)',
          response: 'Tuck this parchment safe. Open your Dungeon Auto-Map inside any dungeon and use it to reveal every procedural room, trap, and chest!',
          action: 'buy_dungeon_map',
        },
      ],
      teachableSkillIds: ['tracking', 'bow_mastery', 'beast_bond'],
      home: { x: 11.5, y: 4, z: 14.5 },
      wanderRadius: 2.8,
      avatar: {
        displayName: 'Kael',
        bodyColor: '#8D5524',
        shirtColor: '#16A34A',
        shirtStyle: 'striped',
        pantsColor: '#3F6212',
        hat: 'cap',
        hatColor: '#15803D',
      },
    },
    {
      id: 'npc-lyra',
      name: 'Lyra',
      role: 'Village Mage',
      personality: 'Curious, enthusiastic, occasionally talks too fast when explaining arcane runes.',
      backstory: 'Lyra discovered how Elderglen’s dimensional portals weave together and studies the System windows that appear to reborn travelers.',
      greeting: 'Oh! A genuine System-blessed traveler! Your mana signature is sparkling—please tell me you want to learn Firebolt!',
      dialogue: [
        'Press G to hurl a Firebolt once I teach you! It lights up dark caves and hits monsters hard.',
        'Want to read a monster’s exact health, drops, and weaknesses from afar? Learn Inspect from me and press I—it pairs brilliantly if you hide overhead labels in Settings!',
        'The glowing stone arches on the northern terrace lead to Other Worlds—Desert, Ice, Sky Islands, and Shadowreach!',
        'Remember: only Soulbound gear crosses dimensional portals with you. Unbound gear stays safely inside this world’s chest.',
      ],
      branches: [
        {
          label: 'Learn Firebolt (Free)',
          response: 'Spark the embers and press G! Watch how fast your Firebolt levels up in the Sunken Crypt.',
          action: 'teach_skill',
          skillId: 'firebolt',
        },
        {
          label: 'Learn Inspect (10 Gold)',
          response: 'Your eyes are attuned! Aim at any creature, villager, portal, chest, or block and press I to inspect its hidden details. Use it often to expand its range and insight.',
          action: 'teach_skill',
          skillId: 'inspect',
        },
        {
          label: 'Learn Arcane Shield (20 Gold)',
          response: 'A subtle ward now wraps your aura—monsters and dungeon traps will sting noticeably less.',
          action: 'teach_skill',
          skillId: 'arcane_shield',
        },
      ],
      teachableSkillIds: ['firebolt', 'inspect', 'arcane_shield'],
      home: { x: 18.5, y: 4, z: 20.5 },
      wanderRadius: 2.4,
      avatar: {
        displayName: 'Lyra',
        bodyColor: '#F2C29B',
        shirtColor: '#7C3AED',
        shirtStyle: 'classic',
        pantsColor: '#312E81',
        hat: 'wizard',
        hatColor: '#6D28D9',
      },
    },
    {
      id: 'npc-alden',
      name: 'Alden',
      role: 'Quest Quartermaster',
      personality: 'Cheerful, methodical, loves ticking off completed bounties on his wooden clipboard.',
      backstory: 'Alden founded the Elderglen Quest Board so every village task—from gathering timber to conquering dungeons—earns fair XP and loot.',
      greeting: 'Welcome to the Quest Board! Pick up a couple of bounties before heading into the forest or the Sunken Crypt.',
      dialogue: [
        'Fetch, Hunt, Escort, and Dungeon quests all grant XP toward your Level 5 Class Awakening!',
        'If a dungeon says its level is higher than yours, gear up first—death costs a full level here.',
      ],
      branches: [
        {
          label: 'Open Village Quest Board',
          response: 'Here are all the active bounties and dungeon trials!',
          action: 'open_quests',
        },
      ],
      teachableSkillIds: [],
      home: { x: 14.0, y: 4, z: 20.0 },
      wanderRadius: 1.8,
      avatar: {
        displayName: 'Alden',
        bodyColor: '#F2C29B',
        shirtColor: '#2563EB',
        shirtStyle: 'striped',
        pantsColor: '#1E293B',
        hat: 'cap',
        hatColor: '#F59E0B',
      },
    },
  ];
}
