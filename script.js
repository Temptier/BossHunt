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

// ===== Global state (exposed) =====
window.userData = JSON.parse(localStorage.getItem('userData') || 'null');
window.timers = [];
let adminWebhookFromDb = null;

// DOM refs (may be null depending on page)
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');
const activityLogContainer = document.getElementById('activityLogContainer');

const timerIntervals = {};
const tenMinTimeouts = {};
const autoRestartTimeouts = {};

// ---------- Helpers ----------
function normalizeId(name) { return String(name || '').trim().toLowerCase().replace(/\s+/g,'-'); }
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c])); }
function formatSpawnTime(totalMinutes){
  if (typeof totalMinutes === 'undefined' || totalMinutes === null) return '--:--';
  const hour24 = Math.floor(totalMinutes/60);
  const minute = totalMinutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2,'0')} ${ampm}`;
}

// ---------- Admin webhook / logging ----------
async function loadAdminWebhookFromDb() {
  try {
    const doc = await db.collection('system').doc('config').get();
    if (doc.exists) adminWebhookFromDb = doc.data().adminWebhookUrl || null;
  } catch(e){}
}
window.getAdminWebhookUrl = async () => adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';

async function logAdminAction(action, details='') {
  try {
    const entry = {
      action, details,
      user: (window.userData && window.userData.ign) || 'Unknown',
      guild: (window.userData && window.userData.guild) || 'Unknown',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('logs').add(entry).catch(()=>{});
    const adminWebhook = adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';
    if (adminWebhook) {
      fetch(adminWebhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚙️ **${action}** by ${(window.userData && window.userData.ign) || 'Unknown'} (${(window.userData && window.userData.guild) || 'Unknown'})\n${details}` }) }).catch(()=>{});
    }
  } catch(e){}
}

// ---------- Firestore subscriptions ----------
function subscribeTimers() {
  db.collection('timers').orderBy('createdAt','asc').onSnapshot(snap => {
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    window.timers = arr;
    if (typeof renderAll === 'function') renderAll();
  });
}

function subscribeControl() {
  db.collection('system').doc('control').onSnapshot(doc => {
    const data = doc.data();
    if (data && data.stopAll) {
      executeStopAllLocal().catch(()=>{});
      db.collection('system').doc('control').update({ stopAll: false }).catch(()=>{});
    }
  });
}

function subscribeLogs() {
  if (!activityLogContainer) return;
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
  });
}

