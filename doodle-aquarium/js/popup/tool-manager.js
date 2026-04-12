export class ToolManager {
  constructor(elements, canvasManager) {
    this.elements = elements;
    this.canvasManager = canvasManager;

    this.currentTool = 'brush';
    this.currentDrawColor = '#000000';
    this.currentOpacity = 1.0;
    this.preHoverColor = null;

    this.setupListeners();
  }

  setupListeners() {
    this.elements.toolButtons.forEach(btn => {
      btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });

    this.elements.brushSize.addEventListener('input', () => {
      this.elements.brushSizeDisplay.textContent = `${this.elements.brushSize.value}px`;
      this.updateBrushPreview();
    });

    this.elements.brushOpacity.addEventListener('input', () => {
      this.currentOpacity = Number(this.elements.brushOpacity.value) / 100;
      this.elements.brushOpacityDisplay.textContent = `${this.elements.brushOpacity.value}%`;
      this.applyColorInput(this.currentDrawColor, true);
    });

    this.elements.colorPicker.addEventListener('input', () => {
      this.applyColorInput(this.elements.colorPicker.value, true);
    });

    this.elements.colorText.addEventListener('change', () => {
      this.applyColorInput(this.elements.colorText.value);
    });

    this.elements.colorText.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.applyColorInput(this.elements.colorText.value);
      }
    });
  }

  setTool(tool) {
    if (this.currentTool === 'eyedropper' && this.preHoverColor && tool !== 'eyedropper') {
      this.applyColorInput(this.preHoverColor, true);
      this.preHoverColor = null;
    }

    this.elements.toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    this.currentTool = tool;
    this.updateBrushPreview();
    this.canvasManager.updateViewTransform();

    if (this.currentTool === 'eyedropper') {
      const hex = this.cssColorToHex(this.currentDrawColor) || '#000000';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this.preHoverColor = this.rgbaToHex8(r, g, b, this.currentOpacity);
      this.updateBrushPreview();
    }
  }

  normalizeCssColor(value) {
    const probe = document.createElement('span');
    probe.style.color = '';
    probe.style.color = value;
    return probe.style.color || null;
  }

  cssColorToHex(value) {
    const offscreen = document.createElement('canvas').getContext('2d');
    offscreen.fillStyle = '#000000';
    offscreen.fillStyle = value;
    const parsed = offscreen.fillStyle;
    if (/^#[0-9a-f]{6}$/i.test(parsed)) return parsed;
    const match = parsed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) return null;
    const toHex = (n) => Number(n).toString(16).padStart(2, '0');
    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
  }

  rgbaToHex8(r, g, b, a) {
    const hex = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
    const alpha = Math.round(a * 255);
    return `#${hex(r)}${hex(g)}${hex(b)}${hex(alpha)}`;
  }

  applyColorInput(value, silent = false, isHover = false) {
    const normalized = this.normalizeCssColor(value);
    if (!normalized) {
      this.elements.colorText.classList.add('invalid');
      if (!silent) alert('Invalid color.');
      return false;
    }

    this.elements.colorText.classList.remove('invalid');
    const hex6 = this.cssColorToHex(value);
    if (hex6) this.elements.colorPicker.value = hex6;

    let alpha = this.currentOpacity;
    const rgbaMatch = value.match(/rgba?\(.*,\s*([\d\.]+)\)/);
    if (rgbaMatch) {
      alpha = parseFloat(rgbaMatch[1]);
    } else if (value.startsWith('#') && value.length === 9) {
      alpha = parseInt(value.slice(7, 9), 16) / 255;
    }

    if (!silent && alpha !== this.currentOpacity) {
      this.currentOpacity = alpha;
      this.elements.brushOpacity.value = Math.round(alpha * 100);
      this.elements.brushOpacityDisplay.textContent = `${this.elements.brushOpacity.value}%`;
    }

    if (hex6) {
      const r = parseInt(hex6.slice(1, 3), 16);
      const g = parseInt(hex6.slice(3, 5), 16);
      const b = parseInt(hex6.slice(5, 7), 16);
      const displayAlpha = isHover ? alpha : this.currentOpacity;
      this.currentDrawColor = `rgba(${r}, ${g}, ${b}, ${displayAlpha})`;
      this.elements.colorText.value = this.rgbaToHex8(r, g, b, displayAlpha);

      if (!isHover) {
        this.currentOpacity = alpha;
        this.currentDrawColor = `rgba(${r}, ${g}, ${b}, ${this.currentOpacity})`;
      }
    } else {
      this.currentDrawColor = value;
      this.elements.colorText.value = value.toUpperCase();
    }

    this.updateBrushPreview();
    return true;
  }

  updateBrushPreview(overrideColor = null, lastMousePos = { x: 0, y: 0 }) {
    const logicalSize = this.canvasManager.getLogicalBrushSize(this.elements.brushSize.value);
    const radius = logicalSize / 2;

    const dpr = window.devicePixelRatio || 1;
    const fillCtx = this.elements.brushPreviewFill.getContext('2d');
    const outlineCtx = this.elements.brushPreviewOutline.getContext('2d');
    fillCtx.imageSmoothingEnabled = false;
    outlineCtx.imageSmoothingEnabled = false;

    if (this.currentTool === 'fill') {
      this.elements.brushPreviewFill.style.display = 'none';
      this.elements.brushPreviewOutline.style.display = 'none';
      return;
    }

    if (this.currentTool === 'eyedropper') {
      const zoomSize = 90;
      const outlineSize = 96;
      const pixelRange = 15;
      
      this.elements.brushPreviewFill.width = zoomSize * dpr;
      this.elements.brushPreviewFill.height = zoomSize * dpr;
      this.elements.brushPreviewOutline.width = outlineSize * dpr;
      this.elements.brushPreviewOutline.height = outlineSize * dpr;

      this.elements.brushPreviewFill.style.width = `${zoomSize}px`;
      this.elements.brushPreviewFill.style.height = `${zoomSize}px`;
      this.elements.brushPreviewOutline.style.width = `${outlineSize}px`;
      this.elements.brushPreviewOutline.style.height = `${outlineSize}px`;
      
      this.elements.brushPreviewFill.classList.add('eyedropper');

      const point = this.canvasManager.getCanvasPoint(lastMousePos);
      const grabX = Math.floor(point.x * dpr) - Math.floor(pixelRange / 2);
      const grabY = Math.floor(point.y * dpr) - Math.floor(pixelRange / 2);

      try {
        const imgData = this.canvasManager.ctx.getImageData(grabX, grabY, pixelRange, pixelRange);
        const tempC = document.createElement('canvas');
        tempC.width = pixelRange;
        tempC.height = pixelRange;
        tempC.getContext('2d').putImageData(imgData, 0, 0);
        
        fillCtx.clearRect(0, 0, zoomSize * dpr, zoomSize * dpr);
        fillCtx.drawImage(tempC, 0, 0, zoomSize * dpr, zoomSize * dpr);

        outlineCtx.clearRect(0, 0, outlineSize * dpr, outlineSize * dpr);
        outlineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        outlineCtx.strokeStyle = '#fff';

        // Outer circle (logical units)
        outlineCtx.beginPath();
        outlineCtx.arc(outlineSize / 2, outlineSize / 2, zoomSize / 2 + 1, 0, Math.PI * 2);
        outlineCtx.lineWidth = 3.0;
        outlineCtx.stroke();

        // Inner square reticle (inverted, logical units)
        const rectSize = zoomSize / pixelRange;
        outlineCtx.lineWidth = 1.0;
        outlineCtx.strokeRect(outlineSize / 2 - rectSize / 2, outlineSize / 2 - rectSize / 2, rectSize, rectSize);
        outlineCtx.setTransform(1, 0, 0, 1, 0, 0);
      } catch (e) {
        fillCtx.fillStyle = '#ccc';
        fillCtx.fillRect(0, 0, zoomSize * dpr, zoomSize * dpr);
      }
      return;
    }

    this.elements.brushPreviewFill.classList.remove('eyedropper');
    const boxSize = Math.max(4, Math.ceil(logicalSize)) + 4;
    this.elements.brushPreviewFill.width = boxSize * dpr;
    this.elements.brushPreviewFill.height = boxSize * dpr;
    this.elements.brushPreviewOutline.width = boxSize * dpr;
    this.elements.brushPreviewOutline.height = boxSize * dpr;

    this.elements.brushPreviewFill.style.width = `${boxSize}px`;
    this.elements.brushPreviewFill.style.height = `${boxSize}px`;
    this.elements.brushPreviewOutline.style.width = `${boxSize}px`;
    this.elements.brushPreviewOutline.style.height = `${boxSize}px`;

    fillCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    outlineCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

    fillCtx.clearRect(0, 0, boxSize, boxSize);
    outlineCtx.clearRect(0, 0, boxSize, boxSize);

    const center = boxSize / 2;

    if (this.currentTool === 'eraser' || this.currentTool === 'brush') {
      if (this.currentTool === 'brush') {
        fillCtx.beginPath();
        fillCtx.arc(center, center, radius, 0, Math.PI * 2);
        fillCtx.fillStyle = overrideColor || this.currentDrawColor;
        fillCtx.fill();
      }
      outlineCtx.beginPath();
      outlineCtx.arc(center, center, Math.max(0, radius - 1), 0, Math.PI * 2);
      outlineCtx.strokeStyle = '#fff';
      outlineCtx.lineWidth = 2.0;
      outlineCtx.stroke();
    } else {
      fillCtx.beginPath();
      fillCtx.arc(center, center, radius, 0, Math.PI * 2);
      fillCtx.fillStyle = overrideColor || this.currentDrawColor;
      fillCtx.fill();
      outlineCtx.beginPath();
      outlineCtx.arc(center, center, radius, 0, Math.PI * 2);
      outlineCtx.strokeStyle = '#fff';
      outlineCtx.lineWidth = 2.0;
      outlineCtx.stroke();
    }
    fillCtx.setTransform(1, 0, 0, 1, 0, 0);
    outlineCtx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
