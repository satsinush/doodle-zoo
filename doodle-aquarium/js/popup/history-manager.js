/**
 * Unified History Manager for Doodle Aquarium
 * Handles Undo/Redo states for both Canvas and Gallery.
 */
export class HistoryManager {
    constructor(elements, options = {}) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxDepth = options.maxDepth || 50;
        this.onStackChange = options.onStackChange || (() => {});
        this.undoBtn = elements.undoBtn;
        this.redoBtn = elements.redoBtn;
        this.toastContainer = document.getElementById('toast-container');
        this.updateUI(); // Ensure buttons are in correct state on load
    }

    push(item) {
        // item: { type: 'canvas'|'reorder'|'settings'|'delete'|'create', data: any, description: string }
        this.undoStack.push(item);
        if (this.undoStack.length > this.maxDepth) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo on new action
        this.updateUI();
    }

    async undo(currentAppState) {
        if (this.undoStack.length === 0) return;

        const item = this.undoStack.pop();
        await this.applyState(item, true, currentAppState);
        this.redoStack.push(item);
        
        this.showToast(`Undo: ${item.description}`);
        this.refreshUI(currentAppState);
        this.updateUI();
    }

    async redo(currentAppState) {
        if (this.redoStack.length === 0) return;

        const item = this.redoStack.pop();
        await this.applyState(item, false, currentAppState);
        this.undoStack.push(item);

        this.showToast(`Redo: ${item.description}`);
        this.refreshUI(currentAppState);
        this.updateUI();
    }

    async applyState(item, isUndo, app) {
        // Returns the inverse action for the other stack
        const { type, data, id } = item;

        switch (type) {
            case 'canvas': {
                // data: { oldUrl, newUrl }
                const targetUrl = isUndo ? data.oldUrl : data.newUrl;
                const inverseUrl = isUndo ? data.newUrl : data.oldUrl;
                
                // Standardize: ensure the app is looking at the correct fish ID for this state
                const currentId = (typeof app.currentEditingFishId === 'function') ? 
                                  app.currentEditingFishId() : app.currentEditingFishId;
                
                if (currentId != id && app.setEditingState) {
                    app.setEditingState(id);
                }

                if (app.canvasManager && (id == (typeof app.currentEditingFishId === 'function' ? app.currentEditingFishId() : app.currentEditingFishId))) {
                    app.canvasManager.restoreState(targetUrl);
                }

                return item;
            }

            case 'reorder': {
                // data: { oldIds, newIds }
                const targetOrder = isUndo ? data.oldIds : data.newIds;
                const inverseOrder = isUndo ? data.newIds : data.oldIds;

                await new Promise(resolve => {
                    chrome.storage.local.get(['doodleFishList'], (res) => {
                        const list = res.doodleFishList || [];
                        const fishMap = new Map(list.map(f => [f.id, f]));
                        const sorted = targetOrder.map(tid => fishMap.get(tid)).filter(f => f);
                        chrome.storage.local.set({ doodleFishList: sorted }, resolve);
                    });
                });

                return item;
            }

            case 'settings': {
                // data: { id, oldSettings, newSettings }
                // In case of bulk settings, data might be an array of these
                const items = Array.isArray(data) ? data : [data];
                
                await new Promise(resolve => {
                    chrome.storage.local.get(['doodleFishList'], (res) => {
                        const list = res.doodleFishList || [];
                        items.forEach(change => {
                            const fish = list.find(f => f.id === change.id);
                            if (fish) {
                                const target = isUndo ? change.oldSettings : change.newSettings;
                                Object.assign(fish, target);
                            }
                        });
                        chrome.storage.local.set({ doodleFishList: list }, resolve);
                    });
                });

                return item;
            }

            case 'delete': {
                // data: { fish, index } - 'undo' means recreate, 'redo' means delete
                if (isUndo) {
                    // Recreate
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = res.doodleFishList || [];
                            list.splice(data.index, 0, data.fish);
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                } else {
                    // Delete again
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = res.doodleFishList || [];
                            const deletedIndex = list.findIndex(f => f.id === data.fish.id);
                            if (deletedIndex !== -1) {
                                 list.splice(deletedIndex, 1);
                            }
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                }
                return item;
            }

            case 'save_commit': {
                // data: { id, oldUrl, newUrl } - Only update storage/gallery, NOT canvas
                const targetUrl = isUndo ? data.oldUrl : data.newUrl;
                await new Promise(resolve => {
                    chrome.storage.local.get(['doodleFishList'], (res) => {
                        const list = res.doodleFishList || [];
                        const fish = list.find(f => f.id === id);
                        if (fish) {
                            fish.dataUrl = targetUrl;
                        }
                        chrome.storage.local.set({ doodleFishList: list }, resolve);
                    });
                });
                return item;
            }

            case 'create': {
                // data: { id, fishData }
                // Undo create -> Delete it from gallery, but keep pixels on canvas
                // We set currentEditingFishId to null if we undo create
                if (isUndo) {
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = res.doodleFishList || [];
                            const idx = list.findIndex(f => f.id === id);
                            if (idx !== -1) list.splice(idx, 1);
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                    if (app.setEditingState) app.setEditingState(null);
                } else {
                    // Redo create -> Restore to gallery
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = res.doodleFishList || [];
                            list.push(data.fishData);
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                    if (app.setEditingState) app.setEditingState(id);
                }
                return item;
            }

            case 'navigate': {
                // data: { oldId, newId, oldUrl, newUrl }
                const targetId = isUndo ? data.oldId : data.newId;
                const targetUrl = isUndo ? data.oldUrl : data.newUrl;

                if (app.setEditingState) {
                    app.setEditingState(targetId);
                }
                if (app.canvasManager) {
                    app.canvasManager.restoreState(targetUrl);
                }
                return item;
            }

            case 'global_settings': {
                // data: { oldSettings, newSettings }
                const targetSettings = isUndo ? data.oldSettings : data.newSettings;
                
                await new Promise(resolve => {
                    chrome.storage.local.set({ globalUISettings: targetSettings }, resolve);
                });

                if (app.applyGlobalSettingsToForm) {
                    app.applyGlobalSettingsToForm(targetSettings);
                }
                return item;
            }
        }
    }

    updateUI() {
        if (this.undoBtn) this.undoBtn.disabled = this.undoStack.length === 0;
        if (this.redoBtn) this.redoBtn.disabled = this.redoStack.length === 0;
        this.onStackChange();
    }

    refreshUI(app) {
        if (app.galleryManager) {
            const currentId = (typeof app.currentEditingFishId === 'function') ? 
                              app.currentEditingFishId() : app.currentEditingFishId;
            app.galleryManager.renderFishList(currentId);
        }
        
        // Sync open settings modal if it matches the fish being undone/redone
        if (app.fishEditor && app.fishEditor.currentFishId) {
            chrome.storage.local.get(['doodleFishList'], (res) => {
                const list = res.doodleFishList || [];
                const fish = list.find(f => f.id === app.fishEditor.currentFishId);
                if (fish) {
                    app.fishEditor.syncSettingsUI(fish);
                }
            });
        }
    }

    showToast(message) {
        if (!this.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `
            <span class="material-symbols-outlined" style="font-size: 18px;">history</span>
            <span>${message}</span>
        `;
        
        this.toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}