// ---------- Admin actions used by UI ----------
window.adminSaveTimerFromModal = async function() {
  try {
    const manualVisible = !document.getElementById('manualForm').classList.contains('hidden');
    if (manualVisible) {
      const bossName = document.getElementById('manualBossName').value.trim();
      const respawn = parseInt(document.getElementById('manualRespawn').value, 10);
      const autoRestartRaw = document.getElementById('manualAutoRestart').value.trim();
      const autoRestart = autoRestartRaw ? parseInt(autoRestartRaw, 10) : null;
      if (!bossName || isNaN(respawn) || respawn <= 0) return alert('Please fill boss name and valid respawn minutes');
      const docId = normalizeId(bossName);
      await db.collection('timers').doc(docId).set({
        type:'manual',
        bossName,
        respawnTime: respawn,
        autoRestart: autoRestart || null,
        lastKilled: Date.now(),
        missCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      await logAdminAction('Add/Update Manual Timer', `Boss: ${bossName}, Respawn: ${respawn}, AutoRestart: ${autoRestart || 'off'}`);
      alert('Manual timer added/updated.');
      return;
    }

    // scheduled
    const bossName = document.getElementById('schedBossName').value.trim();
    const spawnDay = parseInt(document.getElementById('schedDay').value, 10);
    let hour = parseInt(document.getElementById('schedHour').value, 10);
    const minute = parseInt(document.getElementById('schedMinute').value, 10);
    const ampm = document.getElementById('schedAMPM').value;
    const spawnWindow = parseInt(document.getElementById('schedWindow').value, 10);
    if (!bossName || isNaN(hour) || isNaN(minute) || isNaN(spawnWindow)) return alert('Please fill scheduled fields correctly');
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const spawnTime = hour * 60 + minute;
    const docId = normalizeId(bossName);
    await db.collection('timers').doc(docId).set({
      type:'scheduled',
      bossName,
      spawnDay,
      spawnTime,
      spawnWindow,
      lastSpawned: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    await logAdminAction('Add/Update Scheduled Timer', `Boss: ${bossName}, Day:${spawnDay}, Time:${hour}:${minute}, Window:${spawnWindow}m`);
    alert('Scheduled timer added/updated.');
  } catch (err) {
    console.error(err);
    alert('Error saving timer: ' + (err.message || err));
  }
};

window.saveAdminWebhookToDb = async function(url) {
  try {
    const pw = prompt('Enter admin password to save admin webhook:');
    if (pw !== 'theworldo') { alert('Wrong password'); return; }
    await db.collection('system').doc('config').set({ adminWebhookUrl: url }, { merge: true });
    localStorage.setItem('adminWebhookUrl', url);
    adminWebhookFromDb = url;
    await logAdminAction('Admin webhook saved', `URL: ${url}`);
    alert('Admin webhook saved.');
  } catch (e) { console.error(e); alert('Failed to save admin webhook'); }
};

window.triggerStopAllAdmin = async function() {
  try {
    const pw = prompt('Confirm admin password to Trigger Stop All:');
    if (pw !== 'theworldo') { alert('Wrong password'); return; }
    await db.collection('system').doc('control').set({ stopAll: true, lastStopped: Date.now() });
    await logAdminAction('Stop All triggered', 'Admin executed Stop All');
    alert('Stop All triggered (clients will respond).');
  } catch (e) { console.error(e); alert('Failed to trigger Stop All'); }
};

// client execution when stopAll flagged
async function executeStopAllLocal() {
  try {
    const snap = await db.collection('timers').where('type','==','manual').get();
    const batch = db.batch();
    snap.forEach(doc => batch.update(doc.ref, { lastKilled: Date.now(), missCount: 0 }));
    await batch.commit();
    console.log('All manual timers reset locally.');
  } catch(e){ console.warn('executeStopAllLocal failed', e); }
}

// ---------- timer rendering & logic ----------
function renderAll() {
  renderManualTimers();
  renderScheduledTimers();
  renderTodaysSchedule();
}

function renderManualTimers() {
  if (!manualTimersContainer) return;
  manualTimersContainer.innerHTML = '';
  const manual = window.timers.filter(t => t.type === 'manual');
  if (!manual.length) {
    manualTimersContainer.innerHTML = `<div class="text-center py-8 text-gray-500"><i data-feather="clock" class="w-12 h-12 mx-auto mb-4"></i><p>No manual timers yet.</p></div>`;
    feather.replace();
    return;
  }
  manual.forEach(t => {
    const id = t.id;
    const lastKilled = t.lastKilled || Date.now();
    const respawnMs = (t.respawnTime || 0) * 60000;
    const elapsed = Date.now() - lastKilled;
    const remaining = Math.max(0, respawnMs - elapsed);
    const progressPct = respawnMs ? Math.min(100, (elapsed/respawnMs)*100) : 0;

    const el = document.createElement('div');
    el.className = 'timer-card manual-timer bg-gray-700 p-4 rounded-lg';
    el.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3>
          <p class="text-sm text-gray-400">Respawn: ${t.respawnTime} minutes</p>
          ${t.autoRestart ? `<p class="text-sm text-gray-400">Auto-Restart: ${t.autoRestart} minutes</p>` : ''}
          <p class="text-sm ${t.missCount > 0 ? 'text-yellow-400' : 'text-gray-400'}">Misses: <span id="miss-${id}">${t.missCount||0}</span></p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">${ new Date((t.lastKilled||Date.now()) + (t.respawnTime||0)*60000).toLocaleTimeString() }</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3"><div class="progress-fill bg-blue-500" id="progress-${id}" style="width:${progressPct}%"></div></div>
      <div class="flex justify-end space-x-2 mt-3">
        <button class="mark-kill bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="check" class="w-4 h-4"></i> Restart</button>
        <button class="reset-manual bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="rotate-ccw" class="w-4 h-4"></i> Reset</button>
      </div>
    `;
    manualTimersContainer.appendChild(el);

    el.querySelector('.mark-kill').addEventListener('click', async () => {
      await db.collection('timers').doc(id).update({ lastKilled: Date.now(), missCount: 0 });
      if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
      logAdminAction('Manual Timer Restart', `Boss: ${t.bossName}`);
    });

    el.querySelector('.reset-manual').addEventListener('click', async () => {
      const doc = await db.collection('timers').doc(id).get();
      const data = doc.data() || {};
      const respawnMsLocal = (data.respawnTime || 0) * 60000;
      const elapsedLocal = Date.now() - (data.lastKilled || Date.now());
      let newMiss = data.missCount || 0;
      if (elapsedLocal > respawnMsLocal + ((data.autoRestart||0)*60000 || 0)) newMiss++;
      await db.collection('timers').doc(id).update({ lastKilled: Date.now(), missCount: newMiss });
      logAdminAction('Manual Timer Reset', `Boss: ${data.bossName} (misses now: ${newMiss})`);
    });

    startManualTimerInterval(t);
  });
  feather.replace();
}

function startManualTimerInterval(timer) {
  const id = timer.id;
  clearManualInterval(id);
  if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
  const respawnMs = (timer.respawnTime || 0) * 60000;
  const initialLastKilled = timer.lastKilled || Date.now();

  const updateFn = async () => {
    const docSnap = await db.collection('timers').doc(id).get();
    const data = docSnap.exists ? docSnap.data() : timer;
    const lastKilled = data.lastKilled || initialLastKilled;
    const timeLeft = Math.max(0, lastKilled + respawnMs - Date.now());
    updateTimerDisplay(id, timeLeft);
    const fill = respawnMs ? Math.min(100, ((respawnMs - timeLeft) / respawnMs) * 100) : 0;
    setProgress(id, fill);

    if (timeLeft <= 0) {
      if (data.autoRestart && data.autoRestart > 0) {
        if (!autoRestartTimeouts[id]) {
          autoRestartTimeouts[id] = setTimeout(async () => {
            const latest = await db.collection('timers').doc(id).get();
            const latestData = latest.exists ? latest.data() : data;
            const latestLastKilled = latestData.lastKilled || initialLastKilled;
            if (Date.now() - latestLastKilled >= respawnMs) {
              const newMiss = (latestData.missCount || 0) + 1;
              await db.collection('timers').doc(id).update({ lastKilled: Date.now(), missCount: newMiss });
              logAdminAction('Auto-Restart Applied', `Boss: ${latestData.bossName} (misses: ${newMiss})`);
            }
            delete autoRestartTimeouts[id];
          }, data.autoRestart * 60000);
        }
      }
    } else {
      if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
    }
  };

  updateFn();
  timerIntervals[id] = setInterval(updateFn, 1000);
}

function clearManualInterval(id) { if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; } }

function updateTimerDisplay(id, ms) {
  const el = document.getElementById(`timer-${id}`);
  if (!el) return;
  const totalSeconds = Math.max(0, Math.floor(ms/1000));
  const hours = Math.floor(totalSeconds/3600).toString().padStart(2,'0');
  const minutes = Math.floor((totalSeconds%3600)/60).toString().padStart(2,'0');
  const seconds = (totalSeconds%60).toString().padStart(2,'0');
  el.textContent = `${hours}:${minutes}:${seconds}`;
}
function setProgress(id, pct) { const el = document.getElementById(`progress-${id}`); if (el) el.style.width = `${pct}%`; }

// ---------- Scheduled timers ----------
function renderScheduledTimers() {
  if (!scheduledTimersContainer) return;
  scheduledTimersContainer.innerHTML = '';
  const scheduled = window.timers.filter(t => t.type === 'scheduled');
  if (!scheduled.length) {
    scheduledTimersContainer.innerHTML = `<div class="text-center py-8 text-gray-500"><i data-feather="calendar" class="w-12 h-12 mx-auto mb-4"></i><p>No scheduled timers yet.</p></div>`;
    feather.replace();
    return;
  }
  scheduled.forEach(t => {
    const id = t.id;
    const nextSpawn = computeNextSpawnExact(t);
    const remainingMs = nextSpawn ? Math.max(0, nextSpawn.getTime() - Date.now()) : 0;

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
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">${ nextSpawn? nextSpawn.toLocaleString() : '--:--' }</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3"><div class="progress-fill bg-purple-500" id="progress-${id}" style="width:0%"></div></div>
    `;
    scheduledTimersContainer.appendChild(el);
    startScheduledInterval(t, nextSpawn);
  });
  feather.replace();
}

function startScheduledInterval(timer, nextSpawn) {
  const id = timer.id;
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  let ns = nextSpawn || computeNextSpawnExact(timer);
  if (!ns) return;

  const update = () => {
    const msLeft = Math.max(0, ns.getTime() - Date.now());
    updateTimerDisplay(id, msLeft);
    const windowMs = (timer.spawnWindow || 30) * 60000;
    const progress = windowMs ? Math.min(100, ((windowMs - Math.max(0, msLeft)) / windowMs) * 100) : 0;
    setProgress(id, progress);

    if (msLeft <= 0) {
      logAdminAction('Scheduled Timer Spawn', `Boss: ${timer.bossName}`);
      db.collection('timers').doc(id).update({ lastSpawned: Date.now() }).catch(()=>{});
      ns = computeNextSpawnExact(timer, new Date(Date.now() + 1000));
      scheduleTenMinWarningExact(timer, ns);
      const nextEl = document.getElementById(`next-${id}`);
      if (nextEl) nextEl.textContent = ns ? ns.toLocaleString() : '--:--';
    }
  };

  update();
  timerIntervals[id] = setInterval(update, 1000);
  scheduleTenMinWarningExact(timer, ns);
}

function scheduleTenMinWarningExact(timer, nextSpawnDate) {
  if (!nextSpawnDate) return;
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) return;
  const id = timer.id;
  if (tenMinTimeouts[id]) clearTimeout(tenMinTimeouts[id]);
  const warnAt = nextSpawnDate.getTime() - 10*60000;
  const msUntil = warnAt - Date.now();
  if (msUntil <= 0) return;
  tenMinTimeouts[id] = setTimeout(() => {
    fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚠️ 10-min warning: ${timer.bossName} will spawn in 10 minutes.` }) }).catch(()=>{});
    logAdminAction('Auto 10-min Warning Sent', `Boss: ${timer.bossName}`);
  }, msUntil);
}

function computeNextSpawnExact(timer, afterDate = new Date()) {
  if (!timer || typeof timer.spawnDay === 'undefined' || typeof timer.spawnTime === 'undefined') return null;
  const targetDay = timer.spawnDay;
  const spawnMinutes = timer.spawnTime;
  const after = new Date(afterDate);
  for (let add = 0; add < 14; add++) {
    const cand = new Date(after.getFullYear(), after.getMonth(), after.getDate() + add);
    if (cand.getDay() !== targetDay) continue;
    const hour = Math.floor(spawnMinutes / 60);
    const minute = spawnMinutes % 60;
    cand.setHours(hour, minute, 0, 0);
    if (cand.getTime() > Date.now()) return cand;
  }
  return null;
}

function renderTodaysSchedule() {
  if (!todaysScheduleContainer) return;
  todaysScheduleContainer.innerHTML = '';
  const today = new Date().getDay();
  const todayTimers = window.timers.filter(t => t.type === 'scheduled' && t.spawnDay === today);
  if (!todayTimers.length) {
    todaysScheduleContainer.innerHTML = `<div class="text-center py-8 text-gray-500 col-span-3"><i data-feather="meh" class="w-12 h-12 mx-auto mb-4"></i><p>No bosses scheduled for today.</p></div>`;
    feather.replace();
    return;
  }
  todayTimers.forEach(t => {
    const div = document.createElement('div');
    div.className = 'today-schedule bg-gray-700 p-4 rounded-lg';
    div.innerHTML = `<h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3><p class="text-sm text-gray-400">Time: ${formatSpawnTime(t.spawnTime)} (window ${t.spawnWindow}m)</p>`;
    todaysScheduleContainer.appendChild(div);
  });
  feather.replace();
}

// ---------- Control Room sending ----------
async function sendControlRoomMessage(bossNames = [], extra = '') {
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) { alert('No webhook set'); return; }
  const u = window.userData || { ign: 'Unknown', guild: 'Unknown' };
  const payload = {
    embeds: [{
      title: 'Boss Notification',
      description: bossNames.map(b => `**${b}**`).join('\n'),
      footer: { text: `${u.ign} • ${u.guild}` },
      timestamp: new Date()
    }]
  };
  if (extra) payload.embeds[0].fields = [{ name:'Message', value: extra }];
  await fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).catch(()=>{});
  logAdminAction('Control Room Send', `Sent: ${bossNames.join(', ')}`);
  alert('Message sent to Discord.');
}
window.sendControlRoomMessage = sendControlRoomMessage;

// ---------- init ----------
(async function init() {
  await loadAdminWebhookFromDb();
  subscribeTimers();
  subscribeControl();
  subscribeLogs();
  db.collection('system').doc('config').onSnapshot(doc => { if (!doc.exists) return; adminWebhookFromDb = doc.data().adminWebhookUrl || adminWebhookFromDb; });

  // show control btn if user has webhook saved
  if (localStorage.getItem('webhookUrl')) {
    document.querySelector('#controlRoomBtn')?.classList.remove('hidden');
  }

  // admin visit log
  const u = window.userData || { ign:'Guest', guild:'Unknown' };
  const adminWebhook = adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';
  if (adminWebhook) {
    fetch(adminWebhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `👤 Visitor: ${u.ign} (${u.guild}) visited at ${new Date().toLocaleString()}` }) }).catch(()=>{});
  }
})();