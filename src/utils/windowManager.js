import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { invoke, isTauri as checkTauri } from '@tauri-apps/api/core';
import { chatService } from '../services/chatService.js';

export const LOGIN_SIZE = { width: 380, height: 400, minWidth: 360, minHeight: 380 };
export const REGISTER_SIZE = { width: 380, height: 580, minWidth: 360, minHeight: 500 };
export const MAIN_SIZE = { width: 950, height: 580, minWidth: 720, minHeight: 500 };

// Keep WebView2 process and Chromium timers active when occluded by fullscreen games
if (typeof navigator !== 'undefined' && navigator.locks && typeof navigator.locks.request === 'function') {
  navigator.locks.request('voys_background_keepalive', () => new Promise(() => {})).catch(() => {});
}

export function isTauriEnvironment() {
  if (typeof window === 'undefined') return false;
  try {
    if (typeof checkTauri === 'function' && checkTauri()) return true;
  } catch {}
  return Boolean(
    window.__TAURI_INTERNALS__ ||
    window.__TAURI__ ||
    window.__TAURI_INVOKE__ ||
    (typeof window.__TAURI_IPC__ === 'function')
  );
}

/**
 * Resizes the Tauri window to the main chat interface dimensions (950x580) and centers it.
 * @param {boolean} force - Force resize even if window is already sized or maximized
 */
export async function resizeToMainWindow(force = false) {
  if (!isTauriEnvironment()) return;
  try {
    const appWindow = getCurrentWindow();
    if (!appWindow) return;

    // 1. Re-enable resizing so user can adjust or maximize window
    await appWindow.setResizable(true).catch(() => {});

    // 2. If already maximized, respect state unless force is requested
    const isMax = await appWindow.isMaximized().catch(() => false);
    if (isMax && !force) {
      return;
    }

    // Determine target dimensions (saved preference or default MAIN_SIZE)
    let targetWidth = MAIN_SIZE.width;
    let targetHeight = MAIN_SIZE.height;

    try {
      const saved = localStorage.getItem('voys_window_size');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          parsed &&
          typeof parsed.width === 'number' &&
          typeof parsed.height === 'number' &&
          parsed.width >= MAIN_SIZE.minWidth &&
          parsed.height >= MAIN_SIZE.minHeight
        ) {
          targetWidth = parsed.width;
          targetHeight = parsed.height;
        }
      }
    } catch {}

    // Check current size using logical pixels (DOM innerWidth/innerHeight)
    const currentLogicalWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const currentLogicalHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    if (!force && currentLogicalWidth >= MAIN_SIZE.minWidth && currentLogicalHeight >= MAIN_SIZE.minHeight) {
      await appWindow.setMinSize(new LogicalSize(MAIN_SIZE.minWidth, MAIN_SIZE.minHeight)).catch(() => {});
      return;
    }

    // 3. IMPORTANT: Set window size FIRST before setting minSize!
    // Setting minSize (720, 500) while current size is smaller (e.g. 380x400) causes Win32/Tauri constraint errors.
    await appWindow.setSize(new LogicalSize(targetWidth, targetHeight)).catch((e) => {
      console.warn('Tauri setSize error:', e);
    });

    // 4. Update min size constraints for the main chat interface
    await appWindow.setMinSize(new LogicalSize(MAIN_SIZE.minWidth, MAIN_SIZE.minHeight)).catch((e) => {
      console.warn('Tauri setMinSize error:', e);
    });

    // 5. Re-center window on screen if expanding from compact auth/splash size
    if (currentLogicalWidth < MAIN_SIZE.minWidth) {
      await appWindow.center().catch(() => {});
    }
  } catch (err) {
    console.warn('Tauri resizeToMainWindow error:', err);
  }
}

/**
 * Automatically persists main chat window size to localStorage when resized by user.
 */
