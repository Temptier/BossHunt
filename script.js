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

// ======= DOM nodes =======
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');
const controlRoomBtn = document.getElementById('controlRoomBtn');
const discordWebhookBtn = document.getElementById('discordWebhookBtn');

// ======= Local state =======
let timers = []; // array of {id, ...}
let userData = JSON.parse(localStorage.getItem('userData') || 'null');
let personalWebhook = localStorage.getItem('webhookUrl') || '';
let adminWebhookLocal = localStorage.getItem('adminWebhookUrl') || '';
let adminWebhookFromDb = null;

// intervals / timeouts
const timerIntervals = {};
const tenMinTimeouts = {};
const autoRestartTimeouts = {};

// helper to get admin webhook
function getAdminWebhook() {
  return adminWebhookFromDb || adminWebhookLocal || '';
}

// helper for admin logging
function logAdminAction(action, details = '') {
  const u = userData || { ign: 'Guest', guild: 'Unknown' };
  const payload = `⚙️ **${action}** by ${u.ign} (${u.guild})\n${details}`;
  const admin = getAdminWebhook();
  if (admin) {
    fetch(admin, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ content: payload }) }).catch(()=>{});
  }
  // write to Firestore activityLog
  db.collection('activityLog').add({ action, details, ign: u.ign, guild: u.guild, timestamp: Date.now() }).catch(()=>{});
}

// ======= Initialization =======
document.addEventListener('DOMContentLoaded', () => {
  // load admin webhook from DB (system/config)
  db.collection('system').doc('config').get().then(doc => {
    if (doc.exists) adminWebhookFromDb = doc.data().adminWebhookUrl || null;
  }).catch(()=>{});

  // listen to timers collection (all timers)
  db.collection('timers').orderBy('createdAt','asc').onSnapshot(snap => {
    const arr = [];
    snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
    timers = arr;
    renderAll();
  });

  // listen for STOP ALL flag
  db.collection('system').doc('control').onSnapshot(doc => {
    const data = doc.data();
    if (data && data.stopAll) {
      executeStopAllLocal();
      // reset flag
      db.collection('system').doc('control').update({ stopAll: false }).catch(()=>{});
    }
  });

  // listen for admin config changes
  db.collection('system').doc('config').onSnapshot(doc => {
    if (!doc.exists) return;
    adminWebhookFromDb = doc.data().adminWebhookUrl || adminWebhookFromDb;
  });

  personalWebhook = localStorage.getItem('webhookUrl') || '';
  if (personalWebhook && controlRoomBtn) controlRoomBtn.classList.remove('hidden');

  // log visit
  const u = userData || { ign: 'Guest', guild: 'Unknown' };
  if (getAdminWebhook()) {
    fetch(getAdminWebhook(), { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `👤 Visitor: ${u.ign} (${u.guild}) visited at ${new Date().toLocaleString()}` }) }).catch(()=>{});
  }
});

// ======= Renderers =======
function renderAll() {
  renderManualTimers();
  renderScheduledTimers();
  renderTodaysSchedule();
}

