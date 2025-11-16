// main.js
import * as Modal from './modals.js';
import { saveObject, pushObject, removePath, listenPath, getOnce } from './firebase.js';

/* -------------------------
   Local storage wrapper
------------------------- */
const storage = {
  get(k){ try{return JSON.parse(localStorage.getItem(k));} catch{return null;} },
  set(k,v){ localStorage.setItem(k,JSON.stringify(v)); }
};

/* -------------------------
   App state
------------------------- */
let state = {
  userInfo: storage.get('userInfo')||null,
  manual: storage.get('manualBosses')||[],
  scheduled: storage.get('scheduledBosses')||[],
  webhook: storage.get('webhookUrl')||'',
  selections: new Set(),
  lastWarned: {}
};

/* -------------------------
   DOM references
------------------------- */
const userInfoEl=document.getElementById('user-info');
const editInfoBtn=document.getElementById('edit-info');
const stopAllBtn=document.getElementById('stop-all');

const manualList=document.getElementById('manual-list');
const manualEmpty=document.getElementById('manual-empty');
const schedList=document.getElementById('sched-list');
const schedEmpty=document.getElementById('sched-empty');
const todayList=document.getElementById('today-list');
const todayEmpty=document.getElementById('today-empty');

const addManualBtn=document.getElementById('add-manual');
const addSchedBtn=document.getElementById('add-scheduled');

const webhookInput=document.getElementById('webhook-url');
const saveWebhookBtn=document.getElementById('save-webhook');

const controlBosses=document.getElementById('control-bosses');
const openControlBtn=document.getElementById('open-control');
const sendNotifyBtn=document.getElementById('send-notify');
const controlMsg=document.getElementById('control-msg');
const lastAction=document.getElementById('last-action');

/* -------------------------
   Helpers
------------------------- */
function formatTime12(date){
  let h=date.getHours();
  const m=date.getMinutes().toString().padStart(2,'0');
  const ampm=h>=12?'PM':'AM';
  h=h%12||12;
  return `${h}:${m} ${ampm}`;
}

function formatRemaining(diffMs){
  if(diffMs<=0) return 'Spawned!';
  const s=Math.floor(diffMs/1000);
  const h=Math.floor(s/3600);
  const m=Math.floor((s%3600)/60);
  const sec=s%60;
  if(h>0) return `${h}h ${m}m ${sec}s`;
  if(m>0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function calcNextScheduled(b){
  const now=new Date();
  const targetDay=parseInt(b.respawnDay);
  const targetHour=parseInt(b.respawnHour);
  const targetMinute=parseInt(b.respawnMinute);
  let next=new Date();
  next.setHours(targetHour,targetMinute,0,0);
  const diffDay=(targetDay-now.getDay()+7)%7;
  if(diffDay===0 && next<=now) next.setDate(next.getDate()+7);
  else next.setDate(next.getDate()+diffDay);
  return next;
}

/* -------------------------
   Warnings & webhook
------------------------- */
const TEN_MIN=10*60*1000;

function showWarning(msg){
  lastAction.textContent=`⚠️ ${msg}`;
  setTimeout(()=>{if(lastAction.textContent.startsWith('⚠️')) lastAction.textContent='';},8000);
}

async function sendWebhook(msg){
  const url=state.webhook; if(!url) return;
  try{
    const res=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content:msg,username:'Boss Timer Bot'})});
    if(!res.ok){ console.warn('Webhook failed',await res.text()); }
    lastAction.textContent='Webhook sent';
    setTimeout(()=>{ if(lastAction.textContent==='Webhook sent') lastAction.textContent=''; },3000);
  }catch(e){ console.warn('Webhook error',e);}
}

/* -------------------------
   Rendering
------------------------- */
function renderUserInfo(){
  userInfoEl.textContent=state.userInfo?`IGN: ${state.userInfo.ign} | Guild: ${state.userInfo.guild}`:'Please set your IGN & Guild';
}

