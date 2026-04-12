export class CanvasManager {
  constructor(elements) {
    this.canvas = elements.canvas;
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.guideCanvas = elements.guideCanvas;
    this.guideCtx = this.guideCanvas.getContext('2d');
    this.activeCanvas = elements.activeCanvas;
    this.activeCtx = this.activeCanvas.getContext('2d');
    this.canvasTransformWrapper = elements.canvasTransformWrapper;
    this.canvasViewport = elements.canvasViewport;

    this.undoStack = [];
    this.redoStack = [];
    this.undoBtn = elements.undoBtn;
    this.redoBtn = elements.redoBtn;

    this.zoomLevel = 1.0;
    this.panX = 0;
    this.panY = 0;

    this.fillPreviewRequest = null;
    this.lastFillPoint = { x: -1, y: -1 };

    this.setupListeners();
  }

  setupListeners() {
    this.undoBtn?.addEventListener('click', () => this.performUndo());
    this.redoBtn?.addEventListener('click', () => this.performRedo());
  }

  getLogicalBrushSize(brushSizeValue) {
    const dpr = window.devicePixelRatio || 1;
    const logicalH = this.canvas.height / dpr;
    // Base height is 300.
    return Number(brushSizeValue) * (logicalH / 300);
  }

  saveState() {
    this.undoStack.push(this.canvas.toDataURL('image/png'));
    this.redoStack = []; 
    this.updateUndoRedoButtons();
  }

  updateUndoRedoButtons() {
    if (this.undoBtn) this.undoBtn.disabled = this.undoStack.length === 0;
    if (this.redoBtn) this.redoBtn.disabled = this.redoStack.length === 0;
  }

  restoreState(dataUrl) {
    const img = new Image();
    img.onload = () => {
      this.ctx.save();
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
      this.ctx.restore();
    };
    img.src = dataUrl;
  }

  performUndo() {
    if (this.undoStack.length > 0) {
      this.redoStack.push(this.canvas.toDataURL('image/png'));
      const state = this.undoStack.pop();
      this.restoreState(state);
      this.updateUndoRedoButtons();
    }
  }

  performRedo() {
    if (this.redoStack.length > 0) {
      this.undoStack.push(this.canvas.toDataURL('image/png'));
      const state = this.redoStack.pop();
      this.restoreState(state);
      this.updateUndoRedoButtons();
    }
  }

  configureContext() {
    this.ctx.lineJoin = 'round';
    this.ctx.lineCap = 'round';
    this.ctx.imageSmoothingEnabled = false;
    this.guideCtx.imageSmoothingEnabled = false;
    this.activeCtx.imageSmoothingEnabled = false;
  }

  drawDirectionGuide(width, height, dpr) {
    this.guideCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.guideCtx.clearRect(0, 0, width, height);
    this.guideCtx.save();
    this.guideCtx.translate(width / 2, height / 2);
    this.guideCtx.strokeStyle = 'rgba(123, 133, 145, 0.14)';
    this.guideCtx.lineWidth = Math.max(8, Math.min(width, height) * 0.1);
    this.guideCtx.lineCap = 'round';
    this.guideCtx.lineJoin = 'round';

    const arrowLength = Math.min(width, height) * 0.75;
    const halfLength = arrowLength / 2;
    const headSize = arrowLength * 0.30;

    this.guideCtx.beginPath();
    this.guideCtx.moveTo(-halfLength, 0);
    this.guideCtx.lineTo(halfLength, 0);
    this.guideCtx.moveTo(halfLength - headSize, -headSize * 0.75);
    this.guideCtx.lineTo(halfLength, 0);
    this.guideCtx.lineTo(halfLength - headSize, headSize * 0.75);
    this.guideCtx.stroke();
    this.guideCtx.restore();
  }

  setCanvasSize(cssWidth, cssHeight, preserveDrawing) {
    const width = Math.max(1, Math.floor(cssWidth));
    const height = Math.max(1, Math.floor(cssHeight));
    const dpr = window.devicePixelRatio || 1;
    const snapshot = preserveDrawing ? this.canvas.toDataURL('image/png') : null;

    [this.canvas, this.activeCanvas, this.guideCanvas].forEach(c => {
      c.style.width = `${width}px`;
      c.style.height = `${height}px`;
      c.width = Math.floor(width * dpr);
      c.height = Math.floor(height * dpr);
    });

    const canvasSurface = document.getElementById('canvas-surface');
    if (canvasSurface) {
      canvasSurface.style.width = `${width}px`;
      canvasSurface.style.height = `${height}px`;
    }

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.guideCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.configureContext();
    this.drawDirectionGuide(width, height, dpr);

    if (snapshot) {
      const redraw = new Image();
      redraw.onload = () => {
        this.ctx.drawImage(redraw, 0, 0, width, height);
      };
      redraw.src = snapshot;
    }
  }

  updateViewTransform() {
    if (this.canvasTransformWrapper) {
      this.canvasTransformWrapper.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoomLevel})`;
    }
  }

  getCanvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    const logicalW = Math.max(1, Number(this.canvas.style.width.replace('px', '')));
    const logicalH = Math.max(1, Number(this.canvas.style.height.replace('px', '')));
    const x = (event.clientX - rect.left) * (logicalW / rect.width);
    const y = (event.clientY - rect.top) * (logicalH / rect.height);
    return { x, y };
  }

  clearCanvas() {
    this.saveState();
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  drawStamp(x, y, diameter) {
    const radius = Math.max(0.5, diameter / 2);
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  drawInterpolatedStroke(fromX, fromY, toX, toY, tool, diameter, color) {
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    const spacing = Math.max(1, diameter * 0.2);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    if (tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.fillStyle = '#000';
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.fillStyle = color;
    }

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + dx * t;
      const y = fromY + dy * t;
      this.drawStamp(x, y, diameter);
    }

    this.ctx.globalCompositeOperation = 'source-over';
  }

  floodFill(startX, startY, fillColorHex, opacity) {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    const width = this.canvas.width;
    const height = this.canvas.height;

    const sx = Math.floor(startX);
    const sy = Math.floor(startY);

    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

    const startIndex = (sy * width + sx) * 4;
    const startR = data[startIndex];
    const startG = data[startIndex + 1];
    const startB = data[startIndex + 2];
    const startA = data[startIndex + 3];

    // Simple hex to rgba (since we don't have a shared util for this yet, or we'll just parse it here)
    const hexToRgbaLocal = (hex) => {
      let c;
      if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
        c = hex.substring(1).split('');
        if (c.length == 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
        c = '0x' + c.join('');
        return [(c >> 16) & 255, (c >> 8) & 255, c & 255, Math.round(opacity * 255)];
      }
      return [0, 0, 0, Math.round(opacity * 255)];
    };

    const fillRgba = hexToRgbaLocal(fillColorHex);
    const tolerance = 20;

    const matchStartColor = (index) => {
      return Math.abs(data[index] - startR) <= tolerance &&
        Math.abs(data[index + 1] - startG) <= tolerance &&
        Math.abs(data[index + 2] - startB) <= tolerance &&
        Math.abs(data[index + 3] - startA) <= tolerance;
    };

    const fillMask = new Uint8Array(width * height);
    const pixelStack = [[sx, sy]];

    while (pixelStack.length > 0) {
      const newPos = pixelStack.pop();
      const x = newPos[0];
      let y = newPos[1];

      let pixelPos = (y * width + x) * 4;
      while (y-- >= 0 && matchStartColor(pixelPos) && !fillMask[pixelPos / 4]) {
        pixelPos -= width * 4;
      }
      pixelPos += width * 4;
      ++y;

      let reachLeft = false;
      let reachRight = false;

      while (y++ < height - 1 && matchStartColor(pixelPos) && !fillMask[pixelPos / 4]) {
        fillMask[pixelPos / 4] = 1;

        if (x > 0) {
          if (matchStartColor(pixelPos - 4) && !fillMask[(pixelPos - 4) / 4]) {
            if (!reachLeft) {
              pixelStack.push([x - 1, y]);
              reachLeft = true;
            }
          } else if (reachLeft) reachLeft = false;
        }

        if (x < width - 1) {
          if (matchStartColor(pixelPos + 4) && !fillMask[(pixelPos + 4) / 4]) {
            if (!reachRight) {
              pixelStack.push([x + 1, y]);
              reachRight = true;
            }
          } else if (reachRight) reachRight = false;
        }

        pixelPos += width * 4;
      }
    }

    // Dilate
    let dilatedMask = new Uint8Array(fillMask);
    const nextMask = new Uint8Array(dilatedMask);
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        let i = dy * width + dx;
        if (dilatedMask[i]) {
          if (dx > 0) nextMask[i - 1] = 1;
          if (dx < width - 1) nextMask[i + 1] = 1;
          if (dy > 0) nextMask[i - width] = 1;
          if (dy < height - 1) nextMask[i + width] = 1;
        }
      }
    }
    dilatedMask = nextMask;

    const srcA = fillRgba[3] / 255;
    for (let i = 0; i < dilatedMask.length; i++) {
      if (dilatedMask[i]) {
        const ptr = i * 4;
        const dstA = data[ptr + 3] / 255;
        const outA = srcA + dstA * (1 - srcA);
        if (outA > 0) {
          data[ptr] = Math.round((fillRgba[0] * srcA + data[ptr] * dstA * (1 - srcA)) / outA);
          data[ptr + 1] = Math.round((fillRgba[1] * srcA + data[ptr + 1] * dstA * (1 - srcA)) / outA);
          data[ptr + 2] = Math.round((fillRgba[2] * srcA + data[ptr + 2] * dstA * (1 - srcA)) / outA);
          data[ptr + 3] = Math.round(outA * 255);
        }
      }
    }

    this.ctx.putImageData(imageData, 0, 0);
  }

  updateFillPreview(startX, startY, currentDrawColor, currentOpacity, cssColorToHex) {
    if (this.fillPreviewRequest) return;

    const dx = startX - this.lastFillPoint.x;
    const dy = startY - this.lastFillPoint.y;
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && this.lastFillPoint.color === currentDrawColor) return;

    this.fillPreviewRequest = requestAnimationFrame(() => {
      this.fillPreviewRequest = null;
      this.lastFillPoint = { x: startX, y: startY, color: currentDrawColor };

      const dpr = window.devicePixelRatio || 1;
      const width = this.canvas.width;
      const height = this.canvas.height;
      const imageData = this.ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const sx = Math.floor(startX * dpr);
      const sy = Math.floor(startY * dpr);

      if (sx < 0 || sx >= width || sy < 0 || sy >= height) {
        this.activeCtx.clearRect(0, 0, this.activeCanvas.width / dpr, this.activeCanvas.height / dpr);
        return;
      }

      const startIndex = (sy * width + sx) * 4;
      const startR = data[startIndex];
      const startG = data[startIndex + 1];
      const startB = data[startIndex + 2];
      const startA = data[startIndex + 3];

      const hexToRgbaLocal = (hex) => {
        let c;
        if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
          c = hex.substring(1).split('');
          if (c.length == 3) c = [c[0], c[0], c[1], c[1], c[2], c[2]];
          c = '0x' + c.join('');
          return [(c >> 16) & 255, (c >> 8) & 255, c & 255, Math.round(currentOpacity * 255)];
        }
        return [0, 0, 0, Math.round(currentOpacity * 255)];
      };

      const fillRgba = hexToRgbaLocal(cssColorToHex(currentDrawColor) || currentDrawColor);
      const previewA = Math.round(currentOpacity * 128);
      const tolerance = 20;

      const matchStartColor = (index) => {
        return Math.abs(data[index] - startR) <= tolerance &&
          Math.abs(data[index + 1] - startG) <= tolerance &&
          Math.abs(data[index + 2] - startB) <= tolerance &&
          Math.abs(data[index + 3] - startA) <= tolerance;
      };

      const fillMask = new Uint8Array(width * height);
      const pixelStack = [[sx, sy]];

      while (pixelStack.length > 0) {
        const newPos = pixelStack.pop();
        const x = newPos[0];
        let y = newPos[1];
        let pixelPos = (y * width + x) * 4;
        while (y-- >= 0 && matchStartColor(pixelPos) && !fillMask[pixelPos / 4]) {
          pixelPos -= width * 4;
        }
        pixelPos += width * 4;
        ++y;
        let reachLeft = false;
        let reachRight = false;
        while (y++ < height - 1 && matchStartColor(pixelPos) && !fillMask[pixelPos / 4]) {
          fillMask[pixelPos / 4] = 1;
          if (x > 0) {
            if (matchStartColor(pixelPos - 4)) {
              if (!reachLeft) { pixelStack.push([x - 1, y]); reachLeft = true; }
            } else if (reachLeft) reachLeft = false;
          }
          if (x < width - 1) {
            if (matchStartColor(pixelPos + 4)) {
              if (!reachRight) { pixelStack.push([x + 1, y]); reachRight = true; }
            } else if (reachRight) reachRight = false;
          }
          pixelPos += width * 4;
        }
      }

      const previewData = this.activeCtx.createImageData(width, height);
      const pData = previewData.data;
      for (let i = 0; i < fillMask.length; i++) {
        if (fillMask[i]) {
          const ptr = i * 4;
          pData[ptr] = fillRgba[0];
          pData[ptr + 1] = fillRgba[1];
          pData[ptr + 2] = fillRgba[2];
          pData[ptr + 3] = previewA;
        }
      }
      this.activeCtx.clearRect(0, 0, this.activeCanvas.width / dpr, this.activeCanvas.height / dpr);
      this.activeCtx.putImageData(previewData, 0, 0);
    });
  }

  flipCanvas(horizontal = false, vertical = false) {
    if (!horizontal && !vertical) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(this.canvas, 0, 0);

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, w, h);
    if (horizontal) {
      this.ctx.translate(w, 0);
      this.ctx.scale(-1, 1);
    }
    if (vertical) {
      this.ctx.translate(0, h);
      this.ctx.scale(1, -1);
    }
    this.ctx.drawImage(tempCanvas, 0, 0);
    this.ctx.restore();
  }

  isCanvasBlank() {
    const pixelBuffer = new Uint32Array(
      this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  }
}
