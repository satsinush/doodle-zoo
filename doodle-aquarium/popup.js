document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('drawing-canvas');
  const ctx = canvas.getContext('2d');

  const colorPicker = document.getElementById('color-picker');
  const brushSize = document.getElementById('brush-size');
  const clearBtn = document.getElementById('clear-btn');
  const saveBtn = document.getElementById('save-btn');
  const fishList = document.getElementById('fish-list');

  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;

  // Setup canvas
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  function draw(e) {
    if (!isDrawing) return;

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
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
  });

  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', () => isDrawing = false);
  canvas.addEventListener('mouseout', () => isDrawing = false);

  clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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