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


// -------------------- DOM Elements --------------------
const addManualTimerBtn = document.getElementById('addManualTimer');
const addScheduledTimerBtn = document.getElementById('addScheduledTimer');
const stopAllTimersBtn = document.getElementById('stopAllTimers');
const discordWebhookBtn = document.getElementById('discordWebhookBtn');
const controlRoomBtn = document.getElementById('controlRoomBtn');
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledTimersContainer = document.getElementById('scheduledTimersContainer');
const todaysScheduleContainer = document.getElementById('todaysScheduleContainer');

// -------------------- State --------------------
let userData = JSON.parse(localStorage.getItem('userData')) || null;
let timers = [];
let webhookUrl = localStorage.getItem('webhookUrl') || '';
let adminWebhookUrl = localStorage.getItem('adminWebhookUrl') || '';
let guildWebhooks = {}; // { guildId: [webhookUrl, ...] }

// -------------------- Init App --------------------
function initApp() {
    if (!userData) {
        document.querySelector('custom-welcome-modal').setAttribute('visible', 'true');
    } else {
        loadTimers();
    }
    if (webhookUrl) controlRoomBtn.classList.remove('hidden');
}

// -------------------- Load Timers --------------------
function loadTimers() {
    db.collection('timers').onSnapshot(snapshot => {
        timers = [];
        snapshot.forEach(doc => timers.push({ id: doc.id, ...doc.data() }));
        renderAll();
    });
}

// -------------------- Render All --------------------
function renderAll() {
    renderManualTimers();
    renderScheduledTimers();
    renderTodaysSchedule();
    renderControlRoom();
}

// -------------------- Manual Timers --------------------
function renderManualTimers() {
    manualTimersContainer.innerHTML = '';
    const manualTimers = timers.filter(t => t.type === 'manual');
    if (manualTimers.length === 0) {
        manualTimersContainer.innerHTML = `<div class="text-center py-8 text-gray-500">
            <i data-feather="clock" class="w-12 h-12 mx-auto mb-4"></i>
            <p>No manual timers yet.</p>
        </div>`;
        feather.replace();
        return;
    }
    manualTimers.forEach(timer => {
        const div = document.createElement('div');
        div.className = 'timer-card manual-timer bg-gray-700 p-4 rounded-lg';
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg">${timer.bossName}</h3>
                    <p class="text-sm text-gray-400">Respawn: ${timer.respawnTime} hrs</p>
                    <p class="text-sm text-gray-400">Last killed: ${timer.lastKilled ? new Date(timer.lastKilled).toLocaleString() : '--:--'}</p>
                    <p class="text-sm ${timer.missCount > 0 ? 'text-yellow-400':'text-gray-400'}">Misses: ${timer.missCount || 0}</p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-mono" id="timer-${timer.id}">--:--:--</div>
                    <div class="text-sm text-gray-400">Next spawn: <span id="next-${timer.id}">--:--</span></div>
                </div>
            </div>
            <div class="progress-bar mt-3">
                <div class="progress-fill bg-blue-500" id="progress-${timer.id}"></div>
            </div>
            <div class="flex justify-end space-x-2 mt-3">
                <button class="restart-timer bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-sm" data-id="${timer.id}"><i data-feather="refresh-cw" class="w-4 h-4"></i> Restart</button>
                <button class="reset-timer bg-gray-600 hover:bg-gray-700 px-3 py-1 rounded text-sm" data-id="${timer.id}"><i data-feather="rotate-ccw" class="w-4 h-4"></i> Reset</button>
                <button class="delete-timer bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm" data-id="${timer.id}"><i data-feather="trash-2" class="w-4 h-4"></i> Delete</button>
            </div>
        `;
        manualTimersContainer.appendChild(div);
        startManualTimer(timer);
    });
    feather.replace();
}

// -------------------- Scheduled Timers --------------------
function renderScheduledTimers() {
    scheduledTimersContainer.innerHTML = '';
    const scheduledTimers = timers.filter(t => t.type === 'scheduled');
    if (scheduledTimers.length === 0) {
        scheduledTimersContainer.innerHTML = `<div class="text-center py-8 text-gray-500">
            <i data-feather="calendar" class="w-12 h-12 mx-auto mb-4"></i>
            <p>No scheduled timers yet.</p>
        </div>`;
        feather.replace();
        return;
    }
    scheduledTimers.forEach(timer => {
        const div = document.createElement('div');
        div.className = 'timer-card scheduled-timer bg-gray-700 p-4 rounded-lg';
        const daysStr = timer.spawnDays.map(d => ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][d]).join(', ');
        div.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h3 class="font-semibold text-lg">${timer.bossName}</h3>
                    <p class="text-sm text-gray-400">Spawn days: ${daysStr}</p>
                    <p class="text-sm text-gray-400">Time: ${timer.spawnTime}</p>
                    <p class="text-sm text-gray-400">Window: ${timer.spawnWindow} mins</p>
                </div>
                <div class="text-right">
                    <div class="text-2xl font-mono" id="timer-${timer.id}">--:--:--</div>
                    <div class="text-sm text-gray-400">Next spawn: <span id="next-${timer.id}">--:--</span></div>
                </div>
            </div>
            <div class="progress-bar mt-3">
                <div class="progress-fill bg-purple-500" id="progress-${timer.id}"></div>
            </div>
            <div class="flex justify-end space-x-2 mt-3">
                <button class="delete-timer bg-red-600 hover:bg-red-700 px-3 py-1 rounded text-sm" data-id="${timer.id}">
                    <i data-feather="trash-2" class="w-4 h-4"></i> Delete
                </button>
            </div>
        `;
        scheduledTimersContainer.appendChild(div);
        startScheduledTimer(timer);
    });
    feather.replace();
}

