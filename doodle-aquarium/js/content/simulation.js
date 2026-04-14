// Simulation state
let activeFish = [];
let animationFrameId = null;
let mouseX = -1000;
let mouseY = -1000;

function animate() {
  const bounds = getViewportBounds();
  const time = Date.now() / 1000;

  for (let i = 0; i < activeFish.length; i++) {
    const fish = activeFish[i];
    const metrics = getRenderMetrics(fish);
    const speedMultiplier = fish.speedMultiplier ?? DEFAULT_SETTINGS.speedMultiplier;
    const mass = Math.max(0.01, fish.sizeMultiplier ?? DEFAULT_SETTINGS.sizeMultiplier);
    
    // Sum of forces
    let fx = 0;
    let fy = 0;

    // 1. Propulsion Force (Constant push from the fish)
    const F_propulsion = fish.baseSpeedRaw * speedMultiplier * 0.2;
    const wiggle = Math.sin(time * 2 + fish.seed) * 0.1;
    let currentAngle = Math.atan2(fish.vy, fish.vx);
    if (isNaN(currentAngle)) currentAngle = 0;

    const wander = Math.sin(time * 0.5 + fish.seed * 2) * 0.05;
    const targetAngle = currentAngle + wiggle + wander;

    fx += Math.cos(targetAngle) * F_propulsion;
    fy += Math.sin(targetAngle) * F_propulsion;

    // 2. Mouse Interaction Force (Newtonian Attraction/Repulsion)
    const interactionStrength = fish.interactionStrength ?? DEFAULT_SETTINGS.interactionStrength;
    const interactionType = fish.interactionType || DEFAULT_SETTINGS.interactionType;

    if (mouseX >= 0 && mouseY >= 0 && interactionStrength > 0) {
      const dx = fish.x - mouseX;
      const dy = fish.y - mouseY;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist === 0) dist = 0.1;
      
      const k = 5000.0; // Base force constant
      const epsilon = 1000.0; // Softening factor
      // Force is proportional to mass (sizeMultiplier) as requested
      const forceMagnitude = (k * interactionStrength * mass) / (dist * dist + epsilon);

      if (forceMagnitude > 0.01) {
        const sign = interactionType === 'attract' ? -1 : 1;
        fx += (dx / dist) * forceMagnitude * sign;
        fy += (dy / dist) * forceMagnitude * sign;
      }
    }

    // 3. Vertical Gravity Force (Sinking/Floating)
    const gravity = fish.gravity ?? DEFAULT_SETTINGS.gravity;
    if (gravity !== 0) {
      // F_g = g * mass
      fy += gravity * mass * 0.1;
    }

    // 4. Drag Force (Viscous resistance proportional to velocity)
    const dragCoeff = 0.05; 
    fx -= fish.vx * dragCoeff;
    fy -= fish.vy * dragCoeff;

    // Integration: a = F / m
    fish.vx += fx / mass;
    fish.vy += fy / mass;

    // Velocity clamping (Speed Cap)
    const MAX_SPEED = 200;
    const speedSqr = fish.vx * fish.vx + fish.vy * fish.vy;
    if (speedSqr > MAX_SPEED * MAX_SPEED) {
      const speed = Math.sqrt(speedSqr);
      fish.vx = (fish.vx / speed) * MAX_SPEED;
      fish.vy = (fish.vy / speed) * MAX_SPEED;
    }

    fish.x += fish.vx;
    fish.y += fish.vy;

    const halfW = metrics.width / 2;
    const halfH = metrics.height / 2;

    const bounciness = fish.bounciness ?? DEFAULT_SETTINGS.bounciness;
    if (fish.x - halfW <= bounds.left) { 
      fish.x = bounds.left + halfW; 
      fish.vx = Math.abs(fish.vx) * bounciness; 
    }
    else if (fish.x + halfW >= bounds.left + bounds.width) { 
      fish.x = bounds.left + bounds.width - halfW; 
      fish.vx = -Math.abs(fish.vx) * bounciness; 
    }

    if (fish.y - halfH <= bounds.top) { 
      fish.y = bounds.top + halfH; 
      fish.vy = Math.abs(fish.vy) * bounciness; 
    }
    else if (fish.y + halfH >= bounds.top + bounds.height) { 
      fish.y = bounds.top + bounds.height - halfH; 
      fish.vy = -Math.abs(fish.vy) * bounciness; 
    }

    updateFishTransform(fish);
  }
  animationFrameId = requestAnimationFrame(animate);
}
