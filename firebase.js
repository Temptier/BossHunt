// firebase.js
// Firestore helpers and schema for Boss Timer Tracker
// Replace YOUR_* placeholders with project values.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc,
  getDocs, query, where, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.firebasestorage.app",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

/*
 Firestore layout:
 /config/admin           -> { key: "theworldo" }
 /guilds/{guildId}/meta/info
 /guilds/{guildId}/webhooks/{webhookId} -> { url, createdBy, createdAt }
 /guilds/{guildId}/timers/{timerId}     -> timer documents
 /guilds/{guildId}/logs/{logId}         -> activity logs
*/

/* -------------------------
   Admin key helpers
-------------------------*/
export async function getAdminKey() {
  const ref = doc(db, 'config', 'admin');
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().key : 'theworldo';
}
export async function validateAdminKey(inputKey) {
  const key = await getAdminKey();
  return inputKey === key;
}

/* -------------------------
   Guild helpers
-------------------------*/
export async function ensureGuildMeta(guildId, meta = {}) {
  const ref = doc(db, 'guilds', guildId, 'meta', 'info');
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { name: meta.name || guildId, createdAt: serverTimestamp(), ...meta });
  } else if (Object.keys(meta).length) {
    await updateDoc(ref, { ...meta });
  }
}

/* -------------------------
   Timers
-------------------------*/
export async function saveTimer(guildId, timerData) {
  const colRef = collection(db, 'guilds', guildId, 'timers');
  const docRef = await addDoc(colRef, { ...timerData, createdAt: serverTimestamp() });
  return docRef.id;
}
export async function getTimersForGuild(guildId) {
  const col = collection(db, 'guilds', guildId, 'timers');
  const snaps = await getDocs(col);
  return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function updateTimer(guildId, timerId, updates) {
  const ref = doc(db, 'guilds', guildId, 'timers', timerId);
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}
export async function deleteTimer(guildId, timerId) {
  const ref = doc(db, 'guilds', guildId, 'timers', timerId);
  await deleteDoc(ref);
}
export async function stopAllTimers() {
  const guildsSnap = await getDocs(collection(db, 'guilds'));
  for (const gdoc of guildsSnap.docs) {
    const timersSnap = await getDocs(collection(db, 'guilds', gdoc.id, 'timers'));
    for (const t of timersSnap.docs) {
      await updateDoc(doc(db, 'guilds', gdoc.id, 'timers', t.id), { active: false, stoppedAt: serverTimestamp() });
    }
  }
}

/* -------------------------
   Webhooks
-------------------------*/
export async function getGuildWebhooks(guildId) {
  const col = collection(db, 'guilds', guildId, 'webhooks');
  const snaps = await getDocs(col);
  return snaps.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function saveWebhook(guildId, url, createdBy = 'unknown') {
  // prevent duplicates
  const col = collection(db, 'guilds', guildId, 'webhooks');
  const q = query(col, where('url', '==', url));
  const snaps = await getDocs(q);
  if (!snaps.empty) throw new Error('Webhook already exists for this guild');
  const docRef = await addDoc(col, { url, createdBy, createdAt: serverTimestamp() });
  return docRef.id;
}

/* -------------------------
   Logs
-------------------------*/
export async function logAction(guildId, userLabel, action) {
  try {
    const col = collection(db, 'guilds', guildId, 'logs');
    await addDoc(col, { user: userLabel, action, timestamp: serverTimestamp() });
  } catch (e) {
    console.warn('logAction failed', e);
  }
}

/* -------------------------
   Admin helpers
-------------------------*/
export async function getAllGuildsForAdmin() {
  const snaps = await getDocs(collection(db, 'guilds'));
  return snaps.docs.map(d => ({ id: d.id }));
}

/* -------------------------
   Utility
-------------------------*/
export function calculateNextSpawnForScheduled(dayOfWeekString, timeString) {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const targetDay = days.indexOf(dayOfWeekString);
  if (targetDay === -1) return null;
  const [hour, minute] = timeString.split(':').map(Number);
  const now = new Date();
  const candidate = new Date(now);
  candidate.setHours(hour, minute, 0, 0);
  const diff = (targetDay + 7 - candidate.getDay()) % 7;
  if (diff === 0 && candidate <= now) candidate.setDate(candidate.getDate() + 7);
  else candidate.setDate(candidate.getDate() + diff);
  return candidate.toISOString();
}