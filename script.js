// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDummyKeyDummyKeyDummyKeyDummyKey",
    authDomain: "boss-timer-app.firebaseapp.com",
    projectId: "boss-timer-app",
    storageBucket: "boss-timer-app.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:dummyappiddummyappid"
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
let userData = JSON.parse(localStorage.getItem('userData')) || { userId: "guest-user" };
let timers = [];
let webhookUrl = localStorage.getItem('webhookUrl') || '';
let adminWebhookUrl = localStorage.getItem('adminWebhookUrl') || '';

initApp();

// Initialize app
function initApp() {
    loadTimers();

    // Check if webhook exists to show control room button
    if (webhookUrl) {
        controlRoomBtn.classList.remove('hidden');
    }
}

// ---------------------- Load & Render Timers ---------------------- //
function loadTimers() {
    db.collection('timers').where('userId', '==', userData.userId)
        .onSnapshot((snapshot) => {
            timers = [];
            snapshot.forEach(doc => {
                timers.push({ id: doc.id, ...doc.data() });
            });
            renderTimers();
        });
}

function renderTimers() {
    renderManualTimers();
    renderScheduledTimers();
    renderTodaysSchedule();
}

function renderManualTimers() {
    manualTimersContainer.innerHTML = '';
    const manualTimers = timers.filter(t => t.type === 'manual');

    if (manualTimers.length === 0) {
        manualTimersContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i data-feather="clock" class="w-12 h-12 mx-auto mb-4"></i>
                <p>No manual timers yet. Add one to get started!</p>
            </div>
        `;
        feather.replace();
        return;
    }

    manualTimers.forEach(timer => {
        const timerElement = document.createElement('div');
        timerElement.className = 'timer-card manual-timer bg-gray-700 p-4 rounded-lg';
        timerElement.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg">${timer.bossName}</h3>
                    <p class="text-sm text-gray-400">Respawn: ${timer.respawnTime} minutes</p>
                    <p class="text-sm text-gray-400">Last killed: ${new Date(timer.lastKilled).toLocaleString()}</p>
                    <p class="text-sm ${timer.missCount > 0 ? 'text-yellow-400' : 'text-gray-400'}">Misses: ${timer.missCount}</p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-mono" id="timer-${timer.id}">--:--:--</div>
                    <div class="text-sm text-gray-400">Next spawn: <span id="next-${timer.id}">--:--</span></div>
                </div>
            </div>
            <div class="progress-bar mt-3">
                <div class="progress-fill bg-blue-500" id="progress-${timer.id}" style="width:0%"></div>
            </div>
            <div class="flex justify-end space-x-2 mt-3">
                <button class="restart-timer bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm" data-id="${timer.id}">
                    <i data-feather="refresh-cw" class="w-4 h-4"></i> Restart
                </button>
                <button class="reset-timer bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm" data-id="${timer.id}">
                    <i data-feather="rotate-ccw" class="w-4 h-4"></i> Reset
                </button>
                <button class="delete-timer bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm" data-id="${timer.id}">
                    <i data-feather="trash-2" class="w-4 h-4"></i> Delete
                </button>
            </div>
        `;
        manualTimersContainer.appendChild(timerElement);
        startTimer(timer);
    });
    feather.replace();
}

function renderScheduledTimers() {
    scheduledTimersContainer.innerHTML = '';
    const scheduledTimers = timers.filter(t => t.type === 'scheduled');

    if (scheduledTimers.length === 0) {
        scheduledTimersContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i data-feather="calendar" class="w-12 h-12 mx-auto mb-4"></i>
                <p>No scheduled timers yet. Add one to get started!</p>
            </div>
        `;
        feather.replace();
        return;
    }

    scheduledTimers.forEach(timer => {
        const timerElement = document.createElement('div');
        timerElement.className = 'timer-card scheduled-timer bg-gray-700 p-4 rounded-lg';
        timerElement.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg">${timer.bossName}</h3>
                    <p class="text-sm text-gray-400">Spawn days: ${timer.spawnDays.join(', ')}</p>
                    <p class="text-sm text-gray-400">Window: ${timer.spawnWindow} minutes</p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-mono" id="timer-${timer.id}">--:--:--</div>
                </div>
            </div>
        `;
        scheduledTimersContainer.appendChild(timerElement);
        startScheduledTimer(timer);
    });
    feather.replace();
}

