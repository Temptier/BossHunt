// firebase.js
// Firebase Realtime Database wrapper for browser

// Import Firebase SDK from CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { 
  getDatabase, ref, set, push, remove, onValue, get 
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

// TODO: Replace with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyCcZa-fnSwdD36rB_DAR-SSfFlzH2fqcPc",
  authDomain: "lordninetimer.firebaseapp.com",
  databaseURL: "https://lordninetimer-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "lordninetimer",
  storageBucket: "lordninetimer.firebasestorage.app",
  messagingSenderId: "462837939255",
  appId: "1:462837939255:web:dee141d630d5d9b94a53b2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* -------------------------
   CRUD wrappers
------------------------- */
export function saveObject(path, obj) {
  // Overwrite the path
  set(ref(db, path), obj);
}

export function pushObject(path, obj) {
  // Add new child
  push(ref(db, path), obj);
}

export function removePath(path) {
  remove(ref(db, path));
}

export function listenPath(path, cb) {
  // Listen for changes
  onValue(ref(db, path), snapshot => cb(snapshot.val()));
}

export async function getOnce(path) {
  const snapshot = await get(ref(db, path));
  return snapshot.val();
}