function renderManual(){
  manualList.innerHTML='';
  if(state.manual.length===0){ manualEmpty.style.display='block'; return; }
  manualEmpty.style.display='none';
  state.manual.forEach(b=>{
    const div=document.createElement('div');
    div.className='list-item';
    div.id=`manual-${b.id}`;
    div.innerHTML=`
      <div><strong>${b.name}</strong><div class="muted">${b.target?formatRemaining(new Date(b.target)-new Date()):'Not started'}</div></div>
      <div class="flex">
        <button data-action="start" data-id="${b.id}">Start</button>
        <button data-action="restart" data-id="${b.id}">Restart</button>
        <button data-action="delete" data-id="${b.id}">Delete</button>
      </div>
    `;
    manualList.appendChild(div);
  });
}

function renderScheduled(){
  schedList.innerHTML='';
  if(state.scheduled.length===0){ schedEmpty.style.display='block'; return; }
  schedEmpty.style.display='none';
  state.scheduled.forEach(b=>{
    const next=calcNextScheduled(b);
    const div=document.createElement('div');
    div.className='list-item';
    div.id=`sched-${b.id}`;
    div.innerHTML=`
      <div><strong>${b.name}</strong><div class="muted">${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][b.respawnDay]} ${formatTime12(next)}</div></div>
      <div class="flex">
        <button data-action="delete" data-id="${b.id}">Delete</button>
      </div>
    `;
    schedList.appendChild(div);
  });
}

function renderToday(){
  todayList.innerHTML='';
  const today=new Date().getDay();
  const todays=[...state.manual,...state.scheduled].filter(b=>{
    if(b.respawnDay!==undefined) return parseInt(b.respawnDay)===today;
    return b.target && new Date(b.target).getDay()===today;
  });
  if(todays.length===0){ todayEmpty.style.display='block'; return; }
  todayEmpty.style.display='none';
  todays.forEach(b=>{
    const div=document.createElement('div');
    div.className='list-item';
    const time=b.target?formatTime12(new Date(b.target)):b.respawnHour!==undefined?formatTime12(calcNextScheduled(b)): '--';
    div.innerHTML=`<strong>${b.name}</strong> <span class="muted">${time}</span>`;
    todayList.appendChild(div);
  });
}

function renderControl(){
  controlBosses.innerHTML='';
  const all=[...state.manual,...state.scheduled];
  if(all.length===0){ controlBosses.innerHTML='<div class="muted">No bosses</div>'; return; }
  all.forEach(b=>{
    const div=document.createElement('div');
    div.className='list-item';
    const checked=state.selections.has(b.id)?'background:#c7f3ff':'';
    div.style=checked;
    div.innerHTML=`<div><strong>${b.name}</strong></div><div><button data-toggle="${b.id}">${state.selections.has(b.id)?'Unselect':'Select'}</button></div>`;
    controlBosses.appendChild(div);
  });
}

/* -------------------------
   Tick loop
------------------------- */
function tick(){
  const now=new Date();
  // manual timers
  state.manual.forEach(b=>{
    if(b.target){
      const diff=new Date(b.target)-now;
      const el=document.getElementById(`manual-${b.id}`);
      if(el) el.querySelector('.muted').textContent=formatRemaining(diff);
      if(diff<=TEN_MIN && diff>0 && !state.lastWarned[b.id]){
        state.lastWarned[b.id]=true;
        showWarning(`${b.name} will spawn in 10 min`);
        sendWebhook(`10-min warning: ${b.name} will spawn in ${formatRemaining(diff)}`);
      }
      if(diff<=0 && b.enableAutoReset && !b._autoReseted){
        b._autoReseted=true;
        b.target=new Date(now.getTime()+b.respawnMinutes*60*1000).toISOString();
        storage.set('manualBosses',state.manual);
      }
    }
  });

  // scheduled timers
  state.scheduled.forEach(b=>{
    const next=calcNextScheduled(b);
    const diff=next-now;
    const el=document.getElementById(`sched-${b.id}`);
    if(el) el.querySelector('.muted').textContent=formatTime12(next);
    if(diff<=TEN_MIN && diff>0 && !state.lastWarned[b.id]){
      state.lastWarned[b.id]=true;
      showWarning(`${b.name} scheduled in 10 min`);
      sendWebhook(`10-min warning: scheduled ${b.name}`);
    }
  });

  renderControl();
}

