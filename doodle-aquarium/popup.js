document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isStandalone = urlParams.get('mode') === 'window';

  if (isStandalone) {
    document.body.classList.add('standalone');
  }

  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const colorPicker = document.getElementById('color-picker');
  const colorText = document.getElementById('color-text');
  const brushSize = document.getElementById('brush-size');
  const brushPreview = document.getElementById('brush-preview');
  const brushPreviewCtx = brushPreview.getContext('2d');
  const toolRadios = document.querySelectorAll('input[name="tool"]');
  const directionIndicator = document.getElementById('direction-indicator');
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
  const speedValue = document.getElementById('speed-value');
  const sizeValue = document.getElementById('size-value');
  const interactionType = document.getElementById('interaction-type');
  const strengthInput = document.getElementById('interaction-strength');
  const strengthValue = document.getElementById('strength-value');
  const saveSettingsBtn = document.getElementById('save-settings');
  const resetSettingsBtn = document.getElementById('reset-settings');
  const statusEl = document.getElementById('status');

  const DEFAULT_SETTINGS = {
    speedMultiplier: 1,
    sizeMultiplier: 1,
    interactionType: 'repel',
    interactionStrength: 1
  };

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentDrawColor = '#000000';
  let currentTool = 'brush';

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

  undoBtn.addEventListener('click', () => {
    if (undoStack.length > 0) {
      redoStack.push(canvas.toDataURL('image/png'));
      const state = undoStack.pop();
      restoreState(state);
      updateUndoRedoButtons();
    }
  });

  redoBtn.addEventListener('click', () => {
    if (redoStack.length > 0) {
      undoStack.push(canvas.toDataURL('image/png'));
      const state = redoStack.pop();
      restoreState(state);
      updateUndoRedoButtons();
    }
  });

  toolRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentTool = e.target.value;
      updateBrushPreview();
    });
  });

  brushSize.addEventListener('input', () => {
    updateBrushPreview();
  });

  function hexToRgba(hex) {
    let c;
    if(/^#([A-Fa-f0-9]{3}){1,2}$/.test(hex)){
        c= hex.substring(1).split('');
        if(c.length== 3){
            c= [c[0], c[0], c[1], c[1], c[2], c[2]];
        }
        c= '0x'+c.join('');
        return [(c>>16)&255, (c>>8)&255, c&255, 255];
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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    configureContext();

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
    const w = window.innerWidth - 32;
    const maxW = Math.min(w, 800);
    // Use an approx 4:3 ratio based on width
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
      brushPreviewCtx.fillStyle = '#ffffff';
      brushPreviewCtx.fill();
      brushPreviewCtx.strokeStyle = '#000000';
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
      speedValue.value = Number(speedInput.value).toFixed(1);
      sizeValue.value = Number(sizeInput.value).toFixed(1);
      strengthValue.value = Number(strengthInput.value).toFixed(1);
    }

    function updateSliders() {
      speedInput.value = Number(speedValue.value).toFixed(1);
      sizeInput.value = Number(sizeValue.value).toFixed(1);
      strengthInput.value = Number(strengthValue.value).toFixed(1);
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
      speedInput.value = settings.speedMultiplier;
      sizeInput.value = settings.sizeMultiplier;
      interactionType.value = settings.interactionType;
      strengthInput.value = settings.interactionStrength;
      updateLabels();
    }

    saveSettingsBtn.addEventListener('click', () => {
      const settings = {
        speedMultiplier: Number(speedInput.value),
        sizeMultiplier: Number(sizeInput.value),
        interactionType: interactionType.value,
        interactionStrength: Number(strengthInput.value)
      };
      chrome.storage.local.set({ doodleSettings: settings }, () => {
        setStatus('Settings saved.');
      });
    });

    resetSettingsBtn.addEventListener('click', () => {
      applyToForm(DEFAULT_SETTINGS);
      chrome.storage.local.set({ doodleSettings: { ...DEFAULT_SETTINGS } }, () => {
        setStatus('Settings reset.');
      });
    });

    speedInput.addEventListener('input', updateLabels);
    sizeInput.addEventListener('input', updateLabels);
    strengthInput.addEventListener('input', updateLabels);
    speedValue.addEventListener('input', updateSliders);
    sizeValue.addEventListener('input', updateSliders);
    strengthValue.addEventListener('input', updateSliders);

    chrome.storage.local.get(['doodleSettings'], (result) => {
      applyToForm(normalizeSettings(result.doodleSettings));
    });
  }

  function draw(e) {
    if (!isDrawing) return;

    const { x, y } = getCanvasPoint(e);
    drawInterpolatedStroke(lastX, lastY, x, y);

    lastX = x;
    lastY = y;
  }

  canvas.addEventListener('mousedown', (e) => {
    saveState();
    const point = getCanvasPoint(e);

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
    if (currentTool !== 'fill') brushPreview.style.display = 'block';
  });

  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseout', () => {
    isDrawing = false;
    brushPreview.style.display = 'none';
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

    // Scale canvas to fit 400x300 preserving aspect ratio, no cropping
    const scale = Math.min(400 / canvas.style.width.replace('px', ''), 300 / canvas.style.height.replace('px', ''));
    const sw = canvas.style.width.replace('px', '') * scale;
    const sh = canvas.style.height.replace('px', '') * scale;
    const sx = (400 - sw) / 2;
    const sy = (300 - sh) / 2;

    tempCtx.drawImage(canvas, sx, sy, sw, sh);

    const dataUrl = tempCanvas.toDataURL('image/png');

    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const newFish = {
        id: Date.now().toString(),
        dataUrl: dataUrl,
        mirrored: false,
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
        fishList.innerHTML = '<p style="text-align:center; color:#666;">No fish drawn yet.</p>';
        return;
      }

      fishArray.forEach(fish => {
        const item = document.createElement('div');
        item.className = 'fish-item';

        const imgContainer = document.createElement('div');
        imgContainer.className = 'fish-img-container';
        const img = document.createElement('img');
        img.src = fish.dataUrl;
        imgContainer.appendChild(img);

        const actions = document.createElement('div');
        actions.className = 'fish-actions';

        const mirrorLabel = document.createElement('label');
        mirrorLabel.className = 'fish-mirror-toggle';

        const mirrorCheckbox = document.createElement('input');
        mirrorCheckbox.type = 'checkbox';
        mirrorCheckbox.checked = Boolean(fish.mirrored);
        mirrorCheckbox.title = 'Mirror fish';
        mirrorCheckbox.addEventListener('change', () => {
          toggleFishMirror(fish.id, mirrorCheckbox.checked);
        });

        const mirrorText = document.createElement('span');
        mirrorText.textContent = 'Mirror';

        mirrorLabel.appendChild(mirrorCheckbox);
        mirrorLabel.appendChild(mirrorText);

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = fish.active;
        checkbox.title = "In Aquarium";
        checkbox.addEventListener('change', () => {
          toggleFishActive(fish.id, checkbox.checked);
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.addEventListener('click', () => {
          deleteFish(fish.id);
        });

        const editBtn = document.createElement('button');
        editBtn.className = 'secondary-btn';
        editBtn.textContent = 'Edit';
        editBtn.style.marginLeft = '4px';
        editBtn.addEventListener('click', () => {
          saveState();
          const imgObj = new Image();
          imgObj.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Need to match CSS width/height from the dynamic scaling
            const cw = Number(canvas.style.width.replace('px', ''));
            const ch = Number(canvas.style.height.replace('px', ''));
            const scaleX = cw / 400;
            const scaleY = ch / 300;
            const scale = Math.min(scaleX, scaleY);

            const w = imgObj.width * scale;
            const h = imgObj.height * scale;
            const x = (cw - w) / 2;
            const y = (ch - h) / 2;
            ctx.drawImage(imgObj, x, y, w, h);
          };
          imgObj.src = fish.dataUrl;
        });

        const dlBtn = document.createElement('button');
        dlBtn.className = 'secondary-btn';
        dlBtn.textContent = 'Export';
        dlBtn.style.marginLeft = '4px';
        dlBtn.addEventListener('click', () => {
          const a = document.createElement('a');
          a.href = fish.dataUrl;
          a.download = `fish-${fish.id}.png`;
          a.click();
        });

        actions.appendChild(checkbox);
        actions.appendChild(mirrorLabel);
        actions.appendChild(editBtn);
        actions.appendChild(dlBtn);
        actions.appendChild(deleteBtn);

        item.appendChild(imgContainer);
        item.appendChild(actions);

        fishList.appendChild(item);
      });
    });
  }

  function toggleFishActive(id, isActive) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex !== -1) {
        fishArray[fishIndex].active = isActive;
        chrome.storage.local.set({ doodleFishList: fishArray });
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
  configureContext();
  resizeCanvasForViewport();
  window.addEventListener('resize', resizeCanvasForViewport);

  // Initial render
  renderFishList();
});