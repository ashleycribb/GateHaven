import { Room, type Client, type Rewind, type RewindView } from '@colyseus/core';
import { applyInput } from '../../shared/applyInput';
import { ENGINE, type RoomPhase, type SocketType, type WeatherKind } from '../../shared/engine';
import {
  buildRadialIslandLayout,
  PASS1_ISLAND_CONFIG,
  validateIslandConfig,
  type IslandConfig,
} from '../../shared/islandConfig';
import { ITEM_REGISTRY, type SlotKind } from '../../shared/itemRegistry';
import {
  clampToDockBounds,
  getTeamIndexFromId,
  getTeamShoreLandingPoint,
  sampleBoatPath,
} from '../../shared/marina';
import { MOVE_INPUT_SANITIZE, MoveInput, type MoveInputState } from '../../shared/MoveInput';
import {
  IslandState,
  PlayerSchema,
  TrapSchema,
  type IslandRoomState,
  type PlayerState,
} from '../../shared/schema';
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

export interface WeatherSpec {
  readonly kind: WeatherKind;
  readonly wind: number;
  readonly fogDensity: number;
  readonly rainIntensity: number;
}

export class IslandRoom extends Room<{ state: IslandRoomState; input: MoveInputState }> {
  public declare inputs: ReturnType<Room<{ state: IslandRoomState; input: MoveInputState }>['defineInput']>;
  public rewind!: Rewind;
  public readonly matchLog = new MatchLog();

  private readonly botController = new BotController();
  private readonly runtimeByUnit = new Map<string, UnitRuntime>();
  private readonly trapMeta = new Map<string, ServerTrapMeta>();
  private trapSeq = 0;

  private phaseElapsedSec = 0;
  private sailingProgress = 0;
  private weatherElapsedSec = 0;
  private weatherCycleIndex = 1; // starts at overcast
  private readonly sailingRoster = new Set<string>();

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
    const player = new PlayerSchema();
    player.id = client.sessionId;
    player.teamId = teamId;
    player.isBot = false;
    player.hp = ENGINE.playerMaxHp;
    player.maxHp = ENGINE.playerMaxHp;
    player.shieldHp = 0;
    player.alive = true;
    player.activeWeaponIndex = 0;

    if (this.state.phase === 'match') {
      const spawn = this.getSpawnPointForTeam(teamId, 2.5);
      player.x = spawn.x;
      player.y = 0;
      player.z = spawn.z;
      player.rotY = Math.atan2(-spawn.x, -spawn.z);
      player.landed = true;
      player.boatId = '';
    } else if (this.state.phase === 'sailing' || this.state.phase === 'landing') {
      const boat = this.state.boats.get(`boat_${teamId}`);
      player.x = boat ? boat.x : ENGINE.marina.centerX;
      player.y = boat ? boat.y + 0.5 : ENGINE.marina.deckY;
      player.z = boat ? boat.z : ENGINE.marina.centerZ;
      player.rotY = boat ? boat.rotY : 0;
      player.landed = false;
      player.boatId = boat ? boat.id : '';
      if (boat) this.sailingRoster.add(client.sessionId);
    } else {
      // dock or boarding: spawn on shared marina dock
      const dockSpawn = this.getDockSpawnPoint(teamId);
      player.x = dockSpawn.x;
      player.y = ENGINE.marina.deckY;
      player.z = dockSpawn.z;
      player.rotY = 0;
      player.landed = false;
      player.boatId = '';
    }

    equipItem(player, 'weapon', 0, { itemId: 'plasma_carbine', level: 1, modifiers: [] });
    equipItem(player, 'skill', 0, { itemId: 'gale_dash', level: 1, modifiers: [] });
    equipItem(player, 'trap', 0, { itemId: 'blast_mine', level: 1, modifiers: [] });