function renderTodaysSchedule() {
    todaysScheduleContainer.innerHTML = '';
    const today = new Date().getDay();
    const todayTimers = timers.filter(t => t.type === 'scheduled' && t.spawnDays.includes(today));

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
            <h3 class="font-semibold text-lg">${timer.bossName}</h3>
            <p class="text-sm text-gray-400">Spawn window: ${timer.spawnWindow} minutes</p>
        `;
        todaysScheduleContainer.appendChild(div);
    });
    feather.replace();
}

// ---------------------- Timer Logic ---------------------- //
function startTimer(timer) {
    const respawnMs = timer.respawnTime * 60000;
    const elapsed = Date.now() - new Date(timer.lastKilled).getTime();
    const remaining = Math.max(0, respawnMs - elapsed);
    const progress = Math.min(100, (elapsed / respawnMs) * 100);

    document.getElementById(`progress-${timer.id}`).style.width = `${progress}%`;
    updateTimerDisplay(timer.id, remaining);

    const interval = setInterval(() => {
        const timeLeft = Math.max(0, new Date(timer.lastKilled).getTime() + respawnMs - Date.now());
        updateTimerDisplay(timer.id, timeLeft);

        const fill = Math.min(100, ((respawnMs - timeLeft) / respawnMs) * 100);
        document.getElementById(`progress-${timer.id}`).style.width = `${fill}%`;

        if (timeLeft <= 0) {
            clearInterval(interval);
            sendWebhookMessage(`${timer.bossName} is respawning now!`);
        }
    }, 1000);
}

function startScheduledTimer(timer) {
    // simplified scheduled timer: triggers webhook at approximate time
    const nextSpawn = new Date(timer.nextSpawn || Date.now());
    const msUntil = nextSpawn - Date.now();

    if (msUntil > 0) {
        setTimeout(() => {
            sendWebhookMessage(`Scheduled spawn: ${timer.bossName} is spawning!`);
        }, msUntil);
    }
}

function updateTimerDisplay(id, ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    document.getElementById(`timer-${id}`).textContent = `${hours}:${minutes}:${seconds}`;
}

// ---------------------- Webhook Logic ---------------------- //
function sendWebhookMessage(message) {
    if (!webhookUrl && !adminWebhookUrl) return;

    const urls = [webhookUrl, adminWebhookUrl].filter(Boolean);
    urls.forEach(url => {
        fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: message })
        });
    });
}

// ---------------------- Event Listeners ---------------------- //
if (stopAllTimersBtn) {
    stopAllTimersBtn.addEventListener('click', () => {
        timers.forEach(t => sendWebhookMessage(`Timer stopped: ${t.bossName}`));
        alert('All timers stopped.');
    });
}

if (discordWebhookBtn) {
    discordWebhookBtn.addEventListener('click', () => {
        const url = prompt("Enter your Discord webhook URL:", webhookUrl || "");
        if (url) {
            webhookUrl = url;
            localStorage.setItem('webhookUrl', url);
            alert('Webhook saved successfully!');
        }
    });
}

if (addManualTimerBtn) {
    addManualTimerBtn.addEventListener('click', async () => {
        const bossName = prompt("Boss name?");
        const respawn = parseInt(prompt("Respawn time (minutes)?"));
        if (!bossName || isNaN(respawn)) return;

        await db.collection('timers').add({
            userId: userData.userId,
            type: 'manual',
            bossName: bossName,
            respawnTime: respawn,
            lastKilled: new Date().toISOString(),
            missCount: 0
        });
    });
}

if (addScheduledTimerBtn) {
    addScheduledTimerBtn.addEventListener('click', async () => {
        const bossName = prompt("Boss name?");
        const window = parseInt(prompt("Spawn window (minutes)?"));
        if (!bossName || isNaN(window)) return;

        await db.collection('timers').add({
            userId: userData.userId,
            type: 'scheduled',
            bossName: bossName,
            spawnDays: [new Date().getDay()],
            spawnWindow: window,
            lastSpawned: new Date().toISOString()
        });
    });
}