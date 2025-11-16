import { showWelcomeModal, showAddBossModal, confirmDelete } from './modals.js';

// Local Storage Wrapper
const storage = {
  get: (key) => JSON.parse(localStorage.getItem(key) || 'null'),
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

// Firebase setup
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getDatabase, ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  databaseURL: "https://lordninetimer-default-rtdb.firebaseio.com",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.appspot.com",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// State
let userInfo = storage.get('userInfo');
let manualBosses = storage.get('manualBosses') || [];
let scheduledBosses = storage.get('scheduledBosses') || [];
let webhookUrl = storage.get('webhookUrl') || '';
let timersStopped = false;

// Realtime Sync
const dbRef = ref(db, 'bosses');
onValue(dbRef, (snapshot) => {
  const data = snapshot.val();
  if (!data) return;
  manualBosses = data.manual || [];
  scheduledBosses = data.scheduled || [];
  renderTimers();
});

// Helper
function saveToDB() {
  set(dbRef, { manual: manualBosses, scheduled: scheduledBosses });
  storage.set('manualBosses', manualBosses);
  storage.set('scheduledBosses', scheduledBosses);
}

// Rendering
function renderTimers() {
  const root = document.getElementById('root');
  root.innerHTML = '';

  // Welcome
  if (!userInfo) {
    showWelcomeModal(data => {
      userInfo = data;
      storage.set('userInfo', userInfo);
      renderTimers();
    });
    return;
  }

  const html = document.createElement('div');
  html.innerHTML = `
    <h1>${userInfo.ign} | ${userInfo.guild}</h1>
    <button id="addManual">Add Manual Boss</button>
    <button id="addScheduled">Add Scheduled Boss</button>
    <button id="stopAll">Stop All</button>
    <div id="todaySchedule"></div>
    <div id="manualTimers"></div>
    <div id="scheduledTimers"></div>
  `;
  root.appendChild(html);

  document.getElementById('addManual').onclick = () =>
    showAddBossModal('manual', boss => {
      manualBosses.push(boss);
      saveToDB();
      renderTimers();
    });

  document.getElementById('addScheduled').onclick = () =>
    showAddBossModal('scheduled', boss => {
      scheduledBosses.push(boss);
      saveToDB();
      renderTimers();
    });

  document.getElementById('stopAll').onclick = () => {
    timersStopped = !timersStopped;
    Swal.fire({
      icon: 'info',
      text: timersStopped ? 'All timers stopped' : 'Timers resumed'
    });
  };

  // Manual Timers
  const manualDiv = document.getElementById('manualTimers');
  manualBosses.forEach((boss, i) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <b>${boss.name}</b> 
      <span id="timerManual${i}"></span>
      <button id="delManual${i}">Delete</button>
    `;
    manualDiv.appendChild(div);

    document.getElementById(`delManual${i}`).onclick = () => confirmDelete(boss.name, () => {
      manualBosses.splice(i, 1);
      saveToDB();
      renderTimers();
    });
  });

  // Scheduled Timers
  const schedDiv = document.getElementById('scheduledTimers');
  scheduledBosses.forEach((boss, i) => {
    const div = document.createElement('div');
    div.innerHTML = `
      <b>${boss.name}</b> 
      <span id="timerSched${i}"></span>
      <button id="delSched${i}">Delete</button>
    `;
    schedDiv.appendChild(div);

    document.getElementById(`delSched${i}`).onclick = () => confirmDelete(boss.name, () => {
      scheduledBosses.splice(i, 1);
      saveToDB();
      renderTimers();
    });
  });

  // Today's Schedule (both types)
  const todayDiv = document.getElementById('todaySchedule');
  const today = new Date().getDay();
  const todayBosses = [
    ...manualBosses.filter(b => new Date(b.endTime).getDay() === today),
    ...scheduledBosses.filter(b => b.respawnDay === today)
  ];
  todayDiv.innerHTML = `<h3>Today's Schedule</h3>`;
  todayBosses.forEach(b => {
    const p = document.createElement('p');
    p.textContent = `${b.name} - ${formatTime(b)}`;
    todayDiv.appendChild(p);
  });
}

// Timer Loop
setInterval(() => {
  if (timersStopped) return;

  const allTimers = [...manualBosses, ...scheduledBosses];
  const now = new Date().getTime();

  allTimers.forEach((boss, i) => {
    // Initialize endTime if missing
    if (!boss.endTime) {
      const end = new Date();
      end.setHours(boss.respawnHour || end.getHours(), boss.respawnMinute || end.getMinutes());
      boss.endTime = end.getTime() + (boss.respawnMinutes || 60) * 60000;
    }

    const diff = boss.endTime - now;

    // Auto reset
    if (diff <= 0) {
      boss.endTime = now + (boss.respawnMinutes || 60) * 60000;
      saveToDB();
    }

    // 10 minutes warning
    if (boss.webhookUrl && diff <= 10*60*1000 && diff >= 10*60*1000 - 1000) {
      sendWebhook(boss, `${boss.name} will spawn in 10 minutes!`);
    }

    // Update timers on page
    const hours = Math.floor(diff/3600000);
    const minutes = Math.floor((diff % 3600000)/60000);
    const seconds = Math.floor((diff % 60000)/1000);
    const timeStr = `${hours % 12 || 12}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')} ${hours >= 12 ? 'PM':'AM'}`;

    if (boss.respawnDay !== undefined && document.getElementById(`timerSched${i}`))
      document.getElementById(`timerSched${i}`).textContent = timeStr;

    if (boss.respawnMinutes !== undefined && document.getElementById(`timerManual${i}`))
      document.getElementById(`timerManual${i}`).textContent = timeStr;
  });
}, 1000);

// Helper functions
function formatTime(b) {
  let date = new Date(b.endTime || Date.now());
  let h = date.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(date.getMinutes()).padStart(2,'0')} ${ampm}`;
}

function sendWebhook(boss, message) {
  if (!boss.webhookUrl) return;
  fetch(boss.webhookUrl, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ content: message, username: 'Boss Timer Bot' })
  });
}

// Initial render
renderTimers();