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

/**
 * Fallback global freezer for unmanaged GIF images in DOM.
 */
function freezeDomGifs() {
  if (typeof document === 'undefined') return;
  const imgs = document.querySelectorAll('img');
  imgs.forEach((img) => {
    if (img.getAttribute('data-freeze-managed') === 'true') return;
    const src = (img.currentSrc || img.src || '').toLowerCase();
    const isGif = src.includes('.gif') || src.includes('giphy.com') || src.includes('tenor.com') || img.getAttribute('data-gif') === 'true';
    if (!isGif) return;
    if (!img.complete || !img.naturalWidth) return;
    if (img.__voysFreezeCanvas) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.className = img.className;
      canvas.setAttribute('data-freeze-fallback', 'true');

      const computed = window.getComputedStyle(img);
      canvas.style.objectFit = computed.objectFit || 'contain';
      canvas.style.borderRadius = computed.borderRadius || '0px';

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        img.style.display = 'none';
        img.parentNode?.insertBefore(canvas, img.nextSibling);
        img.__voysFreezeCanvas = canvas;
      }
    } catch {}
  });
}

function unfreezeDomGifs() {
  if (typeof document === 'undefined') return;
  const imgs = document.querySelectorAll('img');
  imgs.forEach((img) => {
    if (img.__voysFreezeCanvas) {
      try {
        img.__voysFreezeCanvas.remove();
        img.style.display = '';
      } catch {}
      delete img.__voysFreezeCanvas;
    }
  });
}

function notifyFocusChange(isFocused) {
  if (appFocused === isFocused) return;
  appFocused = isFocused;

  // Toggle global class on root document
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('voys-window-inactive', !appFocused);
    if (!appFocused) {
      freezeDomGifs();
    } else {
      unfreezeDomGifs();
    }
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
