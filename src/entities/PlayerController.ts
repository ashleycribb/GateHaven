import { ENGINE } from '../../shared/engine';
import type { MoveInputState } from '../../shared/MoveInput';
import {
  gamepadManager,
  type ControllerBrand,
  type InputModality,
} from '../input/gamepadManager';
import {
  activateGamepadUiFocus,
  clearGamepadUiFocus,
  ensureGamepadUiFocus,
  moveGamepadUiFocus,
} from '../input/useGamepadUiNav';
import type { BattleIslandConnection } from '../net/client';

export interface PlayerControllerCallbacks {
  onModalityChange?: (modality: InputModality, brand: ControllerBrand) => void;
  onToggleHelp?: () => void;
  onCloseModal?: () => void;
  isModalOpen?: () => boolean;
}

export class PlayerController {
  private readonly canvas: HTMLCanvasElement;
  private readonly connection: BattleIslandConnection;
  private readonly callbacks: PlayerControllerCallbacks;

  private readonly keys = new Set<string>();
  private mouseDownAttack = false;
  private draggingLook = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Touch inputs
  private touchMoveX = 0;
  private touchMoveZ = 0;
  private touchAttack = false;
  private touchSkill = false;
  private touchTrap = false;
  private touchInteract = false;

  // Camera orientation (radians)
  public cameraYaw = 0;
  public cameraPitch = 0.42;

  private modality: InputModality = 'keyboard';
  private controllerBrand: ControllerBrand = 'xbox';
  private lastSendMs = 0;
  private readonly sendIntervalMs = 1000 / ENGINE.tickRate;
  private activeWeaponIdx = 0;
  private disposed = false;

  constructor(
    canvas: HTMLCanvasElement,
    connection: BattleIslandConnection,
    callbacks: PlayerControllerCallbacks = {},
  ) {
    this.canvas = canvas;
    this.connection = connection;
    this.callbacks = callbacks;

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('contextmenu', this.onContextMenu);
  }

  public setTouchJoystick(x: number, y: number): void {
    this.touchMoveX = Math.max(-1, Math.min(1, x));
    this.touchMoveZ = Math.max(-1, Math.min(1, y));
    if (Math.hypot(x, y) > 0.08) {
      this.setModality('touch');
    }
  }

  public pulseTouchAction(action: 'attack' | 'skill' | 'trap' | 'interact'): void {
    this.setModality('touch');
    if (action === 'attack') this.touchAttack = true;
    else if (action === 'skill') this.touchSkill = true;
    else if (action === 'trap') this.touchTrap = true;
    else if (action === 'interact') this.touchInteract = true;
  }

  public triggerRumble(pattern: 'hit' | 'kill' | 'death'): void {
    gamepadManager.rumble(pattern);
  }

