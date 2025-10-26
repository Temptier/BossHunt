// DOM Elements
const userModal = document.getElementById('userModal');
const mainContent = document.getElementById('mainContent');
const ignInput = document.getElementById('ignInput');
const guildInput = document.getElementById('guildInput');
const submitUserBtn = document.getElementById('submitUserBtn');
const addManualTimerBtn = document.getElementById('addManualTimerBtn');
const addScheduledBossBtn = document.getElementById('addScheduledBossBtn');
const manualTimersContainer = document.getElementById('manualTimersContainer');
const scheduledBossesContainer = document.getElementById('scheduledBossesContainer');
const visitorsContainer = document.getElementById('visitorsContainer');
const refreshVisitorsBtn = document.getElementById('refreshVisitorsBtn');
const addTimerModal = document.getElementById('addTimerModal');
const closeAddTimerModal = document.getElementById('closeAddTimerModal');
const cancelAddTimerBtn = document.getElementById('cancelAddTimerBtn');
const confirmAddTimerBtn = document.getElementById('confirmAddTimerBtn');
const confirmModal = document.getElementById('confirmModal');
const confirmCancelBtn = document.getElementById('confirmCancelBtn');
const confirmActionBtn = document.getElementById('confirmActionBtn');
const confirmModalTitle = document.getElementById('confirmModalTitle');
const confirmModalMessage = document.getElementById('confirmModalMessage');

// State
let currentUser = {
    ign: '',
    guild: '',
    isAdmin: false
};

let timers = [];
let scheduledBosses = [];
let visitors = [];
let activeDiscordWebhook = 1;

// Constants
const ADMIN_GUILD = 'Vesperial';
const DISCORD_WEBHOOKS = {
    1: 'DISCORD_BOSS_WEBHOOK_1',
    2: 'DISCORD_BOSS_WEBHOOK_2'
};

// Initialize the app
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
    // User modal
    submitUserBtn.addEventListener('click', handleUserSubmit);
    
    // Timer management
    addManualTimerBtn.addEventListener('click', () => addTimerModal.classList.remove('hidden'));
    closeAddTimerModal.addEventListener('click', () => addTimerModal.classList.add('hidden'));
    cancelAddTimerBtn.addEventListener('click', () => addTimerModal.classList.add('hidden'));
    confirmAddTimerBtn.addEventListener('click', addNewTimer);
    
    // Confirm modal
    confirmCancelBtn.addEventListener('click', () => confirmModal.classList.add('hidden'));
    
    // Visitors
    refreshVisitorsBtn.addEventListener('click', loadVisitors);
}

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

function addNewTimer() {
    const bossName = bossNameInput.value.trim();
    const duration = parseInt(bossDurationInput.value);
    
    if (bossName && duration > 0) {
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
        sendToDiscord(`⏱️ New timer started for ${bossName} (${duration} hours) by ${currentUser.ign}`);
    }
}

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
    
    // Start countdown if active
    if (timer.isActive) {
        startCountdown(timer.id, timer.startTime, timer.duration);
    }
}

