/* script.js
 Global timer version — all users share same timers.
 Offline view-only, continuous timers, 10-min warnings, auto-restart.
 Assumes firebase.js exports helper functions without guild dependency:
   saveTimer, getAllTimers, updateTimer, deleteTimer, saveWebhook,
   getAllWebhooks, logAction, stopAllTimers, calculateNextSpawnForScheduled, validateAdminKey
*/

import {
  saveTimer,
  getAllTimers,
  updateTimer,
  deleteTimer,
  saveWebhook,
  getAllWebhooks,
  logAction,
  stopAllTimers,
  calculateNextSpawnForScheduled,
  validateAdminKey
} from './firebase.js';

const importAddBoss = () => import('./components/addBossModal.js');
const importWebhook = () => import('./components/webhookModal.js');
const importControlRoom = () => import('./components/controlRoomModal.js');

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

const USER_KEY = 'boss_timer_user_v1';
function loadUser(){ try { return JSON.parse(localStorage.getItem(USER_KEY)) || {}; } catch(e){ return {}; } }
function saveUser(u){ localStorage.setItem(USER_KEY, JSON.stringify(u)); }

let currentUser = loadUser();
let timersCache = [];
let webhooksCache = [];
const POLL_INTERVAL_MS = 60_000;
let backgroundTimer = null;

function isOnline(){ return navigator.onLine; }
function showToast(txt, timeout = 3000){
  let t = document.getElementById('__boss_toast');
  if (!t) {
    t = document.createElement('div');
    t.id = '__boss_toast';
    t.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded shadow-lg z-50';
    document.body.appendChild(t);
  }
  t.textContent = txt;
  t.style.opacity = '1';
  if (timeout > 0) setTimeout(()=> t.style.opacity = '0', timeout);
}

function setOfflineUI(enabled) {
  const selectors = ['#addBossBtn', '.restartBtn', '.stopBtn', '.notifyBtn', '#openWebhookBtn', '#openControlRoom'];
  selectors.forEach(sel => document.querySelectorAll(sel).forEach(n => {
    if (enabled) { n?.setAttribute('disabled','true'); n?.classList.add('opacity-50','pointer-events-none'); }
    else { n?.removeAttribute('disabled'); n?.classList.remove('opacity-50','pointer-events-none'); }
  }));
  if ($('#offlineIndicator')) $('#offlineIndicator').style.display = enabled ? 'inline' : 'none';
  if ($('#onlineIndicator')) $('#onlineIndicator').style.display = enabled ? 'none' : 'inline';
}

window.addEventListener('online', () => { setOfflineUI(false); refreshIndex().catch(e=>console.warn(e)); });
window.addEventListener('offline', () => { setOfflineUI(true); showToast('Offline mode — actions disabled until reconnect.'); });

window.addEventListener('DOMContentLoaded', async () => {
  const path = location.pathname.split('/').pop();
  if (path === 'admin.html') initAdminPage();
  else await initIndexPage();
  setOfflineUI(!isOnline());
  if (!backgroundTimer) backgroundTimer = setInterval(() => {
    if (isOnline()) refreshIndex().catch(e=>console.warn(e));
    else refreshIndexCached();
  }, POLL_INTERVAL_MS);
});

async function initIndexPage() {
  if (!currentUser?.ign) {
    try { await import('./components/welcomeModal.js'); currentUser = loadUser(); }
    catch(e){ console.error('welcome modal load fail', e); }
    if (!currentUser?.ign) { showToast('Please set IGN.'); return; }
  }

  $('#addBossBtn')?.addEventListener('click', async () => {
    if (!isOnline()) { showToast('Offline — cannot add boss'); return; }
    const mod = await importAddBoss();
    mod.showAddBossModal('manual', async (data) => {
      const now = new Date();
      const nextSpawn = new Date(now.getTime() + (data.hours||0)*3600*1000).toISOString();
      const timerDoc = {
        name: data.name,
        type: 'manual',
        hours: data.hours,
        lastKilled: now.toISOString(),
        nextSpawn,
        autoRestart: data.autoRestart||null,
        missCount: 0,
        active: true,
        lastWarningCycle: null
      };
      try {
        await saveTimer(timerDoc);
        await logAction(currentUser.ign||'guest', `Added manual ${data.name}`);
        showToast('Boss added');
        await refreshIndex();
      } catch (err) { console.error(err); alert('Failed to add boss'); }
    });
  });

  $('#openWebhookBtn')?.addEventListener('click', async () => {
    if (!isOnline()) { showToast('Offline — cannot save webhook'); return; }
    const mod = await importWebhook();
    mod.showWebhookModal();
    setTimeout(()=>refreshIndex().catch(e=>console.warn(e)), 800);
  });

  document.addEventListener('click', async (e) => {
    if (e.target.closest && e.target.closest('#openControlRoom')) {
      if (!isOnline()) { showToast('Offline — control room disabled'); return; }
      const webhooks = await getAllWebhooks();
      if (!webhooks || webhooks.length === 0) return alert('No webhooks configured.');
      const bosses = timersCache.map(t => ({ name: t.name, isToday: isTimerEndingToday(t), id: t.id }));
      const mod = await importControlRoom();
      mod.showControlRoomModal(bosses, async (selectedNames, message) => {
        const urls = webhooks.map(w => w.url);
        await sendEmbedNotification(selectedNames, message, urls);
        showToast('Notifications sent');
      });
    }
  });

  await refreshIndex();
}

