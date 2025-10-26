// =================== DOM Elements ===================
const userModal = document.getElementById('userModal');
const mainContent = document.getElementById('mainContent');
const ignInput = document.getElementById('ignInput');
const guildInput = document.getElementById('guildInput');
const submitUserBtn = document.getElementById('submitUserBtn');

const addManualTimerBtn = document.getElementById('addManualTimerBtn');
const manualTimersContainer = document.getElementById('manualTimersContainer');

const addScheduledBossBtn = document.getElementById('addScheduledBossBtn');
const scheduledBossesContainer = document.getElementById('scheduledBossesContainer');

const visitorsContainer = document.getElementById('visitorsContainer');
const refreshVisitorsBtn = document.getElementById('refreshVisitorsBtn');

const addTimerModal = document.getElementById('addTimerModal');
const closeAddTimerModal = document.getElementById('closeAddTimerModal');
const cancelAddTimerBtn = document.getElementById('cancelAddTimerBtn');
const confirmAddTimerBtn = document.getElementById('confirmAddTimerBtn');

const addScheduledBossModal = document.getElementById('addScheduledBossModal');
const closeAddScheduledBossModal = document.getElementById('closeAddScheduledBossModal');
const cancelAddScheduledBossBtn = document.getElementById('cancelAddScheduledBossBtn');
const confirmAddScheduledBossBtn = document.getElementById('confirmAddScheduledBossBtn');
const scheduledBossNameInput = document.getElementById('scheduledBossNameInput');
const scheduledDaysInput = document.getElementById('scheduledDaysInput');
const scheduledTimeInput = document.getElementById('scheduledTimeInput');

const confirmModal = document.getElementById('confirmModal');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalMessage = document.getElementById('confirmModalMessage');

// =================== State ===================
let currentUser = { ign: '', guild: '', isAdmin: false };
let timers = [];
let scheduledBosses = [];
let visitors = [];
let activeDiscordWebhook = parseInt(localStorage.getItem('activeWebhook')) || 1;

// =================== Constants ===================
const ADMIN_GUILD = 'Vesperial';
const DISCORD_WEBHOOKS = {
    1: 'DISCORD_BOSS_WEBHOOK_1',
    2: 'DISCORD_BOSS_WEBHOOK_2'
};

// =================== Initialize App ===================
function initApp() {
    checkUserSession();
    setupEventListeners();
}

function checkUserSession() {
    const savedUser = localStorage.getItem('bossTrackUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        currentUser.isAdmin = currentUser.guild === ADMIN_GUILD;
        userModal.classList.add('hidden');
        mainContent.classList.remove('hidden');
        loadTimers();
        loadScheduledBosses();
        loadVisitors();
    } else {
        userModal.classList.remove('hidden');
        mainContent.classList.add('hidden');
    }
}

function setupEventListeners() {
    // ---- User modal ----
    submitUserBtn.addEventListener('click', handleUserSubmit);

    // ---- Manual timers ----
    addManualTimerBtn.addEventListener('click', () => addTimerModal.classList.remove('hidden'));
    closeAddTimerModal.addEventListener('click', () => addTimerModal.classList.add('hidden'));
    cancelAddTimerBtn.addEventListener('click', () => addTimerModal.classList.add('hidden'));
    confirmAddTimerBtn.addEventListener('click', addNewTimer);

    // ---- Scheduled Bosses ----
    addScheduledBossBtn.addEventListener('click', () => addScheduledBossModal.classList.remove('hidden'));
    closeAddScheduledBossModal.addEventListener('click', () => addScheduledBossModal.classList.add('hidden'));
    cancelAddScheduledBossBtn.addEventListener('click', () => addScheduledBossModal.classList.add('hidden'));
    confirmAddScheduledBossBtn.addEventListener('click', addScheduledBoss);

    // ---- Confirm modal ----
    confirmCancelBtn.addEventListener('click', () => confirmModal.classList.add('hidden'));

    // ---- Visitors ----
    refreshVisitorsBtn.addEventListener('click', loadVisitors);
}

