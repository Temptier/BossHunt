class CustomControlRoomModal extends HTMLElement {
  connectedCallback(){ this.render(); }
  render(){
    this.innerHTML = `
      <div id="cr" class="hidden fixed inset-0 flex items-center justify-center modal-overlay">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-2xl">
          <h3 class="text-xl font-semibold mb-3">Control Room</h3>
          <div id="cr-list" class="max-h-64 overflow-auto mb-3"></div>
          <label class="block text-sm mb-1">Optional message</label>
          <input id="cr-msg" class="w-full bg-gray-700 px-3 py-2 rounded mb-3">
          <div class="flex justify-end gap-2">
            <button id="cr-close" class="px-3 py-2 bg-gray-600 rounded">Close</button>
            <button id="cr-send" class="px-3 py-2 bg-indigo-600 rounded">Send</button>
          </div>
        </div>
      </div>`;
    feather.replace();
    this.querySelector('#cr-close')?.addEventListener('click', ()=> this.querySelector('#cr').classList.add('hidden'));
    this.querySelector('#cr-send')?.addEventListener('click', ()=> {
      const selected = Array.from(this.querySelectorAll('.cr-checkbox:checked')).map(i => i.value);
      const msg = this.querySelector('#cr-msg').value.trim();
      if (!selected.length) return alert('Select at least one boss');
      window.sendControlRoomMessage(selected, msg);
      this.querySelector('#cr').classList.add('hidden');
    });
  }

  openWithTimers(timers) {
    const today = new Date().getDay();
    const list = timers.map(t => {
      const isToday = t.type === 'scheduled' && (t.spawnDay === today);
      const tag = isToday ? '<div class="bg-green-600 text-white px-2 py-1 rounded text-sm">Today</div>' : '<div class="bg-blue-600 text-white px-2 py-1 rounded text-sm">Off-day</div>';
      return `<div class="flex items-center justify-between bg-gray-700 p-2 rounded mb-2"><label class="flex items-center"><input class="cr-checkbox mr-2" type="checkbox" value="${t.bossName}">${t.bossName} <small class="text-gray-400 ml-2">(${t.type})</small></label>${tag}</div>`;
    }).join('');
    this.querySelector('#cr-list').innerHTML = list;
    this.querySelector('#cr').classList.remove('hidden');
  }
}
customElements.define('custom-control-room-modal', CustomControlRoomModal);