function initAdminPage() {
  $('#loginAdmin')?.addEventListener('click', async () => {
    if (!isOnline()) { alert('Admin login requires online'); return; }
    const phrase = $('#adminKey')?.value;
    const ok = await validateAdminKey(phrase);
    if (!ok) return alert('Invalid admin key');
    $('#authSection')?.classList.add('hidden');
    $('#adminPanel')?.classList.remove('hidden');
    await refreshAdminPanel();
  });

  $('#stopAllBtn')?.addEventListener('click', async () => {
    if (!isOnline()) { showToast('Offline — cannot stop all timers'); return; }
    if (!confirm('Stop all timers globally?')) return;
    await stopAllTimers();
    showToast('All timers stopped (admin)');
    await refreshAdminPanel();
  });

  $('#adminSendWarnings')?.addEventListener('click', async () => {
    if (!isOnline()) { showToast('Offline — cannot send warnings'); return; }
    if (!confirm('Trigger pending 10-min warnings now?')) return;
    await adminTriggerWarningsNow();
    showToast('Admin: triggered warnings');
  });
}

async function refreshIndex() {
  if (isOnline()) {
    timersCache = await getAllTimers();
    webhooksCache = await getAllWebhooks();
  }
  renderTimers(); renderTodayPanel();
  if (isOnline()) await handleWarningsAndAutoRestart();
}
function refreshIndexCached() { renderTimers(); renderTodayPanel(); }

async function refreshAdminPanel() {
  if (!isOnline()) { showToast('Offline — limited admin view'); return; }
  const timers = await getAllTimers();
  const root = $('#adminTimers'); if (!root) return; root.innerHTML = '';
  const card = document.createElement('div'); card.className = 'p-3 bg-gray-800 rounded mb-2';
  card.innerHTML = `<div class="font-semibold">Global Timers</div><div class="text-sm">Timers: ${timers.length}</div>`;
  root.appendChild(card);
}

/* Render helpers */
function renderTimers() {
  const root = $('#timersList'); if (!root) return; root.innerHTML = '';
  timersCache.forEach(t => {
    const rem = t.nextSpawn ? Math.max(0, new Date(t.nextSpawn).getTime() - Date.now()) : null;
    const remStr = rem != null ? msToHMS(rem) : '-';
    const card = document.createElement('div'); card.className = 'p-3 bg-slate-800 rounded mb-2 flex justify-between items-center';
    card.innerHTML = `
      <div>
        <div class="font-medium">${escapeHtml(t.name)}</div>
        <div class="text-xs text-slate-400">Next: ${t.nextSpawn ? formatTimeISO(t.nextSpawn) : '-'} • ${remStr}</div>
        <div class="text-xs text-slate-400">Misses: ${t.missCount||0}</div>
      </div>
      <div class="flex flex-col gap-2 items-end">
        <div class="flex gap-2">
          <button data-id="${t.id}" class="restartBtn bg-emerald-600 px-2 py-1 rounded text-xs">Restart</button>
          <button data-id="${t.id}" class="stopBtn bg-rose-600 px-2 py-1 rounded text-xs">Stop</button>
          <button data-id="${t.id}" class="notifyBtn bg-blue-600 px-2 py-1 rounded text-xs">Notify</button>
        </div>
      </div>`;
    root.appendChild(card);
  });

  $$('.restartBtn').forEach(btn => btn.onclick = async (e) => {
    if (!isOnline()) { showToast('Offline — restart disabled'); return; }
    const id = e.currentTarget.dataset.id; await handleManualRestart(id); await refreshIndex();
  });
  $$('.stopBtn').forEach(btn => btn.onclick = async (e) => {
    if (!isOnline()) { showToast('Offline — stop disabled'); return; }
    const id = e.currentTarget.dataset.id; if (!confirm('Stop this timer?')) return;
    await updateTimer(id, { active: false, stoppedAt: new Date().toISOString() });
    await logAction(currentUser.ign||'guest', `Stopped timer ${id}`); await refreshIndex();
  });
  $$('.notifyBtn').forEach(btn => btn.onclick = async (e) => {
    if (!isOnline()) { showToast('Offline — notify disabled'); return; }
    const id = e.currentTarget.dataset.id;
    const timer = timersCache.find(x => x.id === id); if (!timer) return;
    if (!webhooksCache || webhooksCache.length === 0) return alert('No webhooks configured');
    const urls = [...new Set(webhooksCache.map(w=>w.url))];
    await sendEmbedNotification([timer.name], `Manual notification for ${timer.name}`, urls);
    showToast('Notification sent');
  });
}

