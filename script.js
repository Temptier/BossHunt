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


// ================= Global state (exposed) =================
window.userData = JSON.parse(localStorage.getItem('userData') || 'null'); // IGN + Guild stored locally via welcome modal
window.timers = []; // live copy of timers from Firestore
let adminWebhookFromDb = null; // loaded from system/config

// DOM containers (may be missing if on admin page)
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');
const activityLogContainer = document.getElementById('activityLogContainer');

// internal intervals/timeouts per-timer
const timerIntervals = {};        // interval ids for updating UI per timer
const tenMinTimeouts = {};       // 10-min warning timeouts
const autoRestartTimeouts = {};  // auto-restart timeouts (client-side fallback) — logic enforced by Firestore updates

// -------------------- Helpers --------------------
function normalizeId(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
}
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"'`=\/]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c]));
}
function minutesOfDayFromHourMinute(hour24, minute) {
  return hour24 * 60 + minute;
}
function hourMinuteFromMinutesOfDay(totalMinutes) {
  const h = Math.floor(totalMinutes / 60) % 24;
  const m = totalMinutes % 60;
  return { hour24: h, minute: m };
}
function formatSpawnTime(totalMinutes) {
  if (typeof totalMinutes === 'undefined' || totalMinutes === null) return '--:--';
  const { hour24, minute } = hourMinuteFromMinutesOfDay(totalMinutes);
  const ampm = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(minute).padStart(2,'0')} ${ampm}`;
}
function formatTimeFromMs(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2,'0');
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2,'0');
  const seconds = (totalSeconds % 60).toString().padStart(2,'0');
  return `${hours}:${minutes}:${seconds}`;
}
function nowMs() { return Date.now(); }

// -------------------- Admin webhook & logging --------------------
async function loadAdminWebhookFromDb() {
  try {
    const doc = await db.collection('system').doc('config').get();
    if (doc.exists) adminWebhookFromDb = doc.data().adminWebhookUrl || null;
    return adminWebhookFromDb;
  } catch (e) {
    console.warn('loadAdminWebhookFromDb failed', e);
    return null;
  }
}
window.getAdminWebhookUrl = async () => adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';

/**
 * Logs an action:
 *  - Writes to Firestore collection "logs"
 *  - Posts to Admin Discord webhook (if configured in system/config or localStorage)
 */
async function logAdminAction(action, details = '') {
  try {
    const entry = {
      action,
      details,
      ign: (window.userData && window.userData.ign) || 'Unknown',
      guild: (window.userData && window.userData.guild) || 'Unknown',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('logs').add(entry).catch(()=>{}); // best-effort

    const adminWebhook = adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';
    if (adminWebhook) {
      await fetch(adminWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: `⚙️ **${action}** by ${(window.userData && window.userData.ign) || 'Unknown'} (${(window.userData && window.userData.guild) || 'Unknown'})\n${details}`
        })
      }).catch(()=>{});
    }
  } catch (err) {
    console.warn('logAdminAction error', err);
  }
}

// -------------------- Firestore subscriptions --------------------
function subscribeTimers() {
  // All clients read the shared timers collection
  db.collection('timers').orderBy('createdAt', 'asc').onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(doc => arr.push({ id: doc.id, ...doc.data() }));
    window.timers = arr;
    // re-render UI if present
    if (typeof renderAll === 'function') renderAll();
  }, err => {
    console.warn('timers subscription error', err);
  });
}

function subscribeControlDoc() {
  db.collection('system').doc('control').onSnapshot(doc => {
    const data = doc.data();
    if (data && data.stopAll) {
      // Execute stop-all locally: set all manual timers lastKilled=now and missCount=0
      executeStopAllLocal().catch(()=>{});
      // Reset the flag (best-effort)
      db.collection('system').doc('control').update({ stopAll: false }).catch(()=>{});
    }
  }, err => { console.warn('control subscription error', err); });
}

function subscribeConfigDoc() {
  db.collection('system').doc('config').onSnapshot(doc => {
    if (!doc.exists) return;
    const d = doc.data();
    adminWebhookFromDb = d.adminWebhookUrl || adminWebhookFromDb;
  }, err => { console.warn('config subscription error', err); });
}

// -------------------- Timer creation helpers --------------------
/**
 * Create/Update manual timer document in Firestore.
 * respawnHours: number (hours)
 * autoRestartMinutes: number|null (minutes)
 */
async function createOrUpdateManualTimer(bossName, respawnHours, autoRestartMinutes = null, createdBy = null) {
  const id = normalizeId(bossName);
  const lastKilled = nowMs();
  const respawnMs = Math.floor(respawnHours * 60 * 60 * 1000); // hours -> ms
  const nextSpawn = lastKilled + respawnMs;
  const payload = {
    type: 'manual',
    bossName,
    respawnHours: Number(respawnHours),
    respawnMs: respawnMs,            // stored for convenience
    autoRestart: autoRestartMinutes ? Number(autoRestartMinutes) : null,
    lastKilled,
    nextSpawn,
    missCount: 0,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('timers').doc(id).set(payload, { merge: true });
  await logAdminAction('Add/Update Manual Timer', `Boss: ${bossName}, RespawnHours: ${respawnHours}, AutoRestart: ${autoRestartMinutes||'off'}`);
}

/**
 * Create/Update scheduled timer document in Firestore.
 * spawnDay: 0..6
 * spawnTimeMinutes: minutes-of-day (0..1439)
 * spawnWindowMinutes: number
 */
async function createOrUpdateScheduledTimer(bossName, spawnDay, spawnTimeMinutes, spawnWindowMinutes, createdBy = null) {
  const id = normalizeId(bossName);
  const nextSpawn = computeNextSpawnForScheduledDoc(spawnDay, spawnTimeMinutes);
  const payload = {
    type: 'scheduled',
    bossName,
    spawnDay: Number(spawnDay),
    spawnTime: Number(spawnTimeMinutes), // minutes-of-day
    spawnWindow: Number(spawnWindowMinutes),
    nextSpawn: nextSpawn ? nextSpawn.getTime() : null,
    lastSpawned: null,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('timers').doc(id).set(payload, { merge: true });
  await logAdminAction('Add/Update Scheduled Timer', `Boss: ${bossName}, Day:${spawnDay}, TimeMin:${spawnTimeMinutes}, Window:${spawnWindowMinutes}min`);
}

// -------------------- Next spawn calculators --------------------
/**
 * For scheduled timers: compute the next Date object after `afterDate` (default now)
 * using spawnDay (0..6) and spawnTime (minutes-of-day).
 * Returns Date or null.
 */
function computeNextSpawnForScheduledDoc(spawnDay, spawnTimeMinutes, afterDate = new Date()) {
  if (typeof spawnDay === 'undefined' || typeof spawnTimeMinutes === 'undefined') return null;
  const after = new Date(afterDate);
  // check up to 14 days ahead
  for (let add = 0; add < 14; add++) {
    const candidate = new Date(after.getFullYear(), after.getMonth(), after.getDate() + add);
    if (candidate.getDay() !== Number(spawnDay)) continue;
    const hour = Math.floor(spawnTimeMinutes / 60);
    const minute = spawnTimeMinutes % 60;
    candidate.setHours(hour, minute, 0, 0);
    if (candidate.getTime() > Date.now()) return candidate;
  }
  return null;
}

/**
 * For manual timers: compute a nextSpawn timestamp from lastKilled + respawnHours
 * If timer already contains nextSpawn (in Firestore) we prefer that value as canonical.
 */
function computeNextSpawnForManualDoc(docData) {
  if (!docData) return null;
  if (docData.nextSpawn) return docData.nextSpawn;
  const lastKilled = docData.lastKilled || nowMs();
  const respawnMs = Number(docData.respawnMs || (Number(docData.respawnHours || 0) * 60 * 60 * 1000));
  return lastKilled + respawnMs;
}

// -------------------- Auto-restart logic (based on last end time) --------------------
/**
 * Auto-restart rule:
 * - When current time > (nextSpawn + (autoRestart minutes * 60000)) AND
 *   the timer has not been restarted manually (lastKilled still corresponds to the spawn that ended)
 * - Perform atomic update:
 *    lastKilled := nextSpawn
 *    nextSpawn := nextSpawn + respawnMs
 *    missCount := increment(1)
 *
 * Implementation: we'll do a read -> conditional update using transaction to avoid races.
 */
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

      // ensure respawnMs available
      const respawnMs = Number(data.respawnMs || (Number(data.respawnHours||0) * 60 * 60 * 1000));
      const nextSpawn = Number(data.nextSpawn || (data.lastKilled ? (data.lastKilled + respawnMs) : (nowMs() + respawnMs)));
      const autoRestartMs = Number(data.autoRestart) * 60000;
      const threshold = nextSpawn + autoRestartMs;

      // If now > threshold, and lastKilled hasn't changed (i.e., still referring to the previous cycle),
      // then perform auto-restart.
      if (nowMs() > threshold) {
        // If lastKilled is already >= nextSpawn, that means someone already restarted.
        const lastKilled = Number(data.lastKilled || 0);
        // We consider "not restarted" if lastKilled < nextSpawn + 1000 (i.e. it's still the same event)
        if (lastKilled < nextSpawn + 1000) {
          const newLastKilled = nextSpawn; // base restart on end time
          const newNextSpawn = newLastKilled + respawnMs;
          tx.update(ref, {
            lastKilled: newLastKilled,
            nextSpawn: newNextSpawn,
            missCount: firebase.firestore.FieldValue.increment(1)
          });
          // Also write a log (fire-and-forget)
          db.collection('logs').add({
            action: 'Auto-Restart',
            details: `Auto restarted ${data.bossName} (autoRestart ${data.autoRestart}m).`,
            ign: (window.userData && window.userData.ign) || 'system',
            guild: (window.userData && window.userData.guild) || 'system',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(()=>{});
        }
      }
    });
  } catch (err) {
    console.warn('attemptAutoRestartForTimer transaction failed', id, err);
  }
}

// -------------------- 10-minute warning to user webhook --------------------
function scheduleTenMinuteWarning(timerDoc) {
  if (!timerDoc) return;
  // personal webhook (stored in localStorage by user)
  const personalWebhook = localStorage.getItem('webhookUrl') || '';
  if (!personalWebhook) return; // do not schedule if user hasn't provided a webhook on this client

  const id = timerDoc.id;
  // clear existing
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  // determine canonical nextSpawn: prefer timerDoc.nextSpawn else compute
  const nextSpawnTs = timerDoc.nextSpawn || computeNextSpawnForManualDoc(timerDoc);
  if (!nextSpawnTs) return;
  const warnAt = Number(nextSpawnTs) - 10 * 60000;
  const msUntil = warnAt - nowMs();
  if (msUntil <= 0) return; // too late to warn
  tenMinTimeouts[id] = setTimeout(() => {
    fetch(personalWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `⚠️ 10-minute warning: **${timerDoc.bossName}** will spawn in 10 minutes.` })
    }).catch(()=>{});
    // log admin that a 10-min warning was sent (best-effort)
    logAdminAction('10-min Warning Sent', `Boss: ${timerDoc.bossName}`);
    delete tenMinTimeouts[id];
  }, msUntil);
}

// -------------------- UI rendering & per-timer intervals --------------------
/**
 * renderAll: calls manual + scheduled + today's schedule rendering functions
 * These rendering functions rely on DOM elements that exist in index.html.
 * They also start per-timer intervals that update the countdown and trigger client-side checks.
 */
function renderAll() {
  renderManualTimers();
  renderScheduledTimers();
  renderTodaysSchedule();
}

// Manual timers UI
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
    const respawnMs = Number(t.respawnMs || (Number(t.respawnHours || 0) * 60 * 60 * 1000));
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
          <p class="text-sm ${missCount > 0 ? 'text-yellow-400' : 'text-gray-400'}">Misses: <span id="miss-${id}">${missCount}</span></p>
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

    // attach actions
    wrapper.querySelector('.mark-kill')?.addEventListener('click', async () => {
      // user marks boss as killed -> set lastKilled = now, nextSpawn = now + respawnMs, missCount = 0
      const now = nowMs();
      try {
        await db.collection('timers').doc(id).update({
          lastKilled: now,
          nextSpawn: now + respawnMs,
          missCount: 0
        });
        logAdminAction('Manual Mark Kill', `Boss: ${t.bossName}`);
      } catch (e) {
        console.warn('mark-kill update failed', e);
      }
    });

    wrapper.querySelector('.reset-timer')?.addEventListener('click', async () => {
      // Reset: treat as manual restart (lastKilled = now) but preserve miss logic
      const now = nowMs();
      try {
        // read doc to check if overdue
        const snap = await db.collection('timers').doc(id).get();
        const data = snap.exists ? snap.data() : {};
        let newMiss = Number(data.missCount || 0);
        const respawnMsLocal = Number(data.respawnMs || respawnMs);
        const elapsedLocal = now - (data.lastKilled || now);
        if (elapsedLocal > respawnMsLocal + ((data.autoRestart || 0) * 60000)) newMiss++;
        await db.collection('timers').doc(id).update({
          lastKilled: now,
          nextSpawn: now + respawnMsLocal,
          missCount: newMiss
        });
        logAdminAction('Manual Reset', `Boss: ${t.bossName} (misses now ${newMiss})`);
      } catch (e) {
        console.warn('reset-timer failed', e);
      }
    });

    // start per-timer UI update interval & schedule auto-restart checks and 10-min warning
    startPerTimerLoop(t);
  });

  feather.replace();
}

// Scheduled timers UI
function renderScheduledTimers() {
  if (!scheduledTimersContainer) return;
  scheduledTimersContainer.innerHTML = '';
  const scheduled = window.timers.filter(t => t.type === 'scheduled');

  if (scheduled.length === 0) {
    scheduledTimersContainer.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <i data-feather="calendar" class="w-12 h-12 mx-auto mb-4"></i>
        <p>No scheduled timers yet.</p>
      </div>`;
    feather.replace();
    return;
  }

  scheduled.forEach(t => {
    const id = t.id;
    const nextSpawnTs = t.nextSpawn || (computeNextSpawnForScheduledDoc(t.spawnDay, t.spawnTime) ? computeNextSpawnForScheduledDoc(t.spawnDay, t.spawnTime).getTime() : null);
    const remainingMs = nextSpawnTs ? Math.max(0, nextSpawnTs - nowMs()) : 0;
    const progressPct = (t.spawnWindow && t.spawnWindow > 0) ? Math.min(100, ((t.spawnWindow*60000 - Math.max(0, remainingMs)) / (t.spawnWindow*60000)) * 100) : 0;

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

    // start scheduled loop (updates + check for spawn + schedule 10-min warnings)
    startScheduledTimerLoop(t);

  });

  feather.replace();
}

