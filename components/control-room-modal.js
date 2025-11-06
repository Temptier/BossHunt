class CustomControlRoomModal extends HTMLElement {
    connectedCallback() { this.visible = false; this.timers = []; this.render(); }
    static get observedAttributes() { return ['visible']; }
    attributeChangedCallback(name, oldVal, newVal) { if (name === 'visible') this.visible = newVal != null && newVal !== 'false'; this.render(); }

    render() {
        // use latest timers if passed in
        const timers = this.timers || [];
        const rows = timers.map(t => {
            // color: green if scheduled for today, blue otherwise
            const isToday = t.type === 'scheduled' && (t.spawnDays || []).includes(new Date().getDay());
            const colorClass = isToday ? 'bg-green-600' : 'bg-blue-600';
            return `
                <div class="flex items-center justify-between bg-gray-700 p-2 rounded mb-2">
                    <div>
                        <input type="checkbox" data-id="${t.id}" class="cr-checkbox mr-2">
                        <span class="font-medium">${escapeHtml(t.bossName)}</span>
                        <small class="text-xs text-gray-400 ml-2">(${t.type})</small>
                    </div>
                    <div class="${colorClass} text-white px-2 py-1 rounded text-sm">${isToday ? 'Today' : 'Off-day'}</div>
                </div>
            `;
        }).join('');

        this.innerHTML = `
            <div class="modal-overlay fixed inset-0 flex items-center justify-center ${this.visible ? '' : 'hidden'}">
                <div class="bg-gray-800 p-6 rounded-lg w-full max-w-2xl">
                    <h3 class="text-xl font-semibold mb-3">Control Room</h3>
                    <div class="mb-3">
                        <label class="block text-sm mb-1">Optional message to send</label>
                        <input id="cr-msg" class="w-full bg-gray-700 px-3 py-2 rounded mb-3" placeholder="Optional message">
                    </div>
                    <div id="cr-list" class="mb-3" style="max-height:320px; overflow:auto;">
                        ${rows}
                    </div>
                    <div class="flex justify-between items-center">
                        <div class="text-sm text-gray-400">Select bosses you want to send now. Green = scheduled for today.</div>
                        <div class="space-x-2">
                            <button id="cr-close" class="px-3 py-2 rounded bg-gray-600">Close</button>
                            <button id="cr-send" class="px-3 py-2 rounded bg-indigo-600">Send</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Attach listeners after DOM added
        this.querySelector('#cr-close').addEventListener('click', () => this.removeAttribute('visible'));
        this.querySelector('#cr-send').addEventListener('click', () => {
            const checked = Array.from(this.querySelectorAll('.cr-checkbox')).filter(i => i.checked).map(i => i.getAttribute('data-id'));
            if (!checked.length) { alert('Select at least one boss'); return; }
            const pmsg = this.querySelector('#cr-msg').value.trim();
            // send each selected timer now
            checked.forEach(id => {
                const timer = (this.timers || []).find(t => t.id === id);
                if (!timer) return;
                const msg = (pmsg ? `${pmsg}\n` : '') + `${timer.bossName} spawn notice`;
                sendWebhookMessage(msg);
                sendAdminAction(`Control room send: ${timer.bossName}`);
            });
            alert('Sent to webhook');
            this.removeAttribute('visible');
        });
    }
}
customElements.define('custom-control-room-modal', CustomControlRoomModal);

// lightweight escape (same as in script)
function escapeHtml(text){
    if (!text) return '';
    return text.replace(/[&<>"'`=\/]/g, s => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
    })[s]);
}