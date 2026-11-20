export type InputModality = 'keyboard' | 'gamepad' | 'touch';
export type ControllerBrand = 'xbox' | 'playstation';

export interface GamepadGlyphs {
  brand: ControllerBrand;
  brandLabel: string;
  a: string;
  b: string;
  x: string;
  y: string;
  lb: string;
  rb: string;
  lt: string;
  rt: string;
  start: string;
  select: string;
  dpad: string;
  leftStick: string;
  rightStick: string;
}

export interface GamepadButtonFrame {
  a: boolean;
  b: boolean;
  x: boolean;
  y: boolean;
  lb: boolean;
  rb: boolean;
  lt: boolean;
  rt: boolean;
  select: boolean;
  start: boolean;
  dpadUp: boolean;
  dpadDown: boolean;
  dpadLeft: boolean;
  dpadRight: boolean;
}

export interface GamepadSnapshot {
  connected: boolean;
  id: string;
  brand: ControllerBrand;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
  ltValue: number;
  rtValue: number;
  held: GamepadButtonFrame;
  pressed: GamepadButtonFrame;
  /** Menu navigation pulse (supports initial press + smooth hold-repeat on D-pad or Left Stick) */
  navDir: 'up' | 'down' | 'left' | 'right' | null;
}

export type RumblePattern = 'hit' | 'kill' | 'death' | 'test';

const STICK_DEADZONE = 0.17;
const TRIGGER_THRESHOLD = 0.35;

export function getGamepadGlyphs(brand: ControllerBrand): GamepadGlyphs {
  if (brand === 'playstation') {
    return {
      brand: 'playstation',
      brandLabel: 'PlayStation',
      a: '✕',
      b: '○',
      x: '□',
      y: '△',
      lb: 'L1',
      rb: 'R1',
      lt: 'L2',
      rt: 'R2',
      start: 'Options',
      select: 'Share',
      dpad: 'D-Pad',
      leftStick: 'L Stick',
      rightStick: 'R Stick',
    };
  }
  return {
    brand: 'xbox',
    brandLabel: 'Xbox / Standard',
    a: 'A',
    b: 'B',
    x: 'X',
    y: 'Y',
    lb: 'LB',
    rb: 'RB',
    lt: 'LT',
    rt: 'RT',
    start: 'Start',
    select: 'Back',
    dpad: 'D-Pad',
    leftStick: 'L Stick',
    rightStick: 'R Stick',
  };
}

export function detectControllerBrand(id: string): ControllerBrand {
  const lower = id.toLowerCase();
  if (
    lower.includes('dualsense') ||
    lower.includes('dualshock') ||
    lower.includes('playstation') ||
    lower.includes('sony') ||
    lower.includes('054c') ||
    lower.includes('wireless controller')
  ) {
    return 'playstation';
  }
  return 'xbox';
}

function applyRadialDeadzone(x: number, y: number, deadzone = STICK_DEADZONE): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag < deadzone) return [0, 0];
  const clamped = Math.min(1, mag);
  const rescaled = (clamped - deadzone) / (1 - deadzone);
  // Subtle quadratic response curve for fine camera precision while staying responsive
  const curved = rescaled * (0.45 + 0.55 * rescaled);
  return [(x / mag) * curved, (y / mag) * curved];
}

function emptyButtons(): GamepadButtonFrame {
  return {
    a: false,
    b: false,
    x: false,
    y: false,
    lb: false,
    rb: false,
    lt: false,
    rt: false,
    select: false,
    start: false,
    dpadUp: false,
    dpadDown: false,
    dpadLeft: false,
    dpadRight: false,
  };
}

/**
 * Browser Gamepad API manager with Xbox & PlayStation Standard mapping,
 * radial deadzones, menu D-pad repeat, rumble feedback, and seamless
 * modality detection (gamepad / keyboard / touch).
 */
export class GamepadManager {
  private prevHeld: GamepadButtonFrame = emptyButtons();
  private lastConnected = false;
  private lastBrand: ControllerBrand = 'xbox';
  private lastId = '';
  private activeGamepadIndex: number | null = null;

  // Menu navigation repeat timers
  private heldNavDir: 'up' | 'down' | 'left' | 'right' | null = null;
  private navHoldStartMs = 0;
  private navLastPulseMs = 0;

