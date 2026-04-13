import { DEFAULT_SETTINGS, GLOBAL_UI_SETTINGS } from '../common/constants.js';

export class FishEditor {
  constructor(elements, canvasManager, galleryManager, callbacks = {}) {
    this.elements = elements;
    this.canvasManager = canvasManager;
    this.galleryManager = galleryManager;
    this.callbacks = callbacks;

    this.physicsDOM = {
      speedMultiplier: document.getElementById('modal-speed-multiplier'),
      sizeMultiplier: document.getElementById('modal-size-multiplier'),
      interactionType: document.getElementById('modal-interaction-type'),
      interactionStrength: document.getElementById('modal-interaction-strength'),
      speedDisplay: document.getElementById('modal-speed-display'),
      sizeDisplay: document.getElementById('modal-size-display'),
      strengthDisplay: document.getElementById('modal-strength-display')
    };
    this.history = null; // Will be set by popup.js
    this.currentFishId = null;
    this.setupListeners();
  }

  syncSettingsUI(fish) {
    if (!fish || fish.id !== this.currentFishId) return;

    // Physic values
    this.physicsDOM.speedMultiplier.value = fish.speedMultiplier;
    this.physicsDOM.speedDisplay.value = fish.speedMultiplier.toFixed(1);

    this.physicsDOM.sizeMultiplier.value = fish.sizeMultiplier;
    this.physicsDOM.sizeDisplay.value = fish.sizeMultiplier.toFixed(1);

    this.physicsDOM.interactionType.value = fish.interactionType;

    this.physicsDOM.interactionStrength.value = fish.interactionStrength;
    this.physicsDOM.strengthDisplay.value = fish.interactionStrength.toFixed(1);

    // Toggles
    if (this.elements.modalLockToggle) this.elements.modalLockToggle.checked = fish.flipByVelocity;
    if (this.elements.modalActiveToggle) this.elements.modalActiveToggle.checked = fish.active;
  }

