import { DEFAULT_SETTINGS, GLOBAL_UI_SETTINGS } from './constants.js';

export function normalizeFishSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SETTINGS };
  }
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

export function validateFishJSON(jsonString) {
  try {
    let data = JSON.parse(jsonString);
    if (!Array.isArray(data)) data = [data];

    const validated = data.map(raw => {
      if (!raw.dataUrl) return null;
      
      const normalized = normalizeFishSettings(raw);
      return {
        id: Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9),
        dataUrl: raw.dataUrl,
        active: raw.active !== undefined ? !!raw.active : true,
        flipByVelocity: raw.flipByVelocity !== undefined ? !!raw.flipByVelocity : true,
        mirrored: !!raw.mirrored,
        ...normalized
      };
    }).filter(f => f !== null);

    return validated;
  } catch (e) {
    console.error('Invalid JSON import:', e);
    return [];
  }
}

export function normalizeGlobalSettings(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...GLOBAL_UI_SETTINGS };
  }
  return {
    showBrushFill: raw.showBrushFill !== undefined ? Boolean(raw.showBrushFill) : GLOBAL_UI_SETTINGS.showBrushFill,
    showEraserOutline: raw.showEraserOutline !== undefined ? Boolean(raw.showEraserOutline) : GLOBAL_UI_SETTINGS.showEraserOutline,
    showBucketHover: raw.showBucketHover !== undefined ? Boolean(raw.showBucketHover) : GLOBAL_UI_SETTINGS.showBucketHover,
    showEyedropperPreview: raw.showEyedropperPreview !== undefined ? Boolean(raw.showEyedropperPreview) : GLOBAL_UI_SETTINGS.showEyedropperPreview
  };
}
