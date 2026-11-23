import { Room, type Client, type Rewind, type RewindView } from '@colyseus/core';
import { applyInput } from '../../shared/applyInput';
import { ENGINE, type SocketType } from '../../shared/engine';
import { buildRadialIslandLayout, PASS1_ISLAND_CONFIG, validateIslandConfig, type IslandConfig } from '../../shared/islandConfig';
import { ITEM_REGISTRY, type SlotKind } from '../../shared/itemRegistry';
import { MOVE_INPUT_SANITIZE, MoveInput, type MoveInputState } from '../../shared/MoveInput';
import { IslandState, PlayerSchema, TrapSchema, type IslandRoomState, type PlayerState } from '../../shared/schema';
import { BotController } from '../../src/entities/BotController';
import { buildOnSocket, isValidSocketType } from '../../src/systems/BaseSystem';
import {
  applyModifier,
  equipItem,
  getEffectiveItemStats,
  openCrate,
  upgradeItem,
} from '../../src/systems/LootSystem';
import { MatchLog } from '../MatchLog';
import { awardPoints, evaluateMatchEnd } from './scoring';
import { initializeIslandState } from './stateInit';

interface ServerTrapMeta {
  readonly id: string;
  readonly ownerId: string;
  readonly teamId: string;
  readonly itemId: string;
  readonly damage: number;
  readonly triggerRadius: number;
  readonly slowFactor: number;
  readonly durationMs: number;
}

interface UnitRuntime {
  attackCooldownMs: number;
  skillCooldownMs: number;
  trapCooldownMs: number;
  dashRemainingMs: number;
  slowRemainingMs: number;
  slowFactor: number;
  respawnRemainingMs: number;
  prevInteract: boolean;
  prevTrap: boolean;
}

export class IslandRoom extends Room<{ state: IslandRoomState; input: MoveInputState }> {
  public declare inputs: ReturnType<Room<{ state: IslandRoomState; input: MoveInputState }>['defineInput']>;
  public rewind!: Rewind;
  public readonly matchLog = new MatchLog();

  private readonly botController = new BotController();
  private readonly runtimeByUnit = new Map<string, UnitRuntime>();
  private readonly trapMeta = new Map<string, ServerTrapMeta>();
  private trapSeq = 0;

  onCreate(options?: { islandConfig?: Partial<IslandConfig> }): void {
    const config = options?.islandConfig
      ? validateIslandConfig({ ...PASS1_ISLAND_CONFIG, ...options.islandConfig })
      : PASS1_ISLAND_CONFIG;
    const layout = buildRadialIslandLayout(config);

    this.state = new IslandState();
    initializeIslandState(this.state, config, layout);

    this.inputs = this.defineInput(MoveInput, {
      sanitize: MOVE_INPUT_SANITIZE,
    });

    this.rewind = this.allowRewindState({
      maxRewindMs: ENGINE.maxRewindMs,
    });
    this.rewind.attachAll(this.state.players, {
      fields: ['x', 'y', 'z', 'rotY'],
      mode: 'snapshot',
    });

    this.spawnInitialBotsAndHelpers();
    this.registerMessageHandlers();

    this.setFixedTimestep(
      (ctx) => {
        this.step(ctx.dt, ctx.subSteps, ctx.subDt);
      },
      ENGINE.tickRate,
      { subSteps: ENGINE.subSteps },
    );
  }

  onJoin(client: Client): void {
    const teamId = this.pickBalancedTeam();
    const spawn = this.getSpawnPointForTeam(teamId, 2.5);

    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.teamId = teamId;
    player.isBot = false;
    player.x = spawn.x;
    player.y = 0;
    player.z = spawn.z;
    player.rotY = Math.atan2(-spawn.x, -spawn.z);
    player.hp = ENGINE.playerMaxHp;
    player.maxHp = ENGINE.playerMaxHp;
    player.shieldHp = 0;
    player.alive = true;
    player.activeWeaponIndex = 0;

    equipItem(player, 'weapon', 0, { itemId: 'plasma_carbine', level: 1, modifiers: [] });
    equipItem(player, 'skill', 0, { itemId: 'gale_dash', level: 1, modifiers: [] });
    equipItem(player, 'trap', 0, { itemId: 'blast_mine', level: 1, modifiers: [] });

    this.state.players.set(client.sessionId, player);
    this.runtimeByUnit.set(client.sessionId, this.createRuntime());
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.runtimeByUnit.delete(client.sessionId);
  }

