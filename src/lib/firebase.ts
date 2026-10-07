import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Backend configuration comes from environment variables —
// never commit keys to git (see .env.example). Local values live in
// .env.local (git-ignored); production values live in Vercel dashboard.
const ENV_NAMES = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID'
] as const;

function readEnv(name: string): string {
  return (import.meta.env[name] as string | undefined) || '';
}

/** Names of missing variables, or null when configured (checked at startup). */
export const firebaseConfigError: string | null = (() => {
  const missing = ENV_NAMES.filter(n => !readEnv(n));
  return missing.length > 0 ? `Missing environment variables: ${missing.join(', ')}` : null;
})();

export const firebaseConfig = {
  apiKey: readEnv('VITE_FIREBASE_API_KEY'),
  authDomain: readEnv('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: readEnv('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: readEnv('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: readEnv('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: readEnv('VITE_FIREBASE_APP_ID')
};

export const isFirebaseConfigured = !firebaseConfigError;

let app!: ReturnType<typeof initializeApp>;
let db!: ReturnType<typeof getFirestore>;
let auth!: ReturnType<typeof getAuth>;

if (!firebaseConfigError) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager()
        })
      });
    } catch {
      db = getFirestore(app);
    }
    auth = getAuth(app);
  } catch (err) {
    console.error('Backend initialization error:', err);
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
} else {
  console.error('Backend misconfigured:', firebaseConfigError);
}

/**
 * Secondary Auth instance for creating new Moderator accounts
 * without signing out the currently logged-in Admin user.
 */
export function getSecondaryAuth() {
  const secondaryAppName = 'TajdeedSecondaryAuth';
  const existingApp = getApps().find(a => a.name === secondaryAppName);
  const secondaryApp = existingApp || initializeApp(firebaseConfig, secondaryAppName);
  return getAuth(secondaryApp);
}

export { app, db, auth };
