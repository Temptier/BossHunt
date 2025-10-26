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

// ---- Add a scheduled boss ----
function addScheduledBoss() {
    const bossName = scheduledBossNameInput.value.trim();
    const days = scheduledDaysInput.value.split(',').map(d => d.trim()); // e.g., "Mon, Wed"
    const time = scheduledTimeInput.value; // e.g., "18:00"

    if (!bossName || days.length === 0 || !time) return alert("Enter boss name, days, and time");

    // Merge if boss already exists
    let existing = scheduledBosses.find(b => b.bossName.toLowerCase() === bossName.toLowerCase());
    if (existing) {
        // Add new schedules if not already present
        days.forEach(day => {
            if (!existing.schedules.some(s => s.day === day && s.time === time)) {
                existing.schedules.push({ day, time });
            }
        });
    } else {
        scheduledBosses.push({
            bossName,
            schedules: days.map(day => ({ day, time }))
        });
    }

    // Save to Firebase
    saveScheduledBossesToFirebase();

    // Render all scheduled bosses
    renderScheduledBosses();

    // Reset form
    scheduledBossNameInput.value = '';
    scheduledDaysInput.value = '';
    scheduledTimeInput.value = '';
    addScheduledBossModal.classList.add('hidden');
}

// ---- Render all scheduled bosses ----
function renderScheduledBosses() {
    scheduledBossesContainer.innerHTML = '';

    if (scheduledBosses.length === 0) {
        scheduledBossesContainer.innerHTML = '<div class="text-center text-gray-400 py-4">No scheduled bosses</div>';
        return;
    }

    scheduledBosses.forEach(boss => {
        const card = document.createElement('div');
        card.className = 'timer-card rounded-lg p-4';

        let scheduleHtml = '';
        boss.schedules.forEach(s => {
            const countdown = getNextSpawnCountdown(s.day, s.time);
            scheduleHtml += `
                <div class="flex justify-between items-center mb-1">
                    <span>${s.day} ${s.time}</span>
                    <span class="text-sm font-mono text-green-400">${countdown || ''}</span>
                </div>
            `;
        });

        card.innerHTML = `
            <div class="flex justify-between items-center">
                <h3 class="font-bold text-lg">${boss.bossName}</h3>
                <button class="bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded text-xs" data-boss="${boss.bossName}">
                    <i data-feather="trash-2" class="w-3 h-3 mr-1"></i> Delete
                </button>
            </div>
            <div class="mt-2">${scheduleHtml}</div>
        `;
        scheduledBossesContainer.appendChild(card);
    });

    // Feather icons
    feather.replace();

    // Add delete functionality
    scheduledBossesContainer.querySelectorAll('button[data-boss]').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-boss');
            if (confirm(`Delete all schedules for ${name}?`)) {
                scheduledBosses = scheduledBosses.filter(b => b.bossName !== name);
                saveScheduledBossesToFirebase();
                renderScheduledBosses();
            }
        });
    });
}

// ---- Calculate countdown for next spawn ----
function getNextSpawnCountdown(day, time) {
    const daysMap = { 'Sun':0, 'Mon':1, 'Tue':2, 'Wed':3, 'Thu':4, 'Fri':5, 'Sat':6 };
    const now = new Date();
    const [hour, minute] = time.split(':').map(Number);
    let target = new Date(now);
    target.setHours(hour, minute, 0, 0);

    const targetDay = daysMap[day];
    let diff = targetDay - now.getDay();
    if (diff < 0 || (diff === 0 && target <= now)) diff += 7;

    target.setDate(now.getDate() + diff);

    const remainingSec = Math.floor((target - now)/1000);
    if (remainingSec <= 0) return '';
    const h = Math.floor(remainingSec / 3600).toString().padStart(2,'0');
    const m = Math.floor((remainingSec % 3600) / 60).toString().padStart(2,'0');
    return `${h}:${m}`;
}

// ---- Save manual timer to Firebase ----
function saveTimerToFirebase(timer) {
    const db = firebase.database();
    db.ref('manualTimers/' + timer.id).set(timer)
        .catch(err => console.error('Error saving timer:', err));
}

// ---- Save all scheduled bosses to Firebase ----
function saveScheduledBossesToFirebase() {
    const db = firebase.database();
    db.ref('scheduledBosses').set(scheduledBosses)
        .catch(err => console.error('Error saving scheduled bosses:', err));
}

// ---- Load manual timers from Firebase ----
function loadTimers() {
    const db = firebase.database();
    db.ref('manualTimers').once('value')
        .then(snapshot => {
            timers = [];
            snapshot.forEach(child => timers.push(child.val()));
            manualTimersContainer.innerHTML = '';
            timers.forEach(renderTimer);
        })
        .catch(err => console.error('Error loading timers:', err));
}

// ---- Load scheduled bosses from Firebase ----
function loadScheduledBosses() {
    const db = firebase.database();
    db.ref('scheduledBosses').once('value')
        .then(snapshot => {
            scheduledBosses = snapshot.val() || [];
            renderScheduledBosses();
        })
        .catch(err => console.error('Error loading scheduled bosses:', err));
}

// ---- Log visitors ----
function logVisitor() {
    const visitorData = {
        ign: currentUser.ign,
        guild: currentUser.guild,
        timestamp: Date.now(),
        isAdmin: currentUser.isAdmin
    };

    const db = firebase.database();
    db.ref('visitors').push(visitorData);

    // Discord notification every 5 minutes max
    const lastSent = localStorage.getItem('lastVisitorNotification');
    if (!lastSent || Date.now() - parseInt(lastSent) > 300000) {
        sendToDiscord(`👀 New visitor: ${currentUser.ign} from ${currentUser.guild}`);
        localStorage.setItem('lastVisitorNotification', Date.now().toString());
    }
}

// ---- Send to Discord ----
function sendToDiscord(message) {
    const webhookUrl = DISCORD_WEBHOOKS[activeDiscordWebhook];
    if (!webhookUrl) return;

    fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
    }).catch(err => console.error('Discord webhook error:', err));
}

// ---- Load recent visitors ----
function loadVisitors() {
    const db = firebase.database();
    db.ref('visitors').orderByChild('timestamp').limitToLast(10).once('value')
        .then(snapshot => {
            visitors = [];
            snapshot.forEach(child => visitors.push(child.val()));
            renderVisitors();
        })
        .catch(err => console.error('Error loading visitors:', err));
}

// ---- Render visitors ----
function renderVisitors() {
    visitorsContainer.innerHTML = '';

    if (visitors.length === 0) {
        visitorsContainer.innerHTML = '<div class="text-center text-gray-400 py-4">No recent visitors</div>';
        return;
    }

    visitors.sort((a, b) => b.timestamp - a.timestamp);

    visitors.forEach(visitor => {
        const el = document.createElement('div');
        el.className = 'flex justify-between items-center py-2 border-b border-gray-700';
        const minsAgo = Math.floor((Date.now() - visitor.timestamp)/60000);
        const timeText = minsAgo < 1 ? 'just now' : minsAgo === 1 ? '1 minute ago' : `${minsAgo} minutes ago`;

        el.innerHTML = `
            <div class="flex items-center">
                <div class="w-2 h-2 rounded-full mr-2 ${visitor.guild === ADMIN_GUILD ? 'bg-blue-500' : 'bg-green-500'}"></div>
                <span class="font-medium">${visitor.ign}</span>
                <span class="text-xs text-gray-400 ml-2">${visitor.guild}</span>
            </div>
            <span class="text-xs text-gray-400">${timeText}</span>
        `;
        visitorsContainer.appendChild(el);
    });
}