import { ENGINE, VALID_SOCKET_TYPES, type SocketType } from '../../shared/engine';
import type { BaseState, SocketState } from '../../shared/schema';
import type { MatchLog } from '../../server/MatchLog';

export type BuildSocketResult =
  | { ok: true; socket: SocketState; upgradedCore: boolean }
  | { ok: false; error: string };

export function isValidSocketType(value: string): value is SocketType {
  return (VALID_SOCKET_TYPES as readonly string[]).includes(value);
}

export function buildOnSocket(
  base: BaseState | undefined,
  socketId: string,
  actorTeamId: string,
  requestedType: SocketType,
  targetTier: number,
  matchLog?: MatchLog,
): BuildSocketResult {
  if (!base) {
    return { ok: false, error: 'Base not found' };
  }
  if (base.teamId !== actorTeamId) {
    return { ok: false, error: 'Cannot build on another team base' };
  }
  if (!isValidSocketType(requestedType)) {
    return { ok: false, error: `Invalid socket type: ${String(requestedType)}` };
  }

  const socket = base.sockets.get(socketId);
  if (!socket) {
    return { ok: false, error: `Socket not found: ${socketId}` };
  }
  if (socket.type !== requestedType) {
    return { ok: false, error: `Socket ${socketId} requires type ${socket.type}, got ${requestedType}` };
  }
  if (!Number.isInteger(targetTier) || targetTier < 1 || targetTier > ENGINE.maxBaseTier) {
    return { ok: false, error: `Illegal build tier: ${targetTier}` };
  }
  if (targetTier !== socket.tier + 1) {
    return {
      ok: false,
      error: `Socket ${socketId} must advance sequentially from tier ${socket.tier} to ${socket.tier + 1}`,
    };
  }

  socket.occupied = true;
  socket.tier = targetTier;

  let upgradedCore = false;
  if (socket.type === 'core_upgrade') {
    base.tier = Math.min(ENGINE.maxBaseTier, Math.max(base.tier + 1, targetTier + 1));
    base.coreHp += ENGINE.coreUpgradeHpBonus;
    upgradedCore = true;
  }

  if (matchLog) {
    matchLog.record({
      type: 'base_upgraded',
      x: socket.x,
      y: 0,
      z: socket.z,
      teamId: actorTeamId,
      detail: `${socket.id}:tier_${targetTier}`,
    });
  }

  return { ok: true, socket, upgradedCore };
}
