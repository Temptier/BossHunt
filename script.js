// ================= FIREBASE CONFIG - REPLACE WITH YOURS =================
const firebaseConfig = {
    apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.firebasestorage.app",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ================ GLOBAL STATE =================
window.userData = JSON.parse(localStorage.getItem('userData') || 'null'); // user info
window.timers = []; // cached timers
let adminWebhookFromDb = null;

// DOM refs (if present on the page)
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');
const activityLogContainer = document.getElementById('activityLogContainer');

// internal maps
const timerIntervals = {};        // update intervals
const tenMinTimeouts = {};       // 10-min warnings per timer (client-side)
const autoRestartTimeouts = {};  // client-side timeouts (firestore is canonical)

// --------- helpers ----------
function normalizeId(name) { return String(name || '').trim().toLowerCase().replace(/\s+/g,'-'); }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"'`=\/]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D'}[c])); }
function nowMs(){ return Date.now(); }
function minutesOfDayFromHourMinute(h24, m){ return h24*60 + m; }
function formatSpawnTime(totalMinutes){
  if (typeof totalMinutes === 'undefined' || totalMinutes === null) return '--:--';
  const h24 = Math.floor(totalMinutes/60);
  const minute = totalMinutes % 60;
  const ampm = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(minute).padStart(2,'0')} ${ampm}`;
}
function formatTimeFromMs(ms){
  const totalSeconds = Math.max(0, Math.floor(ms/1000));
  const hours = Math.floor(totalSeconds/3600).toString().padStart(2,'0');
  const minutes = Math.floor((totalSeconds%3600)/60).toString().padStart(2,'0');
  const seconds = (totalSeconds%60).toString().padStart(2,'0');
  return `${hours}:${minutes}:${seconds}`;
}

// --------- Admin webhook & logging ----------
async function loadAdminWebhookFromDb() {
  try {
    const doc = await db.collection('system').doc('config').get();
    if (doc.exists) adminWebhookFromDb = doc.data().adminWebhookUrl || null;
  } catch(e){}
}
window.getAdminWebhookUrl = async () => adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';

async function logAdminAction(action, details='') {
  try {
    const entry = { action, details, ign: (window.userData && window.userData.ign) || 'Unknown', guild: (window.userData && window.userData.guild) || 'Unknown', timestamp: firebase.firestore.FieldValue.serverTimestamp() };
    db.collection('logs').add(entry).catch(()=>{});
    const adminWebhook = adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';
    if (adminWebhook) {
      await fetch(adminWebhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚙️ **${action}** by ${(window.userData && window.userData.ign) || 'Unknown'} (${(window.userData && window.userData.guild) || 'Unknown'})\n${details}` }) }).catch(()=>{});
    }
  } catch(e){}
}

// --------- Firestore subscriptions ----------
function subscribeTimers() {
  db.collection('timers').orderBy('createdAt','asc').onSnapshot(snap => {
    const arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() })); window.timers = arr;
    if (typeof renderAll === 'function') renderAll();
  }, err => console.warn('timers subscription error', err));
}
function subscribeControl() {
  db.collection('system').doc('control').onSnapshot(doc => {
    const data = doc.data();
    if (data && data.stopAll) {
      executeStopAllLocal().catch(()=>{});
      db.collection('system').doc('control').update({ stopAll: false }).catch(()=>{});
    }
  }, err => console.warn('control subscription error', err));
}
function subscribeConfig() {
  db.collection('system').doc('config').onSnapshot(doc => { if (!doc.exists) return; adminWebhookFromDb = doc.data().adminWebhookUrl || adminWebhookFromDb; }, err => {});
}

