const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[tabindex="0"]',
].join(', ');

let currentFocusedEl: HTMLElement | null = null;

export function clearGamepadUiFocus(): void {
  if (currentFocusedEl) {
    currentFocusedEl.removeAttribute('data-gamepad-focus');
    currentFocusedEl = null;
  }
}

function getActiveUiScope(): HTMLElement | null {
  // Prefer the topmost mounted modal overlay (highest z-index fixed overlay)
  const modals = Array.from(document.querySelectorAll<HTMLElement>('[data-gamepad-scope="modal"]'));
  if (modals.length > 0) {
    return modals[modals.length - 1];
  }
  // Fallback: detect any z-50/z-40 fixed overlay dialog automatically
  const overlays = Array.from(document.querySelectorAll<HTMLElement>('div.fixed.inset-0'));
  for (let i = overlays.length - 1; i >= 0; i--) {
    const el = overlays[i];
    if (el.offsetParent !== null && el.querySelector(FOCUSABLE_SELECTOR)) {
      return el;
    }
  }
  return document.getElementById('root');
}

function getVisibleFocusables(scope: HTMLElement): HTMLElement[] {
  const all = Array.from(scope.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
  return all.filter((el) => {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') {
      return false;
    }
    const rect = el.getBoundingClientRect();
    return rect.width > 2 && rect.height > 2;
  });
}

function applyFocus(el: HTMLElement | null): void {
  if (currentFocusedEl && currentFocusedEl !== el) {
    currentFocusedEl.removeAttribute('data-gamepad-focus');
  }
  currentFocusedEl = el;
  if (el) {
    el.setAttribute('data-gamepad-focus', 'true');
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

/**
 * Ensures a valid focusable element is highlighted inside the active dialog/menu
 * whenever the player uses a controller to navigate menus.
 */
export function ensureGamepadUiFocus(): HTMLElement | null {
  const scope = getActiveUiScope();
  if (!scope) return null;
  const list = getVisibleFocusables(scope);
  if (list.length === 0) {
    clearGamepadUiFocus();
    return null;
  }
  if (currentFocusedEl && scope.contains(currentFocusedEl) && list.includes(currentFocusedEl)) {
    return currentFocusedEl;
  }
  // Prefer the first primary action button or non-close button if available
  const preferred =
    list.find((el) => el.getAttribute('aria-label')?.toLowerCase().includes('close') !== true) ??
    list[0];
  applyFocus(preferred);
  return preferred;
}

/**
 * Spatially moves focus inside the active menu or dialog using D-pad Up/Down/Left/Right.
 */
export function moveGamepadUiFocus(dir: 'up' | 'down' | 'left' | 'right'): void {
  const scope = getActiveUiScope();
  if (!scope) return;
  const list = getVisibleFocusables(scope);
  if (list.length === 0) return;

  if (!currentFocusedEl || !scope.contains(currentFocusedEl) || !list.includes(currentFocusedEl)) {
    ensureGamepadUiFocus();
    return;
  }

  const curRect = currentFocusedEl.getBoundingClientRect();
  const cx = curRect.left + curRect.width / 2;
  const cy = curRect.top + curRect.height / 2;

  let best: HTMLElement | null = null;
  let bestScore = Infinity;

  for (const el of list) {
    if (el === currentFocusedEl) continue;
    const r = el.getBoundingClientRect();
    const ex = r.left + r.width / 2;
    const ey = r.top + r.height / 2;
    const dx = ex - cx;
    const dy = ey - cy;

    let primary = 0;
    let secondary = 0;
    if (dir === 'up') {
      if (dy >= -6) continue;
      primary = -dy;
      secondary = Math.abs(dx);
    } else if (dir === 'down') {
      if (dy <= 6) continue;
      primary = dy;
      secondary = Math.abs(dx);
    } else if (dir === 'left') {
      if (dx >= -6) continue;
      primary = -dx;
      secondary = Math.abs(dy);
    } else {
      if (dx <= 6) continue;
      primary = dx;
      secondary = Math.abs(dy);
    }

    // Strongly favor elements aligned along the travel axis
    const score = primary + secondary * 2.4;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }

  if (best) {
    applyFocus(best);
    return;
  }

  // Fallback linear wrap so no control is ever unreachable
  const idx = list.indexOf(currentFocusedEl);
  const delta = dir === 'down' || dir === 'right' ? 1 : -1;
  const next = list[(idx + delta + list.length) % list.length];
  applyFocus(next);
}

/** Activates the focused UI control when A / Cross is pressed */
export function activateGamepadUiFocus(): boolean {
  const el = ensureGamepadUiFocus();
  if (!el) return false;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
    el.focus();
    if ((el as HTMLInputElement).type === 'checkbox' || (el as HTMLInputElement).type === 'radio') {
      el.click();
    }
    return true;
  }
  el.click();
  return true;
}

/** Cycles modal tabs (if any exist with data-modal-tab="true") using LB / RB */
export function cycleGamepadModalTabs(delta: -1 | 1): boolean {
  const scope = getActiveUiScope();
  if (!scope) return false;
  const tabs = Array.from(scope.querySelectorAll<HTMLElement>('[data-modal-tab="true"]'));
  if (tabs.length < 2) return false;
  const activeIdx = tabs.findIndex((t) => t.getAttribute('data-active') === 'true');
  const start = activeIdx >= 0 ? activeIdx : 0;
  const next = tabs[(start + delta + tabs.length) % tabs.length];
  next.click();
  applyFocus(next);
  return true;
}
