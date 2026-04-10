// Global state
let activeFish = []; // Array of fish objects with element, x, y, vx, vy
let animationFrameId = null;
let mouseX = -1000;
let mouseY = -1000;
const DEFAULT_SETTINGS = {
  speedMultiplier: 1,
  sizeMultiplier: 1,
  interactionType: 'repel',
  interactionStrength: 1
};
let aquariumSettings = { ...DEFAULT_SETTINGS };

function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }

  const speed = Number(raw.speedMultiplier);
  const size = Number(raw.sizeMultiplier);
  const strength = Number(raw.interactionStrength);

  return {
    speedMultiplier: Number.isFinite(speed) && speed > 0 ? speed : DEFAULT_SETTINGS.speedMultiplier,
    sizeMultiplier: Number.isFinite(size) && size > 0 ? size : DEFAULT_SETTINGS.sizeMultiplier,
    interactionType: raw.interactionType === 'attract' ? 'attract' : 'repel',
    interactionStrength: Number.isFinite(strength) && strength >= 0 ? strength : DEFAULT_SETTINGS.interactionStrength
  };
}

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
  const renderScale = inverseZoom * aquariumSettings.sizeMultiplier;
  return {
    renderScale,
    width: fish.baseWidth * renderScale,
    height: fish.baseHeight * renderScale
  };
}

// Listen for storage changes to update the fish list
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace !== 'local') {
    return;
  }

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

// Track mouse position for avoidance
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

// Clear mouse position when it leaves the window
document.addEventListener('mouseleave', () => {
  mouseX = -1000;
  mouseY = -1000;
});

function updateAquarium(fishList) {
  // Get active fish from storage
  const newActiveFishData = fishList.filter(f => f.active);

  // Remove fish that are no longer active
  const activeIds = newActiveFishData.map(f => f.id);

  for (let i = activeFish.length - 1; i >= 0; i--) {
    if (!activeIds.includes(activeFish[i].id)) {
      activeFish[i].element.remove();
      activeFish.splice(i, 1);
    }
  }

  // Add new fish that aren't already in the aquarium
  const currentIds = activeFish.map(f => f.id);
  newActiveFishData.forEach(fishData => {
    if (!currentIds.includes(fishData.id)) {
      spawnFish(fishData);
    }
  });

  // Start animation loop if not running and we have fish
  // (We check length > 0 in case there are no fish, but the actual starting of animation
  //  is handled when fish are added to the activeFish array in spawnFish)
  if (activeFish.length === 0 && animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

function spawnFish(fishData) {
  const img = document.createElement('img');
  img.src = fishData.dataUrl;
  img.style.position = 'fixed';
  img.style.top = '0px';
  img.style.left = '0px';
  img.style.zIndex = '999999';
  img.style.pointerEvents = 'none'; // Don't block clicks on the page
  img.style.maxWidth = 'none';
  img.style.transformOrigin = 'center center';
  img.style.visibility = 'hidden';

  const appendToBody = () => {
    if (document.body) {
      document.body.appendChild(img);
    } else {
      // document.body might not be ready yet if run_at is document_start
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(img);
      });
    }
  };
  appendToBody();

  // Wait for image to load to get dimensions
  img.onload = () => {
    let natWidth = img.naturalWidth || img.width || 400;
    let natHeight = img.naturalHeight || img.height || 300;
    let scale = Math.min(200 / natWidth, 200 / natHeight, 1);
    const baseWidth = natWidth * scale;
    const baseHeight = natHeight * scale;
    const bounds = getViewportBounds();

    img.style.width = `${baseWidth}px`;
    img.style.height = `${baseHeight}px`;

    const tempFish = { baseWidth, baseHeight };
    const metrics = getRenderMetrics(tempFish);

    // Start at random position, x and y represent the center point of the fish
    const x = bounds.left + metrics.width/2 + Math.random() * Math.max(1, (bounds.width - metrics.width));
    const y = bounds.top + metrics.height/2 + Math.random() * Math.max(1, (bounds.height - metrics.height));

    // Random velocity
    const baseSpeed = 1.5 + Math.random() * 2;
    const seededDirection = fishData.direction === 'left' ? -1 : 1;
    const angle = seededDirection < 0
      ? (Math.PI * 0.85 + Math.random() * Math.PI * 0.3)
      : (-Math.PI * 0.15 + Math.random() * Math.PI * 0.3);
    const speed = baseSpeed * aquariumSettings.speedMultiplier;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    activeFish.push({
      id: fishData.id,
      element: img,
      baseWidth,
      baseHeight,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      baseSpeedRaw: baseSpeed
    });

    updateFishTransform(activeFish[activeFish.length - 1]);
    img.style.visibility = 'visible';

    if (!animationFrameId) {
      animate();
    }
  };
}

