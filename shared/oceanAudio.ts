import { ENGINE } from './engine';

/**
 * Pure deterministic function mapping listener distance-to-shoreline (meters)
 * to Web Audio ocean ambience gain using named ENGINE.oceanAudio constants.
 */
export function computeOceanAudioGain(distanceToShore: number): number {
  if (!Number.isFinite(distanceToShore)) {
    throw new Error(`Invalid distanceToShore: ${String(distanceToShore)}`);
  }
  const d = Math.max(0, distanceToShore);
  const maxDist = ENGINE.oceanAudioMaxDistance;
  if (d >= maxDist) {
    return ENGINE.oceanAudio.minGain;
  }
  const t = 1 - d / maxDist;
  // Smooth acoustic rolloff (louder near beach, quieter inland)
  const shaped = t * t;
  return ENGINE.oceanAudio.minGain + (ENGINE.oceanAudio.maxGain - ENGINE.oceanAudio.minGain) * shaped;
}

export function computeOceanLowpassHz(distanceToShore: number): number {
  const d = Math.max(0, Number.isFinite(distanceToShore) ? distanceToShore : ENGINE.oceanAudioMaxDistance);
  const t = Math.max(0, Math.min(1, 1 - d / ENGINE.oceanAudioMaxDistance));
  return ENGINE.oceanAudio.inlandCutoffHz + (ENGINE.oceanAudio.shoreCutoffHz - ENGINE.oceanAudio.inlandCutoffHz) * t;
}

export function computeDistanceToShore(x: number, z: number, islandRadius: number): number {
  if (!Number.isFinite(islandRadius) || islandRadius <= 0) {
    throw new Error(`Invalid islandRadius: ${String(islandRadius)}`);
  }
  const radial = Math.hypot(x, z);
  // Outside or at shoreline => distance 0 (full coastal surf); inland => distance inward from coast
  return Math.max(0, islandRadius - radial);
}
