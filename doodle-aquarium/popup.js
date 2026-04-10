document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');

  const colorPicker = document.getElementById('color-picker');
  const brushSize = document.getElementById('brush-size');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');
  const fishList = document.getElementById('fish-list');

  const toolBrushBtn = document.getElementById('tool-brush');
  const toolFillBtn = document.getElementById('tool-fill');
  const undoBtn = document.getElementById('undo-btn');
  const redoBtn = document.getElementById('redo-btn');
  const settingsBtn = document.getElementById('settings-btn');

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let currentTool = 'brush'; // 'brush' or 'fill'

  // History state for undo/redo
  let history = [];
  let historyStep = -1;

  // Setup canvas
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // Initialize history
  saveState();

  function saveState() {
    // Remove future states if we drew something new after undoing
    if (historyStep < history.length - 1) {
      history = history.slice(0, historyStep + 1);
    }
    history.push(canvas.toDataURL());
    historyStep++;
    updateUndoRedoButtons();
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = historyStep <= 0;
    redoBtn.disabled = historyStep >= history.length - 1;
  }

  undoBtn.addEventListener('click', () => {
    if (historyStep > 0) {
      historyStep--;
      restoreState();
    }
  });

  redoBtn.addEventListener('click', () => {
    if (historyStep < history.length - 1) {
      historyStep++;
      restoreState();
    }
  });

  function restoreState() {
    const img = new Image();
    img.src = history[historyStep];
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
    updateUndoRedoButtons();
  }

  // Tool switching
  toolBrushBtn.addEventListener('click', () => {
    currentTool = 'brush';
    toolBrushBtn.classList.add('active');
    toolFillBtn.classList.remove('active');
  });

  toolFillBtn.addEventListener('click', () => {
    currentTool = 'fill';
    toolFillBtn.classList.add('active');
    toolBrushBtn.classList.remove('active');
  });

  // Settings
  settingsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });

  function hexToRgba(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
      a: 255
    } : { r: 0, g: 0, b: 0, a: 255 };
  }

  function floodFill(startX, startY, fillColorHex) {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    const startPos = (startY * canvas.width + startX) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    const fillRgba = hexToRgba(fillColorHex);

    if (startR === fillRgba.r && startG === fillRgba.g && startB === fillRgba.b && startA === fillRgba.a) {
      return; // Same color, do nothing
    }

    const matchStartColor = (pos) => {
      return data[pos] === startR && data[pos + 1] === startG && data[pos + 2] === startB && data[pos + 3] === startA;
    };

    const colorPixel = (pos) => {
      data[pos] = fillRgba.r;
      data[pos + 1] = fillRgba.g;
      data[pos + 2] = fillRgba.b;
      data[pos + 3] = fillRgba.a;
    };

    const pixelStack = [[startX, startY]];

    while (pixelStack.length) {
      const newPos = pixelStack.pop();
      const x = newPos[0];
      let y = newPos[1];

      let pixelPos = (y * canvas.width + x) * 4;
      while (y-- >= 0 && matchStartColor(pixelPos)) {
        pixelPos -= canvas.width * 4;
      }
      pixelPos += canvas.width * 4;
      ++y;

      let reachLeft = false;
      let reachRight = false;

      while (y++ < canvas.height - 1 && matchStartColor(pixelPos)) {
        colorPixel(pixelPos);

        if (x > 0) {
          if (matchStartColor(pixelPos - 4)) {
            if (!reachLeft) {
              pixelStack.push([x - 1, y]);
              reachLeft = true;
            }
          } else if (reachLeft) {
            reachLeft = false;
          }
        }

        if (x < canvas.width - 1) {
          if (matchStartColor(pixelPos + 4)) {
            if (!reachRight) {
              pixelStack.push([x + 1, y]);
              reachRight = true;
            }
          } else if (reachRight) {
            reachRight = false;
          }
        }

        pixelPos += canvas.width * 4;
      }
    }

    ctx.putImageData(imgData, 0, 0);
  }

  function draw(e) {
    if (!isDrawing) return;
    if (currentTool !== 'brush') return;

    // Get mouse coordinates relative to canvas
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = brushSize.value;

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
  }

  canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    lastX = Math.floor(e.clientX - rect.left);
    lastY = Math.floor(e.clientY - rect.top);

    if (currentTool === 'fill') {
      floodFill(lastX, lastY, colorPicker.value);
      saveState();
    } else {
      isDrawing = true;
    }
  });

  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', () => {
    if (isDrawing) {
      isDrawing = false;
      saveState();
    }
  });
  canvas.addEventListener('mouseout', () => {
    if (isDrawing) {
      isDrawing = false;
      saveState();
    }
  });

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveState();
  });

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
        active: true
      };

      fishArray.push(newFish);

      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        renderFishList();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
          saveState();
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

  // Initial render
  renderFishList();
});