function renderManualTimers() {
  if (!manualTimersContainer) return;
  manualTimersContainer.innerHTML = '';
  const manual = timers.filter(t => t.type === 'manual');
  if (manual.length === 0) {
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
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">--:--</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3"><div class="progress-fill bg-blue-500" id="progress-${id}" style="width:${progressPct}%"></div></div>
      <div class="flex justify-end space-x-2 mt-3">
        <button class="mark-kill bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="check" class="w-4 h-4"></i> Restart</button>
        <button class="reset-manual bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="rotate-ccw" class="w-4 h-4"></i> Reset</button>
      </div>
    `;

    manualTimersContainer.appendChild(el);

    // set next spawn time text
    const nextEl = document.getElementById(`next-${id}`);
    if (nextEl) nextEl.textContent = new Date((t.lastKilled || Date.now()) + (t.respawnTime||0)*60000).toLocaleTimeString();

    // attach actions
    el.querySelector('.mark-kill').addEventListener('click', async () => {
      // Admin password not required to indicate kill (users mark kills)
      await db.collection('timers').doc(id).update({ lastKilled: Date.now(), missCount: 0 });
      // clear any autoRestart timeout for this timer
      if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
      logAdminAction('Manual Timer Restart', `Boss: ${t.bossName}`);
    });

    el.querySelector('.reset-manual').addEventListener('click', async () => {
      // Reset behavior: mark lastKilled = now, but increase miss if it was overdue
      const doc = await db.collection('timers').doc(id).get();
      const data = doc.data();
      const respawnMsLocal = (data.respawnTime || 0) * 60000;
      const elapsedLocal = Date.now() - (data.lastKilled || Date.now());
      let newMiss = data.missCount || 0;
      if (elapsedLocal > respawnMsLocal + ((data.autoRestart||0)*60000 || 0)) newMiss++;
      await db.collection('timers').doc(id).update({ lastKilled: Date.now(), missCount: newMiss });
      logAdminAction('Manual Timer Reset', `Boss: ${data.bossName} (misses now: ${newMiss})`);
    });

    // start local interval display + auto-restart handling
    startManualTimerInterval(t);
  });

  feather.replace();
}

function renderScheduledTimers() {
  if (!scheduledTimersContainer) return;
  scheduledTimersContainer.innerHTML = '';
  const scheduled = timers.filter(t => t.type === 'scheduled');
  if (scheduled.length === 0) {
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

function renderTodaysSchedule() {
  if (!todaysScheduleContainer) return;
  todaysScheduleContainer.innerHTML = '';
  const today = new Date().getDay();
  const todayTimers = timers.filter(t => t.type === 'scheduled' && t.spawnDay === today);
  if (todayTimers.length === 0) {
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

// ======= Manual timer interval & Auto-Restart handling =======
function startManualTimerInterval(timer) {
  const id = timer.id;
  clearIntervalIfExists(id);
  // clear any previous autoRestart timeout
  if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }

  const respawnMs = (timer.respawnTime || 0) * 60000;
  const lastKilled = timer.lastKilled || Date.now();

  const updateFn = async () => {
    const timeLeft = Math.max(0, lastKilled + respawnMs - Date.now());
    updateTimerDisplay(id, timeLeft);
    const fill = respawnMs ? Math.min(100, ((respawnMs - timeLeft) / respawnMs) * 100) : 0;
    setProgress(id, fill);

    if (timeLeft <= 0) {
      // Timer finished — schedule auto-restart if configured
      if (timer.autoRestart && timer.autoRestart > 0) {
        // if there is already a pending autoRestartTimeout, do nothing (shouldn't be)
        if (!autoRestartTimeouts[id]) {
          const autoMs = timer.autoRestart * 60000;
          autoRestartTimeouts[id] = setTimeout(async () => {
            // Before applying auto-restart, fetch latest doc to check if someone restarted
            const doc = await db.collection('timers').doc(id).get();
            const data = doc.data();
            const latestLastKilled = data.lastKilled || Date.now();
            // if lastKilled still corresponds to the spawn that just happened (i.e., not restarted by user),
            // then increment missCount and reset lastKilled to now (start new cycle), and log
            if (Date.now() - latestLastKilled >= respawnMs) {
              const newMiss = (data.missCount || 0) + 1;
              await db.collection('timers').doc(id).update({ lastKilled: Date.now(), missCount: newMiss });
              logAdminAction('Auto-Restart Applied', `Boss: ${data.bossName} (misses: ${newMiss})`);
            }
            delete autoRestartTimeouts[id];
          }, timer.autoRestart * 60000);
        }
      } else {
        // no autoRestart configured — do nothing until user restarts or reset
      }
    } else {
      // timer not yet finished — ensure no autoRestart pending
      if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
    }
  };

  updateFn();
  timerIntervals[id] = setInterval(updateFn, 1000);
}

// ======= Scheduled timer interval & 10-min warnings =======
function startScheduledInterval(timer, nextSpawn) {
  const id = timer.id;
  clearIntervalIfExists(id);
  // clear any existing ten-min timeout
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  let ns = nextSpawn || computeNextSpawnExact(timer);
  if (!ns) return;

  const updateFn = () => {
    const msLeft = Math.max(0, ns.getTime() - Date.now());
    updateTimerDisplay(id, msLeft);
    const windowMs = (timer.spawnWindow || 30) * 60000;
    const progress = windowMs ? Math.min(100, ((windowMs - Math.max(0, msLeft)) / windowMs) * 100) : 0;
    setProgress(id, progress);

    if (msLeft <= 0) {
      // Spawn occurred within window - trigger spawn event once
      logAdminAction('Scheduled Timer Spawn', `Boss: ${timer.bossName}`);
      // update lastSpawned timestamp
      db.collection('timers').doc(id).update({ lastSpawned: Date.now() }).catch(()=>{});
      // compute next spawn
      ns = computeNextSpawnExact(timer, new Date(Date.now() + 1000));
      // schedule ten-min warning again for ns
      scheduleTenMinWarningExact(timer, ns);
      const nextEl = document.getElementById(`next-${id}`);
      if (nextEl) nextEl.textContent = ns ? ns.toLocaleString() : '--:--';
    }
  };

  updateFn();
  timerIntervals[id] = setInterval(updateFn, 1000);

  // schedule 10-min warning
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
  if (msUntil <= 0) return; // too late
  tenMinTimeouts[id] = setTimeout(() => {
    // send personal webhook
    fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚠️ 10-min warning: ${timer.bossName} will spawn in 10 minutes.` }) }).catch(()=>{});
    logAdminAction('Auto 10-min Warning Sent', `Boss: ${timer.bossName}`);
  }, msUntil);
}

