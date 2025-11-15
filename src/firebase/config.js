import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

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
