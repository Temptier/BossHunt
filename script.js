// Firebase configuration (keep your real config here)
const firebaseConfig = {
    apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
    authDomain: "lordninetimer.firebaseapp.com",
    projectId: "lordninetimer",
    storageBucket: "lordninetimer.firebasestorage.app",
    messagingSenderId: "462837939255",
    appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// DOM Elements
const addManualTimerBtn = document.getElementById('addManualTimer');
const addScheduledTimerBtn = document.getElementById('addScheduledTimer');
const stopAllTimersBtn = document.getElementById('stopAllTimers');
const discordWebhookBtn = document.getElementById('discordWebhookBtn');
const controlRoomBtn = document.getElementById('controlRoomBtn');
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');

// State
let userData = JSON.parse(localStorage.getItem('userData')) || null;
let timers = []; // loaded from Firestore
let webhookUrl = localStorage.getItem('webhookUrl') || '';
let adminWebhookUrl = localStorage.getItem('adminWebhookUrl') || '';

// Timer intervals map so we can clear them when needed
const timerIntervals = {};

// Init
initApp();
reportVisitToAdmin();

// ---------- Initialization ----------
function initApp() {
    // show welcome modal for first time
    if (!userData) {
        const wm = document.querySelector('custom-welcome-modal');
        if (wm) wm.setAttribute('visible', 'true');
    } else {
        loadTimers();
    }

    // show control room if webhook exists
    if (webhookUrl) controlRoomBtn.classList.remove('hidden');

    // quick listeners that rely on script.js
    attachGlobalListeners();
}

// Report a visit to admin webhook if provided
function reportVisitToAdmin() {
    adminWebhookUrl = localStorage.getItem('adminWebhookUrl') || adminWebhookUrl;
    if (!adminWebhookUrl) return;
    const name = userData?.ign || 'Visitor';
    const guild = userData?.guild || 'Unknown';
    const msg = `Visitor: ${name} (${guild}) visited the app at ${new Date().toLocaleString()}`;
    safeSendWebhook(adminWebhookUrl, msg);
}

// ---------- Firestore load ----------
function loadTimers() {
    db.collection('timers').where('userId', '==', getUserId())
      .onSnapshot(snapshot => {
          const raw = [];
          snapshot.forEach(doc => raw.push({ id: doc.id, ...doc.data() }));
          // Merge scheduled timers with same bossName (combine spawnDays)
          const merged = mergeTimersByName(raw);
          timers = merged;
          renderTimers();
      });
}

function getUserId() {
    if (!userData) {
        userData = { userId: `guest-${Date.now()}`, ign: '', guild: '' };
        localStorage.setItem('userData', JSON.stringify(userData));
    }
    return userData.userId;
}

function mergeTimersByName(list) {
    // If same name and both scheduled, merge spawnDays and keep earliest nextSpawn/lastSpawned
    const map = {};
    list.forEach(t => {
        const key = `${t.type}:${(t.bossName || '').trim().toLowerCase()}`;
        if (!map[key]) map[key] = { ...t };
        else {
            const existing = map[key];
            if (t.type === 'scheduled' && existing.type === 'scheduled') {
                existing.spawnDays = Array.from(new Set([...(existing.spawnDays || []), ...(t.spawnDays || [])])).sort();
                existing.spawnWindow = Math.max(existing.spawnWindow || 0, t.spawnWindow || 0);
                // keep earliest lastSpawned
                existing.lastSpawned = existing.lastSpawned && t.lastSpawned ? (new Date(existing.lastSpawned) < new Date(t.lastSpawned) ? existing.lastSpawned : t.lastSpawned) : (existing.lastSpawned || t.lastSpawned);
            } else {
                // keep the latest one for manual timers
                map[key] = t;
            }
        }
    });
    return Object.values(map);
}

// ---------- Render ----------
function renderTimers() {
    renderManualTimers();
    renderScheduledTimers();
    renderTodaysSchedule();
    // notify admin of action (render viewed)
    sendAdminAction(`User viewed timers (${timers.length})`);
}

function renderManualTimers() {
    manualTimersContainer.innerHTML = '';
    const manual = timers.filter(t => t.type === 'manual');

    if (manual.length === 0) {
        manualTimersContainer.innerHTML = emptyCard('clock', 'No manual timers yet. Add one to get started!');
        feather.replace();
        return;
    }

    manual.forEach(timer => {
        const id = timer.id;
        // Ensure defaults
        timer.missCount = timer.missCount || 0;
        timer.lastKilled = timer.lastKilled || new Date().toISOString();

        const el = document.createElement('div');
        el.className = 'timer-card manual-timer bg-gray-700 p-4 rounded-lg';
        el.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg">${escapeHtml(timer.bossName)}</h3>
                    <p class="text-sm text-gray-400">Respawn: ${timer.respawnTime} minutes</p>
                    <p class="text-sm text-gray-400">Last killed: ${new Date(timer.lastKilled).toLocaleString()}</p>
                    <p class="text-sm ${timer.missCount > 0 ? 'text-yellow-400' : 'text-gray-400'}">Misses: <span id="miss-${id}">${timer.missCount}</span></p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
                    <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">--:--</span></div>
                </div>
            </div>
            <div class="progress-bar mt-3">
                <div class="progress-fill bg-blue-500" id="progress-${id}" style="width:0%"></div>
            </div>
            <div class="flex justify-end space-x-2 mt-3">
                <button class="restart-timer bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="refresh-cw" class="w-4 h-4"></i> Restart</button>
                <button class="reset-timer bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="rotate-ccw" class="w-4 h-4"></i> Reset</button>
                <button class="delete-timer bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="trash-2" class="w-4 h-4"></i> Delete</button>
            </div>
        `;
        manualTimersContainer.appendChild(el);

        // Attach event listeners
        el.querySelector('.restart-timer').addEventListener('click', () => {
            // restart = mark as killed now (start countdown)
            const now = new Date().toISOString();
            db.collection('timers').doc(id).update({ lastKilled: now, missCount: 0 });
            sendAdminAction(`Restarted manual timer: ${timer.bossName}`);
        });
        el.querySelector('.reset-timer').addEventListener('click', () => {
            // reset = set lastKilled to now but increment missCount if too late
            const now = new Date().toISOString();
            const tdoc = timers.find(t => t.id === id);
            const respawnMs = (tdoc.respawnTime || 0) * 60000;
            const elapsed = Date.now() - new Date(tdoc.lastKilled).getTime();
            // if not restarted within respawnTime + 1 minute -> count as miss
            const extra = (tdoc.autoResetAfterMinutes || 0) * 60000;
            let newMiss = (tdoc.missCount || 0);
            if (elapsed > respawnMs + (extra || 0)) newMiss++;
            db.collection('timers').doc(id).update({ lastKilled: now, missCount: newMiss });
            sendAdminAction(`Reset manual timer: ${timer.bossName} (misses: ${newMiss})`);
        });
        el.querySelector('.delete-timer').addEventListener('click', async () => {
            if (!confirm(`Delete ${timer.bossName}?`)) return;
            await db.collection('timers').doc(id).delete();
            sendAdminAction(`Deleted timer: ${timer.bossName}`);
        });

        // Start timer visuals
        startTimer(timer);
    });

    feather.replace();
}

function renderScheduledTimers() {
    scheduledTimersContainer.innerHTML = '';
    const scheduled = timers.filter(t => t.type === 'scheduled');
    if (scheduled.length === 0) {
        scheduledTimersContainer.innerHTML = emptyCard('calendar', 'No scheduled timers yet. Add one to get started!');
        feather.replace();
        return;
    }

    scheduled.forEach(timer => {
        const id = timer.id;
        const el = document.createElement('div');
        el.className = 'timer-card scheduled-timer bg-gray-700 p-4 rounded-lg';
        el.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg">${escapeHtml(timer.bossName)}</h3>
                    <p class="text-sm text-gray-400">Spawn days: ${ (timer.spawnDays||[]).join(', ') }</p>
                    <p class="text-sm text-gray-400">Window: ${timer.spawnWindow} minutes</p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-mono" id="timer-${id}">--:--:--</div>
                    <div class="text-sm text-gray-400">Next spawn: <span id="next-${id}">--:--</span></div>
                </div>
            </div>
            <div class="progress-bar mt-3">
                <div class="progress-fill bg-purple-500" id="progress-${id}" style="width:0%"></div>
            </div>
            <div class="flex justify-end space-x-2 mt-3">
                <button class="delete-timer bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm" data-id="${id}"><i data-feather="trash-2" class="w-4 h-4"></i> Delete</button>
            </div>
        `;
        scheduledTimersContainer.appendChild(el);
        el.querySelector('.delete-timer').addEventListener('click', async () => {
            if (!confirm(`Delete ${timer.bossName}?`)) return;
            await db.collection('timers').doc(id).delete();
            sendAdminAction(`Deleted scheduled timer: ${timer.bossName}`);
        });

        startScheduledTimer(timer);
    });

    feather.replace();
}

function renderTodaysSchedule() {
    todaysScheduleContainer.innerHTML = '';
    const today = new Date().getDay();
    const todayTimers = timers.filter(t => t.type === 'scheduled' && (t.spawnDays || []).includes(today));

    if (todayTimers.length === 0) {
        todaysScheduleContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500 col-span-3">
                <i data-feather="meh" class="w-12 h-12 mx-auto mb-4"></i>
                <p>No bosses scheduled for today.</p>
            </div>
        `;
        feather.replace();
        return;
    }

    todayTimers.forEach(timer => {
        const div = document.createElement('div');
        div.className = 'today-schedule bg-gray-700 p-4 rounded-lg';
        div.innerHTML = `
            <h3 class="font-semibold text-lg">${escapeHtml(timer.bossName)}</h3>
            <p class="text-sm text-gray-400">Spawn window: ${timer.spawnWindow} minutes</p>
        `;
        todaysScheduleContainer.appendChild(div);
    });

    feather.replace();
}

// ---------- Timer mechanisms ----------
function startTimer(timer) {
    const id = timer.id;
    clearIntervalIfExists(id);

    const respawnMs = (timer.respawnTime || 0) * 60000;
    const lastKilled = new Date(timer.lastKilled).getTime();
    const elapsed = Date.now() - lastKilled;
    const remaining = Math.max(0, respawnMs - elapsed);
    const initialProgress = Math.min(100, (elapsed / respawnMs) * 100);
    setProgress(id, initialProgress);
    updateTimerDisplay(id, remaining);
    const nextEl = document.getElementById(`next-${id}`);
    if (nextEl) nextEl.textContent = new Date(lastKilled + respawnMs).toLocaleTimeString();

    const interval = setInterval(() => {
        const timeLeft = Math.max(0, lastKilled + respawnMs - Date.now());
        updateTimerDisplay(id, timeLeft);
        const fill = Math.min(100, ((respawnMs - timeLeft) / respawnMs) * 100);
        setProgress(id, fill);

        // If timer finishes
        if (timeLeft <= 0) {
            clearIntervalIfExists(id);
            // send webhook and optionally auto-reset after X minutes (if configured)
            sendMessageForTimer(timer, `${timer.bossName} is respawning now!`);
        }
    }, 1000);

    timerIntervals[id] = interval;
}

function startScheduledTimer(timer) {
    const id = timer.id;
    // Clear existing
    clearIntervalIfExists(id);

    // Decide next spawn time:
    // If timer.nextSpawn exists and is a valid ISO, use it. Otherwise compute from spawnDays + spawnWindow.
    let nextSpawn = timer.nextSpawn ? new Date(timer.nextSpawn) : null;
    if (!nextSpawn || isNaN(nextSpawn.getTime())) {
        nextSpawn = computeNextSpawnForScheduled(timer);
    }
    if (!nextSpawn) return;

    // show next spawn
    const nextEl = document.getElementById(`next-${id}`);
    if (nextEl) nextEl.textContent = nextSpawn.toLocaleString();

    // Show countdown
    const updateFn = () => {
        const msLeft = Math.max(0, nextSpawn.getTime() - Date.now());
        updateTimerDisplay(id, msLeft);
        const total = (timer.spawnWindow || 0) * 60000 || 1;
        const progress = Math.min(100, ((total - msLeft) / total) * 100);
        setProgress(id, progress);

        // If window passed, compute next spawn
        if (msLeft <= 0) {
            // notify
            sendMessageForTimer(timer, `Scheduled spawn: ${timer.bossName} is spawning now!`);
            // set next spawn to next available
            nextSpawn = computeNextSpawnForScheduled(timer, new Date(Date.now() + 1000));
            // schedule 10-min warning when nextSpawn - 10min exists
            scheduleTenMinuteWarning(timer, nextSpawn);
            if (nextEl) nextEl.textContent = nextSpawn ? nextSpawn.toLocaleString() : '--:--';
        }
    };

    // run immediately and every second
    updateFn();
    const interval = setInterval(updateFn, 1000);
    timerIntervals[id] = interval;

    // schedule 10-min warning
    scheduleTenMinuteWarning(timer, nextSpawn);
}

function computeNextSpawnForScheduled(timer, afterDate = new Date()) {
    // timer.spawnDays: [0..6] where 0=Sunday, same as JS getDay
    // timer.spawnWindow: minutes (ignored for exact time; we treat spawn time as 'afterDate' or midnight of day)
    const days = timer.spawnDays || [];
    if (!days.length) return null;

    const start = new Date(afterDate);
    // Find the next date whose day is in spawnDays
    for (let add = 0; add < 14; add++) {
        const candidate = new Date(start.getFullYear(), start.getMonth(), start.getDate() + add, 12, 0, 0); // midday
        if (days.includes(candidate.getDay())) {
            // We'll set spawn time to midday of that day (or could be enhanced to use specific time)
            return candidate;
        }
    }
    return null;
}

function scheduleTenMinuteWarning(timer, nextSpawnDate) {
    // clear previous scheduled warnings for this timer by saving timeout id on timer object
    if (!nextSpawnDate) return;
    const warnAt = nextSpawnDate.getTime() - (10 * 60000);
    const msUntil = warnAt - Date.now();
    if (msUntil <= 0) return; // too late
    const id = timer.id;
    // use setTimeout; store it so we can clear if necessary
    if (timer._tenMinTimeout) clearTimeout(timer._tenMinTimeout);
    timer._tenMinTimeout = setTimeout(() => {
        sendMessageForTimer(timer, `10-minute warning: ${timer.bossName} will spawn in 10 minutes.`);
    }, msUntil);
}

// ---------- Helpers ----------
function updateTimerDisplay(id, ms) {
    const el = document.getElementById(`timer-${id}`);
    if (!el) return;
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    el.textContent = `${hours}:${minutes}:${seconds}`;
}

function setProgress(id, percent) {
    const el = document.getElementById(`progress-${id}`);
    if (el) el.style.width = `${percent}%`;
}

function clearIntervalIfExists(id) {
    if (timerIntervals[id]) {
        clearInterval(timerIntervals[id]);
        delete timerIntervals[id];
    }
}

function emptyCard(icon, text) {
    return `
        <div class="text-center py-8 text-gray-500">
            <i data-feather="${icon}" class="w-12 h-12 mx-auto mb-4"></i>
            <p>${text}</p>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"'`=\/]/g, s => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','/':'&#x2F;','`':'&#x60;','=':'&#x3D;'
    })[s]);
}

