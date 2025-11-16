// main.js
import * as Modal from './modals.js';
import { saveObject, pushObject, removePath, listenPath, getOnce } from './firebase.js';

/* -------------------------
   Local storage wrapper
   ------------------------- */
const storage = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

/* -------------------------
   App state
   ------------------------- */
let state = {
  userInfo: storage.get('userInfo') || null,
  manual: storage.get('manualBosses') || [],
  scheduled: storage.get('scheduledBosses') || [],
  webhook: storage.get('webhookUrl') || '',
  selections: new Set()
};

/* -------------------------
   DOM refs
   ------------------------- */
const userInfoEl = document.getElementById('user-info');
const editInfoBtn = document.getElementById('edit-info');
const stopAllBtn = document.getElementById('stop-all');

const manualList = document.getElementById('manual-list');
const manualEmpty = document.getElementById('manual-empty');
const schedList = document.getElementById('sched-list');
const schedEmpty = document.getElementById('sched-empty');
const todayList = document.getElementById('today-list');
const todayEmpty = document.getElementById('today-empty');

const addManualBtn = document.getElementById('add-manual');
const addSchedBtn = document.getElementById('add-scheduled');

const webhookInput = document.getElementById('webhook-url');
const saveWebhookBtn = document.getElementById('save-webhook');

const controlBosses = document.getElementById('control-bosses');
const openControlBtn = document.getElementById('open-control');
const sendNotifyBtn = document.getElementById('send-notify');
const controlMsg = document.getElementById('control-msg');
const lastAction = document.getElementById('last-action');

/* -------------------------
   Helpers: time formatting
   ------------------------- */
function formatRemaining(diffMs) {
  if (diffMs <= 0) return 'Spawned!';
  const s = Math.floor(diffMs / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function calcNextForScheduled(b) {
  const now = new Date();
  const targetDay = parseInt(b.respawnDay);
  const targetHour = parseInt(b.respawnHour);
  const targetMinute = parseInt(b.respawnMinute);
  let next = new Date();
  next.setHours(targetHour, targetMinute, 0, 0);
  const currentDay = now.getDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0 && next <= now) daysUntil = 7;
  next.setDate(next.getDate() + daysUntil);
  return next;
}

/* -------------------------
   10-minute warning
   ------------------------- */
const TEN_MIN = 10 * 60 * 1000;
let lastWarned = {};

/* -------------------------
   Tick: updates UI and warnings
   ------------------------- */
function tick() {
  const now = new Date();

  // manual timers
  state.manual.forEach(b => {
    const el = document.getElementById(`manual-${b.id}`);
    const info = el?.querySelector('.muted');
    if (!b.target) { if (info) info.textContent = 'Not started'; return; }
    const diff = new Date(b.target).getTime() - now.getTime();
    if (info) info.textContent = formatRemaining(diff);
    if (diff <= TEN_MIN && diff > 0 && !lastWarned[b.id]) {
      lastWarned[b.id] = true;
      showWarning(`${b.name} will spawn in less than 10 minutes!`);
      maybeSendWebhook(`10-minute Warning: ${b.name} will spawn in ${formatRemaining(diff)}`);
    }
    if (diff <= 0 && b.enableAutoReset) {
      // auto reset logic — set new target if needed
      if (!b._autoReseted) {
        b._autoReseted = true;
        b.target = new Date(now.getTime() + b.respawnMinutes * 60 * 1000).toISOString();
        storage.set('manualBosses', state.manual);
        // optionally push to RTDB:
        // saveObject(`manual/${b.id}`, b);
      }
    }
  });

  // scheduled timers
  state.scheduled.forEach(b => {
    const el = document.getElementById(`sched-${b.id}`);
    const info = el?.querySelector('.muted');
    const next = calcNextForScheduled(b);
    const diff = next.getTime() - now.getTime();
    if (info) info.textContent = `${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][b.respawnDay]} ${String(b.respawnHour).padStart(2,'0')}:${String(b.respawnMinute).padStart(2,'0')} · ${formatRemaining(diff)}`;
    if (diff <= TEN_MIN && diff > 0 && !lastWarned[b.id]) {
      lastWarned[b.id] = true;
      showWarning(`${b.name} scheduled in less than 10 minutes!`);
      maybeSendWebhook(`10-minute Warning: Scheduled ${b.name} will spawn in ${formatRemaining(diff)}`);
    }
  });

  renderControlRoom();
}

/* -------------------------
   Render functions
   ------------------------- */
function renderUserInfo() {
  if (state.userInfo) userInfoEl.textContent = `IGN: ${state.userInfo.ign} | Guild: ${state.userInfo.guild}`;
  else userInfoEl.textContent = 'Please set your IGN & Guild';
}

function renderManual() {
  manualList.innerHTML = '';
  if (state.manual.length === 0) { manualEmpty.style.display = 'block'; return; }
  manualEmpty.style.display = 'none';
  state.manual.forEach(b => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.id = `manual-${b.id}`;
    div.innerHTML = `
      <div style="display:flex;flex-direction:column">
        <div style="display:flex;gap:8px;align-items:center"><span style="font-weight:700">${b.name}</span><span class="muted">Respawn ${b.respawnMinutes}m</span></div>
        <div class="muted" style="margin-top:6px">Not started</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <div style="display:flex;gap:6px">
          <button class="small" data-action="start" data-id="${b.id}">Start</button>
          <button class="small" data-action="restart" data-id="${b.id}" style="background:#10b981">Restart</button>
          <button class="small" data-action="delete" data-id="${b.id}" style="background:#ef4444">Delete</button>
        </div>
      </div>
    `;
    manualList.appendChild(div);
  });
}

