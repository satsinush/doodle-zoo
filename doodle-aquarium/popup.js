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

  const colorPicker = document.getElementById('color-picker');
  const colorText = document.getElementById('color-text');
  const brushSize = document.getElementById('brush-size');
  const brushSizeDisplay = document.getElementById('brush-size-display');
  const brushPreview = document.getElementById('brush-preview');
  const brushPreviewCtx = brushPreview.getContext('2d');

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

  let undoStack = [];
  let redoStack = [];

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
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
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

    guideCanvas.style.width = `${width}px`;
    guideCanvas.style.height = `${height}px`;
    guideCanvas.width = Math.floor(width * dpr);
    guideCanvas.height = Math.floor(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    guideCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function getCanvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    return { x, y };
  }

  function drawStamp(x, y, diameter) {
    const radius = Math.max(0.5, diameter / 2);
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawInterpolatedStroke(fromX, fromY, toX, toY) {
    const diameter = Number(brushSize.value);
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
    // Dynamic canvas based on window innerWidth. Max width matches extension max popup width.
    const w = window.innerWidth - (isStandalone ? 520 : 32);
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

  function applyColorInput(value, silent = false) {
    const normalized = normalizeCssColor(value);
    if (!normalized) {
      colorText.classList.add('invalid');
      if (!silent) {
        alert('Invalid color. Use any valid CSS color (hex, rgb, hsl, or named color).');
      }
      return false;
    }

    colorText.classList.remove('invalid');
    currentDrawColor = value.trim();

    const hex = cssColorToHex(currentDrawColor);
    if (hex) {
      colorPicker.value = hex;
    }

    colorText.value = currentDrawColor;

    // Auto-switch to brush tool
    currentTool = 'brush';
    toolButtons.forEach(b => b.classList.toggle('active', b.dataset.tool === 'brush'));

    updateBrushPreview();
    return true;
  }

  function updateBrushPreview() {
    const size = Number(brushSize.value);
    const radius = Math.max(0.5, size / 2);

    // Ensure the preview canvas bounds cover the full brush size plus padding for the stroke
    const boxSize = Math.max(4, Math.ceil(size)) + 2;
    brushPreview.width = boxSize;
    brushPreview.height = boxSize;
    brushPreview.style.width = `${boxSize}px`;
    brushPreview.style.height = `${boxSize}px`;

    brushPreviewCtx.clearRect(0, 0, boxSize, boxSize);

    if (currentTool === 'fill') {
      // Hide preview for fill bucket
      brushPreview.style.display = 'none';
      return;
    }

    const center = boxSize / 2;

    if (currentTool === 'eraser') {
      brushPreviewCtx.beginPath();
      brushPreviewCtx.arc(center, center, radius, 0, Math.PI * 2);
      brushPreviewCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
      brushPreviewCtx.lineWidth = 1;
      brushPreviewCtx.stroke();
    } else {
      brushPreviewCtx.beginPath();
      brushPreviewCtx.arc(center, center, radius, 0, Math.PI * 2);
      brushPreviewCtx.fillStyle = currentDrawColor;
      brushPreviewCtx.fill();
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

    drawInterpolatedStroke(lastX, lastY, x, y);

    lastX = x;
    lastY = y;
  }

  canvas.addEventListener('mousedown', (e) => {
    saveState();
    const point = getCanvasPoint(e);

    if (currentTool === 'eyedropper') {
      const dpr = window.devicePixelRatio || 1;
      const imgData = ctx.getImageData(point.x * dpr, point.y * dpr, 1, 1).data;
      if (imgData[3] > 0) { // If not fully transparent
        const hex = rgbToHex(imgData[0], imgData[1], imgData[2]);
        applyColorInput(hex);
      }
      return; // Switch to brush is handled by applyColorInput
    }

    if (currentTool === 'fill') {
      // Need to map point to actual canvas coordinates based on DPR
      const dpr = window.devicePixelRatio || 1;
      floodFill(point.x * dpr, point.y * dpr, cssColorToHex(currentDrawColor) || currentDrawColor);
    } else {
      isDrawing = true;
      lastX = point.x;
      lastY = point.y;

      if (currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = currentDrawColor;
      }
      drawStamp(lastX, lastY, Number(brushSize.value));
      ctx.globalCompositeOperation = 'source-over';
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    draw(e);

    if (currentTool !== 'fill') {
      brushPreview.style.display = 'block';
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const size = Number(brushSize.value);
      brushPreview.style.left = `${x - size / 2}px`;
      brushPreview.style.top = `${y - size / 2}px`;
    }
  });

  canvas.addEventListener('mouseenter', (e) => {
    if (isDrawing) {
      isReentering = true;
    }
    if (currentTool !== 'fill') brushPreview.style.display = 'block';
  });

  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseout', () => {
    brushPreview.style.display = 'none';
  });

  window.addEventListener('mouseup', () => {
    isDrawing = false;
    isReentering = false;
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
        item.title = `${fish.active ? 'Active' : 'Hidden'} - Click to toggle`;

        const img = document.createElement('img');
        img.src = fish.dataUrl;
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

        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn material-symbols-outlined';
        editBtn.textContent = 'edit';
        editBtn.title = 'Edit Fish';
        editBtn.onclick = (e) => {
          e.stopPropagation();
          saveState();
          const imgObj = new Image();
          imgObj.onload = () => {
            // Determine current DPR-mapped CSS size
            const dpr = window.devicePixelRatio || 1;
            const cw = canvas.width / dpr;
            const ch = canvas.height / dpr;

            ctx.clearRect(0, 0, cw, ch);

            // The saved fish is already centered in a 400x300 box.
            // We scale that box to fit the current canvas.
            const boxScale = Math.min(cw / 400, ch / 300);
            const dw = 400 * boxScale;
            const dh = 300 * boxScale;
            const dx = (cw - dw) / 2;
            const dy = (ch - dh) / 2;

            ctx.drawImage(imgObj, dx, dy, dw, dh);
          };
          imgObj.src = fish.dataUrl;
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn material-symbols-outlined delete';
        deleteBtn.textContent = 'delete';
        deleteBtn.title = 'Delete Fish';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          if (confirm('Delete this fish?')) {
            deleteFish(fish.id);
          }
        };

        actions.appendChild(toggleBtn);
        actions.appendChild(editBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(actions);

        item.onclick = () => {
          toggleFishActive(fish.id, !fish.active, () => {
            renderFishList();
          });
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

  function toggleFishMirror(id, isMirrored) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex !== -1) {
        fishArray[fishIndex].mirrored = isMirrored;
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          renderFishList();
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

  function deleteFish(id) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      let fishArray = result.doodleFishList || [];
      fishArray = fishArray.filter(f => f.id !== id);
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        renderFishList();
      });
    });
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

  setupWindowButtons();
  applyColorInput(colorText.value, true);
  brushSizeDisplay.textContent = `${brushSize.value}px`;
  configureContext();
  resizeCanvasForViewport();
  window.addEventListener('resize', resizeCanvasForViewport);

  // Initial render
  renderFishList();
});