  private statusListeners = new Set<
    (info: { connected: boolean; brand: ControllerBrand; id: string; supportsRumble: boolean }) => void
  >();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('gamepadconnected', this.onGamepadConnected);
      window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    }
  }

  private onGamepadConnected = (e: GamepadEvent): void => {
    this.activeGamepadIndex = e.gamepad.index;
    this.lastConnected = true;
    this.lastId = e.gamepad.id;
    this.lastBrand = detectControllerBrand(e.gamepad.id);
    this.emitStatus(e.gamepad);
  };

  private onGamepadDisconnected = (): void => {
    const gp = this.findActiveGamepad();
    if (!gp) {
      this.activeGamepadIndex = null;
      this.lastConnected = false;
      this.lastId = '';
      this.prevHeld = emptyButtons();
      this.emitStatus(null);
    } else {
      this.activeGamepadIndex = gp.index;
      this.lastId = gp.id;
      this.lastBrand = detectControllerBrand(gp.id);
      this.emitStatus(gp);
    }
  };

  private emitStatus(gp: Gamepad | null): void {
    const supportsRumble = Boolean(
      gp &&
        (typeof (gp as unknown as { vibrationActuator?: { playEffect?: unknown } }).vibrationActuator
          ?.playEffect === 'function' ||
          Array.isArray((gp as unknown as { hapticActuators?: unknown[] }).hapticActuators)),
    );
    const payload = {
      connected: Boolean(gp),
      brand: gp ? detectControllerBrand(gp.id) : this.lastBrand,
      id: gp ? gp.id : '',
      supportsRumble,
    };
    for (const cb of this.statusListeners) {
      cb(payload);
    }
  }

  public subscribeStatus(
    cb: (info: { connected: boolean; brand: ControllerBrand; id: string; supportsRumble: boolean }) => void,
  ): () => void {
    this.statusListeners.add(cb);
    cb(this.getStatus());
    return () => this.statusListeners.delete(cb);
  }

  public getStatus(): {
    connected: boolean;
    brand: ControllerBrand;
    id: string;
    supportsRumble: boolean;
  } {
    const gp = this.findActiveGamepad();
    const supportsRumble = Boolean(
      gp &&
        (typeof (gp as unknown as { vibrationActuator?: { playEffect?: unknown } }).vibrationActuator
          ?.playEffect === 'function' ||
          Array.isArray((gp as unknown as { hapticActuators?: unknown[] }).hapticActuators)),
    );
    return {
      connected: Boolean(gp),
      brand: gp ? detectControllerBrand(gp.id) : this.lastBrand,
      id: gp ? gp.id : '',
      supportsRumble,
    };
  }

  private findActiveGamepad(): Gamepad | null {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
      return null;
    }
    const pads = navigator.getGamepads();
    if (!pads) return null;
    if (this.activeGamepadIndex !== null) {
      const preferred = pads[this.activeGamepadIndex];
      if (preferred && preferred.connected) return preferred;
    }
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (p && p.connected) {
        this.activeGamepadIndex = p.index;
        return p;
      }
    }
    return null;
  }

  public poll(nowMs: number = performance.now()): GamepadSnapshot {
    const gp = this.findActiveGamepad();
    if (!gp) {
      if (this.lastConnected) {
        this.lastConnected = false;
        this.lastId = '';
        this.prevHeld = emptyButtons();
        this.emitStatus(null);
      }
      return {
        connected: false,
        id: '',
        brand: this.lastBrand,
        lx: 0,
        ly: 0,
        rx: 0,
        ry: 0,
        ltValue: 0,
        rtValue: 0,
        held: emptyButtons(),
        pressed: emptyButtons(),
        navDir: null,
      };
    }

    const brand = detectControllerBrand(gp.id);
    if (!this.lastConnected || gp.id !== this.lastId) {
      this.lastConnected = true;
      this.lastId = gp.id;
      this.lastBrand = brand;
      this.emitStatus(gp);
    }

    const btn = (idx: number): boolean => Boolean(gp.buttons[idx]?.pressed);
    const val = (idx: number): number => gp.buttons[idx]?.value ?? (gp.buttons[idx]?.pressed ? 1 : 0);

    const ltValue = val(6);
    const rtValue = val(7);

    const held: GamepadButtonFrame = {
      a: btn(0),
      b: btn(1),
      x: btn(2),
      y: btn(3),
      lb: btn(4),
      rb: btn(5),
      lt: btn(6) || ltValue >= TRIGGER_THRESHOLD,
      rt: btn(7) || rtValue >= TRIGGER_THRESHOLD,
      select: btn(8),
      start: btn(9),
      dpadUp: btn(12),
      dpadDown: btn(13),
      dpadLeft: btn(14),
      dpadRight: btn(15),
    };

    const pressed: GamepadButtonFrame = {
      a: held.a && !this.prevHeld.a,
      b: held.b && !this.prevHeld.b,
      x: held.x && !this.prevHeld.x,
      y: held.y && !this.prevHeld.y,
      lb: held.lb && !this.prevHeld.lb,
      rb: held.rb && !this.prevHeld.rb,
      lt: held.lt && !this.prevHeld.lt,
      rt: held.rt && !this.prevHeld.rt,
      select: held.select && !this.prevHeld.select,
      start: held.start && !this.prevHeld.start,
      dpadUp: held.dpadUp && !this.prevHeld.dpadUp,
      dpadDown: held.dpadDown && !this.prevHeld.dpadDown,
      dpadLeft: held.dpadLeft && !this.prevHeld.dpadLeft,
      dpadRight: held.dpadRight && !this.prevHeld.dpadRight,
    };

    this.prevHeld = held;

    const [lx, ly] = applyRadialDeadzone(gp.axes[0] ?? 0, gp.axes[1] ?? 0);
    const [rx, ry] = applyRadialDeadzone(gp.axes[2] ?? 0, gp.axes[3] ?? 0);

    // Determine menu directional input (D-pad primary, Left Stick secondary for effortless menu browsing)
    let rawNav: 'up' | 'down' | 'left' | 'right' | null = null;
    if (held.dpadUp || ly < -0.58) rawNav = 'up';
    else if (held.dpadDown || ly > 0.58) rawNav = 'down';
    else if (held.dpadLeft || lx < -0.58) rawNav = 'left';
    else if (held.dpadRight || lx > 0.58) rawNav = 'right';

    let navDir: 'up' | 'down' | 'left' | 'right' | null = null;
    if (rawNav !== this.heldNavDir) {
      this.heldNavDir = rawNav;
      this.navHoldStartMs = nowMs;
      this.navLastPulseMs = nowMs;
      navDir = rawNav;
    } else if (rawNav !== null) {
      const heldFor = nowMs - this.navHoldStartMs;
      const sincePulse = nowMs - this.navLastPulseMs;
      if (heldFor > 340 && sincePulse > 140) {
        this.navLastPulseMs = nowMs;
        navDir = rawNav;
      }
    }

    return {
      connected: true,
      id: gp.id,
      brand,
      lx,
      ly,
      rx,
      ry,
      ltValue,
      rtValue,
      held,
      pressed,
      navDir,
    };
  }

  public hasAnyActivity(snap: GamepadSnapshot): boolean {
    if (!snap.connected) return false;
    if (
      Math.abs(snap.lx) > 0.05 ||
      Math.abs(snap.ly) > 0.05 ||
      Math.abs(snap.rx) > 0.05 ||
      Math.abs(snap.ry) > 0.05
    ) {
      return true;
    }
    return Object.values(snap.held).some(Boolean);
  }

  public rumble(pattern: RumblePattern): void {
    const gp = this.findActiveGamepad();
    if (!gp) return;

    const specs: Record<RumblePattern, { duration: number; strong: number; weak: number }> = {
      hit: { duration: 145, strong: 0.48, weak: 0.65 },
      kill: { duration: 220, strong: 0.72, weak: 0.55 },
      death: { duration: 640, strong: 0.95, weak: 0.78 },
      test: { duration: 260, strong: 0.6, weak: 0.6 },
    };
    const cfg = specs[pattern];

    try {
      const actuator = (
        gp as unknown as {
          vibrationActuator?: {
            playEffect?: (
              type: string,
              params: {
                startDelay: number;
                duration: number;
                weakMagnitude: number;
                strongMagnitude: number;
              },
            ) => Promise<void>;
          };
        }
      ).vibrationActuator;

      if (actuator && typeof actuator.playEffect === 'function') {
        void actuator
          .playEffect('dual-rumble', {
            startDelay: 0,
            duration: cfg.duration,
            weakMagnitude: cfg.weak,
            strongMagnitude: cfg.strong,
          })
          .catch(() => {});
        return;
      }

      // Legacy Firefox/WebKit hapticActuators fallback
      const haptics = (
        gp as unknown as { hapticActuators?: Array<{ pulse?: (v: number, d: number) => Promise<void> }> }
      ).hapticActuators;
      if (haptics && haptics[0] && typeof haptics[0].pulse === 'function') {
        void haptics[0].pulse(cfg.strong, cfg.duration).catch(() => {});
      }
    } catch {
      // Vibration unsupported or blocked by browser — safely ignore
    }
  }

  public dispose(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('gamepadconnected', this.onGamepadConnected);
      window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    }
    this.statusListeners.clear();
  }
}

export const gamepadManager = new GamepadManager();
