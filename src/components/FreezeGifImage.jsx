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
 * Internal component strictly for animated GIFs that need Canvas frame-freezing on window blur.
 */
const AnimatedGifPlayer = React.memo(({
  src,
  alt = '',
  className = '',
  style = {},
  onError,
  onLoad,
  onClick,
  loading = 'lazy',
  crossOrigin = 'anonymous',
  draggable = false,
  ...props
}) => {
  const isFocused = useWindowFocus();
  const [isFrozen, setIsFrozen] = useState(() => !isAppFocused());

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
    if (!isFocused) {
      captureFrame();
    } else {
      setIsFrozen(false);
    }
  }, [isFocused, captureFrame]);

  // If the image completes loading while the app is already unfocused, freeze immediately
  const handleLoad = useCallback((e) => {
    onLoad?.(e);
    if (!isAppFocused()) {
      captureFrame();
    }
  }, [onLoad, captureFrame]);

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
});

/**
 * FreezeGifImage
 * Renders high-performance static <img> directly for 99% of images,
 * and delegates to AnimatedGifPlayer only when an animated GIF is detected.
 */
export const FreezeGifImage = React.memo(({
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
  const isGif = isGifMedia(src, alt, '', explicitIsGif);

  // If definitely not a GIF, render standard img directly (zero hook/windowFocus overhead)
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
    <AnimatedGifPlayer
      src={src}
      alt={alt}
      className={className}
      style={style}
      onError={onError}
      onLoad={onLoad}
      onClick={onClick}
      loading={loading}
      crossOrigin={crossOrigin}
      draggable={draggable}
      {...props}
    />
  );
});

export default FreezeGifImage;
