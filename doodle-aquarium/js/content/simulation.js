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
    const propulsionStrength = fish.baseSpeedRaw * speedMultiplier * 0.2;

    const wiggle = Math.sin(time * 2 + fish.seed) * 0.1;
    let currentAngle = Math.atan2(fish.vy, fish.vx);
    if (isNaN(currentAngle)) currentAngle = 0;

    const wander = Math.sin(time * 0.5 + fish.seed * 2) * 0.05;
    const targetAngle = currentAngle + wiggle + wander;

    fish.vx += Math.cos(targetAngle) * propulsionStrength;
    fish.vy += Math.sin(targetAngle) * propulsionStrength;

    const dx = fish.x - mouseX;
    const dy = fish.y - mouseY;
    let dist = Math.sqrt(dx * dx + dy * dy);

    const interactionStrength = fish.interactionStrength ?? DEFAULT_SETTINGS.interactionStrength;
    const interactionType = fish.interactionType || DEFAULT_SETTINGS.interactionType;

    if (mouseX >= 0 && mouseY >= 0 && interactionStrength > 0) {
      if (dist === 0) dist = 0.1;
      const baseForce = 2000.0 * interactionStrength;
      const forceMagnitude = baseForce / (dist * dist + 1000);

      if (forceMagnitude > 0.01) {
        const sign = interactionType === 'attract' ? -1 : 1;
        fish.vx += (dx / dist) * forceMagnitude * sign;
        fish.vy += (dy / dist) * forceMagnitude * sign;
      }
    }

    fish.vx *= 0.95;
    fish.vy *= 0.95;
    fish.x += fish.vx;
    fish.y += fish.vy;

    const halfW = metrics.width / 2;
    const halfH = metrics.height / 2;

    if (fish.x - halfW <= bounds.left) { fish.x = bounds.left + halfW; fish.vx = Math.abs(fish.vx); }
    else if (fish.x + halfW >= bounds.left + bounds.width) { fish.x = bounds.left + bounds.width - halfW; fish.vx = -Math.abs(fish.vx); }
    if (fish.y - halfH <= bounds.top) { fish.y = bounds.top + halfH; fish.vy = Math.abs(fish.vy); }
    else if (fish.y + halfH >= bounds.top + bounds.height) { fish.y = bounds.top + bounds.height - halfH; fish.vy = -Math.abs(fish.vy); }

    updateFishTransform(fish);
  }
  animationFrameId = requestAnimationFrame(animate);
}
