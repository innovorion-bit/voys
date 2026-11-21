import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWindowFocus, isAppFocused } from '../utils/windowFocus';

/**
 * Checks whether a URL, filename, or type indicates an animated GIF.
 */
export function isGifMedia(url = '', name = '', type = '', isGifExplicit = false) {
  if (isGifExplicit) return true;
  const cleanUrl = String(url || '').toLowerCase();
  const cleanName = String(name || '').toLowerCase();
  const cleanType = String(type || '').toLowerCase();

  return Boolean(
    cleanType === 'image/gif' ||
    cleanType.includes('gif') ||
    cleanName.endsWith('.gif') ||
    cleanUrl.includes('.gif') ||
    cleanUrl.includes('giphy.com') ||
    cleanUrl.includes('tenor.com') ||
    cleanUrl.includes('/giphy/') ||
    cleanUrl.includes('/tenor/')
  );
}

/**
 * FreezeGifImage
 * Renders an image that plays normally when the Voys window is focused,
 * and freezes onto its exact current frame via HTML5 Canvas when the window loses focus
 * (unfocused, alt-tabbed, minimized, or in background).
 */
export const FreezeGifImage = ({
  src,
  alt = '',
  className = '',
  style = {},
  isGif: explicitIsGif = false,
  onError,
  onLoad,
  onClick,
  loading = 'lazy',
  crossOrigin = 'anonymous',
  draggable = false,
  ...props
}) => {
  const isFocused = useWindowFocus();
  const isGif = isGifMedia(src, alt, '', explicitIsGif);
  const [isFrozen, setIsFrozen] = useState(() => !isAppFocused() && isGif);

  const imgRef = useRef(null);
  const canvasRef = useRef(null);

  // Capture current GIF frame onto canvas
  const captureFrame = useCallback(() => {
    const img = imgRef.current;
    const canvas = canvasRef.current;
    if (!img || !canvas) return;

    if (img.complete && img.naturalWidth > 0) {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setIsFrozen(true);
        } catch (err) {
          console.debug('[FreezeGifImage] Frame capture notice:', err);
        }
      }
    }
  }, []);

  // Synchronize freeze state with window focus
  useEffect(() => {
    if (!isGif) {
      setIsFrozen(false);
      return;
    }

    if (!isFocused) {
      captureFrame();
    } else {
      setIsFrozen(false);
    }
  }, [isFocused, isGif, captureFrame]);

  // If the image completes loading while the app is already unfocused, freeze immediately
  const handleLoad = useCallback((e) => {
    onLoad?.(e);
    if (!isAppFocused() && isGif) {
      captureFrame();
    }
  }, [onLoad, isGif, captureFrame]);

  // If definitely not a GIF, render standard img directly
  if (!isGif) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        style={style}
        onError={onError}
        onLoad={onLoad}
        onClick={onClick}
        loading={loading}
        draggable={draggable}
        {...props}
      />
    );
  }

  return (
    <>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        data-freeze-managed="true"
        crossOrigin={crossOrigin}
        className={`${className} ${isFrozen ? 'hidden' : 'block'}`}
        style={{
          ...style,
          display: isFrozen ? 'none' : (style?.display || undefined)
        }}
        onError={onError}
        onLoad={handleLoad}
        onClick={onClick}
        loading={loading}
        draggable={draggable}
        {...props}
      />
      <canvas
        ref={canvasRef}
        aria-label={alt}
        data-freeze-canvas="true"
        onClick={onClick}
        className={`${className} ${!isFrozen ? 'hidden' : 'block'} select-none`}
        style={{
          ...style,
          display: !isFrozen ? 'none' : (style?.display || undefined)
        }}
      />
    </>
  );
};

export default FreezeGifImage;
