import { isTauriEnvironment } from '../utils/windowManager.js';

/**
 * Shortcut Service
 * Provides system-wide Push-to-Talk (PTT) hotkey registration via Tauri v2 plugin-global-shortcut,
 * with an interactive browser/WebView fallback for environments or keys (single modifiers, Mouse4/Mouse5)
 * that OS global hotkeys do not accept.
 */

export const DEFAULT_PTT_KEY = 'Alt';

const MODIFIER_ORDER = ['Control', 'Alt', 'Shift', 'Super'];
const MODIFIER_SET = new Set(MODIFIER_ORDER);
const MOUSE_BUTTON_CODES = {
  1: 'Mouse3',
  3: 'Mouse4',
  4: 'Mouse5',
};

const MODIFIER_ALIASES = {
  ctrl: 'Control',
  control: 'Control',
  controlleft: 'Control',
  controlright: 'Control',
  commandorcontrol: 'Control',
  alt: 'Alt',
  altleft: 'Alt',
  altright: 'Alt',
  option: 'Alt',
  shift: 'Shift',
  shiftleft: 'Shift',
  shiftright: 'Shift',
  super: 'Super',
  meta: 'Super',
  metaleft: 'Super',
  metaright: 'Super',
  osleft: 'Super',
  osright: 'Super',
  cmd: 'Super',
  command: 'Super',
  win: 'Super',
};

const KEY_ALIASES = {
  ' ': 'Space',
  space: 'Space',
  spacebar: 'Space',
  '`': 'Backquote',
  '~': 'Backquote',
  backquote: 'Backquote',
  capslock: 'CapsLock',
  tab: 'Tab',
  enter: 'Enter',
  return: 'Enter',
  backspace: 'Backspace',
  insert: 'Insert',
  delete: 'Delete',
  del: 'Delete',
  home: 'Home',
  end: 'End',
  pageup: 'PageUp',
  pagedown: 'PageDown',
  up: 'ArrowUp',
  arrowup: 'ArrowUp',
  down: 'ArrowDown',
  arrowdown: 'ArrowDown',
  left: 'ArrowLeft',
  arrowleft: 'ArrowLeft',
  right: 'ArrowRight',
  arrowright: 'ArrowRight',
  bracketleft: 'BracketLeft',
  bracketright: 'BracketRight',
  backslash: 'Backslash',
  semicolon: 'Semicolon',
  quote: 'Quote',
  comma: 'Comma',
  period: 'Period',
  slash: 'Slash',
  minus: 'Minus',
  equal: 'Equal',
  scrolllock: 'ScrollLock',
  pause: 'Pause',
  numlock: 'NumLock',
  printscreen: 'PrintScreen',
  mouse3: 'Mouse3',
  mouse4: 'Mouse4',
  mouse5: 'Mouse5',
};

const FRIENDLY_KEY_LABELS = {
  Control: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Super: 'Win',
  Space: 'Space',
  CapsLock: 'CapsLock',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Backspace',
  Backquote: 'é / "',
  BracketLeft: 'Ğ / [',
  BracketRight: 'Ü / ]',
  Semicolon: 'Ş / ;',
  Quote: "İ / '",
  Comma: 'Ö / ,',
  Period: 'Ç / .',
  Slash: '/',
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Mouse3: 'Mouse 3',
  Mouse4: 'Mouse 4',
  Mouse5: 'Mouse 5',
};

const FRIENDLY_DETAILED_LABELS = {
  ...FRIENDLY_KEY_LABELS,
  Mouse3: 'Mouse 3 (Orta)',
  Mouse4: 'Mouse 4 (Yan Geri)',
  Mouse5: 'Mouse 5 (Yan İleri)',
  Backquote: 'Tab Üstü (é / `)',
};

let activeShortcut = null;
let activeTauriShortcut = null;
let cleanupWindowListeners = null;
let registrationSeq = 0;