    this.state.players.set(client.sessionId, player);
    this.runtimeByUnit.set(client.sessionId, this.createRuntime());
  }

  onLeave(client: Client): void {
    this.state.players.delete(client.sessionId);
    this.runtimeByUnit.delete(client.sessionId);
    this.sailingRoster.delete(client.sessionId);
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

  public setWeather(spec: WeatherSpec): { ok: true } | { ok: false; error: string } {
    if (!(ENGINE.weatherKinds as readonly string[]).includes(spec.kind)) {
      return { ok: false, error: `Invalid weather kind: ${String(spec.kind)}` };
    }
    const { wind, fogDensity, rainIntensity } = spec;
    const b = ENGINE.weatherBounds;
    if (!Number.isFinite(wind) || wind < b.wind.min || wind > b.wind.max) {
      return { ok: false, error: `Weather wind out of bounds [${b.wind.min}, ${b.wind.max}]` };
    }
    if (!Number.isFinite(fogDensity) || fogDensity < b.fogDensity.min || fogDensity > b.fogDensity.max) {
      return { ok: false, error: `Weather fogDensity out of bounds [${b.fogDensity.min}, ${b.fogDensity.max}]` };
    }
    if (!Number.isFinite(rainIntensity) || rainIntensity < b.rainIntensity.min || rainIntensity > b.rainIntensity.max) {
      return { ok: false, error: `Weather rainIntensity out of bounds [${b.rainIntensity.min}, ${b.rainIntensity.max}]` };
    }

    this.state.weather.kind = spec.kind;
    this.state.weather.wind = wind;
    this.state.weather.fogDensity = fogDensity;
    this.state.weather.rainIntensity = rainIntensity;
    return { ok: true };
  }

  public boardPlayer(unitId: string): { ok: true } | { ok: false; error: string } {
    if (this.state.phase !== 'boarding') {
      return { ok: false, error: 'Boarding is only allowed during boarding phase' };
    }
    const unit = this.state.players.get(unitId);
    if (!unit || unit.id.startsWith('helper_')) {
      return { ok: false, error: 'Unit cannot board a boat' };
    }
    const boat = this.state.boats.get(`boat_${unit.teamId}`);
    if (!boat) {
      return { ok: false, error: `No boat for team ${unit.teamId}` };
    }
    unit.boatId = boat.id;
    unit.landed = false;
    unit.x = boat.x;
    unit.y = boat.y + 0.55;
    unit.z = boat.z;
    unit.rotY = boat.rotY;
    return { ok: true };
  }

  public boardAllPendingPlayers(): { ok: true } | { ok: false; error: string } {
    if (this.state.phase !== 'boarding') {
      return { ok: false, error: 'Not in boarding phase' };
    }
    for (const unit of this.state.players.values()) {
      if (unit.id.startsWith('helper_')) continue;
      if (!unit.boatId) {
        const res = this.boardPlayer(unit.id);
        if (!res.ok) return res;
      }
    }
    return { ok: true };
  }

  public advanceBoatsToShore(): void {
    this.sailingProgress = 1;
    this.updateBoatsAlongPath(1);
  }

  public completeBoatLandings(): void {
    const cfg = this.state.islandConfig;
    let slotOffset = 0;

    for (const unit of this.state.players.values()) {
      if (unit.id.startsWith('helper_')) continue;
      if (unit.boatId || !unit.landed) {
        const landing = getTeamShoreLandingPoint(cfg, unit.teamId);
        const angleSpread = (slotOffset % 6) * ((Math.PI * 2) / 6);
        const radialOffset = slotOffset === 0 ? 0 : Math.min(2.2, ENGINE.landingRadius * 0.35);
        unit.x = landing.x + Math.cos(angleSpread) * radialOffset;
        unit.z = landing.z + Math.sin(angleSpread) * radialOffset;
        unit.y = 0;
        unit.rotY = Math.atan2(-unit.x, -unit.z);
        unit.boatId = '';
        unit.landed = true;
        slotOffset++;
      }
    }
  }

  public tryAdvancePhase(nextPhase: RoomPhase): { ok: true } | { ok: false; error: string } {
    const order = ENGINE.phaseOrder as readonly string[];
    const curIdx = order.indexOf(this.state.phase);
    const nextIdx = order.indexOf(nextPhase);
    if (nextIdx === -1) {
      return { ok: false, error: `Invalid phase: ${String(nextPhase)}` };
    }
    if (nextIdx !== curIdx + 1) {
      return {
        ok: false,
        error: `Illegal phase transition ${this.state.phase} -> ${nextPhase}`,
      };
    }

    if (nextPhase === 'sailing') {
      // Every non-helper player currently in the room must be on their own team's boat
      for (const unit of this.state.players.values()) {
        if (unit.id.startsWith('helper_')) continue;
        const expectedBoatId = `boat_${unit.teamId}`;
        if (!unit.boatId || unit.boatId !== expectedBoatId) {
          return { ok: false, error: `Player ${unit.id} has not boarded ${expectedBoatId}` };
        }
      }
      this.sailingRoster.clear();
      for (const unit of this.state.players.values()) {
        if (!unit.id.startsWith('helper_')) {
          this.sailingRoster.add(unit.id);
        }
      }
      this.sailingProgress = 0;
    }

    if (nextPhase === 'match') {
      for (const unitId of this.sailingRoster) {
        const unit = this.state.players.get(unitId);
        if (unit && !unit.landed) {
          return { ok: false, error: `Player ${unitId} has not landed yet` };
        }
      }
      for (const unit of this.state.players.values()) {
        if (!unit.id.startsWith('helper_') && !unit.landed) {
          return { ok: false, error: `Player ${unit.id} has not landed yet` };
        }
      }
    }

    this.state.phase = nextPhase;
    this.phaseElapsedSec = 0;
    return { ok: true };
  }

  /**
   * Walks legally step-by-step through dock -> boarding -> sailing -> landing -> match
   * for integration tests that begin directly in match phase without skipping transitions.
   */
  public advancePhaseForTest(target: RoomPhase): void {
    const order = ENGINE.phaseOrder;
    const targetIdx = order.indexOf(target);
    if (targetIdx === -1) {
      throw new Error(`Invalid target phase: ${String(target)}`);
    }
    while (order.indexOf(this.state.phase as RoomPhase) < targetIdx) {
      const next = order[order.indexOf(this.state.phase as RoomPhase) + 1];
      if (next === 'sailing') {
        this.boardAllPendingPlayers();
      } else if (next === 'landing') {
        this.advanceBoatsToShore();
      } else if (next === 'match') {
        this.completeBoatLandings();
      }
      const res = this.tryAdvancePhase(next);
      if (!res.ok) {
        throw new Error(`Failed advancing to ${next}: ${res.error}`);
      }
    }
  }

  public handleOpenCrate(sessionId: string, crateId: string) {
    if (this.state.phase !== 'match') {
      return { ok: false as const, error: 'Crates cannot be opened before match phase' };
    }
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
    if (this.state.phase !== 'match') {
      return { ok: false as const, error: 'Building is not allowed before match phase' };
    }
    const player = this.state.players.get(sessionId);
    if (!player || !player.alive) {
      return { ok: false as const, error: 'Player unavailable' };
    }
    const base = this.state.bases.get(player.teamId);
    const socket = base?.sockets.get(socketId);
    if (!base || !socket) {
      return { ok: false as const, error: `Socket not found: ${socketId}` };
    }
    const dist = Math.hypot(socket.x - player.x, socket.z - player.z);
    if (dist > ENGINE.baseBuildRange) {
      return { ok: false as const, error: 'Socket out of build range' };
    }

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
    if (this.state.phase !== 'match') return;
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
    if (this.state.phase !== 'match') return false;
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

    this.phaseElapsedSec += dt;
    this.stepWeatherCycle(dt);

    const radius = this.state.islandConfig.radius;
    const dtMs = dt * 1000;

    // Pre-match phase orchestration (dock -> boarding -> sailing -> landing -> match)
    if (this.state.phase !== 'match') {
      this.stepPreMatch(dt, subSteps, subDt, radius);
      return;
    }

    // Active match clock decrements ONLY during match phase after all have landed
    this.state.matchTimeRemaining = Math.max(0, this.state.matchTimeRemaining - dt);
    evaluateMatchEnd(this.state);
    if ((this.state.phase as string) === 'ended') return;

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
          unit.landed = true;
          unit.boatId = '';
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

  private stepPreMatch(dt: number, subSteps: number, subDt: number, radius: number): void {
    // Base-helper NPCs still patrol their bases at 60 Hz during pre-match
    for (let s = 0; s < subSteps; s++) {
      this.stepHelpersOnly(subDt, radius);
    }

    // Consume human player inputs during dock & boarding so movement/prediction stays live on the dock
    const activeCommands = new Map<string, MoveInputState>();
    for (const [sessionId, player] of this.state.players.entries()) {
      if (player.isBot) continue;
      const cmd = this.inputs.get(sessionId).next() as MoveInputState | undefined;
      if (cmd) {
        activeCommands.set(sessionId, cmd);
      }
    }

    if (this.state.phase === 'dock' || this.state.phase === 'boarding') {
      for (let s = 0; s < subSteps; s++) {
        for (const [sessionId, cmd] of activeCommands.entries()) {
          const player = this.state.players.get(sessionId);
          if (!player || player.boatId) continue;
          // Move freely on dock deck and clamp strictly inside dock bounds
          const tempRadius = Math.max(radius, Math.hypot(ENGINE.marina.centerX, ENGINE.marina.centerZ) + 40);
          applyInput(player, cmd, subDt, tempRadius, 1);
          clampToDockBounds(player);
        }
      }

      if (this.state.phase === 'boarding') {
        // Allow players pressing interact to board their team boat
        for (const [sessionId, cmd] of activeCommands.entries()) {
          const player = this.state.players.get(sessionId);
          if (!player || player.boatId) continue;
          const rt = this.getRuntime(sessionId);
          if (cmd.interact && !rt.prevInteract) {
            this.boardPlayer(sessionId);
          }
          rt.prevInteract = Boolean(cmd.interact);
        }

        // Roaming bots board their team boats during boarding
        for (const unit of this.state.players.values()) {
          if (unit.isBot && !unit.id.startsWith('helper_') && !unit.boatId) {
            this.boardPlayer(unit.id);
          }
        }

        // Auto-board remaining human players at end of ENGINE.boardingDurationSec
        if (this.phaseElapsedSec >= ENGINE.boardingDurationSec) {
          this.boardAllPendingPlayers();
        }

        // Advance to sailing once every non-helper unit is aboard its team's boat
        const allBoarded = Array.from(this.state.players.values()).every(
          (u) => u.id.startsWith('helper_') || Boolean(u.boatId),
        );
        if (allBoarded && this.phaseElapsedSec >= 0.5) {
          this.tryAdvancePhase('sailing');
        }
      } else if (this.state.phase === 'dock') {
        if (this.phaseElapsedSec >= ENGINE.dockDurationSec) {
          this.tryAdvancePhase('boarding');
        }
      }
    } else if (this.state.phase === 'sailing') {
      this.sailingProgress = Math.min(1, this.sailingProgress + dt / Math.max(0.5, ENGINE.sailingDurationSec));
      this.updateBoatsAlongPath(this.sailingProgress);
      if (this.sailingProgress >= 1) {
        this.tryAdvancePhase('landing');
      }
    } else if (this.state.phase === 'landing') {
      this.updateBoatsAlongPath(1);
      if (this.phaseElapsedSec >= ENGINE.landingDurationSec) {
        this.completeBoatLandings();
        this.tryAdvancePhase('match');
      }
    }
  }

  private stepHelpersOnly(subDt: number, radius: number): void {
    // Only base helpers patrol on the island during pre-match; roaming bots stay on dock/boat
    for (const unit of this.state.players.values()) {
      if (!unit.isBot || !unit.id.startsWith('helper_') || !unit.alive) continue;
      const ownBase = this.state.bases.get(unit.teamId);
      if (!ownBase) continue;
      const t = this.clock.elapsedTime * 0.00055;
      const orbitR = Math.min(6.0, ENGINE.helperLeashRadius * 0.45);
      const tx = ownBase.x + Math.cos(t) * orbitR;
      const tz = ownBase.z + Math.sin(t) * orbitR;
      const dx = tx - unit.x;
      const dz = tz - unit.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        applyInput(unit, { moveX: dx / d, moveZ: dz / d, rotY: Math.atan2(dx, dz) }, subDt, radius, 0.65);
      }
    }
  }

  private updateBoatsAlongPath(progress01: number): void {
    const cfg = this.state.islandConfig;
    for (const boat of this.state.boats.values()) {
      const idx = getTeamIndexFromId(boat.teamId);
      const pose = sampleBoatPath(idx, cfg.teamCount, cfg, progress01);
      boat.x = pose.x;
      boat.y = pose.y;
      boat.z = pose.z;
      boat.rotY = pose.rotY;
    }

    // Carry boarded players along with their team boat
    for (const unit of this.state.players.values()) {
      if (!unit.boatId) continue;
      const boat = this.state.boats.get(unit.boatId);
      if (!boat) continue;
      unit.x = boat.x;
      unit.y = boat.y + 0.55;
      unit.z = boat.z;
      unit.rotY = boat.rotY;
    }
  }

  private stepWeatherCycle(dt: number): void {
    this.weatherElapsedSec += dt;
    if (this.weatherElapsedSec < ENGINE.weatherHoldDurationSec) return;
    this.weatherElapsedSec = 0;
    this.weatherCycleIndex = (this.weatherCycleIndex + 1) % ENGINE.weatherKinds.length;
    const nextKind = ENGINE.weatherKinds[this.weatherCycleIndex];
    const preset = ENGINE.weatherPresets[nextKind];
    this.setWeather({
      kind: nextKind,
      wind: preset.wind,
      fogDensity: preset.fogDensity,
      rainIntensity: preset.rainIntensity,
    });
  }

  private processPlayerAttack(sessionId: string, player: PlayerState, rt: UnitRuntime): void {
    const slotIdx = Math.min(player.activeWeaponIndex, Math.max(0, player.weaponSlots.length - 1));
    const weapon = player.weaponSlots[slotIdx];
    if (!weapon) return;

    const stats = getEffectiveItemStats(weapon);
    rt.attackCooldownMs = stats.cooldownMs;

    const dirX = Math.sin(player.rotY);
    const dirZ = Math.cos(player.rotY);

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
      // Base-helper NPC starts at own base (landed = true, does not block sailing/landing)
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
      helper.landed = true;
      helper.boatId = '';
      equipItem(helper, 'weapon', 0, { itemId: 'plasma_carbine', level: 1, modifiers: [] });
      this.state.players.set(helperId, helper);
      this.runtimeByUnit.set(helperId, this.createRuntime());

      // Roaming bots start on the marina dock and board/sail with their team
      for (let i = 0; i < ENGINE.roamingBotsPerTeam; i++) {
        const botId = `bot_${teamId}_${i}`;
        const bot = new PlayerSchema();
        bot.id = botId;
        bot.teamId = teamId;
        bot.isBot = true;
        const dockPt = this.getDockSpawnPoint(teamId, i + 1);
        bot.x = dockPt.x;
        bot.y = ENGINE.marina.deckY;
        bot.z = dockPt.z;
        bot.rotY = 0;
        bot.hp = ENGINE.playerMaxHp;
        bot.maxHp = ENGINE.playerMaxHp;
        bot.alive = true;
        bot.landed = false;
        bot.boatId = '';
        equipItem(bot, 'weapon', 0, { itemId: 'plasma_carbine', level: 1, modifiers: [] });
        equipItem(bot, 'skill', 0, { itemId: 'gale_dash', level: 1, modifiers: [] });
        this.state.players.set(botId, bot);
        this.runtimeByUnit.set(botId, this.createRuntime());
      }
    }
  }

  private registerMessageHandlers(): void {
    this.onMessage('board_boat', (client) => {
      const res = this.boardPlayer(client.sessionId);
      if (!res.ok) {
        client.send('action_error', { error: res.error });
      }
    });

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

  private getDockSpawnPoint(teamId: string, laneOffset = 0): { x: number; z: number } {
    const idx = getTeamIndexFromId(teamId);
    const teamCount = this.state.islandConfig.teamCount;
    const offset = (idx - (teamCount - 1) / 2) * ENGINE.marina.slipSpacing * 0.75;
    return {
      x: ENGINE.marina.centerX + offset,
      z: ENGINE.marina.centerZ - 1.5 - laneOffset * 1.4,
    };
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
