import { ENGINE } from './engine';

export interface MovablePose {
  x: number;
  y: number;
  z: number;
  rotY: number;
}

export interface MoveCommand {
  moveX?: number;
  moveZ?: number;
  rotY?: number;
}

function finiteOrZero(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/**
 * Deterministic shared movement integration run identically on the server room
 * and the client predict.reconciler.
 * Fails closed when islandRadius is missing or invalid (no invented default radius).
 */
export function applyInput(
  state: MovablePose,
  cmd: MoveCommand | null | undefined,
  dt: number,
  islandRadius: number,
  speedMultiplier = 1,
): void {
  if (typeof islandRadius !== 'number' || !Number.isFinite(islandRadius) || islandRadius <= 0) {
    throw new Error(`applyInput requires a finite positive islandRadius (got ${String(islandRadius)})`);
  }
  if (!cmd || !Number.isFinite(dt) || dt <= 0) return;

  let mx = clamp(finiteOrZero(cmd.moveX), -1, 1);
  let mz = clamp(finiteOrZero(cmd.moveZ), -1, 1);

  const mag = Math.hypot(mx, mz);
  if (mag > 1) {
    mx /= mag;
    mz /= mag;
  }

  const speed = ENGINE.moveSpeed * (Number.isFinite(speedMultiplier) && speedMultiplier > 0 ? speedMultiplier : 1);
  const nextX = (Number.isFinite(state.x) ? state.x : 0) + mx * speed * dt;
  const nextZ = (Number.isFinite(state.z) ? state.z : 0) + mz * speed * dt;

  // Clamp inside radial island shoreline when on the island
  const maxR = Math.max(5, islandRadius - ENGINE.islandEdgeMargin);
  const r = Math.hypot(nextX, nextZ);
  if (r > maxR) {
    const scale = maxR / r;
    state.x = nextX * scale;
    state.z = nextZ * scale;
  } else {
    state.x = nextX;
    state.z = nextZ;
  }

  state.y = 0;

  if (typeof cmd.rotY === 'number' && Number.isFinite(cmd.rotY)) {
    state.rotY = clamp(cmd.rotY, -Math.PI * 2, Math.PI * 2);
  } else if (mag > 0.05) {
    state.rotY = Math.atan2(mx, mz);
  }
}
