const DEFAULT_SETTINGS = {
  speedMultiplier: 1,
  sizeMultiplier: 1
};

const speedInput = document.getElementById('speed-multiplier');
const sizeInput = document.getElementById('size-multiplier');
const speedValue = document.getElementById('speed-value');
const sizeValue = document.getElementById('size-value');
const saveButton = document.getElementById('save-settings');
const resetButton = document.getElementById('reset-settings');
const status = document.getElementById('status');

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
  status.textContent = message;
  if (message) {
    setTimeout(() => {
      status.textContent = '';
    }, 1600);
  }
}

function applyToForm(settings) {
  speedInput.value = settings.speedMultiplier;
  sizeInput.value = settings.sizeMultiplier;
  updateLabels();
}

function saveSettings() {
  const settings = {
    speedMultiplier: Number(speedInput.value),
    sizeMultiplier: Number(sizeInput.value)
  };

  chrome.storage.local.set({ doodleSettings: settings }, () => {
    setStatus('Settings saved.');
  });
}

function resetSettings() {
  applyToForm(DEFAULT_SETTINGS);
  chrome.storage.local.set({ doodleSettings: { ...DEFAULT_SETTINGS } }, () => {
    setStatus('Settings reset.');
  });
}

speedInput.addEventListener('input', updateLabels);
sizeInput.addEventListener('input', updateLabels);
saveButton.addEventListener('click', saveSettings);
resetButton.addEventListener('click', resetSettings);

chrome.storage.local.get(['doodleSettings'], (result) => {
  applyToForm(normalizeSettings(result.doodleSettings));
});
