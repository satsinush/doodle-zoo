import { DEFAULT_SETTINGS } from './js/common/constants.js';
import { normalizeSettings } from './js/common/settings.js';
import { CanvasManager } from './js/popup/canvas-manager.js';
import { ToolManager } from './js/popup/tool-manager.js';
import { GalleryManager } from './js/popup/gallery-manager.js';
import { FishEditor } from './js/popup/fish-editor.js';

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const isStandalone = urlParams.get('mode') === 'window';
  if (isStandalone) document.body.classList.add('standalone');

  // DOM Elements
  const els = {
    canvas: document.getElementById('drawing-canvas'),
    guideCanvas: document.getElementById('direction-guide'),
    activeCanvas: document.getElementById('active-stroke-canvas'),
    canvasTransformWrapper: document.getElementById('canvas-transform-wrapper'),
    canvasViewport: document.querySelector('.canvas-viewport'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    clearBtn: document.getElementById('clear-btn'),
    saveBtn: document.getElementById('save-btn'),
    importFile: document.getElementById('import-file'),
    openWindowBtn: document.getElementById('open-window-btn'),
    fishList: document.getElementById('fish-list'),
    bulkToolbar: document.getElementById('bulk-toolbar'),
    bulkCount: document.getElementById('bulk-count'),
    bulkModal: document.getElementById('bulk-modal'),
    masterSelectCheckbox: document.getElementById('master-select-checkbox'),
    masterSelectWrapper: document.getElementById('master-select-wrapper'),
    bulkDelete: document.getElementById('bulk-delete'),
    bulkEditSettings: document.getElementById('bulk-edit-settings'),
    bulkActiveToggle: document.getElementById('bulk-active-toggle'),
    bulkFlipVelocity: document.getElementById('bulk-flip-velocity'),
    saveBulkBtn: document.getElementById('save-bulk-btn'),
    closeBulkModal: document.getElementById('close-bulk-modal'),
    flipHBtn: document.getElementById('flip-h-btn'),
    flipVBtn: document.getElementById('flip-v-btn'),
    colorPicker: document.getElementById('color-picker'),
    colorText: document.getElementById('color-text'),
    brushSize: document.getElementById('brush-size'),
    brushSizeDisplay: document.getElementById('brush-size-display'),
    brushPreviewContainer: document.getElementById('brush-preview-container'),
    brushPreviewFill: document.getElementById('brush-preview-fill'),
    brushPreviewOutline: document.getElementById('brush-preview-outline'),
    brushOpacity: document.getElementById('brush-opacity'),
    brushOpacityDisplay: document.getElementById('brush-opacity-display'),
    speedMultiplier: document.getElementById('speed-multiplier'),
    sizeMultiplier: document.getElementById('size-multiplier'),
    speedDisplay: document.getElementById('speed-display'),
    sizeDisplay: document.getElementById('size-display'),
    interactionType: document.getElementById('interaction-type'),
    interactionStrength: document.getElementById('interaction-strength'),
    strengthDisplay: document.getElementById('strength-display'),
    resetSettings: document.getElementById('reset-settings'),
    status: document.getElementById('status'),
    resetViewBtn: document.getElementById('reset-view-btn'),
    fishModal: document.getElementById('fish-modal'),
    modalFishPreview: document.getElementById('modal-fish-preview'),
    modalCloseBtn: document.getElementById('close-modal'),
    modalFlipHBtn: document.getElementById('modal-flip-h-btn'),
    modalFlipVBtn: document.getElementById('modal-flip-v-btn'),
    modalLockToggle: document.getElementById('modal-lock-toggle'),
    modalActiveToggle: document.getElementById('modal-active-toggle'),
    modalEditBtn: document.getElementById('modal-edit-btn'),
    modalDeleteBtn: document.getElementById('modal-delete-btn'),
    modalExportBtn: document.getElementById('modal-export-btn'),
    toolGroup: document.getElementById('tool-group'),
    toolButtons: document.querySelectorAll('[data-tool]'),
    hoverFillCanvas: document.getElementById('hover-preview-fill'),
    hoverOutlineCanvas: document.getElementById('hover-preview-outline'),
  };

  // State
  let isDrawing = false;
  let lastX = 0;
  let lastY = 0;
  let isMouseInViewport = false;
  let autoSaveTimer = null;
  let applyingSettings = false;
  let isReentering = false;
  let currentStrokePoints = [];
  let isPanning = false;
  let lastMousePos = { clientX: 0, clientY: 0 };
  let panX = 0;
  let panY = 0;

  // Init Managers
  const canvasManager = new CanvasManager(els);
  const galleryManager = new GalleryManager(els, (fish) => fishEditor.openFishModal(fish));
  const fishEditor = new FishEditor(els, canvasManager, galleryManager);
  const toolManager = new ToolManager(els, canvasManager);

  // Sync preview position when brush size changes (even if mouse doesn't move)
  els.brushSize.addEventListener('input', () => updatePreviewDisplay());

  // Settings logic
  const updateSettingsLabels = () => {
    els.speedDisplay.textContent = Number(els.speedMultiplier.value).toFixed(1);
    els.sizeDisplay.textContent = Number(els.sizeMultiplier.value).toFixed(1);
    els.strengthDisplay.textContent = Number(els.interactionStrength.value).toFixed(1);
  };

  const applyToForm = (settings) => {
    applyingSettings = true;
    els.speedMultiplier.value = settings.speedMultiplier;
    els.sizeMultiplier.value = settings.sizeMultiplier;
    els.interactionType.value = settings.interactionType;
    els.interactionStrength.value = settings.interactionStrength;
    updateSettingsLabels();
    applyingSettings = false;
  };

  const persistSettings = (statusMessage = 'Settings saved.') => {
    const settings = {
      speedMultiplier: Number(els.speedMultiplier.value),
      sizeMultiplier: Number(els.sizeMultiplier.value),
      interactionType: els.interactionType.value,
      interactionStrength: Number(els.interactionStrength.value)
    };
    chrome.storage.local.set({ doodleSettings: settings }, () => {
      els.status.textContent = statusMessage;
      if (statusMessage) setTimeout(() => els.status.textContent = '', 1600);
    });
  };

  const scheduleAutoSave = () => {
    if (applyingSettings) return;
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => persistSettings('Settings auto-saved.'), 200);
  };

  chrome.storage.local.get(['doodleSettings'], (result) => {
    applyToForm(normalizeSettings(result.doodleSettings));
  });

  // Global UI events
  els.resetSettings.onclick = () => {
    applyToForm(DEFAULT_SETTINGS);
    persistSettings('Settings reset.');
  };
  els.speedMultiplier.oninput = () => { updateSettingsLabels(); scheduleAutoSave(); };
  els.sizeMultiplier.oninput = () => { updateSettingsLabels(); scheduleAutoSave(); };
  els.interactionStrength.oninput = () => { updateSettingsLabels(); scheduleAutoSave(); };
  els.interactionType.onchange = scheduleAutoSave;
  els.clearBtn.onclick = () => canvasManager.clearCanvas();
  els.flipHBtn.onclick = () => { canvasManager.saveState(); canvasManager.flipCanvas(true, false); };
  els.flipVBtn.onclick = () => { canvasManager.saveState(); canvasManager.flipCanvas(false, true); };
  els.resetViewBtn.onclick = () => {
    canvasManager.zoomLevel = 1.0;
    panX = 0;
    panY = 0;
    canvasManager.panX = 0;
    canvasManager.panY = 0;
    canvasManager.updateViewTransform();
    toolManager.updateBrushPreview();
    updatePreviewDisplay();
  };
  els.bulkEditSettings.onclick = () => galleryManager.openBulkModal();
  els.closeBulkModal.onclick = () => els.bulkModal.classList.remove('active');

  // Drawing Orchestration
  const updatePreviewDisplay = (e = null) => {
    const dpr = window.devicePixelRatio || 1;
    if (!isDrawing && toolManager.currentTool !== 'fill') {
      canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
    }
    const clientX = e ? e.clientX : lastMousePos.clientX;
    const clientY = e ? e.clientY : lastMousePos.clientY;
    const visualRect = els.canvasViewport.getBoundingClientRect();
    const canvasRect = els.canvas.getBoundingClientRect();
    const point = canvasManager.getCanvasPoint(e || { clientX, clientY });

    if (toolManager.currentTool === 'eyedropper') {
      const isInside = (clientX >= canvasRect.left && clientX <= canvasRect.right && clientY >= canvasRect.top && clientY <= canvasRect.bottom);
      if (!isPanning && isMouseInViewport && isInside) {
        const dpr = window.devicePixelRatio || 1;
        const imgData = canvasManager.ctx.getImageData(point.x * dpr, point.y * dpr, 1, 1).data;
        if (imgData[3] > 0) {
          const hex8 = toolManager.rgbaToHex8(imgData[0], imgData[1], imgData[2], imgData[3] / 255);
          toolManager.applyColorInput(hex8, true, true);
          toolManager.updateBrushPreview(`rgba(${imgData[0]}, ${imgData[1]}, ${imgData[2]}, ${imgData[3] / 255})`, { clientX, clientY }, point);
        } else {
          if (toolManager.preHoverColor) toolManager.applyColorInput(toolManager.preHoverColor, true, true);
          toolManager.updateBrushPreview('rgba(255, 255, 255, 0.5)', { clientX, clientY }, point);
        }
      } else {
        if (toolManager.preHoverColor) toolManager.applyColorInput(toolManager.preHoverColor, true, true);
        toolManager.updateBrushPreview('rgba(255, 255, 255, 0.2)', { clientX, clientY }, point);
      }
    } else if (isMouseInViewport) {
      // Standard Tools (Layered)
      if (toolManager.currentTool === 'fill') {
        canvasManager.updateFillPreview(point.x, point.y, toolManager.currentDrawColor, toolManager.currentOpacity, (c) => toolManager.cssColorToHex(c));
      } else {
        toolManager.updateBrushPreview(null, { clientX, clientY }, point);
      }
    } else {
      toolManager.updateBrushPreview(null, { clientX, clientY }, null);
      if (!isDrawing) {
        const dpr = window.devicePixelRatio || 1;
        canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
      }
    }

    // Centering the floating previews (Specifically for eyedropper magnifier)
    if (toolManager.currentTool === 'eyedropper') {
      const dpr = window.devicePixelRatio || 1;
      const lWidth = els.brushPreviewFill.width / dpr;
      const lHeight = els.brushPreviewFill.height / dpr;
      const loWidth = els.brushPreviewOutline.width / dpr;
      const loHeight = els.brushPreviewOutline.height / dpr;

      const vMouseX = clientX - visualRect.left;
      const vMouseY = clientY - visualRect.top;
      const centerX = vMouseX;
      const centerY = vMouseY - lHeight / 2 - 20;

      els.brushPreviewFill.style.transform = '';
      els.brushPreviewOutline.style.transform = '';
      els.brushPreviewFill.style.left = `${centerX - lWidth / 2}px`;
      els.brushPreviewFill.style.top = `${centerY - lHeight / 2}px`;
      els.brushPreviewOutline.style.left = `${centerX - loWidth / 2}px`;
      els.brushPreviewOutline.style.top = `${centerY - loHeight / 2}px`;
    }
  };

  els.canvasViewport.oncontextmenu = (e) => e.preventDefault();
  els.canvasViewport.addEventListener('mouseenter', () => { isMouseInViewport = true; if (isDrawing) isReentering = true; });
  els.canvasViewport.addEventListener('mouseleave', () => {
    isMouseInViewport = false;
    if (!isDrawing) canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / (window.devicePixelRatio || 1), canvasManager.activeCanvas.height / (window.devicePixelRatio || 1));
    if (toolManager.currentTool === 'eyedropper' && toolManager.preHoverColor) {
      toolManager.applyColorInput(toolManager.preHoverColor, true, true);
    }
    els.brushPreviewFill.style.display = 'none';
    els.brushPreviewOutline.style.display = 'none';
    canvasManager.clearHover();
  });

  els.canvasViewport.addEventListener('mousedown', (e) => {
    if (e.button === 1 || e.button === 2) {
      isPanning = true;
      lastMousePos = { clientX: e.clientX, clientY: e.clientY };
      els.canvasTransformWrapper.classList.add('panning');
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      const point = canvasManager.getCanvasPoint(e);
      canvasManager.saveState();
      if (toolManager.currentTool === 'eyedropper') {
        const dpr = window.devicePixelRatio || 1;
        const imgData = canvasManager.ctx.getImageData(point.x * dpr, point.y * dpr, 1, 1).data;
        if (imgData[3] > 0) {
          const hex8 = toolManager.rgbaToHex8(imgData[0], imgData[1], imgData[2], imgData[3] / 255);
          toolManager.applyColorInput(hex8);
          toolManager.preHoverColor = hex8; // New base color to revert to if we keep the dropper active
          updatePreviewDisplay();
        }
        return;
      }
      if (toolManager.currentTool === 'fill') {
        const dpr = window.devicePixelRatio || 1;
        canvasManager.floodFill(point.x * dpr, point.y * dpr, toolManager.cssColorToHex(toolManager.currentDrawColor) || toolManager.currentDrawColor, toolManager.currentOpacity);
      } else {
        isDrawing = true; lastX = point.x; lastY = point.y;
        if (toolManager.currentTool === 'brush') {
          currentStrokePoints = [{ x: point.x, y: point.y }];
          const dpr = window.devicePixelRatio || 1;
          canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
          canvasManager.activeCtx.beginPath();
          canvasManager.activeCtx.lineCap = 'round';
          canvasManager.activeCtx.lineJoin = 'round';
          canvasManager.activeCtx.strokeStyle = toolManager.currentDrawColor;
          canvasManager.activeCtx.lineWidth = canvasManager.getLogicalBrushSize(els.brushSize.value);
          canvasManager.activeCtx.moveTo(point.x, point.y);
          canvasManager.activeCtx.lineTo(point.x, point.y);
          canvasManager.activeCtx.stroke();
        } else if (toolManager.currentTool === 'eraser') {
          canvasManager.ctx.globalCompositeOperation = 'destination-out';
          canvasManager.drawStamp(lastX, lastY, canvasManager.getLogicalBrushSize(els.brushSize.value));
        }
        canvasManager.ctx.globalCompositeOperation = 'source-over';
      }
    }
  });

  els.canvasViewport.addEventListener('mousemove', (e) => {
    if (isPanning) {
      panX += (e.clientX - lastMousePos.clientX); panY += (e.clientY - lastMousePos.clientY);
      lastMousePos = { clientX: e.clientX, clientY: e.clientY };
      canvasManager.panX = panX; canvasManager.panY = panY;
      canvasManager.updateViewTransform();
      updatePreviewDisplay(e);
      return;
    }
    if (isDrawing) {
      const { x, y } = canvasManager.getCanvasPoint(e);
      if (toolManager.currentTool === 'brush') {
        currentStrokePoints.push({ x, y, isNewPath: isReentering }); isReentering = false;
        const dpr = window.devicePixelRatio || 1;
        canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
        canvasManager.activeCtx.beginPath();
        canvasManager.activeCtx.lineCap = 'round'; canvasManager.activeCtx.lineJoin = 'round';
        canvasManager.activeCtx.strokeStyle = toolManager.currentDrawColor;
        canvasManager.activeCtx.lineWidth = canvasManager.getLogicalBrushSize(els.brushSize.value);
        if (currentStrokePoints.length > 0) {
          canvasManager.activeCtx.moveTo(currentStrokePoints[0].x, currentStrokePoints[0].y);
          currentStrokePoints.forEach(pt => pt.isNewPath ? canvasManager.activeCtx.moveTo(pt.x, pt.y) : canvasManager.activeCtx.lineTo(pt.x, pt.y));
        }
        canvasManager.activeCtx.stroke();
      } else {
        if (isReentering) { lastX = x; lastY = y; isReentering = false; }
        else canvasManager.drawInterpolatedStroke(lastX, lastY, x, y, toolManager.currentTool, canvasManager.getLogicalBrushSize(els.brushSize.value), toolManager.currentDrawColor);
      }
      lastX = x; lastY = y;
    }
    lastMousePos = { clientX: e.clientX, clientY: e.clientY };
    updatePreviewDisplay(e);
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) { isPanning = false; els.canvasTransformWrapper.classList.remove('panning'); return; }
    if (isDrawing) {
      if (toolManager.currentTool === 'brush' && currentStrokePoints.length > 0) {
        const dpr = window.devicePixelRatio || 1;
        canvasManager.ctx.save(); canvasManager.ctx.setTransform(1, 0, 0, 1, 0, 0);
        canvasManager.ctx.drawImage(canvasManager.activeCanvas, 0, 0); canvasManager.ctx.restore();
        canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
        currentStrokePoints = [];
      }
      isDrawing = false; isReentering = false;
    }
  });

  els.canvasViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      panY -= e.deltaY * 0.33;
      canvasManager.panY = panY;
    } else if (e.shiftKey) {
      panX -= e.deltaY * 0.33;
      canvasManager.panX = panX;
    } else {
      const factor = Math.pow(1.1, -e.deltaY / 100);
      const newZoom = Math.max(0.2, Math.min(10, canvasManager.zoomLevel * factor));
      const viewportRect = els.canvasTransformWrapper.parentElement.getBoundingClientRect();
      const mouseX = e.clientX - viewportRect.left, mouseY = e.clientY - viewportRect.top;
      const anchorX = (mouseX - canvasManager.panX) / canvasManager.zoomLevel, anchorY = (mouseY - canvasManager.panY) / canvasManager.zoomLevel;
      canvasManager.zoomLevel = newZoom;
      canvasManager.panX = mouseX - anchorX * newZoom; canvasManager.panY = mouseY - anchorY * newZoom;
      panX = canvasManager.panX; panY = canvasManager.panY;
    }
    canvasManager.updateViewTransform(); toolManager.updateBrushPreview(null, lastMousePos); updatePreviewDisplay(e);
  });

  els.saveBtn.onclick = () => {
    if (canvasManager.isCanvasBlank()) { alert("Please draw a fish first!"); return; }
    const tempCanvas = document.createElement('canvas'); tempCanvas.width = 400; tempCanvas.height = 300;
    const tempCtx = tempCanvas.getContext('2d');
    const currentW = Number(els.canvas.style.width.replace('px', '')), currentH = Number(els.canvas.style.height.replace('px', ''));
    const scale = Math.min(400 / currentW, 300 / currentH);
    const sw = currentW * scale, sh = currentH * scale, sx = (400 - sw) / 2, sy = (300 - sh) / 2;
    tempCtx.clearRect(0, 0, 400, 300); tempCtx.drawImage(canvasManager.canvas, sx, sy, sw, sh);
    const dataUrl = tempCanvas.toDataURL('image/png');
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      fishArray.push({ id: Date.now().toString(), dataUrl, mirrored: false, flipByVelocity: true, active: true });
      chrome.storage.local.set({ doodleFishList: fishArray }, () => { galleryManager.renderFishList(); canvasManager.clearCanvas(); });
    });
  };

  els.importFile.onchange = async (e) => {
    const files = Array.from(e.target.files || []); if (files.length === 0) return;
    const importedDataUrls = [];
    for (const file of files) {
      try {
        const sourceDataUrl = await FishEditor.fileToDataUrl(file);
        const normalizedDataUrl = await FishEditor.normalizeFishImage(sourceDataUrl);
        importedDataUrls.push(normalizedDataUrl);
      } catch (_e) { }
    }
    if (importedDataUrls.length > 0) {
      chrome.storage.local.get(['doodleFishList'], (result) => {
        const fishArray = result.doodleFishList || [];
        importedDataUrls.forEach((dataUrl, i) => fishArray.push({ id: `${Date.now()}-${i}`, dataUrl, mirrored: false, flipByVelocity: true, active: true }));
        chrome.storage.local.set({ doodleFishList: fishArray }, () => galleryManager.renderFishList());
      });
    }
    e.target.value = '';
  };

  if (!isStandalone) els.openWindowBtn.onclick = () => window.open(chrome.runtime.getURL('popup.html?mode=window'), '_blank');
  else els.openWindowBtn.style.display = 'none';

  const resizeCanvas = () => {
    const isS = isStandalone && window.innerWidth >= 750;
    const w = window.innerWidth - (isS ? 420 : 0) - (isS ? 40 : 32);
    const maxW = isStandalone ? Math.min(w, 850) : Math.min(w, 800), maxH = maxW * 0.75;
    if (Math.round(els.canvas.getBoundingClientRect().width) !== maxW) canvasManager.setCanvasSize(maxW, maxH, true);
  };

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  toolManager.applyColorInput(els.colorText.value, true);
  galleryManager.renderFishList();
});