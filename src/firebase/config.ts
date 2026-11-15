import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  memoryLocalCache,
  setLogLevel
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

// Suppress non-fatal retry logs while preserving genuine write/permission errors
setLogLevel('error');

// Clean up any stale Firestore multi-tab localStorage keys from previous sessions
// that can fill up the 5MB Web Storage quota and cause QuotaExceededError / b815 assertion crashes.
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith('firestore_')) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {}
    });
  }
} catch {}

// Robust Firestore initialization:
// Enables auto/forced long polling to safely and instantly connect across preview iframes and proxies.
// Uses memoryLocalCache so Firestore never hits localStorage QuotaExceededError or multi-tab assertion ID b815.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: memoryLocalCache()
  }, databaseId);
} catch {
  try {
    firestoreDb = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      localCache: memoryLocalCache()
    }, databaseId);
  } catch {
    firestoreDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db = firestoreDb;
