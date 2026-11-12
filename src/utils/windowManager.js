import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

export const LOGIN_SIZE = { width: 380, height: 400, minWidth: 360, minHeight: 380 };
export const REGISTER_SIZE = { width: 380, height: 580, minWidth: 360, minHeight: 500 };
export const MAIN_SIZE = { width: 950, height: 580, minWidth: 720, minHeight: 500 };

export function isTauriEnvironment() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

/**
 * Resizes the Tauri window to the main chat interface dimensions (950x580) and centers it.
 */
export async function resizeToMainWindow() {
  if (!isTauriEnvironment()) return;
  try {
    const appWindow = getCurrentWindow();
    // First update min size constraints for the full chat interface
    await appWindow.setMinSize(new LogicalSize(MAIN_SIZE.minWidth, MAIN_SIZE.minHeight));
    // Resize to main interface resolution
    await appWindow.setSize(new LogicalSize(MAIN_SIZE.width, MAIN_SIZE.height));
    // Re-center window on screen
    await appWindow.center();
  } catch (err) {
    console.warn('Tauri resizeToMainWindow error:', err);
  }
}

/**
 * Resizes the Tauri window to the compact auth form dimensions and centers it.
 * @param {string} mode - 'login' | 'register' | 'forgot' | 'reset'
 */
export async function resizeToAuthWindow(mode = 'login') {
  if (!isTauriEnvironment()) return;
  try {
    const appWindow = getCurrentWindow();
    const height = mode === 'register' ? 580 : (mode === 'forgot' || mode === 'reset') ? 440 : 400;
    const width = 380;
    // Lower min size first so setSize can shrink the window without constraint errors
    await appWindow.setMinSize(new LogicalSize(360, 380));
    // Resize to compact auth form resolution
    await appWindow.setSize(new LogicalSize(width, height));
    // Re-center window on screen
    await appWindow.center();
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
 * Closes the current application window.
 */
export async function closeWindow() {
  if (!isTauriEnvironment()) return;
  try {
    await getCurrentWindow().close();
  } catch (err) {
    console.warn('Tauri close error:', err);
  }
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
      await appWindow.clearEffects().catch(() => {});
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
    const { invoke } = await import('@tauri-apps/api/core');
    const result = await invoke('detect_running_game');
    return result || null;
  } catch (err) {
    console.warn('detectRunningGame error:', err);
    return null;
  }
}
