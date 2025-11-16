// modals.js
export function showModal(html, { closeOnBackdrop = true } = {}) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="overlay" id="__overlay"><div class="modal card" id="__modal">${html}</div></div>`;
  const overlay = document.getElementById('__overlay');
  function remove() { root.innerHTML = ''; }
  if (closeOnBackdrop) overlay.addEventListener('click', e => { if (e.target === overlay) remove(); });
  return { remove, overlay };
}

export function showWelcome(existing = {}, onSubmit) {
  const html = `
    <h3>Welcome</h3>
    <p class="muted">Enter IGN and Guild</p>
    <div><label>IGN</label><input id="w-ign" value="${existing.ign||''}" /></div>
    <div><label>Guild</label><input id="w-guild" value="${existing.guild||''}" /></div>
    <div class="flex"><button id="w-save">Save</button><button id="w-cancel" class="ghost">Cancel</button></div>
  `;
  const m = showModal(html);
  document.getElementById('w-save').onclick = () => {
    const ign = document.getElementById('w-ign').value.trim();
    const guild = document.getElementById('w-guild').value.trim();
    if(!ign||!guild){ alert('Fill both fields'); return; }
    onSubmit({ign,guild}); m.remove();
  };
  document.getElementById('w-cancel').onclick = () => m.remove();
  return m;
}

export function showAddManual(onAdd) {
  const html = `
    <h3>Add Manual Boss</h3>
    <div><label>Name</label><input id="m-name" placeholder="Boss name" /></div>
    <div style="margin-top:8px"><label class="muted">Respawn (minutes)</label>
  <input id="m-respawn" type="number" min="1" value="60" />
</div>
<div style="margin-top:8px" class="row">
  <input id="m-auto" type="checkbox" /> 
  <div class="muted">Enable auto-reset after expiry</div>
</div>
    <div class="flex"><button id="m-add">Add</button><button id="m-cancel" class="ghost">Cancel</button></div>
  `;
  const m = showModal(html);
  document.getElementById('m-add').onclick = () => {
    const name = document.getElementById('m-name').value.trim();
    const respawn = Math.max(1,parseInt(document.getElementById('m-respawn').value)||60);
    const enableAuto = document.getElementById('m-auto').checked;
    if(!name){ alert('Name required'); return; }
    onAdd({id:'m_'+Date.now(),name,respawnMinutes:respawn,enableAutoReset:enableAuto});
    m.remove();
  };
  document.getElementById('m-cancel').onclick = ()=>m.remove();
  return m;
}

export function showAddScheduled(onAdd) {
  const html = `
    <h3>Add Scheduled Boss</h3>
    <div><label>Name</label><input id="s-name"/></div>
    <div class="row">
      <div class="col"><label>Day (0 Sun - 6 Sat)</label><input id="s-day" type="number" min="0" max="6" value="0"/></div>
      <div class="col"><label>Hour (0-23)</label><input id="s-hour" type="number" min="0" max="23" value="12"/></div>
      <div class="col"><label>Minute (0-59)</label><input id="s-minute" type="number" min="0" max="59" value="0"/></div>
    </div>
    <div class="flex"><button id="s-add">Add</button><button id="s-cancel" class="ghost">Cancel</button></div>
  `;
  const m = showModal(html);
  document.getElementById('s-add').onclick = ()=>{
    const name=document.getElementById('s-name').value.trim();
    const day=parseInt(document.getElementById('s-day').value);
    const hour=parseInt(document.getElementById('s-hour').value);
    const minute=parseInt(document.getElementById('s-minute').value);
    if(!name){ alert('Name required'); return; }
    onAdd({id:'s_'+Date.now(),name,respawnDay:day,respawnHour:hour,respawnMinute:minute});
    m.remove();
  };
  document.getElementById('s-cancel').onclick=()=>m.remove();
  return m;
}

export function showDeleteConfirm(name,onYes){
  const html = `
    <p class="muted">Enter password to delete <strong>${name}</strong>:</p>
    <input id="del-pass" type="password" placeholder="Password"/>
    <div class="flex"><button id="del-yes">Delete</button><button id="del-no" class="ghost">Cancel</button></div>
  `;
  const m = showModal(html);
  document.getElementById('del-yes').onclick=()=>{
    const pass=document.getElementById('del-pass').value;
    if(pass==='theworldo'){onYes(); m.remove();} else alert('Incorrect password');
  };
  document.getElementById('del-no').onclick=()=>m.remove();
  return m;
}