// ========= FIREBASE CONFIG =========
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

// Admin webhook fallback constant (optional). We'll try system/config first.
const FALLBACK_ADMIN_WEBHOOK = ""; // set if you want

// DOM
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');
const discordWebhookBtn = document.getElementById('discordWebhookBtn');
const controlRoomBtn = document.getElementById('controlRoomBtn');

// Local state
let timers = [];
let userData = JSON.parse(localStorage.getItem('userData') || 'null');
let personalWebhook = localStorage.getItem('webhookUrl') || '';
let adminWebhookLocal = localStorage.getItem('adminWebhookUrl') || '';
let adminWebhookFromDb = null;
const timerIntervals = {};
const tenMinTimeouts = {};

// Helpers
function getAdminWebhook() {
  return adminWebhookFromDb || adminWebhookLocal || FALLBACK_ADMIN_WEBHOOK;
}
function getUserIdentity() {
  return userData || { ign: 'Guest', guild: 'Unknown' };
}
function logAdminAction(action, details = "") {
  const adminWebhook = getAdminWebhook();
  const u = getUserIdentity();
  const content = `⚙️ **${action}** by ${u.ign} (${u.guild})\n${details}`;
  if (adminWebhook) {
    fetch(adminWebhook, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ content }) }).catch(()=>{});
  }
  // also write to Firestore activityLog
  db.collection('activityLog').add({
    action, details, ign: u.ign, guild: u.guild, timestamp: Date.now()
  }).catch(()=>{});
}

// Init
document.addEventListener('DOMContentLoaded', () => {
  // show welcome modal automatically (component handles display)
  // load admin config
  db.collection('system').doc('config').get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      adminWebhookFromDb = data.adminWebhookUrl || null;
    }
  }).catch(()=>{});

  // listen for real-time timers
  db.collection('timers').orderBy('createdAt','asc').onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(d => arr.push({ id: d.id, ...d.data() }));
    timers = arr;
    renderTimers();
  });

  // listen for control STOP ALL
  db.collection('system').doc('control').onSnapshot(doc => {
    const data = doc.data();
    if (data && data.stopAll === true) {
      executeStopAllLocal();
      // reset flag
      db.collection('system').doc('control').update({ stopAll: false }).catch(()=>{});
    }
  });

  // listen for config adminWebhook changes
  db.collection('system').doc('config').onSnapshot(doc => {
    if (!doc.exists) return;
    const d = doc.data();
    adminWebhookFromDb = d.adminWebhookUrl || null;
  });

  // Control room and webhook UI toggles
  personalWebhook = localStorage.getItem('webhookUrl') || '';
  if (personalWebhook) controlRoomBtn.classList.remove('hidden');

  // show visit to admin
  const u = getUserIdentity();
  if (getAdminWebhook()) {
    fetch(getAdminWebhook(), {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ content: `👤 Visitor: ${u.ign} (${u.guild}) visited at ${new Date().toLocaleString()}` })
    }).catch(()=>{});
  }
});

// ---------- renderers ----------
function renderTimers() {
  renderManualTimers();
  renderScheduledTimers();
  renderTodaysSchedule();
}

function renderManualTimers() {
  if (!manualTimersContainer) return;
  manualTimersContainer.innerHTML = '';
  const manual = timers.filter(t => t.type === 'manual');
  if (manual.length === 0) {
    manualTimersContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i data-feather="clock" class="w-12 h-12 mx-auto mb-4"></i>
        <p>No manual timers yet. Admin can add timers from admin page.</p>
      </div>`;
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
          <p class="text-sm text-gray-400">Last killed: ${new Date(lastKilled).toLocaleString()}</p>
          <p class="text-sm ${t.missCount > 0 ? 'text-yellow-400' : 'text-gray-400'}">Misses: <span id="miss-${id}">${t.missCount||0}</span></p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">--:--</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3">
        <div class="progress-fill bg-blue-500" id="progress-${id}" style="width:${progressPct}%"></div>
      </div>
      <div class="flex justify-end space-x-2 mt-3">
        <button class="report-kill bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="check" class="w-4 h-4"></i> Mark Kill</button>
      </div>`;

    manualTimersContainer.appendChild(el);

    // set next spawn text
    const nextEl = document.getElementById(`next-${id}`);
    if (nextEl) nextEl.textContent = new Date(lastKilled + respawnMs).toLocaleTimeString();

    // attach button
    el.querySelector('.report-kill').addEventListener('click', async () => {
      // mark kill -> update lastKilled and reset missCount
      await db.collection('timers').doc(id).update({ lastKilled: Date.now(), missCount: 0 });
      logAdminAction('Manual Timer: Mark Kill', `Boss: ${t.bossName}`);
      // optionally send webhook to admin or personal (not automatic unless control-room used)
    });

    // start live interval for display
    startTimerInterval(t);
  });

  feather.replace();
}