// -------------------- Today’s Schedule --------------------
function renderTodaysSchedule() {
    todaysScheduleContainer.innerHTML = '';
    const now = new Date();
    const todayDay = now.getDay();
    const dueTimers = timers.filter(t => {
        if (t.type === 'manual') {
            const next = getNextSpawn(t);
            return next && next.toDateString() === now.toDateString();
        }
        if (t.type === 'scheduled') return t.spawnDays.includes(todayDay);
        return false;
    });
    if (!dueTimers.length) {
        todaysScheduleContainer.innerHTML = `<div class="text-center py-8 text-gray-500 col-span-3">
            <i data-feather="meh" class="w-12 h-12 mx-auto mb-4"></i>
            <p>No timers due today.</p>
        </div>`;
        feather.replace();
        return;
    }
    dueTimers.forEach(timer => {
        const nextSpawn = getNextSpawn(timer);
        const div = document.createElement('div');
        div.className = 'today-schedule bg-gray-700 p-4 rounded-lg shadow';
        div.innerHTML = `
            <div class="flex justify-between items-center">
                <p class="font-semibold">${timer.bossName}</p>
                <p class="text-sm text-gray-400">${nextSpawn ? nextSpawn.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '--:--'}</p>
                <p class="text-sm text-green-400">@everyone</p>
            </div>
        `;
        todaysScheduleContainer.appendChild(div);
    });
    feather.replace();
}

// -------------------- Stop All Timers --------------------
stopAllTimersBtn.addEventListener('click', async () => {
    const password = prompt("Enter password to stop all timers:");
    if (password !== "theworldo") return alert("Incorrect password");

    const batch = db.batch();
    timers.forEach(timer => {
        const timerRef = db.collection('timers').doc(timer.id);
        if (timer.type === 'manual') batch.update(timerRef, { lastKilled: null, missCount: 0 });
        if (timer.type === 'scheduled') batch.update(timerRef, { lastSpawned: null });
    });
    await batch.commit();
    alert("All timers stopped!");
});

// -------------------- Utility --------------------
function pad(num) { return num.toString().padStart(2,'0'); }

function getNextSpawn(timer) {
    if (timer.type === 'manual') {
        if (!timer.lastKilled) return null;
        const d = new Date(timer.lastKilled);
        d.setHours(d.getHours() + timer.respawnTime);
        return d;
    }
    if (timer.type === 'scheduled') {
        const now = new Date();
        const today = now.getDay();
        let hour = parseInt(timer.spawnTime.split(":")[0]);
        const minute = parseInt(timer.spawnTime.split(":")[1]);
        if (timer.spawnTime.toLowerCase().includes('pm') && hour !== 12) hour += 12;
        if (timer.spawnTime.toLowerCase().includes('am') && hour === 12) hour = 0;
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minute, 0);
        if (!timer.spawnDays.includes(today) || d < now) d.setDate(d.getDate() + 1);
        return d;
    }
}

// -------------------- Manual Timer Auto Restart --------------------
function startManualTimer(timer) {
    const timerEl = document.getElementById(`timer-${timer.id}`);
    const progressFill = document.getElementById(`progress-${timer.id}`);
    const nextSpawn = getNextSpawn(timer);
    if (!timerEl || !nextSpawn) return;

    let interval = setInterval(() => {
        let diff = (nextSpawn - new Date()) / 1000;
        if (diff <= 0) {
            if (timer.autoRestart) {
                timer.missCount = (timer.missCount || 0) + 1;
                const newEnd = new Date();
                newEnd.setHours(newEnd.getHours() + timer.respawnTime);
                timer.lastKilled = newEnd.toISOString();
                updateTimerFirestore(timer);
            } else clearInterval(interval);
            diff = 0;
        }
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = Math.floor(diff % 60);
        timerEl.textContent = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
        if(progressFill){
            const total = timer.respawnTime*3600;
            const percent = Math.min((1-diff/total)*100,100);
            progressFill.style.width = `${percent}%`;
        }
    },1000);
}

// -------------------- Firestore Update --------------------
function updateTimerFirestore(timer){
    db.collection('timers').doc(timer.id).update({ lastKilled: timer.lastKilled, missCount: timer.missCount });
}

// -------------------- Init --------------------
initApp();