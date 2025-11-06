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
let userData = JSON.parse(localStorage.getItem('userData')) || null;
let timers = [];
let webhookUrl = localStorage.getItem('webhookUrl') || '';
let adminWebhookUrl = localStorage.getItem('adminWebhookUrl') || '';

// Initialize the app
function initApp() {
    if (!userData) {
        document.querySelector('custom-welcome-modal').setAttribute('visible', 'true');
    } else {
        loadTimers();
    }

    // Check if webhook exists to show control room button
    if (webhookUrl) {
        controlRoomBtn.classList.remove('hidden');
    }
}

// Load timers from Firestore
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

// Render all timers
function renderTimers() {
    renderManualTimers();
    renderScheduledTimers();
    renderTodaysSchedule();
}

// Render manual timers
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
                <div class="progress-fill bg-blue-500" id="progress-${timer.id}"></div>
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

// Render scheduled timers
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
                    <p class="text-sm text-gray-400">Spawn day: ${timer.spawnDays.join(', ')}</p>
                    <p class="text-sm text-gray-400">Window: ${timer.spawnWindow} minutes</p>
                    <p class="text-sm text-gray-400">Last spawned: ${new Date(timer.lastSpawned).toLocaleString()}</p>
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
        scheduledTimersContainer.appendChild(timerElement);
        startScheduledTimer(timer);
    });
    feather.replace();
}

// Render today's schedule
function renderTodaysSchedule() {
    todaysScheduleContainer.innerHTML = '';
    const today = new Date().getDay();
    const todayTimers = timers.filter(t => 
        t.type === 'scheduled' && t.spawnDays.includes(today)
    );
    
    if (todayTimers.length === 0) {
        todaysScheduleContainer.innerHTML = `
            <div class="text-center py-8 text-gray-500 col-span-3">
                <i data-feather="meh" class="w-