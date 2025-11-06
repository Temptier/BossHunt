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


// ========= Global state =========
window.userData = JSON.parse(localStorage.getItem('userData') || 'null'); // available globally
let timers = []; // current timers array
let adminWebhookFromDb = null;

// DOM targets (if present)
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');
const activityLogContainer = document.getElementById('activityLogContainer');

// ========= Utilities =========
function normalizeId(name) {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, '-');
}
function escapeHtml(s){ if(!s) return ''; return String(s).replace(/[&<>"'`=\/]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'}[c])); }
function formatSpawnTime(totalMinutes){
  if (typeof totalMinutes === 'undefined' || totalMinutes === null) return '--:--';
  const h24 = Math.floor(totalMinutes/60);
  const m = totalMinutes % 60;
  const ampm = h24>=12 ? 'PM' : 'AM';
  const h12 = h24%12 || 12;
  return `${h12}:${String(m).padStart(2,'0')} ${ampm}`;
}

// ========= Admin webhook helpers =========
async function loadAdminWebhookFromDb() {
  try {
    const doc = await db.collection('system').doc('config').get();
    if (doc.exists) adminWebhookFromDb = doc.data().adminWebhookUrl || null;
    return adminWebhookFromDb;
  } catch (e) { return null; }
}
window.getAdminWebhookUrl = async () => adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '';

// send admin log to webhook + write to logs collection
async function logAdminAction(action, details = '') {
  try {
    // write log entry
    const entry = {
      action,
      details,
      user: (window.userData && window.userData.ign) || 'Unknown',
      guild: (window.userData && window.userData.guild) || 'Unknown',
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };
    db.collection('logs').add(entry).catch(()=>{});

    // send to admin webhook if available
    const adminWebhook = (adminWebhookFromDb || localStorage.getItem('adminWebhookUrl') || '');
    if (adminWebhook) {
      fetch(adminWebhook, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ content: `⚙️ **${action}** by ${(window.userData && window.userData.ign) || 'Unknown'} (${(window.userData && window.userData.guild) || 'Unknown'})\n${details}` })
      }).catch(()=>{});
    }
  } catch (err) {
    console.warn('logAdminAction error', err);
  }
}

// ========= Real-time listeners =========
function subscribeTimers() {
  db.collection('timers').orderBy('createdAt','asc').onSnapshot(snapshot => {
    const arr = [];
    snapshot.forEach(d => arr.push({ id: d.id, ...d.data() }));
    timers = arr;
    // render in index.html if containers exist
    if (typeof renderAll === 'function') renderAll();
  });
}

// Stop All listener
function subscribeControl() {
  db.collection('system').doc('control').onSnapshot(doc => {
    const data = doc.data();
    if (data && data.stopAll) {
      // client-side response: set all manual timers lastKilled=now, missCount=0
      executeStopAllLocal().catch(()=>{});
      // reset flag (admin should do this but clear to be safe)
      db.collection('system').doc('control').update({ stopAll: false }).catch(()=>{});
    }
  });
}

// activity log UI (admin page)
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

// ========= Admin actions (called from admin.html) =========

