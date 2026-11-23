import { applyInput } from '../../shared/applyInput';
import { ENGINE, type SocketType } from '../../shared/engine';
import type { BaseState, CrateState, IslandRoomState, PlayerState, SocketState } from '../../shared/schema';
import { getEffectiveItemStats } from '../systems/LootSystem';

export type BotStateName = 'patrol' | 'loot' | 'build' | 'fight';

export interface BotDecisionContext {
  readonly hasEnemyInRange: boolean;
  readonly hasNearbyCrate: boolean;
  readonly hasFreeSocketNearBase: boolean;
  readonly isHelper: boolean;
}

export function selectBotState(ctx: BotDecisionContext): BotStateName {
  if (ctx.hasEnemyInRange) {
    return 'fight';
  }
  if (ctx.isHelper) {
    return ctx.hasFreeSocketNearBase ? 'build' : 'patrol';
  }
  if (ctx.hasNearbyCrate) {
    return 'loot';
  }
  if (ctx.hasFreeSocketNearBase) {
    return 'build';
  }
  return 'patrol';
}

export interface BotActionHooks {
  onOpenCrate: (botId: string, crateId: string) => void;
  onBuildSocket: (botId: string, socketId: string, type: SocketType, targetTier: number) => void;
  onAttackEnemy: (botId: string, targetId: string, damage: number) => void;
}

interface BotMemory {
  patrolAngle: number;
  attackCooldownMs: number;
  buildCooldownMs: number;
}

export class BotController {
  private readonly memories = new Map<string, BotMemory>();

  private getMemory(botId: string): BotMemory {
    let mem = this.memories.get(botId);
    if (!mem) {
      let hash = 0;
      for (let i = 0; i < botId.length; i++) {
        hash = (hash * 31 + botId.charCodeAt(i)) | 0;
      }
      mem = {
        patrolAngle: ((Math.abs(hash) % 360) * Math.PI) / 180,
        attackCooldownMs: 0,
        buildCooldownMs: 2500,
      };
      this.memories.set(botId, mem);
    }
    return mem;
  }

  public stepAll(state: IslandRoomState, subDt: number, hooks: BotActionHooks): void {
    if (state.phase === 'ended') return;
    const radius = state.islandConfig.radius;
    const dtMs = subDt * 1000;

    for (const bot of state.players.values()) {
      if (!bot.isBot || !bot.alive) continue;
      this.stepOne(state, bot, subDt, dtMs, radius, hooks);
    }
  }