// --------- timer create/update helpers ----------
async function createOrUpdateManualTimer(bossName, respawnHours, autoRestartMinutes = null) {
  const id = normalizeId(bossName);
  const lastKilled = nowMs();
  const respawnMs = Math.floor(Number(respawnHours) * 60 * 60 * 1000);
  const nextSpawn = lastKilled + respawnMs;
  const payload = {
    type:'manual',
    bossName,
    respawnHours: Number(respawnHours),
    respawnMs,
    autoRestart: autoRestartMinutes?Number(autoRestartMinutes):null,
    lastKilled,
    nextSpawn,
    missCount:0,
    warned10min: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('timers').doc(id).set(payload, { merge: true });
  await logAdminAction('Add/Update Manual Timer', `Boss:${bossName} respawnHours:${respawnHours} autoRestart:${autoRestartMinutes||'off'}`);
}
async function createOrUpdateScheduledTimer(bossName, spawnDay, spawnTimeMinutes, spawnWindowMinutes) {
  const id = normalizeId(bossName);
  const nextSpawn = computeNextSpawnForScheduledDoc(spawnDay, spawnTimeMinutes);
  const payload = {
    type:'scheduled',
    bossName,
    spawnDay:Number(spawnDay),
    spawnTime:Number(spawnTimeMinutes),
    spawnWindow:Number(spawnWindowMinutes),
    nextSpawn: nextSpawn? nextSpawn.getTime() : null,
    lastSpawned:null,
    warned10min: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('timers').doc(id).set(payload, { merge: true });
  await logAdminAction('Add/Update Scheduled Timer', `Boss:${bossName} Day:${spawnDay} TimeMin:${spawnTimeMinutes} Window:${spawnWindowMinutes}`);
}

// compute next scheduled spawn
function computeNextSpawnForScheduledDoc(spawnDay, spawnTimeMinutes, afterDate = new Date()) {
  if (typeof spawnDay === 'undefined' || typeof spawnTimeMinutes === 'undefined') return null;
  const after = new Date(afterDate);
  for (let add=0; add<14; add++) {
    const cand = new Date(after.getFullYear(), after.getMonth(), after.getDate() + add);
    if (cand.getDay() !== Number(spawnDay)) continue;
    const hour = Math.floor(spawnTimeMinutes / 60);
    const minute = spawnTimeMinutes % 60;
    cand.setHours(hour, minute, 0, 0);
    if (cand.getTime() > nowMs()) return cand;
  }
  return null;
}

// --------- auto-restart transaction (based on last end time) ----------
async function attemptAutoRestartForTimer(timerDoc) {
  if (!timerDoc || timerDoc.type !== 'manual') return;
  if (!timerDoc.autoRestart || timerDoc.autoRestart <= 0) return;
  const id = timerDoc.id;
  try {
    await db.runTransaction(async tx => {
      const ref = db.collection('timers').doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data();
      const respawnMs = Number(data.respawnMs || (Number(data.respawnHours||0) * 60*60*1000));
      const nextSpawn = Number(data.nextSpawn || (data.lastKilled ? (data.lastKilled + respawnMs) : (nowMs() + respawnMs)));
      const autoRestartMs = Number(data.autoRestart) * 60000;
      const threshold = nextSpawn + autoRestartMs;
      if (nowMs() > threshold) {
        const lastKilled = Number(data.lastKilled || 0);
        if (lastKilled < nextSpawn + 1000) {
          const newLastKilled = nextSpawn;
          const newNextSpawn = newLastKilled + respawnMs;
          tx.update(ref, { lastKilled: newLastKilled, nextSpawn: newNextSpawn, missCount: firebase.firestore.FieldValue.increment(1), warned10min: false });
          db.collection('logs').add({ action:'Auto-Restart', details:`Auto restarted ${data.bossName} (autoRestart ${data.autoRestart}m).`, ign:(window.userData&&window.userData.ign)||'system', guild:(window.userData&&window.userData.guild)||'system', timestamp: firebase.firestore.FieldValue.serverTimestamp() }).catch(()=>{});
        }
      }
    });
  } catch (err) { console.warn('attemptAutoRestartForTimer transaction failed', id, err); }
}

// --------- 10-min warning: atomic set in Firestore to avoid spam ----------
/**
 * send10MinWarningIfNeeded:
 * - At warning time client tries to atomically set warned10min = true (only if false)
 * - If transaction succeeds, it sends the webhook message (personal webhook) and logs it.
 * - If warned10min was already true, no message is sent.
 */
async function send10MinWarningIfNeeded(timerDoc) {
  if (!timerDoc) return;
  const id = timerDoc.id;
  const personalWebhook = localStorage.getItem('webhookUrl') || '';
  // Important: if user has no personal webhook, we still mark warned10min true to prevent other users from spamming,
  // but don't attempt to send from this client (other clients may send if they have webhooks).
  try {
    // Run transaction: only set warned10min true when currently false
    const result = await db.runTransaction(async tx => {
      const ref = db.collection('timers').doc(id);
      const snap = await tx.get(ref);
      if (!snap.exists) return { set: false, already: true };
      const data = snap.data();
      if (data.warned10min) return { set: false, already: true };
      tx.update(ref, { warned10min: true });
      return { set: true, already: false };
    });

    if (result.set) {
      // We are the first to set warned10min. Send personal webhook (if present) and log.
      if (personalWebhook) {
        await fetch(personalWebhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚠️ 10-minute warning: **${timerDoc.bossName}** will spawn in 10 minutes.` }) }).catch(()=>{});
      }
      // Also log to admin logs (best-effort)
      db.collection('logs').add({
        action: '10-min Warning Sent',
        details: `10-min warning for ${timerDoc.bossName}`,
        ign: (window.userData && window.userData.ign) || 'Unknown',
        guild: (window.userData && window.userData.guild) || 'Unknown',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(()=>{});
      // Also notify admin webhook (if configured) via logAdminAction
      await logAdminAction('10-min Warning Sent', `Boss: ${timerDoc.bossName}`);
      return true;
    } else {
      // someone else already set warned10min => no send
      return false;
    }
  } catch (err) {
    console.warn('send10MinWarningIfNeeded failed', err);
    return false;
  }
}

// schedule ten-minute client-side check that triggers send10MinWarningIfNeeded at right time
function scheduleTenMinuteWarning(timerDoc) {
  if (!timerDoc) return;
  const id = timerDoc.id;
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  const nextSpawn = Number(timerDoc.nextSpawn || (timerDoc.lastKilled ? (timerDoc.lastKilled + (timerDoc.respawnMs || (Number(timerDoc.respawnHours||0)*(3600000)))) : null));
  if (!nextSpawn) return;
  const warnAt = nextSpawn - 10*60000;
  const msUntil = warnAt - nowMs();
  if (msUntil <= 0) {
    // It's already <=10min left. Try immediate attempt but we should avoid spamming:
    // run atomic attempt now.
    tenMinTimeouts[id] = setTimeout(() => {
      send10MinWarningIfNeeded(timerDoc).catch(()=>{});
      delete tenMinTimeouts[id];
    }, 1000);
    return;
  }
  tenMinTimeouts[id] = setTimeout(() => {
    send10MinWarningIfNeeded(timerDoc).catch(()=>{});
    delete tenMinTimeouts[id];
  }, msUntil);
}

// --------- rendering & timer loops ----------
function renderAll() { renderManualTimers(); renderScheduledTimers(); renderTodaysSchedule(); }

function renderManualTimers() {
  if (!manualTimersContainer) return;
  manualTimersContainer.innerHTML = '';
  const manualTimers = window.timers.filter(t => t.type === 'manual');

  if (manualTimers.length === 0) {
    manualTimersContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i data-feather="clock" class="w-12 h-12 mx-auto mb-4"></i>
        <p>No manual timers yet. Admin can add one in Admin page.</p>
      </div>`;
    feather.replace();
    return;
  }

  manualTimers.forEach(t => {
    const id = t.id;
    const lastKilled = Number(t.lastKilled || nowMs());
    const respawnMs = Number(t.respawnMs || (Number(t.respawnHours||0)*60*60*1000));
    const nextSpawn = Number(t.nextSpawn || (lastKilled + respawnMs));
    const missCount = Number(t.missCount || 0);
    const progressPct = respawnMs ? Math.min(100, ((nowMs() - lastKilled) / respawnMs) * 100) : 0;

    const wrapper = document.createElement('div');
    wrapper.className = 'timer-card manual-timer bg-gray-700 p-4 rounded-lg';
    wrapper.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3>
          <p class="text-sm text-gray-400">Respawn: ${Number(t.respawnHours || 0)} hour(s)</p>
          ${t.autoRestart ? `<p class="text-sm text-gray-400">Auto-Restart: ${t.autoRestart} min</p>` : ''}
          <p class="text-sm ${missCount>0?'text-yellow-400':'text-gray-400'}">Misses: <span id="miss-${id}">${missCount}</span></p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">${new Date(nextSpawn).toLocaleString()}</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3"><div class="progress-fill bg-blue-500" id="progress-${id}" style="width:${progressPct}%"></div></div>
      <div class="flex justify-end space-x-2 mt-3">
        <button class="mark-kill bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="check" class="w-4 h-4"></i> Mark Kill</button>
        <button class="reset-timer bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="rotate-ccw" class="w-4 h-4"></i> Reset</button>
      </div>
    `;
    manualTimersContainer.appendChild(wrapper);

    wrapper.querySelector('.mark-kill')?.addEventListener('click', async () => {
      const now = nowMs();
      try {
        await db.collection('timers').doc(id).update({ lastKilled: now, nextSpawn: now + respawnMs, missCount: 0, warned10min: false });
        logAdminAction('Manual Mark Kill', `Boss: ${t.bossName}`);
      } catch(e){ console.warn('mark-kill failed', e); }
    });

    wrapper.querySelector('.reset-timer')?.addEventListener('click', async () => {
      const now = nowMs();
      try {
        const snap = await db.collection('timers').doc(id).get();
        const data = snap.exists ? snap.data() : {};
        let newMiss = Number(data.missCount || 0);
        const respawnMsLocal = Number(data.respawnMs || respawnMs);
        const elapsedLocal = now - (data.lastKilled || now);
        if (elapsedLocal > respawnMsLocal + ((data.autoRestart||0)*60000)) newMiss++;
        await db.collection('timers').doc(id).update({ lastKilled: now, nextSpawn: now + respawnMsLocal, missCount: newMiss, warned10min: false });
        logAdminAction('Manual Reset', `Boss: ${t.bossName} misses:${newMiss}`);
      } catch(e){ console.warn('reset-timer failed', e); }
    });

    // start client per-timer loop
    startPerTimerLoop(t);
  });

  feather.replace();
}

function startPerTimerLoop(timerDoc) {
  const id = timerDoc.id;
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
  if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  scheduleTenMinuteWarning(timerDoc);

  const updateFn = async () => {
    try {
      const snap = await db.collection('timers').doc(id).get();
      if (!snap.exists) { clearPerTimerLoop(id); return; }
      const data = snap.data();
      if (data.type === 'manual') {
        const respawnMs = Number(data.respawnMs || (Number(data.respawnHours||0) * 60*60*1000));
        const nextSpawn = Number(data.nextSpawn || (data.lastKilled ? data.lastKilled + respawnMs : nowMs() + respawnMs));
        const timeLeft = Math.max(0, nextSpawn - nowMs());
        const timerEl = document.getElementById(`timer-${id}`);
        if (timerEl) timerEl.textContent = formatTimeFromMs(timeLeft);
        const progressEl = document.getElementById(`progress-${id}`);
        if (progressEl && respawnMs) {
          const elapsed = Math.max(0, nowMs() - (data.lastKilled || (nextSpawn - respawnMs)));
          const pct = Math.min(100, (elapsed / respawnMs) * 100);
          progressEl.style.width = `${pct}%`;
        }
        if (data.autoRestart && data.autoRestart > 0) {
          const threshold = nextSpawn + (Number(data.autoRestart) * 60000);
          if (nowMs() > threshold) await attemptAutoRestartForTimer({ id, ...data });
        }
        // ensure a scheduled 10-min warning exists for new nextSpawn
        scheduleTenMinuteWarning(data);
      }
    } catch(e){}
  };

  updateFn();
  timerIntervals[id] = setInterval(updateFn, 1000);
}

function clearPerTimerLoop(id) {
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
  if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }
}

function renderScheduledTimers() {
  if (!scheduledTimersContainer) return;
  scheduledTimersContainer.innerHTML = '';
  const scheduled = window.timers.filter(t => t.type === 'scheduled');
  if (scheduled.length === 0) {
    scheduledTimersContainer.innerHTML = `<div class="text-center py-8 text-gray-500"><i data-feather="calendar" class="w-12 h-12 mx-auto mb-4"></i><p>No scheduled timers yet.</p></div>`;
    feather.replace(); return;
  }
  scheduled.forEach(t => {
    const id = t.id;
    const nextSpawnTs = t.nextSpawn || (computeNextSpawnForScheduledDoc(t.spawnDay, t.spawnTime) ? computeNextSpawnForScheduledDoc(t.spawnDay, t.spawnTime).getTime() : null);
    const remainingMs = nextSpawnTs ? Math.max(0, nextSpawnTs - nowMs()) : 0;
    const progressPct = (t.spawnWindow && t.spawnWindow>0) ? Math.min(100, ((t.spawnWindow*60000 - Math.max(0, remainingMs)) / (t.spawnWindow*60000)) * 100) : 0;

    const el = document.createElement('div');
    el.className = 'timer-card scheduled-timer bg-gray-700 p-4 rounded-lg';
    el.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3>
          <p class="text-sm text-gray-400">Spawn: ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.spawnDay]} @ ${formatSpawnTime(t.spawnTime)}</p>
          <p class="text-sm text-gray-400">Window: ${t.spawnWindow} minutes</p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">${ nextSpawnTs ? new Date(nextSpawnTs).toLocaleString() : '--:--' }</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3"><div class="progress-fill bg-purple-500" id="progress-${id}" style="width:${progressPct}%"></div></div>
    `;
    scheduledTimersContainer.appendChild(el);
    startScheduledTimerLoop(t);
  });
  feather.replace();
}

function startScheduledTimerLoop(timerDoc) {
  const id = timerDoc.id;
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  let ns = timerDoc.nextSpawn ? new Date(timerDoc.nextSpawn) : computeNextSpawnForScheduledDoc(timerDoc.spawnDay, timerDoc.spawnTime);
  if (ns) scheduleTenMinuteWarning(timerDoc);

  const updateFn = async () => {
    try {
      const snap = await db.collection('timers').doc(id).get();
      if (!snap.exists) { clearPerTimerLoop(id); return; }
      const data = snap.data();
      ns = data.nextSpawn ? new Date(data.nextSpawn) : computeNextSpawnForScheduledDoc(data.spawnDay, data.spawnTime);
      if (!ns) return;
      const msLeft = Math.max(0, ns.getTime() - nowMs());
      const timerEl = document.getElementById(`timer-${id}`);
      if (timerEl) timerEl.textContent = formatTimeFromMs(msLeft);
      const progressEl = document.getElementById(`progress-${id}`);
      if (progressEl) {
        const windowMs = (data.spawnWindow || 30) * 60000;
        const pct = windowMs ? Math.min(100, ((windowMs - Math.max(0, msLeft)) / windowMs) * 100) : 0;
        progressEl.style.width = `${pct}%`;
      }

      if (msLeft <= 0) {
        // Mark spawn: update lastSpawned and compute nextSpawn; also reset warned10min
        const nextNext = computeNextSpawnForScheduledDoc(data.spawnDay, data.spawnTime, new Date(nowMs() + 1000));
        await db.collection('timers').doc(id).update({ lastSpawned: nowMs(), nextSpawn: nextNext? nextNext.getTime() : null, warned10min: false });
        logAdminAction('Scheduled Timer Spawn', `Boss: ${data.bossName}`);
        if (nextNext) scheduleTenMinuteWarning({ ...data, nextSpawn: nextNext.getTime() });
      }
    } catch(e){}
  };

  updateFn();
  timerIntervals[id] = setInterval(updateFn, 1000);
}

function renderTodaysSchedule() {
  if (!todaysScheduleContainer) return;
  todaysScheduleContainer.innerHTML = '';
  const today = new Date().getDay();
  const todayTimers = window.timers.filter(t => t.type === 'scheduled' && Number(t.spawnDay) === today);
  if (todayTimers.length === 0) {
    todaysScheduleContainer.innerHTML = `<div class="text-center py-8 text-gray-500 col-span-3"><i data-feather="meh" class="w-12 h-12 mx-auto mb-4"></i><p>No bosses scheduled for today.</p></div>`;
    feather.replace(); return;
  }
  todayTimers.forEach(t => {
    const div = document.createElement('div');
    div.className = 'today-schedule bg-gray-700 p-4 rounded-lg';
    div.innerHTML = `<h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3><p class="text-sm text-gray-400">Time: ${formatSpawnTime(t.spawnTime)} (window ${t.spawnWindow}m)</p>`;
    todaysScheduleContainer.appendChild(div);
  });
  feather.replace();
}

// control-room send
async function sendControlRoomMessage(bossNames = [], extra = '') {
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) { alert('No webhook configured'); return; }
  const user = window.userData || { ign:'Unknown', guild:'Unknown' };
  const payload = { embeds: [{ title:'Boss Notification', description: bossNames.map(b=>`**${b}**`).join('\n'), footer:{ text:`${user.ign} • ${user.guild}` }, timestamp: new Date() }] };
  if (extra) payload.embeds[0].fields = [{ name: 'Message', value: extra }];
  try {
    await fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
    await logAdminAction('Control Room Send', `Sent: ${bossNames.join(', ')}`);
    alert('Message sent to Discord webhook.');
  } catch(e){ console.warn('sendControlRoomMessage failed', e); alert('Failed to send'); }
}
window.sendControlRoomMessage = sendControlRoomMessage;

// admin UI helpers
window.adminSaveTimerFromModal = async function() {
  try {
    const manualFormEl = document.getElementById('manualForm');
    const scheduledFormEl = document.getElementById('scheduledForm');
    if (manualFormEl && !manualFormEl.classList.contains('hidden')) {
      const bossName = document.getElementById('manualBossName').value.trim();
      const respawnHoursRaw = document.getElementById('manualRespawn').value.trim();
      const autoRestartRaw = document.getElementById('manualAutoRestart').value.trim();
      const respawnHours = Number(respawnHoursRaw);
      const autoRestart = autoRestartRaw ? Number(autoRestartRaw) : null;
      if (!bossName || isNaN(respawnHours) || respawnHours <= 0) { alert('Please provide boss name and respawn hours'); return; }
      await createOrUpdateManualTimer(bossName, respawnHours, autoRestart);
      return;
    }
    if (scheduledFormEl && !scheduledFormEl.classList.contains('hidden')) {
      const bossName = document.getElementById('schedBossName').value.trim();
      const spawnDay = Number(document.getElementById('schedDay').value);
      let hour = Number(document.getElementById('schedHour').value);
      const minute = Number(document.getElementById('schedMinute').value);
      const ampm = document.getElementById('schedAMPM').value;
      const spawnWindow = Number(document.getElementById('schedWindow').value);
      if (!bossName || isNaN(hour) || isNaN(minute) || isNaN(spawnWindow)) { alert('Please fill scheduled fields correctly'); return; }
      if (ampm === 'PM' && hour < 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      const spawnTimeMinutes = minutesOfDayFromHourMinute(hour, minute);
      await createOrUpdateScheduledTimer(bossName, spawnDay, spawnTimeMinutes, spawnWindow);
      return;
    }
    alert('No modal detected or unknown modal state.');
  } catch(e){ console.error('adminSaveTimer error', e); alert('Failed to save'); }
};

window.saveAdminWebhookToDb = async function(url) {
  try {
    const pw = prompt('Enter admin password to save admin webhook:');
    if (pw !== 'theworldo') { alert('Wrong password'); return; }
    await db.collection('system').doc('config').set({ adminWebhookUrl: url }, { merge: true });
    localStorage.setItem('adminWebhookUrl', url);
    adminWebhookFromDb = url;
    await logAdminAction('Admin webhook saved', `URL saved`);
    alert('Admin webhook saved.');
  } catch(e){ console.warn('saveAdminWebhook failed', e); alert('Failed to save'); }
};

window.triggerStopAllAdmin = async function() {
  try {
    const pw = prompt('Enter admin password to trigger Stop All:');
    if (pw !== 'theworldo') { alert('Wrong password'); return; }
    await db.collection('system').doc('control').set({ stopAll: true, lastStopped: nowMs() });
    await logAdminAction('Stop All triggered', 'Admin triggered Stop All');
    alert('Stop All triggered.');
  } catch(e){ console.warn('triggerStopAllAdmin failed', e); alert('Failed'); }
};

async function executeStopAllLocal() {
  try {
    const snap = await db.collection('timers').where('type','==','manual').get();
    const batch = db.batch();
    snap.forEach(doc => {
      const respawnMs = Number(doc.data().respawnMs || (Number(doc.data().respawnHours||0)*60*60*1000));
      batch.update(doc.ref, { lastKilled: nowMs(), nextSpawn: nowMs() + respawnMs, missCount: 0, warned10min: false });
    });
    await batch.commit();
    logAdminAction('Stop All Executed', 'All manual timers reset to now');
  } catch(e){ console.warn('executeStopAllLocal failed', e); }
}

// init
(async function init() {
  await loadAdminWebhookFromDb();
  subscribeTimers();
  subscribeControl();
  subscribeConfig();

  if (activityLogContainer) {
    db.collection('logs').orderBy('timestamp','desc').limit(100).onSnapshot(snapshot => {
      activityLogContainer.innerHTML = '';
      snapshot.forEach(doc => {
        const d = doc.data();
        const time = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toLocaleString() : '';
        const row = document.createElement('div');
        row.className = 'py-1 border-b border-gray-700';
        row.innerHTML = `<div class="text-xs text-gray-400">${time}</div><div>${escapeHtml(d.action)} — <span class="text-gray-300">${escapeHtml(d.details)}</span></div>`;
        activityLogContainer.appendChild(row);
      });
    }, err => {});
  }

  if (localStorage.getItem('webhookUrl')) document.querySelector('#controlRoomBtn')?.classList.remove('hidden');

  const adminWebhook = adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';
  if (adminWebhook) {
    const u = window.userData || { ign: 'Guest', guild: 'Unknown' };
    fetch(adminWebhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `👤 Visitor: ${u.ign} (${u.guild}) visited at ${new Date().toLocaleString()}` }) }).catch(()=>{});
  }
})();

// Expose some helpers for debugging
window.send10MinWarningIfNeeded = send10MinWarningIfNeeded;
window.attemptAutoRestartForTimer = attemptAutoRestartForTimer;