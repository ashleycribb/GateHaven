export { DISPLAY_NAME, DISPLAY_SUBTITLE, DISPLAY_DESCRIPTION } from './branding';

export const ENGINE = {
  port: 3000,
  host: '0.0.0.0',

  // Simulation & netcode rates
  tickRate: 30,
  subSteps: 2, // 30 Hz input, 60 Hz sim / bot sub-steps
  interpDelayMs: 100,
  maxRewindMs: 500,

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
} as const;

export type CrateTier = 1 | 2 | 3;
export type SocketType = 'wall' | 'tower' | 'trap_pad' | 'core_upgrade';

export const VALID_SOCKET_TYPES: readonly SocketType[] = [
  'wall',
  'tower',
  'trap_pad',
  'core_upgrade',
] as const;
