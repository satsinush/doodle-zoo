document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isStandalone = urlParams.get('mode') === 'window';

  if (isStandalone) {
    document.body.classList.add('standalone');
  }

  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');

  const colorPicker = document.getElementById('color-picker');
  const colorText = document.getElementById('color-text');
  const brushSize = document.getElementById('brush-size');
  const toolRadios = document.querySelectorAll('input[name="tool"]');
  const fishDirection = document.getElementById('fish-direction');
  const directionIndicator = document.getElementById('direction-indicator');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');
  const exportBtn = document.getElementById('export-btn');
  const importFile = document.getElementById('import-file');
  const openWindowBtn = document.getElementById('open-window-btn');
  const fishList = document.getElementById('fish-list');

  const settingsPanel = document.getElementById('settings-panel');
  const speedInput = document.getElementById('speed-multiplier');
  const sizeInput = document.getElementById('size-multiplier');
  const speedValue = document.getElementById('speed-value');
  const sizeValue = document.getElementById('size-value');
  const saveSettingsBtn = document.getElementById('save-settings');
  const resetSettingsBtn = document.getElementById('reset-settings');
  const statusEl = document.getElementById('status');

  const DEFAULT_SETTINGS = {
    speedMultiplier: 1,
    sizeMultiplier: 1
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
    });
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

    const matchStartColor = (index) => {
      return data[index] === startR &&
             data[index + 1] === startG &&
             data[index + 2] === startB &&
             data[index + 3] === startA;
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

    // Dilate the mask by 2 pixels to overlap with thicker antialiased borders
    let dilatedMask = new Uint8Array(fillMask);
    for (let passes = 0; passes < 2; passes++) {
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
    }

    for (let i = 0; i < dilatedMask.length; i++) {
      if (dilatedMask[i]) {
        const ptr = i * 4;
        // Don't overwrite completely opaque black lines (or whatever the main draw color is)
        // A simple alpha blend so we don't destroy borders. We just force fill.
        // Doing destination-over manually basically.
        if (data[ptr+3] < 200) {
          data[ptr] = fillRgba[0];
          data[ptr + 1] = fillRgba[1];
          data[ptr + 2] = fillRgba[2];
          data[ptr + 3] = 255;
        } else {
          // If we hit an existing solid pixel, blend the fill color behind it
          const invAlpha = 1 - (data[ptr+3]/255);
          data[ptr] = data[ptr] + fillRgba[0]*invAlpha;
          data[ptr + 1] = data[ptr + 1] + fillRgba[1]*invAlpha;
          data[ptr + 2] = data[ptr + 2] + fillRgba[2]*invAlpha;
          data[ptr + 3] = 255;
        }
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
    const width = 400;
    const height = 300;
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

    ctx.fillStyle = currentDrawColor;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const x = fromX + dx * t;
      const y = fromY + dy * t;
      drawStamp(x, y, diameter);
    }
  }

  function resizeCanvasForViewport() {
    if (isStandalone) {
      const width = Math.max(500, Math.min(1000, window.innerWidth - 32));
      const height = Math.max(300, Math.min(700, Math.floor(window.innerHeight * 0.45)));
      const rect = canvas.getBoundingClientRect();
      if (Math.round(rect.width) !== width || Math.round(rect.height) !== height) {
        setCanvasSize(width, height, true);
      }
      return;
    }

    const rect = canvas.getBoundingClientRect();
    setCanvasSize(rect.width, rect.height, false);
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
    return true;
  }

  function updateDirectionIndicator() {
    directionIndicator.textContent = fishDirection.value === 'left' ? 'Head points <-' : 'Head points ->';
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
      speedValue.textContent = `${Number(speedInput.value).toFixed(1)}x`;
      sizeValue.textContent = `${Number(sizeInput.value).toFixed(1)}x`;
    }

    function normalizeSettings(raw) {
      if (!raw || typeof raw !== 'object') {
        return { ...DEFAULT_SETTINGS };
      }
      const speed = Number(raw.speedMultiplier);
      const size = Number(raw.sizeMultiplier);
      return {
        speedMultiplier: Number.isFinite(speed) && speed > 0 ? speed : DEFAULT_SETTINGS.speedMultiplier,
        sizeMultiplier: Number.isFinite(size) && size > 0 ? size : DEFAULT_SETTINGS.sizeMultiplier
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
      updateLabels();
    }

    saveSettingsBtn.addEventListener('click', () => {
      const settings = {
        speedMultiplier: Number(speedInput.value),
        sizeMultiplier: Number(sizeInput.value)
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

      ctx.fillStyle = currentDrawColor;
      drawStamp(lastX, lastY, Number(brushSize.value));
    }
  });

  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseout', () => isDrawing = false);

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

  fishDirection.addEventListener('change', updateDirectionIndicator);

  // Check if canvas is empty
  function isCanvasBlank() {
    const pixelBuffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  }

  function getCroppedDataUrl() {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    let minX = w, minY = h, maxX = 0, maxY = 0;
    let found = false;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const alpha = data[(y * w + x) * 4 + 3];
        if (alpha > 0) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          found = true;
        }
      }
    }

    if (!found) return null;

    // Add a small padding
    const padding = 2;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(w - 1, maxX + padding);
    maxY = Math.min(h - 1, maxY + padding);

    const cropW = maxX - minX + 1;
    const cropH = maxY - minY + 1;

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext('2d');

    cropCtx.putImageData(ctx.getImageData(minX, minY, cropW, cropH), 0, 0);
    return cropCanvas.toDataURL('image/png');
  }

  function getExportDataUrl() {
    if (isCanvasBlank()) return null;

    // Scale down to fixed 400x300 regardless of DPR
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = 400;
    exportCanvas.height = 300;
    const exportCtx = exportCanvas.getContext('2d');
    exportCtx.drawImage(canvas, 0, 0, 400, 300);
    return exportCanvas.toDataURL('image/png');
  }

  exportBtn.addEventListener('click', () => {
    const dataUrl = getExportDataUrl();
    if (!dataUrl) {
      alert("Please draw a fish first!");
      return;
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `fish-${Date.now()}.png`;
    a.click();
  });

  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      saveState();
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Draw the image scaled to CSS coords
        ctx.drawImage(img, 0, 0, 400, 300);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // Reset so the same file can be imported again
  });

  saveBtn.addEventListener('click', () => {
    const dataUrl = getCroppedDataUrl();
    if (!dataUrl) {
      alert("Please draw a fish first!");
      return;
    }

    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const newFish = {
        id: Date.now().toString(),
        dataUrl: dataUrl,
        direction: fishDirection.value,
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

        const directionLabel = document.createElement('span');
        directionLabel.className = 'fish-direction';
        directionLabel.textContent = (fish.direction || 'right') === 'left' ? '<-' : '->';

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
            // Draw the cropped image centered
            const x = (400 - imgObj.width) / 2;
            const y = (300 - imgObj.height) / 2;
            ctx.drawImage(imgObj, x, y);
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
        actions.appendChild(directionLabel);
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

  function deleteFish(id) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      let fishArray = result.doodleFishList || [];
      fishArray = fishArray.filter(f => f.id !== id);
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        renderFishList();
      });
    });
  }

  setupWindowButtons();
  applyColorInput(colorText.value, true);
  updateDirectionIndicator();
  configureContext();
  resizeCanvasForViewport();
  window.addEventListener('resize', resizeCanvasForViewport);

  // Initial render
  renderFishList();
});