  public update(nowMs: number, dtSec: number): void {
    if (this.disposed) return;

    const gp = gamepadManager.poll(nowMs);
    if (gp.connected) {
      this.controllerBrand = gp.brand;
      if (gamepadManager.hasAnyActivity(gp)) {
        this.setModality('gamepad');
      }
    }

    const modalOpen = this.callbacks.isModalOpen?.() ?? false;
    if (modalOpen) {
      if (gp.connected) {
        if (gp.navDir) {
          moveGamepadUiFocus(gp.navDir);
        } else if (gp.pressed.a) {
          activateGamepadUiFocus();
        } else if (gp.pressed.b || gp.pressed.start) {
          clearGamepadUiFocus();
          this.callbacks.onCloseModal?.();
        }
      }
      return;
    }

    if (gp.connected && gp.pressed.start) {
      ensureGamepadUiFocus();
      this.callbacks.onToggleHelp?.();
      return;
    }

    // Right stick camera look
    if (gp.connected && (Math.abs(gp.rx) > 0.01 || Math.abs(gp.ry) > 0.01)) {
      this.cameraYaw += gp.rx * 2.4 * dtSec;
      this.cameraPitch = Math.max(0.18, Math.min(1.05, this.cameraPitch + gp.ry * 1.6 * dtSec));
    }

    // Weapon cycling on controller RB / LB
    if (gp.connected && (gp.pressed.rb || gp.pressed.lb)) {
      const self = this.connection.room.state.players?.get(this.connection.room.sessionId);
      const count = self?.weaponSlots?.length ?? 1;
      if (count > 1) {
        this.activeWeaponIdx = (this.activeWeaponIdx + (gp.pressed.rb ? 1 : count - 1)) % count;
        this.connection.sendSwitchWeapon(this.activeWeaponIdx);
      }
    }

    // Sample movement axes in camera space -> world XZ
    let localRight = 0;
    let localForward = 0;

    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) localRight += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) localRight -= 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) localForward += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) localForward -= 1;

    if (gp.connected) {
      localRight += gp.lx;
      localForward -= gp.ly;
    }

    localRight += this.touchMoveX;
    localForward -= this.touchMoveZ;

    const mag = Math.hypot(localRight, localForward);
    if (mag > 1) {
      localRight /= mag;
      localForward /= mag;
    }

    // Convert camera-relative movement into world X/Z (camera looks along sin(yaw), cos(yaw))
    const sinY = Math.sin(this.cameraYaw);
    const cosY = Math.cos(this.cameraYaw);
    const worldMoveX = localForward * sinY + localRight * cosY;
    const worldMoveZ = localForward * cosY - localRight * sinY;

    const attack =
      this.mouseDownAttack ||
      this.keys.has('KeyF') ||
      (gp.connected && gp.held.rt) ||
      this.touchAttack;

    const useSkill =
      this.keys.has('Space') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      (gp.connected && (gp.held.y || gp.held.a)) ||
      this.touchSkill;

    const placeTrap =
      this.keys.has('KeyQ') || (gp.connected && gp.held.b) || this.touchTrap;

    const interact =
      this.keys.has('KeyE') || (gp.connected && gp.held.x) || this.touchInteract;

    // Emit fixed-rate input frames at 30 Hz via Colyseus room.input
    if (nowMs - this.lastSendMs >= this.sendIntervalMs) {
      this.lastSendMs = nowMs;
      const data = this.connection.input.data as MoveInputState;
      data.moveX = Math.max(-1, Math.min(1, worldMoveX));
      data.moveZ = Math.max(-1, Math.min(1, worldMoveZ));
      data.rotY = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, this.cameraYaw));
      data.attack = attack;
      data.useSkill = useSkill;
      data.placeTrap = placeTrap;
      data.interact = interact;
      this.connection.input.send();

      // Clear one-shot touch pulses after transmitting
      this.touchAttack = false;
      this.touchSkill = false;
      this.touchTrap = false;
      this.touchInteract = false;
    }
  }

  private setModality(next: InputModality): void {
    if (this.modality !== next) {
      this.modality = next;
      this.callbacks.onModalityChange?.(next, this.controllerBrand);
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.setModality('keyboard');

    if (e.code === 'Escape' || e.code === 'KeyH') {
      if (this.callbacks.isModalOpen?.()) {
        this.callbacks.onCloseModal?.();
      } else if (e.code === 'KeyH') {
        this.callbacks.onToggleHelp?.();
      }
      return;
    }

    if (e.code === 'Digit1') {
      this.activeWeaponIdx = 0;
      this.connection.sendSwitchWeapon(0);
    } else if (e.code === 'Digit2') {
      this.activeWeaponIdx = 1;
      this.connection.sendSwitchWeapon(1);
    }

    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onBlur = (): void => {
    this.keys.clear();
    this.mouseDownAttack = false;
    this.draggingLook = false;
  };

  private onPointerDown = (e: PointerEvent): void => {
    if (this.callbacks.isModalOpen?.()) return;
    if (e.pointerType === 'touch') {
      this.setModality('touch');
    } else {
      this.setModality('keyboard');
    }
    if (e.button === 0) {
      this.mouseDownAttack = true;
      this.draggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (e.button === 2) {
      this.draggingLook = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    if (this.callbacks.isModalOpen?.()) return;
    if (document.pointerLockElement === this.canvas) {
      this.cameraYaw += e.movementX * 0.004;
      this.cameraPitch = Math.max(0.18, Math.min(1.05, this.cameraPitch + e.movementY * 0.003));
      return;
    }
    if (!this.draggingLook) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    this.cameraYaw += dx * 0.006;
    this.cameraPitch = Math.max(0.18, Math.min(1.05, this.cameraPitch + dy * 0.004));
  };

  private onPointerUp = (): void => {
    this.mouseDownAttack = false;
    this.draggingLook = false;
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  public dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
  }
}
