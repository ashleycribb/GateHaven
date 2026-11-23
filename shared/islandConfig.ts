import defaultIslandConfigJson from './defaultIslandConfig.json';
import { ENGINE, type CrateTier, type SocketType } from './engine';

export interface IslandConfig {
  readonly teamCount: number;
  readonly radius: number;
  readonly centerRadius: number;
  readonly baseRadius: number;
  readonly outerCrateCount: number;
  readonly midCrateCount: number;
  readonly centerCrateCount: number;
}

export interface SocketPlacement {
  readonly id: string;
  readonly type: SocketType;
  readonly x: number;
  readonly z: number;
}

export interface BasePlacement {
  readonly teamId: string;
  readonly teamIndex: number;
  readonly angle: number;
  readonly x: number;
  readonly z: number;
  readonly sockets: readonly SocketPlacement[];
}

export interface CratePlacement {
  readonly id: string;
  readonly x: number;
  readonly z: number;
  readonly tier: CrateTier;
}

export interface RadialIslandLayout {
  readonly config: IslandConfig;
  readonly bases: readonly BasePlacement[];
  readonly crates: readonly CratePlacement[];
}

function assertFiniteNumber(obj: Record<string, unknown>, key: string): number {
  const val = obj[key];
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(`Invalid IslandConfig: "${key}" must be a finite number`);
  }
  return val;
}

function assertIntegerInRange(
  obj: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
): number {
  const val = assertFiniteNumber(obj, key);
  if (!Number.isInteger(val) || val < min || val > max) {
    throw new Error(`Invalid IslandConfig: "${key}" must be an integer between ${min} and ${max}`);
  }
  return val;
}

export function validateIslandConfig(raw: unknown): IslandConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new Error('Invalid IslandConfig: expected a plain object');
  }
  const rec = raw as Record<string, unknown>;

  const teamCount = assertIntegerInRange(rec, 'teamCount', 2, 5);
  const radius = assertFiniteNumber(rec, 'radius');
  const centerRadius = assertFiniteNumber(rec, 'centerRadius');
  const baseRadius = assertFiniteNumber(rec, 'baseRadius');
  const outerCrateCount = assertIntegerInRange(rec, 'outerCrateCount', 0, 64);
  const midCrateCount = assertIntegerInRange(rec, 'midCrateCount', 0, 64);
  const centerCrateCount = assertIntegerInRange(rec, 'centerCrateCount', 1, 32);

  if (radius <= 20) {
    throw new Error('Invalid IslandConfig: "radius" must be greater than 20');
  }
  if (centerRadius <= 4 || centerRadius >= baseRadius) {
    throw new Error('Invalid IslandConfig: "centerRadius" must be > 4 and < baseRadius');
  }
  if (baseRadius >= radius - ENGINE.islandEdgeMargin) {
    throw new Error('Invalid IslandConfig: "baseRadius" must be inside the island edge margin');
  }

  return {
    teamCount,
    radius,
    centerRadius,
    baseRadius,
    outerCrateCount,
    midCrateCount,
    centerCrateCount,
  };
}

export function loadIslandConfigFromJson(jsonText: string): IslandConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new Error(`Invalid IslandConfig JSON: ${(err as Error).message}`);
  }
  return validateIslandConfig(parsed);
}

export const PASS1_ISLAND_CONFIG: IslandConfig = validateIslandConfig(defaultIslandConfigJson);

export function buildRadialIslandLayout(rawConfig: IslandConfig): RadialIslandLayout {
  const config = validateIslandConfig(rawConfig);
  const bases: BasePlacement[] = [];

  for (let i = 0; i < config.teamCount; i++) {
    const angle = (2 * Math.PI * i) / config.teamCount;
    const x = Math.cos(angle) * config.baseRadius;
    const z = Math.sin(angle) * config.baseRadius;
    const teamId = `team_${i}`;

    // Unit vector pointing inward from base toward island center, plus perpendicular tangent
    const inwardX = -Math.cos(angle);
    const inwardZ = -Math.sin(angle);
    const tangentX = -inwardZ;
    const tangentZ = inwardX;

    const localSockets: Array<{ suffix: string; type: SocketType; forward: number; lateral: number }> = [
      { suffix: 'wall_0', type: 'wall', forward: 7.5, lateral: -4.0 },
      { suffix: 'wall_1', type: 'wall', forward: 7.5, lateral: 4.0 },
      { suffix: 'tower_0', type: 'tower', forward: 5.5, lateral: -7.5 },
      { suffix: 'tower_1', type: 'tower', forward: 5.5, lateral: 7.5 },
      { suffix: 'trap_pad_0', type: 'trap_pad', forward: 10.5, lateral: 0.0 },
      { suffix: 'core_upgrade_0', type: 'core_upgrade', forward: 0.0, lateral: 0.0 },
    ];

    const sockets: SocketPlacement[] = localSockets.map((s) => ({
      id: `${teamId}_${s.suffix}`,
      type: s.type,
      x: x + inwardX * s.forward + tangentX * s.lateral,
      z: z + inwardZ * s.forward + tangentZ * s.lateral,
    }));

    bases.push({
      teamId,
      teamIndex: i,
      angle,
      x,
      z,
      sockets,
    });
  }

  const crates: CratePlacement[] = [];
  let crateSeq = 0;

  // Tier 3: Center high-loot disc (strictly inside centerRadius)
  const centerRingRadius = config.centerRadius * 0.52;
  for (let i = 0; i < config.centerCrateCount; i++) {
    const angle = (2 * Math.PI * i) / config.centerCrateCount + Math.PI / 4;
    crates.push({
      id: `crate_${crateSeq++}`,
      x: Math.cos(angle) * centerRingRadius,
      z: Math.sin(angle) * centerRingRadius,
      tier: 3,
    });
  }

  // Tier 2: Mid ring between center disc and bases
  const midRingRadius = (config.centerRadius + config.baseRadius) * 0.5;
  for (let i = 0; i < config.midCrateCount; i++) {
    const angle = (2 * Math.PI * i) / config.midCrateCount + Math.PI / Math.max(config.midCrateCount, 1);
    crates.push({
      id: `crate_${crateSeq++}`,
      x: Math.cos(angle) * midRingRadius,
      z: Math.sin(angle) * midRingRadius,
      tier: 2,
    });
  }

  // Tier 1: Outer ring distributed around the island perimeter
  const outerRingRadius = config.baseRadius * 0.86;
  for (let i = 0; i < config.outerCrateCount; i++) {
    const angle = (2 * Math.PI * i) / config.outerCrateCount + Math.PI / (config.teamCount * 2);
    crates.push({
      id: `crate_${crateSeq++}`,
      x: Math.cos(angle) * outerRingRadius,
      z: Math.sin(angle) * outerRingRadius,
      tier: 1,
    });
  }

  return { config, bases, crates };
}
