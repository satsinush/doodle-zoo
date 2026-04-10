document.addEventListener('DOMContentLoaded', () => {
  const speedInput = document.getElementById('speed-multiplier');
  const sizeInput = document.getElementById('size-multiplier');
  const speedValue = document.getElementById('speed-value');
  const sizeValue = document.getElementById('size-value');
  const saveBtn = document.getElementById('save-btn');
  const status = document.getElementById('status');

  // Load saved settings
  chrome.storage.local.get({
    fishSpeedMultiplier: 1.0,
    fishSizeMultiplier: 1.0
  }, (items) => {
    speedInput.value = items.fishSpeedMultiplier;
    sizeInput.value = items.fishSizeMultiplier;
    updateDisplays();
  });

  function updateDisplays() {
    speedValue.textContent = Number(speedInput.value).toFixed(1) + 'x';
    sizeValue.textContent = Number(sizeInput.value).toFixed(1) + 'x';
  }

  speedInput.addEventListener('input', updateDisplays);
  sizeInput.addEventListener('input', updateDisplays);

  saveBtn.addEventListener('click', () => {
    const speed = parseFloat(speedInput.value);
    const size = parseFloat(sizeInput.value);

    chrome.storage.local.set({
      fishSpeedMultiplier: speed,
      fishSizeMultiplier: size
    }, () => {
      status.textContent = 'Settings saved!';
      setTimeout(() => {
        status.textContent = '';
      }, 2000);
    });
  });
});