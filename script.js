// DOM Elements (manual + scheduled + visitors)
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
const bossNameInput = document.getElementById('bossNameInput');
const bossDurationInput = document.getElementById('bossDurationInput');
const confirmAddTimerBtn = document.getElementById('confirmAddTimerBtn');
const cancelAddTimerBtn = document.getElementById('cancelAddTimerBtn');
const closeAddTimerModal = document.getElementById('closeAddTimerModal');

// State
let currentUser = { ign:'', guild:'', isAdmin:false };
let timers = [];
let scheduledBosses = [];
let visitors = [];
let activeDiscordWebhook = 1;

// Constants
const ADMIN_GUILD = 'Vesperial';
const DISCORD_WEBHOOKS = { 1: 'DISCORD_BOSS_WEBHOOK_1', 2: 'DISCORD_BOSS_WEBHOOK_2' };

// Init App
function initApp() {
    checkUserSession();
    setupEventListeners();
}
function checkUserSession() {
    const saved = localStorage.getItem('bossTrackUser');
    if (saved) {
        currentUser = JSON.parse(saved);
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
    submitUserBtn.addEventListener('click', handleUserSubmit);

    // Manual timer modal
    addManualTimerBtn.addEventListener('click', () => addTimerModal.classList.remove('hidden'));
    closeAddTimerModal.addEventListener('click', () => addTimerModal.classList.add('hidden'));
    cancelAddTimerBtn.addEventListener('click', () => addTimerModal.classList.add('hidden'));
    confirmAddTimerBtn.addEventListener('click', addNewTimer);

    // Visitors
    refreshVisitorsBtn.addEventListener('click', loadVisitors);

    // Scheduled bosses (open modal etc.) -- assumed modal setup already
}
function handleUserSubmit() {
    const ign = ignInput.value.trim();
    const guild = guildInput.value.trim();
    if (!ign || !guild) return alert("Enter IGN and guild");

    currentUser = { ign, guild, isAdmin: guild === ADMIN_GUILD };
    localStorage.setItem('bossTrackUser', JSON.stringify(currentUser));
    userModal.classList.add('hidden');
    mainContent.classList.remove('hidden');

    logVisitor();
    loadTimers();
    loadScheduledBosses();
    loadVisitors();
}

function addNewTimer() {
    const bossName = bossNameInput.value.trim();
    const duration = parseInt(bossDurationInput.value);
    if (!bossName || duration <= 0) return;

    const newTimer = { id:Date.now(), bossName, duration, startTime:Date.now(), isActive:true, createdBy:currentUser.ign };
    timers.push(newTimer);
    saveTimerToFirebase(newTimer);
    renderTimer(newTimer);

    bossNameInput.value = '12';
    addTimerModal.classList.add('hidden');
    sendToDiscord(`⏱️ New timer for ${bossName} (${duration}h) by ${currentUser.ign}`);
}
function renderTimer(timer) {
    const card = document.createElement('div');
    card.className = `timer-card rounded-lg p-4 ${timer.isActive?'active':''}`;
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div><h3>${timer.bossName}</h3><p class="text-sm">${timer.createdBy}</p></div>
            <div class="text-right">
                <span id="countdown-${timer.id}">00:00:00</span>
                <p>Next spawn: <span id="nextSpawn-${timer.id}">00:00</span></p>
            </div>
        </div>
        <div class="flex justify-between mt-2">
            <button data-action="restart" data-id="${timer.id}">Restart</button>
            <button data-action="stop" data-id="${timer.id}">Stop</button>
            <button data-action="send" data-id="${timer.id}">Send</button>
            <button data-action="delete" data-id="${timer.id}">Delete</button>
        </div>
    `;
    manualTimersContainer.appendChild(card);
    feather.replace();
    if (timer.isActive) startCountdown(timer.id, timer.startTime, timer.duration);
}
function startCountdown(id, start, durationH) {
    const end = start + durationH*3600*1000;
    const cdEl = document.getElementById(`countdown-${id}`);
    const nsEl = document.getElementById(`nextSpawn-${id}`);
    const interval = setInterval(()=>{
        const rem = Math.floor((end - Date.now())/1000);
        if(rem<=0){ cdEl.textContent='EXPIRED'; cdEl.classList.add('text-red-500'); clearInterval(interval); }
        else{ cdEl.textContent=formatTime(rem); if(rem%60===0) nsEl.textContent=calculateNextSpawn(start,durationH); }
    },1000);
}

function addNewTimer() {
    const bossName = bossNameInput.value.trim();
    const duration = parseInt(bossDurationInput.value);
    if (!bossName || duration <= 0) return;

    const newTimer = { id:Date.now(), bossName, duration, startTime:Date.now(), isActive:true, createdBy:currentUser.ign };
    timers.push(newTimer);
    saveTimerToFirebase(newTimer);
    renderTimer(newTimer);

    bossNameInput.value = '12';
    addTimerModal.classList.add('hidden');
    sendToDiscord(`⏱️ New timer for ${bossName} (${duration}h) by ${currentUser.ign}`);
}
function renderTimer(timer) {
    const card = document.createElement('div');
    card.className = `timer-card rounded-lg p-4 ${timer.isActive?'active':''}`;
    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div><h3>${timer.bossName}</h3><p class="text-sm">${timer.createdBy}</p></div>
            <div class="text-right">
                <span id="countdown-${timer.id}">00:00:00</span>
                <p>Next spawn: <span id="nextSpawn-${timer.id}">00:00</span></p>
            </div>
        </div>
        <div class="flex justify-between mt-2">
            <button data-action="restart" data-id="${timer.id}">Restart</button>
            <button data-action="stop" data-id="${timer.id}">Stop</button>
            <button data-action="send" data-id="${timer.id}">Send</button>
            <button data-action="delete" data-id="${timer.id}">Delete</button>
        </div>
    `;
    manualTimersContainer.appendChild(card);
    feather.replace();
    if (timer.isActive) startCountdown(timer.id, timer.startTime, timer.duration);
}
function startCountdown(id, start, durationH) {
    const end = start + durationH*3600*1000;
    const cdEl = document.getElementById(`countdown-${id}`);
    const nsEl = document.getElementById(`nextSpawn-${id}`);
    const interval = setInterval(()=>{
        const rem = Math.floor((end - Date.now())/1000);
        if(rem<=0){ cdEl.textContent='EXPIRED'; cdEl.classList.add('text-red-500'); clearInterval(interval); }
        else{ cdEl.textContent=formatTime(rem); if(rem%60===0) nsEl.textContent=calculateNextSpawn(start,durationH); }
    },1000);
}

function addScheduledBoss(bossName, days, time){
    let existing = scheduledBosses.find(b=>b.bossName.toLowerCase()===bossName.toLowerCase());
    if(existing){
        days.forEach(day=>{
            if(!existing.schedules.some(s=>s.day===day && s.time===time)) existing.schedules.push({day,time});
        });
    }else{
        scheduledBosses.push({ bossName, schedules: days.map(day=>({day,time})) });
    }
    saveScheduledBossesToFirebase();
    renderScheduledBosses();
}
function renderScheduledBosses(){
    scheduledBossesContainer.innerHTML='';
    if(scheduledBosses.length===0) { scheduledBossesContainer.innerHTML='<div>No scheduled bosses</div>'; return; }
    scheduledBosses.forEach(boss=>{
        const card=document.createElement('div'); card.className='timer-card p-4';
        let schedulesHtml='';
        boss.schedules.forEach(s=>schedulesHtml+=`<div class="flex justify-between"><span>${s.day} ${s.time}</span><span>${getNextSpawnCountdown(s.day,s.time)}</span></div>`);
        card.innerHTML=`<div class="flex justify-between"><h3>${boss.bossName}</h3><button data-boss="${boss.bossName}">Delete</button></div><div>${schedulesHtml}</div>`;
        scheduledBossesContainer.appendChild(card);
    });
    feather.replace();
    scheduledBossesContainer.querySelectorAll('button[data-boss]').forEach(btn=>{
        btn.addEventListener('click',()=>{ const name=btn.getAttribute('data-boss'); if(confirm(`Delete all schedules for ${name}?`)){ scheduledBosses=scheduledBosses.filter(b=>b.bossName!==name); saveScheduledBossesToFirebase(); renderScheduledBosses(); }});
    });
}

function saveTimerToFirebase(timer){ firebase.database().ref('manualTimers/'+timer.id).set(timer).catch(console.error); }
function saveScheduledBossesToFirebase(){ firebase.database().ref('scheduledBosses').set(scheduledBosses).catch(console.error); }
function sendToDiscord(msg){ const url=DISCORD_WEBHOOKS[activeDiscordWebhook]; if(!url) return; fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:msg})}).catch(console.error);}

