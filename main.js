// main.js
import * as Modal from './modals.js';
import { saveObject, pushObject, removePath, listenPath, getOnce } from './firebase.js';

/* -------------------------
   Local storage wrapper
   ------------------------- */
const storage = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};


// App state
let state = {
  userInfo: storage.get('userInfo') || null,
  manual: storage.get('manualBosses') || [],
  scheduled: storage.get('scheduledBosses') || [],
  webhook: storage.get('webhookUrl') || '',
  selections: new Set(),
};

// DOM refs
const userInfoEl = document.getElementById('user-info');
const editInfoBtn = document.getElementById('edit-info');
const stopAllBtn = document.getElementById('stop-all');
const manualList = document.getElementById('manual-list');
const manualEmpty = document.getElementById('manual-empty');
const schedList = document.getElementById('sched-list');
const schedEmpty = document.getElementById('sched-empty');
const todayList = document.getElementById('today-list');
const todayEmpty = document.getElementById('today-empty');
const addManualBtn = document.getElementById('add-manual');
const addSchedBtn = document.getElementById('add-scheduled');
const webhookInput = document.getElementById('webhook-url');
const saveWebhookBtn = document.getElementById('save-webhook');
const controlBosses = document.getElementById('control-bosses');
const openControlBtn = document.getElementById('open-control');
const sendNotifyBtn = document.getElementById('send-notify');
const controlMsg = document.getElementById('control-msg');
const lastAction = document.getElementById('last-action');

const TEN_MIN = 10*60*1000;
let lastWarned = {};

// Helpers
function format12h(date) {
  let h = date.getHours(); const ampm = h>=12?'PM':'AM'; h=h%12||12;
  return `${h}:${String(date.getMinutes()).padStart(2,'0')} ${ampm}`;
}

function formatRemaining(diffMs) {
  if (diffMs<=0) return 'Spawned!';
  const s = Math.floor(diffMs/1000);
  const h = Math.floor(s/3600);
  const m = Math.floor((s%3600)/60);
  const sec = s%60;
  if (h>0) return `${h}h ${m}m ${sec}s`;
  if (m>0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function calcNextForScheduled(b) {
  const now = new Date();
  const next = new Date();
  next.setHours(b.respawnHour, b.respawnMinute,0,0);
  const dayDiff = (b.respawnDay - now.getDay() + 7)%7 || 7;
  next.setDate(next.getDate() + dayDiff);
  return next;
}

function showWarning(msg) {
  lastAction.textContent = `⚠️ ${msg}`;
  setTimeout(()=>{ if(lastAction.textContent.startsWith('⚠️')) lastAction.textContent=''; },8000);
}

async function sendWebhook(content) {
  const url = state.webhook; if(!url) return;
  try {
    await fetch(url,{method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({content,username:'Boss Timer Bot'})});
    lastAction.textContent='Webhook sent';
    setTimeout(()=>{ if(lastAction.textContent==='Webhook sent') lastAction.textContent='';},3000);
  } catch(e){ console.warn(e); }
}

// Render functions
function renderUserInfo() {
  userInfoEl.textContent = state.userInfo?`IGN: ${state.userInfo.ign} | Guild: ${state.userInfo.guild}`:'Set IGN & Guild';
}

function renderManual() {
  manualList.innerHTML='';
  if(!state.manual.length){manualEmpty.style.display='block';return;} manualEmpty.style.display='none';
  state.manual.forEach(b=>{
    const el=document.createElement('div'); el.className='list-item'; el.id=`manual-${b.id}`;
    const targetText = b.target?formatRemaining(new Date(b.target)-new Date()):'Not started';
    el.innerHTML=`<div><strong>${b.name}</strong> (${b.respawnMinutes}m)<div class="muted">${targetText}</div></div>
      <div><button data-action="start" data-id="${b.id}">Start</button><button data-action="restart" data-id="${b.id}">Restart</button><button data-action="delete" data-id="${b.id}">Delete</button></div>`;
    manualList.appendChild(el);
  });
}

function renderScheduled() {
  schedList.innerHTML='';
  if(!state.scheduled.length){schedEmpty.style.display='block';return;} schedEmpty.style.display='none';
  state.scheduled.forEach(b=>{
    const el=document.createElement('div'); el.className='list-item'; el.id=`sched-${b.id}`;
    const next = calcNextForScheduled(b);
    el.innerHTML=`<div><strong>${b.name}</strong><div class="muted">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][b.respawnDay]} ${format12h(next)}</div></div>
      <div><button data-action="delete-sched" data-id="${b.id}">Delete</button></div>`;
    schedList.appendChild(el);
  });
}

function renderToday() {
  todayList.innerHTML='';
  const today = new Date().getDay();
  const todays = [...state.manual, ...state.scheduled.filter(b=>b.respawnDay===today)];
  if(!todays.length){todayEmpty.style.display='block';return;} todayEmpty.style.display='none';
  todays.forEach(b=>{
    const el=document.createElement('div'); el.className='list-item';
    const time = b.respawnMinutes?`${b.respawnMinutes}m` : format12h(calcNextForScheduled(b));
    el.innerHTML=`<strong>${b.name}</strong> <span class="muted">${time}</span>`;
    todayList.appendChild(el);
  });
}

// Tick loop
function tick() {
  const now = new Date();
  state.manual.forEach(b=>{
    if(!b.target) return;
    const diff = new Date(b.target)-now;
    if(diff<=TEN_MIN && diff>0 && !lastWarned[b.id]){ lastWarned[b.id]=true; showWarning(`${b.name} <10 min`); sendWebhook(`${b.name} <10 min`); }
    if(diff<=0 && b.enableAutoReset && !b._autoReseted){
      b._autoReseted=true;
      b.target=new Date(now.getTime()+b.respawnMinutes*60*1000).toISOString();
      storage.set('manualBosses', state.manual);
    }
  });
  renderManual(); renderScheduled(); renderToday();
}

setInterval(tick,1000);

// Event listeners
addManualBtn.onclick=()=>Modal.showAddManual(b=>{ state.manual.push(b); storage.set('manualBosses',state.manual); renderManual(); renderToday(); });
addSchedBtn.onclick=()=>Modal.showAddScheduled(b=>{ state.scheduled.push(b); storage.set('scheduledBosses',state.scheduled); renderScheduled(); renderToday(); });
editInfoBtn.onclick=()=>Modal.showWelcome(state.userInfo,d=>{state.userInfo=d; storage.set('userInfo',d); renderUserInfo();});
stopAllBtn.onclick=()=>{ const pass=prompt('Password'); if(pass==='theworldo'){ state.manual.forEach(b=>b.target=null); state.scheduled.forEach(b=>b._stopped=true); renderManual(); renderScheduled(); renderToday(); alert('Timers stopped'); } else alert('Incorrect'); };
saveWebhookBtn.onclick=()=>{ state.webhook=webhookInput.value; storage.set('webhookUrl',state.webhook); alert('Saved'); };
initFromStorage();

function initFromStorage(){
  webhookInput.value=state.webhook||'';
  renderUserInfo(); renderManual(); renderScheduled(); renderToday();
}