setInterval(tick,1000);

/* -------------------------
   Event listeners
------------------------- */
addManualBtn.onclick=()=>Modal.showAddManual(b=>{
  state.manual.push(b); storage.set('manualBosses',state.manual); renderManual(); renderToday(); renderControl();
});

addSchedBtn.onclick=()=>Modal.showAddScheduled(b=>{
  state.scheduled.push(b); storage.set('scheduledBosses',state.scheduled); renderScheduled(); renderToday(); renderControl();
});

editInfoBtn.onclick=()=>Modal.showWelcome(state.userInfo,data=>{
  state.userInfo=data; storage.set('userInfo',data); renderUserInfo();
});

stopAllBtn.onclick=()=>{
  const pass=prompt('Enter password to stop all timers');
  if(pass==='theworldo'){
    state.manual.forEach(b=>b.target=null);
    storage.set('manualBosses',state.manual);
    renderManual(); renderToday();
    alert('All timers stopped');
  } else alert('Incorrect password');
};

manualList.addEventListener('click',e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const id=btn.dataset.id; const action=btn.dataset.action;
  const idx=state.manual.findIndex(b=>b.id===id);
  if(action==='delete' && idx>-1) Modal.showDeleteConfirm(state.manual[idx].name,()=>{ state.manual.splice(idx,1); storage.set('manualBosses',state.manual); renderManual(); renderToday(); renderControl(); });
  if(action==='start' && idx>-1){ const now=new Date(); state.manual[idx].target=new Date(now.getTime()+state.manual[idx].respawnMinutes*60000).toISOString(); renderManual(); renderToday(); }
  if(action==='restart' && idx>-1){ const now=new Date(); state.manual[idx].target=new Date(now.getTime()+state.manual[idx].respawnMinutes*60000).toISOString(); state.manual[idx]._autoReseted=false; renderManual(); renderToday(); }
});

schedList.addEventListener('click',e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const id=btn.dataset.id; if(btn.dataset.action==='delete'){ const idx=state.scheduled.findIndex(b=>b.id===id); if(idx>-1) state.scheduled.splice(idx,1); storage.set('scheduledBosses',state.scheduled); renderScheduled(); renderToday(); renderControl(); }
});

saveWebhookBtn.onclick=()=>{
  const url=webhookInput.value.trim(); if(!url){ alert('Enter webhook'); return; }
  state.webhook=url; storage.set('webhookUrl',url); alert('Webhook saved');
};

controlBosses.addEventListener('click',e=>{
  const btn=e.target.closest('button'); if(!btn) return;
  const id=btn.dataset.toggle; if(!id) return;
  if(state.selections.has(id)) state.selections.delete(id); else state.selections.add(id);
  renderControl();
});

sendNotifyBtn.onclick=async ()=>{
  if(state.selections.size===0){ alert('Select at least one boss'); return; }
  const names=[...state.selections].map(id=>{ const m=state.manual.find(b=>b.id===id); if(m) return m.name; const s=state.scheduled.find(b=>b.id===id); if(s) return s.name; return id; });
  const msg=controlMsg.value||'';
  await sendWebhook(`${msg}\nBosses: ${names.join(', ')}`);
  lastAction.textContent=`Last: ${new Date().toLocaleTimeString()}`;
  setTimeout(()=>{ lastAction.textContent='';},3000);
};

/* -------------------------
   Init
------------------------- */
function init(){
  renderUserInfo(); renderManual(); renderScheduled(); renderToday(); renderControl();
  webhookInput.value=state.webhook;
}

init();