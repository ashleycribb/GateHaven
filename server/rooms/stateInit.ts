import { ENGINE } from '../../shared/engine';
import type { IslandConfig, RadialIslandLayout } from '../../shared/islandConfig';
import {
  BaseSchema,
  CrateSchema,
  SocketSchema,
  type IslandRoomState,
} from '../../shared/schema';

export function initializeIslandState(
  state: IslandRoomState,
  config: IslandConfig,
  layout: RadialIslandLayout,
): void {
  state.phase = 'active';
  state.winnerTeamId = '';
  state.matchTimeRemaining = ENGINE.matchDurationSec;

  state.islandConfig.teamCount = config.teamCount;
  state.islandConfig.radius = config.radius;
  state.islandConfig.centerRadius = config.centerRadius;
  state.islandConfig.baseRadius = config.baseRadius;

  state.bases.clear();
  for (const basePlacement of layout.bases) {
    const base = new BaseSchema();
    base.teamId = basePlacement.teamId;
    base.x = basePlacement.x;
    base.z = basePlacement.z;
    base.tier = 1;
    base.coreHp = ENGINE.baseCoreMaxHp;
    base.points = 0;

    for (const sockPlacement of basePlacement.sockets) {
      const sock = new SocketSchema();
      sock.id = sockPlacement.id;
      sock.type = sockPlacement.type;
      sock.tier = 0;
      sock.occupied = false;
      sock.x = sockPlacement.x;
      sock.z = sockPlacement.z;
      base.sockets.set(sock.id, sock);
    }

    state.bases.set(base.teamId, base);
  }

  state.crates.clear();
  for (const cratePlacement of layout.crates) {
    const crate = new CrateSchema();
    crate.id = cratePlacement.id;
    crate.x = cratePlacement.x;
    crate.z = cratePlacement.z;
    crate.tier = cratePlacement.tier;
    crate.opened = false;
    state.crates.set(crate.id, crate);
  }

  state.traps.clear();
}
