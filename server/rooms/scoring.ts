import { ENGINE } from '../../shared/engine';
import type { IslandRoomState } from '../../shared/schema';

export type ScoreReason = keyof typeof ENGINE.points;

export function awardPoints(
  state: IslandRoomState,
  teamId: string,
  reason: ScoreReason,
): number {
  if (state.phase === 'ended') return 0;
  const base = state.bases.get(teamId);
  if (!base) return 0;

  const delta = ENGINE.points[reason];
  if (typeof delta !== 'number' || !Number.isFinite(delta) || delta <= 0) {
    throw new Error(`Unknown score reason: ${String(reason)}`);
  }

  base.points += delta;
  evaluateMatchEnd(state);
  return delta;
}

export function evaluateMatchEnd(state: IslandRoomState): void {
  if (state.phase === 'ended') return;

  const bases = Array.from(state.bases.values());
  if (bases.length === 0) return;

  // 1. Score threshold check
  let thresholdLeader: { teamId: string; points: number } | null = null;
  let tiedAtThreshold = false;

  for (const base of bases) {
    if (base.points >= ENGINE.winScoreThreshold) {
      if (!thresholdLeader || base.points > thresholdLeader.points) {
        thresholdLeader = { teamId: base.teamId, points: base.points };
        tiedAtThreshold = false;
      } else if (base.points === thresholdLeader.points) {
        tiedAtThreshold = true;
      }
    }
  }

  if (thresholdLeader) {
    state.phase = 'ended';
    state.winnerTeamId = tiedAtThreshold ? 'draw' : thresholdLeader.teamId;
    return;
  }

  // 2. Match timer expiration check
  if (state.matchTimeRemaining <= 0) {
    state.matchTimeRemaining = 0;
    let topPoints = -Infinity;
    let leaders: string[] = [];

    for (const base of bases) {
      if (base.points > topPoints) {
        topPoints = base.points;
        leaders = [base.teamId];
      } else if (base.points === topPoints) {
        leaders.push(base.teamId);
      }
    }

    state.phase = 'ended';
    state.winnerTeamId = leaders.length === 1 ? leaders[0] : 'draw';
  }
}