export function trackWindowSize() {
  if (typeof window === 'undefined') return () => {};

  let timeoutId = null;
  const handleResize = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      if (window.innerWidth >= MAIN_SIZE.minWidth && window.innerHeight >= MAIN_SIZE.minHeight) {
        try {
          localStorage.setItem(
            'voys_window_size',
            JSON.stringify({ width: window.innerWidth, height: window.innerHeight })
          );
        } catch {}
      }
    }, 500);
  };

  window.addEventListener('resize', handleResize);
  return () => {
    clearTimeout(timeoutId);
    window.removeEventListener('resize', handleResize);
  };
}

/**
 * Resizes the Tauri window to the compact auth form dimensions and centers it.
 * @param {string} mode - 'login' | 'register' | 'forgot' | 'reset'
 */
export async function resizeToAuthWindow(mode = 'login') {
  if (!isTauriEnvironment()) return;
  try {
    const appWindow = getCurrentWindow();
    if (!appWindow) return;

    const height = mode === 'register' ? 580 : (mode === 'forgot' || mode === 'reset') ? 440 : 400;
    const width = 380;
    // Lower min size first so setSize can shrink the window without constraint errors
    await appWindow.setMinSize(new LogicalSize(360, 380)).catch(() => {});
    // Resize to compact auth form resolution
    await appWindow.setSize(new LogicalSize(width, height)).catch((e) => {
      console.warn('Tauri resizeToAuthWindow setSize error:', e);
    });
    // Disable resizing on login & register windows
    await appWindow.setResizable(false).catch(() => {});
    // Re-center window on screen
    await appWindow.center().catch(() => {});
  } catch (err) {
    console.warn('Tauri resizeToAuthWindow error:', err);
  }
}

/**
 * Resizes the Tauri window to the compact login dimensions (380x490) and centers it.
 */
export async function resizeToLoginWindow() {
  return resizeToAuthWindow('login');
}

/**
 * Resizes the Tauri window to the compact splash/loading dimensions (380x400) and centers it.
 */
export async function resizeToSplashWindow() {
  return resizeToAuthWindow('login');
}

/**
 * Minimizes the current application window.
 */
export async function minimizeWindow() {
  if (!isTauriEnvironment()) return;
  try {
    await getCurrentWindow().minimize();
  } catch (err) {
    console.warn('Tauri minimize error:', err);
  }
}

/**
 * Toggles maximize state of the current application window.
 */
export async function toggleMaximizeWindow() {
  if (!isTauriEnvironment()) return;
  try {
    await getCurrentWindow().toggleMaximize();
  } catch (err) {
    console.warn('Tauri toggleMaximize error:', err);
  }
}

/**
 * Closes the current application window gracefully after leaving presence.
 */
export async function closeWindow() {
  try {
    if (chatService && typeof chatService.leavePresence === 'function') {
      chatService.leavePresence();
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('beforeunload'));
    }
  } catch (err) {
    console.warn('leavePresence before close error:', err);
  }

  // Brief pause so the websocket departure broadcast packet flushes out
  await new Promise((resolve) => setTimeout(resolve, 60));

  if (isTauriEnvironment()) {
    // 1. Primary: Custom native Rust exit_app command (terminates app process immediately)
    try {
      await invoke('exit_app');
      return;
    } catch (err) {
      console.warn('Tauri exit_app error:', err);
    }

    // 2. Tauri official app plugin exit
    try {
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__?.invoke) {
        await window.__TAURI_INTERNALS__.invoke('plugin:app|exit', { code: 0 });
        return;
      }
    } catch (err) {
      console.warn('Tauri plugin:app|exit error:', err);
    }

    // 3. Tauri window destroy
    try {
      const appWindow = getCurrentWindow();
      if (typeof appWindow.destroy === 'function') {
        await appWindow.destroy();
        return;
      }
    } catch (err) {
      console.warn('Tauri destroy error:', err);
    }

    // 4. Tauri window close
    try {
      const appWindow = getCurrentWindow();
      await appWindow.close();
    } catch (err) {
      console.warn('Tauri close error:', err);
    }
  }

  // 5. Native WebView2 / browser close fallback
  // In WRY on Windows (Tauri WebView2), calling window.close() triggers Win32 DestroyWindow(hwnd)
  try {
    if (typeof window !== 'undefined' && typeof window.close === 'function') {
      window.close();
    }
  } catch (err) {
    console.warn('window.close fallback error:', err);
  }

  // 6. Fallback for legacy 1.0.0 binaries without native exit_app command:
  // Minimizes the window to the taskbar so it never stays stuck on the user's screen
  if (isTauriEnvironment()) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.minimize();
    } catch { }
  }
}