function renderTodayPanel() {
  const root = $('#todayList'); if (!root) return; root.innerHTML = '';
  const todayStr = new Date().toDateString();
  timersCache.filter(t => t.nextSpawn && new Date(t.nextSpawn).toDateString() === todayStr)
            .forEach(t => {
    const li = document.createElement('li'); li.className = 'p-2 bg-gray-700 rounded flex justify-between mb-1';
    li.innerHTML = `<div class="truncate">${escapeHtml(t.name)}</div><div class="text-sm text-gray-300">${formatTimeISO(t.nextSpawn)}</div>`;
    root.appendChild(li);
  });
}

/* Warnings & auto-restart */
async function handleWarningsAndAutoRestart() {
  if (!isOnline() || !timersCache) return;
  const now = Date.now();
  for (const t of timersCache) {
    try {
      if (!t.nextSpawn || !t.active) continue;
      const spawnMs = new Date(t.nextSpawn).getTime();
      const warnAt = spawnMs - (10*60*1000);
      const alreadyWarned = t.lastWarningCycle && t.lastWarningCycle === t.nextSpawn;
      if (now >= warnAt && now < spawnMs && !alreadyWarned) {
        const urls = [...new Set((webhooksCache||[]).map(w=>w.url))];
        if (urls.length>0) {
          await sendEmbedNotification([t.name], `10-minute warning — ${t.name} will spawn at ${formatTimeISO(t.nextSpawn)}`, urls);
          await updateTimer(t.id, { lastWarningCycle: t.nextSpawn });
          await logAction('system', `Sent 10-min warning for ${t.name}`);
        }
      }
      if (t.type === 'manual' && t.autoRestart) {
        const restartAt = spawnMs + (t.autoRestart * 60 * 1000);
        if (restartAt <= now && t.lastKilled === t.lastKilled) {
          const newMiss = (t.missCount||0)+1;
          const newNext = new Date(Date.now() + (t.hours||0)*3600*1000).toISOString();
          await updateTimer(t.id, { lastKilled: new Date().toISOString(), nextSpawn: newNext, missCount: newMiss, active: true });
          await logAction('system', `Auto-restarted ${t.name} (miss ${newMiss})`);
          await refreshIndex();
        }
      }
    } catch (err) { console.error('handleWarnings error', err); }
  }
}

/* Notifications */
function buildEmbedPayload(bossNames, customMessage='') {
  const content = customMessage || `Boss update: ${bossNames.join(', ')}`;
  const embed = { title: '⚔️ Boss Spawn Alert', description: content, fields: bossNames.map(n=>({name:n,value:`Next spawn at: ${new Date().toLocaleString()}`,inline:false})), timestamp: new Date().toISOString() };
  return { embeds: [embed] };
}
async function sendEmbedNotification(bossNames, message, webhookUrls) {
  if (!isOnline()) { showToast('Offline — cannot send notifications'); return; }
  const payload = buildEmbedPayload(bossNames, message);
  const unique = Array.from(new Set(webhookUrls || []));
  for (const url of unique) {
    try { await fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }
    catch (err) { console.error('sendEmbedNotification failed', err); }
  }
}

/* Manual restart */
async function handleManualRestart(timerId) {
  if (!isOnline()) { showToast('Offline — restart disabled'); return; }
  const t = timersCache.find(x => x.id === timerId);
  if (!t) return;
  if (t.type === 'manual') {
    const now = new Date().toISOString();
    const next = new Date(Date.now() + (t.hours||0)*3600*1000).toISOString();
    await updateTimer(timerId, { lastKilled: now, nextSpawn: next, missCount: 0, active: true });
    await logAction(currentUser.ign||'guest', `Manual restart ${t.name}`);
  } else {
    const nextIso = calculateNextSpawnForScheduled(t.day, t.time);
    await updateTimer(timerId, { nextSpawn: nextIso, active: true });
    await logAction(currentUser.ign||'guest', `Manual restart scheduled ${t.name}`);
  }
  await refreshIndex();
}

/* Utilities */
function msToHMS(ms) { if (ms<=0) return '00:00:00'; const total=Math.floor(ms/1000); const hrs=Math.floor(total/3600).toString().padStart(2,'0'); const mins=Math.floor((total%3600)/60).toString().padStart(2,'0'); const secs=(total%60).toString().padStart(2,'0'); return `${hrs}:${mins}:${secs}`; }
function escapeHtml(s=''){ return s?.replace?.(/&/g,'&amp;').replace?.(/</g,'&lt;').replace?.(/>/g,'&gt;') || s; }
function formatTimeISO(iso){ if(!iso) return '-'; return new Date(iso).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
function isTimerEndingToday(t){ if(!t.nextSpawn) return false; return new Date(t.nextSpawn).toDateString()===new Date().toDateString(); }

async function bootstrap(){ setOfflineUI(!isOnline()); if (isOnline()) await refreshIndex(); else refreshIndexCached(); }
bootstrap();