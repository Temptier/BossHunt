/* final script.js - Bossy McBossFace
   - Shared realtime timers via Firestore
   - Manual timers with optional auto-restart + miss counting
   - Scheduled timers with precise spawn time (hh:mm) and 10-min warnings
   - Admin webhook logging, Control Room sending, Stop All
   - Admin-protected actions guarded by password "theworldo"
*/

// ---------------- FIREBASE CONFIG (replace with your values) ----------------
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
const FieldValue = firebase.firestore.FieldValue;

// ---------------- Local state & constants ----------------
const PASSWORD = 'theworldo';
const FALLBACK_ADMIN_WEBHOOK = ''; // optional fallback
let timers = []; // array of timer docs {id, ...data}
let userData = JSON.parse(localStorage.getItem('userData') || 'null');
let personalWebhook = localStorage.getItem('webhookUrl') || '';
let adminWebhookLocal = localStorage.getItem('adminWebhookUrl') || '';
let adminWebhookFromDb = null; // filled from system/config doc
const timerIntervals = {}; // interval ids for timers
const tenMinTimeouts = {};  // timeouts for 10-min warnings

// DOM shortcuts (may be null on admin page)
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');
const controlRoomBtn = document.getElementById('controlRoomBtn');
const discordWebhookBtn = document.getElementById('discordWebhookBtn');

// ---------------- Helpers ----------------
function getUser() {
  return userData || { ign: 'Guest', guild: 'Unknown' };
}
function getAdminWebhook() {
  return adminWebhookFromDb || adminWebhookLocal || FALLBACK_ADMIN_WEBHOOK;
}
function millisFrom(value) {
  // Handle Firestore Timestamp or numeric or ISO string
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (value instanceof firebase.firestore.Timestamp) return value.toMillis();
  // try string
  const n = Date.parse(value);
  return isNaN(n) ? null : n;
}
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c])); }

// ---------------- Admin logging ----------------
function logAdminAction(action, details = '') {
  const adminUrl = getAdminWebhook();
  const u = getUser();
  const payload = { content: `⚙️ **${action}**\nUser: ${u.ign} (${u.guild})\n${details}` };
  if (adminUrl) {
    fetch(adminUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(payload) }).catch(()=>{});
  }
  // also store activity in Firestore for history
  db.collection('activityLog').add({
    action, details, ign: u.ign, guild: u.guild, timestamp: Date.now()
  }).catch(()=>{});
}

// ---------------- Startup listeners ----------------
document.addEventListener('DOMContentLoaded', () => {
  // load admin webhook from DB config if exists
  db.collection('system').doc('config').get()
    .then(d => { if (d.exists) adminWebhookFromDb = d.data().adminWebhookUrl || null; })
    .catch(()=>{});

  // listen realtime for timers collection
  db.collection('timers').orderBy('createdAt','asc').onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
    timers = arr;
    renderAllTimers();
  });

  // listen for Stop All control
  db.collection('system').doc('control').onSnapshot(doc => {
    const data = doc.exists ? doc.data() : null;
    if (data && data.stopAll === true) {
      executeStopAllLocal().then(() => {
        // reset flag
        db.collection('system').doc('control').update({ stopAll: false }).catch(()=>{});
      });
    }
  });

  // listen for config changes (admin webhook)
  db.collection('system').doc('config').onSnapshot(doc => {
    if (doc.exists) {
      adminWebhookFromDb = doc.data().adminWebhookUrl || null;
    }
  });

  // show control room button if user has personal webhook
  personalWebhook = localStorage.getItem('webhookUrl') || '';
  if (personalWebhook && controlRoomBtn) controlRoomBtn.classList.remove('hidden');

  // visitor log to admin
  const adminUrl = getAdminWebhook();
  if (adminUrl) {
    const u = getUser();
    fetch(adminUrl, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `👤 Visitor: ${u.ign} (${u.guild}) visited at ${new Date().toLocaleString()}` }) }).catch(()=>{});
  }
});

