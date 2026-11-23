import { ENGINE, type QualityPreset, type QualityPresetName } from './engine';

export function resolveQualityPreset(value: unknown): QualityPreset {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error('Quality preset setting is required (expected "low", "medium", or "high")');
  }
  const key = value as QualityPresetName;
  const preset = ENGINE.qualityPresets[key];
  if (!preset) {
    throw new Error(`Invalid quality preset "${value}" (expected "low", "medium", or "high")`);
  }
  return preset;
}
