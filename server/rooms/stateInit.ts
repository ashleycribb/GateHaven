import { ENGINE } from '../../shared/engine';
import type { IslandConfig, RadialIslandLayout } from '../../shared/islandConfig';
import { getMarinaSlipPose } from '../../shared/marina';
import {
  BaseSchema,
  BoatSchema,
  CrateSchema,
  SocketSchema,
  type IslandRoomState,
} from '../../shared/schema';

export function initializeIslandState(
  state: IslandRoomState,
  config: IslandConfig,
  layout: RadialIslandLayout,
): void {
  state.phase = 'dock';
  state.winnerTeamId = '';
  state.matchTimeRemaining = ENGINE.matchDurationSec;

  state.islandConfig.teamCount = config.teamCount;
  state.islandConfig.radius = config.radius;
  state.islandConfig.centerRadius = config.centerRadius;
  state.islandConfig.baseRadius = config.baseRadius;

  state.bases.clear();
  state.boats.clear();
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

    const slip = getMarinaSlipPose(basePlacement.teamIndex, config.teamCount);
    const boat = new BoatSchema();
    boat.id = `boat_${basePlacement.teamId}`;
    boat.teamId = basePlacement.teamId;
    boat.x = slip.x;
    boat.y = slip.y;
    boat.z = slip.z;
    boat.rotY = slip.rotY;
    state.boats.set(boat.id, boat);
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

  const defaultWeather = ENGINE.weatherPresets[ENGINE.defaultWeatherKind];
  state.weather.kind = ENGINE.defaultWeatherKind;
  state.weather.wind = defaultWeather.wind;
  state.weather.fogDensity = defaultWeather.fogDensity;
  state.weather.rainIntensity = defaultWeather.rainIntensity;
}