// ======= Compute next spawn exact (spawnDay + spawnTime minutes-of-day) =======
function computeNextSpawnExact(timer, afterDate = new Date()) {
  if (!timer || typeof timer.spawnDay === 'undefined' || typeof timer.spawnTime === 'undefined') return null;
  const targetDay = timer.spawnDay; // 0..6
  const spawnMinutes = timer.spawnTime; // 0..1439
  const after = new Date(afterDate);
  // start searching from 'after' inclusive, check up to next 14 days
  for (let add = 0; add < 14; add++) {
    const cand = new Date(after.getFullYear(), after.getMonth(), after.getDate() + add);
    if (cand.getDay() !== targetDay) continue;
    // set hour/minute from spawnMinutes
    const hour = Math.floor(spawnMinutes / 60);
    const minute = spawnMinutes % 60;
    cand.setHours(hour, minute, 0, 0);
    if (cand.getTime() > Date.now()) return cand;
    // if equal or in past, continue to next matching day
  }
  return null;
}

// ======= Utility helpers =======
function formatSpawnTime(totalMinutes) {
  if (typeof totalMinutes === 'undefined' || totalMinutes === null) return '--:--';
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${minute.toString().padStart(2, '0')} ${ampm}`;
}

function updateTimerDisplay(id, ms) {
  const el = document.getElementById(`timer-${id}`);
  if (!el) return;
  const totalSeconds = Math.max(0, Math.floor(ms/1000));
  const hours = Math.floor(totalSeconds/3600).toString().padStart(2,'0');
  const minutes = Math.floor((totalSeconds%3600)/60).toString().padStart(2,'0');
  const seconds = (totalSeconds%60).toString().padStart(2,'0');
  el.textContent = `${hours}:${minutes}:${seconds}`;
}

function setProgress(id, pct) {
  const el = document.getElementById(`progress-${id}`);
  if (el) el.style.width = `${pct}%`;
}
function clearIntervalIfExists(id) {
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
}
function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c])); }

// ======= Stop All execution (called when system/control.stopAll becomes true) =======
function executeStopAllLocal() {
  // set all manual timers lastKilled = now and missCount = 0
  db.collection('timers').where('type','==','manual').get().then(snapshot => {
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { lastKilled: Date.now(), missCount: 0 });
    });
    return batch.commit();
  }).then(()=> logAdminAction('Stop All Executed', 'All manual timers reset (admin)')).catch(()=>{});
}

// ======= Control-room send wrapper (exposed to components) =======
async function sendControlRoomMessage(bossNames = [], extra = '') {
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) { alert('No webhook set'); return; }
  const u = userData || { ign: 'Unknown', guild: 'Unknown' };
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

// expose admin helpers for admin page
window.logAdminAction = logAdminAction;
window.triggerStopAllAdmin = async function() {
  const pw = prompt('Enter admin password:');
  if (pw !== 'theworldo') { alert('Wrong password'); return; }
  await db.collection('system').doc('control').set({ stopAll: true, lastStopped: Date.now() });
  logAdminAction('Stop All Triggered', 'Admin used stop all');
  alert('Stop All triggered.');
};
window.saveAdminWebhookToDb = async function(url) {
  const pw = prompt('Enter admin password to save admin webhook:');
  if (pw !== 'theworldo') { alert('Wrong password'); return; }
  await db.collection('system').doc('config').set({ adminWebhookUrl: url }, { merge: true });
  localStorage.setItem('adminWebhookUrl', url);
  adminWebhookFromDb = url;
  alert('Admin webhook saved.');
  logAdminAction('Admin Webhook Saved', `URL saved`);
};

// End of script.js