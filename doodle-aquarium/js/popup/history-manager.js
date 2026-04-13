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
        this.notificationManager = null; // Set via setter
        this.updateUI(); // Ensure buttons are in correct state on load
    }

    setNotificationManager(nm) {
        this.notificationManager = nm;
    }

    push(item) {
        // item: { type: 'canvas'|'reorder'|'settings'|'delete'|'create', data: any, description: string }
        this.undoStack.push(item);
        if (this.undoStack.length > this.maxDepth) {
            this.undoStack.shift();
        }
        this.redoStack = []; // Clear redo on new action
        
        if (item.description) {
            this.showToast(item.description, this.getIconForType(item.type));
        }

        this.updateUI();
    }

    async undo(currentAppState) {
        if (this.undoStack.length === 0) return;

        const item = this.undoStack.pop();
        await this.applyState(item, true, currentAppState);
        this.redoStack.push(item);
        
        if (item.description) {
            this.showToast(`Undo: ${item.description}`, this.getIconForType(item.type));
        }

        this.refreshUI(currentAppState);
        this.updateUI();
    }

    async redo(currentAppState) {
        if (this.redoStack.length === 0) return;

        const item = this.redoStack.pop();
        await this.applyState(item, false, currentAppState);
        this.undoStack.push(item);

        if (item.description) {
            this.showToast(`Redo: ${item.description}`, this.getIconForType(item.type));
        }

        this.refreshUI(currentAppState);
        this.updateUI();
    }

    async applyState(item, isUndo, app) {
        const { type, data, id } = item;

        switch (type) {
            case 'canvas': {
                const targetUrl = isUndo ? data.oldUrl : data.newUrl;
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
                const targetOrder = isUndo ? data.oldIds : data.newIds;
                await new Promise(resolve => {
                    chrome.storage.local.get(['doodleFishList'], (res) => {
                        const list = (res.doodleFishList || []).filter(f => f);
                        const fishMap = new Map(list.map(f => [f.id, f]));
                        const sorted = targetOrder.map(tid => fishMap.get(tid)).filter(f => f);
                        chrome.storage.local.set({ doodleFishList: sorted }, resolve);
                    });
                });
                return item;
            }

            case 'settings': {
                const items = Array.isArray(data) ? data : [data];
                await new Promise(resolve => {
                    chrome.storage.local.get(['doodleFishList'], (res) => {
                        const list = (res.doodleFishList || []).filter(f => f);
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
                const deleteItems = Array.isArray(data) ? data : [data];
                if (isUndo) {
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = (res.doodleFishList || []).filter(f => f);
                            // Sort items by index ascending to restore them in the correct relative order
                            const sortedItems = [...deleteItems].sort((a, b) => a.index - b.index);
                            sortedItems.forEach(item => {
                                list.splice(item.index, 0, item.fish);
                            });
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                } else {
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = (res.doodleFishList || []).filter(f => f);
                            const idsToRemove = deleteItems.map(item => item.fish.id);
                            const newList = list.filter(f => !idsToRemove.includes(f.id));
                            chrome.storage.local.set({ doodleFishList: newList }, resolve);
                        });
                    });
                }
                return item;
            }

            case 'save_commit': {
                const targetUrl = isUndo ? data.oldUrl : data.newUrl;
                await new Promise(resolve => {
                    chrome.storage.local.get(['doodleFishList'], (res) => {
                        const list = (res.doodleFishList || []).filter(f => f);
                        const fish = list.find(f => f && f.id === id);
                        if (fish) fish.dataUrl = targetUrl;
                        chrome.storage.local.set({ doodleFishList: list }, resolve);
                    });
                });
                return item;
            }

            case 'create': {
                if (isUndo) {
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = (res.doodleFishList || []).filter(f => f);
                            const idx = list.findIndex(f => f && f.id === id);
                            if (idx !== -1) list.splice(idx, 1);
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                    if (app.setEditingState) app.setEditingState(null);
                } else {
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = (res.doodleFishList || []).filter(f => f);
                            list.push(data.fishData);
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                    if (app.setEditingState) app.setEditingState(id);
                }
                return item;
            }

            case 'bulk_create': {
                if (isUndo) {
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = (res.doodleFishList || []).filter(f => f);
                            const idsToRemove = data.fishArray.map(f => f.id);
                            const newList = list.filter(f => !idsToRemove.includes(f.id));
                            chrome.storage.local.set({ doodleFishList: newList }, resolve);
                        });
                    });
                } else {
                    await new Promise(resolve => {
                        chrome.storage.local.get(['doodleFishList'], (res) => {
                            const list = (res.doodleFishList || []).filter(f => f);
                            list.push(...data.fishArray);
                            chrome.storage.local.set({ doodleFishList: list }, resolve);
                        });
                    });
                }
                return item;
            }

            case 'navigate': {
                const targetId = isUndo ? data.oldId : data.newId;
                const targetUrl = isUndo ? data.oldUrl : data.newUrl;
                if (app.setEditingState) app.setEditingState(targetId);
                if (app.canvasManager) app.canvasManager.restoreState(targetUrl);
                return item;
            }

            case 'global_settings': {
                const targetSettings = isUndo ? data.oldSettings : data.newSettings;
                await new Promise(resolve => {
                    chrome.storage.local.set({ globalUISettings: targetSettings }, resolve);
                });
                if (app.applyGlobalSettingsToForm) app.applyGlobalSettingsToForm(targetSettings);
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
        if (app.fishEditor && app.fishEditor.currentFishId) {
            chrome.storage.local.get(['doodleFishList'], (res) => {
                const list = (res.doodleFishList || []).filter(f => f);
                const fish = list.find(f => f && f.id === app.fishEditor.currentFishId);
                if (fish) app.fishEditor.syncSettingsUI(fish);
            });
        }
    }

    showToast(message, icon = 'info') {
        if (this.notificationManager) {
            this.notificationManager.show(message, icon);
        } else {
            console.log('Toast Fallback:', message);
        }
    }

    getIconForType(type) {
        const icons = {
            'canvas': 'brush',
            'delete': 'delete',
            'settings': 'settings',
            'global_settings': 'settings',
            'reorder': 'reorder',
            'create': 'add',
            'bulk_create': 'add',
            'save_commit': 'save',
            'navigate': 'arrow_forward'
        };
        return icons[type] || 'info';
    }
}