// ---------------- Renderers ----------------
function renderAllTimers() {
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
        <p>No manual timers yet. Admin can add timers on admin page.</p>
      </div>`;
    feather.replace();
    return;
  }

  manual.forEach(t => {
    const id = t.id;
    const lastKilledMs = millisFrom(t.lastKilled) || 0;
    const respawnMs = (t.respawnMinutes || t.respawnTime || 0) * 60000;
    const elapsed = Date.now() - lastKilledMs;
    const remaining = Math.max(0, respawnMs - elapsed);
    const progress = respawnMs ? Math.min(100, (elapsed/respawnMs)*100) : 0;

    const el = document.createElement('div');
    el.className = 'timer-card manual-timer bg-gray-700 p-4 rounded-lg';
    el.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3>
          <p class="text-sm text-gray-400">Respawn: ${t.respawnMinutes || t.respawnTime} minutes</p>
          <p class="text-sm text-gray-400">Last killed: ${ lastKilledMs ? new Date(lastKilledMs).toLocaleString() : 'Never' }</p>
          <p class="text-sm ${ (t.missCount||0) > 0 ? 'text-yellow-400' : 'text-gray-400' }">Misses: <span id="miss-${id}">${t.missCount||0}</span></p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">--:--</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3">
        <div class="progress-fill bg-blue-500" id="progress-${id}" style="width:${progress}%"></div>
      </div>
      <div class="flex justify-end space-x-2 mt-3">
        <button class="restart-btn bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="refresh-cw" class="w-4 h-4"></i> Restart</button>
        <button class="reset-btn bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="rotate-ccw" class="w-4 h-4"></i> Reset</button>
      </div>
    `;
    manualTimersContainer.appendChild(el);

    // Set next spawn
    const nextEl = document.getElementById(`next-${id}`);
    if (nextEl && lastKilledMs) nextEl.textContent = new Date(lastKilledMs + respawnMs).toLocaleTimeString();

    // Attach actions
    el.querySelector('.restart-btn').addEventListener('click', async () => {
      // Restart = user indicates boss was killed now -> set lastKilled = now, reset missCount
      await db.collection('timers').doc(id).update({
        lastKilled: FieldValue.serverTimestamp(),
        missCount: 0
      });
      logAdminAction('Manual Timer Restarted', `Boss: ${t.bossName}`);
    });
    el.querySelector('.reset-btn').addEventListener('click', async () => {
      // Reset = set lastKilled = now but increment miss count if appropriate
      // We'll increment missCount unconditionally here (admin can decide otherwise)
      await db.collection('timers').doc(id).update({
        lastKilled: FieldValue.serverTimestamp(),
        missCount: FieldValue.increment(1)
      });
      logAdminAction('Manual Timer Reset (manual)', `Boss: ${t.bossName}`);
    });

    // Start live interval (clears previous)
    startManualInterval(t);
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
        <p>No scheduled timers yet. Admin can add timers on admin page.</p>
      </div>`;
    feather.replace();
    return;
  }

  scheduled.forEach(t => {
    const id = t.id;
    const next = computeNextSpawnForScheduled(t);
    const remainingMs = next ? Math.max(0, next.getTime() - Date.now()) : 0;

    const el = document.createElement('div');
    el.className = 'timer-card scheduled-timer bg-gray-700 p-4 rounded-lg';
    el.innerHTML = `
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3>
          <p class="text-sm text-gray-400">Days: ${(t.spawnDays||[]).join(', ')} ${t.spawnDay ? '('+t.spawnDay+')' : ''}</p>
          <p class="text-sm text-gray-400">Spawn time: ${t.spawnTime || '--:--'}</p>
        </div>
        <div class="text-right">
          <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
          <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">${ next ? next.toLocaleString() : '--:--' }</span></div>
        </div>
      </div>
      <div class="progress-bar mt-3">
        <div class="progress-fill bg-purple-500" id="progress-${id}" style="width:0%"></div>
      </div>
    `;
    scheduledTimersContainer.appendChild(el);

    // start scheduled interval and 10-min warnings
    startScheduledInterval(t, next);
  });

  feather.replace();
}

function renderTodaysSchedule() {
  if (!todaysScheduleContainer) return;
  todaysScheduleContainer.innerHTML = '';
  const todayNum = new Date().getDay();
  const list = timers.filter(t => t.type === 'scheduled' && ((t.spawnDays && t.spawnDays.includes(todayNum)) || (t.spawnDay && dayNameToNum(t.spawnDay) === todayNum)));
  if (!list.length) {
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
    div.innerHTML = `<h3 class="font-semibold text-lg">${escapeHtml(t.bossName)}</h3><p class="text-sm text-gray-400">Spawn: ${t.spawnTime || '—'}</p>`;
    todaysScheduleContainer.appendChild(div);
  });
  feather.replace();
}

// ---------------- Manual timer interval & auto-restart ----------------
function startManualInterval(timerDoc) {
  const id = timerDoc.id;
  clearIntervalIfExists(id);
  // calculate respawn in ms
  const respawnMs = (timerDoc.respawnMinutes || timerDoc.respawnTime || 0) * 60000;
  const lastKilledMs = millisFrom(timerDoc.lastKilled) || 0;

  function tick() {
    const now = Date.now();
    const elapsed = now - lastKilledMs;
    const msLeft = Math.max(0, respawnMs - elapsed);
    updateTimerDisplay(id, msLeft);
    const pct = respawnMs ? Math.min(100, (elapsed / respawnMs) * 100) : 0;
    setProgress(id, pct);
    const nextEl = document.getElementById(`next-${id}`);
    if (nextEl && lastKilledMs) nextEl.textContent = new Date(lastKilledMs + respawnMs).toLocaleTimeString();

    if (msLeft <= 0) {
      // timer expired — handle auto-restart or mark inactive
      clearIntervalIfExists(id);
      handleManualTimerExpiry(timerDoc).catch(()=>{});
    }
  }

  tick();
  timerIntervals[id] = setInterval(tick, 1000);
}

async function handleManualTimerExpiry(timerDoc) {
  // Reload latest doc to avoid race
  const ref = db.collection('timers').doc(timerDoc.id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const t = snap.data();
  const auto = !!t.autoRestart;
  if (auto) {
    // Auto restart: set lastKilled = now, increment missCount
    await ref.update({
      lastKilled: FieldValue.serverTimestamp(),
      missCount: FieldValue.increment(1)
    });
    logAdminAction('Auto-Restart: Manual Timer', `Boss: ${t.bossName}`);
    // send personal webhook warning (optional)
    const web = localStorage.getItem('webhookUrl') || '';
    if (web) {
      fetch(web, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚠️ ${t.bossName} missed spawn — auto-restarted.` }) }).catch(()=>{});
    }
  } else {
    // mark active false (we'll set active field)
    await ref.update({ active: false });
    logAdminAction('Manual Timer Expired (no auto)', `Boss: ${t.bossName}`);
  }
}

