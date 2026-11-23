export { DISPLAY_NAME, DISPLAY_SUBTITLE, DISPLAY_DESCRIPTION } from './branding';

export type QualityPresetName = 'low' | 'medium' | 'high';
export type RoomPhase = 'dock' | 'boarding' | 'sailing' | 'landing' | 'match' | 'ended';
export type WeatherKind = 'clear' | 'overcast' | 'rain' | 'storm';

export interface QualityPreset {
  readonly name: QualityPresetName;
  readonly maxDrawCalls: number;
  readonly maxTriangles: number;
  readonly shadowCascades: number;
  readonly shadowMapSize: number;
  readonly scatterDensity: number;
  readonly maxParticles: number;
}

export const ENGINE = {
  port: 3000,
  host: '0.0.0.0',

  // Simulation & netcode rates
  tickRate: 30,
  subSteps: 2, // 30 Hz input, 60 Hz sim / bot sub-steps
  interpDelayMs: 100,
  maxRewindMs: 500,

  // Pass 1 island geometry (matches shared/defaultIslandConfig.json)
  pass1IslandRadius: 80,

  // Movement & physics
  moveSpeed: 9.0,
  dashSpeedMultiplier: 2.35,
  dashDurationMs: 260,
  islandEdgeMargin: 1.5,

  // Combat & vitals
  playerMaxHp: 100,
  playerRespawnMs: 3000,
  playerHitRadius: 1.35,
  baseCoreMaxHp: 500,
  coreUpgradeHpBonus: 100,
  baseCoreHitRadius: 3.2,

  // Interaction & building
  baseBuildRange: 12.0,
  crateInteractRange: 3.5,
  trapTriggerRadius: 2.2,
  maxBaseTier: 3,

  // Loadout capacities
  maxWeaponSlots: 2,
  maxSkillSlots: 2,
  maxTrapSlots: 2,

  // Match scoring & win/draw rules
  matchDurationSec: 300,
  winScoreThreshold: 500,
  points: {
    loot: 15,
    upgrade: 40,
    tag: 50,
    coreBreach: 200,
    squadWipe: 100,
  },

  // Crate loot category odds by tier (1 = outer, 2 = mid, 3 = center high-loot)
  crateTierOdds: {
    1: { weapon: 0.45, skill: 0.25, trap: 0.30 },
    2: { weapon: 0.45, skill: 0.35, trap: 0.20 },
    3: { weapon: 0.50, skill: 0.35, trap: 0.15 },
  },
  crateStartingLevelByTier: {
    1: 1,
    2: 2,
    3: 3,
  },

  // Server-side bots & base-helper NPCs
  roamingBotsPerTeam: 1,
  botAttackCooldownMs: 650,
  botLootRange: 30,
  botAggroRange: 20,
  helperLeashRadius: 14,

  // Gemini server proxy guardrails
  maxGeminiBodyBytes: 32 * 1024,
  defaultGeminiRateLimit: 30,
  geminiModel: 'gemini-4-hydrogen',

  // Part B: Rendering budgets, quality presets, camera & terrain
  defaultQuality: 'medium' as QualityPresetName,
  qualityPresets: {
    low: {
      name: 'low',
      maxDrawCalls: 90,
      maxTriangles: 120_000,
      shadowCascades: 2,
      shadowMapSize: 512,
      scatterDensity: 0.45,
      maxParticles: 150,
    },
    medium: {
      name: 'medium',
      maxDrawCalls: 160,
      maxTriangles: 260_000,
      shadowCascades: 3,
      shadowMapSize: 1024,
      scatterDensity: 0.75,
      maxParticles: 350,
    },
    high: {
      name: 'high',
      maxDrawCalls: 260,
      maxTriangles: 480_000,
      shadowCascades: 4,
      shadowMapSize: 2048,
      scatterDensity: 1.0,
      maxParticles: 700,
    },
  } as Readonly<Record<QualityPresetName, QualityPreset>>,

  cameraOffset: {
    right: 1.45,
    height: 2.35,
    distance: 7.4,
    minCollisionDistance: 1.8,
    collisionMargin: 0.35,
  },

  scatterLod: {
    pineMidDistance: 45,
    pineFarDistance: 85,
    rockFarDistance: 65,
    grassFarDistance: 42,
  },

  terrain: {
    minHeight: -2.4,
    maxHeight: 4.8,
    subdivisions: 64,
    shorelineY: 0,
  },

  water: {
    baseY: -0.65,
    waveHeight: 0.24,
    waveLength: 0.14,
    windForce: -4.2,
    colorBlendFactor: 0.42,
  },

  hudBannedFonts: [
    'Comic Sans MS',
    'Comic Neue',
    'Fredoka',
    'Baloo',
    'Bubblegum Sans',
  ] as const,

  // Part C.1: Server-authoritative Dock / Marina / Boat Arrival
  phaseOrder: ['dock', 'boarding', 'sailing', 'landing', 'match', 'ended'] as const,
  marina: {
    centerX: 0,
    centerZ: -106,
    halfWidth: 16,
    halfDepth: 9,
    deckY: 0.45,
    slipSpacing: 9.0,
    slipOffsetZ: 8.5,
  },
  dockDurationSec: 4,
  boardingDurationSec: 5,
  sailingDurationSec: 6,
  landingDurationSec: 2,
  boatSpeed: 18,
  shoreLandingOffsetFromRadius: 6.5,
  landingRadius: 6.5,

  // Part C.2: Server-owned Weather & Ocean Audio
  defaultWeatherKind: 'overcast' as WeatherKind,
  weatherKinds: ['clear', 'overcast', 'rain', 'storm'] as const,
  weatherBounds: {
    wind: { min: 0, max: 1 },
    fogDensity: { min: 0.001, max: 0.035 },
    rainIntensity: { min: 0, max: 1 },
  },
  weatherPresets: {
    clear: { wind: 0.18, fogDensity: 0.0035, rainIntensity: 0 },
    overcast: { wind: 0.38, fogDensity: 0.0085, rainIntensity: 0 },
    rain: { wind: 0.62, fogDensity: 0.015, rainIntensity: 0.65 },
    storm: { wind: 0.92, fogDensity: 0.024, rainIntensity: 1.0 },
  } as Readonly<Record<WeatherKind, { readonly wind: number; readonly fogDensity: number; readonly rainIntensity: number }>>,
  weatherHoldDurationSec: 45,

  oceanAudioMaxDistance: 42,
  oceanAudio: {
    minGain: 0.0,
    maxGain: 0.55,
    minDistance: 0,
    maxDistance: 42,
    shoreCutoffHz: 4200,
    inlandCutoffHz: 750,
  },
} as const;

export type CrateTier = 1 | 2 | 3;
export type SocketType = 'wall' | 'tower' | 'trap_pad' | 'core_upgrade';

export const VALID_SOCKET_TYPES: readonly SocketType[] = [
  'wall',
  'tower',
  'trap_pad',
  'core_upgrade',
] as const;
