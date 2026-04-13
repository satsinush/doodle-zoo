export class NotificationManager {
    constructor(container) {
        this.container = container;
        if (!this.container) {
            console.warn('NotificationManager: Container not found, falling back to document.body');
            this.container = document.body;
        }
    }

    /**
     * Show a rich toast notification
     * @param {string} message 
     * @param {string} icon - Material Symbols icon name
     * @param {number} duration - ms
     */
    show(message, icon = 'info', duration = 2500) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'material-symbols-outlined';
        iconSpan.style.fontSize = '20px';
        iconSpan.textContent = icon;
        
        const textSpan = document.createElement('span');
        textSpan.className = 'toast-text';
        textSpan.textContent = message;
        
        toast.appendChild(iconSpan);
        toast.appendChild(textSpan);
        
        this.container.appendChild(toast);
        
        // Trigger reflow for animation
        void toast.offsetWidth;
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            }, { once: true });
        }, duration);
    }
}