function renderScheduledTimers() {
  if (!scheduledTimersContainer) return;
  scheduledTimersContainer.innerHTML = '';
  const scheduled = timers.filter(t => t.type === 'scheduled');
  if (scheduled.length === 0) {
    scheduledTimersContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i data-feather="calendar" class="w-12 h-12 mx-auto mb-4"></i>
        <p>No scheduled timers yet. Admin can add timers from admin page.</p>
      </div>`;
    feather.replace();
    return;
  }

  scheduled.forEach(t => {
    const id = t.id;
    const nextSpawn = computeNextSpawnForScheduled(t);
    const remainingMs = nextSpawn ? Math.max(0, nextSpawn.getTime() - Date.now()) : 0;

    const el = document.createElement('div');
    el.className = 'timer-card scheduled-timer bg-gray-700 p-4 rounded-lg';
    el.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3>
          <p class="text-sm text-gray-400">Spawn days: ${(t.spawnDays||[]).join(', ')}</p>
          <p class="text-sm text-gray-400">Window: ${t.spawnWindow} minutes</p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">${nextSpawn? nextSpawn.toLocaleString() : '--:--'}</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3">
        <div class="progress-fill bg-purple-500" id="progress-${id}" style="width:0%"></div>
      </div>`;

    scheduledTimersContainer.appendChild(el);
    startScheduledInterval(t, nextSpawn);
  });

  feather.replace();
}

function renderTodaysSchedule() {
  if (!todaysScheduleContainer) return;
  todaysScheduleContainer.innerHTML = '';
  const today = new Date().getDay();
  const list = timers.filter(t => t.type === 'scheduled' && (t.spawnDays||[]).includes(today));
  if (list.length === 0) {
    todaysScheduleContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500 col-span-3">
        <i data-feather="meh" class="w-12 h-12 mx-auto mb-4"></i>
        <p>No bosses scheduled for today.</p>
      </div>`;
    feather.replace();
    return;
  }
  list.forEach(t => {
    const div = document.createElement('div');
    div.className = 'today-schedule bg-gray-700 p-4 rounded-lg';
    div.innerHTML = `<h3 class="font-semibold">${escapeHtml(t.bossName)}</h3><p class="text-sm text-gray-400">Window: ${t.spawnWindow} minutes</p>`;
    todaysScheduleContainer.appendChild(div);
  });
  feather.replace();
}

// ---------- timer intervals & scheduled warnings ----------
function startTimerInterval(timer) {
  const id = timer.id;
  clearIntervalIfExists(id);
  const respawnMs = (timer.respawnTime||0) * 60000;
  const lastKilled = timer.lastKilled || Date.now();
  const update = () => {
    const timeLeft = Math.max(0, lastKilled + respawnMs - Date.now());
    updateTimerDisplay(id, timeLeft);
    const fill = respawnMs ? Math.min(100, ((respawnMs - timeLeft) / respawnMs) * 100) : 0;
    setProgress(id, fill);
    if (timeLeft <= 0) {
      clearIntervalIfExists(id);
      // send admin log
      logAdminAction('Manual Timer Respawned', `Boss: ${timer.bossName}`);
      // do not auto-reset; admin or user must mark kill
    }
  };
  update();
  timerIntervals[id] = setInterval(update, 1000);
}

function startScheduledInterval(timer, nextSpawnDate) {
  const id = timer.id;
  clearIntervalIfExists(id);
  let nextSpawn = nextSpawnDate || computeNextSpawnForScheduled(timer);
  if (!nextSpawn) return;
  // schedule ten-minute warning
  scheduleTenMinWarning(timer, nextSpawn);

  const update = () => {
    const msLeft = Math.max(0, nextSpawn.getTime() - Date.now());
    updateTimerDisplay(id, msLeft);
    const windowMs = (timer.spawnWindow||30) * 60000;
    const progress = windowMs ? Math.min(100, ((windowMs - msLeft) / windowMs) * 100) : 0;
    setProgress(id, progress);
    if (msLeft <= 0) {
      // spawn event -> log and compute next spawn
      logAdminAction('Scheduled Timer Spawn', `Boss: ${timer.bossName}`);
      // update lastSpawned in DB
      db.collection('timers').doc(id).update({ lastSpawned: Date.now() }).catch(()=>{});
      // compute next spawn
      nextSpawn = computeNextSpawnForScheduled(timer, new Date(Date.now() + 1000));
      // re-schedule ten-min warning for new nextSpawn
      scheduleTenMinWarning(timer, nextSpawn);
      // update displayed next spawn
      const nextEl = document.getElementById(`next-${id}`);
      if (nextEl) nextEl.textContent = nextSpawn ? nextSpawn.toLocaleString() : '--:--';
    }
  };
  update();
  timerIntervals[id] = setInterval(update, 1000);
}

function computeNextSpawnForScheduled(timer, afterDate = new Date()) {
  const days = timer.spawnDays || [];
  if (!days.length) return null;
  const start = new Date(afterDate);
  for (let add = 0; add < 14; add++) {
    const candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + add, 12, 0, 0);
    if (days.includes(candidate.getDay())) return candidate;
  }
  return null;
}

function scheduleTenMinWarning(timer, nextSpawnDate) {
  if (!nextSpawnDate) return;
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) return;
  const id = timer.id;
  if (tenMinTimeouts[id]) clearTimeout(tenMinTimeouts[id]);
  const warnAt = nextSpawnDate.getTime() - 10*60000;
  const msUntil = warnAt - Date.now();
  if (msUntil <= 0) return; // too late
  tenMinTimeouts[id] = setTimeout(() => {
    // send warning to personal webhook
    fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚠️ 10-min warning: ${timer.bossName} will spawn in 10 minutes.` }) }).catch(()=>{});
    logAdminAction('Auto 10-min Warning Sent', `Boss: ${timer.bossName}`);
  }, msUntil);
}