// ---------------- Scheduled interval & 10-min warnings ----------------
function startScheduledInterval(timerDoc, nextSpawnDate = null) {
  const id = timerDoc.id;
  clearIntervalIfExists(id);
  // compute next spawn if not provided
  let nextSpawn = nextSpawnDate || computeNextSpawnForScheduled(timerDoc);
  if (!nextSpawn) return;

  // schedule 10-min warning for this next spawn
  scheduleTenMinWarningForTimer(timerDoc, nextSpawn);

  function tick() {
    const msLeft = Math.max(0, nextSpawn.getTime() - Date.now());
    updateTimerDisplay(id, msLeft);
    const windowMs = (timerDoc.spawnWindow || 30) * 60000;
    const pct = windowMs ? Math.min(100, ((windowMs - msLeft) / windowMs) * 100) : 0;
    setProgress(id, pct);

    if (msLeft <= 0) {
      // scheduled spawn happening now
      logAdminAction('Scheduled Timer Spawn', `Boss: ${timerDoc.bossName}`);
      // update lastSpawned
      db.collection('timers').doc(id).update({ lastSpawned: FieldValue.serverTimestamp() }).catch(()=>{});
      // compute next spawn and re-schedule warning
      nextSpawn = computeNextSpawnForScheduled(timerDoc, new Date(Date.now() + 1000));
      scheduleTenMinWarningForTimer(timerDoc, nextSpawn);
      // update next display element
      const nextEl = document.getElementById(`next-${id}`);
      if (nextEl) nextEl.textContent = nextSpawn ? nextSpawn.toLocaleString() : '--:--';
    }
  }

  tick();
  timerIntervals[id] = setInterval(tick, 1000);
}

