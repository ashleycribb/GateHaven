import { ENGINE } from './engine';

export interface MarinaSlipPose {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly rotY: number;
}

export interface ShoreLandingPoint {
  readonly x: number;
  readonly z: number;
  readonly approachX: number;
  readonly approachZ: number;
  readonly angle: number;
}

export function getTeamIndexFromId(teamId: string): number {
  const match = /^team_(\d+)$/.exec(teamId);
  if (!match) {
    throw new Error(`Invalid teamId: ${teamId}`);
  }
  return Number(match[1]);
}

export function getMarinaSlipPose(teamIndex: number, teamCount: number): MarinaSlipPose {
  const offsetIndex = teamIndex - (teamCount - 1) / 2;
  const x = ENGINE.marina.centerX + offsetIndex * ENGINE.marina.slipSpacing;
  const z = ENGINE.marina.centerZ + ENGINE.marina.slipOffsetZ;
  return {
    x,
    y: ENGINE.water.baseY + 0.35,
    z,
    rotY: 0,
  };
}

export function getTeamShoreLandingPoint(
  config: { teamCount: number; radius: number; baseRadius: number },
  teamId: string,
): ShoreLandingPoint {
  const idx = getTeamIndexFromId(teamId);
  if (idx < 0 || idx >= config.teamCount) {
    throw new Error(`Team index ${idx} out of range for teamCount ${config.teamCount}`);
  }
  const angle = (2 * Math.PI * idx) / config.teamCount;
  const landingR = config.radius - ENGINE.shoreLandingOffsetFromRadius;
  const approachR = config.radius + 4.0;
  return {
    x: Math.cos(angle) * landingR,
    z: Math.sin(angle) * landingR,
    approachX: Math.cos(angle) * approachR,
    approachZ: Math.sin(angle) * approachR,
    angle,
  };
}

export function sampleBoatPath(
  teamIndex: number,
  teamCount: number,
  config: { teamCount: number; radius: number; baseRadius: number },
  progress01: number,
): MarinaSlipPose {
  const t = Math.max(0, Math.min(1, progress01));
  const slip = getMarinaSlipPose(teamIndex, teamCount);
  const shore = getTeamShoreLandingPoint(config, `team_${teamIndex}`);

  // Smooth cubic bezier arcing around the outer coastline so boats never clip through the island
  const startAngle = Math.atan2(slip.z, slip.x);
  let deltaAngle = shore.angle - startAngle;
  while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
  while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

  const startR = Math.hypot(slip.x, slip.z);
  const endR = Math.hypot(shore.approachX, shore.approachZ);
  const midR = Math.max(startR, endR) + 8;

  const eased = t * t * (3 - 2 * t);
  const angle = startAngle + deltaAngle * eased;
  const r =
    (1 - eased) * (1 - eased) * startR +
    2 * (1 - eased) * eased * midR +
    eased * eased * endR;

  const x = Math.cos(angle) * r;
  const z = Math.sin(angle) * r;

  // Approximate tangent heading
  const tNext = Math.min(1, t + 0.02);
  const eNext = tNext * tNext * (3 - 2 * tNext);
  const aNext = startAngle + deltaAngle * eNext;
  const rNext =
    (1 - eNext) * (1 - eNext) * startR +
    2 * (1 - eNext) * eNext * midR +
    eNext * eNext * endR;
  const dx = Math.cos(aNext) * rNext - x;
  const dz = Math.sin(aNext) * rNext - z;
  const rotY = Math.hypot(dx, dz) > 0.001 ? Math.atan2(dx, dz) : Math.atan2(-x, -z);

  return {
    x,
    y: ENGINE.water.baseY + 0.35,
    z,
    rotY,
  };
}

export function clampToDockBounds(pose: { x: number; y: number; z: number }): void {
  const minX = ENGINE.marina.centerX - ENGINE.marina.halfWidth;
  const maxX = ENGINE.marina.centerX + ENGINE.marina.halfWidth;
  const minZ = ENGINE.marina.centerZ - ENGINE.marina.halfDepth;
  const maxZ = ENGINE.marina.centerZ + ENGINE.marina.halfDepth;

  pose.x = Math.max(minX, Math.min(maxX, pose.x));
  pose.z = Math.max(minZ, Math.min(maxZ, pose.z));
  pose.y = ENGINE.marina.deckY;
}
