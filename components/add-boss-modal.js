class CustomAddBossModal extends HTMLElement {
  constructor() { super(); this.visible = false; }
  connectedCallback() {
    this.innerHTML = `
    <div id="addBossModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-70 ${this.visible?'block':'hidden'}">
      <div class="bg-gray-800 p-6 rounded-lg w-96">
        <h2 class="text-xl font-bold mb-4">Add Boss</h2>
        <label>Boss Name:</label>
        <input id="bossNameInput" class="w-full mb-2 px-2 py-1 rounded bg-gray-700"/>
        <label>Type:</label>
        <select id="bossTypeInput" class="w-full mb-2 px-2 py-1 rounded bg-gray-700">
          <option value="manual">Manual</option>
          <option value="scheduled">Scheduled</option>
        </select>
        <div id="manualFields">
          <label>Respawn Time (hours):</label>
          <input type="number" id="respawnTimeInput" class="w-full mb-2 px-2 py-1 rounded bg-gray-700"/>
          <label><input type="checkbox" id="autoRestartInput"/> Auto Restart</label>
        </div>
        <div id="scheduledFields" class="hidden">
          <label>Spawn Days:</label>
          <select id="spawnDaysInput" multiple class="w-full mb-2 px-2 py-1 rounded bg-gray-700">
            <option value="0">Sun</option><option value="1">Mon</option><option value="2">Tue</option>
            <option value="3">Wed</option><option value="4">Thu</option><option value="5">Fri</option><option value="6">Sat</option>
          </select>
          <label>Spawn Time (hh:mm AM/PM):</label>
          <input type="text" id="spawnTimeInput" class="w-full mb-2 px-2 py-1 rounded bg-gray-700"/>
          <label>Window (minutes):</label>
          <input type="number" id="spawnWindowInput" class="w-full mb-2 px-2 py-1 rounded bg-gray-700"/>
        </div>
        <button id="saveBossBtn" class="bg-green-600 px-4 py-2 rounded mt-2">Save</button>
      </div>
    </div>`;
    
    const typeSelect = this.querySelector('#bossTypeInput');
    const manualFields = this.querySelector('#manualFields');
    const scheduledFields = this.querySelector('#scheduledFields');

    typeSelect.addEventListener('change',()=>{
      if(typeSelect.value==='manual'){
        manualFields.classList.remove('hidden');
        scheduledFields.classList.add('hidden');
      }else{
        manualFields.classList.add('hidden');
        scheduledFields.classList.remove('hidden');
      }
    });

    this.querySelector('#saveBossBtn').addEventListener('click', async ()=>{
      const bossName = this.querySelector('#bossNameInput').value.trim();
      if(!bossName) return alert('Boss name required');
      const type = typeSelect.value;
      let data = { bossName, type };

      if(type==='manual'){
        data.respawnTime = parseFloat(this.querySelector('#respawnTimeInput').value) || 0;
        data.autoRestart = this.querySelector('#autoRestartInput').checked;
        data.lastKilled = null;
        data.missCount = 0;
      } else {
        data.spawnDays = Array.from(this.querySelector('#spawnDaysInput').selectedOptions).map(o=>parseInt(o.value));
        data.spawnTime = this.querySelector('#spawnTimeInput').value;
        data.spawnWindow = parseInt(this.querySelector('#spawnWindowInput').value) || 0;
        data.lastSpawned = null;
      }

      // Merge duplicate scheduled boss names
      if(type==='scheduled'){
        const snapshot = await db.collection('timers').where('bossName','==',bossName).get();
        if(!snapshot.empty){
          snapshot.forEach(doc=>{
            doc.ref.update({...data});
          });
          alert('Existing scheduled boss updated');
          return this.style.display='none';
        }
      }

      await db.collection('timers').add(data);
      this.style.display='none';
    });
  }
  setAttribute(name,val){ if(name==='visible') this.visible=val==='true'; }
}
customElements.define('custom-add-boss-modal', CustomAddBossModal);