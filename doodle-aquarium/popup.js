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
  const fishDirection = document.getElementById('fish-direction');
  const directionIndicator = document.getElementById('direction-indicator');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');
  const openWindowBtn = document.getElementById('open-window-btn');
  const settingsBtn = document.getElementById('settings-btn');
  const fishList = document.getElementById('fish-list');

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentDrawColor = '#000000';

  // Keep drawing coordinates in CSS pixels while rendering crisply on high DPI screens.
  function configureContext() {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.imageSmoothingEnabled = true;
  }

  function clearCanvas() {
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

    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
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
    isDrawing = true;
    const point = getCanvasPoint(e);
    lastX = point.x;
    lastY = point.y;

    ctx.fillStyle = currentDrawColor;
    drawStamp(lastX, lastY, Number(brushSize.value));
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

  saveBtn.addEventListener('click', () => {
    if (isCanvasBlank()) {
      alert("Please draw a fish first!");
      return;
    }

    const dataUrl = canvas.toDataURL('image/png');

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

        actions.appendChild(checkbox);
        actions.appendChild(directionLabel);
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