// Today's schedule panel
function renderTodaysSchedule() {
  if (!todaysScheduleContainer) return;
  todaysScheduleContainer.innerHTML = '';
  const today = new Date().getDay();
  const list = window.timers.filter(t => t.type === 'scheduled' && Number(t.spawnDay) === today);
  if (list.length === 0) {
    todaysScheduleContainer.innerHTML = `<div class="text-center py-6 text-gray-500 col-span-3"><i data-feather="meh" class="w-12 h-12 mx-auto mb-4"></i><p>No bosses scheduled for today.</p></div>`;
    feather.replace();
    return;
  }
  list.forEach(t => {
    const div = document.createElement('div');
    div.className = 'today-schedule bg-gray-700 p-4 rounded-lg';
    div.innerHTML = `<h3 class="font-semibold">${escapeHtml(t.bossName)}</h3><p class="text-sm text-gray-400">Time: ${formatSpawnTime(t.spawnTime)} (window ${t.spawnWindow}m)</p>`;
    todaysScheduleContainer.appendChild(div);
  });
  feather.replace();
}

// -------------------- Per-timer loops (client-side) --------------------
function startPerTimerLoop(timerDoc) {
  const id = timerDoc.id;
  // clear previous
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
  if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  // immediate schedule of ten-min if we have nextSpawn
  scheduleTenMinuteWarning(timerDoc);

  // run every second to update display and check for auto-restart condition
  const updateFn = async () => {
    try {
      // fetch latest doc to ensure accurate values for decision-making
      const snap = await db.collection('timers').doc(id).get();
      if (!snap.exists) { clearPerTimerLoop(id); return; }
      const data = snap.data();

      // compute respawnMs and canonical nextSpawn for manual timers
      if (data.type === 'manual') {
        const respawnMs = Number(data.respawnMs || (Number(data.respawnHours || 0) * 60 * 60 * 1000));
        const nextSpawn = Number(data.nextSpawn || (data.lastKilled ? (data.lastKilled + respawnMs) : (nowMs() + respawnMs)));
        const timeLeft = Math.max(0, nextSpawn - nowMs());
        // update UI if present
        const timerEl = document.getElementById(`timer-${id}`);
        if (timerEl) timerEl.textContent = formatTimeFromMs(timeLeft);
        const progressEl = document.getElementById(`progress-${id}`);
        if (progressEl && respawnMs) {
          const elapsed = Math.max(0, nowMs() - (data.lastKilled || (nextSpawn - respawnMs)));
          const pct = Math.min(100, (elapsed / respawnMs) * 100);
          progressEl.style.width = `${pct}%`;
        }
        // attempt auto restart if conditions met
        if (data.autoRestart && data.autoRestart > 0) {
          const threshold = nextSpawn + (Number(data.autoRestart) * 60000);
          if (nowMs() > threshold) {
            // run transaction once to apply auto-restart; transaction checks lastKilled hasn't advanced already
            await attemptAutoRestartForTimer({ id, ...data });
          }
        }
      }
    } catch (err) {
      // avoid noisy logs
    }
  };

  updateFn();
  timerIntervals[id] = setInterval(updateFn, 1000);
}

