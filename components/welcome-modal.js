class CustomWelcomeModal extends HTMLElement {
    connectedCallback() {
        this.visible = false;
        this.render();
    }

    static get observedAttributes() { return ['visible']; }
    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'visible') this.visible = newVal != null && newVal !== 'false';
        this.render();
    }

    render() {
        const user = JSON.parse(localStorage.getItem('userData')) || { ign: '', guild: '' };
        this.innerHTML = `
            <div class="modal-overlay fixed inset-0 flex items-center justify-center ${this.visible ? '' : 'hidden'}">
                <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md">
                    <h3 class="text-xl font-semibold mb-3">Welcome — quick setup</h3>
                    <p class="text-sm text-gray-400 mb-4">Enter your in-game name (IGN) and Guild so we can personalise your timers.</p>
                    <label class="block text-sm mb-1">IGN</label>
                    <input id="wm-ign" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" value="${user.ign || ''}">
                    <label class="block text-sm mb-1">Guild</label>
                    <input id="wm-guild" class="w-full bg-gray-700 px-3 py-2 rounded mb-4" value="${user.guild || ''}">
                    <div class="flex justify-between">
                        <button id="wm-cancel" class="px-3 py-2 rounded bg-gray-600">Later</button>
                        <div class="space-x-2">
                            <button id="wm-save" class="px-3 py-2 rounded bg-blue-600">Save</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        this.querySelector('#wm-cancel').addEventListener('click', () => {
            this.removeAttribute('visible');
        });
        this.querySelector('#wm-save').addEventListener('click', () => {
            const ign = this.querySelector('#wm-ign').value.trim();
            const guild = this.querySelector('#wm-guild').value.trim();
            const user = { userId: (JSON.parse(localStorage.getItem('userData'))?.userId) || `user-${Date.now()}`, ign, guild };
            localStorage.setItem('userData', JSON.stringify(user));
            this.removeAttribute('visible');
            window.dispatchEvent(new CustomEvent('welcome:saved', { detail: user }));
        });
    }
}
customElements.define('custom-welcome-modal', CustomWelcomeModal);