// ---------- UI helpers ----------
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
function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c])); }

// ---------- Stop All system (executes when system/control.stopAll becomes true) ----------
function executeStopAllLocal() {
  // Set all manual timers lastKilled = now and missCount = 0
  db.collection('timers').where('type','==','manual').get().then(snapshot => {
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { lastKilled: Date.now(), missCount: 0 });
    });
    return batch.commit();
  }).then(()=> {
    logAdminAction('Stop All Executed', 'All manual timers reset (admin)');
  }).catch(()=>{});
}

// ---------- admin actions triggered from admin.html (password-protected) ----------
// admin-add-timer component handles posting to Firestore, but Stop All and admin webhook saving are below:

// Stop All button in admin.html triggers:
//  - update system/control { stopAll: true, lastStopped: Date.now() } (password required)
window.triggerStopAll = async function() {
  const pw = prompt('Enter admin password:');
  if (pw !== 'theworldo') { alert('Wrong password'); return; }
  await db.collection('system').doc('control').set({ stopAll: true, lastStopped: Date.now() });
  logAdminAction('Stop All Triggered', 'Admin executed Stop All');
  alert('Stop All triggered.');
};

// Save admin webhook from admin.html
window.saveAdminWebhook = async function(url) {
  // require admin password
  const pw = prompt('Enter admin password to save admin webhook:');
  if (pw !== 'theworldo') { alert('Wrong password'); return; }
  await db.collection('system').doc('config').set({ adminWebhookUrl: url }, { merge: true });
  localStorage.setItem('adminWebhookUrl', url);
  adminWebhookFromDb = url;
  alert('Admin webhook saved.');
  logAdminAction('Admin Webhook Saved', `URL saved`);
};

// ---------- Control room sending (invoked from component) ----------
async function sendControlRoomMessage(bossNames = [], extra = '') {
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) { alert('No webhook set.'); return; }
  const user = getUserIdentity();
  const payload = {
    embeds: [{
      title: 'Boss Notification',
      description: bossNames.map(b => `**${b}**`).join('\n'),
      footer: { text: `${user.ign} • ${user.guild}` },
      timestamp: new Date()
    }]
  };
  if (extra) payload.embeds[0].fields = [{ name: 'Message', value: extra }];
  await fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).catch(()=>{});
  logAdminAction('Control Room Send', `Sent: ${bossNames.join(', ')}`);
  alert('Message sent to Discord.');
}

// expose to components
window.sendControlRoomMessage = sendControlRoomMessage;
window.triggerStopAllAdmin = window.triggerStopAll;
window.saveAdminWebhookToDb = window.saveAdminWebhook;

// End of script.js