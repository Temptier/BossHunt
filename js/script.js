// js/script.js
// Unified timer + scheduled + per-user webhook + 10-min warning + restart/delete/add
// Uses Firebase Realtime Database (v10+ modular usage loaded via CDN in index.html)

// IMPORTANT: index.html includes <script type="module" src="./js/script.js"></script>

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getDatabase, ref, push, set, update, remove, onValue, get
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-database.js";

// --------------------------
// Firebase config
// --------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  databaseURL: "https://lordninetimer-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.firebasestorage.app",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// --------------------------
// Realtime DB refs
// --------------------------
const manualRef = ref(db, "bossTimers");        // shared manual timers
const scheduledRef = ref(db, "scheduledBosses");// shared scheduled timers
const usersRefBase = "users";                   // per-user -> users/{IGN}/webhook

// --------------------------
// DOM elements
// --------------------------
const manualList = document.getElementById("manualList");
const scheduledList = document.getElementById("scheduledList");
const addManualBtn = document.getElementById("addManualBtn");
const restartAllBtn = document.getElementById("restartAllBtn");
const editWebhookBtn = document.getElementById("editWebhookBtn");
const webhookModal = document.getElementById("webhookModal");
const webhookInput = document.getElementById("webhookInput");
const saveWebhookBtn = document.getElementById("saveWebhookBtn");
const cancelWebhook = document.getElementById("cancelWebhook");

const userModal = document.getElementById("userModal");
const ignInput = document.getElementById("ignInput");
const guildInput = document.getElementById("guildInput");
const saveUserBtn = document.getElementById("saveUserBtn");
const changeUserBtn = document.getElementById("changeUserBtn");
const userBadge = document.getElementById("userBadge");

// --------------------------
// State
// --------------------------
let user = { ign: null, guild: null };
let userWebhook = "";             // fetched from users/{IGN}/webhook
let timersCache = {};             // local snapshot of bossTimers
let scheduledCache = {};          // local snapshot of scheduledBosses
let cooldowns = {};               // prevent repeated sends per user (10-min windows)
let warned10Local = {};           // local map to prevent multiple 10-min warnings per client (persisted)

// Persist warned10Local across reload to avoid re-sending immediately after reload
try {
  const savedWarns = localStorage.getItem("warned10Local");
  if (savedWarns) warned10Local = JSON.parse(savedWarns);
} catch (e) { warned10Local = {}; }

// --------------------------
// Utilities
// --------------------------
function fmtRemaining(ms) {
  if (ms <= 0) return "Boss Up!";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}
function colorClass(ms) {
  const minutes = ms / 60000;
  if (minutes <= 0) return "text-red-500";
  if (minutes <= 60) return "text-green-400";
  if (minutes <= 720) return "text-blue-400"; // <= 12 hours considered same day-ish
  return "text-white";
}
function now() { return Date.now(); }

// get user's webhook path
function userWebhookRef(ign) {
  return `${usersRefBase}/${encodeURIComponent(ign)}/webhook`;
}

// request browser permission
if (Notification && Notification.permission !== "granted") {
  Notification.requestPermission().catch(() => {});
}

// --------------------------
// User management (IGN/Guild)
// --------------------------
function loadUserFromLocal() {
  const ign = localStorage.getItem("ln_ign");
  const guild = localStorage.getItem("ln_guild");
  if (ign && guild) {
    user.ign = ign; user.guild = guild;
    return true;
  }
  return false;
}
function showUserModalIfNeeded() {
  if (!loadUserFromLocal()) {
    userModal.style.display = "flex";
  } else {
    updateUserBadge();
    fetchUserWebhook(); // load user's stored webhook
  }
}
function updateUserBadge() {
  userBadge.textContent = `IGN: ${user.ign} | Guild: ${user.guild}`;
}
saveUserBtn.addEventListener("click", () => {
  const ign = ignInput.value.trim();
  const guild = guildInput.value.trim();
  if (!ign || !guild) return alert("Fill IGN and Guild");
  user.ign = ign; user.guild = guild;
  localStorage.setItem("ln_ign", ign);
  localStorage.setItem("ln_guild", guild);
  userModal.style.display = "none";
  updateUserBadge();
  fetchUserWebhook();
});
changeUserBtn.addEventListener("click", () => {
  // show modal and prefill
  ignInput.value = user.ign || "";
  guildInput.value = user.guild || "";
  userModal.style.display = "flex";
});
// initial
showUserModalIfNeeded();

