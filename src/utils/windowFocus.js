import { useState, useEffect } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isTauriEnvironment } from './windowManager';

/**
 * Global window focus tracker.
 * Detects whether the Voys application window is currently active / focused
 * in both Tauri desktop (Windows) and Web browser environments.
 */

let appFocused = typeof document !== 'undefined'
  ? Boolean(document.hasFocus() && !document.hidden)
  : true;

const subscribers = new Set();

function notifyFocusChange(isFocused) {
  if (appFocused === isFocused) return;
  appFocused = isFocused;

  // Toggle global class on root document (CSS handles visual pausing cleanly and safely)
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('voys-window-inactive', !appFocused);
  }

  subscribers.forEach((callback) => {
    try {
      callback(appFocused);
    } catch (err) {
      console.warn('[windowFocus] Subscriber error:', err);
    }
  });
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const syncBrowserFocus = () => {
    const active = Boolean(document.hasFocus() && !document.hidden);
    notifyFocusChange(active);
  };

  // 1. Standard web events (fire in browser and WebView2)
  window.addEventListener('focus', () => notifyFocusChange(true));
  window.addEventListener('blur', () => notifyFocusChange(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      notifyFocusChange(false);
    } else {
      syncBrowserFocus();
    }
  });

  // 2. Tauri native OS window focus events
  if (isTauriEnvironment()) {
    try {
      const appWin = getCurrentWindow();
      if (appWin && typeof appWin.onFocusChanged === 'function') {
        appWin.onFocusChanged(({ payload }) => {
          notifyFocusChange(Boolean(payload));
        }).catch(() => {});
      }
    } catch {}
  }
}

/**
 * Returns whether the application currently has main focus.
 */
export function isAppFocused() {
  if (typeof document === 'undefined') return true;
  return appFocused;
}

/**
 * Subscribes a callback to window focus changes.
 * @param {(isFocused: boolean) => void} callback
 * @returns {() => void} Unsubscribe function
 */
export function subscribeAppFocus(callback) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}

/**
 * React hook to track application focus in components.
 * @returns {boolean} True if window is focused, false if blurred/unfocused
 */
export function useWindowFocus() {
  const [isFocused, setIsFocused] = useState(isAppFocused);

  useEffect(() => {
    setIsFocused(isAppFocused());
    return subscribeAppFocus(setIsFocused);
  }, []);

  return isFocused;
}
