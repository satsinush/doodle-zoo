import { DEFAULT_SETTINGS, GLOBAL_UI_SETTINGS } from './constants.js';

export function normalizeFishSettings(raw) {
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
