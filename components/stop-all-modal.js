class CustomStopAllModal extends HTMLElement {
    connectedCallback() { this.render(); }
    static get observedAttributes() { return ['visible']; }
    attributeChangedCallback(name, oldVal, newVal) { if (name === 'visible') this.visible = newVal != null && newVal !== 'false'; this.render(); }

    render() {
        this.innerHTML = `
            <div class="modal-overlay fixed inset-0 flex items-center justify-center ${this.visible ? '' : 'hidden'}">
                <div class="bg-gray-800 p-6 rounded-lg w-full max-w-md">
                    <h3 class="text-xl font-semibold mb-2">Stop All Timers</h3>
                    <p class="text-sm text-gray-400 mb-4">This action requires the admin password.</p>
                    <input id="stop-password" type="password" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" placeholder="Enter password">
                    <div class="flex justify-end space-x-2">
                        <button id="stop-cancel" class="px-3 py-2 rounded bg-gray-600">Cancel</button>
                        <button id="stop-confirm" class="px-3 py-2 rounded bg-red-600">Stop All</button>
                    </div>
                    <p class="text-xs text-gray-500 mt-3">Password: theworldo</p>
                </div>
            </div>
        `;
        this.querySelector('#stop-cancel').addEventListener('click', () => this.removeAttribute('visible'));
        this.querySelector('#stop-confirm').addEventListener('click', () => {
            const pw = this.querySelector('#stop-password').value;
            if (pw === 'theworldo') {
                window.dispatchEvent(new CustomEvent('stopall:confirmed'));
                this.removeAttribute('visible');
            } else {
                alert('Wrong password');
            }
        });
    }
}
customElements.define('custom-stop-all-modal', CustomStopAllModal);