// compute next spawn using spawnDays array and optional spawnTime (HH:MM)
// spawnDays may be numeric array [0..6] or spawnDay string like "Monday"
function computeNextSpawnForScheduled(timer, after = new Date()) {
  const spawnDays = timer.spawnDays && timer.spawnDays.length ? timer.spawnDays.map(n => parseInt(n)) : (timer.spawnDay ? [dayNameToNum(timer.spawnDay)] : []);
  if (!spawnDays.length) return null;
  // spawnTime preferred (HH:MM) else midday
  const spawnTime = timer.spawnTime || '12:00';
  const [hh, mm] = spawnTime.split(':').map(x => parseInt(x || '0'));
  // search next 14 days
  for (let add = 0; add < 14; add++) {
    const cand = new Date(after.getFullYear(), after.getMonth(), after.getDate() + add, hh, mm, 0, 0);
    if (spawnDays.includes(cand.getDay())) {
      if (cand.getTime() <= Date.now()) continue; // ensure future
      return cand;
    }
  }
  return null;
}
function dayNameToNum(name) {
  if (!name) return null;
  const map = { sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
  return map[name.toLowerCase()] ?? null;
}
function scheduleTenMinWarningForTimer(timerDoc, nextSpawnDate) {
  const id = timerDoc.id;
  // clear previous timeout
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); tenMinTimeouts[id] = null; }
  const webhook = localStorage.getItem('webhookUrl') || '';
  const admin = getAdminWebhook();
  if (!webhook || !nextSpawnDate) return;
  const warnAt = nextSpawnDate.getTime() - 10 * 60000;
  const msUntil = warnAt - Date.now();
  if (msUntil <= 0) return; // too late to warn
  tenMinTimeouts[id] = setTimeout(() => {
    // user webhook
    fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `⚠️ 10-minute warning: ${timerDoc.bossName} will spawn in 10 minutes.` }) }).catch(()=>{});
    // admin log
    if (admin) fetch(admin, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ content: `🔔 10-min warning sent (user webhook): ${timerDoc.bossName}` }) }).catch(()=>{});
    logAdminAction('Auto 10-min Warning Sent', `Boss: ${timerDoc.bossName}`);
  }, msUntil);
}

// ---------------- Stop All execution ----------------
async function executeStopAllLocal() {
  try {
    const snapshot = await db.collection('timers').where('type','==','manual').get();
    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { lastKilled: FieldValue.serverTimestamp(), missCount: 0 });
    });
    await batch.commit();
    logAdminAction('Stop All Executed', 'All manual timers were reset by Stop All');
  } catch (err) {
    console.error('Stop All failed', err);
  }
}

// ---------------- UI helpers ----------------
function updateTimerDisplay(id, ms) {
  const el = document.getElementById(`timer-${id}`);
  if (!el) return;
  const total = Math.max(0, Math.floor(ms/1000));
  const hrs = Math.floor(total/3600).toString().padStart(2,'0');
  const mins = Math.floor((total%3600)/60).toString().padStart(2,'0');
  const secs = (total%60).toString().padStart(2,'0');
  el.textContent = `${hrs}:${mins}:${secs}`;
}
function setProgress(id, pct) {
  const el = document.getElementById(`progress-${id}`);
  if (el) el.style.width = `${pct}%`;
}
function clearIntervalIfExists(id) {
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
}

// ---------------- Admin operations (exposed for admin page) ----------------
window.triggerStopAll = async function() {
  const pw = prompt('Enter admin password:');
  if (pw !== PASSWORD) { alert('Wrong password'); return; }
  await db.collection('system').doc('control').set({ stopAll: true, lastStopped: Date.now() });
  logAdminAction('Stop All Triggered (admin)', 'Stop All triggered by admin');
  alert('Stop All triggered.');
};

window.saveAdminWebhookToDb = async function(url) {
  const pw = prompt('Enter admin password to save admin webhook:');
  if (pw !== PASSWORD) { alert('Wrong password'); return; }
  await db.collection('system').doc('config').set({ adminWebhookUrl: url }, { merge: true });
  adminWebhookFromDb = url;
  localStorage.setItem('adminWebhookUrl', url);
  logAdminAction('Admin Webhook Saved', `URL saved to system/config`);
  alert('Admin webhook saved to system config.');
};

// ---------------- Control Room sending (exposed to components) ----------------
window.sendControlRoomMessage = async function(bossNames = [], extra = '') {
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) { alert('No personal webhook set.'); return; }
  const u = getUser();
  const embed = {
    title: 'Boss Notification',
    description: bossNames.map(b => `**${b}**`).join('\n'),
    footer: { text: `${u.ign} • ${u.guild}` },
    timestamp: new Date()
  };
  if (extra) embed.fields = [{ name: 'Message', value: extra }];
  await fetch(webhook, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ embeds: [embed] }) }).catch(()=>{});
  logAdminAction('Control Room Send', `Sent: ${bossNames.join(', ')}`);
  alert('Message sent to Discord.');
};

// ---------------- Utility: prevent duplicate add (optional) ----------------
async function addTimerIfNotExists(timerData) {
  // check same bossName + type
  const q = db.collection('timers').where('bossName','==',timerData.bossName).where('type','==',timerData.type);
  const snap = await q.get();
  if (!snap.empty) {
    // merge or skip - for now skip and notify
    throw new Error('A timer with that name and type already exists.');
  }
  return db.collection('timers').add(timerData);
}

// End of script.js