// ---------- Webhook utilities ----------
function safeSendWebhook(url, message) {
    if (!url) return;
    fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
    }).catch(err => console.warn('Webhook failed', err));
}

function sendWebhookMessage(message) {
    // send to user webhook and admin webhook if present
    const urls = [];
    if (webhookUrl) urls.push(webhookUrl);
    const admin = localStorage.getItem('adminWebhookUrl') || adminWebhookUrl;
    if (admin) urls.push(admin);
    urls.forEach(u => safeSendWebhook(u, message));
}

// wrapper that records action to admin webhook as well
function sendMessageForTimer(timer, message) {
    sendWebhookMessage(message);
    // also update Firestore lastSpawned / lastKilled depending on type
    if (timer.type === 'manual') {
        // we don't auto-update lastKilled here; user must restart manually to mark as killed.
    } else if (timer.type === 'scheduled') {
        // update lastSpawned and compute nextSpawn
        const now = new Date().toISOString();
        db.collection('timers').doc(timer.id).update({ lastSpawned: now, nextSpawn: computeNextSpawnForScheduled(timer)?.toISOString() || null }).catch(()=>{});
    }
    // Admin activity
    sendAdminAction(`Timer event: ${timer.bossName} -> ${message}`);
}

function sendAdminAction(text) {
    const admin = localStorage.getItem('adminWebhookUrl') || adminWebhookUrl;
    if (admin) safeSendWebhook(admin, `ADMIN LOG: ${text}`);
}

