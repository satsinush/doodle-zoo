export class GalleryManager {
  constructor(elements, onOpenFishModal) {
    this.elements = elements;
    this.onOpenFishModal = onOpenFishModal;
    this.selectedFishIds = [];
    this.lastSelectedIndex = -1;

    this.setupListeners();
  }

  setupListeners() {
    this.elements.masterSelectWrapper?.addEventListener('click', () => {
      const masterCheckbox = this.elements.masterSelectCheckbox;
      const shouldSelectAll = !masterCheckbox.checked && !masterCheckbox.indeterminate;
      chrome.storage.local.get(['doodleFishList'], (result) => {
        const fishArray = result.doodleFishList || [];
        this.selectedFishIds = shouldSelectAll ? fishArray.map(f => f.id) : [];
        this.renderFishList();
      });
    });

    this.elements.bulkDelete?.addEventListener('click', () => {
      if (confirm(`Are you sure you want to delete ${this.selectedFishIds.length} fish?`)) {
        chrome.storage.local.get(['doodleFishList'], (result) => {
          let fishArray = result.doodleFishList || [];
          fishArray = fishArray.filter(f => !this.selectedFishIds.includes(f.id));
          chrome.storage.local.set({ doodleFishList: fishArray }, () => {
            this.selectedFishIds = [];
            this.elements.bulkModal?.classList.remove('active');
            this.renderFishList();
          });
        });
      }
    });

    this.elements.saveBulkBtn?.addEventListener('click', () => {
      const activeCheckbox = this.elements.bulkActiveToggle;
      const flipCheckbox = this.elements.bulkFlipVelocity;
      const applyActive = !activeCheckbox.indeterminate;
      const activeVal = activeCheckbox.checked;
      const applyFlip = !flipCheckbox.indeterminate;
      const flipVal = flipCheckbox.checked;

      chrome.storage.local.get(['doodleFishList'], (result) => {
        const fishArray = result.doodleFishList || [];
        this.selectedFishIds.forEach(id => {
          const idx = fishArray.findIndex(f => f.id === id);
          if (idx !== -1) {
            if (applyActive) fishArray[idx].active = activeVal;
            if (applyFlip) fishArray[idx].flipByVelocity = flipVal;
          }
        });
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          this.elements.bulkModal?.classList.remove('active');
          this.renderFishList();
        });
      });
    });
  }

  renderFishList() {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      this.elements.fishList.innerHTML = '';
      this.selectedFishIds = this.selectedFishIds.filter(id => fishArray.some(f => f.id === id));
      this.updateBulkToolbar(fishArray);

      if (fishArray.length === 0) {
        this.elements.fishList.innerHTML = '<p style="grid-column: 1/-1; text-align:center; color:var(--on-surface-variant); font-size: 13px; padding: 2rem 0;">No fish in your tank yet.</p>';
        return;
      }

      fishArray.forEach((fish, index) => {
        const isSelected = this.selectedFishIds.includes(fish.id);
        const item = document.createElement('div');
        item.className = `gallery-item ${fish.active ? '' : 'inactive'} ${isSelected ? 'selected' : ''}`;
        item.dataset.id = fish.id;

        const img = document.createElement('img');
        img.src = fish.dataUrl;
        img.alt = 'Fish';
        item.appendChild(img);

        const toggle = document.createElement('div');
        toggle.className = 'selection-toggle';
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined';
        icon.textContent = 'check';
        toggle.appendChild(icon);
        toggle.onclick = (e) => {
          e.stopPropagation();
          this.toggleSelection(fish.id, index, e.shiftKey, fishArray);
        };
        item.appendChild(toggle);

        item.onclick = (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            this.toggleSelection(fish.id, index, e.shiftKey, fishArray);
          } else {
            this.onOpenFishModal(fish);
          }
        };
        this.elements.fishList.appendChild(item);
      });
    });
  }

  toggleSelection(id, index, isShift, fishArray) {
    if (isShift && this.lastSelectedIndex !== -1) {
      const start = Math.min(this.lastSelectedIndex, index);
      const end = Math.max(this.lastSelectedIndex, index);
      const rangeIds = fishArray.slice(start, end + 1).map(f => f.id);
      rangeIds.forEach(rid => {
        if (!this.selectedFishIds.includes(rid)) this.selectedFishIds.push(rid);
      });
    } else {
      if (this.selectedFishIds.includes(id)) {
        this.selectedFishIds = this.selectedFishIds.filter(sid => sid !== id);
      } else {
        this.selectedFishIds.push(id);
      }
    }
    this.lastSelectedIndex = index;
    this.renderFishList();
  }

  updateBulkToolbar(fishArray) {
    const masterCheckbox = this.elements.masterSelectCheckbox;
    const gearBtn = this.elements.bulkEditSettings;
    if (this.selectedFishIds.length > 0) {
      if (gearBtn) gearBtn.disabled = false;
      if (this.elements.bulkCount) this.elements.bulkCount.textContent = this.selectedFishIds.length;
      if (fishArray.length > 0) {
        if (this.selectedFishIds.length === fishArray.length) {
          masterCheckbox.checked = true;
          masterCheckbox.indeterminate = false;
        } else {
          masterCheckbox.checked = false;
          masterCheckbox.indeterminate = true;
        }
      }
    } else {
      if (gearBtn) gearBtn.disabled = true;
      if (masterCheckbox) {
        masterCheckbox.checked = false;
        masterCheckbox.indeterminate = false;
      }
    }
  }

  openBulkModal() {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const selectedFish = fishArray.filter(f => this.selectedFishIds.includes(f.id));
      if (selectedFish.length === 0) return;

      const flipCheckbox = this.elements.bulkFlipVelocity;
      const activeCheckbox = this.elements.bulkActiveToggle;

      const allActive = selectedFish.every(f => f.active);
      const allInactive = selectedFish.every(f => !f.active);
      const allFlipped = selectedFish.every(f => f.flipByVelocity);
      const allNotFlipped = selectedFish.every(f => !f.flipByVelocity);

      if (allActive) {
        activeCheckbox.checked = true;
        activeCheckbox.indeterminate = false;
      } else if (allInactive) {
        activeCheckbox.checked = false;
        activeCheckbox.indeterminate = false;
      } else {
        activeCheckbox.checked = false;
        activeCheckbox.indeterminate = true;
      }

      if (allFlipped) {
        flipCheckbox.checked = true;
        flipCheckbox.indeterminate = false;
      } else if (allNotFlipped) {
        flipCheckbox.checked = false;
        flipCheckbox.indeterminate = false;
      } else {
        flipCheckbox.checked = false;
        flipCheckbox.indeterminate = true;
      }

      this.elements.bulkModal?.classList.add('active');
    });
  }
}
