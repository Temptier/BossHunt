// Make AppState truly global
window.AppState = {
  timers: [],
  webhooks: [],
  playerName: localStorage.getItem('playerName') || null,
  isOnline: navigator.onLine,
  timerCleanup: null,
  webhookCleanup: null,
  currentFilter: 'all'
};

// Helper to safely access AppState
const AppStateRef = window.AppState;

// Initialize App when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
  updatePlayerNameUI();
  checkOnlineStatus();
});

function updatePlayerNameUI() {
  const playerNameEl = document.getElementById('player-name');
  if (playerNameEl) {
    playerNameEl.textContent = AppStateRef.playerName || 'Guest';
  }
}

function checkOnlineStatus() {
  handleConnectionChange(AppStateRef.isOnline);
}
  // Show welcome modal if first time
  if (!AppState.playerName) {
    const welcomeModal = document.createElement('welcome-modal');
    document.body.appendChild(welcomeModal);
  }

  // Load timers
  AppState.timerCleanup = FirebaseHelper.subscribeToTimers(updateTimersDisplay);
  
  // Load webhooks
  AppState.webhookCleanup = FirebaseHelper.getWebhooks(updateWebhooksList);

  // Start background updates
  setInterval(updateAllTimers, 60000); // Update every minute
  
  // Initial update
  updateAllTimers();
}

function setupEventListeners() {
  // FAB button
  const fabButton = document.getElementById('fab-add-timer');
  if (fabButton) {
    fabButton.addEventListener('click', () => {
      if (!AppState.isOnline) {
        showToast('Offline mode - cannot add timers', 'error');
        return;
      }
      const modal = document.createElement('add-boss-modal');
      document.body.appendChild(modal);
    });
  }

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      AppState.currentFilter = e.target.dataset.filter;
      updateFilterButtons();
      filterTimers();
    });
  });

  // Webhooks button
  const webhookBtn = document.getElementById('webhooks-btn');
  if (webhookBtn) {
    webhookBtn.addEventListener('click', () => {
      const modal = document.createElement('webhook-modal');
      document.body.appendChild(modal);
    });
  }

  // Online/offline events
  window.addEventListener('online', () => handleConnectionChange(true));
  window.addEventListener('offline', () => handleConnectionChange(false));
}

function handleConnectionChange(online) {
  AppState.isOnline = online;
  const indicator = document.getElementById('offline-indicator');
  
  if (online) {
    indicator?.classList.remove('show');
    showToast('Back online!', 'success');
  } else {
    indicator?.classList.add('show');
    showToast('You are offline - view only mode', 'warning');
  }
  
  // Update UI state
  updateUIForConnectionStatus();
}

function updateUIForConnectionStatus() {
  const actionButtons = document.querySelectorAll('.action-btn');
  actionButtons.forEach(btn => {
    btn.disabled = !AppState.isOnline;
    btn.style.opacity = AppState.isOnline ? '1' : '0.5';
  });
}

function updateTimersDisplay(timers) {
  AppState.timers = timers;
  filterTimers();
  updateTodaysSchedule();
}