// ---- Handle user submit ----
function handleUserSubmit() {
    const ign = ignInput.value.trim();
    const guild = guildInput.value.trim();

    if (ign && guild) {
        currentUser = {
            ign,
            guild,
            isAdmin: guild === ADMIN_GUILD
        };

        localStorage.setItem('bossTrackUser', JSON.stringify(currentUser));
        userModal.classList.add('hidden');
        mainContent.classList.remove('hidden');

        // Log visitor
        logVisitor();

        // Load data
        loadTimers();
        loadScheduledBosses();
        loadVisitors();
    } else {
        alert('Please enter both your IGN and Guild name');
    }
}

// ---- Add new manual timer ----
function addNewTimer() {
    const bossName = bossNameInput.value.trim();
    const duration = parseInt(bossDurationInput.value);

    if (!bossName || duration <= 0) return alert("Please enter a valid boss name and duration");

    const newTimer = {
        id: Date.now(),
        bossName,
        duration,
        startTime: Date.now(),
        isActive: true,
        createdBy: currentUser.ign
    };

    // Add to local state
    timers.push(newTimer);

    // Save to Firebase
    saveTimerToFirebase(newTimer);

    // Render timer
    renderTimer(newTimer);

    // Reset form
    bossNameInput.value = '';
    bossDurationInput.value = '12';
    addTimerModal.classList.add('hidden');

    // Send to Discord
    sendToDiscord(`⏱️ New timer started for ${bossName} (${duration}h) by ${currentUser.ign}`);
}

// ---- Render a manual timer ----
function renderTimer(timer) {
    const timerCard = document.createElement('div');
    timerCard.className = `timer-card rounded-lg p-4 ${timer.isActive ? 'active' : ''}`;
    timerCard.innerHTML = `
        <div class="flex justify-between items-start">
            <div>
                <h3 class="font-bold text-lg">${timer.bossName}</h3>
                <p class="text-sm text-gray-400">Started by ${timer.createdBy}</p>
            </div>
            <div class="text-right">
                <span class="text-2xl font-mono" id="countdown-${timer.id}">${formatTime(timer.duration * 3600)}</span>
                <p class="text-xs text-gray-400">Next spawn: <span id="nextSpawn-${timer.id}">${calculateNextSpawn(timer.startTime, timer.duration)}</span></p>
            </div>
        </div>
        <div class="flex justify-between mt-4">
            <button class="timer-action-btn bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded text-xs" data-action="restart" data-id="${timer.id}">
                <i data-feather="refresh-cw" class="w-3 h-3 mr-1"></i> Restart
            </button>
            <button class="timer-action-btn bg-gray-600 hover:bg-gray-500 text-white py-1 px-3 rounded text-xs" data-action="stop" data-id="${timer.id}">
                <i data-feather="pause" class="w-3 h-3 mr-1"></i> Stop
            </button>
            <button class="timer-action-btn bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded text-xs" data-action="send" data-id="${timer.id}">
                <i data-feather="send" class="w-3 h-3 mr-1"></i> Send
            </button>
            <button class="timer-action-btn bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-xs" data-action="delete" data-id="${timer.id}">
                <i data-feather="trash-2" class="w-3 h-3 mr-1"></i> Delete
            </button>
        </div>
    `;
    manualTimersContainer.appendChild(timerCard);
    feather.replace();

    // Start countdown
    if (timer.isActive) {
        startCountdown(timer.id, timer.startTime, timer.duration);
    }
}

// ---- Countdown for manual timers ----
function startCountdown(timerId, startTime, durationHours) {
    const endTime = startTime + durationHours * 3600 * 1000;
    const countdownEl = document.getElementById(`countdown-${timerId}`);
    const nextSpawnEl = document.getElementById(`nextSpawn-${timerId}`);

    function update() {
        const remaining = Math.floor((endTime - Date.now()) / 1000);
        if (remaining <= 0) {
            countdownEl.textContent = 'EXPIRED';
            countdownEl.classList.add('text-red-500');
        } else {
            countdownEl.textContent = formatTime(remaining);
            if (remaining % 60 === 0) {
                nextSpawnEl.textContent = calculateNextSpawn(startTime, durationHours);
            }
        }
    }

    update();
    setInterval(update, 1000);
}

// ---- Format time helper ----
function formatTime(seconds) {
    const h = Math.floor(seconds / 3600).toString().padStart(2,'0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2,'0');
    const s = (seconds % 60).toString().padStart(2,'0');
    return `${h}:${m}:${s}`;
}