// --------------------------
// Webhook edit floating UI
// --------------------------
editWebhookBtn.addEventListener("click", () => {
  // load current webhook into input
  webhookInput.value = userWebhook || "";
  webhookModal.style.display = "flex";
});
cancelWebhook.addEventListener("click", () => webhookModal.style.display = "none");
saveWebhookBtn.addEventListener("click", async () => {
  const url = webhookInput.value.trim();
  if (!user || !user.ign) return alert("Set IGN/Guild first");
  // save to realtime db under users/{IGN}/webhook
  try {
    await set(ref(db, userWebhookRef(user.ign)), url || "");
    userWebhook = url || "";
    localStorage.setItem("ln_userWebhook", userWebhook);
    webhookModal.style.display = "none";
    alert("Webhook saved for you.");
  } catch (e) {
    console.error(e);
    alert("Failed to save webhook.");
  }
});

// fetch user's webhook from DB (and watch)
async function fetchUserWebhook() {
  if (!user.ign) return;
  const p = userWebhookRef(user.ign);
  const snapshot = await get(ref(db, p));
  userWebhook = snapshot && snapshot.exists() ? snapshot.val() : (localStorage.getItem("ln_userWebhook") || "");
  if (userWebhook) webhookInput.value = userWebhook;
  localStorage.setItem("ln_userWebhook", userWebhook || "");
}

