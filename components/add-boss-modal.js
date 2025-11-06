class CustomAddBossModal extends HTMLElement {
    connectedCallback() {
        this.mode = 'manual'; // or 'scheduled'
        this.render();
    }

    static get observedAttributes() { return ['visible']; }
    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'visible') this.visible = newVal != null && newVal !== 'false';
        this.render();
    }

    render() {
        this.innerHTML = `
            <div class="modal-overlay fixed inset-0 flex items-center justify-center ${this.visible ? '' : 'hidden'}">
                <div class="bg-gray-800 p-6 rounded-lg w-full max-w-lg">
                    <h3 class="text-xl font-semibold mb-3">${this.mode === 'manual' ? 'Add Manual Boss' : 'Add Scheduled Boss'}</h3>
                    <label class="block text-sm mb-1">Boss name</label>
                    <input id="boss-name" class="w-full bg-gray-700 px-3 py-2 rounded mb-3">
                    <div id="manual-fields" class="${this.mode === 'manual' ? '' : 'hidden'}">
                        <label class="block text-sm mb-1">Respawn (minutes)</label>
                        <input id="respawn-min" type="number" min="1" class="w-full bg-gray-700 px-3 py-2 rounded mb-3">
                        <label class="block text-sm mb-1">Auto-reset after (optional, minutes)</label>
                        <input id="auto-reset" type="number" min="0" class="w-full bg-gray-700 px-3 py-2 rounded mb-3">
                    </div>
                    <div id="scheduled-fields" class="${this.mode === 'scheduled' ? '' : 'hidden'}">
                        <label class="block text-sm mb-1">Spawn days (comma separated 0=Sun..6=Sat)</label>
                        <input id="spawn-days" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" placeholder="e.g. 1,3,5">
                        <label class="block text-sm mb-1">Spawn window (minutes)</label>
                        <input id="spawn-window" type="number" min="1" class="w-full bg-gray-700 px-3 py-2 rounded mb-3">
                    </div>

                    <div class="flex justify-end space-x-2">
                        <button id="add-cancel" class="px-3 py-2 rounded bg-gray-600">Cancel</button>
                        <button id="add-save" class="px-3 py-2 rounded bg-green-600">Add</button>
                    </div>
                </div>
            </div>
        `;

        this.querySelector('#add-cancel').addEventListener('click', () => this.removeAttribute('visible'));
        this.querySelector('#add-save').addEventListener('click', async () => {
            const name = this.querySelector('#boss-name').value.trim();
            if (!name) { alert('Boss name required'); return; }

            if (this.mode === 'manual') {
                const resp = parseInt(this.querySelector('#respawn-min').value, 10);
                const autoReset = parseInt(this.querySelector('#auto-reset').value || '0', 10);
                if (isNaN(resp) || resp <= 0) { alert('Valid respawn minutes required'); return; }
                await db.collection('timers').add({
                    userId: getUserId(),
                    type: 'manual',
                    bossName: name,
                    respawnTime: resp,
                    lastKilled: new Date().toISOString(),
                    missCount: 0,
                    autoResetAfterMinutes: autoReset || 0
                });
            } else {
                const daysRaw = this.querySelector('#spawn-days').value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n) && n>=0 && n<=6);
                const win = parseInt(this.querySelector('#spawn-window').value, 10);
                if (!daysRaw.length || isNaN(win) || win <= 0) { alert('Valid days and window required'); return; }
                await db.collection('timers').add({
                    userId: getUserId(),
                    type: 'scheduled',
                    bossName: name,
                    spawnDays: Array.from(new Set(daysRaw)),
                    spawnWindow: win,
                    lastSpawned: new Date().toISOString(),
                    nextSpawn: null
                });
            }
            this.removeAttribute('visible');
        });
    }
}
customElements.define('custom-add-boss-modal', CustomAddBossModal);