function normalizeSingleToken(rawToken) {
  if (!rawToken || typeof rawToken !== 'string') return '';
  const trimmed = rawToken.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();

  if (MODIFIER_ALIASES[lower]) return MODIFIER_ALIASES[lower];
  if (KEY_ALIASES[lower]) return KEY_ALIASES[lower];

  if (/^key([a-z])$/i.test(trimmed)) {
    return trimmed.slice(3).toUpperCase();
  }
  if (/^digit([0-9])$/i.test(trimmed)) {
    return trimmed.slice(5);
  }
  if (/^numpad([0-9])$/i.test(trimmed)) {
    return `Numpad${trimmed.slice(6)}`;
  }
  if (/^numpad(add|subtract|multiply|divide|decimal|enter)$/i.test(trimmed)) {
    const suffix = trimmed.slice(6);
    return `Numpad${suffix.charAt(0).toUpperCase()}${suffix.slice(1).toLowerCase()}`;
  }
  if (/^f([1-9]|1[0-9]|2[0-4])$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  // Handle single ASCII letter/digit cleanly regardless of locale (e.g. Turkish 'ı')
  if (trimmed === 'ı' || trimmed === 'İ') return 'I';
  if (/^[a-z0-9]$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  return trimmed;
}

/**
 * Normalize an arbitrary key/combo string into canonical form (e.g. "Control+Alt+V", "Mouse4", "Alt").
 */
export function normalizeShortcutKey(rawKey) {
  if (!rawKey || typeof rawKey !== 'string') return '';

  const parts = rawKey
    .split('+')
    .map((p) => normalizeSingleToken(p))
    .filter(Boolean);

  if (parts.length === 0) return '';

  const modifiers = [];
  let primaryKey = '';

  for (const part of parts) {
    if (MODIFIER_SET.has(part)) {
      if (!modifiers.includes(part)) modifiers.push(part);
    } else if (!primaryKey) {
      primaryKey = part;
    }
  }

  // Bare single modifier (e.g., "Alt", "Control", "Shift")
  if (!primaryKey && modifiers.length === 1) {
    return modifiers[0];
  }
  if (!primaryKey && modifiers.length > 1) {
    // Use last modifier as primary if user somehow passed "Ctrl+Alt"
    const last = modifiers.pop();
    modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
    return [...modifiers, last].join('+');
  }

  modifiers.sort((a, b) => MODIFIER_ORDER.indexOf(a) - MODIFIER_ORDER.indexOf(b));
  return [...modifiers, primaryKey].join('+');
}

/**
 * Parse a normalized shortcut string into modifiers, primary key, and flags.
 */
export function parseShortcut(rawKey) {
  const normalized = normalizeShortcutKey(rawKey);
  if (!normalized) return null;

  const parts = normalized.split('+');
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1);

  return {
    normalized,
    modifiers,
    key,
    isMouse: /^Mouse[345]$/.test(key),
    isModifierOnly: modifiers.length === 0 && MODIFIER_SET.has(key),
  };
}

/**
 * Format a shortcut string into a human-friendly display string (e.g. "Ctrl + Space", "Mouse 4").
 */
export function formatShortcutLabel(rawKey, { detailed = false } = {}) {
  const parsed = parseShortcut(rawKey);
  if (!parsed) return 'Atanmadı';

  const map = detailed ? FRIENDLY_DETAILED_LABELS : FRIENDLY_KEY_LABELS;
  const parts = [...parsed.modifiers, parsed.key].map((token) => map[token] || token);
  return parts.join(' + ');
}

/**
 * Extract canonical token from a KeyboardEvent, preferring physical event.code so Turkish/QWERTY layouts stay consistent.
 */
export function extractKeyboardToken(event) {
  if (!event) return '';
  const code = event.code || '';
  const key = event.key || '';

  if (code) {
    if (MODIFIER_ALIASES[code.toLowerCase()]) {
      return MODIFIER_ALIASES[code.toLowerCase()];
    }
    const normalizedFromCode = normalizeSingleToken(code);
    if (normalizedFromCode && normalizedFromCode !== 'Unidentified') {
      return normalizedFromCode;
    }
  }

  if (key) {
    const normalizedFromKey = normalizeSingleToken(key);
    if (normalizedFromKey && normalizedFromKey !== 'Unidentified' && normalizedFromKey !== 'Dead') {
      return normalizedFromKey;
    }
  }

  return '';
}

/**
 * Convert a KeyboardEvent (during keybind recording) into a shortcut string.
 * Returns null if Escape is pressed or only modifiers are held when allowModifierOnly=false.
 */
export function formatKeyboardEventToShortcut(event, { allowModifierOnly = false } = {}) {
  const token = extractKeyboardToken(event);
  if (!token || token === 'Escape') return null;

  if (MODIFIER_SET.has(token)) {
    return allowModifierOnly ? token : null;
  }

  const modifiers = [];
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('Super');

  return normalizeShortcutKey([...modifiers, token].join('+'));
}

/**
 * Convert a MouseEvent (Mouse3/Mouse4/Mouse5) into a shortcut string (optionally with held modifiers).
 */
export function formatMouseEventToShortcut(event) {
  if (!event) return null;
  const buttonName = MOUSE_BUTTON_CODES[event.button];
  if (!buttonName) return null;

  const modifiers = [];
  if (event.ctrlKey) modifiers.push('Control');
  if (event.altKey) modifiers.push('Alt');
  if (event.shiftKey) modifiers.push('Shift');
  if (event.metaKey) modifiers.push('Super');

  return normalizeShortcutKey([...modifiers, buttonName].join('+'));
}

/**
 * Check if an event target is an active text-input control where single-key typing should not trigger PTT.
 */
export function isEditableElement(target) {
  if (!target || typeof target !== 'object') return false;
  if (target.isContentEditable) return true;
  const tagName = (target.tagName || '').toUpperCase();
  if (tagName === 'TEXTAREA' || tagName === 'SELECT') return true;
  if (tagName === 'INPUT') {
    const inputType = (target.type || 'text').toLowerCase();
    return !['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'file', 'color'].includes(inputType);
  }
  return false;
}

function getHeldModifierState(event, requiredModifiers, { strictShift = true } = {}) {
  const reqCtrl = requiredModifiers.includes('Control');
  const reqAlt = requiredModifiers.includes('Alt');
  const reqShift = requiredModifiers.includes('Shift');
  const reqMeta = requiredModifiers.includes('Super');

  if (Boolean(event.ctrlKey) !== reqCtrl) return false;
  if (Boolean(event.altKey) !== reqAlt) return false;
  if (Boolean(event.metaKey) !== reqMeta) return false;
  if (strictShift) {
    if (Boolean(event.shiftKey) !== reqShift) return false;
  } else if (reqShift && !event.shiftKey) {
    return false;
  }
  return true;
}

/**
 * Determine if a KeyboardEvent activates the given parsed PTT shortcut.
 */
export function matchesShortcutPress(event, parsed) {
  if (!event || !parsed || parsed.isMouse) return false;
  if (event.repeat) return false;

  const token = extractKeyboardToken(event);
  if (!token || token !== parsed.key) return false;

  if (parsed.isModifierOnly) {
    return getHeldModifierState(event, [parsed.key], { strictShift: true });
  }

  if (parsed.modifiers.length > 0) {
    return getHeldModifierState(event, parsed.modifiers, { strictShift: true });
  }

  // Single non-modifier key (e.g. V, F4, CapsLock, Space):
  // Require no Ctrl/Alt/Meta so Ctrl+V / Alt+F4 don't accidentally toggle PTT,
  // while still allowing Shift to remain tolerant on F-keys/CapsLock.
  return getHeldModifierState(event, [], { strictShift: false });
}

/**
 * Determine if a MouseEvent activates the given parsed mouse PTT shortcut.
 */
export function matchesMouseShortcutPress(event, parsed) {
  if (!event || !parsed || !parsed.isMouse) return false;
  const buttonName = MOUSE_BUTTON_CODES[event.button];
  if (!buttonName || buttonName !== parsed.key) return false;

  if (parsed.modifiers.length === 0) {
    return true;
  }
  return getHeldModifierState(event, parsed.modifiers, { strictShift: true });
}

/**
 * Determine if a KeyboardEvent releases an actively held PTT shortcut.
 */
export function shouldReleaseShortcutOnKeyUp(event, parsed) {
  if (!event || !parsed) return false;
  const token = extractKeyboardToken(event);
  if (!token) return false;

  if (parsed.isMouse) {
    return parsed.modifiers.includes(token);
  }
  if (parsed.isModifierOnly) {
    return token === parsed.key;
  }
  return token === parsed.key || parsed.modifiers.includes(token);
}

/**
 * Determine if a MouseEvent releases an actively held mouse PTT shortcut.
 */
export function shouldReleaseShortcutOnMouseUp(event, parsed) {
  if (!event || !parsed || !parsed.isMouse) return false;
  const buttonName = MOUSE_BUTTON_CODES[event.button];
  return buttonName === parsed.key;
}

function attachWindowFallbackListeners(parsed, onStateChange) {
  let isPressed = false;

  const setPressed = (nextPressed) => {
    if (isPressed === nextPressed) return;
    isPressed = nextPressed;
    onStateChange?.(nextPressed);
  };

  const handleKeyDown = (e) => {
    // Allow mouse buttons, F1-F24, and CapsLock even while focused inside chat input;
    // block single keys / bare modifiers while user is actively typing text.
    const isFunctionKey = /^F([1-9]|1[0-9]|2[0-4])$/.test(parsed.key);
    const shouldRespectInputFocus =
      !parsed.isMouse &&
      !isFunctionKey &&
      parsed.key !== 'CapsLock' &&
      parsed.modifiers.length === 0;

    if (shouldRespectInputFocus && isEditableElement(e.target)) {
      return;
    }

    if (matchesShortcutPress(e, parsed)) {
      if (parsed.key === 'Alt' || parsed.key === 'Tab') {
        e.preventDefault();
      }
      setPressed(true);
    }
  };

  const handleKeyUp = (e) => {
    if (isPressed && shouldReleaseShortcutOnKeyUp(e, parsed)) {
      if (parsed.key === 'Alt') {
        e.preventDefault();
      }
      setPressed(false);
    }
  };

  const handleMouseDown = (e) => {
    if (matchesMouseShortcutPress(e, parsed)) {
      e.preventDefault();
      setPressed(true);
    }
  };

  const handleMouseUp = (e) => {
    if (parsed.isMouse && MOUSE_BUTTON_CODES[e.button] === parsed.key) {
      e.preventDefault();
    }
    if (isPressed && shouldReleaseShortcutOnMouseUp(e, parsed)) {
      setPressed(false);
    }
  };

  const handleAuxClick = (e) => {
    if (parsed.isMouse && MOUSE_BUTTON_CODES[e.button] === parsed.key) {
      e.preventDefault();
    }
  };

  const handleReleaseAll = () => {
    setPressed(false);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      setPressed(false);
    }
  };

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
  window.addEventListener('mousedown', handleMouseDown, true);
  window.addEventListener('mouseup', handleMouseUp, true);
  window.addEventListener('auxclick', handleAuxClick, true);
  window.addEventListener('blur', handleReleaseAll);
  document.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('keydown', handleKeyDown, true);
    window.removeEventListener('keyup', handleKeyUp, true);
    window.removeEventListener('mousedown', handleMouseDown, true);
    window.removeEventListener('mouseup', handleMouseUp, true);
    window.removeEventListener('auxclick', handleAuxClick, true);
    window.removeEventListener('blur', handleReleaseAll);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    setPressed(false);
  };
}

