import { DEFAULT_SETTINGS } from '../common/constants.js';
export class GalleryManager {
  constructor(elements, handlers) {
    this.elements = elements;
    this.handlers = handlers; // { onOpenSettings: fish => ..., onEditFish: fish => ... }
    this.selectedFishIds = [];
    this.lastSelectedIndex = -1;
    this.currentEditingFishId = null;
    this._bulkTouches = {};
    this.draggedItemId = null;
    this.contextFishId = null;

    this.bulkDOM = {
      speedMultiplier: document.getElementById('bulk-speed-multiplier'),
      sizeMultiplier: document.getElementById('bulk-size-multiplier'),
      interactionType: document.getElementById('bulk-interaction-type'),
      interactionStrength: document.getElementById('bulk-interaction-strength'),
      speedDisplay: document.getElementById('bulk-speed-display'),
      sizeDisplay: document.getElementById('bulk-size-display'),
      strengthDisplay: document.getElementById('bulk-strength-display')
    };

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

    this.bulkDOM.speedMultiplier?.addEventListener('input', (e) => {
      this.bulkDOM.speedDisplay.value = Number(e.target.value).toFixed(1);
      this._bulkTouches.speed = true;
    });
    this.bulkDOM.speedDisplay?.addEventListener('change', (e) => {
      let val = Math.max(0.0, Math.min(3.0, Number(e.target.value) || 0));
      this.bulkDOM.speedMultiplier.value = val;
      e.target.value = val.toFixed(1);
      this._bulkTouches.speed = true;
    });
    this.bulkDOM.sizeMultiplier?.addEventListener('input', (e) => {
      this.bulkDOM.sizeDisplay.value = Number(e.target.value).toFixed(1);
      this._bulkTouches.size = true;
    });
    this.bulkDOM.sizeDisplay?.addEventListener('change', (e) => {
      let val = Math.max(0.1, Math.min(3.0, Number(e.target.value) || 0));
      this.bulkDOM.sizeMultiplier.value = val;
      e.target.value = val.toFixed(1);
      this._bulkTouches.size = true;
    });
    this.bulkDOM.interactionStrength?.addEventListener('input', (e) => {
      this.bulkDOM.strengthDisplay.value = Number(e.target.value).toFixed(1);
      this._bulkTouches.strength = true;
    });
    this.bulkDOM.strengthDisplay?.addEventListener('change', (e) => {
      let val = Math.max(0.0, Math.min(5.0, Number(e.target.value) || 0));
      this.bulkDOM.interactionStrength.value = val;
      e.target.value = val.toFixed(1);
      this._bulkTouches.strength = true;
    });
    this.bulkDOM.interactionType?.addEventListener('change', () => {
      this._bulkTouches.type = true;
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
            
            if (this._bulkTouches.speed) fishArray[idx].speedMultiplier = Number(this.bulkDOM.speedMultiplier.value);
            if (this._bulkTouches.size) fishArray[idx].sizeMultiplier = Number(this.bulkDOM.sizeMultiplier.value);
            if (this._bulkTouches.strength) fishArray[idx].interactionStrength = Number(this.bulkDOM.interactionStrength.value);
            if (this._bulkTouches.type && this.bulkDOM.interactionType.value) {
              fishArray[idx].interactionType = this.bulkDOM.interactionType.value;
            }
          }
        });
        chrome.storage.local.set({ doodleFishList: fishArray }, () => {
          this.elements.bulkModal?.classList.remove('active');
          this.renderFishList();
        });
      });
    });

    this.elements.bulkDeleteSelected?.addEventListener('click', () => {
      if (this.selectedFishIds.length === 0) return;
      if (confirm(`Delete ${this.selectedFishIds.length} fish?`)) {
        chrome.storage.local.get(['doodleFishList'], (result) => {
          let fishArray = result.doodleFishList || [];
          fishArray = fishArray.filter(f => !this.selectedFishIds.includes(f.id));
          chrome.storage.local.set({ doodleFishList: fishArray }, () => {
            this.selectedFishIds = [];
            this.renderFishList();
          });
        });
      }
    });

    // Global listeners to hide context menu
    window.addEventListener('mousedown', (e) => {
      // Hide if clicking outside the menu
      if (this.elements.galleryContextMenu && !this.elements.galleryContextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });
    window.addEventListener('resize', () => this.hideContextMenu());
    window.addEventListener('scroll', () => this.hideContextMenu(), true);

    this.elements.ctxSettings?.addEventListener('click', (e) => {
      e.stopPropagation();
      const fishId = this.contextFishId;
      const selectedIds = [...this.selectedFishIds];
      this.hideContextMenu();

      if (fishId) {
        if (selectedIds.includes(fishId) && selectedIds.length > 1) {
          this.openBulkModal();
        } else {
          chrome.storage.local.get(['doodleFishList'], (res) => {
            const fish = (res.doodleFishList || []).find(f => f.id === fishId);
            if (fish) this.handlers.onOpenSettings(fish);
          });
        }
      }
    });

    this.elements.ctxEditFish?.addEventListener('click', (e) => {
      e.stopPropagation();
      const fishId = this.contextFishId;
      this.hideContextMenu();

      if (fishId) {
        chrome.storage.local.get(['doodleFishList'], (res) => {
          const fish = (res.doodleFishList || []).find(f => f.id === fishId);
          if (fish) this.handlers.onEditFish(fish);
        });
      }
    });

    this.elements.ctxDelete?.addEventListener('click', (e) => {
      e.stopPropagation();
      const fishId = this.contextFishId;
      const selectedIds = [...this.selectedFishIds];
      this.hideContextMenu();

      if (fishId) {
        if (selectedIds.includes(fishId) && selectedIds.length > 1) {
          if (confirm(`Delete all ${selectedIds.length} selected fish?`)) {
            this.bulkDelete();
          }
        } else {
          if (confirm('Delete this fish?')) {
            this.deleteSingleFish(fishId);
          }
        }
      }
    });

    this.elements.ctxExport?.addEventListener('click', (e) => {
      e.stopPropagation();
      const fishId = this.contextFishId;
      const selectedIds = [...this.selectedFishIds];
      this.hideContextMenu();

      if (fishId) {
        if (selectedIds.includes(fishId) && selectedIds.length > 1) {
          this.exportSelectedIndividually();
        } else {
          chrome.storage.local.get(['doodleFishList'], (res) => {
            const fish = (res.doodleFishList || []).find(f => f.id === fishId);
            if (fish) this.exportSingleFish(fish);
          });
        }
      }
    });
  }

  bulkDelete() {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      let fishArray = result.doodleFishList || [];
      fishArray = fishArray.filter(f => !this.selectedFishIds.includes(f.id));
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        this.selectedFishIds = [];
        this.renderFishList();
      });
    });
  }

  hideContextMenu() {
    if (this.elements.galleryContextMenu) {
      this.elements.galleryContextMenu.style.display = 'none';
    }
    this.contextFishId = null;
  }

  showContextMenu(e, fishId) {
    e.preventDefault();
    this.contextFishId = fishId;
    const menu = this.elements.galleryContextMenu;
    if (!menu) return;

    menu.style.display = 'block';
    
    // Position menu and keep within viewport
    let x = e.clientX;
    let y = e.clientY;

    const menuWidth = menu.offsetWidth || 160;
    const menuHeight = menu.offsetHeight || 150;
    const winWidth = window.innerWidth;
    const winHeight = window.innerHeight;

    // Toggle "Edit Fish" visibility - only for single fish outside of a group
    const isPartOfGroup = this.selectedFishIds.includes(fishId) && this.selectedFishIds.length > 1;
    if (this.elements.ctxEditFish) {
      this.elements.ctxEditFish.style.display = isPartOfGroup ? 'none' : 'flex';
    }

    if (x + menuWidth > winWidth) x -= menuWidth;
    if (y + menuHeight > winHeight) y -= menuHeight;

    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
  }

  deleteSingleFish(id) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      let fishArray = result.doodleFishList || [];
      fishArray = fishArray.filter(f => f.id !== id);
      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        if (this.selectedFishIds.includes(id)) {
          this.selectedFishIds = this.selectedFishIds.filter(sid => sid !== id);
        }
        this.renderFishList();
      });
    });
  }

  exportSingleFish(fish) {
    const a = document.createElement('a');
    a.href = fish.dataUrl;
    a.download = `fish_${fish.id || Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  renderFishList(editingId = undefined) {
    if (editingId !== undefined) this.currentEditingFishId = editingId;
    
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
        item.draggable = true;

        item.addEventListener('dragstart', (e) => {
          this.draggedItemId = fish.id;
          const isSelected = this.selectedFishIds.includes(fish.id);
          if (isSelected) {
            this.elements.fishList.querySelectorAll('.gallery-item').forEach(el => {
              if (this.selectedFishIds.includes(el.dataset.id)) el.classList.add('dragging');
            });
          } else {
            item.classList.add('dragging');
          }
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', fish.id);
        });

        item.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const isSelectedSource = this.selectedFishIds.includes(this.draggedItemId);
          const isTargetSelected = this.selectedFishIds.includes(fish.id);
          
          if (this.draggedItemId !== fish.id && !(isSelectedSource && isTargetSelected)) {
            item.classList.add('drag-over');
          }
        });

        item.addEventListener('dragleave', () => {
          item.classList.remove('drag-over');
        });

        item.addEventListener('dragend', () => {
          this.elements.fishList.querySelectorAll('.gallery-item').forEach(el => {
            el.classList.remove('dragging');
            el.classList.remove('drag-over');
          });
          this.draggedItemId = null;
        });

        item.addEventListener('drop', (e) => {
          e.preventDefault();
          item.classList.remove('drag-over');
          if (this.draggedItemId && this.draggedItemId !== fish.id) {
            this.handleReorder(this.draggedItemId, fish.id);
          }
        });

        const img = document.createElement('img');
        img.src = fish.dataUrl;
        img.alt = 'Fish';
        item.appendChild(img);

        // Editing indicator
        if (fish.id === this.currentEditingFishId) {
          const badge = document.createElement('div');
          badge.className = 'editing-badge';
          const badgeSpan = document.createElement('span');
          badgeSpan.className = 'material-symbols-outlined';
          badgeSpan.textContent = 'edit';
          badge.appendChild(badgeSpan);
          item.appendChild(badge);
        }

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

        item.addEventListener('click', (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.stopPropagation();
            this.toggleSelection(fish.id, index, e.shiftKey, fishArray);
          } else {
            // Single click selects only this fish
            this.selectedFishIds = [fish.id];
            this.lastSelectedIndex = index;
            this.renderFishList();
          }
        });

        item.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this.handlers.onOpenSettings(fish);
        });

        item.addEventListener('contextmenu', (e) => {
          this.showContextMenu(e, fish.id);
        });

        this.elements.fishList.appendChild(item);
      });
    });
  }

  handleReorder(draggedId, targetId) {
    chrome.storage.local.get(['doodleFishList'], (result) => {
      let fishArray = result.doodleFishList || [];
      
      let idsToMove = [draggedId];
      if (this.selectedFishIds.includes(draggedId)) {
        // Move all selected fish, maintaining their relative order in the current list
        idsToMove = fishArray
          .filter(f => this.selectedFishIds.includes(f.id))
          .map(f => f.id);
      }

      const draggedItems = [];
      const originalIndices = idsToMove.map(id => fishArray.findIndex(f => f.id === id));
      
      // Extract items (sorted by index descending to avoid splice index-shifting issues)
      const sortedIndices = [...originalIndices].sort((a, b) => b - a);
      for (const idx of sortedIndices) {
        if (idx !== -1) {
          draggedItems.unshift(fishArray.splice(idx, 1)[0]);
        }
      }

      let targetIndex = fishArray.findIndex(f => f.id === targetId);
      if (targetIndex === -1) targetIndex = fishArray.length;

      fishArray.splice(targetIndex, 0, ...draggedItems);

      chrome.storage.local.set({ doodleFishList: fishArray }, () => {
        this.renderFishList();
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
    const exportBtn = this.elements.bulkExportSelected;
    const gearBtn = this.elements.bulkEditSettings;
    const deleteBtn = this.elements.bulkDeleteSelected;

    if (this.selectedFishIds.length > 0) {
      if (gearBtn) gearBtn.disabled = false;
      if (exportBtn) exportBtn.disabled = false;
      if (deleteBtn) deleteBtn.disabled = false;
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
      if (exportBtn) exportBtn.disabled = true;
      if (deleteBtn) deleteBtn.disabled = true;
      if (this.elements.bulkCount) this.elements.bulkCount.textContent = '0';
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

      if (selectedFish.length === 1) {
        this.handlers.onOpenSettings(selectedFish[0]);
        return;
      }

      this._bulkTouches = {};

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

      if (selectedFish.every(f => f.speedMultiplier === selectedFish[0].speedMultiplier)) {
        this.bulkDOM.speedMultiplier.value = selectedFish[0].speedMultiplier;
        this.bulkDOM.speedDisplay.value = Number(selectedFish[0].speedMultiplier).toFixed(1);
      } else {
        this.bulkDOM.speedMultiplier.value = DEFAULT_SETTINGS.speedMultiplier;
        this.bulkDOM.speedDisplay.value = '';
      }

      if (selectedFish.every(f => f.sizeMultiplier === selectedFish[0].sizeMultiplier)) {
        this.bulkDOM.sizeMultiplier.value = selectedFish[0].sizeMultiplier;
        this.bulkDOM.sizeDisplay.value = Number(selectedFish[0].sizeMultiplier).toFixed(1);
      } else {
        this.bulkDOM.sizeMultiplier.value = DEFAULT_SETTINGS.sizeMultiplier;
        this.bulkDOM.sizeDisplay.value = '';
      }

      if (selectedFish.every(f => f.interactionStrength === selectedFish[0].interactionStrength)) {
        this.bulkDOM.interactionStrength.value = selectedFish[0].interactionStrength;
        this.bulkDOM.strengthDisplay.value = Number(selectedFish[0].interactionStrength).toFixed(1);
      } else {
        this.bulkDOM.interactionStrength.value = DEFAULT_SETTINGS.interactionStrength;
        this.bulkDOM.strengthDisplay.value = '';
      }

      if (selectedFish.every(f => f.interactionType === selectedFish[0].interactionType)) {
        this.bulkDOM.interactionType.value = selectedFish[0].interactionType;
      } else {
        this.bulkDOM.interactionType.value = "";
      }

      this.elements.bulkModal?.classList.add('active');
    });
  }

  exportSelectedIndividually() {
    if (this.selectedFishIds.length === 0) return;

    chrome.storage.local.get(['doodleFishList'], (result) => {
      const fishArray = result.doodleFishList || [];
      const selectedFish = fishArray.filter(f => this.selectedFishIds.includes(f.id));

      if (selectedFish.length === 0) return;

      selectedFish.forEach((fish, index) => {
        // Use a slight timeout to stagger downloads and avoid browser blocking
        setTimeout(() => {
          const a = document.createElement('a');
          a.href = fish.dataUrl;
          a.download = `fish_${fish.id || index}.png`;
          document.body.appendChild(a);
          a.click();
          setTimeout(() => {
            document.body.removeChild(a);
          }, 0);
        }, index * 150);
      });
    });
  }
}
