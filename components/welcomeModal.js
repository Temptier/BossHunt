/* components/welcomeModal.js
   Small first-time modal for index.html
   - stores playerName in localStorage and BOSS APP reads it
*/

(() => {
  // show simple inline modal if player not set
  const localKey = 'boss_player_name';

  function showModal() {
    // basic modal creation
    let modal = document.getElementById('welcomeModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'welcomeModal';
      modal.style.position = 'fixed';
      modal.style.inset = '0';
      modal.style.background = 'rgba(2,6,23,0.6)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = 99999;
      modal.innerHTML = `
        <div style="background:var(--glass);padding:18px;border-radius:12px;min-width:320px;">
          <h3 style="margin:0 0 8px 0;">Welcome — Enter your name</h3>
          <input id="welcomeName" placeholder="Player name" style="width:100%;padding:8px;border-radius:8px;margin-bottom:10px;">
          <div style="display:flex;gap:8px">
            <button id="welcomeSave" class="btn-primary" style="flex:1">Save</button>
            <button id="welcomeSkip" class="btn-secondary" style="flex:1">Skip</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('welcomeSave').addEventListener('click', () => {
        const v = document.getElementById('welcomeName').value.trim();
        if (v) {
          localStorage.setItem(localKey, v);
          window.BossApp && window.BossApp.setPlayerName(v);
        }
        modal.remove();
      });

      document.getElementById('welcomeSkip').addEventListener('click', () => {
        modal.remove();
      });
    }
  }

  // bootstrap
  document.addEventListener('DOMContentLoaded', () => {
    const existing = localStorage.getItem(localKey);
    if (existing) {
      window.BossApp && window.BossApp.setPlayerName(existing);
    } else {
      // show after a slight delay so page renders
      setTimeout(showModal, 350);
    }
  });
})();