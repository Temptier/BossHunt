/* components/addBossModal.js
   Minimal add-timer modal to work with the FAB
*/

(() => {
  function openAddModal() {
    let modal = document.getElementById('addBossModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'addBossModal';
      modal.style.position = 'fixed';
      modal.style.inset = 0;
      modal.style.background = 'rgba(2,6,23,0.6)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = 99999;
      modal.innerHTML = `
        <div style="background:var(--glass);padding:20px;border-radius:12px;width:360px;">
          <h3 style="margin:0 0 10px 0;">Add Boss Timer</h3>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <input id="addBossName" placeholder="Boss name" style="padding:8px;border-radius:8px;">
            <select id="addBossType" style="padding:8px;border-radius:8px;">
              <option value="manual">Manual (respawn hours)</option>
              <option value="scheduled">Scheduled (day hh:mm)</option>
            </select>
            <input id="addBossRespawn" placeholder="Respawn hours (for manual)" style="padding:8px;border-radius:8px;">
            <input id="addBossSchedule" placeholder="Schedule e.g. mon 12:30,tue 15:00" style="padding:8px;border-radius:8px;">
            <div style="display:flex;gap:8px;">
              <button id="addBossSave" class="btn-primary" style="flex:1">Add</button>
              <button id="addBossCancel" class="btn-secondary" style="flex:1">Cancel</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('addBossCancel').addEventListener('click', () => modal.remove());

      document.getElementById('addBossSave').addEventListener('click', async () => {
        const name = document.getElementById('addBossName').value.trim();
        const type = document.getElementById('addBossType').value;
        const respawn = parseInt(document.getElementById('addBossRespawn').value, 10);
        const schedule = document.getElementById('addBossSchedule').value.trim();

        if (!name) { alert('Name required'); return; }

        const payload = { bossName: name, type, isActive: true };
        if (type === 'manual') payload.respawnHours = isNaN(respawn) ? 24 : respawn;
        else payload.schedule = schedule || '';

        try {
          await FirebaseHelper.addTimer(payload);
          window.BossApp && window.BossApp.showToast('Boss added', 'success');
          window.BossApp && window.BossApp.refreshTimers();
          modal.remove();
        } catch (err) {
          console.error(err);
          window.BossApp && window.BossApp.showToast('Failed to add boss', 'error');
        }
      });
    }
  }

  // wire up FAB
  document.addEventListener('DOMContentLoaded', () => {
    const fab = document.getElementById('fab-add-timer');
    if (fab) fab.addEventListener('click', openAddModal);
  });
})();