function updateFishTransform(fish) {
  const metrics = getRenderMetrics(fish);
  // Flip image if moving left
  const direction = fish.vx < 0 ? -1 : 1;
  // Use translate(-50%, -50%) to ensure scaling happens relative to the precise dynamic center without offsetting logic bugs
  fish.element.style.transform = `translate(${fish.x}px, ${fish.y}px) translate(-50%, -50%) scale(${direction * metrics.renderScale}, ${metrics.renderScale})`;
}

function applySettingsToFish() {
  for (let i = 0; i < activeFish.length; i++) {
    const fish = activeFish[i];
    const speed = Math.sqrt(fish.vx * fish.vx + fish.vy * fish.vy);
    const targetSpeed = fish.baseSpeedRaw * aquariumSettings.speedMultiplier;
    const scaleRatio = speed > 0 ? targetSpeed / speed : 1;

    fish.vx *= scaleRatio;
    fish.vy *= scaleRatio;
    updateFishTransform(fish);
  }
}

function animate() {
  const MAX_SPEED = 8 * aquariumSettings.speedMultiplier;
  const MIN_SPEED = 1 * aquariumSettings.speedMultiplier;
  const bounds = getViewportBounds();
  const DECAY_CONSTANT = 0.015; // Controls how fast the force drops off

  for (let i = 0; i < activeFish.length; i++) {
    const fish = activeFish[i];
    const metrics = getRenderMetrics(fish);
    const targetSpeed = fish.baseSpeedRaw * aquariumSettings.speedMultiplier;

    // Center of fish is now exactly x, y
    const fishCenterX = fish.x;
    const fishCenterY = fish.y;

    // Mouse interaction
    const dx = fishCenterX - mouseX;
    const dy = fishCenterY - mouseY;
    let dist = Math.sqrt(dx * dx + dy * dy);

    // Only apply force if mouse is on screen (dist is large if mouseX/Y is -1000)
    let applyingForce = false;
    if (mouseX >= 0 && mouseY >= 0 && aquariumSettings.interactionStrength > 0) {
      if (dist === 0) dist = 0.1;

      // Calculate force using exponential decay: F = A * e^(-k * d)
      // A is the base amplitude/strength
      const baseForce = 2.0 * aquariumSettings.interactionStrength;
      const forceMagnitude = baseForce * Math.exp(-DECAY_CONSTANT * dist);

      // We still use a small threshold just to skip calculating tiny forces
      if (forceMagnitude > 0.01) {
        applyingForce = true;
        // Direction vector from mouse to fish
        const dirX = dx / dist;
        const dirY = dy / dist;

        // If attract, flip the direction vector towards the mouse
        const sign = aquariumSettings.interactionType === 'attract' ? -1 : 1;

        fish.vx += dirX * forceMagnitude * sign;
        fish.vy += dirY * forceMagnitude * sign;
      }
    }

    // Apply friction to return to normal speed
    const currentSpeed = Math.sqrt(fish.vx * fish.vx + fish.vy * fish.vy);
    if (currentSpeed > targetSpeed && !applyingForce) {
      fish.vx *= 0.95;
      fish.vy *= 0.95;
    } else if (currentSpeed < MIN_SPEED) {
      // Prevent stopping
      const angle = Math.atan2(fish.vy, fish.vx);
      fish.vx = Math.cos(angle) * MIN_SPEED;
      fish.vy = Math.sin(angle) * MIN_SPEED;
    }

    // Cap max speed
    if (currentSpeed > MAX_SPEED) {
      const angle = Math.atan2(fish.vy, fish.vx);
      fish.vx = Math.cos(angle) * MAX_SPEED;
      fish.vy = Math.sin(angle) * MAX_SPEED;
    }

    // Move
    fish.x += fish.vx;
    fish.y += fish.vy;

    // Bounce off edges (using center coordinate and half-width/height)
    const halfWidth = metrics.width / 2;
    const halfHeight = metrics.height / 2;

    if (fish.x - halfWidth <= bounds.left) {
      fish.x = bounds.left + halfWidth;
      fish.vx *= -1;
    } else if (fish.x + halfWidth >= bounds.left + bounds.width) {
      fish.x = bounds.left + bounds.width - halfWidth;
      fish.vx *= -1;
    }

    if (fish.y - halfHeight <= bounds.top) {
      fish.y = bounds.top + halfHeight;
      fish.vy *= -1;
    } else if (fish.y + halfHeight >= bounds.top + bounds.height) {
      fish.y = bounds.top + bounds.height - halfHeight;
      fish.vy *= -1;
    }

    updateFishTransform(fish);
  }

  animationFrameId = requestAnimationFrame(animate);
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applySettingsToFish);
  window.visualViewport.addEventListener('scroll', applySettingsToFish);
}