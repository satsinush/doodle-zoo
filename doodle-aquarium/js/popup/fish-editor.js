export class FishEditor {
  constructor(elements, canvasManager, galleryManager, callbacks = {}) {
    this.elements = elements;
    this.canvasManager = canvasManager;
    this.galleryManager = galleryManager;
    this.callbacks = callbacks;

    this.setupListeners();
  }

  setupListeners() {
    this.elements.modalCloseBtn?.addEventListener('click', () => this.closeFishModal());
    this.elements.fishModal?.addEventListener('click', (e) => {
      if (e.target === this.elements.fishModal) this.closeFishModal();
    });

    this.elements.modalFlipHBtn?.addEventListener('click', () => this.flipFishImageData(this.currentFishId, true, false));
    this.elements.modalFlipVBtn?.addEventListener('click', () => this.flipFishImageData(this.currentFishId, false, true));

    this.elements.modalLockToggle?.addEventListener('click', () => this.toggleFishFlipByVelocity(this.currentFishId, this.elements.modalLockToggle.checked));
    this.elements.modalActiveToggle?.addEventListener('click', () => this.toggleFishActive(this.currentFishId, this.elements.modalActiveToggle.checked));

    this.elements.modalEditBtn?.addEventListener('click', () => {
      this.closeFishModal();
      this.loadFishIntoCanvas(this.currentFishId, this.elements.modalFishPreview.src);
    });

    this.elements.modalDeleteBtn?.addEventListener('click', () => {
      if (confirm('Delete this fish?')) {
        this.closeFishModal();
        this.deleteFish(this.currentFishId);
      }
    });

    this.elements.modalExportBtn?.addEventListener('click', () => {
      this.exportFish({ dataUrl: this.elements.modalFishPreview.src });
    });
  }

  openFishModal(fish) {
    this.currentFishId = fish.id;
    document.body.style.overflow = 'hidden';
    this.elements.modalFishPreview.src = fish.dataUrl;
    this.elements.modalActiveToggle.checked = fish.active !== false;
    this.elements.modalLockToggle.checked = fish.flipByVelocity !== false;
    this.elements.modalFishPreview.style.transform = '';
    this.elements.fishModal.classList.add('active');
  }

  closeFishModal() {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
    this.elements.fishModal.classList.remove('active');
  }

  loadFishIntoCanvas(id, dataUrl) {
    this.canvasManager.saveState();
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

      if (this.callbacks.onEdit) this.callbacks.onEdit(id);

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    imgObj.src = dataUrl;
  }

  toggleFishActive(id, isActive) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex !== -1) {
        fishArray[fishIndex].active = isActive;
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          this.galleryManager.renderFishList();
        });
      }
    });
  }

  toggleFishFlipByVelocity(id, isEnabled) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex !== -1) {
        fishArray[fishIndex].flipByVelocity = isEnabled;
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          this.galleryManager.renderFishList();
        });
      }
    });
  }

  flipFishImageData(id, horizontal, vertical) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const fishIndex = fishArray.findIndex(f => f.id === id);
      if (fishIndex === -1) return;

      const img = new Image();
      img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 300;
        const tempCtx = tempCanvas.getContext('2d');
        if (horizontal) { tempCtx.translate(400, 0); tempCtx.scale(-1, 1); }
        if (vertical) { tempCtx.translate(0, 300); tempCtx.scale(1, -1); }
        tempCtx.drawImage(img, 0, 0, 400, 300);
        const newDataUrl = tempCanvas.toDataURL('image/png');
        fishArray[fishIndex].dataUrl = newDataUrl;
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          this.elements.modalFishPreview.src = newDataUrl;
          this.galleryManager.renderFishList();
        });
      };
      img.src = fishArray[fishIndex].dataUrl;
    });
  }

  deleteFish(id) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      let fishArray = result.doodleFishList || [];
      fishArray = fishArray.filter(f => f.id !== id);
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        this.galleryManager.renderFishList();
      });
    });
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
}
