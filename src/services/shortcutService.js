/**
 * Global Shortcut Service for Stand.upp
 * Provides system-wide Push-to-Talk (PTT) hotkey registration via Tauri v2 plugin-global-shortcut,
 * with graceful browser event fallback for development and testing.
 */

let activeShortcut = null;
let browserKeydownListener = null;
let browserKeyupListener = null;

export function isTauri() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__);
}

/**
 * Normalizes user key input into a valid Tauri shortcut string.
 * Examples: 'v' -> 'V', 'alt' -> 'Alt', 'control' -> 'Control', ' ' -> 'Space'
 */
export function normalizeShortcutKey(key) {
  if (!key) return 'Alt';
  const trimmed = key.trim();
  if (!trimmed) return 'Space';

  // If combination (e.g. 'Control + Space' or 'Alt+V')
  if (trimmed.includes('+') || trimmed.includes(' ')) {
    const parts = trimmed.split(/[+ ]+/).filter(Boolean);
    const normalizedParts = parts.map((p) => {
      const lower = p.toLowerCase();
      if (lower === 'ctrl' || lower === 'control') return 'Control';
      if (lower === 'alt') return 'Alt';
      if (lower === 'shift') return 'Shift';
      if (lower === 'cmd' || lower === 'command' || lower === 'meta') return 'Super';
      if (lower === 'space') return 'Space';
      return p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1);
    });
    return normalizedParts.join('+');
  }

  const lower = trimmed.toLowerCase();
  if (lower === 'alt') return 'Alt';
  if (lower === 'ctrl' || lower === 'control') return 'Control';
  if (lower === 'shift') return 'Shift';
  if (lower === 'space') return 'Space';
  if (lower === 'v') return 'V';
  if (/^f[1-9]|f1[0-2]$/i.test(trimmed)) return trimmed.toUpperCase();
  if (trimmed.length === 1) return trimmed.toUpperCase();

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * Registers a global shortcut for Push-to-Talk.
 * @param {string} shortcutKey - e.g. 'Alt', 'V', 'Control+Space'
 * @param {function(boolean)} onStateChange - callback invoked with true (pressed) or false (released)
 */
export async function registerPttShortcut(shortcutKey, onStateChange) {
  const normalized = normalizeShortcutKey(shortcutKey);

  // Unregister previous if any
  await unregisterPttShortcut();

  activeShortcut = normalized;
  activeCallback = onStateChange;

  if (isTauri()) {
    try {
      const { register, unregister, isRegistered } = await import('@tauri-apps/plugin-global-shortcut');

      // Check if already registered and clear
      const alreadyReg = await isRegistered(normalized).catch(() => false);
      if (alreadyReg) {
        await unregister(normalized).catch(() => {});
      }

      await register(normalized, (event) => {
        if (typeof onStateChange === 'function') {
          // event.state is 'Pressed' or 'Released' in Tauri v2
          const isPressed = event.state === 'Pressed';
          onStateChange(isPressed);
        }
      });

      console.info(`[Stand.upp] Tauri Global Shortcut registered: "${normalized}"`);
      return { success: true, shortcut: normalized, tauri: true };
    } catch (err) {
      console.warn(`[Stand.upp] Tauri global shortcut registration failed for "${normalized}":`, err);
    }
  }

  // Browser Fallback (or in-app window fallback)
  const isTargetKey = (e) => {
    const norm = normalized.toLowerCase();
    if (norm === 'alt') return e.key === 'Alt' || e.altKey;
    if (norm === 'control' || norm === 'ctrl') return e.key === 'Control' || e.ctrlKey;
    if (norm === 'shift') return e.key === 'Shift' || e.shiftKey;
    if (norm === 'space') return e.key === ' ' || e.code === 'Space';
    if (norm === 'v') return e.key?.toLowerCase() === 'v' || e.code === 'KeyV';
    return e.key?.toLowerCase() === norm.toLowerCase() || e.code?.toLowerCase() === norm.toLowerCase();
  };

  let isHeld = false;

  browserKeydownListener = (e) => {
    if (e.repeat) return;
    if (isTargetKey(e) && !isHeld) {
      isHeld = true;
      if (typeof onStateChange === 'function') {
        onStateChange(true);
      }
    }
  };

  browserKeyupListener = (e) => {
    if (isTargetKey(e) && isHeld) {
      isHeld = false;
      if (typeof onStateChange === 'function') {
        onStateChange(false);
      }
    }
  };

  window.addEventListener('keydown', browserKeydownListener);
  window.addEventListener('keyup', browserKeyupListener);

  return { success: true, shortcut: normalized, tauri: false };
}

/**
 * Unregisters the current Push-to-Talk shortcut.
 */
export async function unregisterPttShortcut() {
  if (browserKeydownListener) {
    window.removeEventListener('keydown', browserKeydownListener);
    browserKeydownListener = null;
  }
  if (browserKeyupListener) {
    window.removeEventListener('keyup', browserKeyupListener);
    browserKeyupListener = null;
  }

  if (activeShortcut && isTauri()) {
    try {
      const { unregister } = await import('@tauri-apps/plugin-global-shortcut');
      await unregister(activeShortcut).catch(() => {});
      console.info(`[Stand.upp] Tauri Global Shortcut unregistered: "${activeShortcut}"`);
    } catch (err) {
      console.warn('[Stand.upp] Error unregistering Tauri shortcut:', err);
    }
  }

  activeShortcut = null;
}

/**
 * Unregisters all registered global shortcuts.
 */
export async function unregisterAllShortcuts() {
  await unregisterPttShortcut();
  if (isTauri()) {
    try {
      const { unregisterAll } = await import('@tauri-apps/plugin-global-shortcut');
      await unregisterAll().catch(() => {});
    } catch {}
  }
}
