document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isStandalone = urlParams.get('mode') === 'window';

  if (isStandalone) {
    document.body.classList.add('standalone');
  }

  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const guideCanvas = document.getElementById('direction-guide');
  const guideCtx = guideCanvas.getContext('2d');
  const activeCanvas = document.getElementById('active-stroke-canvas');
  const activeCtx = activeCanvas.getContext('2d');

  const colorPicker = document.getElementById('color-picker');
  const colorText = document.getElementById('color-text');
  const brushSize = document.getElementById('brush-size');
  const brushSizeDisplay = document.getElementById('brush-size-display');
  const brushPreviewContainer = document.getElementById('brush-preview-container');
  const brushPreviewFill = document.getElementById('brush-preview-fill');
  const brushPreviewCtx = brushPreviewFill.getContext('2d');
  const brushPreviewOutline = document.getElementById('brush-preview-outline');
  const brushPreviewOutlineCtx = brushPreviewOutline.getContext('2d');
  const brushOpacity = document.getElementById('brush-opacity');
  const brushOpacityDisplay = document.getElementById('brush-opacity-display');
  const canvasViewport = document.querySelector('.canvas-viewport');


  const toolGroup = document.getElementById('tool-group');
  const toolButtons = toolGroup.querySelectorAll('[data-tool]');

  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');
  const importFile = document.getElementById('import-file');
  const openWindowBtn = document.getElementById('open-window-btn');
  const fishList = document.getElementById('fish-list');
  const selectAllBtn = document.getElementById('select-all-btn');
  const deselectAllBtn = document.getElementById('deselect-all-btn');
  const flipHBtn = document.getElementById('flip-h-btn');
  const flipVBtn = document.getElementById('flip-v-btn');

  const settingsPanel = document.getElementById('settings-panel');
  const speedInput = document.getElementById('speed-multiplier');
  const sizeInput = document.getElementById('size-multiplier');
  const speedDisplay = document.getElementById('speed-display');
  const sizeDisplay = document.getElementById('size-display');
  const interactionType = document.getElementById('interaction-type');
  const strengthInput = document.getElementById('interaction-strength');
  const strengthDisplay = document.getElementById('strength-display');
  const resetSettingsBtn = document.getElementById('reset-settings');
  const statusEl = document.getElementById('status');

  // Modal Elements
  const fishModal = document.getElementById('fish-modal');
  const modalFishPreview = document.getElementById('modal-fish-preview');
  const modalCloseBtn = document.getElementById('close-modal');
  const modalFlipHBtn = document.getElementById('modal-flip-h-btn');
  const modalFlipVBtn = document.getElementById('modal-flip-v-btn');
  const modalLockToggle = document.getElementById('modal-lock-toggle');
  const modalActiveToggle = document.getElementById('modal-active-toggle');
  const modalEditBtn = document.getElementById('modal-edit-btn');
  const modalDeleteBtn = document.getElementById('modal-delete-btn');
  const modalExportBtn = document.getElementById('modal-export-btn');

  const DEFAULT_SETTINGS = {
    speedMultiplier: 0.5,
    sizeMultiplier: 0.5,
    interactionType: 'repel',
    interactionStrength: 1
  };

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentDrawColor = '#000000';
  let currentTool = 'brush';
  let autoSaveTimer = null;
  let applyingSettings = false;
  let isReentering = false;
  let currentOpacity = 1.0;
  let currentStrokePoints = [];
  let preHoverColor = null;

  // Zoom and Pan State
  let zoomLevel = 1.0;
  let panX = 0;
  let panY = 0;
  let isPanning = false;
  let lastMousePos = { x: 0, y: 0 };
  const canvasTransformWrapper = document.getElementById('canvas-transform-wrapper');

  let undoStack = [];
  let redoStack = [];

  const resetViewBtn = document.getElementById('reset-view-btn');

  function getLogicalBrushSize() {
    const dpr = window.devicePixelRatio || 1;
    // Current logical height of canvas (set in setCanvasSize)
    const logicalH = canvas.height / dpr;
    // Base height is 300. So size 100 = 100/300 of height.
    return Number(brushSize.value) * (logicalH / 300);
  }

  function saveState() {
    undoStack.push(canvas.toDataURL('image/png'));
    redoStack = []; // Clear redo stack on new action
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  function restoreState(dataUrl) {
    const img = new Image();
    img.onload = () => {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
    img.src = dataUrl;
  }

  function performUndo() {
    if (undoStack.length > 0) {
      redoStack.push(canvas.toDataURL('image/png'));
      const state = undoStack.pop();
      restoreState(state);
      updateUndoRedoButtons();
    }
  }

  function performRedo() {
    if (redoStack.length > 0) {
      undoStack.push(canvas.toDataURL('image/png'));
      const state = redoStack.pop();
      restoreState(state);
      updateUndoRedoButtons();
    }
  }

  undoBtn.addEventListener('click', performUndo);
  redoBtn.addEventListener('click', performRedo);

  window.addEventListener('keydown', (e) => {
    const isCtrl = e.ctrlKey || e.metaKey;
    if (isCtrl) {
      if (e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          performRedo();
        } else {
          performUndo();
        }
      } else if (e.key === 'y') {
        e.preventDefault();
        performRedo();
      }
    }
  });

  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // If we were in eyedropper mode and switching away, revert if we didn't pick
      if (currentTool === 'eyedropper' && preHoverColor && btn.dataset.tool !== 'eyedropper') {
        applyColorInput(preHoverColor, true);
        preHoverColor = null;
      }

      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;

      // If we just entered eyedropper mode, capture the current state for reversion
      if (currentTool === 'eyedropper') {
        const hex = cssColorToHex(currentDrawColor) || '#000000';
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        preHoverColor = rgbaToHex8(r, g, b, currentOpacity);
      }

      updateBrushPreview();
    });
  });

  brushSize.addEventListener('input', () => {
    brushSizeDisplay.textContent = `${brushSize.value}px`;
    updateBrushPreview();
  });

  function hexToRgba(hex) {
    let c;
    if (/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)) {
      c = hex.substring(1).split('');
      if (c.length == 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
      }
      c = '0x' + c.join('');
      return [(c >> 16) & 255, (c >> 8) & 255, c & 255, 255];
    }
    return [0, 0, 0, 255];
  }

  function floodFill(startX, startY, fillColorHex) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Pixel coordinates in actual canvas space
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);

    if (sx < 0 || sx >= width || sy < 0 || sy >= height) return;

    const startIndex = (sy * width + sx) * 4;
    const startR = data[startIndex];
    const startG = data[startIndex + 1];
    const startB = data[startIndex + 2];
    const startA = data[startIndex + 3];

    const fillRgba = hexToRgba(fillColorHex);

    // If colors are the same, don't fill
    if (startR === fillRgba[0] && startG === fillRgba[1] && startB === fillRgba[2] && startA === fillRgba[3]) {
      return;
    }

    // Add color tolerance to fill into anti-aliased gaps
    const tolerance = 20;

    const matchStartColor = (index) => {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const a = data[index + 3];

      // Compare RGB and A with tolerance
      return Math.abs(r - startR) <= tolerance &&
        Math.abs(g - startG) <= tolerance &&
        Math.abs(b - startB) <= tolerance &&
        Math.abs(a - startA) <= tolerance;
    };

    const fillMask = new Uint8Array(width * height);

    const setMask = (index) => {
      fillMask[index / 4] = 1;
    };

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
        setMask(pixelPos);

        if (x > 0) {
          if (matchStartColor(pixelPos - 4) && !fillMask[(pixelPos - 4) / 4]) {
            if (!reachLeft) {
              pixelStack.push([x - 1, y]);
              reachLeft = true;
            }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }

        if (x < width - 1) {
          if (matchStartColor(pixelPos + 4) && !fillMask[(pixelPos + 4) / 4]) {
            if (!reachRight) {
              pixelStack.push([x + 1, y]);
              reachRight = true;
            }
          } else if (reachRight) {
            reachRight = false;
          }
        }

        pixelPos += width * 4;
      }
    }

    // Dilate the mask by 1 pixel to overlap with thin antialiased borders
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

    for (let i = 0; i < dilatedMask.length; i++) {
      if (dilatedMask[i]) {
        const ptr = i * 4;
        data[ptr] = fillRgba[0];
        data[ptr + 1] = fillRgba[1];
        data[ptr + 2] = fillRgba[2];
        data[ptr + 3] = 255;
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // Keep drawing coordinates in CSS pixels while rendering crisply on high DPI screens.
  function configureContext() {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.imageSmoothingEnabled = true;
    guideCtx.imageSmoothingEnabled = true;
  }

  function drawDirectionGuide(width, height, dpr) {
    guideCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    guideCtx.clearRect(0, 0, width, height);
    guideCtx.save();
    guideCtx.translate(width / 2, height / 2);
    guideCtx.strokeStyle = 'rgba(123, 133, 145, 0.14)';
    guideCtx.lineWidth = Math.max(8, Math.min(width, height) * 0.1);
    guideCtx.lineCap = 'round';
    guideCtx.lineJoin = 'round';

    const arrowLength = Math.min(width, height) * 0.75;
    const halfLength = arrowLength / 2;
    const headSize = arrowLength * 0.30;

    guideCtx.beginPath();
    guideCtx.moveTo(-halfLength, 0);
    guideCtx.lineTo(halfLength, 0);
    guideCtx.moveTo(halfLength - headSize, -headSize * 0.75);
    guideCtx.lineTo(halfLength, 0);
    guideCtx.lineTo(halfLength - headSize, headSize * 0.75);
    guideCtx.stroke();
    guideCtx.restore();
  }

  function clearCanvas() {
    saveState();
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
  }

  function setCanvasSize(cssWidth, cssHeight, preserveDrawing) {
    const width = Math.max(1, Math.floor(cssWidth));
    const height = Math.max(1, Math.floor(cssHeight));
    const dpr = window.devicePixelRatio || 1;
    const snapshot = preserveDrawing ? canvas.toDataURL('image/png') : null;

    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    activeCanvas.style.width = `${width}px`;
    activeCanvas.style.height = `${height}px`;
    activeCanvas.width = Math.floor(width * dpr);
    activeCanvas.height = Math.floor(height * dpr);

    guideCanvas.style.width = `${width}px`;
    guideCanvas.style.height = `${height}px`;
    guideCanvas.width = Math.floor(width * dpr);
    guideCanvas.height = Math.floor(height * dpr);

    const canvasSurface = document.getElementById('canvas-surface');
    if (canvasSurface) {
      canvasSurface.style.width = `${width}px`;
      canvasSurface.style.height = `${height}px`;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    guideCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    configureContext();

    drawDirectionGuide(width, height, dpr);

    if (snapshot) {
      const redraw = new Image();
      redraw.onload = () => {
        ctx.drawImage(redraw, 0, 0, width, height);
      };
      redraw.src = snapshot;
    }
  }

  function flipCanvas(canvasToFlip, horizontal = false, vertical = false) {
    if (!horizontal && !vertical) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvasToFlip.width;
    const h = canvasToFlip.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w;
    tempCanvas.height = h;
    const tempCtx = tempCanvas.getContext('2d');

    // Copy current state
    tempCtx.drawImage(canvasToFlip, 0, 0);

    const ctxToFlip = canvasToFlip.getContext('2d');
    ctxToFlip.save();
    ctxToFlip.setTransform(1, 0, 0, 1, 0, 0);
    ctxToFlip.clearRect(0, 0, w, h);

    if (horizontal) {
      ctxToFlip.translate(w, 0);
      ctxToFlip.scale(-1, 1);
    }
    if (vertical) {
      ctxToFlip.translate(0, h);
      ctxToFlip.scale(1, -1);
    }

    ctxToFlip.drawImage(tempCanvas, 0, 0);
    ctxToFlip.restore();
  }

  function updateViewTransform() {
    if (canvasTransformWrapper) {
      canvasTransformWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
    // Update brush preview scale to match zoom for brush but NOT for eyedropper
    if (brushPreviewFill) {
      const transform = currentTool === 'eyedropper' ? '' : `scale(${zoomLevel})`;
      brushPreviewFill.style.transform = transform;
      brushPreviewOutline.style.transform = transform;
    }
  }

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const logicalW = Math.max(1, Number(canvas.style.width.replace('px', '')));
    const logicalH = Math.max(1, Number(canvas.style.height.replace('px', '')));

    // getBoundingClientRect reflects visual screen size (including transform)
    // So ratio of logical size to visual size tells us how to map the offset.
    const x = (event.clientX - rect.left) * (logicalW / rect.width);
    const y = (event.clientY - rect.top) * (logicalH / rect.height);

    return { x, y };
  }

  function drawStamp(x, y, diameter) {
    const radius = Math.max(0.5, diameter / 2);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawInterpolatedStroke(fromX, fromY, toX, toY) {
    const diameter = getLogicalBrushSize();
    const dx = toX - fromX;
    const dy = toY - fromY;
    const distance = Math.hypot(dx, dy);
    const spacing = Math.max(1, diameter * 0.2);
    const steps = Math.max(1, Math.ceil(distance / spacing));

    if (currentTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000'; // Color doesn't matter for destination-out, it just removes alpha
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = currentDrawColor;
    }

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + dx * t;
      const y = fromY + dy * t;
      drawStamp(x, y, diameter);
    }

    ctx.globalCompositeOperation = 'source-over'; // restore
  }

  function resizeCanvasForViewport() {
    const isStandaloneDesktop = isStandalone && window.innerWidth >= 750;
    const sidebarWidth = isStandaloneDesktop ? 420 : 0;
    const padding = isStandaloneDesktop ? 40 : 32;

    // Dynamic canvas based on window innerWidth.
    const w = window.innerWidth - sidebarWidth - padding;
    // Cap dimensions for standalone and popup
    const maxW = isStandalone ? Math.min(w, 850) : Math.min(w, 800);
    const maxH = maxW * 0.75;

    const rect = canvas.getBoundingClientRect();
    if (Math.round(rect.width) !== maxW || Math.round(rect.height) !== maxH) {
      setCanvasSize(maxW, maxH, true);
    }
  }

  function normalizeCssColor(value) {
    const probe = document.createElement('span');
    probe.style.color = '';
    probe.style.color = value;
    return probe.style.color || null;
  }

  function cssColorToHex(value) {
    const offscreen = document.createElement('canvas').getContext('2d');
    offscreen.fillStyle = '#000000';
    offscreen.fillStyle = value;
    const parsed = offscreen.fillStyle;

    if (/^#[0-9a-f]{6}$/i.test(parsed)) {
      return parsed;
    }

    const match = parsed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (!match) {
      return null;
    }

    const toHex = (n) => Number(n).toString(16).padStart(2, '0');
    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
  }

  function rgbaToHex8(r, g, b, a) {
    const hex = (n) => Math.round(n).toString(16).padStart(2, '0').toUpperCase();
    const alpha = Math.round(a * 255);
    return `#${hex(r)}${hex(g)}${hex(b)}${hex(alpha)}`;
  }

  function applyColorInput(value, silent = false, isHover = false) {
    const normalized = normalizeCssColor(value);
    if (!normalized) {
      colorText.classList.add('invalid');
      if (!silent) {
        alert('Invalid color. Use any valid CSS color (hex, rgb, hsl, or named color).');
      }
      return false;
    }

    colorText.classList.remove('invalid');

    // Parse the input color. If it has alpha and we are not 'silent' (user typed it), update global opacity.
    const hex6 = cssColorToHex(value);
    if (hex6) {
      colorPicker.value = hex6;
    }

    // Try to extract alpha from rgba or 8-digit hex
    let alpha = currentOpacity;
    const rgbaMatch = value.match(/rgba?\(.*,\s*([\d\.]+)\)/);
    if (rgbaMatch) {
      alpha = parseFloat(rgbaMatch[1]);
    } else if (value.startsWith('#') && value.length === 9) {
      alpha = parseInt(value.slice(7, 9), 16) / 255;
    }

    if (!silent && alpha !== currentOpacity) {
      currentOpacity = alpha;
      brushOpacity.value = Math.round(alpha * 100);
      brushOpacityDisplay.textContent = `${brushOpacity.value}%`;
    }

    // Build the canonical currentDrawColor as rgba
    if (hex6) {
      const r = parseInt(hex6.slice(1, 3), 16);
      const g = parseInt(hex6.slice(3, 5), 16);
      const b = parseInt(hex6.slice(5, 7), 16);
      currentDrawColor = `rgba(${r}, ${g}, ${b}, ${currentOpacity})`;
      colorText.value = rgbaToHex8(r, g, b, currentOpacity);
    } else {
      currentDrawColor = value; // Fallback
      colorText.value = value.toUpperCase();
    }

    if (!isHover) {
      // Auto-switch to brush tool
      currentTool = 'brush';
      toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === 'brush'));
    }

    updateBrushPreview();
    return true;
  }

  function updateBrushPreview(overrideColor = null) {
    const logicalSize = getLogicalBrushSize();
    const radius = logicalSize / 2;

    if (currentTool === 'fill') {
      brushPreview.style.display = 'none';
      return;
    }

    if (currentTool === 'eyedropper') {
      const zoomSize = 80; // Size of the zoom bubble
      const pixelRange = 9; // Number of pixels to show
      brushPreviewFill.width = zoomSize;
      brushPreviewFill.height = zoomSize;
      brushPreviewFill.style.width = `${zoomSize}px`;
      brushPreviewFill.style.height = `${zoomSize}px`;

      brushPreviewFill.classList.add('eyedropper');

      const point = getCanvasPoint({ clientX: lastMousePos.x, clientY: lastMousePos.y });
      const dpr = window.devicePixelRatio || 1;

      const grabX = Math.floor(point.x * dpr) - Math.floor(pixelRange / 2);
      const grabY = Math.floor(point.y * dpr) - Math.floor(pixelRange / 2);

      try {
        const imgData = ctx.getImageData(grabX, grabY, pixelRange, pixelRange);

        // Draw to preview with pixelated scaling
        brushPreviewCtx.imageSmoothingEnabled = false;

        // Create a temp canvas to hold the ImageData (easiest way to scale it up)
        const tempC = document.createElement('canvas');
        tempC.width = pixelRange;
        tempC.height = pixelRange;
        tempC.getContext('2d').putImageData(imgData, 0, 0);

        brushPreviewCtx.clearRect(0, 0, zoomSize, zoomSize);
        brushPreviewCtx.drawImage(tempC, 0, 0, zoomSize, zoomSize);

        // Draw crosshair
        brushPreviewCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        brushPreviewCtx.lineWidth = 2;
        brushPreviewCtx.strokeRect(zoomSize / 2 - 4, zoomSize / 2 - 4, 8, 8);
        brushPreviewCtx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
        brushPreviewCtx.lineWidth = 1;
        brushPreviewCtx.strokeRect(zoomSize / 2 - 4, zoomSize / 2 - 4, 8, 8);
      } catch (e) {
        // Fallback for out of bounds
        brushPreviewCtx.fillStyle = '#ccc';
        brushPreviewCtx.fillRect(0, 0, zoomSize, zoomSize);
      }
      return;
    }

    brushPreviewFill.classList.remove('eyedropper');
    // Ensure the preview canvas bounds cover the full brush size plus padding for the stroke
    const boxSize = Math.max(4, Math.ceil(logicalSize)) + 4;

    brushPreviewFill.width = boxSize;
    brushPreviewFill.height = boxSize;
    brushPreviewFill.style.width = `${boxSize}px`;
    brushPreviewFill.style.height = `${boxSize}px`;

    brushPreviewOutline.width = boxSize;
    brushPreviewOutline.height = boxSize;
    brushPreviewOutline.style.width = `${boxSize}px`;
    brushPreviewOutline.style.height = `${boxSize}px`;

    brushPreviewCtx.clearRect(0, 0, boxSize, boxSize);
    brushPreviewOutlineCtx.clearRect(0, 0, boxSize, boxSize);

    const center = boxSize / 2;

    if (currentTool === 'eraser' || currentTool === 'brush') {
      // Draw Fill
      if (currentTool === 'brush') {
        brushPreviewCtx.beginPath();
        brushPreviewCtx.arc(center, center, radius, 0, Math.PI * 2);
        brushPreviewCtx.fillStyle = overrideColor || currentDrawColor;
        brushPreviewCtx.fill();
      }

      // Draw Outline (on its own canvas for resolution matching)
      brushPreviewOutlineCtx.beginPath();
      brushPreviewOutlineCtx.arc(center, center, radius - 1, 0, Math.PI * 2);

      // We draw in white because this canvas has mix-blend-mode: difference.
      // Since the Color Fill canvas is now ON TOP of this one, the outline 
      // will effectively invert only the fish/background below it.
      brushPreviewOutlineCtx.strokeStyle = '#fff';
      brushPreviewOutlineCtx.lineWidth = 1.5;
      brushPreviewOutlineCtx.stroke();
    } else {
      // Non-inverted tools (eyedropper handled early, others stay normal)
      brushPreviewCtx.beginPath();
      brushPreviewCtx.arc(center, center, radius, 0, Math.PI * 2);
      brushPreviewCtx.fillStyle = overrideColor || currentDrawColor;
      brushPreviewCtx.fill();

      // Clean static ring for secondary tools
      brushPreviewOutlineCtx.beginPath();
      brushPreviewOutlineCtx.arc(center, center, radius, 0, Math.PI * 2);
      brushPreviewOutlineCtx.strokeStyle = '#fff';
      brushPreviewOutlineCtx.lineWidth = 1.5;
      brushPreviewOutlineCtx.stroke();
    }
  }

  function setupWindowButtons() {
    if (isStandalone) {
      openWindowBtn.style.display = 'none';
    } else {
      openWindowBtn.addEventListener('click', () => {
        window.open(chrome.runtime.getURL('popup.html?mode=window'), '_blank');
      });
    }

    function updateLabels() {
      speedDisplay.textContent = Number(speedInput.value).toFixed(1);
      sizeDisplay.textContent = Number(sizeInput.value).toFixed(1);
      strengthDisplay.textContent = Number(strengthInput.value).toFixed(1);
    }

    function normalizeSettings(raw) {
      if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_SETTINGS };
      }
      const speed = Number(raw.speedMultiplier);
      const size = Number(raw.sizeMultiplier);
      const strength = Number(raw.interactionStrength);
      return {
        speedMultiplier: Number.isFinite(speed) && speed > 0 ? speed : DEFAULT_SETTINGS.speedMultiplier,
        sizeMultiplier: Number.isFinite(size) && size > 0 ? size : DEFAULT_SETTINGS.sizeMultiplier,
        interactionType: raw.interactionType === 'attract' ? 'attract' : 'repel',
        interactionStrength: Number.isFinite(strength) && strength >= 0 ? strength : DEFAULT_SETTINGS.interactionStrength
      };
    }

    function setStatus(message) {
      statusEl.textContent = message;
      if (message) {
        setTimeout(() => {
          statusEl.textContent = '';
        }, 1600);
      }
    }

    function applyToForm(settings) {
      applyingSettings = true;
      speedInput.value = settings.speedMultiplier;
      sizeInput.value = settings.sizeMultiplier;
      interactionType.value = settings.interactionType;
      strengthInput.value = settings.interactionStrength;
      updateLabels();
      applyingSettings = false;
    }

    function persistSettings(statusMessage = 'Settings saved.') {
      const settings = {
        speedMultiplier: Number(speedInput.value),
        sizeMultiplier: Number(sizeInput.value),
        interactionType: interactionType.value,
        interactionStrength: Number(strengthInput.value)
      };
      chrome.storage.local.set({ doodleSettings: settings }, () => {
        setStatus(statusMessage);
      });
    }

    function scheduleAutoSave() {
      if (applyingSettings) {
        return;
      }

      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }

      autoSaveTimer = setTimeout(() => {
        persistSettings('Settings auto-saved.');
      }, 200);
    }

    resetSettingsBtn.addEventListener('click', () => {
      applyToForm(DEFAULT_SETTINGS);
      persistSettings('Settings reset.');
    });

    speedInput.addEventListener('input', () => {
      updateLabels();
      scheduleAutoSave();
    });
    sizeInput.addEventListener('input', () => {
      updateLabels();
      scheduleAutoSave();
    });
    strengthInput.addEventListener('input', () => {
      updateLabels();
      scheduleAutoSave();
    });
    interactionType.addEventListener('change', scheduleAutoSave);

    brushOpacity.addEventListener('input', () => {
      currentOpacity = Number(brushOpacity.value) / 100;
      brushOpacityDisplay.textContent = `${brushOpacity.value}%`;
      // Update currentDrawColor with new alpha
      const hex = cssColorToHex(currentDrawColor) || '#000000';
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      currentDrawColor = `rgba(${r}, ${g}, ${b}, ${currentOpacity})`;
      colorText.value = rgbaToHex8(r, g, b, currentOpacity);
      updateBrushPreview();
    });

    chrome.storage.local.get(['doodleSettings'], (result) => {
      applyToForm(normalizeSettings(result.doodleSettings));
    });
  }

  function draw(e) {
    if (!isDrawing) return;

    const { x, y } = getCanvasPoint(e);

    if (isReentering) {
      lastX = x;
      lastY = y;
      isReentering = false;
      return;
    }

    if (currentTool === 'brush') {
      currentStrokePoints.push({ x, y });

      const dpr = window.devicePixelRatio || 1;
      activeCtx.clearRect(0, 0, activeCanvas.width / dpr, activeCanvas.height / dpr);

      activeCtx.beginPath();
      activeCtx.lineCap = 'round';
      activeCtx.lineJoin = 'round';
      activeCtx.strokeStyle = currentDrawColor;
      activeCtx.lineWidth = getLogicalBrushSize();

      activeCtx.moveTo(currentStrokePoints[0].x, currentStrokePoints[0].y);
      for (let i = 1; i < currentStrokePoints.length; i++) {
        activeCtx.lineTo(currentStrokePoints[i].x, currentStrokePoints[i].y);
      }
      activeCtx.stroke();
    } else {
      drawInterpolatedStroke(lastX, lastY, x, y);
    }

    lastX = x;
    lastY = y;
  }

  canvasViewport.oncontextmenu = (e) => e.preventDefault();

  canvasViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isCtrl) {
      // Pan vertical
      panY -= e.deltaY;
    } else if (isShift) {
      // Pan horizontal
      panX -= e.deltaY; // deltaY is usually the primary wheel axis
    } else {
      // Zoom
      const zoomSpeed = 0.001;
      const factor = Math.pow(1.1, -e.deltaY / 100);
      const newZoom = Math.max(0.2, Math.min(10, zoomLevel * factor));

      // Zoom centered on mouse
      const viewportRect = canvasTransformWrapper.parentElement.getBoundingClientRect();
      const mouseX = e.clientX - viewportRect.left;
      const mouseY = e.clientY - viewportRect.top;

      // Anchor formula for transform-origin: 0 0
      // 1. Calculate relative point in unscaled space
      const anchorX = (mouseX - panX) / zoomLevel;
      const anchorY = (mouseY - panY) / zoomLevel;

      zoomLevel = newZoom;

      // 2. Adjust pan to keep anchor fixed under mouse
      panX = mouseX - anchorX * zoomLevel;
      panY = mouseY - anchorY * zoomLevel;
    }
    updateViewTransform();
    // For eyedropper, we need to refresh preview on zoom/wheel as pixels change
    updateBrushPreview();
  });

  resetViewBtn.onclick = () => {
    zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    updateViewTransform();
  };

  canvasViewport.addEventListener('mousedown', (e) => {
    // Middle click (1) or right click (2) for panning
    if (e.button === 1 || e.button === 2) {
      isPanning = true;
      lastMousePos = { x: e.clientX, y: e.clientY };
      canvasTransformWrapper.classList.add('panning');
      brushPreview.style.display = 'none';
      e.preventDefault();
      return;
    }

    if (e.button === 0) {
      const point = getCanvasPoint(e);
      saveState();

      if (currentTool === 'eyedropper') {
        const dpr = window.devicePixelRatio || 1;
        const imgData = ctx.getImageData(point.x * dpr, point.y * dpr, 1, 1).data;
        if (imgData[3] > 0) {
          const hex8 = rgbaToHex8(imgData[0], imgData[1], imgData[2], imgData[3] / 255);
          applyColorInput(hex8);
          preHoverColor = null; // Selection confirmed
        }
        return;
      }

      if (currentTool === 'fill') {
        const dpr = window.devicePixelRatio || 1;
        floodFill(point.x * dpr, point.y * dpr, cssColorToHex(currentDrawColor) || currentDrawColor);
      } else {
        isDrawing = true;
        lastX = point.x;
        lastY = point.y;

        if (currentTool === 'brush') {
          currentStrokePoints = [{ x: point.x, y: point.y }];
          const dpr = window.devicePixelRatio || 1;
          activeCtx.clearRect(0, 0, activeCanvas.width / dpr, activeCanvas.height / dpr);

          activeCtx.beginPath();
          activeCtx.lineCap = 'round';
          activeCtx.lineJoin = 'round';
          activeCtx.strokeStyle = currentDrawColor;
          activeCtx.lineWidth = getLogicalBrushSize();

          activeCtx.moveTo(currentStrokePoints[0].x, currentStrokePoints[0].y);
          activeCtx.stroke();
        } else if (currentTool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = currentDrawColor;
        }

        if (currentTool !== 'brush') {
          drawStamp(lastX, lastY, getLogicalBrushSize());
        }
        ctx.globalCompositeOperation = 'source-over';
      }
    }
  });

  canvasViewport.addEventListener('mousemove', (e) => {
    if (isPanning) {
      const dx = e.clientX - lastMousePos.x;
      const dy = e.clientY - lastMousePos.y;
      panX += dx;
      panY += dy;
      lastMousePos = { x: e.clientX, y: e.clientY };
      updateViewTransform();
      return;
    }

    draw(e);

    const visualRect = canvasTransformWrapper.parentElement.getBoundingClientRect();
    const x = e.clientX - visualRect.left;
    const y = e.clientY - visualRect.top;

    // Calculate cursor position relative to canvas logical space
    const point = getCanvasPoint(e);
    lastMousePos = { x: e.clientX, y: e.clientY };

    const canvasRect = canvas.getBoundingClientRect();
    if (currentTool === 'eyedropper') {
      const isInside = (e.clientX >= canvasRect.left && e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top && e.clientY <= canvasRect.bottom);

      const dpr = window.devicePixelRatio || 1;
      if (isInside) {
        const imgData = ctx.getImageData(point.x * dpr, point.y * dpr, 1, 1).data;
        if (imgData[3] > 0) {
          const hex8 = rgbaToHex8(imgData[0], imgData[1], imgData[2], imgData[3] / 255);
          applyColorInput(hex8, true, true);
          const rgba = `rgba(${imgData[0]}, ${imgData[1]}, ${imgData[2]}, ${imgData[3] / 255})`;
          updateBrushPreview(rgba);
        } else {
          updateBrushPreview('rgba(255, 255, 255, 0.5)');
        }
      } else {
        updateBrushPreview('rgba(255, 255, 255, 0.2)');
      }
      brushPreviewFill.style.display = 'block';
      brushPreviewOutline.style.display = 'none';
    } else if (currentTool !== 'fill') {
      brushPreviewFill.style.display = 'block';
      brushPreviewOutline.style.display = 'block';
      updateBrushPreview();
    } else {
      brushPreviewFill.style.display = 'none';
      brushPreviewOutline.style.display = 'none';
    }

    // Position both layers
    const targetLeft = `${x - brushPreviewFill.width / 2}px`;
    const targetTop = currentTool === 'eyedropper'
      ? `${y - brushPreviewFill.height - 20}px`
      : `${y - brushPreviewFill.height / 2}px`;

    brushPreviewFill.style.left = targetLeft;
    brushPreviewFill.style.top = targetTop;
    brushPreviewOutline.style.left = targetLeft;
    brushPreviewOutline.style.top = targetTop;
  });

  canvasViewport.addEventListener('mouseenter', (e) => {
    if (isDrawing) {
      isReentering = true;
    }
  });

  canvasViewport.addEventListener('mouseleave', () => {
    brushPreviewFill.style.display = 'none';
    brushPreviewOutline.style.display = 'none';
    if (currentTool === 'eyedropper' && preHoverColor) {
      applyColorInput(preHoverColor, true, true);
      preHoverColor = null;
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (isPanning) {
      isPanning = false;
      canvasTransformWrapper.classList.remove('panning');
      return;
    }

    if (isDrawing) {
      if (currentTool === 'brush' && currentStrokePoints.length > 0) {
        // Commit stroke to main canvas
        const dpr = window.devicePixelRatio || 1;
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.drawImage(activeCanvas, 0, 0);
        ctx.restore();

        activeCtx.clearRect(0, 0, activeCanvas.width / dpr, activeCanvas.height / dpr);
        currentStrokePoints = [];
      }
      isDrawing = false;
      isReentering = false;
    }
  });

  clearBtn.addEventListener('click', () => {
    clearCanvas();
  });

  colorPicker.addEventListener('input', () => {
    applyColorInput(colorPicker.value, true);
  });

  colorText.addEventListener('change', () => {
    applyColorInput(colorText.value);
  });

  colorText.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      applyColorInput(colorText.value);
    }
  });

  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // Check if canvas is empty
  function isCanvasBlank() {
    const pixelBuffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  function normalizeFishImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(400 / img.width, 300 / img.height);
        const finalW = img.width * scale;
        const finalH = img.height * scale;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 300;
        const tempCtx = tempCanvas.getContext('2d');
        const x = (400 - finalW) / 2;
        const y = (300 - finalH) / 2;
        tempCtx.drawImage(img, x, y, finalW, finalH);

        resolve(tempCanvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = dataUrl;
    });
  }

  importFile.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const importedDataUrls = [];

    for (const file of files) {
      try {
        const sourceDataUrl = await fileToDataUrl(file);
        const normalizedDataUrl = await normalizeFishImage(sourceDataUrl);
        importedDataUrls.push(normalizedDataUrl);
      } catch (_error) {
        // Skip invalid files and continue importing remaining images.
      }
    }

    if (importedDataUrls.length > 0) {
      chrome.storage.local.get(['doodleFishList'], (result) => {
        const fishArray = result.doodleFishList || [];

        importedDataUrls.forEach((dataUrl, index) => {
          fishArray.push({
            id: `${Date.now()}-${index}`,
            dataUrl,
            mirrored: false,
            flipByVelocity: true,
            active: true
          });
        });

        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          renderFishList();
        });
      });
    }

    e.target.value = ''; // Reset so the same file(s) can be imported again
  });

  saveBtn.addEventListener('click', () => {
    if (isCanvasBlank()) {
      alert("Please draw a fish first!");
      return;
    }

    // Draw the dynamic canvas scaled into a fixed 400x300 bounding box
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400;
    tempCanvas.height = 300;
    const tempCtx = tempCanvas.getContext('2d');

    // Scale canvas into 400x300 while preserving aspect ratio and centering
    const currentW = Number(canvas.style.width.replace('px', ''));
    const currentH = Number(canvas.style.height.replace('px', ''));
    const scale = Math.min(400 / currentW, 300 / currentH);
    const sw = currentW * scale;
    const sh = currentH * scale;
    const sx = (400 - sw) / 2;
    const sy = (300 - sh) / 2;

    tempCtx.clearRect(0, 0, 400, 300);
    tempCtx.drawImage(canvas, sx, sy, sw, sh);

    const dataUrl = tempCanvas.toDataURL('image/png');

    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const newFish = {
        id: Date.now().toString(),
        dataUrl: dataUrl,
        mirrored: false,
        flipByVelocity: true,
        active: true
      };

      fishArray.push(newFish);

      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        renderFishList();
        clearCanvas();
      });
    });
  });

  function openFishModal(fish) {
    if (!fishModal || !modalFishPreview) return;

    document.body.style.overflow = 'hidden';
    modalFishPreview.src = fish.dataUrl;
    modalActiveToggle.checked = fish.active !== false;
    modalLockToggle.checked = fish.flipByVelocity !== false;

    // Initial display matches current dataUrl (which may already be flipped)
    modalFishPreview.src = fish.dataUrl;
    modalFishPreview.style.transform = ''; // Reset CSS mirror since we're using baked-in flips now

    modalActiveToggle.onclick = () => toggleFishActive(fish.id, modalActiveToggle.checked, () => renderFishList());

    modalFlipHBtn.onclick = () => flipFishImageData(fish.id, true, false);
    modalFlipVBtn.onclick = () => flipFishImageData(fish.id, false, true);

    modalLockToggle.onclick = () => toggleFishFlipByVelocity(fish.id, modalLockToggle.checked);

    modalEditBtn.onclick = () => {
      closeFishModal();
      loadFishFromDataUrl(fish.id, fish.dataUrl);
    };

    modalDeleteBtn.onclick = () => {
      if (confirm('Delete this fish?')) {
        closeFishModal();
        deleteFish(fish.id);
      }
    };

    modalExportBtn.onclick = () => {
      exportFish(fish);
    };

    fishModal.classList.add('active');
  }

  function closeFishModal() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    fishModal.classList.remove('active');
  }

  modalCloseBtn.onclick = closeFishModal;
  fishModal.onclick = (e) => {
    if (e.target === fishModal) closeFishModal();
  };

  function loadFishFromDataUrl(id, dataUrl) {
    saveState();
    const imgObj = new Image();
    imgObj.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const cw = canvas.width / dpr;
      const ch = canvas.height / dpr;
      ctx.clearRect(0, 0, cw, ch);
      const boxScale = Math.min(cw / 400, ch / 300);
      const dw = 400 * boxScale;
      const dh = 300 * boxScale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      ctx.drawImage(imgObj, dx, dy, dw, dh);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    imgObj.src = dataUrl;
  }

  function renderFishList() {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      fishList.innerHTML = '';

      if (fishArray.length === 0) {
        fishList.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:var(--on-surface-variant); font-size: 13px; padding: 2rem 0;">No fish in your tank yet.</p>';
        return;
      }

      fishArray.forEach(fish => {
        const item = document.createElement('div');
        item.className = `gallery-item ${fish.active ? '' : 'inactive'}`;

        const img = document.createElement('img');
        img.src = fish.dataUrl;
        img.alt = 'Fish';
        item.appendChild(img);

        const actions = document.createElement('div');
        actions.className = 'item-actions';

        const toggleBtn = document.createElement('button');
        toggleBtn.className = 'action-btn material-symbols-outlined';
        toggleBtn.textContent = fish.active ? 'visibility' : 'visibility_off';
        toggleBtn.title = fish.active ? 'Hide Fish' : 'Show Fish';
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          toggleFishActive(fish.id, !fish.active, () => {
            renderFishList();
          });
        };

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'action-btn material-symbols-outlined';
        settingsBtn.textContent = 'settings';
        settingsBtn.title = 'Fish Settings';
        settingsBtn.onclick = (e) => {
          e.stopPropagation();
          openFishModal(fish);
        };

        actions.appendChild(toggleBtn);
        actions.appendChild(settingsBtn);
        item.appendChild(actions);

        item.onclick = () => {
          openFishModal(fish);
        };

        fishList.appendChild(item);
      });
    });
  }

  function toggleFishActive(id, isActive, callback) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex !== -1) {
        fishArray[fishIndex].active = isActive;
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          if (callback) callback();
        });
      }
    });
  }

  function toggleFishFlipByVelocity(id, isEnabled) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex !== -1) {
        fishArray[fishIndex].flipByVelocity = isEnabled;
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          renderFishList();
        });
      }
    });
  }

  function flipFishImageData(id, horizontal, vertical) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex === -1) return;

      const fish = fishArray[fishIndex];
      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 300;
        const tempCtx = tempCanvas.getContext('2d');

        if (horizontal) {
          tempCtx.translate(400, 0);
          tempCtx.scale(-1, 1);
        }
        if (vertical) {
          tempCtx.translate(0, 300);
          tempCtx.scale(1, -1);
        }

        tempCtx.drawImage(img, 0, 0, 400, 300);
        const newDataUrl = tempCanvas.toDataURL('image/png');

        fishArray[fishIndex].dataUrl = newDataUrl;
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          modalFishPreview.src = newDataUrl;
          renderFishList();
        });
      };
      img.src = fish.dataUrl;
    });
  }

  function deleteFish(id) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      let fishArray = result.doodleFishList || [];
      fishArray = fishArray.filter(f => f.id !== id);
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        renderFishList();
      });
    });
  }

  function exportFish(fish) {
    const tempCanvas = document.createElement('canvas'); // Final export is 400x300
    tempCanvas.width = 400;
    tempCanvas.height = 300;
    const tempCtx = tempCanvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      tempCtx.drawImage(img, 0, 0, 400, 300);
      const dataUrl = tempCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `doodle-fish-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = fish.dataUrl;
  }

  selectAllBtn.addEventListener('click', () => {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      fishArray.forEach(f => f.active = true);
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        renderFishList();
      });
    });
  });

  deselectAllBtn.addEventListener('click', () => {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      fishArray.forEach(f => f.active = false);
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        renderFishList();
      });
    });
  });

  flipHBtn.onclick = () => {
    saveState();
    flipCanvas(canvas, true, false);
  };

  flipVBtn.onclick = () => {
    saveState();
    flipCanvas(canvas, false, true);
  };

  setupWindowButtons();
  applyColorInput(colorText.value, true);
  brushSizeDisplay.textContent = `${brushSize.value}px`;
  brushOpacityDisplay.textContent = `${brushOpacity.value}%`;
  configureContext();
  resizeCanvasForViewport();
  window.addEventListener('resize', resizeCanvasForViewport);

  // Initial render
  renderFishList();
});