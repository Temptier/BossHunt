// firebase.js
// Realtime Database-only helper module (ES module, loadable in browser)

// Import Firebase SDK modules from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  push,
  onValue,
  remove,
  get,
  child
} from "https://www.gstatic.com/firebasejs/10.7.0/firebase-database.js";

/* ---------------------------
   EDIT THIS: your Firebase config
   --------------------------- */
const firebaseConfig = {
  apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  databaseURL: "https://lordninetimer-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.firebasestorage.app",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};

/* ---------------------------
   Initialize
   --------------------------- */
const app = initializeApp(firebaseConfig);
const rdb = getDatabase(app);

/* ---------------------------
   Helpers (RTDB)
   --------------------------- */

export function saveObject(path, obj) {
  // set at path (overwrite)
  return set(ref(rdb, path), obj);
}

export function pushObject(path, obj) {
  // push returns a ref; set returns a promise
  const p = push(ref(rdb, path));
  return set(p, obj).then(() => ({ key: p.key, path: path + '/' + p.key }));
}

export function removePath(path) {
  return remove(ref(rdb, path));
}

export function listenPath(path, callback) {
  const r = ref(rdb, path);
  return onValue(r, (snap) => {
    callback(snap.exists() ? snap.val() : null);
  });
}

export async function getOnce(path) {
  const dbRef = ref(rdb);
  const snap = await get(child(dbRef, path));
  return snap.exists() ? snap.val() : null;
}