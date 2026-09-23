import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const databaseId = (firebaseConfig as any).firestoreDatabaseId || undefined;

// Robust Firestore initialization:
// Enables auto-detect long polling to safely traverse proxies, sandboxes, and preview iframes.
// Includes persistent local caching with multi-tab support for seamless offline operation.
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  }, databaseId);
} catch {
  try {
    firestoreDb = initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true
    }, databaseId);
  } catch {
    firestoreDb = databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

export const db = firestoreDb;



