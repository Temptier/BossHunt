/* script.js
   Main app logic for index.html:
   - subscribes to timers via FirebaseHelper.subscribeToTimers
   - renders timer cards and Today's schedule
   - exposes small helpers used by components
*/

(() => {
  const timersContainer = document.getElementById('timers-container');
  const todaysSchedule = document.getElementById('todays-schedule');
  const webhookCountEl = document.getElementById('webhook-count');
  const playerNameEl = document.getElementById('player-name');
  const offlineIndicator = document.getElementById('offline-indicator');

  // transient state
  let timers = [];
  let webhooks = [];

  // show offline indicator when offline
  function updateOnlineStatus() {
    if (!navigator.onLine) offlineIndicator.classList.remove('hidden');
    else offlineIndicator.classList.add('hidden');
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // subscribe to timers
  FirebaseHelper.subscribeToTimers((snapshot) => {
    timers = snapshot;
    renderTimers();
    renderTodaysSchedule();
  });

  // subscribe to webhooks
  FirebaseHelper.getWebhooks((hooks) => {
    webhooks = hooks;
    webhookCountEl.textContent = String(hooks.length || 0);
  });

  // utility: format next occurrence for scheduled items
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

  // Render functions
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
      // pick first webhook as default if exists
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

    // timer body
    const body = document.createElement('div');
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '6px';

    if (timer.type === 'manual') {
      const resp = document.createElement('div');
      resp.style.fontSize = '13px';
      resp.style.color = 'var(--muted)';
      resp.textContent = `Respawn: ${timer.respawnHours || '—'} hours`;
      body.appendChild(resp);
    } else if (timer.type === 'scheduled') {
      const sched = document.createElement('div');
      sched.style.fontSize = '13px';
      sched.style.color = 'var(--muted)';
      sched.textContent = `Schedule: ${timer.schedule || '—'}`;
      // show next occurrence
      if (timer.schedule) {
        const segments = timer.schedule.split(',').map(s => s.trim());
        let next = null;
        segments.forEach(seg => {
          const [day, time] = seg.split(' ');
          const occ = getNextOccurrence(day, time);
          if (!next || (occ && occ < next)) next = occ;
        });
        if (next) {
          const txt = `Next: ${next.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'2-digit'})} ${next.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}`;
          const nextEl = document.createElement('div');
          nextEl.style.fontSize = '13px';
          nextEl.style.color = 'var(--muted)';
          nextEl.textContent = txt;
          body.appendChild(nextEl);
        }
      }
      body.appendChild(sched);
    }

    el.appendChild(body);
    return el;
  }

  function renderTodaysSchedule() {
    todaysSchedule.innerHTML = '';
    const today = new Date().getDay(); // 0..6
    // collect all scheduled timers that contain today
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

  // small toast helper
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

  // expose a few helpers for components
  window.BossApp = {
    showToast,
    getWebhooks: () => webhooks,
    refreshTimers: () => {
      // force a read - useful for components after adding a timer
      FirebaseHelper.listTimersOnce().then(list => {
        timers = list;
        renderTimers();
        renderTodaysSchedule();
      });
    },
    setPlayerName: (name) => {
      if (!name) return;
      playerNameEl.textContent = name;
      // optionally log visitor
      FirebaseHelper.logVisitor(name, "unknown").catch(()=>{});
    }
  };

  // initial refresh once
  FirebaseHelper.listTimersOnce().then(list => {
    timers = list;
    renderTimers();
    renderTodaysSchedule();
  }).catch(()=>{});
})();