// --------------------------
// Notifications (per-user)
// --------------------------
async function sendUserWebhook(msg) {
  if (!userWebhook) return;
  try {
    await fetch(userWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: msg })
    });
  } catch (e) {
    console.warn("Webhook send failed:", e);
  }
}
function sendBrowserNotification(title, body) {
  try {
    if (Notification && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  } catch (e) {}
}
function sendNotifications(title, body) {
  // local cooldown per event string, 10 minutes (600000ms)
  const key = `${title}:${body}`;
  const last = cooldowns[key] || 0;
  if (Date.now() - last < 10 * 60 * 1000) return;
  cooldowns[key] = Date.now();
  // Browser
  sendBrowserNotification(title, body);
  // Discord per-user webhook
  sendUserWebhook(`**${title}**\n${body}`);
}

// --------------------------
// Render helpers
// --------------------------
function makeManualCard(id, t) {
  // container
  const container = document.createElement("div");
  container.className = "flex justify-between items-center p-3 border border-gray-700 rounded-lg";
  container.id = `manual-${id}`;

  // left
  const left = document.createElement("div");
  const name = document.createElement("div");
  name.className = "font-semibold text-lg";
  name.textContent = t.name;
  const info = document.createElement("div");
  info.className = "text-xs opacity-70";
  info.textContent = `Cycle: ${t.hours}h  •  Auto restart: ${t.autoRestart || 0}m`;
  const status = document.createElement("div");
  status.className = "text-sm opacity-80";
  status.id = `manual-time-${id}`;
  status.textContent = "Loading...";
  left.appendChild(name);
  left.appendChild(status);
  left.appendChild(info);

  // right buttons
  const right = document.createElement("div");
  right.className = "flex gap-2";
  const restartBtn = document.createElement("button");
  restartBtn.textContent = "↻";
  restartBtn.title = "Restart Now";
  restartBtn.className = "bg-blue-600 px-2 py-1 rounded";
  restartBtn.addEventListener("click", async () => {
    const newNext = Date.now() + t.hours * 3600 * 1000;
    await update(ref(db, `bossTimers/${id}`), { nextSpawn: newNext });
    sendNotifications("Boss Restarted", `${t.name} was manually restarted by ${user.ign}`);
  });
  const delBtn = document.createElement("button");
  delBtn.textContent = "✖";
  delBtn.title = "Delete";
  delBtn.className = "bg-red-600 px-2 py-1 rounded";
  delBtn.addEventListener("click", async () => {
    if (!confirm(`Delete timer for ${t.name}?`)) return;
    await set(ref(db, `bossTimers/${id}`), null);
    sendNotifications("Boss Deleted", `${t.name} was removed by ${user.ign}`);
  });
  right.appendChild(restartBtn);
  right.appendChild(delBtn);

  container.appendChild(left);
  container.appendChild(right);
  return container;
}

function makeScheduledCard(name, nextMs) {
  const container = document.createElement("div");
  container.className = "flex justify-between items-center p-3 border border-gray-700 rounded-lg";
  container.id = `sched-${name.replace(/\s+/g, "-")}`;

  const left = document.createElement("div");
  const nm = document.createElement("div");
  nm.className = "font-semibold text-lg";
  nm.textContent = name;
  const status = document.createElement("div");
  status.className = "text-sm opacity-80";
  status.id = `sched-time-${name.replace(/\s+/g, "-")}`;
  status.textContent = "Loading...";
  left.appendChild(nm);
  left.appendChild(status);

  // no delete buttons on merged scheduled list (users could manage via DB console or separate UI)
  container.appendChild(left);
  return container;
}

// --------------------------
// Real-time listeners (shared data)
// --------------------------
onValue(manualRef, (snap) => {
  const data = snap.val() || {};
  timersCache = data;
  // render manual list
  manualList.innerHTML = "";
  Object.entries(data).forEach(([id, t]) => {
    const card = makeManualCard(id, t);
    manualList.appendChild(card);
  });
});

// scheduled list
onValue(scheduledRef, (snap) => {
  const data = snap.val() || {};
  scheduledCache = data;
  // group by name
  const grouped = {};
  Object.entries(data).forEach(([id, sched]) => {
    if (!grouped[sched.name]) grouped[sched.name] = [];
    // maintain id for potential future management
    grouped[sched.name].push({ ...sched, id });
  });

  scheduledList.innerHTML = "";
  Object.entries(grouped).forEach(([name, arr]) => {
    // compute next spawn from all entries for this boss
    const next = getNextSpawnFromArray(arr);
    const card = makeScheduledCard(name, next);
    scheduledList.appendChild(card);
  });
});

// --------------------------
// Add manual / restart all buttons
// --------------------------
addManualBtn.addEventListener("click", async () => {
  const name = prompt("Boss name (e.g. Venatus):");
  const hours = parseFloat(prompt("Cycle in hours (e.g. 10):"));
  const autoRestart = parseInt(prompt("Auto restart minutes (0 = none):"), 10) || 0;
  if (!name || isNaN(hours)) return alert("Invalid input");
  const newObj = {
    name,
    hours,
    autoRestart,
    nextSpawn: Date.now() + hours * 3600 * 1000,
  };
  await push(manualRef, newObj);
});

restartAllBtn.addEventListener("click", async () => {
  if (!confirm("Restart ALL manual timers now?")) return;
  const snapshot = await get(manualRef);
  const data = snapshot.val() || {};
  await Promise.all(Object.entries(data).map(([id, t]) => {
    const newNext = Date.now() + (t.hours || 24) * 3600 * 1000;
    return update(ref(db, `bossTimers/${id}`), { nextSpawn: newNext });
  }));
  alert("All manual timers restarted");
});

// --------------------------
// Scheduled utilities
// --------------------------
function getNextSpawnFromArray(arr) {
  // arr items have fields: day (e.g. Mon), time (e.g. 12:30 PM) OR timeISO if using absolute
  const nowMs = Date.now();
  const candidates = [];

  arr.forEach(item => {
    if (item.time && item.day) {
      // parse day + time -> next occurrence
      const next = getNextOccurrence(item.day, item.time);
      if (next) candidates.push(next);
    } else if (item.times && Array.isArray(item.times)) {
      // older shape where times is array of ISO strings
      item.times.forEach(iso => candidates.push(new Date(iso).getTime()));
    } else if (item.nextSpawn) {
      candidates.push(item.nextSpawn);
    }
    // else ignore unknown shape
  });

  candidates.sort((a,b)=>a-b);
  // choose first candidate in future, else wrap to earliest
  const future = candidates.find(c=>c>nowMs);
  return future || candidates[0] || nowMs;
}

function getNextOccurrence(dayStr, timeStr) {
  // dayStr like Mon, Tue, Sun (case-insensitive); timeStr like "12:30 PM" or "09:15"
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  const ds = dayStr.toLowerCase().slice(0,3);
  const targetDay = days.indexOf(ds);
  if (targetDay === -1) return null;

  // parse time
  // support "HH:MM AM/PM" or "HH:MM"
  let h=0,m=0;
  const parts = timeStr.trim().split(' ');
  const timePart = parts[0];
  const tt = timePart.split(':').map(Number);
  if (tt.length >= 1) h = tt[0];
  if (tt.length >= 2) m = tt[1];
  // AM/PM handling
  if (parts[1]) {
    const mod = parts[1].toUpperCase();
    if (mod === 'PM' && h<12) h += 12;
    if (mod === 'AM' && h===12) h = 0;
  }

  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);

  // move to the next correct weekday
  const diff = (targetDay - candidate.getDay() + 7) % 7;
  if (diff === 0 && candidate.getTime() <= now.getTime()) {
    // same day but time passed -> next week
    candidate.setDate(candidate.getDate() + 7);
  } else {
    candidate.setDate(candidate.getDate() + diff);
  }
  return candidate.getTime();
}