function filterTimers() {
  const container = document.getElementById('timers-container');
  if (!container) return;

  let filtered = AppState.timers;
  
  if (AppState.currentFilter === 'manual') {
    filtered = AppState.timers.filter(t => t.type === 'manual');
  } else if (AppState.currentFilter === 'scheduled') {
    filtered = AppState.timers.filter(t => t.type === 'scheduled');
  }

  container.innerHTML = '';
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full text-center py-12">
        <i data-feather="clock" class="w-16 h-16 mx-auto text-purple-400 opacity-50"></i>
        <p class="text-gray-400 mt-4">No timers found. Add your first boss!</p>
      </div>
    `;
    feather.replace();
    return;
  }

  filtered.forEach(timer => {
    const card = createTimerCard(timer);
    container.appendChild(card);
  });
  
  feather.replace();
}

function createTimerCard(timer) {
  const card = document.createElement('div');
  card.className = `timer-card ${timer.type} glass rounded-lg p-4 animate-slide-up`;
  card.dataset.timerId = timer.id;

  const isAutoRestart = timer.autoRestartMinutes && timer.autoRestartMinutes > 0;
  const timeRemaining = calculateTimeRemaining(timer);
  const progress = calculateProgress(timer);

  card.innerHTML = `
    <div class="flex justify-between items-start mb-3">
      <div>
        <h3 class="font-display text-lg font-bold text-white">${timer.bossName}</h3>
        <span class="badge ${timer.type === 'manual' ? 'badge-warning' : 'badge-success'}">
          ${timer.type === 'manual' ? 'Manual' : 'Scheduled'}
        </span>
      </div>
      <div class="flex gap-2">
        <button class="btn-secondary text-xs px-3 py-1 action-btn" onclick="restartTimer('${timer.id}')" ${!AppState.isOnline ? 'disabled' : ''}>
          <i data-feather="rotate-cw" class="w-3 h-3 inline mr-1"></i> Restart
        </button>
        <button class="btn-secondary text-xs px-3 py-1 action-btn" onclick="showControlRoom('${timer.id}')" ${!AppState.isOnline ? 'disabled' : ''}>
          <i data-feather="settings" class="w-3 h-3 inline mr-1"></i> Control
        </button>
      </div>
    </div>
    
    <div class="space-y-2">
      <div class="flex justify-between text-sm">
        <span class="text-gray-400">Status:</span>
        <span id="status-${timer.id}" class="font-semibold ${timeRemaining <= 0 ? 'text-green-400' : 'text-yellow-400'}">
          ${timeRemaining <= 0 ? 'SPAWNED!' : formatCountdown(timeRemaining)}
        </span>
      </div>
      
      ${timer.type === 'manual' ? `
        <div class="flex justify-between text-sm">
          <span class="text-gray-400">Respawn:</span>
          <span>${timer.respawnHours}h</span>
        </div>
        
        ${isAutoRestart ? `
          <div class="flex justify-between text-sm">
            <span class="text-gray-400">Auto Restart:</span>
            <span>${timer.autoRestartMinutes}m</span>
          </div>
        ` : ''}
        
        <div class="flex justify-between text-sm">
          <span class="text-gray-400">Last Kill:</span>
          <span>${timer.lastKilledAt ? formatTimeAgo(timer.lastKilledAt.toDate()) : 'Unknown'}</span>
        </div>
        
        <div class="mt-3">
          <div class="bg-gray-800 rounded-full h-2 overflow-hidden">
            <div class="progress-bar h-full" style="width: ${progress}%"></div>
          </div>
        </div>
      ` : `
        <div class="flex justify-between text-sm">
          <span class="text-gray-400">Next Spawn:</span>
          <span>${timer.nextSpawnAt ? formatDateTime(timer.nextSpawnAt.toDate()) : 'Calculating...'}</span>
        </div>
        
        <div class="flex justify-between text-sm">
          <span class="text-gray-400">Schedule:</span>
          <span>${getDayName(timer.dayOfWeek)} at ${timer.time}</span>
        </div>
      `}
    </div>
  `;

  return card;
}

function calculateTimeRemaining(timer) {
  const now = Date.now();
  
  if (timer.type === 'manual') {
    if (!timer.lastKilledAt) return 0;
    const lastKill = timer.lastKilledAt.toDate().getTime();
    const respawnMs = timer.respawnHours * 60 * 60 * 1000;
    const nextSpawn = lastKill + respawnMs;
    return nextSpawn - now;
  } else {
    if (!timer.nextSpawnAt) return 0;
    return timer.nextSpawnAt.toDate().getTime() - now;
  }
}

function calculateProgress(timer) {
  if (timer.type === 'scheduled' || !timer.lastKilledAt) return 0;
  
  const now = Date.now();
  const lastKill = timer.lastKilledAt.toDate().getTime();
  const respawnMs = timer.respawnHours * 60 * 60 * 1000;
  const elapsed = now - lastKill;
  
  return Math.min(100, Math.max(0, (elapsed / respawnMs) * 100));
}

function formatCountdown(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatDateTime(date) {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getDayName(dayIndex) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayIndex];
}

function updateAllTimers() {
  AppState.timers.forEach(timer => {
    const statusEl = document.getElementById(`status-${timer.id}`);
    if (statusEl) {
      const timeRemaining = calculateTimeRemaining(timer);
      statusEl.textContent = timeRemaining <= 0 ? 'SPAWNED!' : formatCountdown(timeRemaining);
      statusEl.className = `font-semibold ${timeRemaining <= 0 ? 'text-green-400 animate-pulse-glow' : 'text-yellow-400'}`;
    }
    
    // Update progress bar for manual timers
    if (timer.type === 'manual') {
      const progressBar = document.querySelector(`[data-timer-id="${timer.id}"] .progress-bar`);
      if (progressBar) {
        progressBar.style.width = `${calculateProgress(timer)}%`;
      }
    }
  });
  
  checkForNotifications();
}

function updateTodaysSchedule() {
  const container = document.getElementById('todays-schedule');
  if (!container) return;

  const today = new Date().getDay();
  const todaysTimers = AppState.timers.filter(t => {
    if (t.type === 'scheduled' && t.dayOfWeek === today) return true;
    if (t.type === 'manual') {
      const remaining = calculateTimeRemaining(t);
      return remaining > 0 && remaining < 24 * 60 * 60 * 1000; // Spawning within 24h
    }
    return false;
  });

  if (todaysTimers.length === 0) {
    container.innerHTML = `
      <li class="text-gray-400 text-center py-4">
        <i data-feather="calendar" class="w-8 h-8 mx-auto mb-2 opacity-50"></i>
        No bosses scheduled for today
      </li>
    `;
    feather.replace();
    return;
  }

  container.innerHTML = todaysTimers.map(timer => {
    const time = timer.type === 'scheduled' 
      ? timer.time 
      : formatDateTime(new Date(Date.now() + calculateTimeRemaining(timer)));
    
    return `
      <li class="flex justify-between items-center py-2 px-3 bg-gray-800/50 rounded-lg">
        <span class="font-medium">${timer.bossName}</span>
        <span class="text-purple-400 font-mono">${time}</span>
      </li>
    `;
  }).join('');
}

function updateFilterButtons() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    if (btn.dataset.filter === AppState.currentFilter) {
      btn.classList.add('bg-purple-600', 'text-white');
      btn.classList.remove('bg-gray-700', 'text-gray-300');
    } else {
      btn.classList.remove('bg-purple-600', 'text-white');
      btn.classList.add('bg-gray-700', 'text-gray-300');
    }
  });
}

async function restartTimer(timerId) {
  if (!AppState.isOnline) {
    showToast('Offline mode - cannot restart timer', 'error');
    return;
  }

  try {
    await FirebaseHelper.restartTimer(timerId);
    showToast('Timer restarted successfully!', 'success');
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

function showControlRoom(timerId) {
  const modal = document.createElement('control-room-modal');
  modal.dataset.timerId = timerId;
  document.body.appendChild(modal);
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-purple-600'} text-white px-6 py-3 rounded-lg shadow-lg`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function updateWebhooksList(webhooks) {
  // Update webhook count in UI if needed
  const webhookCountEl = document.getElementById('webhook-count');
  if (webhookCountEl) {
    webhookCountEl.textContent = webhooks.length;
  }
}

// Notification handling
let lastNotificationCheck = new Map();

async function checkForNotifications() {
  if (!AppState.isOnline) return;
  
  const tenMinutesMs = 10 * 60 * 1000;
  
  AppState.timers.forEach(async timer => {
    const timeRemaining = calculateTimeRemaining(timer);
    const timerId = timer.id;
    
    // Check if within 10-minute window
    if (timeRemaining > 0 && timeRemaining <= tenMinutesMs) {
      const lastCheck = lastNotificationCheck.get(timerId);
      const now = Date.now();
      
      // Only notify once per timer
      if (!lastCheck || (now - lastCheck) > tenMinutesMs) {
        lastNotificationCheck.set(timerId, now);
        await sendWebhookNotification(timer, 'warning');
      }
    }
  });
}

async function sendWebhookNotification(timer, type = 'spawn') {
  try {
    const webhooks = AppState.webhooks;
    if (webhooks.length === 0) return;

    const message = type === 'warning' 
      ? `⚠️ **${timer.bossName}** will spawn in 10 minutes!`
      : `🔔 **${timer.bossName}** has spawned!`;

    // Send to all webhooks
    const promises = webhooks.map(webhook => 
      FirebaseHelper.sendDiscordNotification(webhook.id, message).catch(console.error)
    );
    
    await Promise.allSettled(promises);
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (AppState.timerCleanup) AppState.timerCleanup();
  if (AppState.webhookCleanup) AppState.webhookCleanup();
});