function startCountdown(timerId, startTime, durationHours) {
    const endTime = startTime + (durationHours * 3600 * 1000);
    const now = Date.now();
    let remainingSeconds = Math.floor((endTime - now) / 1000);
    
    const countdownElement = document.getElementById(`countdown-${timerId}`);
    const nextSpawnElement = document.getElementById(`nextSpawn-${timerId}`);
    
    if (remainingSeconds <= 0) {
        countdownElement.textContent = 'EXPIRED';
        countdownElement.classList.add('text-red-500');
        return;
    }
    
    // Initial display
    countdownElement.textContent = formatTime(remainingSeconds);
    
    // Update every second
    const countdownInterval = setInterval(() => {
        remainingSeconds--;
        
        if (remainingSeconds <= 0) {
            clearInterval(countdownInterval);
            countdownElement.textContent = 'EXPIRED';
            countdownElement.classList.add('text-red-500');
            
            // Send 10-minute warning (simplified for example)
            if (remainingSeconds === -600) {
                sendToDiscord(`⚠️ 10-minute warning: ${timerId} is about to expire!`);
            }
        } else {
            countdownElement.textContent = formatTime(remainingSeconds);
            
            // Update next spawn time periodically
            if (remainingSeconds % 60 === 0) {
                nextSpawnElement.textContent = calculateNextSpawn(startTime, durationHours);
            }
        }
    }, 1000);
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function calculateNextSpawn(startTime, durationHours) {
    const now = new Date();
    const spawnDate = new Date(startTime + durationHours * 3600 * 1000);
    
    // Format as "Today 15:30" or "Tomorrow 03:45" or "Mon 12:00"
    if (spawnDate.toDateString() === now.toDateString()) {
        return `Today ${spawnDate.getHours().toString().padStart(2, '0')}:${spawnDate.getMinutes().toString().padStart(2, '0')}`;
    } else if (spawnDate.getDate() === now.getDate() + 1 && spawnDate.getMonth() === now.getMonth() && spawnDate.getFullYear() === now.getFullYear()) {
        return `Tomorrow ${spawnDate.getHours().toString().padStart(2, '0')}:${spawnDate.getMinutes().toString().padStart(2, '0')}`;
    } else {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[spawnDate.getDay()]} ${spawnDate.getHours().toString().padStart(2, '0')}:${spawnDate.getMinutes().toString().padStart(2, '0')}`;
    }
}

function sendToDiscord(message) {
    const webhookUrl = DISCORD_WEBHOOKS[activeDiscordWebhook];
    if (!webhookUrl) return;
    
    fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
    }).catch(error => console.error('Error sending to Discord:', error));
}

function logVisitor() {
    const visitorData = {
        ign: currentUser.ign,
        guild: currentUser.guild,
        timestamp: Date.now(),
        isAdmin: currentUser.isAdmin
    };
    
    // Save to Firebase
    const database = firebase.database();
    database.ref('visitors').push(visitorData);
    
    // Send to Discord if not too frequent
    const lastSent = localStorage.getItem('lastVisitorNotification');
    if (!lastSent || Date.now() - parseInt(lastSent) > 300000) { // 5 minutes cooldown
        sendToDiscord(`👀 New visitor: ${currentUser.ign} from ${currentUser.guild}`);
        localStorage.setItem('lastVisitorNotification', Date.now().toString());
    }
}

function loadVisitors() {
    const database = firebase.database();
    database.ref('visitors').orderByChild('timestamp').limitToLast(10).once('value')
        .then(snapshot => {
            visitors = [];
            snapshot.forEach(childSnapshot => {
                visitors.push(childSnapshot.val());
            });
            renderVisitors();
        })
        .catch(error => console.error('Error loading visitors:', error));
}

function renderVisitors() {
    visitorsContainer.innerHTML = '';
    
    if (visitors.length === 0) {
        visitorsContainer.innerHTML = '<div class="text-center text-gray-400 py-4">No recent visitors</div>';
        return;
    }
    
    // Sort by timestamp descending
    visitors.sort((a, b) => b.timestamp - a.timestamp);
    
    visitors.forEach(visitor => {
        const visitorElement = document.createElement('div');
        visitorElement.className = 'flex justify-between items-center py-2 border-b border-gray-700';
        
        const timeAgo = Math.floor((Date.now() - visitor.timestamp) / 60000); // minutes ago
        const timeText = timeAgo < 1 ? 'just now' : 
                        timeAgo === 1 ? '1 minute ago' : 
                        `${timeAgo} minutes ago`;
        
        visitorElement.innerHTML = `
            <div class="flex items-center">
                <div class="w-2 h-2 rounded-full mr-2 ${visitor.guild === ADMIN_GUILD ? 'bg-blue-500' : 'bg-green-500'}"></div>
                <span class="font-medium">${visitor.ign}</span>
                <span class="text-xs text-gray-400 ml-2">${visitor.guild}</span>
            </div>
            <span class="text-xs text-gray-400">${timeText}</span>
        `;
        
        visitorsContainer.appendChild(visitorElement);
    });
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', initApp);