// ---------- Event listeners & UI interactions ----------
function attachGlobalListeners() {
    // Stop all (open modal)
    if (stopAllTimersBtn) {
        stopAllTimersBtn.addEventListener('click', () => {
            const wm = document.querySelector('custom-stop-all-modal');
            if (wm) wm.setAttribute('visible', 'true');
        });
    }

    if (discordWebhookBtn) {
        discordWebhookBtn.addEventListener('click', () => {
            const wm = document.querySelector('custom-discord-webhook-modal');
            if (wm) wm.setAttribute('visible', 'true');
        });
    }

    if (controlRoomBtn) {
        controlRoomBtn.addEventListener('click', () => {
            const wm = document.querySelector('custom-control-room-modal');
            if (wm) {
                // pass current timers into modal (it will read from Firestore as well if needed)
                wm.timers = timers;
                wm.setAttribute('visible', 'true');
            }
        });
    }

    // Add manual
    if (addManualTimerBtn) addManualTimerBtn.addEventListener('click', () => {
        const wm = document.querySelector('custom-add-boss-modal');
        if (wm) {
            wm.mode = 'manual';
            wm.setAttribute('visible', 'true');
        }
    });

    // Add scheduled
    if (addScheduledTimerBtn) addScheduledTimerBtn.addEventListener('click', () => {
        const wm = document.querySelector('custom-add-boss-modal');
        if (wm) {
            wm.mode = 'scheduled';
            wm.setAttribute('visible', 'true');
        }
    });

    // listen for welcome save (custom event)
    window.addEventListener('welcome:saved', (e) => {
        userData = e.detail;
        localStorage.setItem('userData', JSON.stringify(userData));
        loadTimers();
        sendAdminAction(`New user data saved: ${userData.ign} / ${userData.guild}`);
    });

    // listen for webhook saved
    window.addEventListener('webhook:saved', (e) => {
        webhookUrl = e.detail;
        localStorage.setItem('webhookUrl', webhookUrl);
        controlRoomBtn.classList.remove('hidden');
        sendAdminAction(`User saved webhook`);
    });

    // listen for admin webhook saved
    window.addEventListener('adminwebhook:saved', (e) => {
        adminWebhookUrl = e.detail;
        localStorage.setItem('adminWebhookUrl', adminWebhookUrl);
        sendAdminAction(`Admin webhook saved`);
    });

    // stop all confirmed (custom event)
    window.addEventListener('stopall:confirmed', (e) => {
        // send stop messages and clear visual timers
        timers.forEach(t => sendMessageForTimer(t, `Timer stopped by admin.`));
        // clear intervals
        Object.keys(timerIntervals).forEach(k => clearIntervalIfExists(k));
        alert('All timers stopped.');
    });
}