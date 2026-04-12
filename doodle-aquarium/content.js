// Main orchestrator for Doodle Aquarium content script
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;

  if (changes.doodleFishList) {
    updateAquarium(changes.doodleFishList.newValue || []);
  }

  if (changes.doodleSettings) {
    aquariumSettings = normalizeSettings(changes.doodleSettings.newValue);
    applySettingsToFish();
  }
});

// Initial load
chrome.storage.local.get(['doodleFishList', 'doodleSettings'], (result) => {
  aquariumSettings = normalizeSettings(result.doodleSettings);
  updateAquarium(result.doodleFishList || []);
});

// Event Listeners
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

document.addEventListener('mouseleave', () => {
  mouseX = -1000;
  mouseY = -1000;
});

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applySettingsToFish);
  window.visualViewport.addEventListener('scroll', applySettingsToFish);
}