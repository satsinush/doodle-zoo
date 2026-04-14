const DEFAULT_SETTINGS = {
  speedMultiplier: 0.5,
  sizeMultiplier: 0.5,
  interactionType: 'repel',
  interactionStrength: 1,
  gravity: 0,
  bounciness: 0.75
};

let aquariumSettings = { ...DEFAULT_SETTINGS };

function normalizeSettings(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_SETTINGS };
  const speed = Number(raw.speedMultiplier);
  const size = Number(raw.sizeMultiplier);
  const strength = Number(raw.interactionStrength);
  const gravity = Number(raw.gravity);
  const bounciness = Number(raw.bounciness);
  return {
    speedMultiplier: Number.isFinite(speed) && speed > 0 ? speed : DEFAULT_SETTINGS.speedMultiplier,
    sizeMultiplier: Number.isFinite(size) && size > 0 ? size : DEFAULT_SETTINGS.sizeMultiplier,
    interactionType: raw.interactionType === 'attract' ? 'attract' : 'repel',
    interactionStrength: Number.isFinite(strength) && strength >= 0 ? strength : DEFAULT_SETTINGS.interactionStrength,
    gravity: Number.isFinite(gravity) ? gravity : DEFAULT_SETTINGS.gravity,
    bounciness: Number.isFinite(bounciness) ? Math.max(0, Math.min(1, bounciness)) : DEFAULT_SETTINGS.bounciness
  };
}
