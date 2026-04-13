/**
 * Trims transparent margins from a canvas.
 * @param {HTMLCanvasElement} canvas 
 * @returns {HTMLCanvasElement} A new canvas or the original if blank.
 */
function trimCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  let minX = width, minY = height, maxX = 0, maxY = 0;
  let found = false;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
        found = true;
      }
    }
  }

  if (!found) return canvas; // Blank canvas, return as is

  const cropWidth = maxX - minX + 1;
  const cropHeight = maxY - minY + 1;
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = cropWidth;
  croppedCanvas.height = cropHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  croppedCtx.drawImage(canvas, minX, minY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
  
  return croppedCanvas;
}

/**
 * Trims transparent margins from an image source.
 * @param {HTMLImageElement} img 
 * @returns {string} Cropped DataURL.
 */
function trimImageToDataUrl(img) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth || img.width;
  canvas.height = img.naturalHeight || img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const trimmed = trimCanvas(canvas);
  return trimmed.toDataURL();
}

// For module compatibility (popup)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { trimCanvas, trimImageToDataUrl };
} else if (typeof exports !== 'undefined') {
  exports.trimCanvas = trimCanvas;
  exports.trimImageToDataUrl = trimImageToDataUrl;
}