function renderScheduled() {
  schedList.innerHTML = '';
  if (state.scheduled.length === 0) { schedEmpty.style.display = 'block'; return; }
  schedEmpty.style.display = 'none';
  state.scheduled.forEach(b => {
    const div = document.createElement('div');
    div.className = 'list-item';
    div.id = `sched-${b.id}`;
    div.innerHTML = `
      <div style="display:flex;flex-direction:column">
        <div style="display:flex;gap:8px;align-items:center"><span style="font-weight:700">${b.name}</span></div>
        <div class="muted" style="margin-top:6px">--</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;align-items:flex-end">
        <div style="display:flex;gap:6px">
          <button class="small" data-action="delete-sched" data-id="${b.id}" style="background:#ef4444">Delete</button>
        </div>
      </div>
    `;
    schedList.appendChild(div);
  });
}

function renderToday() {
  todayList.innerHTML = '';
  const today = new Date().getDay();
  const todays = state.scheduled.filter(b => parseInt(b.respawnDay) === today);
  if (todays.length === 0) { todayEmpty.style.display = 'block'; return; }
  todayEmpty.style.display = 'none';
  todays.forEach(b => {
    const node = document.createElement('div');
    node.className = 'list-item';
    node.innerHTML = `<div><strong>${b.name}</strong></div><div class="muted">${String(b.respawnHour).padStart(2,'0')}:${String(b.respawnMinute).padStart(2,'0')}</div>`;
    todayList.appendChild(node);
  });
}

function renderControlRoom() {
  controlBosses.innerHTML = '';
  const all = [...state.manual.map(b => ({ id: b.id, name: b.name, type: 'manual' })), ...state.scheduled.map(b => ({ id: b.id, name: b.name, type: 'scheduled' }))];
  if (all.length === 0) { controlBosses.innerHTML = '<div class="muted">No bosses configured</div>'; return; }
  all.forEach(b => {
    const div = document.createElement('div');
    div.className = 'list-item';
    const checked = state.selections.has(b.id) ? 'background:#c7f3ff;border:1px solid #9ae7ff' : '';
    div.style = checked;
    div.innerHTML = `<div><strong>${b.name}</strong><div class="muted">${b.type}</div></div><div><button class="small" data-toggle="${b.id}">${state.selections.has(b.id) ? 'Unselect' : 'Select'}</button></div>`;
    controlBosses.appendChild(div);
  });
}

/* -------------------------
   warnings + webhook
   ------------------------- */
function showWarning(msg) {
  lastAction.textContent = `⚠️ ${msg}`;
  setTimeout(() => { if (lastAction.textContent.startsWith('⚠️')) lastAction.textContent = ''; }, 8000);
  // small popup fallback
  // alert(msg);
}

