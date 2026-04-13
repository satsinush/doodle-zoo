// Main orchestrator for Doodle Aquarium content script
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') return;

  if (changes.doodleFishList) {
    updateAquarium(changes.doodleFishList.newValue || []);
  }
});

// Initial load
chrome.storage.local.get(['doodleFishList'], (result) => {
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

function handleViewportChange() {
  for (let i = 0; i < activeFish.length; i++) {
    updateFishTransform(activeFish[i]);
  }
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', handleViewportChange);
  window.visualViewport.addEventListener('scroll', handleViewportChange);
}