  setupListeners() {
    this.elements.modalCloseBtn?.addEventListener('click', () => this.closeFishModal());
    this.elements.fishModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.fishModal) this.closeFishModal();
    });

    this.elements.modalEditBtn?.addEventListener('click', () => {
      this.closeFishModal();
      if (this.callbacks.onNavigate) {
        // Pass the fish object to trigger full navigation history
        chrome.storage.local.get(['doodleFishList'], (res) => {
          const list = res.doodleFishList || [];
          const fish = list.find(f => f.id === this.currentFishId);
          if (fish) this.callbacks.onNavigate(fish);
        });
      }
    });

    this.elements.modalDeleteBtn?.addEventListener('click', () => {
      this.closeFishModal();
      this.deleteFish(this.currentFishId);
    });

    this.elements.modalExportBtn?.addEventListener('click', () => {
      this.exportFish({ dataUrl: this.elements.modalFishPreview.src });
    });

    const persistPhysics = () => {
      chrome.storage.local.get(['doodleFishList'], (result) => {
        const fishArray = result.doodleFishList || [];
        const index = fishArray.findIndex(f => f.id === this.currentFishId);
        if (index !== -1) {
          const fish = fishArray[index];
          const oldSettings = {
            speedMultiplier: fish.speedMultiplier,
            sizeMultiplier: fish.sizeMultiplier,
            interactionType: fish.interactionType,
            interactionStrength: fish.interactionStrength,
            active: fish.active,
            flipByVelocity: fish.flipByVelocity
          };

          fish.speedMultiplier = Number(this.physicsDOM.speedMultiplier.value);
          fish.sizeMultiplier = Number(this.physicsDOM.sizeMultiplier.value);
          fish.interactionType = this.physicsDOM.interactionType.value;
          fish.interactionStrength = Number(this.physicsDOM.interactionStrength.value);
          fish.active = this.elements.modalActiveToggle.checked;
          fish.flipByVelocity = this.elements.modalLockToggle.checked;

          const newSettings = {
            speedMultiplier: fish.speedMultiplier,
            sizeMultiplier: fish.sizeMultiplier,
            interactionType: fish.interactionType,
            interactionStrength: fish.interactionStrength,
            active: fish.active,
            flipByVelocity: fish.flipByVelocity
          };

          if (this.history && JSON.stringify(oldSettings) !== JSON.stringify(newSettings)) {
            this.history.push({
              type: 'settings',
              id: this.currentFishId,
              data: { id: this.currentFishId, oldSettings, newSettings },
              description: 'Fish Settings Change'
            });
          }

          chrome.storage.local.set({ doodleFishList: fishArray }, () => {
            const activeEditId = window.appState ? window.appState.currentEditingFishId() : null;
            this.galleryManager.renderFishList(activeEditId);
            this.closeFishModal();
          });
        }
      });
    };

    this.elements.modalSaveBtn?.addEventListener('click', () => persistPhysics());

    this.physicsDOM.speedMultiplier?.addEventListener('input', (e) => {
      this.physicsDOM.speedDisplay.value = Number(e.target.value).toFixed(1);
    });
    this.physicsDOM.speedDisplay?.addEventListener('change', (e) => {
      let val = Math.max(0.0, Math.min(3.0, Number(e.target.value) || 0));
      this.physicsDOM.speedMultiplier.value = val;
      e.target.value = val.toFixed(1);
    });
    this.physicsDOM.sizeMultiplier?.addEventListener('input', (e) => {
      this.physicsDOM.sizeDisplay.value = Number(e.target.value).toFixed(1);
    });
    this.physicsDOM.sizeDisplay?.addEventListener('change', (e) => {
      let val = Math.max(0.1, Math.min(3.0, Number(e.target.value) || 0));
      this.physicsDOM.sizeMultiplier.value = val;
      e.target.value = val.toFixed(1);
    });
    this.physicsDOM.interactionStrength?.addEventListener('input', (e) => {
      this.physicsDOM.strengthDisplay.value = Number(e.target.value).toFixed(1);
    });
    this.physicsDOM.strengthDisplay?.addEventListener('change', (e) => {
      let val = Math.max(0.0, Math.min(5.0, Number(e.target.value) || 0));
      this.physicsDOM.interactionStrength.value = val;
      e.target.value = val.toFixed(1);
    });
  }

  openFishModal(fish) {
    this.currentFishId = fish.id;
    document.body.style.overflow = 'hidden';
    this.elements.modalFishPreview.src = fish.dataUrl;
    this.elements.modalActiveToggle.checked = fish.active !== false;
    this.elements.modalLockToggle.checked = fish.flipByVelocity !== false;
    this.elements.modalFishPreview.style.transform = '';

    // Apply defaults if they imported old models that lack them
    const physics = { ...DEFAULT_SETTINGS, ...fish };
    this.physicsDOM.speedMultiplier.value = physics.speedMultiplier;
    this.physicsDOM.sizeMultiplier.value = physics.sizeMultiplier;
    this.physicsDOM.interactionType.value = physics.interactionType;
    this.physicsDOM.interactionStrength.value = physics.interactionStrength;

    this.physicsDOM.speedDisplay.value = Number(physics.speedMultiplier).toFixed(1);
    this.physicsDOM.sizeDisplay.value = Number(physics.sizeMultiplier).toFixed(1);
    this.physicsDOM.strengthDisplay.value = Number(physics.interactionStrength).toFixed(1);

    this.elements.fishModal.classList.add('active');
  }

  closeFishModal() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    this.elements.fishModal.classList.remove('active');
  }

  loadFishIntoCanvas(id, dataUrl) {
    if (!dataUrl) {
      this.canvasManager.restoreState(null);
      if (this.callbacks.onEdit) this.callbacks.onEdit(id);
      return;
    }
    const imgObj = new Image();
    imgObj.onload = () => {
      const dpr = window.devicePixelRatio || 1;
      const cw = this.canvasManager.canvas.width / dpr;
      const ch = this.canvasManager.canvas.height / dpr;
      this.canvasManager.ctx.clearRect(0, 0, cw, ch);
      const boxScale = Math.min(cw / 400, ch / 300);
      const dw = 400 * boxScale;
      const dh = 300 * boxScale;
      const dx = (cw - dw) / 2;
      const dy = (ch - dh) / 2;
      this.canvasManager.ctx.drawImage(imgObj, dx, dy, dw, dh);
      this.canvasManager.updateSnapshot();

      if (this.callbacks.onEdit) this.callbacks.onEdit(id);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    imgObj.src = dataUrl;
  }

  exportFish(fish) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = 400;
    tempCanvas.height = 300;
    const tempCtx = tempCanvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      tempCtx.drawImage(img, 0, 0, 400, 300);
      const dataUrl = tempCanvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `doodle-fish-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
    img.src = fish.dataUrl;
  }

  static async fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });
  }

  static async normalizeFishImage(dataUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(400 / img.width, 300 / img.height);
        const finalW = img.width * scale;
        const finalH = img.height * scale;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 300;
        const tempCtx = tempCanvas.getContext('2d');
        const x = (400 - finalW) / 2;
        const y = (300 - finalH) / 2;
        tempCtx.drawImage(img, x, y, finalW, finalH);
        resolve(tempCanvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('Invalid image file'));
      img.src = dataUrl;
    });
  }

  deleteFish(id) {
    if (this.galleryManager) {
      this.galleryManager.deleteSingleFish(id);
    }
  }
}