  private stepOne(
    state: IslandRoomState,
    bot: PlayerState,
    subDt: number,
    dtMs: number,
    radius: number,
    hooks: BotActionHooks,
  ): void {
    const mem = this.getMemory(bot.id);
    mem.attackCooldownMs = Math.max(0, mem.attackCooldownMs - dtMs);
    mem.buildCooldownMs = Math.max(0, mem.buildCooldownMs - dtMs);

    const isHelper = bot.id.startsWith('helper_');
    const ownBase = state.bases.get(bot.teamId);

    // Find nearest living enemy
    let nearestEnemy: PlayerState | null = null;
    let nearestEnemyDist = Infinity;
    const aggroRange = isHelper ? ENGINE.helperLeashRadius : ENGINE.botAggroRange;

    for (const other of state.players.values()) {
      if (!other.alive || other.teamId === bot.teamId) continue;
      const dist = Math.hypot(other.x - bot.x, other.z - bot.z);
      if (dist <= aggroRange && dist < nearestEnemyDist) {
        if (isHelper && ownBase) {
          const enemyDistFromBase = Math.hypot(other.x - ownBase.x, other.z - ownBase.z);
          if (enemyDistFromBase > ENGINE.helperLeashRadius + 4) continue;
        }
        nearestEnemy = other;
        nearestEnemyDist = dist;
      }
    }

    // Find nearest unopened crate (roaming bots only)
    let nearestCrate: CrateState | null = null;
    let nearestCrateDist = Infinity;
    if (!isHelper) {
      for (const crate of state.crates.values()) {
        if (crate.opened) continue;
        const dist = Math.hypot(crate.x - bot.x, crate.z - bot.z);
        if (dist <= ENGINE.botLootRange && dist < nearestCrateDist) {
          nearestCrate = crate;
          nearestCrateDist = dist;
        }
      }
    }

    // Find buildable socket on own base
    const freeSocket = ownBase ? this.findFreeSocket(ownBase) : null;
    const nearBaseForBuild =
      freeSocket !== null &&
      ownBase !== undefined &&
      (isHelper || Math.hypot(bot.x - ownBase.x, bot.z - ownBase.z) <= ENGINE.baseBuildRange * 1.6);

    const mode = selectBotState({
      hasEnemyInRange: nearestEnemy !== null,
      hasNearbyCrate: nearestCrate !== null,
      hasFreeSocketNearBase: nearBaseForBuild && mem.buildCooldownMs <= 0,
      isHelper,
    });

    let targetX = bot.x;
    let targetZ = bot.z;
    let shouldMove = true;

    if (mode === 'fight' && nearestEnemy) {
      targetX = nearestEnemy.x;
      targetZ = nearestEnemy.z;

      const weapon = bot.weaponSlots.length > 0 ? bot.weaponSlots[0] : null;
      const stats = weapon ? getEffectiveItemStats(weapon) : { damage: 14, range: 16, cooldownMs: ENGINE.botAttackCooldownMs };
      const attackRange = Math.min(stats.range, 16);

      if (nearestEnemyDist <= attackRange * 0.7) {
        shouldMove = false;
      }
      if (nearestEnemyDist <= attackRange && mem.attackCooldownMs <= 0) {
        hooks.onAttackEnemy(bot.id, nearestEnemy.id, stats.damage);
        mem.attackCooldownMs = Math.max(ENGINE.botAttackCooldownMs, stats.cooldownMs);
      }
    } else if (mode === 'loot' && nearestCrate) {
      targetX = nearestCrate.x;
      targetZ = nearestCrate.z;
      if (nearestCrateDist <= ENGINE.crateInteractRange * 0.85) {
        hooks.onOpenCrate(bot.id, nearestCrate.id);
        shouldMove = false;
      }
    } else if (mode === 'build' && freeSocket) {
      targetX = freeSocket.x;
      targetZ = freeSocket.z;
      const distToSocket = Math.hypot(freeSocket.x - bot.x, freeSocket.z - bot.z);
      if (distToSocket <= ENGINE.baseBuildRange * 0.5) {
        hooks.onBuildSocket(bot.id, freeSocket.id, freeSocket.type as SocketType, freeSocket.tier + 1);
        mem.buildCooldownMs = 4500;
        shouldMove = false;
      }
    } else {
      // Patrol
      mem.patrolAngle += subDt * (isHelper ? 0.55 : 0.25);
      if (isHelper && ownBase) {
        const orbitR = Math.min(6.5, ENGINE.helperLeashRadius * 0.5);
        targetX = ownBase.x + Math.cos(mem.patrolAngle) * orbitR;
        targetZ = ownBase.z + Math.sin(mem.patrolAngle) * orbitR;
      } else {
        // Patrol toward center high-loot arena and mid-ring
        const patrolR = state.islandConfig.centerRadius * 1.15;
        targetX = Math.cos(mem.patrolAngle) * patrolR;
        targetZ = Math.sin(mem.patrolAngle) * patrolR;
      }
    }

    const dx = targetX - bot.x;
    const dz = targetZ - bot.z;
    const dist = Math.hypot(dx, dz);

    let moveX = 0;
    let moveZ = 0;
    let rotY = bot.rotY;

    if (dist > 0.2) {
      rotY = Math.atan2(dx, dz);
      if (shouldMove) {
        moveX = dx / dist;
        moveZ = dz / dist;
      }
    }

    const speedFactor = isHelper ? 0.65 : 0.78;
    applyInput(bot, { moveX, moveZ, rotY }, subDt, radius, speedFactor);

    // Enforce helper leash strictly around own base
    if (isHelper && ownBase) {
      const hx = bot.x - ownBase.x;
      const hz = bot.z - ownBase.z;
      const hDist = Math.hypot(hx, hz);
      const maxLeash = ENGINE.helperLeashRadius - 0.5;
      if (hDist > maxLeash) {
        const scale = maxLeash / hDist;
        bot.x = ownBase.x + hx * scale;
        bot.z = ownBase.z + hz * scale;
      }
    }
  }

  private findFreeSocket(base: BaseState): SocketState | null {
    for (const sock of base.sockets.values()) {
      if (!sock.occupied && sock.tier < ENGINE.maxBaseTier) {
        return sock;
      }
    }
    return null;
  }
}
