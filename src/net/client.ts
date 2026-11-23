import { Client, Predict, type Room } from '@colyseus/sdk';
import { applyInput } from '../../shared/applyInput';
import { ENGINE, type SocketType } from '../../shared/engine';
import { MoveInput, type MoveInputState } from '../../shared/MoveInput';
import type { IslandRoomState, PlayerState } from '../../shared/schema';

export interface BattleIslandConnection {
  readonly client: Client;
  readonly room: Room<IslandRoomState>;
  readonly predict: Predict;
  readonly input: ReturnType<Room<IslandRoomState>['input']>;
  readonly getLocalPose: () => { x: number; y: number; z: number; rotY: number } | null;
  readonly getRemotePose: (entity: PlayerState) => { x: number; y: number; z: number; rotY: number };
  readonly sendBuildSocket: (socketId: string, type: SocketType, targetTier: number) => void;
  readonly sendOpenCrate: (crateId: string) => void;
  readonly sendSwitchWeapon: (slotIndex: number) => void;
  readonly dispose: () => Promise<void>;
}

export async function connectBattleIsland(origin?: string): Promise<BattleIslandConnection> {
  const endpoint = origin ?? window.location.origin;
  const client = new Client(endpoint);
  const room = await client.joinOrCreate<IslandRoomState>('island');

  const predict = Predict.get(room, { mode: 'lerp', delay: ENGINE.interpDelayMs });
  predict.attachAll('players', { mode: 'lerp', fields: ['x', 'y', 'z', 'rotY'] });

  const input = room.input({ type: MoveInput, mode: 'reliable' });

  let reconciler: ReturnType<Predict['reconciler']> | null = null;

  const ensureReconciler = (): ReturnType<Predict['reconciler']> | null => {
    if (reconciler) return reconciler;
    const self = room.state.players?.get(room.sessionId);
    if (!self) return null;
    reconciler = predict.reconciler(self, {
      input,
      fields: ['x', 'y', 'z', 'rotY'],
      step: (ctx, s, cmd) =>
        applyInput(
          s as { x: number; y: number; z: number; rotY: number },
          cmd as MoveInputState,
          ctx.dt,
          room.state.islandConfig?.radius || 80,
        ),
    });
    return reconciler;
  };

  // Attach immediately if state is already hydrated, or on first state patch
  ensureReconciler();
  room.onStateChange(() => {
    ensureReconciler();
  });

  return {
    client,
    room,
    predict,
    input,
    getLocalPose: () => {
      const rec = ensureReconciler();
      if (rec) {
        const s = rec.state as { x: number; y: number; z: number; rotY: number };
        return { x: s.x, y: s.y, z: s.z, rotY: s.rotY };
      }
      const self = room.state.players?.get(room.sessionId);
      if (!self) return null;
      return { x: self.x, y: self.y, z: self.z, rotY: self.rotY };
    },
    getRemotePose: (entity: PlayerState) => {
      const x = predict.value(entity, 'x');
      const y = predict.value(entity, 'y');
      const z = predict.value(entity, 'z');
      const rotY = predict.value(entity, 'rotY');
      return {
        x: Number.isFinite(x) ? x : entity.x,
        y: Number.isFinite(y) ? y : entity.y,
        z: Number.isFinite(z) ? z : entity.z,
        rotY: Number.isFinite(rotY) ? rotY : entity.rotY,
      };
    },
    sendBuildSocket: (socketId: string, type: SocketType, targetTier: number) => {
      room.send('build_socket', { socketId, type, targetTier });
    },
    sendOpenCrate: (crateId: string) => {
      room.send('open_crate', { crateId });
    },
    sendSwitchWeapon: (slotIndex: number) => {
      room.send('switch_weapon', { slotIndex });
    },
    dispose: async () => {
      predict.dispose();
      try {
        await room.leave();
      } catch {
        // Room already closed
      }
    },
  };
}