// --------------------------
// Notification & warning checks
// runs every 30s to evaluate states
// --------------------------
setInterval(async () => {
  // manual timers notifications
  const manualSnap = await get(manualRef);
  const manualData = manualSnap.val() || {};

  Object.entries(manualData).forEach(([id, t]) => {
    if (!t.nextSpawn) return;
    const msLeft = t.nextSpawn - Date.now();
    const minsLeft = Math.floor(msLeft / 60000);

    // 10-min warning (per-user)
    const warnedKey = `${user.ign || 'anon'}:${id}:warn10`;
    if (minsLeft <= 10 && minsLeft > 0 && !warned10Local[warnedKey]) {
      // mark locally and persist
      warned10Local[warnedKey] = Date.now();
      localStorage.setItem("warned10Local", JSON.stringify(warned10Local));
      sendNotifications(`⚠️ ${t.name} in 10 minutes`, `${t.name} will spawn in ~10 minutes`);
    }

    // boss up notification
    if (msLeft <= 0) {
      const upKey = `${user.ign || 'anon'}:${id}:up`;
      if (!cooldowns[upKey]) {
        cooldowns[upKey] = Date.now();
        sendNotifications(`🔴 ${t.name} is UP`, `${t.name} is now up!`);
        // auto restart if configured
        if (t.autoRestart && t.autoRestart > 0) {
          const newNext = Date.now() + t.autoRestart * 60000;
          update(ref(db, `bossTimers/${id}`), { nextSpawn: newNext });
          // reset warned10Local for next cycle
          const warnedKeyLocal = `${user.ign || 'anon'}:${id}:warn10`;
          if (warned10Local[warnedKeyLocal]) { delete warned10Local[warnedKeyLocal]; localStorage.setItem("warned10Local", JSON.stringify(warned10Local)); }
        }
      }
    }

    // cleanup cooldowns older than 10 minutes
    Object.keys(cooldowns).forEach(k => {
      if (Date.now() - cooldowns[k] > 10 * 60000) delete cooldowns[k];
    });
  });

  // scheduled timers notifications - merged by boss name
  const schedSnap = await get(scheduledRef);
  const schedData = schedSnap.val() || {};
  const grouped = {};
  Object.values(schedData).forEach(s => {
    if (!grouped[s.name]) grouped[s.name] = [];
    grouped[s.name].push(s);
  });

  Object.entries(grouped).forEach(([name, arr]) => {
    const next = getNextSpawnFromArray(arr);
    const msLeft = next - Date.now();
    const minsLeft = Math.floor(msLeft / 60000);
    const schedKey = `${user.ign || 'anon'}:sched:${name}`;

    // 10-min
    if (minsLeft <= 10 && minsLeft > 0 && !warned10Local[`${schedKey}:warn`]) {
      warned10Local[`${schedKey}:warn`] = Date.now();
      localStorage.setItem("warned10Local", JSON.stringify(warned10Local));
      sendNotifications(`⚠️ ${name} in 10 minutes`, `${name} will spawn in ~10 minutes`);
    }

    // up
    if (msLeft <= 0 && !cooldowns[`${schedKey}:up`]) {
      cooldowns[`${schedKey}:up`] = Date.now();
      sendNotifications(`🔴 ${name} is UP`, `${name} is now up!`);
    }
  });

  // cleanup old warned10Local entries (optional) - keep for 24h
  Object.keys(warned10Local).forEach(k => {
    if (Date.now() - warned10Local[k] > 24 * 3600 * 1000) { delete warned10Local[k]; }
  });
  localStorage.setItem("warned10Local", JSON.stringify(warned10Local));

}, 30 * 1000); // every 30 seconds

