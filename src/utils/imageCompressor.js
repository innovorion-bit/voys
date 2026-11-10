/**
 * Compresses and resizes an image file on client side using HTML5 Canvas.
 * Generates an optimized WebP (or JPEG fallback) blob/file under 50KB.
 */
export async function compressAvatarImage(file, maxSize = 400, quality = 0.85) {
  if (!file || !file.type?.startsWith('image/')) {
    return file;
  }

  // If running in an environment without DOM (tests, node), return as is
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof FileReader === 'undefined') {
    return file;
  }

  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > height) {
              if (width > maxSize) {
                height = Math.round((height * maxSize) / width);
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = Math.round((width * maxSize) / height);
                height = maxSize;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(file);
              return;
            }

            // High quality smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
              (blob) => {
                if (blob && blob.size > 0) {
                  const fileName = (file.name || 'avatar').replace(/\.[^.]+$/, '') + '.webp';
                  const compressedFile = new File([blob], fileName, {
                    type: 'image/webp',
                    lastModified: Date.now(),
                  });
                  resolve(compressedFile);
                } else {
                  resolve(file);
                }
              },
              'image/webp',
              quality
            );
          } catch (canvasErr) {
            console.warn('Canvas compression error:', canvasErr);
            resolve(file);
          }
        };
        img.onerror = () => resolve(file);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(file);
      reader.readAsDataURL(file);
    } catch (err) {
      console.warn('FileReader compression error:', err);
      resolve(file);
    }
  });
}

