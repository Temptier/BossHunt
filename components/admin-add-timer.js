class AdminAddTimer extends HTMLElement {
  connectedCallback(){ this.render(); }
  render() {
    this.innerHTML = `
      <div id="addTimerModal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay">
        <div class="bg-gray-800 p-6 rounded-lg w-full max-w-lg">
          <h3 class="text-xl font-semibold mb-3">Add Timer (Admin)</h3>
          <div class="flex gap-3 mb-4">
            <button id="manualTab" class="px-3 py-2 bg-blue-600 rounded">Manual</button>
            <button id="scheduledTab" class="px-3 py-2 bg-gray-600 rounded">Scheduled</button>
          </div>
          <div id="manualForm">
            <label class="block text-sm mb-1">Boss name</label>
            <input id="manualName" class="w-full bg-gray-700 px-3 py-2 rounded mb-2">
            <label class="block text-sm mb-1">Respawn minutes</label>
            <input id="manualRespawn" type="number" min="1" class="w-full bg-gray-700 px-3 py-2 rounded mb-2">
            <label class="block text-sm mb-1">Auto-Restart (minutes, optional)</label>
            <input id="manualAutoRestart" type="number" min="1" class="w-full bg-gray-700 px-3 py-2 rounded mb-4" placeholder="Leave empty to disable">
          </div>
          <div id="scheduledForm" class="hidden">
            <label class="block text-sm mb-1">Boss name</label>
            <input id="schedName" class="w-full bg-gray-700 px-3 py-2 rounded mb-2">
            <label class="block text-sm mb-1">Spawn days (single day for now)</label>
            <select id="schedDay" class="w-full bg-gray-700 px-3 py-2 rounded mb-2">
              <option value="0">Sunday</option><option value="1">Monday</option><option value="2">Tuesday</option>
              <option value="3">Wednesday</option><option value="4">Thursday</option><option value="5">Friday</option>
              <option value="6">Saturday</option>
            </select>
            <label class="block text-sm mb-1">Spawn Time (12-hour)</label>
            <div class="flex items-center gap-2 mb-2">
              <input id="schedHour" type="number" min="1" max="12" placeholder="HH" class="w-20 bg-gray-700 px-3 py-2 rounded">
              <span class="text-gray-400">:</span>
              <input id="schedMinute" type="number" min="0" max="59" placeholder="MM" class="w-20 bg-gray-700 px-3 py-2 rounded">
              <select id="schedAMPM" class="bg-gray-700 px-3 py-2 rounded">
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
            <label class="block text-sm mb-1">Spawn Window (minutes)</label>
            <input id="schedWindow" type="number" min="1" class="w-full bg-gray-700 px-3 py-2 rounded mb-2" placeholder="e.g. 30">
          </div>

          <div class="flex justify-end gap-2">
            <button id="cancelAdd" class="px-3 py-2 bg-gray-600 rounded">Cancel</button>
            <button id="saveAdd" class="px-3 py-2 bg-green-600 rounded">Save</button>
          </div>
        </div>
      </div>`;
    feather.replace();
    this.setup();
  }

  setup(){
    const modal = this.querySelector('#addTimerModal');
    const manualTab = this.querySelector('#manualTab');
    const scheduledTab = this.querySelector('#scheduledTab');
    const manualForm = this.querySelector('#manualForm');
    const scheduledForm = this.querySelector('#scheduledForm');

    manualTab.addEventListener('click', ()=>{ manualForm.classList.remove('hidden'); scheduledForm.classList.add('hidden');});
    scheduledTab.addEventListener('click', ()=>{ scheduledForm.classList.remove('hidden'); manualForm.classList.add('hidden');});
    this.querySelector('#cancelAdd').addEventListener('click', ()=> modal.classList.add('hidden'));

    this.querySelector('#saveAdd').addEventListener('click', async ()=>{
      const pw = prompt('Enter admin password:');
      if (pw !== 'theworldo') { alert('Wrong password'); return; }

      if (!manualForm.classList.contains('hidden')) {
        const name = this.querySelector('#manualName').value.trim();
        const respawn = parseInt(this.querySelector('#manualRespawn').value,10);
        const autoRestartRaw = this.querySelector('#manualAutoRestart').value.trim();
        const autoRestart = autoRestartRaw ? parseInt(autoRestartRaw,10) : null;
        if (!name || isNaN(respawn)) return alert('Fill both fields');
        const docId = normalizeId(name);
        await db.collection('timers').doc(docId).set({
          type:'manual', bossName:name, respawnTime:respawn, autoRestart: autoRestart || null,
          lastKilled: Date.now(), missCount:0, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        alert('Manual timer added');
        window.logAdminAction?.('Add Manual Timer', `Boss: ${name}`);
      } else {
        const name = this.querySelector('#schedName').value.trim();
        const day = parseInt(this.querySelector('#schedDay').value,10);
        let hour = parseInt(this.querySelector('#schedHour').value,10);
        const minute = parseInt(this.querySelector('#schedMinute').value,10);
        const ampm = this.querySelector('#schedAMPM').value;
        const win = parseInt(this.querySelector('#schedWindow').value,10);
        if (!name || isNaN(hour) || isNaN(minute) || isNaN(win)) return alert('Fill all fields');
        if (ampm === 'PM' && hour < 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        const spawnTime = hour*60 + minute;
        const docId = normalizeId(name);
        await db.collection('timers').doc(docId).set({
          type:'scheduled', bossName:name, spawnDay:day, spawnTime:spawnTime, spawnWindow: win,
          lastSpawned: null, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        alert('Scheduled timer added');
        window.logAdminAction?.('Add Scheduled Timer', `Boss: ${name}`);
      }
      modal.classList.add('hidden');
    });

    // open externally
    this.addEventListener('openModal', ()=> modal.classList.remove('hidden'));
  }
}
customElements.define('admin-add-timer', AdminAddTimer);