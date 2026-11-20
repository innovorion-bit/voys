import { invoke } from '@tauri-apps/api/core';

// Utility to manage taskbar / app badges across Windows PWA, Browser tabs, and Tauri

let originalFaviconHref = null;
let cachedBaseImage = null;
let isImageLoading = false;

function getFaviconLink() {
  if (typeof document === 'undefined') return null;
  return (
    document.querySelector("link[rel*='icon']") ||
    document.querySelector("link[rel='shortcut icon']")
  );
}

function drawRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

// Preload original favicon
function ensureBaseImage(callback) {
  if (cachedBaseImage) {
    callback(cachedBaseImage);
    return;
  }
  if (isImageLoading) return;
  isImageLoading = true;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = originalFaviconHref || '/voys_logo.png';
  img.onload = () => {
    cachedBaseImage = img;
    isImageLoading = false;
    callback(img);
  };
  img.onerror = () => {
    isImageLoading = false;
  };
}

/**
 * Updates dynamic favicon badge on a canvas
 */
function updateFaviconBadge(count) {
  if (typeof document === 'undefined') return;

  const link = getFaviconLink();
  if (!link) return;

  if (!originalFaviconHref) {
    originalFaviconHref = link.href || '/voys_logo.png';
  }

  if (count <= 0) {
    if (link.href !== originalFaviconHref) {
      link.href = originalFaviconHref;
    }
    return;
  }

  ensureBaseImage((baseImg) => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw base app icon
      ctx.drawImage(baseImg, 0, 0, 64, 64);

      // Draw notification badge circle (Voys purple #8B51FF)
      const badgeText = count > 99 ? '99+' : String(count);
      const isWide = badgeText.length > 2;
      const badgeWidth = isWide ? 40 : (badgeText.length > 1 ? 32 : 28);
      const badgeHeight = 28;
      const x = 64 - badgeWidth - 1;
      const y = 1;
      const radius = 14;

      ctx.save();
      drawRoundedRect(ctx, x, y, badgeWidth, badgeHeight, radius);
      ctx.fillStyle = '#8B51FF';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      ctx.fill();

      // Outer border for readability against any background
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#08080a';
      ctx.stroke();
      ctx.restore();

      // Badge text
      ctx.save();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = `bold ${isWide ? '14px' : '16px'} -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const textX = x + badgeWidth / 2;
      const textY = y + badgeHeight / 2 + 1;
      ctx.fillText(badgeText, textX, textY);
      ctx.restore();

      link.href = canvas.toDataURL('image/png');
    } catch {}
  });
}

/**
 * Updates application taskbar & title badge across all environments
 * @param {number} count Total unread message count
 */
export function updateAppBadge(count) {
  const safeCount = Math.max(0, Number(count) || 0);

  // 1. W3C Badging API (Windows 10/11 PWA, Edge, Chrome)
  if (typeof navigator !== 'undefined') {
    if (safeCount > 0) {
      if ('setAppBadge' in navigator && typeof navigator.setAppBadge === 'function') {
        navigator.setAppBadge(safeCount).catch(() => {});
      }
    } else {
      if ('clearAppBadge' in navigator && typeof navigator.clearAppBadge === 'function') {
        navigator.clearAppBadge().catch(() => {});
      }
    }
  }

  // 2. Document Title (reflects in taskbar preview and browser tab)
  if (typeof document !== 'undefined') {
    const rawTitle = document.title || 'Voys';
    const cleanTitle = rawTitle.replace(/^\(\d+\+?\)\s*/, '');
    if (safeCount > 0) {
      const badgeText = safeCount > 99 ? '99+' : safeCount;
      document.title = `(${badgeText}) ${cleanTitle || 'Voys'}`;
    } else {
      document.title = cleanTitle || 'Voys';
    }
  }

  // 3. Dynamic Favicon badge
  updateFaviconBadge(safeCount);

  // 4. Tauri Desktop App support
  if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
    try {
      invoke('set_app_badge', { count: safeCount > 0 ? safeCount : null }).catch(() => {});
    } catch {}
  }
}