function clearPerTimerLoop(id) {
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
  if (autoRestartTimeouts[id]) { clearTimeout(autoRestartTimeouts[id]); delete autoRestartTimeouts[id]; }
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }
}

// -------------------- Scheduled timer loops --------------------
function startScheduledTimerLoop(timerDoc) {
  const id = timerDoc.id;
  if (timerIntervals[id]) { clearInterval(timerIntervals[id]); delete timerIntervals[id]; }
  if (tenMinTimeouts[id]) { clearTimeout(tenMinTimeouts[id]); delete tenMinTimeouts[id]; }

  const getNextSpawnDate = () => {
    if (timerDoc.nextSpawn) return new Date(timerDoc.nextSpawn);
    // fallback compute
    const candidate = computeNextSpawnForScheduledDoc(timerDoc.spawnDay, timerDoc.spawnTime);
    return candidate;
  };

  let ns = getNextSpawnDate();
  if (ns) {
    scheduleTenMinuteWarning(timerDoc);
  }

  const updateFn = async () => {
    try {
      // refresh doc
      const snap = await db.collection('timers').doc(id).get();
      if (!snap.exists) { clearPerTimerLoop(id); return; }
      const data = snap.data();
      // re-evaluate next spawn
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

      // If spawn time is reached (inside window), mark spawn -> update lastSpawned and compute & set nextSpawn
      if (msLeft <= 0) {
        // Spawn event — record lastSpawned and compute next
        const nextNext = computeNextSpawnForScheduledDoc(data.spawnDay, data.spawnTime, new Date(nowMs() + 1000));
        await db.collection('timers').doc(id).update({
          lastSpawned: nowMs(),
          nextSpawn: nextNext ? nextNext.getTime() : null
        });
        logAdminAction('Scheduled Timer Spawn', `Boss: ${data.bossName}`);
        // schedule a new 10-min warning for the next occurrence (if user webhook exists)
        if (nextNext) scheduleTenMinuteWarning({ ...data, nextSpawn: nextNext.getTime() });
      }
    } catch (err) {
      // ignore transient errors
    }
  };

  updateFn();
  timerIntervals[id] = setInterval(updateFn, 1000);
}