/**
 * Register a Push-to-Talk shortcut (Tauri OS global shortcut when supported, else window fallback).
 */
export async function registerPttShortcut(shortcutKey, onStateChange) {
  const seq = ++registrationSeq;
  await unregisterPttShortcut();

  if (seq !== registrationSeq) {
    return { success: false, cancelled: true };
  }

  const parsed = parseShortcut(shortcutKey || DEFAULT_PTT_KEY);
  if (!parsed) {
    return { success: false, shortcut: null, mode: 'window', error: 'Geçersiz kısayol tuşu' };
  }

  activeShortcut = parsed.normalized;
  const inTauri = isTauriEnvironment();
  let tauriFailureReason = null;

  // Tauri global-shortcut does not support mouse buttons or standalone modifier-only keys via Win32 RegisterHotKey
  if (inTauri && !parsed.isMouse && !parsed.isModifierOnly) {
    try {
      const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
      if (seq !== registrationSeq) {
        return { success: false, cancelled: true };
      }

      const alreadyReg = await isRegistered(parsed.normalized).catch(() => false);
      if (alreadyReg) {
        await unregister(parsed.normalized).catch(() => {});
      }

      if (seq !== registrationSeq) {
        return { success: false, cancelled: true };
      }

      await register(parsed.normalized, (event) => {
        if (seq !== registrationSeq) return;
        if (event.state === 'Pressed') {
          onStateChange?.(true);
        } else if (event.state === 'Released') {
          onStateChange?.(false);
        }
      });

      if (seq !== registrationSeq) {
        await unregister(parsed.normalized).catch(() => {});
        return { success: false, cancelled: true };
      }

      activeTauriShortcut = parsed.normalized;
      return {
        success: true,
        shortcut: parsed.normalized,
        mode: 'global',
        isTauriGlobal: true,
      };
    } catch (err) {
      tauriFailureReason = err?.message || String(err);
      console.warn('[ShortcutService] Tauri global shortcut fallback:', parsed.normalized, tauriFailureReason);
    }
  } else if (inTauri && parsed.isMouse) {
    tauriFailureReason = 'Mouse yan tuşları sistem genelinde yakalanamaz.';
  } else if (inTauri && parsed.isModifierOnly) {
    tauriFailureReason = 'Tek başına Ctrl/Alt/Shift sistem genelinde yakalanamaz.';
  }

  if (seq !== registrationSeq) {
    return { success: false, cancelled: true };
  }

  cleanupWindowListeners = attachWindowFallbackListeners(parsed, onStateChange);
  return {
    success: true,
    shortcut: parsed.normalized,
    mode: 'window',
    isTauriGlobal: false,
    warning: tauriFailureReason,
  };
}

/**
 * Unregister the currently active PTT shortcut cleanly.
 */
export async function unregisterPttShortcut() {
  if (cleanupWindowListeners) {
    try {
      cleanupWindowListeners();
    } catch {}
    cleanupWindowListeners = null;
  }

  const shortcutToUnregister = activeTauriShortcut;
  activeTauriShortcut = null;
  activeShortcut = null;

  if (shortcutToUnregister && isTauriEnvironment()) {
    try {
      const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
      await unregister(shortcutToUnregister).catch(() => {});
    } catch {}
  }
}

/**
 * Get the currently registered normalized PTT shortcut, if any.
 */
export function getActivePttShortcut() {
  return activeShortcut;
}

/**
 * Unregister all Tauri global shortcuts and window fallback listeners.
 */
export async function unregisterAllShortcuts() {
  registrationSeq += 1;
  await unregisterPttShortcut();
  if (isTauriEnvironment()) {
    try {
      const { unregisterAll } = await import('@tauri-apps/plugin-global-shortcut');
      await unregisterAll().catch(() => {});
    } catch {}
  }
}
