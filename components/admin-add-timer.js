class AdminAddTimer extends HTMLElement {
  connectedCallback() {
    this.render();
  }

  render() {
    this.innerHTML = `
    <div id="addTimerModal" class="hidden fixed inset-0 z-50 flex items-center justify-center modal-overlay">
      <div class="bg-gray-800 rounded-xl shadow-lg w-11/12 max-w-lg p-6 relative">
        <h2 class="text-2xl font-semibold mb-4">Add Boss Timer (Admin)</h2>

        <div class="flex space-x-4 mb-4 border-b border-gray-700 pb-2">
          <button id="manualTab" class="tab-btn text-blue-400 font-semibold">Manual</button>
          <button id="scheduledTab" class="tab-btn text-gray-400 hover:text-white">Scheduled</button>
        </div>

        <div id="manualForm" class="space-y-3">
          <label class="block text-sm text-gray-300 mb-1">Boss name</label>
          <input id="manualBossName" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white" placeholder="Boss Name">

          <label class="block text-sm text-gray-300 mb-1">Respawn Time (minutes)</label>
          <input id="manualRespawn" type="number" min="1" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white" placeholder="e.g. 120">

          <label class="block text-sm text-gray-300 mb-1">Auto-Restart (minutes, optional)</label>
          <input id="manualAutoRestart" type="number" min="1" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white" placeholder="e.g. 30 (leave empty for off)">
        </div>

        <div id="scheduledForm" class="space-y-3 hidden">
          <label class="block text-sm text-gray-300 mb-1">Boss name</label>
          <input id="scheduledBossName" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white" placeholder="Boss Name">

          <label class="block text-sm text-gray-300 mb-1">Spawn Day (0 = Sun ... 6 = Sat)</label>
          <select id="spawnDay" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
            <option value="0">Sunday</option>
            <option value="1">Monday</option>
            <option value="2">Tuesday</option>
            <option value="3">Wednesday</option>
            <option value="4">Thursday</option>
            <option value="5">Friday</option>
            <option value="6">Saturday</option>
          </select>

          <label class="block text-sm text-gray-300 mb-1">Spawn Time (12-hour)</label>
          <div class="flex items-center space-x-2">
            <input id="spawnHour" type="number" min="1" max="12" placeholder="HH" class="w-20 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
            <span class="text-gray-400">:</span>
            <input id="spawnMinute" type="number" min="0" max="59" placeholder="MM" class="w-20 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
            <select id="spawnAMPM" class="bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white">
              <option value="AM">AM</option>
              <option value="PM">PM</option>
            </select>
          </div>

          <label class="block text-sm text-gray-300 mb-1">Spawn Window (minutes)</label>
          <input id="spawnWindow" type="number" min="1" placeholder="e.g. 30" class="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white">
        </div>

        <div class="flex justify-end space-x-3 mt-6">
          <button id="cancelAddTimer" class="px-3 py-2 rounded bg-gray-600">Cancel</button>
          <button id="saveAddTimer" class="px-3 py-2 rounded bg-green-600">Save</button>
        </div>

        <button id="closeAddTimer" class="absolute top-3 right-3 text-gray-400 hover:text-gray-200">
          <i data-feather="x"></i>
        </button>
      </div>
    </div>
    `;
    feather.replace();
    this.initEvents();
  }

  initEvents() {
    const modal = this.querySelector('#addTimerModal');
    const manualTab = this.querySelector('#manualTab');
    const scheduledTab = this.querySelector('#scheduledTab');
    const manualForm = this.querySelector('#manualForm');
    const scheduledForm = this.querySelector('#scheduledForm');
    const saveBtn = this.querySelector('#saveAddTimer');
    const cancelBtn = this.querySelector('#cancelAddTimer');
    const closeBtn = this.querySelector('#closeAddTimer');

    manualTab.addEventListener('click', () => {
      manualForm.classList.remove('hidden');
      scheduledForm.classList.add('hidden');
      manualTab.classList.add('text-blue-400','font-semibold');
      scheduledTab.classList.remove('text-blue-400','font-semibold');
      scheduledTab.classList.add('text-gray-400');
    });

    scheduledTab.addEventListener('click', () => {
      scheduledForm.classList.remove('hidden');
      manualForm.classList.add('hidden');
      scheduledTab.classList.add('text-blue-400','font-semibold');
      manualTab.classList.remove('text-blue-400','font-semibold');
      manualTab.classList.add('text-gray-400');
    });

    cancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
    closeBtn.addEventListener('click', () => modal.classList.add('hidden'));

    saveBtn.addEventListener('click', async () => {
      // password protection (admin only)
      const pw = prompt('Enter admin password:');
      if (pw !== 'theworldo') { alert('Wrong password'); return; }

      try {
        if (!manualForm.classList.contains('hidden')) {
          const bossName = this.querySelector('#manualBossName').value.trim();
          const respawn = parseInt(this.querySelector('#manualRespawn').value, 10);
          const autoRestartRaw = this.querySelector('#manualAutoRestart').value.trim();
          const autoRestart = autoRestartRaw ? parseInt(autoRestartRaw, 10) : null;
          if (!bossName || isNaN(respawn) || respawn <= 0) { alert('Boss name and valid respawn required'); return; }

          // Use bossName lowercased as doc id — this merges duplicates
          const docId = bossName.toLowerCase().replace(/\s+/g, '-');
          await db.collection('timers').doc(docId).set({
            type: 'manual',
            bossName,
            respawnTime: respawn,
            lastKilled: Date.now(),
            missCount: 0,
            autoRestart: autoRestart || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          alert('Manual timer added/updated.');
          window.logAdminAction?.('Add Manual Timer', `Boss: ${bossName}`);
        } else {
          // scheduled
          const bossName = this.querySelector('#scheduledBossName').value.trim();
          const spawnDay = parseInt(this.querySelector('#spawnDay').value, 10);
          let hour = parseInt(this.querySelector('#spawnHour').value, 10);
          const minute = parseInt(this.querySelector('#spawnMinute').value, 10);
          const ampm = this.querySelector('#spawnAMPM').value;
          const spawnWindow = parseInt(this.querySelector('#spawnWindow').value, 10);

          if (!bossName || isNaN(hour) || isNaN(minute) || isNaN(spawnWindow)) {
            alert('Fill all scheduled fields correctly'); return;
          }
          if (ampm === 'PM' && hour < 12) hour += 12;
          if (ampm === 'AM' && hour === 12) hour = 0;
          const spawnTime = hour * 60 + minute; // minutes of day 0..1439

          // merge by bossName -> use doc id
          const docId = bossName.toLowerCase().replace(/\s+/g, '-');
          await db.collection('timers').doc(docId).set({
            type: 'scheduled',
            bossName,
            spawnDay,
            spawnTime, // minutes-of-day
            spawnWindow,
            lastSpawned: null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          alert('Scheduled timer added/updated.');
          window.logAdminAction?.('Add Scheduled Timer', `Boss: ${bossName}, Day:${spawnDay}, Time:${hour}:${minute}`);
        }

        modal.classList.add('hidden');
      } catch (err) {
        console.error(err);
        alert('Error saving timer: ' + (err.message || err));
      }
    });

    // allow external open via event
    this.addEventListener('openModal', () => modal.classList.remove('hidden'));
  }
}
customElements.define('admin-add-timer', AdminAddTimer);