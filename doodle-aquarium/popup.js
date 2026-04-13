import { DEFAULT_SETTINGS, GLOBAL_UI_SETTINGS } from './js/common/constants.js';
import { normalizeFishSettings, normalizeGlobalSettings } from './js/common/settings.js';
import { CanvasManager } from './js/popup/canvas-manager.js';
import { ToolManager } from './js/popup/tool-manager.js';
import { GalleryManager } from './js/popup/gallery-manager.js';
import { FishEditor } from './js/popup/fish-editor.js';
import { HistoryManager } from './js/popup/history-manager.js';

function generateUID() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

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
    bulkExportSelected: document.getElementById('bulk-export-selected'),
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
    resetSettings: document.getElementById('reset-settings'),
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
    modalSaveBtn: document.getElementById('modal-save-btn'),
    toolGroup: document.getElementById('tool-group'),
    toolButtons: document.querySelectorAll('[data-tool]'),
    hoverFillCanvas: document.getElementById('hover-preview-fill'),
    hoverOutlineCanvas: document.getElementById('hover-preview-outline'),
    newFishBtn: document.getElementById('new-fish-btn'),
    saveBtnText: document.getElementById('save-btn-text'),
    globalSettingsBtn: document.getElementById('global-settings-btn'),
    globalSettingsModal: document.getElementById('global-settings-modal'),
    closeGlobalModal: document.getElementById('close-global-modal'),
    globalShowEraserOutline: document.getElementById('global-show-eraser-outline'),
    globalShowBrushFill: document.getElementById('global-show-brush-fill'),
    globalShowBucketHover: document.getElementById('global-show-bucket-hover'),
    globalShowEyedropper: document.getElementById('global-show-eyedropper'),
    helpBtn: document.getElementById('help-btn'),
    helpModal: document.getElementById('help-modal'),
    closeHelpModal: document.getElementById('close-help-modal'),
    bulkDeleteSelected: document.getElementById('bulk-delete-selected'),
    galleryContextMenu: document.getElementById('gallery-context-menu'),
    ctxSettings: document.getElementById('ctx-settings'),
    ctxEditFish: document.getElementById('ctx-edit-fish'),
    ctxDelete: document.getElementById('ctx-delete'),
    ctxExport: document.getElementById('ctx-export'),
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
  let currentEditingFishId = null;
  let activePointers = new Map();
  let initialPinchDistance = 0;
  let initialPinchZoom = 1;
  let initialPinchPanX = 0;
  let initialPinchPanY = 0;
  let initialPinchMidpoint = { x: 0, y: 0 };
  let lastPointerType = 'mouse';

  // Init Managers
  const historyManager = new HistoryManager(els, {
    onStackChange: () => {
      // Any extra logic needed when history changes
    }
  });

  const canvasManager = new CanvasManager(els, {
    onRestoreComplete: () => {
      canvasManager.lastFillPoint = { x: -999, y: -999, color: null };
      updatePreviewDisplay();
    }
  });
  canvasManager.history = historyManager;

  const handleEditFish = (targetFish) => {
    // Prevent redundant navigation (e.g., clicking 'New' on a blank canvas or 'Edit' on the current fish)
    if (currentEditingFishId === targetFish.id) {
      if (targetFish.id === null && canvasManager.isCanvasBlank()) return;
      if (targetFish.id !== null) return;
    }

    // Capture transition to new fish
    const oldId = currentEditingFishId;
    const oldUrl = canvasManager.canvas.toDataURL('image/png');
    
    historyManager.push({
      type: 'navigate',
      data: {
        oldId,
        newId: targetFish.id,
        oldUrl,
        newUrl: targetFish.dataUrl
      },
      description: targetFish.id === null ? 'New Fish' : 'Edit Fish'
    });

    fishEditor.loadFishIntoCanvas(targetFish.id, targetFish.dataUrl);
  };

  const galleryManager = new GalleryManager(els, {
    onOpenSettings: (fish) => fishEditor.openFishModal(fish),
    onEditFish: (targetFish) => handleEditFish(targetFish)
  });
  galleryManager.history = historyManager;

  const fishEditor = new FishEditor(els, canvasManager, galleryManager, {
    onEdit: (id) => setEditingState(id),
    onNavigate: (fish) => handleEditFish(fish),
    onNew: () => resetEditingState()
  });
  fishEditor.history = historyManager;

  // Expose for history manager access
  window.appState = { 
    canvasManager, 
    galleryManager,
    fishEditor,
    currentEditingFishId: () => currentEditingFishId,
    setEditingState: (id) => id ? setEditingState(id) : resetEditingState(),
    applyGlobalSettingsToForm: (settings) => applyGlobalSettingsToForm(settings)
  };

  const toolManager = new ToolManager(els, canvasManager, {
    onToolChange: (tool) => {
      currentStrokePoints = [];
      const dpr = window.devicePixelRatio || 1;
      canvasManager.activeCtx.setTransform(1, 0, 0, 1, 0, 0);
      canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width, canvasManager.activeCanvas.height);
      canvasManager.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      canvasManager.lastFillPoint = { x: -999, y: -999, color: null };
      updatePreviewDisplay();
    }
  });

  // Sync preview position when brush size changes (even if mouse doesn't move)
  els.brushSize.addEventListener('input', () => updatePreviewDisplay());

  // Global UI Settings
  let currentGlobalSettings = { ...GLOBAL_UI_SETTINGS };

  const applyGlobalSettingsToForm = (settings) => {
    applyingSettings = true;
    els.globalShowEraserOutline.checked = settings.showEraserOutline;
    els.globalShowBrushFill.checked = settings.showBrushFill;
    els.globalShowBucketHover.checked = settings.showBucketHover;
    els.globalShowEyedropper.checked = settings.showEyedropperPreview;
    applyingSettings = false;
  };

  const persistGlobalSettings = () => {
    if (applyingSettings) return;

    const oldSettings = { ...currentGlobalSettings };
    const newSettings = {
      showEraserOutline: els.globalShowEraserOutline.checked,
      showBrushFill: els.globalShowBrushFill.checked,
      showBucketHover: els.globalShowBucketHover.checked,
      showEyedropperPreview: els.globalShowEyedropper.checked
    };
    
    // Only push to history if actually changed and not currently being applied from history
    if (JSON.stringify(oldSettings) !== JSON.stringify(newSettings)) {
      historyManager.push({
        type: 'global_settings',
        data: { oldSettings, newSettings },
        description: 'Global Settings'
      });
      currentGlobalSettings = newSettings;
      chrome.storage.local.set({ globalUISettings: currentGlobalSettings });
      updatePreviewDisplay();
    }
  };

  chrome.storage.local.get(['globalUISettings'], (res) => {
    let settings = res.globalUISettings;
    if (!settings) {
      settings = GLOBAL_UI_SETTINGS;
      chrome.storage.local.set({ globalUISettings: settings });
    } else {
      settings = normalizeGlobalSettings(settings);
    }
    currentGlobalSettings = settings;
    applyGlobalSettingsToForm(settings);
  });

  els.globalShowEraserOutline.addEventListener('change', () => !applyingSettings && persistGlobalSettings());
  els.globalShowBrushFill.addEventListener('change', () => !applyingSettings && persistGlobalSettings());
  els.globalShowBucketHover.addEventListener('change', () => !applyingSettings && persistGlobalSettings());
  els.globalShowEyedropper.addEventListener('change', () => !applyingSettings && persistGlobalSettings());

  els.globalSettingsBtn.addEventListener('click', () => {
    els.globalSettingsModal.classList.add('active');
  });

  els.closeGlobalModal.addEventListener('click', () => {
    els.globalSettingsModal.classList.remove('active');
  });

  els.globalSettingsModal.addEventListener('click', (e) => {
    if (e.target === els.globalSettingsModal) els.globalSettingsModal.classList.remove('active');
  });

  const resetEditingState = () => {
    currentEditingFishId = null;
    galleryManager.renderFishList(null);
  };

  const setEditingState = (id) => {
    currentEditingFishId = id;
    galleryManager.renderFishList(id);
  };

  // Reset UI for a fresh start
  const startNewFish = () => {
    handleEditFish({ id: null, dataUrl: null });
  };

  const saveFish = (forceNew = false) => {


    const tempCanvas = document.createElement('canvas'); tempCanvas.width = 400; tempCanvas.height = 300;
    const tempCtx = tempCanvas.getContext('2d');
    const currentW = Number(els.canvas.style.width.replace('px', '')), currentH = Number(els.canvas.style.height.replace('px', ''));
    const scale = Math.min(400 / currentW, 300 / currentH);
    const sw = currentW * scale, sh = currentH * scale, sx = (400 - sw) / 2, sy = (300 - sh) / 2;
    tempCtx.clearRect(0, 0, 400, 300); tempCtx.drawImage(canvasManager.canvas, sx, sy, sw, sh);
    const dataUrl = tempCanvas.toDataURL('image/png');

    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];

      if (!forceNew && currentEditingFishId) {
        const idx = fishArray.findIndex(f => f.id === currentEditingFishId);
        if (idx !== -1) {
          const oldDataUrl = fishArray[idx].dataUrl;
          if (oldDataUrl !== dataUrl) {
            historyManager.push({
              type: 'save_commit',
              id: currentEditingFishId,
              data: { oldUrl: oldDataUrl, newUrl: dataUrl },
              description: 'Updated Fish'
            });
          }
          fishArray[idx].dataUrl = dataUrl;
          chrome.storage.local.set({ doodleFishList: fishArray }, () => {
            historyManager.showToast('Fish updated.');
            galleryManager.renderFishList(currentEditingFishId);
          });
          return;
        }
      }

      const newId = generateUID();
      const newFishData = { id: newId, dataUrl, mirrored: false, flipByVelocity: true, active: true, ...DEFAULT_SETTINGS };
      fishArray.push(newFishData);

      historyManager.push({
        type: 'create',
        id: newId,
        data: { fishData: newFishData },
        description: 'New Fish Created'
      });

      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        setEditingState(newId);
        historyManager.showToast('New fish saved.');
        galleryManager.renderFishList(currentEditingFishId);
      });
    });
  };

  els.clearBtn.onclick = () => { canvasManager.clearCanvas(currentEditingFishId); };
  els.newFishBtn.onclick = startNewFish;
  els.saveBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    saveFish(false);
  });

  // Global Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const isCtrl = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;
    const key = e.key.toLowerCase();

    // Tools
    if (!isCtrl && !isShift) {
      if (key === 'b') { toolManager.setTool('brush'); updatePreviewDisplay(); }
      if (key === 'e') { toolManager.setTool('eraser'); updatePreviewDisplay(); }
      if (key === 'f') { toolManager.setTool('fill'); updatePreviewDisplay(); }
      if (key === 'd') { toolManager.setTool('eyedropper'); updatePreviewDisplay(); }
    }

    // Commands
    if (isCtrl) {
      if (!isShift && key === 'z') { e.preventDefault(); historyManager.undo(window.appState); }
      if (!isShift && key === 'y') { e.preventDefault(); historyManager.redo(window.appState); }
      if (!isShift && key === 'n') { e.preventDefault(); startNewFish(); }
      if (key === 's') { e.preventDefault(); saveFish(isShift); }
    }
  });

  els.undoBtn.onclick = () => historyManager.undo(window.appState);
  els.redoBtn.onclick = () => historyManager.redo(window.appState);

  els.flipHBtn.onclick = () => { canvasManager.flipCanvas(true, false); canvasManager.saveState(currentEditingFishId, 'Flip Horizontal'); };
  els.flipVBtn.onclick = () => { canvasManager.flipCanvas(false, true); canvasManager.saveState(currentEditingFishId, 'Flip Vertical'); };
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
  els.helpBtn.onclick = () => els.helpModal.classList.add('active');
  els.closeHelpModal.onclick = () => els.helpModal.classList.remove('active');

  // Drawing Orchestration
  const updatePreviewDisplay = (e = null) => {
    const dpr = window.devicePixelRatio || 1;

    // Always track latest mouse position immediately
    if (e) lastMousePos = { clientX: e.clientX, clientY: e.clientY };

    // 1. Mandatory Cleanup Run - clean up active layer if not drawing
    canvasManager.clearHover();
    if (!isDrawing && toolManager.currentTool !== 'fill') {
      canvasManager.activeCtx.setTransform(1, 0, 0, 1, 0, 0);
      canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width, canvasManager.activeCanvas.height);
      canvasManager.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    els.brushPreviewFill.style.display = 'none';
    els.brushPreviewOutline.style.display = 'none';

    // 2. Early Exits (Out of viewport, no mouse tracking, or currently navigating)
    if (isPanning || activePointers.size > 1) {
      els.brushPreviewFill.style.display = 'none';
      els.brushPreviewOutline.style.display = 'none';
      return;
    }
    if (!lastMousePos || lastMousePos.clientX === undefined || !isMouseInViewport) return;

    // 3. Logic Setup
    const clientX = lastMousePos.clientX;
    const clientY = lastMousePos.clientY;
    const point = canvasManager.getCanvasPoint(lastMousePos);

    // 4. Tool Specific Drawing
    if (toolManager.currentTool === 'eyedropper') {
      if (!currentGlobalSettings.showEyedropperPreview) return;
      els.brushPreviewFill.style.display = 'block';
      els.brushPreviewOutline.style.display = 'block';

      const canvasRect = els.canvas.getBoundingClientRect();
      const isInsideCanvas = (
        clientX >= canvasRect.left && clientX <= canvasRect.right &&
        clientY >= canvasRect.top && clientY <= canvasRect.bottom
      );

      let pointColor = 'rgba(255, 255, 255, 0.2)';
      if (!isPanning && isInsideCanvas) {
        const imgData = canvasManager.ctx.getImageData(point.x * dpr, point.y * dpr, 1, 1).data;
        if (imgData[3] > 0) {
          const hex8 = toolManager.rgbaToHex8(imgData[0], imgData[1], imgData[2], imgData[3] / 255);
          toolManager.applyColorInput(hex8, true, true);
          pointColor = `rgba(${imgData[0]}, ${imgData[1]}, ${imgData[2]}, ${imgData[3] / 255})`;
        } else if (toolManager.preHoverColor) {
          toolManager.applyColorInput(toolManager.preHoverColor, true, true);
          pointColor = 'rgba(255, 255, 255, 0.5)';
        }
      } else if (toolManager.preHoverColor) {
        toolManager.applyColorInput(toolManager.preHoverColor, true, true);
      }

      toolManager.drawEyedropperLens(point, pointColor);

      // DOM positioning
      const visualRect = els.canvasViewport.getBoundingClientRect();
      const hw = (els.brushPreviewFill.width / dpr) / 2;
      const hh = (els.brushPreviewFill.height / dpr) / 2;
      const oW = (els.brushPreviewOutline.width / dpr) / 2;
      const oH = (els.brushPreviewOutline.height / dpr) / 2;

      const centerX = clientX - visualRect.left;
      const centerY = clientY - visualRect.top - hh - 20;

      els.brushPreviewFill.style.transform = '';
      els.brushPreviewOutline.style.transform = '';
      els.brushPreviewFill.style.left = `${centerX - hw}px`;
      els.brushPreviewFill.style.top = `${centerY - hh}px`;
      els.brushPreviewOutline.style.left = `${centerX - oW}px`;
      els.brushPreviewOutline.style.top = `${centerY - oH}px`;

    } else if (toolManager.currentTool === 'fill') {
      if (currentGlobalSettings.showBucketHover) {
        canvasManager.updateFillPreview(point.x, point.y, toolManager.currentDrawColor, toolManager.currentOpacity, (c) => toolManager.cssColorToHex(c));
      }
    } else if (toolManager.currentTool === 'brush' || toolManager.currentTool === 'eraser') {
      toolManager.drawBrushReticle(point, null, currentGlobalSettings.showBrushFill, currentGlobalSettings.showEraserOutline);
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

  els.canvasViewport.addEventListener('pointerdown', (e) => {
    lastPointerType = e.pointerType;
    // Limit to 2 pointers to prevent issues with triple-touch gestures
    if (activePointers.size >= 2) return;

    // Enable pointer capture to ensure we get events even if user moves outside the viewport
    try { els.canvasViewport.setPointerCapture(e.pointerId); } catch (_err) { }

    activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

    // Handle Multi-Touch Gesture Initialization
    if (activePointers.size === 2) {
      isDrawing = false;
      isPanning = false;
      const pts = Array.from(activePointers.values());
      const dx = pts[0].clientX - pts[1].clientX;
      const dy = pts[0].clientY - pts[1].clientY;
      initialPinchDistance = Math.hypot(dx, dy);
      initialPinchZoom = canvasManager.zoomLevel;
      initialPinchPanX = canvasManager.panX;
      initialPinchPanY = canvasManager.panY;
      initialPinchMidpoint = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2
      };

      // Clear active stroke if any
      const dpr = window.devicePixelRatio || 1;
      canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
      currentStrokePoints = [];
      return;
    }

    if (e.button === 1 || e.button === 2) {
      isPanning = true;
      lastMousePos = { clientX: e.clientX, clientY: e.clientY };
      els.canvasTransformWrapper.classList.add('panning');
      e.preventDefault();
      return;
    }
    if (e.button === 0) {
      isMouseInViewport = true;
      updatePreviewDisplay(e); // Force immediately sync to cure the first-click bug
      const point = canvasManager.getCanvasPoint(e);
      canvasManager.updateSnapshot();

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
        canvasManager.saveState(currentEditingFishId, 'Flood Fill');
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
          const dpr = window.devicePixelRatio || 1;
          canvasManager.activeCtx.setTransform(1, 0, 0, 1, 0, 0);
          canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width, canvasManager.activeCanvas.height);
          canvasManager.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

          canvasManager.drawInterpolatedStroke(lastX, lastY, lastX, lastY, 'eraser', canvasManager.getLogicalBrushSize(els.brushSize.value));
        }
      }
    }
    updatePreviewDisplay(e);
  });

  els.canvasViewport.addEventListener('pointermove', (e) => {
    lastPointerType = e.pointerType;
    isMouseInViewport = true;
    // Only track move data for pointers that are currently 'down' (drawing or panning)
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    // Handle Multi-Touch Gestures (Pinch & Pan)
    if (activePointers.size === 2) {
      els.canvasTransformWrapper.classList.add('panning');
      const pts = Array.from(activePointers.values());
      const dx = pts[0].clientX - pts[1].clientX;
      const dy = pts[0].clientY - pts[1].clientY;
      const currentDistance = Math.hypot(dx, dy);
      const currentMidpoint = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2
      };

      if (initialPinchDistance > 0) {
        // 1. Calculate and apply Zoom level
        const zoomFactor = currentDistance / initialPinchDistance;
        const newZoom = Math.max(0.1, Math.min(15, initialPinchZoom * zoomFactor));
        canvasManager.zoomLevel = newZoom;

        // 2. Calculate and apply Pan shift
        const shiftX = currentMidpoint.x - initialPinchMidpoint.x;
        const shiftY = currentMidpoint.y - initialPinchMidpoint.y;

        canvasManager.panX = initialPinchPanX + shiftX;
        canvasManager.panY = initialPinchPanY + shiftY;
        panX = canvasManager.panX;
        panY = canvasManager.panY;

        canvasManager.updateViewTransform();
        toolManager.updateBrushPreview();
        updatePreviewDisplay();
      }
      return;
    }

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
        currentStrokePoints.push({ x, y, isNewPath: isReentering });
        isReentering = false;

        const dpr = window.devicePixelRatio || 1;
        canvasManager.activeCtx.setTransform(1, 0, 0, 1, 0, 0);
        canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width, canvasManager.activeCanvas.height);
        canvasManager.activeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

        canvasManager.activeCtx.beginPath();
        canvasManager.activeCtx.lineCap = 'round';
        canvasManager.activeCtx.lineJoin = 'round';
        canvasManager.activeCtx.strokeStyle = toolManager.currentDrawColor;
        canvasManager.activeCtx.lineWidth = canvasManager.getLogicalBrushSize(els.brushSize.value);

        if (currentStrokePoints.length > 0) {
          canvasManager.activeCtx.moveTo(currentStrokePoints[0].x, currentStrokePoints[0].y);
          currentStrokePoints.forEach(pt => {
            if (pt.isNewPath) canvasManager.activeCtx.moveTo(pt.x, pt.y);
            else canvasManager.activeCtx.lineTo(pt.x, pt.y);
          });
        }
        canvasManager.activeCtx.stroke();
      } else if (toolManager.currentTool === 'eraser') {
        if (isReentering) {
          lastX = x;
          lastY = y;
          isReentering = false;
        }
        canvasManager.drawInterpolatedStroke(lastX, lastY, x, y, 'eraser', canvasManager.getLogicalBrushSize(els.brushSize.value));
      }
      lastX = x; lastY = y;
    }
    lastMousePos = { clientX: e.clientX, clientY: e.clientY };
    updatePreviewDisplay(e);
  });

  window.addEventListener('pointerup', (e) => {
    activePointers.delete(e.pointerId);
    try { els.canvasViewport.releasePointerCapture(e.pointerId); } catch (_err) { }

    // Cleanup panning class if no longer multi-touching or mouse-panning
    if (activePointers.size < 2 && !isPanning) {
      els.canvasTransformWrapper.classList.remove('panning');
    }

    // If we transition from 2 to 1 finger, we should reset the dragging state
    // so we don't 'jump' based on the old mouse position
    if (activePointers.size === 1) {
      const remaining = activePointers.values().next().value;
      lastMousePos = { clientX: remaining.clientX, clientY: remaining.clientY };
    }

    // Touch devices don't hover, so hide preview on lift. 
    // Stylus/Mouse do hover, so we preserve their visibility.
    if (e.pointerType === 'touch') {
      isMouseInViewport = false;
      updatePreviewDisplay();
    }
    if (isPanning) { isPanning = false; els.canvasTransformWrapper.classList.remove('panning'); return; }
    if (isDrawing) {
      const { x, y } = canvasManager.getCanvasPoint(e);
      if (toolManager.currentTool === 'brush' && currentStrokePoints.length > 1) {
        const dpr = window.devicePixelRatio || 1;
        canvasManager.ctx.save(); 
        canvasManager.ctx.setTransform(1, 0, 0, 1, 0, 0);
        canvasManager.ctx.drawImage(canvasManager.activeCanvas, 0, 0); 
        canvasManager.ctx.restore();
        canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
        currentStrokePoints = [];
        canvasManager.saveState(currentEditingFishId, 'Brush Stroke');
      } else if (toolManager.currentTool === 'eraser') {
        canvasManager.saveState(currentEditingFishId, 'Eraser');
      } else {
         // If brush was too short (single tap), clear active canvas anyway
         const dpr = window.devicePixelRatio || 1;
         canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
         currentStrokePoints = [];
      }
      isDrawing = false; 
      isReentering = false;
    }
  });

  window.addEventListener('pointercancel', (e) => {
    activePointers.delete(e.pointerId);
    try { els.canvasViewport.releasePointerCapture(e.pointerId); } catch (_err) { }
    isPanning = false;
    isDrawing = false;
    isReentering = false;
    currentStrokePoints = [];
    els.canvasTransformWrapper.classList.remove('panning');
    const dpr = window.devicePixelRatio || 1;
    canvasManager.activeCtx.clearRect(0, 0, canvasManager.activeCanvas.width / dpr, canvasManager.activeCanvas.height / dpr);
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

  // saveBtn logic is handled by the event listener and the saveFish function above.

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
        importedDataUrls.forEach((dataUrl) => {
          const newId = generateUID();
          fishArray.push({ id: newId, dataUrl, mirrored: false, flipByVelocity: true, active: true, ...DEFAULT_SETTINGS });

          historyManager.push({
            type: 'create',
            id: newId,
            description: 'Imported Fish'
          });
        });
        chrome.storage.local.set({ doodleFishList: fishArray }, () => galleryManager.renderFishList(currentEditingFishId));
      });
    }
    e.target.value = '';
  };

  if (!isStandalone) els.openWindowBtn.onclick = () => window.open(chrome.runtime.getURL('popup.html?mode=window'), '_blank');
  else els.openWindowBtn.style.display = 'none';

  const resizeCanvas = () => {
    const isS = isStandalone && window.innerWidth >= 1000;
    const w = window.innerWidth - (isS ? 420 : 0) - (isS ? 40 : 32);
    const maxW = Math.round(isStandalone ? Math.min(w, 850) : Math.min(w, 800)), maxH = Math.round(maxW * 0.75);
    if (Math.round(els.canvas.getBoundingClientRect().width) !== maxW) canvasManager.setCanvasSize(maxW, maxH, true);
  };

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
  toolManager.applyColorInput(els.colorText.value, true);
  els.bulkExportSelected.addEventListener('click', () => {
    galleryManager.exportSelectedIndividually();
  });
  galleryManager.renderFishList(currentEditingFishId);
});