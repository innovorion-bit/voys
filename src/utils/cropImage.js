/**
 * Creates an HTMLImageElement from a URL or ObjectURL
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });

/**
 * Returns the new bounding box dimensions after rotation
 */
function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * Crops and rotates an image from source URL to a square Blob (e.g. 512x512 WebP)
 * @param {string} imageSrc - ObjectURL or DataURL
 * @param {Object} pixelCrop - { x, y, width, height } in original image pixels
 * @param {number} rotation - Rotation in degrees (default 0)
 * @param {number} outputSize - Output square resolution in px (default 512)
 * @returns {Promise<Blob>}
 */
export async function getCroppedImg(imageSrc, pixelCrop, rotation = 0, outputSize = 512) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas context could not be created');
  }

  const rotRad = getRadianAngle(rotation);

  if (rotation % 360 === 0) {
    // Simple direct crop without rotation
    canvas.width = outputSize;
    canvas.height = outputSize;

    // Enable high quality image smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputSize,
      outputSize
    );
  } else {
    // Rotated image handling
    const rotCanvas = document.createElement('canvas');
    const rotCtx = rotCanvas.getContext('2d');

    const sin = Math.abs(Math.sin(rotRad));
    const cos = Math.abs(Math.cos(rotRad));

    rotCanvas.width = image.width * cos + image.height * sin;
    rotCanvas.height = image.width * sin + image.height * cos;

    rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rotCtx.rotate(rotRad);
    rotCtx.translate(-image.width / 2, -image.height / 2);
    rotCtx.drawImage(image, 0, 0);

    canvas.width = outputSize;
    canvas.height = outputSize;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      rotCanvas,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputSize,
      outputSize
    );
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Kırpılan görsel oluşturulamadı'));
          return;
        }
        resolve(blob);
      },
      'image/webp',
      0.92
    );
  });
}
