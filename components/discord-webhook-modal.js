class CustomDiscordWebhookModal extends HTMLElement {
    connectedCallback() { this.visible = false; this.render(); }
    static get observedAttributes() { return ['visible']; }
    attributeChangedCallback(name, oldVal, newVal) { if (name === 'visible') this.visible = newVal != null && newVal !== 'false'; this.render(); }

    render() {
        const myWebhook = localStorage.getItem('webhookUrl') || '';
        const adminWebhook = localStorage.getItem('adminWebhookUrl') || '';
        this.innerHTML = `
            <div class="modal-overlay fixed inset-0 flex items-center justify-center ${this.visible ? '' : 'hidden'}">
                <div class="bg-gray-800 p-6 rounded-lg w-full max-w-lg">
                    <h3 class="text-xl font-semibold mb-3">Discord Webhook</h3>
                    <label class="block text-sm mb-1">Your webhook URL</label>
                    <input id="dw-user" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" value="${myWebhook}">
                    <button id="dw-save" class="px-3 py-2 rounded bg-green-600 mb-3">Save</button>
                    <hr class="my-3 border-gray-700">
                    <label class="block text-sm mb-1">Admin webhook URL (for app logs)</label>
                    <input id="dw-admin" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" value="${adminWebhook}">
                    <button id="dw-admin-save" class="px-3 py-2 rounded bg-blue-600">Save Admin Webhook</button>
                    <div class="flex justify-end mt-4">
                        <button id="dw-close" class="px-3 py-2 rounded bg-gray-600">Close</button>
                    </div>
                </div>
            </div>
        `;
        this.querySelector('#dw-close').addEventListener('click', () => this.removeAttribute('visible'));
        this.querySelector('#dw-save').addEventListener('click', () => {
            const url = this.querySelector('#dw-user').value.trim();
            localStorage.setItem('webhookUrl', url);
            window.dispatchEvent(new CustomEvent('webhook:saved', { detail: url }));
            alert('Saved your webhook');
        });
        this.querySelector('#dw-admin-save').addEventListener('click', () => {
            const url = this.querySelector('#dw-admin').value.trim();
            localStorage.setItem('adminWebhookUrl', url);
            window.dispatchEvent(new CustomEvent('adminwebhook:saved', { detail: url }));
            alert('Saved admin webhook');
        });
    }
}
customElements.define('custom-discord-webhook-modal', CustomDiscordWebhookModal);