// Add / Update timer from admin modal
window.adminSaveTimerFromModal = async function() {
  try {
    // detect which form visible
    const manualVisible = !document.getElementById('manualForm').classList.contains('hidden');
    if (manualVisible) {
      const bossName = document.getElementById('manualBossName').value.trim();
      const respawn = parseInt(document.getElementById('manualRespawn').value, 10);
      const autoRestartRaw = document.getElementById('manualAutoRestart').value.trim();
      const autoRestart = autoRestartRaw ? parseInt(autoRestartRaw, 10) : null;
      if (!bossName || isNaN(respawn) || respawn <= 0) { alert('Please fill boss name and valid respawn minutes'); return; }

      const docId = normalizeId(bossName);
      await db.collection('timers').doc(docId).set({
        type: 'manual',
        bossName,
        respawnTime: respawn,
        autoRestart: autoRestart || null,
        lastKilled: Date.now(),
        missCount: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await logAdminAction('Add/Update Manual Timer', `Boss: ${bossName}, Respawn: ${respawn} min, AutoRestart: ${autoRestart||'off'}`);
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

    if (!bossName || isNaN(hour) || isNaN(minute) || isNaN(spawnWindow)) { alert('Please fill scheduled fields correctly'); return; }
    if (ampm === 'PM' && hour < 12) hour += 12;
    if (ampm === 'AM' && hour === 12) hour = 0;
    const spawnTime = hour * 60 + minute; // minutes of day

    const docId = normalizeId(bossName);
    await db.collection('timers').doc(docId).set({
      type: 'scheduled',
      bossName,
      spawnDay,
      spawnTime,
      spawnWindow,
      lastSpawned: null,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    await logAdminAction('Add/Update Scheduled Timer', `Boss: ${bossName}, Day: ${spawnDay}, Time: ${hour}:${minute} (minOfDay=${spawnTime}), Window: ${spawnWindow}min`);
    alert('Scheduled timer added/updated.');
  } catch (err) {
    console.error('adminSaveTimerFromModal', err);
    alert('Error saving timer: ' + (err.message || err));
  }
};

// Save admin webhook to DB (requires admin password)
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

// Stop All (admin)
window.triggerStopAllAdmin = async function() {
  try {
    const pw = prompt('Confirm admin password to Trigger Stop All:');
    if (pw !== 'theworldo') { alert('Wrong password'); return; }
    await db.collection('system').doc('control').set({ stopAll: true, lastStopped: Date.now() });
    await logAdminAction('Stop All triggered', 'Admin executed Stop All');
    alert('Stop All triggered (clients will respond).');
  } catch (e) { console.error(e); alert('Failed to trigger Stop All'); }
};

// Execute stop all on client (called when control doc indicates stopAll)
async function executeStopAllLocal() {
  try {
    const snap = await db.collection('timers').where('type','==','manual').get();
    const batch = db.batch();
    snap.forEach(doc => {
      batch.update(doc.ref, { lastKilled: Date.now(), missCount: 0 });
    });
    await batch.commit();
    // log locally as well
    console.log('All manual timers reset locally.');
  } catch (e) {
    console.warn('executeStopAllLocal failed', e);
  }
}

// ========= Initial subscription setup =========
(async function initPhase1() {
  // load admin webhook config
  await loadAdminWebhookFromDb();

  // subscribe timers
  subscribeTimers();

  // subscribe control doc
  subscribeControl();

  // subscribe logs if admin page present
  subscribeLogs();

  // subscribe system config to keep adminWebhook up-to-date
  db.collection('system').doc('config').onSnapshot(doc => {
    if (!doc.exists) return;
    adminWebhookFromDb = doc.data().adminWebhookUrl || adminWebhookFromDb;
  });

  // Subscribe to logs (for admin UI)
  subscribeLogs();
})();

// ========= Basic rendering helpers (optional, index.html already has rich renderer) =========
// If index.html contains the containers we populate simple cards to show timers immediately.
// These functions intentionally keep UI light — the app's main renderer can be replaced by your richer versions.

window.renderAll = function() {
  // manual
  if (manualTimersContainer) {
    manualTimersContainer.innerHTML = '';
    const manual = timers.filter(t => t.type === 'manual');
    if (manual.length === 0) {
      manualTimersContainer.innerHTML = `<div class="text-gray-400 py-6">No manual timers yet.</div>`;
    } else {
      manual.forEach(t => {
        const id = t.id;
        const lastKilled = t.lastKilled || Date.now();
        const respawnMs = (t.respawnTime||0)*60000;
        const elapsed = Date.now() - lastKilled;
        const remaining = Math.max(0, respawnMs - elapsed);
        const m = Math.floor(remaining/60000);
        const s = Math.floor((remaining%60000)/1000);
        const div = document.createElement('div');
        div.className = 'bg-gray-700 p-3 rounded mb-3';
        div.innerHTML = `<div class="flex justify-between"><div><b>${escapeHtml(t.bossName)}</b><div class="text-xs text-gray-400">Respawn ${t.respawnTime}m</div></div><div class="text-sm">${m}m ${s}s</div></div>`;
        manualTimersContainer.appendChild(div);
      });
    }
  }

  // scheduled
  if (scheduledTimersContainer) {
    scheduledTimersContainer.innerHTML = '';
    const scheduled = timers.filter(t => t.type === 'scheduled');
    if (scheduled.length === 0) {
      scheduledTimersContainer.innerHTML = `<div class="text-gray-400 py-6">No scheduled timers yet.</div>`;
    } else {
      scheduled.forEach(t => {
        const next = computeNextSpawnExact(t);
        const remainingMs = next ? Math.max(0, next.getTime() - Date.now()) : 0;
        const h = Math.floor(remainingMs/3600000);
        const m = Math.floor((remainingMs%3600000)/60000);
        const div = document.createElement('div');
        div.className = 'bg-gray-700 p-3 rounded mb-3';
        div.innerHTML = `<div class="flex justify-between"><div><b>${escapeHtml(t.bossName)}</b><div class="text-xs text-gray-400">Spawn ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][t.spawnDay]} @ ${formatSpawnTime(t.spawnTime)}</div></div><div class="text-sm">${h}h ${m}m</div></div>`;
        scheduledTimersContainer.appendChild(div);
      });
    }
  }

  // today's schedule
  if (todaysScheduleContainer) {
    todaysScheduleContainer.innerHTML = '';
    const today = new Date().getDay();
    const todayList = timers.filter(t => t.type === 'scheduled' && t.spawnDay === today);
    if (!todayList.length) {
      todaysScheduleContainer.innerHTML = `<div class="text-gray-400 py-6">No bosses scheduled for today.</div>`;
    } else {
      todayList.forEach(t => {
        const div = document.createElement('div');
        div.className = 'bg-gray-700 p-3 rounded mb-3';
        div.innerHTML = `<div><b>${escapeHtml(t.bossName)}</b><div class="text-xs text-gray-400">${formatSpawnTime(t.spawnTime)} (window ${t.spawnWindow}m)</div></div>`;
        todaysScheduleContainer.appendChild(div);
      });
    }
  }
};

// ======= Helper: compute next spawn for scheduled timers (exact spawnDay + spawnTime minutes-of-day) =======
function computeNextSpawnExact(timer, afterDate = new Date()) {
  if (!timer || typeof timer.spawnDay === 'undefined' || typeof timer.spawnTime === 'undefined') return null;
  const targetDay = timer.spawnDay; // 0..6
  const spawnMinutes = timer.spawnTime; // 0..1439
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