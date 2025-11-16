// modals.js

export const Modals = (() => {

  function showWelcome(onSubmit) {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h2>Welcome to Boss Timer</h2>
        <label>IGN:</label><input type="text" id="ign" />
        <label>Guild:</label><input type="text" id="guild" />
        <button id="submitUser">Continue</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#submitUser').addEventListener('click', () => {
      const ign = modal.querySelector('#ign').value.trim();
      const guild = modal.querySelector('#guild').value.trim();
      if(!ign || !guild) return alert('Fill all fields');
      onSubmit({ ign, guild });
      modal.remove();
    });
  }

  function showAddBoss(type, onAdd) {
    const modal = document.createElement('div');
    modal.className = 'modal-bg';
    modal.innerHTML = `
      <div class="modal">
        <h2>Add ${type} Boss</h2>
        <label>Name:</label><input type="text" id="bossName" />
        ${type==='scheduled'? `
          <label>Day (0-6):</label><input type="number" id="respawnDay" min="0" max="6"/>
          <label>Hour (0-23):</label><input type="number" id="respawnHour" min="0" max="23"/>
          <label>Minute (0-59):</label><input type="number" id="respawnMinute" min="0" max="59"/>
        `: `<label>Respawn Time (minutes):</label><input type="number" id="respawnTime" min="1"/>`}
        <button id="addBossBtn">Add Boss</button>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#addBossBtn').addEventListener('click', () => {
      const name = modal.querySelector('#bossName').value.trim();
      if(!name) return alert('Enter boss name');
      let boss;
      if(type==='scheduled'){
        const day = modal.querySelector('#respawnDay').value;
        const hour = modal.querySelector('#respawnHour').value;
        const min = modal.querySelector('#respawnMinute').value;
        boss = { name, respawnDay: day, respawnHour: hour, respawnMinute: min };
      } else {
        const respawnTime = modal.querySelector('#respawnTime').value;
        boss = { name, respawnTime };
      }
      onAdd(boss);
      modal.remove();
    });
  }

  function formatTime12(hour, minute) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h.toString().padStart(2,'0')}:${minute.toString().padStart(2,'0')} ${ampm}`;
  }

  return { showWelcome, showAddBoss, formatTime12 };
})();