async function sendWebhook(content) {
  const url = state.webhook;
  if (!url) return { ok: false, msg: 'No webhook' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, username: 'Boss Timer Bot' })
    });
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, msg: `HTTP ${res.status}: ${txt}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, msg: e.message };
  }
}

async function maybeSendWebhook(msg) {
  if (!state.webhook) return;
  const r = await sendWebhook(msg);
  if (!r.ok) {
    console.warn('Webhook error', r.msg);
    lastAction.textContent = 'Webhook failed';
    setTimeout(() => { if (lastAction.textContent === 'Webhook failed') lastAction.textContent = ''; }, 4000);
  } else {
    lastAction.textContent = 'Webhook sent';
    setTimeout(() => { if (lastAction.textContent === 'Webhook sent') lastAction.textContent = ''; }, 3000);
  }
}

/* -------------------------
   Event listeners & handlers
   ------------------------- */
addManualBtn.onclick = () => Modal.showAddManual((b) => {
  state.manual.push(b); storage.set('manualBosses', state.manual); renderManual(); renderControlRoom();
  // optional: push to RTDB (uncomment if you want remote)
  // pushObject('manual', b);
});

addSchedBtn.onclick = () => Modal.showAddScheduled((b) => {
  state.scheduled.push(b); storage.set('scheduledBosses', state.scheduled); renderScheduled(); renderToday(); renderControlRoom();
  // optional: push to RTDB
  // pushObject('scheduled', b);
});

editInfoBtn.onclick = () => Modal.showWelcome(state.userInfo, (data) => {
  state.userInfo = data; storage.set('userInfo', data); renderUserInfo();
});

stopAllBtn.onclick = () => {
  const pass = prompt('Enter password to stop all timers');
  if (pass === 'theworldo') {
    state.manual = []; state.scheduled = [];
    storage.set('manualBosses', state.manual); storage.set('scheduledBosses', state.scheduled);
    renderManual(); renderScheduled(); renderToday(); renderControlRoom();
    alert('All timers stopped');
    // optional: remove from RTDB
    // removePath('manual'); removePath('scheduled');
  } else alert('Incorrect password');
};

manualList.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const id = btn.dataset.id; const action = btn.dataset.action;
  const idx = state.manual.findIndex(x => x.id === id);
  if (action === 'delete') { if (idx > -1) { state.manual.splice(idx, 1); storage.set('manualBosses', state.manual); renderManual(); renderControlRoom(); } }
  if (action === 'start') { if (idx > -1) { const now = new Date(); state.manual[idx].target = new Date(now.getTime() + state.manual[idx].respawnMinutes * 60 * 1000).toISOString(); storage.set('manualBosses', state.manual); renderManual(); } }
  if (action === 'restart') { if (idx > -1) { const now = new Date(); state.manual[idx].target = new Date(now.getTime() + state.manual[idx].respawnMinutes * 60 * 1000).toISOString(); state.manual[idx]._autoReseted = false; storage.set('manualBosses', state.manual); renderManual(); } }
});

schedList.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const id = btn.dataset.id; const action = btn.dataset.action;
  if (action === 'delete-sched') { const idx = state.scheduled.findIndex(x => x.id === id); if (idx > -1) { state.scheduled.splice(idx, 1); storage.set('scheduledBosses', state.scheduled); renderScheduled(); renderToday(); renderControlRoom(); } }
});

saveWebhookBtn.onclick = () => {
  const url = webhookInput.value.trim();
  if (!url) { alert('Enter webhook'); return; }
  if (!url.includes('discord.com/api/webhooks')) { if (!confirm('Webhook does not look like a Discord webhook. Save anyway?')) return; }
  state.webhook = url; storage.set('webhookUrl', url); alert('Webhook saved'); renderControlRoom();
};

openControlBtn.onclick = () => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); };

controlBosses.addEventListener('click', (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  const id = btn.dataset.toggle; if (!id) return;
  if (state.selections.has(id)) state.selections.delete(id); else state.selections.add(id);
  renderControlRoom();
});

sendNotifyBtn.onclick = async () => {
  if (state.selections.size === 0) { alert('Select at least one boss'); return; }
  const names = [...state.selections].map(id => {
    const m = state.manual.find(x => x.id === id); if (m) return m.name;
    const s = state.scheduled.find(x => x.id === id); if (s) return s.name;
    return id;
  });
  const content = `${controlMsg.value || ''}\nBosses: ${names.join(', ')}`;
  const r = await sendWebhook(content);
  if (r.ok) alert('Notification sent'); else alert('Failed: ' + (r.msg || 'unknown'));
  lastAction.textContent = `Last: ${new Date().toLocaleTimeString()}`;
  setTimeout(() => { lastAction.textContent = ''; }, 3000);
};

/* -------------------------
   Initialize & loop
   ------------------------- */
function initFromStorage() {
  state.manual = state.manual.map(m => ({ respawnMinutes: m.respawnMinutes || m.respawnTime || 60, ...m }));
  webhookInput.value = state.webhook || '';
  renderUserInfo(); renderManual(); renderScheduled(); renderToday(); renderControlRoom();
}

initFromStorage();
setInterval(tick, 1000);

/* -------------------------
   Optional: example RTDB listeners (disabled by default)
   ------------------------- */
// To enable remote sync, uncomment and adapt:
// listenPath('manual', (d) => { if (d) { state.manual = Object.values(d); storage.set('manualBosses', state.manual); renderManual(); } });
// listenPath('scheduled', (d) => { if (d) { state.scheduled = Object.values(d); storage.set('scheduledBosses', state.scheduled); renderScheduled(); renderToday(); } });