/**
 * Registers graceful departure handler when the user requests window close (e.g. via Alt+F4 or system close).
 */
export async function setupWindowCloseHandler() {
  const handleUnload = () => {
    try {
      if (chatService && typeof chatService.leavePresence === 'function') {
        chatService.leavePresence();
      }
    } catch { }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleUnload);
  }

  return () => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleUnload);
    }
  };
}

/**
 * Ensures native window effects don't conflict with permanent glassmorphism transparency.
 * Native Windows Acrylic automatically forces windows to turn opaque/solid when losing focus.
 * By clearing DWM effects and relying on transparent window rendering, the glass effect
 * stays permanently consistent regardless of window focus state.
 * @param {number} opacityPercent - Number between 25 and 100
 */
export async function applyWindowTransparency(opacityPercent = 100) {
  if (!isTauriEnvironment()) return;
  try {
    const appWindow = getCurrentWindow();
    if (typeof appWindow.clearEffects === 'function') {
      await appWindow.clearEffects().catch(() => { });
    }
  } catch (err) {
    console.warn('Tauri applyWindowTransparency warning:', err);
  }
}

/**
 * Detects currently running game or active game window via Tauri backend.
 * Returns game title string (e.g. "Counter-Strike 2") or null if none detected.
 */
export async function detectRunningGame() {
  if (!isTauriEnvironment()) return null;
  try {
    // Prefer window.__TAURI_INTERNALS__.invoke if available directly (instant, zero-overhead)
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__?.invoke) {
      const result = await window.__TAURI_INTERNALS__.invoke('detect_running_game');
      return result || null;
    }
    const result = await invoke('detect_running_game');
    return result || null;
  } catch (err) {
    console.warn('detectRunningGame error:', err);
    return null;
  }
}

/**
 * Opens an external internet URL in the user's default browser.
 * Uses native Tauri process execution on desktop and standard window.open on web.
 * @param {string} rawUrl - Target URL (e.g. "https://example.com" or "www.example.com")
 */
export async function openExternalUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return;
  const trimmed = rawUrl.trim();
  if (!trimmed) return;

  const targetUrl = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  // 1. Primary for Tauri: Official Tauri v2 Opener plugin + native fallback
  if (isTauriEnvironment()) {
    try {
      const { openUrl } = await import('@tauri-apps/plugin-opener');
      await openUrl(targetUrl);
      return;
    } catch (err) {
      console.warn('Tauri plugin-opener warning, trying fallback:', err);
    }

    try {
      const invokeFn =
        (typeof window !== 'undefined' && window.__TAURI_INTERNALS__?.invoke) ||
        (typeof window !== 'undefined' && window.__TAURI__?.core?.invoke) ||
        invoke;

      await invokeFn('open_external_url', { url: targetUrl });
      return;
    } catch (err) {
      console.warn('Tauri open_external_url fallback:', err);
    }
  }

  // 2. Web browser fallback: window.open
  try {
    const opened = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!opened && typeof document !== 'undefined') {
      const a = document.createElement('a');
      a.href = targetUrl;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  } catch (err) {
    console.warn('openExternalUrl fallback error:', err);
  }
}
