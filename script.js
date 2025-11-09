(() => {
  const timersContainer = document.getElementById('timers-container');
  const todaysSchedule = document.getElementById('todays-schedule');
  const webhookCountEl = document.getElementById('webhook-count');
  const playerNameEl = document.getElementById('player-name');
  const offlineIndicator = document.getElementById('offline-indicator');

  let timers = [];
  let webhooks = [];

  function updateOnlineStatus() {
    if (!navigator.onLine) offlineIndicator.classList.remove('hidden');
    else offlineIndicator.classList.add('hidden');
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  FirebaseHelper.subscribeToTimers((snapshot) => {
    timers = snapshot;
    renderTimers();
    renderTodaysSchedule();
  });

  FirebaseHelper.getWebhooks((hooks) => {
    webhooks = hooks;
    webhookCountEl.textContent = String(hooks.length || 0);
  });

  function getNextOccurrence(dayStr, timeStr) {
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    const now = new Date();
    const target = days.indexOf(dayStr.toLowerCase());
    if (target === -1) return null;
    const [hh, mm] = timeStr.split(':').map(n => parseInt(n, 10));
    let dt = new Date(now);
    dt.setHours(hh, mm, 0, 0);
    const diff = target - dt.getDay();
    if (diff < 0 || (diff === 0 && dt < now)) dt.setDate(dt.getDate() + 7 + diff);
    else dt.setDate(dt.getDate() + diff);
    return dt;
  }

  function renderTimers() {
    timersContainer.innerHTML = '';
    timers.forEach(t => {
      const card = createTimerCard(t);
      timersContainer.appendChild(card);
    });
  }

  function createTimerCard(timer) {
    const el = document.createElement('div');
    el.className = 'timer-card';
    el.style.display = 'flex';
    el.style.flexDirection = 'column';
    el.style.gap = '8px';

    const title = document.createElement('div');
    title.style.display = 'flex';
    title.style.justifyContent = 'space-between';
    title.style.alignItems = 'center';

    const name = document.createElement('div');
    name.innerHTML = `<strong>${timer.bossName}</strong><div style="font-size:12px;color:var(--muted)">${timer.type}</div>`;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '8px';

    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn-secondary';
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', async () => {
      if (webhooks.length === 0) {
        showToast('No webhooks configured', 'warning');
        return;
      }
      const webhook = webhooks[0];
      const msg = `🟢 **${timer.bossName}**\nType: ${timer.type}\n${timer.type === 'manual' ? `Respawn: ${timer.respawnHours || '--'}h` : `Schedule: ${timer.schedule}`}\n--`;
      await FirebaseHelper.sendDiscordNotification(webhook.id, msg).catch(err => {
        console.error(err);
        showToast('Failed to send webhook', 'error');
      });
      showToast('Timer sent', 'success');
    });

    actions.appendChild(sendBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn-secondary';
    stopBtn.textContent = timer.isActive === false ? 'Start' : 'Stop';
    stopBtn.addEventListener('click', async () => {
      await FirebaseHelper.updateTimer(timer.id, { isActive: !(timer.isActive === false) }).catch(e => {
        console.error(e);
        showToast('Failed to toggle', 'error');
      });
    });
    actions.appendChild(stopBtn);

    title.appendChild(name);
    title.appendChild(actions);

    el.appendChild(title);

    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '6px';

    const countdownEl = document.createElement('div');
    countdownEl.style.fontSize = '13px';
    countdownEl.style.color = 'var(--muted)';
    body.appendChild(countdownEl);

    function updateCountdown() {
      if (timer.type === 'manual') {
        if (!timer.lastKilled || !timer.respawnHours) {
          countdownEl.textContent = 'Respawn: —';
          return;
        }
        const respawnMs = timer.respawnHours * 60 * 60 * 1000;
        const nextTime = timer.lastKilled.toDate ? timer.lastKilled.toDate().getTime() + respawnMs : new Date(timer.lastKilled).getTime() + respawnMs;
        const diff = nextTime - Date.now();
        if (diff <= 0) countdownEl.textContent = 'Ready!';
        else countdownEl.textContent = `Respawn in: ${msToTime(diff)}`;
      } else if (timer.type === 'scheduled') {
        if (!timer.schedule) {
          countdownEl.textContent = 'Next: —';
          return;
        }
        const segments = timer.schedule.split(',').map(s => s.trim());
        let next = null;
        segments.forEach(seg => {
          const [day, time] = seg.split(' ');
          const occ = getNextOccurrence(day, time);
          if (!next || (occ && occ < next)) next = occ;
        });
        if (next) {
          const diff = next.getTime() - Date.now();
          if (diff <= 0) countdownEl.textContent = 'Ready!';
          else countdownEl.textContent = `Next in: ${msToTime(diff)}`;
        }
      }
    }

    updateCountdown();
    const intervalId = setInterval(updateCountdown, 1000);
    el.dataset.intervalId = intervalId;

    el.appendChild(body);
    return el;
  }

  function msToTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h > 0 ? h + 'h ' : ''}${m}m ${s}s`;
  }

  function renderTodaysSchedule() {
    todaysSchedule.innerHTML = '';
    const today = new Date().getDay();
    const list = timers.filter(t => t.type === 'scheduled' && t.schedule).flatMap(t => {
      const segments = t.schedule.split(',').map(s => s.trim());
      return segments.map(seg => {
        const [day, time] = seg.split(' ');
        return { bossName: t.bossName, day: day.toLowerCase(), time };
      });
    }).filter(s => {
      const days = ['sun','mon','tue','wed','thu','fri','sat'];
      return days.indexOf(s.day) === today;
    }).sort((a,b) => a.time.localeCompare(b.time));

    if (list.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No scheduled spawns today.';
      todaysSchedule.appendChild(li);
      return;
    }
    list.forEach(item => {
      const li = document.createElement('li');
      li.className = 'flex justify-between items-center py-1 px-2 rounded-md hover:bg-white/2';
      li.innerHTML = `<span>${item.bossName}</span><span class="text-sm text-gray-400">${item.time}</span>`;
      todaysSchedule.appendChild(li);
    });
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const div = document.createElement('div');
    div.className = 'toast';
    if (type === 'success') div.style.background = 'linear-gradient(90deg,var(--accent-start),var(--accent-end))';
    else if (type === 'error') div.style.background = '#b91c1c';
    else if (type === 'warning') div.style.background = '#b45309';
    else div.style.background = 'rgba(75,0,130,0.9)';
    div.textContent = message;
    container.appendChild(div);
    setTimeout(() => div.classList.add('show'), 20);
    setTimeout(() => {
      div.classList.remove('show');
      setTimeout(() => div.remove(), 280);
    }, 3000);
  }

  window.BossApp = {
    showToast,
    getWebhooks: () => webhooks,
    refreshTimers: () => {
      FirebaseHelper.listTimersOnce().then(list => {
        timers = list;
        renderTimers();
        renderTodaysSchedule();
      });
    },
    setPlayerName: (name) => {
      if (!name) return;
      playerNameEl.textContent = name;
      FirebaseHelper.logVisitor(name, "unknown").catch(()=>{});
    }
  };

  FirebaseHelper.listTimersOnce().then(list => {
    timers = list;
    renderTimers();
    renderTodaysSchedule();
  }).catch(()=>{});
})();