// -------------------- Stop All implementation --------------------
/**
 * Admin triggers stop-all by setting system/control.stopAll = true
 * Clients respond by calling executeStopAllLocal which updates all manual timers lastKilled = now
 */
async function executeStopAllLocal() {
  try {
    const snap = await db.collection('timers').where('type', '==', 'manual').get();
    const batch = db.batch();
    snap.forEach(doc => {
      batch.update(doc.ref, { lastKilled: nowMs(), nextSpawn: nowMs() + Number(doc.data().respawnMs || (Number(doc.data().respawnHours || 0) * 60 * 60 * 1000)), missCount: 0 });
    });
    await batch.commit();
    logAdminAction('Stop All Executed', 'All manual timers set to now by stop-all');
  } catch (err) {
    console.warn('executeStopAllLocal failed', err);
  }
}

// -------------------- Control room send --------------------
/**
 * Sends selected boss names to the user's webhook (stored in localStorage)
 */
async function sendControlRoomMessage(bossNames = [], extra = '') {
  const webhook = localStorage.getItem('webhookUrl') || '';
  if (!webhook) { alert('No webhook configured'); return; }
  const user = window.userData || { ign: 'Unknown', guild: 'Unknown' };
  const payload = {
    embeds: [{
      title: 'Boss Notification',
      description: bossNames.map(b => `**${b}**`).join('\n'),
      footer: { text: `${user.ign} • ${user.guild}` },
      timestamp: new Date()
    }]
  };
  if (extra) payload.embeds[0].fields = [{ name: 'Message', value: extra }];
  try {
    await fetch(webhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    await logAdminAction('Control Room Send', `Sent: ${bossNames.join(', ')}`);
    alert('Message sent to Discord webhook.');
  } catch (err) {
    console.warn('sendControlRoomMessage failed', err);
    alert('Failed to send message.');
  }
}
window.sendControlRoomMessage = sendControlRoomMessage;

// -------------------- Admin UI exposed helpers --------------------
/**
 * Called by admin UI modal when saving a timer
 * This function expects the admin modal to have converted 12-hour inputs into spawnTime minutes-of-day.
 */
window.adminSaveTimerFromModal = async function() {
  try {
    // check which modal is visible (admin modal creates elements with these ids)
    const manualFormEl = document.getElementById('manualForm');
    const scheduledFormEl = document.getElementById('scheduledForm');
    if (manualFormEl && !manualFormEl.classList.contains('hidden')) {
      // manual
      const bossName = document.getElementById('manualBossName').value.trim();
      const respawnHoursRaw = document.getElementById('manualRespawn').value.trim();
      const autoRestartRaw = document.getElementById('manualAutoRestart').value.trim();
      const respawnHours = Number(respawnHoursRaw);
      const autoRestart = autoRestartRaw ? Number(autoRestartRaw) : null;
      if (!bossName || isNaN(respawnHours) || respawnHours <= 0) { alert('Please provide boss name and respawn hours (number)'); return; }
      // Create/Update manual timer (automatically sets lastKilled = now and nextSpawn)
      await createOrUpdateManualTimer(bossName, respawnHours, autoRestart, window.userData || null);
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
      await createOrUpdateScheduledTimer(bossName, spawnDay, spawnTimeMinutes, spawnWindow, window.userData || null);
      return;
    }
    alert('No modal detected or unknown modal state.');
  } catch (err) {
    console.error('adminSaveTimerFromModal error', err);
    alert('Failed to save timer: ' + (err.message || err));
  }
};

/**
 * Save admin webhook into system/config (admin password required)
 */
window.saveAdminWebhookToDb = async function(url) {
  try {
    const pw = prompt('Enter admin password to save admin webhook:');
    if (pw !== 'theworldo') { alert('Wrong password'); return; }
    await db.collection('system').doc('config').set({ adminWebhookUrl: url }, { merge: true });
    localStorage.setItem('adminWebhookUrl', url);
    adminWebhookFromDb = url;
    await logAdminAction('Admin webhook saved', `URL: ${url}`);
    alert('Admin webhook saved.');
  } catch (err) {
    console.warn('saveAdminWebhookToDb failed', err);
    alert('Failed to save admin webhook.');
  }
};

/**
 * Trigger stop all (admin password required). Sets system/control.stopAll = true
 */
window.triggerStopAllAdmin = async function() {
  try {
    const pw = prompt('Enter admin password to trigger Stop All:');
    if (pw !== 'theworldo') { alert('Wrong password'); return; }
    await db.collection('system').doc('control').set({ stopAll: true, lastStopped: nowMs() });
    await logAdminAction('Stop All triggered', 'Admin triggered Stop All.');
    alert('Stop All triggered.');
  } catch (err) {
    console.warn('triggerStopAllAdmin failed', err);
    alert('Failed to trigger Stop All.');
  }
};

// -------------------- Initialization --------------------
(async function init() {
  // load admin webhook from DB if available
  await loadAdminWebhookFromDb();

  // subscribe to data
  subscribeTimers();
  subscribeControlDoc();
  subscribeConfigDoc();

  // populate activity log container if present
  if (activityLogContainer) {
    db.collection('logs').orderBy('timestamp', 'desc').limit(100).onSnapshot(snapshot => {
      activityLogContainer.innerHTML = '';
      snapshot.forEach(doc => {
        const d = doc.data();
        const time = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toLocaleString() : '';
        const row = document.createElement('div');
        row.className = 'py-1 border-b border-gray-700';
        row.innerHTML = `<div class="text-xs text-gray-400">${time}</div><div>${escapeHtml(d.action)} — <span class="text-gray-300">${escapeHtml(d.details)}</span></div>`;
        activityLogContainer.appendChild(row);
      });
    }, err => { console.warn('logs subscription error', err); });
  }

  // show control room button if user has personal webhook
  if (localStorage.getItem('webhookUrl')) {
    document.querySelector('#controlRoomBtn')?.classList.remove('hidden');
  }

  // Admin visit log: send a visitor message if webhook set
  const adminWebhook = adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';
  if (adminWebhook) {
    const u = window.userData || { ign: 'Guest', guild: 'Unknown' };
    fetch(adminWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `👤 Visitor: ${u.ign} (${u.guild}) visited at ${new Date().toLocaleString()}` })
    }).catch(()=>{});
  }
})();

// -------------------- Exports for debugging (optional) --------------------
window.attemptAutoRestartForTimer = attemptAutoRestartForTimer;
window.createOrUpdateManualTimer = createOrUpdateManualTimer;
window.createOrUpdateScheduledTimer = createOrUpdateScheduledTimer;
window.logAdminAction = logAdminAction;