// --------------------------
// Live UI countdown updater (1s)
// --------------------------
setInterval(() => {
  // manual
  Object.entries(timersCache).forEach(([id, t]) => {
    const el = document.getElementById(`manual-time-${id}`);
    if (!el) return;
    const msLeft = (t.nextSpawn || 0) - Date.now();
    el.textContent = fmtRemaining(msLeft);
    el.className = `text-sm ${colorClass(msLeft)}`;
  });

  // scheduled
  const schedGrouped = {};
  Object.entries(scheduledCache).forEach(([id, s]) => {
    if (!schedGrouped[s.name]) schedGrouped[s.name] = [];
    schedGrouped[s.name].push(s);
  });
  Object.entries(schedGrouped).forEach(([name, arr]) => {
    const next = getNextSpawnFromArray(arr);
    const el = document.getElementById(`sched-time-${name.replace(/\s+/g,"-")}`);
    if (!el) {
      // create card if not present (rendered by onValue but just in case)
      return;
    }
    const msLeft = next - Date.now();
    el.textContent = fmtRemaining(msLeft);
    el.className = `text-sm ${colorClass(msLeft)}`;
  });
}, 1000);

// --------------------------
// tiny helpers used earlier
// --------------------------
function fmtRemaining(ms) {
  if (ms <= 0) return "Boss Up!";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}
function colorClass(ms) {
  const minutes = ms / 60000;
  if (minutes <= 0) return "text-red-500";
  if (minutes <= 60) return "text-green-400";
  if (minutes <= 720) return "text-blue-400";
  return "text-white";
}

// --------------------------
// start - load initial caches by reading once (onValue above keeps them fresh)
// --------------------------
(async function init() {
  // read initial caches
  const manualSnap = await get(manualRef);
  timersCache = manualSnap.val() || {};
  const schedSnap = await get(scheduledRef);
  scheduledCache = schedSnap.val() || {};

  // update UI if necessary
  // (onValue listeners will populate UI too)
  updateUserBadge();
  fetchUserWebhook();
})();