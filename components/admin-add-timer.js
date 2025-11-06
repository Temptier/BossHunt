class AdminAddTimer extends HTMLElement {
  connectedCallback(){
    this.render();
  }
  render(){
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
            <input id="manualRespawn" type="number" min="1" class="w-full bg-gray-700 px-3 py-2 rounded mb-4">
          </div>
          <div id="scheduledForm" class="hidden">
            <label class="block text-sm mb-1">Boss name</label>
            <input id="schedName" class="w-full bg-gray-700 px-3 py-2 rounded mb-2">
            <label class="block text-sm mb-1">Spawn days (0=Sun..6=Sat, comma separated)</label>
            <input id="schedDays" class="w-full bg-gray-700 px-3 py-2 rounded mb-2" placeholder="e.g. 1,3,5">
            <label class="block text-sm mb-1">Spawn window minutes</label>
            <input id="schedWindow" type="number" min="1" class="w-full bg-gray-700 px-3 py-2 rounded mb-4">
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
      // password protection
      const pw = prompt('Enter admin password:');
      if (pw !== 'theworldo') { alert('Wrong password'); return; }

      // decide if manual or scheduled
      if (!manualForm.classList.contains('hidden')) {
        const name = this.querySelector('#manualName').value.trim();
        const respawn = parseInt(this.querySelector('#manualRespawn').value);
        if (!name || !respawn) return alert('Fill both fields');
        await db.collection('timers').add({
          type:'manual',
          bossName:name,
          respawnTime:respawn,
          lastKilled: Date.now(),
          missCount:0,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Manual timer added');
        logAdminAction('Add Manual Timer', `Boss: ${name}`);
      } else {
        const name = this.querySelector('#schedName').value.trim();
        const days = this.querySelector('#schedDays').value.split(',').map(s=>parseInt(s.trim())).filter(n=>!isNaN(n));
        const windowM = parseInt(this.querySelector('#schedWindow').value);
        if (!name || !days.length || !windowM) return alert('Fill all fields');
        await db.collection('timers').add({
          type:'scheduled',
          bossName:name,
          spawnDays:Array.from(new Set(days)),
          spawnWindow:windowM,
          lastSpawned: Date.now(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('Scheduled timer added');
        logAdminAction('Add Scheduled Timer', `Boss: ${name}`);
      }
      modal.classList.add('hidden');
    });

    // external open
    this.addEventListener('openModal', ()=> this.querySelector('#addTimerModal').classList.remove('hidden'));
  }
}
customElements.define('admin-add-timer', AdminAddTimer);