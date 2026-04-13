function getViewportScale() {
  return window.visualViewport && window.visualViewport.scale ? window.visualViewport.scale : 1;
}

function getViewportBounds() {
  if (window.visualViewport) {
    return {
      left: window.visualViewport.offsetLeft,
      top: window.visualViewport.offsetTop,
      width: window.visualViewport.width,
      height: window.visualViewport.height
    };
  }
  return {
    left: 0,
    top: 0,
    width: window.innerWidth,
    height: window.innerHeight
  };
}

function getRenderMetrics(fish) {
  const inverseZoom = 1 / getViewportScale();
  const renderScale = inverseZoom * (fish.sizeMultiplier ?? 0.5);
  return {
    renderScale,
    width: fish.baseWidth * renderScale,
    height: fish.baseHeight * renderScale
  };
}
