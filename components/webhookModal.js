/* components/webhookModal.js
   Simple modal to view/add webhooks
*/

(() => {
  function openWebhooks() {
    let modal = document.getElementById('webhookModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'webhookModal';
      modal.style.position = 'fixed';
      modal.style.inset = 0;
      modal.style.background = 'rgba(2,6,23,0.6)';
      modal.style.display = 'flex';
      modal.style.alignItems = 'center';
      modal.style.justifyContent = 'center';
      modal.style.zIndex = 99999;
      modal.innerHTML = `
        <div style="background:var(--glass);padding:18px;border-radius:12px;width:520px;max-height:80vh;overflow:auto;">
          <h3 style="margin-top:0;">Webhooks</h3>
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input id="webhookName" placeholder="Name" style="flex:1;padding:8px;border-radius:8px;">
            <input id="webhookUrl" placeholder="Webhook URL" style="flex:2;padding:8px;border-radius:8px;">
            <button id="webhookAdd" class="btn-primary">Add</button>
          </div>
          <div id="webhookList" style="display:flex;flex-direction:column;gap:8px;"></div>
          <div style="text-align:right;margin-top:12px;">
            <button id="webhookClose" class="btn-secondary">Close</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('webhookClose').addEventListener('click', () => modal.remove());

      document.getElementById('webhookAdd').addEventListener('click', async () => {
        const name = document.getElementById('webhookName').value.trim();
        const url = document.getElementById('webhookUrl').value.trim();
        if (!name || !url) { alert('Name and URL required'); return; }
        try {
          await FirebaseHelper.addWebhook({ name, url, createdBy: localStorage.getItem('boss_player_name') || 'unknown' });
          window.BossApp && window.BossApp.showToast('Webhook added', 'success');
          document.getElementById('webhookName').value = '';
          document.getElementById('webhookUrl').value = '';
          refreshList();
        } catch (err) {
          console.error(err);
          window.BossApp && window.BossApp.showToast('Failed to add webhook', 'error');
        }
      });

      // initial populate
      async function refreshList() {
        // read current webhooks via list (one-shot)
        const snap = await FirebaseHelper._raw.db.collection('webhooks').orderBy('createdAt', 'asc').get();
        const arr = [];
        snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
        const list = document.getElementById('webhookList');
        list.innerHTML = '';
        arr.forEach(w => {
          const div = document.createElement('div');
          div.style.display = 'flex';
          div.style.justifyContent = 'space-between';
          div.style.alignItems = 'center';
          div.style.gap = '8px';
          div.innerHTML = `<div style="flex:1"><strong>${w.name}</strong><div style="font-size:12px;color:var(--muted)">${w.url}</div></div>
            <div><button class="btn-secondary btn-remove-webhook" data-id="${w.id}">Remove</button></div>`;
          list.appendChild(div);
        });
        // attach remove listeners
        document.querySelectorAll('.btn-remove-webhook').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            if (!confirm('Remove webhook?')) return;
            try {
              await FirebaseHelper.removeWebhook(id);
              window.BossApp && window.BossApp.showToast('Webhook removed', 'success');
              refreshList();
            } catch (err) {
              console.error(err);
              window.BossApp && window.BossApp.showToast('Failed to remove', 'error');
            }
          });
        });
      }

      refreshList();
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('webhooks-btn');
    if (btn) btn.addEventListener('click', openWebhooks);
  });
})();