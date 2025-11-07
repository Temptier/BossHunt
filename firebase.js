
  

// firebase.js — global timers & webhooks (no guild)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  updateDoc, doc, deleteDoc, serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.firebasestorage.app",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ------------------ TIMERS ------------------
const timersCol = collection(db, 'timers');

export async function getAllTimers() {
  const snaps = await getDocs(query(timersCol, orderBy('nextSpawn', 'asc')));
  return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveTimer(timerData) {
  const docRef = await addDoc(timersCol, { ...timerData, createdAt: serverTimestamp() });
  return docRef.id;
}

export async function updateTimer(timerId, updatedData) {
  const docRef = doc(timersCol, timerId);
  await updateDoc(docRef, updatedData);
}

export async function deleteTimer(timerId) {
  const docRef = doc(timersCol, timerId);
  await deleteDoc(docRef);
}

// Stop all timers globally
export async function stopAllTimers() {
  const timers = await getAllTimers();
  for (const t of timers) {
    await updateTimer(t.id, { active: false, stoppedAt: new Date().toISOString() });
  }
}

// ------------------ WEBHOOKS ------------------
const webhooksCol = collection(db, 'webhooks');

export async function getAllWebhooks() {
  const snaps = await getDocs(webhooksCol);
  return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveWebhook(webhookData) {
  // prevent duplicate URL
  const all = await getAllWebhooks();
  if (all.some(w => w.url === webhookData.url)) return null;
  const docRef = await addDoc(webhooksCol, { ...webhookData, createdAt: serverTimestamp() });
  return docRef.id;
}

// ------------------ LOGGING ------------------
const logsCol = collection(db, 'logs');

export async function logAction(user, action) {
  await addDoc(logsCol, { user, action, timestamp: serverTimestamp() });
}

// ------------------ ADMIN ------------------
const adminCol = collection(db, 'admin');

export async function validateAdminKey(phrase) {
  const snaps = await getDocs(adminCol);
  return snaps.docs.some(d => d.data().key === phrase);
}

// ------------------ SCHEDULED HELPERS ------------------
export function calculateNextSpawnForScheduled(day, timeStr) {
  // day = 'Monday', timeStr = '14:00'
  const today = new Date();
  const daysOfWeek = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const targetDayIndex = daysOfWeek.indexOf(day);
  if (targetDayIndex === -1) return null;

  const [hours, minutes] = timeStr.split(':').map(Number);
  let next = new Date(today);
  next.setHours(hours, minutes, 0, 0);

  const diff = (targetDayIndex - next.getDay() + 7) % 7;
  if (diff === 0 && next <= today) next.setDate(next.getDate() + 7);
  else next.setDate(next.getDate() + diff);

  return next.toISOString();
}