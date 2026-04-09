// Global state
let activeFish = []; // Array of fish objects with element, x, y, vx, vy
let animationFrameId = null;
let mouseX = -1000;
let mouseY = -1000;

// Listen for storage changes to update the fish list
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.doodleFishList) {
    updateAquarium(changes.doodleFishList.newValue || []);
  }
});

// Initial load
chrome.storage.local.get(['doodleFishList'], (result) => {
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
  // Ensure we don't scale it ridiculously, but use natural size
  img.style.maxWidth = '200px';

  document.body.appendChild(img);

  // Wait for image to load to get dimensions
  img.onload = () => {
    // Start at random position
    const x = Math.random() * (window.innerWidth - img.width);
    const y = Math.random() * (window.innerHeight - img.height);

    // Random velocity
    const speed = 1.5 + Math.random() * 2;
    const angle = Math.random() * Math.PI * 2;
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    activeFish.push({
      id: fishData.id,
      element: img,
      width: img.width,
      height: img.height,
      x: x,
      y: y,
      vx: vx,
      vy: vy,
      baseSpeed: speed
    });

    updateFishTransform(activeFish[activeFish.length - 1]);

    if (!animationFrameId) {
      animate();
    }
  };
}

function updateFishTransform(fish) {
  // Flip image if moving left
  const scaleX = fish.vx < 0 ? -1 : 1;
  fish.element.style.transform = `translate(${fish.x}px, ${fish.y}px) scaleX(${scaleX})`;
}

function animate() {
  const AVOID_RADIUS = 150;
  const AVOID_FORCE = 0.5;
  const MAX_SPEED = 8;
  const MIN_SPEED = 1;

  for (let i = 0; i < activeFish.length; i++) {
    const fish = activeFish[i];

    // Center of fish
    const fishCenterX = fish.x + fish.width / 2;
    const fishCenterY = fish.y + fish.height / 2;

    // Mouse avoidance
    const dx = fishCenterX - mouseX;
    const dy = fishCenterY - mouseY;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < AVOID_RADIUS) {
      if (dist === 0) dist = 0.1;
      // Repel from mouse
      const repelX = (dx / dist) * AVOID_FORCE;
      const repelY = (dy / dist) * AVOID_FORCE;

      fish.vx += repelX;
      fish.vy += repelY;
    }

    // Apply friction to return to normal speed
    const currentSpeed = Math.sqrt(fish.vx * fish.vx + fish.vy * fish.vy);
    if (currentSpeed > fish.baseSpeed && dist >= AVOID_RADIUS) {
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

    // Bounce off edges
    if (fish.x <= 0) {
      fish.x = 0;
      fish.vx *= -1;
    } else if (fish.x + fish.width >= window.innerWidth) {
      fish.x = window.innerWidth - fish.width;
      fish.vx *= -1;
    }

    if (fish.y <= 0) {
      fish.y = 0;
      fish.vy *= -1;
    } else if (fish.y + fish.height >= window.innerHeight) {
      fish.y = window.innerHeight - fish.height;
      fish.vy *= -1;
    }

    updateFishTransform(fish);
  }

  animationFrameId = requestAnimationFrame(animate);
}