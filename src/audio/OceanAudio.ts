import {
  computeDistanceToShore,
  computeOceanAudioGain,
  computeOceanLowpassHz,
} from '../../shared/oceanAudio';

export interface OceanAudioOptions {
  readonly audioEnabled: boolean;
  readonly bufferUrl: string;
  readonly fetcher?: typeof fetch;
  readonly createAudioContext?: () => AudioContext;
}

/**
 * Web Audio positional ocean & wave ambience controller.
 * Loads a vendored manifest audio buffer and scales gain + low-pass filter
 * strictly from listener distance-to-shoreline via ENGINE.oceanAudio constants.
 * Fails closed when the buffer is missing unless audioEnabled is explicitly false.
 */
export class OceanAudioController {
  private readonly options: OceanAudioOptions;
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private initialized = false;
  private muted = false;

  constructor(options: OceanAudioOptions) {
    this.options = options;
    this.muted = !options.audioEnabled;
  }

  public async init(): Promise<void> {
    if (!this.options.audioEnabled) {
      this.initialized = false;
      return;
    }

    const fetcher = this.options.fetcher ?? fetch;
    const response = await fetcher(this.options.bufferUrl);
    if (!response.ok) {
      throw new Error(
        `Failed to load ocean ambience buffer "${this.options.bufferUrl}" (HTTP ${response.status})`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) {
      throw new Error(`Empty ocean ambience buffer "${this.options.bufferUrl}"`);
    }

    const AudioCtxCtor =
      this.options.createAudioContext ??
      (() => {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) {
          throw new Error('Web Audio API AudioContext is unavailable in this environment');
        }
        return new Ctor();
      });

    this.ctx = AudioCtxCtor();
    const decoded = await this.ctx.decodeAudioData(arrayBuffer.slice(0));

    this.filterNode = this.ctx.createBiquadFilter();
    this.filterNode.type = 'lowpass';
    this.filterNode.frequency.value = computeOceanLowpassHz(0);

    this.gainNode = this.ctx.createGain();
    this.gainNode.gain.value = computeOceanAudioGain(0);

    this.sourceNode = this.ctx.createBufferSource();
    this.sourceNode.buffer = decoded;
    this.sourceNode.loop = true;

    this.sourceNode.connect(this.filterNode);
    this.filterNode.connect(this.gainNode);
    this.gainNode.connect(this.ctx.destination);
    this.sourceNode.start(0);
    this.initialized = true;
  }

  public resumeOnGesture(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.gainNode && this.ctx && muted) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
    }
  }

  public updateListener(x: number, z: number, islandRadius: number, weatherWind = 0.35): void {
    if (!this.initialized || !this.gainNode || !this.filterNode || !this.ctx) return;
    if (this.muted) {
      this.gainNode.gain.setTargetAtTime(0, this.ctx.currentTime, 0.08);
      return;
    }

    const distToShore = computeDistanceToShore(x, z, islandRadius);
    const baseGain = computeOceanAudioGain(distToShore);
    const windBoost = 1 + Math.max(0, Math.min(1, weatherWind)) * 0.22;
    const gain = Math.min(1, baseGain * windBoost);
    const cutoff = computeOceanLowpassHz(distToShore);

    this.gainNode.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.12);
    this.filterNode.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.12);
  }

  public dispose(): void {
    try {
      this.sourceNode?.stop();
    } catch {
      // Already stopped
    }
    this.sourceNode?.disconnect();
    this.filterNode?.disconnect();
    this.gainNode?.disconnect();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
    }
    this.sourceNode = null;
    this.filterNode = null;
    this.gainNode = null;
    this.ctx = null;
    this.initialized = false;
  }
}