  public getLastSeenBy(shooterId: string): RewindView {
    const hasPlayer = this.state.players.has(shooterId);
    const renderTime = hasPlayer ? this.inputs.get(shooterId).renderTime : 0;
    if (!hasPlayer || renderTime === 0) {
      console.warn(
        `rewind.lastSeenBy(${shooterId}): unstamped or unknown session; hit test is using live position`,
      );
    }
    return this.rewind.lastSeenBy(shooterId);
  }

  public handleOpenCrate(sessionId: string, crateId: string) {
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) {
      return { ok: false as const, error: 'Player unavailable' };
    }
    const crate = this.state.crates.get(crateId);
    if (!crate) {
      return { ok: false as const, error: `Crate not found: ${crateId}` };
    }
    const dist = Math.hypot(crate.x - player.x, crate.z - player.z);
    if (dist > ENGINE.crateInteractRange + 0.5) {
      return { ok: false as const, error: 'Crate out of range' };
    }
    const base = this.state.bases.get(player.teamId);
    const res = openCrate(crate, player, base, this.matchLog);
    if (res.ok) {
      evaluateMatchEnd(this.state);
    }
    return res;
  }

  public handleBuildSocket(
    sessionId: string,
    socketId: string,
    requestedType: SocketType,
    targetTier: number,
  ) {
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) {
      return { ok: false as const, error: 'Player unavailable' };
    }
    const base = this.state.bases.get(player.teamId);
    const res = buildOnSocket(base, socketId, player.teamId, requestedType, targetTier, this.matchLog);
    if (res.ok) {
      awardPoints(this.state, player.teamId, 'upgrade');
    }
    return res;
  }

  public placeServerTrap(
    ownerId: string,
    itemId: string,
    level: number,
    modifiers: readonly string[],
    x: number,
    z: number,
  ): { ok: true; trapId: string } | { ok: false; error: string } {
    const owner = this.state.players.get(ownerId);
    if (!owner) {
      return { ok: false, error: 'Trap owner not found' };
    }
    const def = ITEM_REGISTRY[itemId];
    if (!def || def.slotKind !== 'trap') {
      return { ok: false, error: `Invalid trap itemId: ${itemId}` };
    }
    if (!Number.isInteger(level) || level < 1 || level > def.maxLevel) {
      return { ok: false, error: `Invalid trap level: ${level}` };
    }
    const stats = getEffectiveItemStats({ itemId, level, modifiers });
    const trapId = `trap_${++this.trapSeq}`;

    const trap = new TrapSchema();
    trap.id = trapId;
    trap.ownerId = owner.id;
    trap.teamId = owner.teamId;
    trap.itemId = def.id;
    trap.x = Number.isFinite(x) ? x : owner.x;
    trap.z = Number.isFinite(z) ? z : owner.z;
    trap.triggered = false;

    this.state.traps.set(trapId, trap);
    this.trapMeta.set(trapId, {
      id: trapId,
      ownerId: owner.id,
      teamId: owner.teamId,
      itemId: def.id,
      damage: stats.damage,
      triggerRadius: stats.triggerRadius,
      slowFactor: stats.slowFactor,
      durationMs: stats.durationMs,
    });

    return { ok: true, trapId };
  }

  public checkTraps(): void {
    const triggeredIds: string[] = [];

    for (const [trapId, trap] of this.state.traps.entries()) {
      if (trap.triggered) continue;
      const meta = this.trapMeta.get(trapId);
      if (!meta) continue;

      for (const unit of this.state.players.values()) {
        if (!unit.alive || unit.teamId === trap.teamId) continue;
        const dist = Math.hypot(unit.x - trap.x, unit.z - trap.z);
        if (dist <= meta.triggerRadius) {
          trap.triggered = true;
          triggeredIds.push(trapId);

          this.matchLog.record({
            type: 'trap_triggered',
            x: trap.x,
            y: 0,
            z: trap.z,
            actorId: meta.ownerId,
            targetId: unit.id,
            teamId: meta.teamId,
            detail: `${meta.itemId}->${unit.id}`,
          });

          if (meta.slowFactor < 1 && meta.durationMs > 0) {
            const rt = this.getRuntime(unit.id);
            rt.slowFactor = meta.slowFactor;
            rt.slowRemainingMs = Math.max(rt.slowRemainingMs, meta.durationMs);
          }

          if (meta.damage > 0) {
            this.applyServerDamage(meta.ownerId, unit.id, meta.damage);
          }
          break;
        }
      }
    }

    for (const id of triggeredIds) {
      this.state.traps.delete(id);
      this.trapMeta.delete(id);
    }
  }

  public applyServerDamage(attackerId: string, targetId: string, rawDamage: number): boolean {
    if (this.state.phase === 'ended') return false;
    if (!Number.isFinite(rawDamage) || rawDamage <= 0) return false;

    const target = this.state.players.get(targetId);
    if (!target || !target.alive) return false;

    const attacker = this.state.players.get(attackerId);
    if (attacker && attacker.teamId === target.teamId) return false;

    let remaining = rawDamage;
    if (target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, remaining);
      target.shieldHp -= absorbed;
      remaining -= absorbed;
    }

    target.hp = Math.max(0, target.hp - remaining);

    if (target.hp <= 0) {
      target.alive = false;
      target.shieldHp = 0;
      const rt = this.getRuntime(target.id);
      rt.respawnRemainingMs = ENGINE.playerRespawnMs;

      this.matchLog.record({
        type: 'player_eliminated',
        x: target.x,
        y: target.y,
        z: target.z,
        actorId: attackerId,
        targetId: target.id,
        teamId: attacker?.teamId,
        detail: `${attackerId}->${target.id}`,
      });

      if (attacker) {
        awardPoints(this.state, attacker.teamId, 'tag');
        // Check squad wipe bonus: all members of target's team currently down
        const anyTeamAlive = Array.from(this.state.players.values()).some(
          (p) => p.teamId === target.teamId && p.alive,
        );
        if (!anyTeamAlive) {
          awardPoints(this.state, attacker.teamId, 'squadWipe');
        }
      }
    }

    return true;
  }

  private step(dt: number, subSteps: number, subDt: number): void {
    if (this.state.phase === 'ended') return;

    this.state.matchTimeRemaining = Math.max(0, this.state.matchTimeRemaining - dt);
    evaluateMatchEnd(this.state);
    if (this.state.phase === 'ended') return;

    const dtMs = dt * 1000;
    const radius = this.state.islandConfig.radius;

    // 1. Update timers & respawns for all units
    for (const unit of this.state.players.values()) {
      const rt = this.getRuntime(unit.id);
      rt.attackCooldownMs = Math.max(0, rt.attackCooldownMs - dtMs);
      rt.skillCooldownMs = Math.max(0, rt.skillCooldownMs - dtMs);
      rt.trapCooldownMs = Math.max(0, rt.trapCooldownMs - dtMs);
      rt.dashRemainingMs = Math.max(0, rt.dashRemainingMs - dtMs);
      rt.slowRemainingMs = Math.max(0, rt.slowRemainingMs - dtMs);
      if (rt.slowRemainingMs <= 0) {
        rt.slowFactor = 1;
      }

      if (!unit.alive) {
        rt.respawnRemainingMs -= dtMs;
        if (rt.respawnRemainingMs <= 0) {
          const spawn = this.getSpawnPointForTeam(unit.teamId, unit.id.startsWith('helper_') ? 4 : 2.5);
          unit.x = spawn.x;
          unit.y = 0;
          unit.z = spawn.z;
          unit.hp = unit.maxHp;
          unit.shieldHp = 0;
          unit.alive = true;
        }
      }
    }

    // 2. Consume ONE buffered input per human player for this fixed tick
    const activeCommands = new Map<string, MoveInputState>();
    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.isBot || !player.alive) continue;
      const cmd = this.inputs.get(sessionId).next() as MoveInputState | undefined;
      if (cmd) {
        activeCommands.set(sessionId, cmd);
      }
    }

    // 3. Integrate movement & bots across subSteps (60 Hz sim rate)
    for (let s = 0; s < subSteps; s++) {
      for (const [sessionId, cmd] of activeCommands.entries()) {
        const player = this.state.players.get(sessionId);
        if (!player || !player.alive) continue;
        const rt = this.getRuntime(sessionId);
        const speedMult =
          (rt.dashRemainingMs > 0 ? ENGINE.dashSpeedMultiplier : 1) *
          (rt.slowRemainingMs > 0 ? rt.slowFactor : 1);
        applyInput(player, cmd, subDt, radius, speedMult);
      }

      this.botController.stepAll(this.state, subDt, {
        onOpenCrate: (botId, crateId) => {
          this.handleOpenCrate(botId, crateId);
        },
        onBuildSocket: (botId, socketId, type, targetTier) => {
          this.handleBuildSocket(botId, socketId, type, targetTier);
        },
        onAttackEnemy: (botId, targetId, damage) => {
          this.applyServerDamage(botId, targetId, damage);
        },
      });
    }

    // 4. Process human combat / skill / trap / interact actions after movement
    for (const [sessionId, cmd] of activeCommands.entries()) {
      const player = this.state.players.get(sessionId);
      if (!player || !player.alive) continue;
      const rt = this.getRuntime(sessionId);

      if (cmd.attack && rt.attackCooldownMs <= 0) {
        this.processPlayerAttack(sessionId, player, rt);
      }
      if (cmd.useSkill && rt.skillCooldownMs <= 0) {
        this.processPlayerSkill(sessionId, player, rt);
      }
      if (cmd.placeTrap && !rt.prevTrap && rt.trapCooldownMs <= 0) {
        this.processPlayerTrap(sessionId, player, rt);
      }
      if (cmd.interact && !rt.prevInteract) {
        this.processPlayerInteract(sessionId, player);
      }
      rt.prevTrap = Boolean(cmd.placeTrap);
      rt.prevInteract = Boolean(cmd.interact);
    }

    // 5. Evaluate traps against all living units
    this.checkTraps();
  }

  private processPlayerAttack(sessionId: string, player: PlayerState, rt: UnitRuntime): void {
    const slotIdx = Math.min(player.activeWeaponIndex, Math.max(0, player.weaponSlots.length - 1));
    const weapon = player.weaponSlots[slotIdx];
    if (!weapon) return;

    const stats = getEffectiveItemStats(weapon);
    rt.attackCooldownMs = stats.cooldownMs;

    const dirX = Math.sin(player.rotY);
    const dirZ = Math.cos(player.rotY);

    // Lag-compensated hit detection via rewind.lastSeenBy wrapper
    const seen = this.getLastSeenBy(sessionId);

    let bestTargetId: string | null = null;
    let bestDist = Infinity;

    for (const other of this.state.players.values()) {
      if (!other.alive || other.teamId === player.teamId) continue;
      const tx = seen.value(other, 'x');
      const tz = seen.value(other, 'z');
      const dx = tx - player.x;
      const dz = tz - player.z;
      const forward = dx * dirX + dz * dirZ;
      if (forward <= 0 || forward > stats.range) continue;

      const perp = Math.abs(dx * dirZ - dz * dirX);
      if (perp <= ENGINE.playerHitRadius && forward < bestDist) {
        bestDist = forward;
        bestTargetId = other.id;
      }
    }

    if (bestTargetId) {
      this.applyServerDamage(sessionId, bestTargetId, stats.damage);
      return;
    }

    // Check enemy base core hit
    for (const base of this.state.bases.values()) {
      if (base.teamId === player.teamId || base.coreHp <= 0) continue;
      const dx = base.x - player.x;
      const dz = base.z - player.z;
      const forward = dx * dirX + dz * dirZ;
      if (forward <= 0 || forward > stats.range) continue;
      const perp = Math.abs(dx * dirZ - dz * dirX);
      if (perp <= ENGINE.baseCoreHitRadius) {
        base.coreHp = Math.max(0, base.coreHp - stats.damage);
        if (base.coreHp === 0) {
          awardPoints(this.state, player.teamId, 'coreBreach');
        }
        break;
      }
    }
  }

  private processPlayerSkill(sessionId: string, player: PlayerState, rt: UnitRuntime): void {
    const skill = player.skillSlots[0];
    if (!skill) return;

    const def = ITEM_REGISTRY[skill.itemId];
    if (!def) return;
    const stats = getEffectiveItemStats(skill);
    rt.skillCooldownMs = stats.cooldownMs;

    if (def.subKind === 'dash') {
      rt.dashRemainingMs = stats.durationMs > 0 ? stats.durationMs : ENGINE.dashDurationMs;
    } else if (def.subKind === 'shield_bubble') {
      player.shieldHp = Math.max(player.shieldHp, stats.shieldHp);
    } else if (def.subKind === 'turret') {
      // Immediate turret pulse against nearest enemy in range
      let nearest: PlayerState | null = null;
      let nearestDist = stats.range;
      for (const other of this.state.players.values()) {
        if (!other.alive || other.teamId === player.teamId) continue;
        const d = Math.hypot(other.x - player.x, other.z - player.z);
        if (d <= nearestDist) {
          nearest = other;
          nearestDist = d;
        }
      }
      if (nearest) {
        this.applyServerDamage(sessionId, nearest.id, stats.damage);
      }
    }
  }

  private processPlayerTrap(sessionId: string, player: PlayerState, rt: UnitRuntime): void {
    const trapItem = player.trapSlots[0];
    if (!trapItem) return;

    const stats = getEffectiveItemStats(trapItem);
    const modifiers: string[] = [];
    for (let i = 0; i < trapItem.modifiers.length; i++) {
      modifiers.push(trapItem.modifiers[i]);
    }
    const res = this.placeServerTrap(
      sessionId,
      trapItem.itemId,
      trapItem.level,
      modifiers,
      player.x,
      player.z,
    );
    if (res.ok) {
      rt.trapCooldownMs = stats.cooldownMs;
    }
  }

  private processPlayerInteract(sessionId: string, player: PlayerState): void {
    // 1. Try nearest unopened crate in range
    let bestCrateId: string | null = null;
    let bestCrateDist: number = ENGINE.crateInteractRange;
    for (const crate of this.state.crates.values()) {
      if (crate.opened) continue;
      const d = Math.hypot(crate.x - player.x, crate.z - player.z);
      if (d <= bestCrateDist) {
        bestCrateDist = d;
        bestCrateId = crate.id;
      }
    }
    if (bestCrateId) {
      this.handleOpenCrate(sessionId, bestCrateId);
      return;
    }

    // 2. Try nearest upgradeable socket on own base in range
    const ownBase = this.state.bases.get(player.teamId);
    if (!ownBase) return;
    let bestSock: { id: string; type: SocketType; nextTier: number } | null = null;
    let bestSockDist: number = ENGINE.baseBuildRange;

    for (const sock of ownBase.sockets.values()) {
      if (sock.tier >= ENGINE.maxBaseTier) continue;
      const d = Math.hypot(sock.x - player.x, sock.z - player.z);
      if (d <= bestSockDist && isValidSocketType(sock.type)) {
        bestSockDist = d;
        bestSock = { id: sock.id, type: sock.type, nextTier: sock.tier + 1 };
      }
    }
    if (bestSock) {
      this.handleBuildSocket(sessionId, bestSock.id, bestSock.type, bestSock.nextTier);
    }
  }

  private spawnInitialBotsAndHelpers(): void {
    for (const [teamId, base] of this.state.bases.entries()) {
      // Base-helper NPC (one per base, id = helper_${teamId})
      const helperId = `helper_${teamId}`;
      const helper = new PlayerSchema();
      helper.id = helperId;
      helper.teamId = teamId;
      helper.isBot = true;
      const inwardAngle = Math.atan2(-base.z, -base.x);
      helper.x = base.x + Math.cos(inwardAngle) * 4.5;
      helper.y = 0;
      helper.z = base.z + Math.sin(inwardAngle) * 4.5;
      helper.rotY = Math.atan2(-base.x, -base.z);
      helper.hp = ENGINE.playerMaxHp;
      helper.maxHp = ENGINE.playerMaxHp;
      helper.alive = true;
      equipItem(helper, 'weapon', 0, { itemId: 'plasma_carbine', level: 1, modifiers: [] });
      this.state.players.set(helperId, helper);
      this.runtimeByUnit.set(helperId, this.createRuntime());

      // Roaming skirmish bots per team
      for (let i = 0; i < ENGINE.roamingBotsPerTeam; i++) {
        const botId = `bot_${teamId}_${i}`;
        const bot = new PlayerSchema();
        bot.id = botId;
        bot.teamId = teamId;
        bot.isBot = true;
        bot.x = base.x + Math.cos(inwardAngle) * 8.5;
        bot.y = 0;
        bot.z = base.z + Math.sin(inwardAngle) * 8.5;
        bot.rotY = Math.atan2(-base.x, -base.z);
        bot.hp = ENGINE.playerMaxHp;
        bot.maxHp = ENGINE.playerMaxHp;
        bot.alive = true;
        equipItem(bot, 'weapon', 0, { itemId: 'plasma_carbine', level: 1, modifiers: [] });
        equipItem(bot, 'skill', 0, { itemId: 'gale_dash', level: 1, modifiers: [] });
        this.state.players.set(botId, bot);
        this.runtimeByUnit.set(botId, this.createRuntime());
      }
    }
  }

  private registerMessageHandlers(): void {
    this.onMessage('open_crate', (client, payload: { crateId?: unknown }) => {
      if (typeof payload?.crateId !== 'string') {
        client.send('action_error', { error: 'Invalid crateId' });
        return;
      }
      const res = this.handleOpenCrate(client.sessionId, payload.crateId);
      if (!res.ok) {
        client.send('action_error', { error: res.error });
      }
    });

    this.onMessage(
      'build_socket',
      (client, payload: { socketId?: unknown; type?: unknown; targetTier?: unknown }) => {
        if (
          typeof payload?.socketId !== 'string' ||
          typeof payload?.type !== 'string' ||
          typeof payload?.targetTier !== 'number' ||
          !isValidSocketType(payload.type)
        ) {
          client.send('action_error', { error: 'Invalid build_socket payload' });
          return;
        }
        const res = this.handleBuildSocket(
          client.sessionId,
          payload.socketId,
          payload.type,
          payload.targetTier,
        );
        if (!res.ok) {
          client.send('action_error', { error: res.error });
        }
      },
    );

    this.onMessage('switch_weapon', (client, payload: { slotIndex?: unknown }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || typeof payload?.slotIndex !== 'number') return;
      if (
        Number.isInteger(payload.slotIndex) &&
        payload.slotIndex >= 0 &&
        payload.slotIndex < player.weaponSlots.length
      ) {
        player.activeWeaponIndex = payload.slotIndex;
      }
    });

    this.onMessage('upgrade_item', (client, payload: { slotKind?: unknown; slotIndex?: unknown }) => {
      const player = this.state.players.get(client.sessionId);
      if (
        !player ||
        (payload?.slotKind !== 'weapon' &&
          payload?.slotKind !== 'skill' &&
          payload?.slotKind !== 'trap') ||
        typeof payload?.slotIndex !== 'number'
      ) {
        client.send('action_error', { error: 'Invalid upgrade_item payload' });
        return;
      }
      const res = upgradeItem(player, payload.slotKind as SlotKind, payload.slotIndex);
      if (!res.ok) {
        client.send('action_error', { error: res.error });
      }
    });

    this.onMessage(
      'apply_modifier',
      (client, payload: { slotKind?: unknown; slotIndex?: unknown; modifierId?: unknown }) => {
        const player = this.state.players.get(client.sessionId);
        if (
          !player ||
          (payload?.slotKind !== 'weapon' &&
            payload?.slotKind !== 'skill' &&
            payload?.slotKind !== 'trap') ||
          typeof payload?.slotIndex !== 'number' ||
          typeof payload?.modifierId !== 'string'
        ) {
          client.send('action_error', { error: 'Invalid apply_modifier payload' });
          return;
        }
        const res = applyModifier(
          player,
          payload.slotKind as SlotKind,
          payload.slotIndex,
          payload.modifierId,
        );
        if (!res.ok) {
          client.send('action_error', { error: res.error });
        }
      },
    );
  }

  private pickBalancedTeam(): string {
    const counts = new Map<string, number>();
    for (const teamId of this.state.bases.keys()) {
      counts.set(teamId, 0);
    }
    for (const p of this.state.players.values()) {
      if (!p.isBot) {
        counts.set(p.teamId, (counts.get(p.teamId) ?? 0) + 1);
      }
    }
    let bestTeam = 'team_0';
    let bestCount = Infinity;
    for (const [teamId, count] of counts.entries()) {
      if (count < bestCount) {
        bestCount = count;
        bestTeam = teamId;
      }
    }
    return bestTeam;
  }

  private getSpawnPointForTeam(teamId: string, inwardOffset: number): { x: number; z: number } {
    const base = this.state.bases.get(teamId);
    if (!base) return { x: 0, z: 0 };
    const dist = Math.hypot(base.x, base.z) || 1;
    const inwardX = -base.x / dist;
    const inwardZ = -base.z / dist;
    return {
      x: base.x + inwardX * inwardOffset,
      z: base.z + inwardZ * inwardOffset,
    };
  }

  private createRuntime(): UnitRuntime {
    return {
      attackCooldownMs: 0,
      skillCooldownMs: 0,
      trapCooldownMs: 0,
      dashRemainingMs: 0,
      slowRemainingMs: 0,
      slowFactor: 1,
      respawnRemainingMs: 0,
      prevInteract: false,
      prevTrap: false,
    };
  }

  private getRuntime(unitId: string): UnitRuntime {
    let rt = this.runtimeByUnit.get(unitId);
    if (!rt) {
      rt = this.createRuntime();
      this.runtimeByUnit.set(unitId, rt);
    }
    return rt;
  }
}
