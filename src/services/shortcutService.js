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
  intlbackslash: 'IntlBackslash',
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
  IntlBackslash: '< / >',
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
let activeTauriShortcuts = [];
let unlistenNativePtt = null;
let usingNativeTauriPtt = false;
let cleanupWindowListeners = null;
let registrationSeq = 0;

const SAFE_SHIFT_COMPANION_KEYS = new Set([
  'CapsLock',
  'Insert',
  'Home',
  'End',
  'PageUp',
  'PageDown',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'PrintScreen',
  'ScrollLock',
  'Pause',
]);

function isFunctionKeyToken(key) {
  return typeof key === 'string' && /^F([1-9]|1[0-9]|2[0-4])$/.test(key);
}

function isTypingSensitiveKey(parsed) {
  return Boolean(
    parsed &&
    !parsed.isMouse &&
    !parsed.isModifierOnly &&
    parsed.modifiers.length === 0 &&
    parsed.key !== 'CapsLock' &&
    !isFunctionKeyToken(parsed.key)
  );
}

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

function getHeldModifierState(
  event,
  requiredModifiers,
  { strictShift = true, allowExtraModifiers = false, pressedToken = '' } = {}
) {
  const hasCtrl = Boolean(event.ctrlKey) || pressedToken === 'Control';
  const hasAlt = Boolean(event.altKey) || pressedToken === 'Alt';
  const hasShift = Boolean(event.shiftKey) || pressedToken === 'Shift';
  const hasMeta = Boolean(event.metaKey) || pressedToken === 'Super';

  const reqCtrl = requiredModifiers.includes('Control');
  const reqAlt = requiredModifiers.includes('Alt');
  const reqShift = requiredModifiers.includes('Shift');
  const reqMeta = requiredModifiers.includes('Super');

  if (reqCtrl && !hasCtrl) return false;
  if (reqAlt && !hasAlt) return false;
  if (reqShift && !hasShift) return false;
  if (reqMeta && !hasMeta) return false;

  // Never allow Win/Meta combos to steal OS shortcuts unless Super was explicitly requested
  if (!reqMeta && hasMeta) return false;

  if (allowExtraModifiers) {
    return true;
  }

  if (!reqCtrl && hasCtrl) return false;
  if (!reqAlt && hasAlt) return false;
  if (strictShift && !reqShift && hasShift) return false;
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
    // Allow holding Shift/Ctrl/Alt alongside a standalone modifier PTT key (e.g. Shift + Alt while gaming)
    return getHeldModifierState(event, [parsed.key], {
      strictShift: false,
      allowExtraModifiers: true,
      pressedToken: token,
    });
  }

  if (parsed.modifiers.length > 0) {
    // Allow extra modifiers (e.g. holding Shift in a game while pressing Alt+V)
    return getHeldModifierState(event, parsed.modifiers, {
      strictShift: false,
      allowExtraModifiers: true,
      pressedToken: token,
    });
  }

  // Single non-modifier key (e.g. V, F4, CapsLock, Space):
  // Tolerate Shift so walking/running in games doesn't block single-key PTT,
  // while still preventing Ctrl+V / Alt+F4 browser shortcuts in DOM mode.
  return getHeldModifierState(event, [], { strictShift: false, pressedToken: token });
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
  return getHeldModifierState(event, parsed.modifiers, {
    strictShift: false,
    allowExtraModifiers: true,
  });
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
    // block bare printable keys while user is actively typing text.
    if (isTypingSensitiveKey(parsed) && isEditableElement(e.target)) {
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
 * Prevents browser navigation/focus side-effects (e.g. Mouse4 Back, Alt menu bar)
 * inside the focused Voys WebView when native OS-level PTT owns hotkey state.
 */
function attachFocusedUiPreventDefaults(parsed) {
  const preventKey = (e) => {
    if (parsed.key === 'Alt' || parsed.key === 'Tab') {
      const token = extractKeyboardToken(e);
      if (token === parsed.key) {
        e.preventDefault();
      }
    }
  };

  const preventMouseNav = (e) => {
    if (parsed.isMouse && MOUSE_BUTTON_CODES[e.button] === parsed.key) {
      e.preventDefault();
    }
  };

  window.addEventListener('keydown', preventKey, true);
  window.addEventListener('keyup', preventKey, true);
  window.addEventListener('mousedown', preventMouseNav, true);
  window.addEventListener('mouseup', preventMouseNav, true);
  window.addEventListener('auxclick', preventMouseNav, true);

  return () => {
    window.removeEventListener('keydown', preventKey, true);
    window.removeEventListener('keyup', preventKey, true);
    window.removeEventListener('mousedown', preventMouseNav, true);
    window.removeEventListener('mouseup', preventMouseNav, true);
    window.removeEventListener('auxclick', preventMouseNav, true);
  };
}

export function getLegacyTauriShortcutVariants(parsed) {
  if (!parsed || parsed.isMouse || parsed.isModifierOnly) return [];
  const variants = [parsed.normalized];

  const canAddShiftCompanion =
    !parsed.modifiers.includes('Shift') &&
    (parsed.modifiers.length > 0 || isFunctionKeyToken(parsed.key) || SAFE_SHIFT_COMPANION_KEYS.has(parsed.key));

  if (canAddShiftCompanion) {
    const shiftVariant = normalizeShortcutKey(`Shift+${parsed.normalized}`);
    if (shiftVariant && !variants.includes(shiftVariant)) {
      variants.push(shiftVariant);
    }
  }

  return variants;
}

/**
 * Register a Push-to-Talk shortcut (Tauri native async hook when supported, legacy global-shortcut, else window fallback).
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

  // 1. Preferred: Tauri native Windows async key-state listener
  // Supports ALL keys (Alt, Shift, Ctrl, Mouse3/4/5, CapsLock, V, Alt+V, etc.)
  // without swallowing game inputs and works even while holding Shift/Ctrl in games.
  if (inTauri) {
    let tempUnlisten = null;
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { listen } = await import('@tauri-apps/api/event');

      const typingSensitiveSingleKey = isTypingSensitiveKey(parsed);

      let nativePressed = false;
      const setNativePressed = (next) => {
        if (nativePressed === next) return;
        nativePressed = next;
        onStateChange?.(next);
      };

      tempUnlisten = await listen('voys://ptt-state', (event) => {
        if (seq !== registrationSeq) return;
        const payload = event?.payload;
        if (!payload || (payload.generation != null && payload.generation !== seq)) return;

        if (!payload.pressed) {
          setNativePressed(false);
          return;
        }

        if (payload.isForegroundSelf && typingSensitiveSingleKey) {
          if (isEditableElement(document.activeElement)) return;
          if (payload.ctrlDown || payload.altDown || payload.metaDown) return;
        }

        setNativePressed(true);
      });

      if (seq !== registrationSeq) {
        tempUnlisten();
        return { success: false, cancelled: true };
      }

      const started = await invoke('start_ptt_listener', {
        shortcutKey: parsed.normalized,
        generation: seq,
      });

      if (seq !== registrationSeq) {
        tempUnlisten();
        await invoke('stop_ptt_listener').catch(() => {});
        return { success: false, cancelled: true };
      }

      if (started) {
        unlistenNativePtt = tempUnlisten;
        usingNativeTauriPtt = true;
        cleanupWindowListeners = attachFocusedUiPreventDefaults(parsed);
        return {
          success: true,
          shortcut: parsed.normalized,
          mode: 'native-global',
          isTauriGlobal: true,
        };
      }

      tempUnlisten();
      tempUnlisten = null;
    } catch {
      if (tempUnlisten) {
        try {
          tempUnlisten();
        } catch {}
      }
      // Older desktop binaries without native PTT command fall through to legacy plugin-global-shortcut
    }
  }

  // 2. Legacy fallback for un-updated desktop binaries using plugin-global-shortcut
  if (inTauri && !parsed.isMouse && !parsed.isModifierOnly) {
    const registeredVariants = [];
    try {
      const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');
      if (seq !== registrationSeq) {
        return { success: false, cancelled: true };
      }

      const variants = getLegacyTauriShortcutVariants(parsed);
      const heldVariants = new Set();

      for (const variant of variants) {
        if (seq !== registrationSeq) {
          for (const rv of registeredVariants) {
            await unregister(rv).catch(() => {});
          }
          return { success: false, cancelled: true };
        }

        const alreadyReg = await isRegistered(variant).catch(() => false);
        if (alreadyReg) {
          await unregister(variant).catch(() => {});
        }

        try {
          await register(variant, (event) => {
            if (seq !== registrationSeq) return;
            if (event.state === 'Pressed') {
              const wasActive = heldVariants.size > 0;
              heldVariants.add(variant);
              if (!wasActive) onStateChange?.(true);
            } else if (event.state === 'Released') {
              heldVariants.delete(variant);
              if (heldVariants.size === 0) onStateChange?.(false);
            }
          });
          registeredVariants.push(variant);
        } catch (variantErr) {
          // Base shortcut failure triggers full fallback; optional Shift+companion failure is non-fatal
          if (variant === parsed.normalized) {
            throw variantErr;
          }
        }
      }

      if (seq !== registrationSeq) {
        for (const rv of registeredVariants) {
          await unregister(rv).catch(() => {});
        }
        return { success: false, cancelled: true };
      }

      activeTauriShortcuts = registeredVariants;
      return {
        success: true,
        shortcut: parsed.normalized,
        mode: 'global',
        isTauriGlobal: true,
      };
    } catch (err) {
      for (const rv of registeredVariants) {
        try {
          const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
          await unregister(rv).catch(() => {});
        } catch {}
      }
      tauriFailureReason = err?.message || String(err);
      console.warn('[ShortcutService] Tauri global shortcut fallback:', parsed.normalized, tauriFailureReason);
    }
  } else if (inTauri && parsed.isMouse) {
    tauriFailureReason = 'Mouse yan tuşları için masaüstü uygulamasını güncelleyin.';
  } else if (inTauri && parsed.isModifierOnly) {
    tauriFailureReason = 'Tek başına Ctrl/Alt/Shift için masaüstü uygulamasını güncelleyin.';
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

  if (unlistenNativePtt) {
    try {
      unlistenNativePtt();
    } catch {}
    unlistenNativePtt = null;
  }

  const wasNative = usingNativeTauriPtt;
  usingNativeTauriPtt = false;

  const shortcutsToUnregister = [...activeTauriShortcuts];
  activeTauriShortcuts = [];
  activeShortcut = null;

  if (wasNative && isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_ptt_listener').catch(() => {});
    } catch {}
  }

  if (shortcutsToUnregister.length > 0 && isTauriEnvironment()) {
    try {
      const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
      for (const sc of shortcutsToUnregister) {
        await unregister(sc).catch(() => {});
      }
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
