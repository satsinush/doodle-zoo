function updateAquarium(fishList) {
  const fishDataById = new Map(fishList.map(fish => [fish.id, fish]));
  const newActiveFishData = fishList.filter(f => f.active);
  const activeIds = newActiveFishData.map(f => f.id);

  // Remove fish that are no longer active
  for (let i = activeFish.length - 1; i >= 0; i--) {
    if (!activeIds.includes(activeFish[i].id)) {
      activeFish[i].element.remove();
      activeFish.splice(i, 1);
    }
  }

  // Add new fish
  const currentIds = activeFish.map(f => f.id);
  newActiveFishData.forEach(fishData => {
    if (!currentIds.includes(fishData.id)) {
      spawnFish(fishData);
    }
  });

  // Sync state
  for (let i = 0; i < activeFish.length; i++) {
    const fish = activeFish[i];
    const fishData = fishDataById.get(fish.id);
    if (!fishData) continue;

    const nextMirrored = Boolean(fishData.mirrored || fishData.direction === 'left');
    const nextFlipByVelocity = fishData.flipByVelocity !== false;

    // Merge new physics properties onto active tracker directly 
    fish.speedMultiplier = fishData.speedMultiplier;
    fish.sizeMultiplier = fishData.sizeMultiplier;
    fish.interactionType = fishData.interactionType;
    fish.interactionStrength = fishData.interactionStrength;

    if (fish.mirrored !== nextMirrored || fish.flipByVelocity !== nextFlipByVelocity) {
      fish.mirrored = nextMirrored;
      fish.flipByVelocity = nextFlipByVelocity;
      updateFishTransform(fish);
    }
  }

  if (activeFish.length === 0 && animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function spawnFish(fishData) {
  const img = document.createElement('img');
  img.className = 'doodle-aquarium-fish';
  img.style.cssText = 'position: fixed; top: 0; left: 0; z-index: 999999; pointer-events: none; max-width: none; transform-origin: center center; visibility: hidden; transition: opacity 0.5s;';

  const appendToBody = () => {
    if (document.body) document.body.appendChild(img);
    else document.addEventListener('DOMContentLoaded', () => document.body.appendChild(img));
  };
  appendToBody();

  // 1. Load original dataURL onto a temporary image to perform trimming
  const rawImg = new Image();
  rawImg.src = fishData.dataUrl;
  rawImg.onload = () => {
    try {
      // trimImageToDataUrl is provided by image-utils.js
      const trimmedDataUrl = typeof trimImageToDataUrl === 'function' ? trimImageToDataUrl(rawImg) : fishData.dataUrl;
      img.src = trimmedDataUrl;
    } catch (e) {
      console.warn("Doodle Aquarium: Auto-cropping failed, falling back to original.", e);
      img.src = fishData.dataUrl;
    }
  };

  img.onload = () => {
    let natWidth = img.naturalWidth || img.width || 400;
    let natHeight = img.naturalHeight || img.height || 300;
    let scale = Math.min(200 / natWidth, 200 / natHeight, 1);
    const baseWidth = natWidth * scale;
    const baseHeight = natHeight * scale;
    img.style.width = `${baseWidth}px`;
    img.style.height = `${baseHeight}px`;

    const bounds = getViewportBounds();
    const metrics = getRenderMetrics({ baseWidth, baseHeight });

    const x = bounds.left + metrics.width / 2 + Math.random() * Math.max(1, (bounds.width - metrics.width));
    const y = bounds.top + metrics.height / 2 + Math.random() * Math.max(1, (bounds.height - metrics.height));
    const baseSpeed = 1.5 + Math.random() * 2;
    const isMirrored = Boolean(fishData.mirrored || fishData.direction === 'left');
    const angle = isMirrored ? (Math.PI * 0.85 + Math.random() * Math.PI * 0.3) : (-Math.PI * 0.15 + Math.random() * Math.PI * 0.3);
    const speedMultiplier = fishData.speedMultiplier ?? DEFAULT_SETTINGS.speedMultiplier;
    const speed = baseSpeed * speedMultiplier;

    activeFish.push({
      id: fishData.id,
      element: img,
      baseWidth, baseHeight,
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      baseSpeedRaw: baseSpeed,
      seed: Math.random() * Math.PI * 2,
      mirrored: isMirrored,
      flipByVelocity: fishData.flipByVelocity !== false,
      speedMultiplier: fishData.speedMultiplier ?? DEFAULT_SETTINGS.speedMultiplier,
      sizeMultiplier: fishData.sizeMultiplier ?? DEFAULT_SETTINGS.sizeMultiplier,
      interactionType: fishData.interactionType || DEFAULT_SETTINGS.interactionType,
      interactionStrength: fishData.interactionStrength ?? DEFAULT_SETTINGS.interactionStrength
    });

    updateFishTransform(activeFish[activeFish.length - 1]);
    img.style.visibility = 'visible';
    if (!animationFrameId) animate();
  };
}

function updateFishTransform(fish) {
  const metrics = getRenderMetrics(fish);
  const velocityDirection = fish.vx < 0 ? -1 : 1;
  const direction = ((fish.flipByVelocity !== false) ? velocityDirection : 1) * (fish.mirrored ? -1 : 1);
  fish.element.style.transform = `translate(${fish.x}px, ${fish.y}px) translate(-50%, -50%) scale(${direction * metrics.renderScale}, ${metrics.renderScale})`;
}