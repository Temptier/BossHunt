/* script.js
   Main app logic for index.html:
   - subscribes to timers via FirebaseHelper.subscribeToTimers
   - renders timer cards and Today's schedule with countdowns
   - exposes small helpers used by components
*/

(() => {
  const timersContainer = document.getElementById('timers-container');
  const todaysSchedule = document.getElementById('todays-schedule');
  const webhookCountEl = document.getElementById('webhook-count');
  const playerNameEl = document.getElementById('player-name');
  const offlineIndicator = document.getElementById('offline-indicator');

  let timers = [];
  let webhooks = [];

  // --- ONLINE / OFFLINE ---
  function updateOnlineStatus() {
    if (!navigator.onLine) offlineIndicator.classList.remove('hidden');
    else offlineIndicator.classList.add('hidden');
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // --- SUBSCRIBE TO FIRESTORE ---
  FirebaseHelper.subscribeToTimers((snapshot) => {
    timers = snapshot;
    renderTimers();
    renderTodaysSchedule();
  });

  FirebaseHelper.getWebhooks((hooks) => {
    webhooks = hooks;
    webhookCountEl.textContent = String(hooks.length || 0);
  });

  // --- UTILITY FUNCTIONS ---
  function getNextOccurrence(dayStr, timeStr) {
    const days = ['sun','mon','tue','wed','thu','fri','sat'];
    const now = new Date();
    const target = days.indexOf(dayStr.toLowerCase());
    if (target === -1) return null;
    const [hh, mm] = timeStr.split(':').map(n => parseInt(n, 10));
    let dt = new Date(now);
    dt.setHours(hh, mm, 0, 0);
    let diff = target - dt.getDay();
    if (diff < 0 || (diff === 0 && dt < now)) diff += 7;
    dt.setDate(dt.getDate() + diff);
    return dt;
  }

  function format12Hour(date) {
    let h = date.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12;
    h = h ? h : 12; // 0 -> 12
    const m = date.getMinutes().toString().padStart(2,'0');
    return `${h}:${m} ${ampm}`;
  }

  // --- TIMER CARD RENDERING ---
  function renderTimers() {
    timersContainer.innerHTML = '';
    timers.forEach(timer => {
      const card = createTimerCard(timer);
      timersContainer.appendChild(card);
    });
  }

  function createTimerCard(timer) {
    const el = document.createElement('div');
    el.className = 'timer-card flex flex-col gap-2 p-3 bg-gray-900/50 rounded-lg';

    // Title
    const title = document.createElement('div');
    title.className = 'flex justify-between items-center';

    const name = document.createElement('div');
    name.innerHTML = `<strong>${timer.bossName}</strong><div style="font-size:12px;color:var(--muted)">${timer.type}</div>`;

    const actions = document.createElement('div');
    actions.className = 'flex gap-2';

    const sendBtn = document.createElement('button');
    sendBtn.className = 'btn-secondary text-xs';
    sendBtn.textContent = 'Send';
    sendBtn.addEventListener('click', async () => {
      if (webhooks.length === 0) {
        showToast('No webhooks configured', 'warning');
        return;
      }
      const webhook = webhooks[0];
      const msg = `🟢 **${timer.bossName}**\nType: ${timer.type}\n${timer.type==='manual'?`Respawn: ${timer.respawnHours || '--'}h`:`Schedule: ${timer.schedule}`}\n--`;
      await FirebaseHelper.sendDiscordNotification(webhook.id, msg).catch(()=>{showToast('Failed to send webhook','error')});
      showToast('Timer sent','success');
    });
    actions.appendChild(sendBtn);

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn-secondary text-xs';
    stopBtn.textContent = timer.isActive===false?'Start':'Stop';
    stopBtn.addEventListener('click', async () => {
      await FirebaseHelper.updateTimer(timer.id,{isActive:!(timer.isActive===false)}).catch(()=>showToast('Failed to toggle','error'));
    });
    actions.appendChild(stopBtn);

    title.appendChild(name);
    title.appendChild(actions);
    el.appendChild(title);

    // Body
    const body = document.createElement('div');
    body.className = 'flex flex-col gap-1 text-sm text-gray-300';

    let endTime = null;
    let nextTime = null;

    if(timer.type==='manual' && timer.lastKilled){
      const last = new Date(timer.lastKilled.seconds*1000);
      const respHours = timer.respawnHours || 1;
      endTime = new Date(last.getTime() + respHours*3600*1000);
      nextTime = endTime;
      const countdown = document.createElement('div');
      countdown.className = 'text-purple-400';
      function updateCD(){
        const rem = Math.floor((nextTime-new Date())/1000);
        countdown.textContent = rem>0 ? `${Math.floor(rem/3600).toString().padStart(2,'0')}:${Math.floor(rem%3600/60).toString().padStart(2,'0')}:${(rem%60).toString().padStart(2,'0')}`:'NOW!';
      }
      updateCD();
      setInterval(updateCD,1000);
      body.appendChild(countdown);
    } else if(timer.type==='scheduled' && timer.schedule){
      const segs = timer.schedule.split(',').map(s=>s.trim());
      let nearest = null;
      segs.forEach(seg=>{
        const [day,time] = seg.split(' ');
        const occ = getNextOccurrence(day,time);
        if(!nearest || occ<nearest) nearest=occ;
      });
      if(nearest) nextTime = nearest;
      const countdown = document.createElement('div');
      countdown.className='text-purple-400';
      function updateCD(){
        const rem = Math.floor((nextTime-new Date())/1000);
        countdown.textContent = rem>0 ? `${Math.floor(rem/3600).toString().padStart(2,'0')}:${Math.floor(rem%3600/60).toString().padStart(2,'0')}:${(rem%60).toString().padStart(2,'0')}`:'NOW!';
      }
      updateCD();
      setInterval(updateCD,1000);
      body.appendChild(countdown);
    }

    if(nextTime){
      const endDiv = document.createElement('div');
      endDiv.className='text-gray-400 text-xs';
      const respHours = timer.respawnHours || 1;
      const endDate = new Date(nextTime.getTime());
      endTime = endDate;
      endDiv.textContent = `Ends: ${endTime.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'2-digit'})} ${format12Hour(endTime)}`;
      body.appendChild(endDiv);
    }

    el.appendChild(body);
    return el;
  }

  // --- TODAY'S SCHEDULE ---
  function renderTodaysSchedule(){
    todaysSchedule.innerHTML='';
    const todayIndex = new Date().getDay();
    const days=['sun','mon','tue','wed','thu','fri','sat'];
    const scheduleList=[];

    timers.forEach(timer=>{
      if(timer.type==='manual' && timer.lastKilled){
        const last=new Date(timer.lastKilled.seconds*1000);
        const resp=timer.respawnHours||1;
        const endTime=new Date(last.getTime()+resp*3600*1000);
        scheduleList.push({bossName:timer.bossName,type:'manual',nextTime:endTime,endTime});
      } else if(timer.type==='scheduled' && timer.schedule){
        timer.schedule.split(',').map(s=>s.trim()).forEach(seg=>{
          const [day,time]=seg.split(' ');
          if(days.indexOf(day.toLowerCase())===todayIndex){
            const nextTime=getNextOccurrence(day,time);
            const endTime=new Date(nextTime.getTime() + (timer.respawnHours||1)*3600*1000);
            scheduleList.push({bossName:timer.bossName,type:'scheduled',nextTime,endTime});
          }
        });
      }
    });

    if(scheduleList.length===0){
      const li=document.createElement('li');
      li.textContent='No scheduled spawns today.';
      todaysSchedule.appendChild(li);
      return;
    }

    scheduleList.sort((a,b)=>a.nextTime-b.nextTime);

    scheduleList.forEach(item=>{
      const li=document.createElement('li');
      li.className='flex justify-between items-center py-1 px-2 rounded-md hover:bg-white/2';

      const nameSpan=document.createElement('span');
      nameSpan.textContent=item.bossName;

      const countdownSpan=document.createElement('span');
      countdownSpan.className='text-purple-400 text-xs';
      function updateCD(){
        const rem=Math.floor((item.nextTime-new Date())/1000);
        countdownSpan.textContent = rem>0 ? `${Math.floor(rem/3600).toString().padStart(2,'0')}:${Math.floor(rem%3600/60).toString().padStart(2,'0')}:${(rem%60).toString().padStart(2,'0')}`:'NOW!';
      }
      updateCD();
      setInterval(updateCD,1000);

      const endSpan=document.createElement('span');
      endSpan.className='text-gray-400 text-xs';
      endSpan.textContent=`Ends: ${item.endTime.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'2-digit'})} ${format12Hour(item.endTime)}`;

      li.appendChild(nameSpan);
      li.appendChild(countdownSpan);
      li.appendChild(endSpan);
      todaysSchedule.appendChild(li);
    });
  }

  // --- TOAST HELPER ---
  function showToast(message,type='info'){
    const container=document.getElementById('toast-container');
    const div=document.createElement('div');
    div.className='toast';
    if(type==='success') div.style.background='linear-gradient(90deg,var(--accent-start),var(--accent-end))';
    else if(type==='error') div.style.background='#b91c1c';
    else if(type==='warning') div.style.background='#b45309';
    else div.style.background='rgba(75,0,130,0.9)';
    div.textContent=message;
    container.appendChild(div);
    setTimeout(()=>div.classList.add('show'),20);
    setTimeout(()=>{div.classList.remove('show');setTimeout(()=>div.remove(),300);},3000);
  }

  // --- EXPOSE TO COMPONENTS ---
  window.BossApp={
    showToast,
    getWebhooks:()=>webhooks,
    refreshTimers:()=>{
      FirebaseHelper.listTimersOnce().then(list=>{
        timers=list;
        renderTimers();
        renderTodaysSchedule();
      });
    },
    setPlayerName:(name)=>{
      if(!name) return;
      playerNameEl.textContent=name;
      FirebaseHelper.logVisitor(name,"unknown").catch(()=>{});
    }
  };

  // --- INITIAL LOAD ---
  FirebaseHelper.listTimersOnce().then(list=>{
    timers=list;
    renderTimers();
    renderTodaysSchedule();
  }).catch(()=>{});
})();