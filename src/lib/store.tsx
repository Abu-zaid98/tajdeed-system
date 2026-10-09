import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import type {
  Admin,
  Settings,
  Subscriber,
  Subscription,
  Payment,
  AuditLog,
  BackupMeta,
  SubscriberWithDetails,
  PlanType,
  PayStatus,
  Role,
  ModeratorPermission
} from '../types';
import { ALL_MODERATOR_PERMISSIONS } from '../types';
import {
  initialSettings,
  initialAdmins,
  initialSubscribers,
  initialSubscriptions,
  initialPayments,
  initialAuditLogs
} from './mockData';
import { computeSubscriptionStatus, resolveCycleDates } from './dates';
import { downloadJsonFile, splitStringToByteChunks, stableStringify, computePlanChangeBalance, applyCreditToCharge } from './utils';
import { auth, db, getSecondaryAuth } from './firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { toast } from 'sonner';

/**
 * Database rejects documents containing `undefined` values.
 * This helper recursively removes all undefined fields before writing.
 */
function cleanForFirestore<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_, value) =>
    value === undefined ? null : value
  )) as T;
}

/** Firestore permission failures need an actionable Arabic message, not the raw SDK text. */
function isPermissionError(e: any): boolean {
  return e?.code === 'permission-denied' ||
    /missing or insufficient permissions/i.test(String(e?.message || ''));
}

const PERMISSION_DENIED_MSG = 'تعذّر الوصول لقاعدة البيانات بسبب الصلاحيات — تأكد من نشر أحدث قواعد Firestore ثم أعد المحاولة';

/**
 * Allocates the next official receipt number (YYYY-NNNN) from a yearly
 * server-side counter transaction — unique even with concurrent devices.
 * Requires connectivity; fails fast offline (caller falls back to pending).
 */
async function allocateReceiptNo(year: string): Promise<string> {
  if (!db) throw new Error('backup backend unavailable');
  const seq = await runTransaction(db, async (tx) => {
    const ref = doc(db, 'counters', `receipts_${year}`);
    const snap = await tx.get(ref);
    const next = (Number(snap.data()?.next) || 0) + 1;
    tx.set(ref, { next }, { merge: true });
    return next;
  });
  return `${year}-${String(seq).padStart(4, '0')}`;
}

interface AppContextType {
  // Current user & Auth
  currentAdmin: Admin | null;
  setCurrentAdmin: (admin: Admin | null) => void;
  admins: Admin[];
  hasPermission: (permission: ModeratorPermission) => boolean;
  createModerator: (params: {
    name: string;
    email: string;
    password?: string;
    permissions: ModeratorPermission[];
    active?: boolean;
    role?: Role;
  }) => Promise<void>;
  updateModerator: (
    id: string,
    updates: {
      name?: string;
      email?: string;
      permissions?: ModeratorPermission[];
      active?: boolean;
      role?: Role;
    },
    opts?: { base?: unknown; force?: boolean }
  ) => Promise<void>;
  toggleAdminActive: (id: string) => Promise<void>;
  deleteModerator: (id: string) => Promise<void>;
  updateAdminRole: (id: string, role: Role, active: boolean) => void;
  createAdmin: (admin: Omit<Admin, 'id' | 'createdAt'>) => void;
  loginWithFirebase: (email: string, password: string, opts?: { rememberMe?: boolean }) => Promise<void>;
  setupInitialAdmin: (name: string, email: string, password: string) => Promise<void>;
  logoutFromFirebase: () => Promise<void>;
  authLoading: boolean;

  // Settings
  settings: Settings;
  updateSettings: (newSettings: Partial<Settings>) => void;

  // Subscribers
  subscribers: Subscriber[];
  subscribersWithDetails: SubscriberWithDetails[];
  addSubscriber: (sub: Omit<Subscriber, 'id' | 'archived' | 'createdAt'>, initialSubCycle?: {
    username: string;
    password: string;
    durationDays?: number;
    price?: number;
    startDate?: string;
    endDate?: string;
    paidAmount?: number;
  }) => Promise<string>;
  updateSubscriber: (id: string, updates: Partial<Subscriber>, opts?: { base?: unknown; force?: boolean }) => Promise<void>;
  toggleArchiveSubscriber: (id: string) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;

  // Subscriptions
  subscriptions: Subscription[];
  renewSubscription: (subscriberId: string, customOptions?: {
    durationDays?: number;
    price?: number;
    username?: string;
    password?: string;
    startDate?: string;
    endDate?: string;
  }) => Promise<string>;
  updateSubscription: (id: string, updates: Partial<Subscription>, opts?: { base?: unknown; force?: boolean }) => Promise<void>;
  changeSubscriptionPlan: (subscriberId: string, newPlan: PlanType, cyclePrice: number, creds?: { username?: string; password?: string }) => Promise<void>;

  // Payments
  payments: Payment[];
  addPayment: (params: {
    subscriptionId: string;
    subscriberId: string;
    amount: number;
    note?: string;
    date?: string;
  }) => Promise<Payment | null>;
  deletePayment: (paymentId: string) => Promise<void>;
  updatePayment: (paymentId: string, updates: { amount?: number; note?: string }, opts?: { base?: unknown; force?: boolean }) => Promise<void>;

  // Audit Logs
  auditLogs: AuditLog[];
  logAuditAction: (params: {
    action: string;
    entity: AuditLog['entity'];
    entityId: string;
    entityName?: string;
    before?: unknown;
    after?: unknown;
  }) => void;

  // Connectivity & Sync Status
  isOnline: boolean;
  isSyncing: boolean;
  /** Writes sent to the database but not yet acknowledged by the server. */
  pendingWrites: number;

  /** A concurrent-edit conflict awaiting the user's decision, if any. */
  pendingConflict: {
    kind: 'subscriber' | 'subscription' | 'payment' | 'admin';
    id: string;
    name: string;
    retry: () => void;
  } | null;
  resolveConflict: (save: boolean) => void;

  // Backup & Import
  exportAllData: () => object;
  importAllData: (jsonData: any) => Promise<boolean>;
  resetToCleanData: () => void;

  // Cloud backups (periodic + manual)
  backups: BackupMeta[];
  createCloudBackup: (manual?: boolean) => Promise<string>;
  restoreCloudBackup: (id: string) => Promise<boolean>;
  deleteCloudBackup: (id: string) => Promise<void>;
  downloadCloudBackup: (id: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

const STORAGE_KEYS = {
  VERSION: 'tajdeed_storage_version_v2',
  SETTINGS: 'tajdeed_settings_v2',
  ADMINS: 'tajdeed_admins_v2',
  CURRENT_ADMIN: 'tajdeed_current_admin_v2',
  SUBSCRIBERS: 'tajdeed_subscribers_v2',
  SUBSCRIPTIONS: 'tajdeed_subscriptions_v2',
  PAYMENTS: 'tajdeed_payments_v2',
  AUDIT_LOGS: 'tajdeed_audit_logs_v2'
};

// Clear legacy mock data if on older version
if (localStorage.getItem(STORAGE_KEYS.VERSION) !== 'v2_shekel_clean') {
  localStorage.removeItem('tajdeed_settings_v1');
  localStorage.removeItem('tajdeed_subscribers_v1');
  localStorage.removeItem('tajdeed_subscriptions_v1');
  localStorage.removeItem('tajdeed_payments_v1');
  localStorage.removeItem('tajdeed_audit_logs_v1');
  localStorage.removeItem(STORAGE_KEYS.SUBSCRIBERS);
  localStorage.removeItem(STORAGE_KEYS.SUBSCRIPTIONS);
  localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
  localStorage.setItem(STORAGE_KEYS.VERSION, 'v2_shekel_clean');
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingWrites, setPendingWrites] = useState<number>(0);

  /**
   * Counts database writes that have been sent but not yet acknowledged
   * by the server. A write promise only settles on server acknowledgement,
   * so offline writes stay counted until the connection returns.
   * Genuine failures (permissions, rules) surface one throttled error toast.
   */
  const lastWriteErrorAt = useRef(0);
  const notifyWriteError = () => {
    const now = Date.now();
    if (now - lastWriteErrorAt.current < 5000) return;
    lastWriteErrorAt.current = now;
    toast.error('تعذّر الحفظ في قاعدة البيانات — تحقق من الاتصال والصلاحيات');
  };
  const trackWrite = <T,>(promise: Promise<T>): Promise<T> => {
    setPendingWrites((n) => n + 1);
    setIsSyncing(true);
    const settle = () => {
      setPendingWrites((n) => {
        const next = Math.max(0, n - 1);
        if (next === 0) setIsSyncing(false);
        return next;
      });
    };
    promise.then(settle, () => {
      settle();
      notifyWriteError();
    });
    return promise;
  };

  /**
   * Honest user feedback for a tracked write:
   * - offline  -> "saved locally, will sync" (promise pends, no hanging await);
   * - online   -> success toast only after server acknowledgement;
   * - failure  -> handled by trackWrite's error toast, no false success.
   */
  const confirmWrite = (
    promise: Promise<unknown>,
    successMsg: string,
    queuedMsg = 'حُفظ محلياً — سيُزامَن تلقائياً عند عودة الاتصال'
  ): void => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      toast.info(queuedMsg);
      promise.catch(() => undefined);
      return;
    }
    promise.then(
      () => toast.success(successMsg),
      () => undefined // trackWrite already surfaced the error
    );
  };

  // ── Concurrent-edit detection ──
  // Latest server-seen snapshot signature per document. An editor passes the
  // object it started from as `base`; if the server version moved since,
  // the save pauses and asks the user instead of silently overwriting.
  const remoteSigs = useRef<Record<string, string>>({});
  const noteRemoteSig = (key: string, data: unknown) => {
    remoteSigs.current[key] = stableStringify(data);
  };
  const isRemoteChanged = (key: string, base: unknown): boolean => {
    const sig = remoteSigs.current[key];
    if (!sig) return false;
    return sig !== stableStringify(base);
  };
  const [pendingConflict, setPendingConflict] = useState<AppContextType['pendingConflict']>(null);
  const resolveConflict = (save: boolean) => {
    const pending = pendingConflict;
    setPendingConflict(null);
    if (save) {
      try {
        pending?.retry();
      } catch (e) {
        console.warn('Conflict retry failed:', e);
      }
    }
  };

  // ── Login tracking (quiet by design: never blocks login, never toasts) ──
  const touchLastLogin = (uid: string) => {
    if (!db) return;
    const now = new Date().toISOString();
    // Moderators may only touch this field (see firestore.rules).
    setDoc(doc(db, 'admins', uid), { lastLoginAt: now }, { merge: true }).catch(() => undefined);
    setAdmins(prev => prev.map(a => (a.id === uid ? { ...a, lastLoginAt: now } : a)));
  };
  const trimSessions = async () => {
    if (!db) return;
    try {
      const snap = await getDocs(query(collection(db, 'sessions'), orderBy('loginAt', 'desc')));
      const stale = snap.docs.slice(200);
      for (const d of stale) {
        deleteDoc(d.ref).catch(() => undefined);
      }
    } catch {
      // Non-admins can't trim — ignore silently.
    }
  };
  const logSessionStart = (uid: string, name: string) => {
    if (!db) return;
    try {
      const isMobile = typeof navigator !== 'undefined' && /android|iphone|ipad|ipod/i.test(navigator.userAgent);
      const ref = doc(collection(db, 'sessions'));
      setDoc(ref, cleanForFirestore({
        uid,
        name,
        loginAt: new Date().toISOString(),
        device: isMobile ? 'جوال' : 'كمبيوتر'
      })).catch(() => undefined);
      try {
        localStorage.setItem('tajdeed_session_id', ref.id);
      } catch {
        // ignore
      }
      void trimSessions();
    } catch {
      // never break login
    }
  };
  const logSessionEnd = () => {
    if (!db) return;
    try {
      const sid = localStorage.getItem('tajdeed_session_id');
      try {
        localStorage.removeItem('tajdeed_session_id');
      } catch {
        // ignore
      }
      if (!sid) return;
      setDoc(doc(db, 'sessions', sid), { logoutAt: new Date().toISOString() }, { merge: true }).catch(() => undefined);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('تمت استعادة الاتصال بالسيرفر وقاعدة البيانات');
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('وضع عدم الاتصال — التخزين المؤقت المحلي نشط');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Settings
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return saved ? JSON.parse(saved) : initialSettings;
  });

  // Admins
  const [admins, setAdmins] = useState<Admin[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.ADMINS);
    return saved ? JSON.parse(saved) : initialAdmins;
  });

  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Current Admin / Moderator (primary identity).
  // Starts as null (signed out) until proven: a stored profile, a valid
  // auth session, or an explicit login. Never fall back to a default admin —
  // that would grant access without authentication (e.g. fresh offline browser).
  const [currentAdmin, setCurrentAdmin] = useState<Admin | null>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Normalize legacy role 'owner' to 'admin'
        if (parsed.role === 'owner') parsed.role = 'admin';
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  // Sync auth session with admin/moderator profile
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const uid = fbUser.uid;
        if (db) {
          try {
            const snap = await getDoc(doc(db, 'admins', uid));
            if (snap.exists()) {
              const data = snap.data() as Admin;
              if (data.active === false) {
                await signOut(auth);
                setCurrentAdmin(null);
                localStorage.removeItem(STORAGE_KEYS.CURRENT_ADMIN);
                toast.error('تم تعطيل هذا الحساب من قبل إدارة النظام');
              } else {
                setCurrentAdmin(data);
              }
            } else {
              // Check if any admin exists in admins collection
              const allSnap = await getDocs(collection(db, 'admins'));
              if (allSnap.empty) {
                // First registered user becomes primary Admin!
                const firstAdmin: Admin = {
                  id: uid,
                  name: fbUser.displayName || fbUser.email?.split('@')[0] || 'المدير العام',
                  email: fbUser.email || '',
                  role: 'admin',
                  active: true,
                  createdAt: new Date().toISOString()
                };
                await trackWrite(setDoc(doc(db, 'admins', uid), cleanForFirestore(firstAdmin)));
                setCurrentAdmin(firstAdmin);
              } else {
                // Check if user was pre-created with matching email
                let matchDoc: Admin | null = null;
                allSnap.forEach(d => {
                  const a = d.data() as Admin;
                  if (a.email?.toLowerCase() === fbUser.email?.toLowerCase()) {
                    matchDoc = a;
                  }
                });
                if (matchDoc) {
                  const updated: Admin = { ...(matchDoc as Admin), id: uid };
                  await trackWrite(setDoc(doc(db, 'admins', uid), cleanForFirestore(updated)));
                  setCurrentAdmin(updated);
                }
              }
            }
          } catch (e) {
            console.warn('Error syncing auth profile with database:', e);
          }
        }
      } else {
        // Session-only mode (remember unchecked): a fresh tab means signed out.
        // Persistent mode keeps the cached profile (offline-friendly).
        let sessionOnly = false;
        try {
          sessionOnly = localStorage.getItem('tajdeed_remember') === '0';
        } catch {
          // ignore
        }
        if (navigator.onLine && (sessionOnly || !localStorage.getItem(STORAGE_KEYS.CURRENT_ADMIN))) {
          setCurrentAdmin(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubAuth();
  }, []);

  // Real Subscriptions datasets
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUBSCRIBERS);
    return saved ? JSON.parse(saved) : initialSubscribers;
  });

  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTIONS);
    return saved ? JSON.parse(saved) : initialSubscriptions;
  });

  const [payments, setPayments] = useState<Payment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    return saved ? JSON.parse(saved) : initialPayments;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    return saved ? JSON.parse(saved) : initialAuditLogs;
  });

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(admins));
  }, [admins]);

  useEffect(() => {
    if (currentAdmin) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_ADMIN, JSON.stringify(currentAdmin));
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_ADMIN);
    }
  }, [currentAdmin]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIBERS, JSON.stringify(subscribers));
  }, [subscribers]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SUBSCRIPTIONS, JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
  }, [payments]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Real-time database synchronization
  useEffect(() => {
    if (!db) return;

    try {
      // 1. Settings sync
      const unsubSettings = onSnapshot(doc(db, 'settings', 'main'), (snapshot) => {
        if (snapshot.exists()) {
          setSettings(snapshot.data() as Settings);
        } else if (!snapshot.metadata.fromCache) {
          // Genuinely deleted on the server — restore defaults.
          setSettings(initialSettings);
        }
      }, (err) => console.log('Database settings listener:', err.message));

      // 2. Subscribers sync
      const unsubSubscribers = onSnapshot(collection(db, 'subscribers'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteSubs: Subscriber[] = [];
          snapshot.forEach(docSnap => {
            remoteSubs.push({ id: docSnap.id, ...(docSnap.data() as any) });
            noteRemoteSig(`subscribers/${docSnap.id}`, { id: docSnap.id, ...(docSnap.data() as any) });
          });
          setSubscribers(remoteSubs);
        } else if (!snapshot.metadata.fromCache) {
          // Genuinely emptied on the server — clear local copy.
          setSubscribers([]);
        }
      }, (err) => console.log('Database subscribers listener:', err.message));

      // 3. Subscriptions cycles sync
      const unsubSubscriptions = onSnapshot(collection(db, 'subscriptions'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteCycles: Subscription[] = [];
          snapshot.forEach(docSnap => {
            remoteCycles.push({ id: docSnap.id, ...(docSnap.data() as any) });
            noteRemoteSig(`subscriptions/${docSnap.id}`, { id: docSnap.id, ...(docSnap.data() as any) });
          });
          setSubscriptions(remoteCycles);
        } else if (!snapshot.metadata.fromCache) {
          setSubscriptions([]);
        }
      }, (err) => console.log('Database subscriptions listener:', err.message));

      // 4. Payments sync
      const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
        if (!snapshot.empty) {
          const remotePays: Payment[] = [];
          snapshot.forEach(docSnap => {
            remotePays.push({ id: docSnap.id, ...(docSnap.data() as any) });
            noteRemoteSig(`payments/${docSnap.id}`, { id: docSnap.id, ...(docSnap.data() as any) });
          });
          setPayments(remotePays);
        } else if (!snapshot.metadata.fromCache) {
          setPayments([]);
        }
      }, (err) => console.log('Database payments listener:', err.message));

      // 5. Audit logs sync
      const unsubAudit = onSnapshot(collection(db, 'auditLogs'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteLogs: AuditLog[] = [];
          snapshot.forEach(docSnap => {
            remoteLogs.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          // Sort descending by date
          remoteLogs.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
          setAuditLogs(remoteLogs);
        } else if (!snapshot.metadata.fromCache) {
          setAuditLogs([]);
        }
      }, (err) => console.log('Database audit listener:', err.message));

      // 6. Admins sync
      const unsubAdmins = onSnapshot(collection(db, 'admins'), (snapshot) => {
        if (!snapshot.empty) {
          const remoteAdmins: Admin[] = [];
          snapshot.forEach(docSnap => {
            remoteAdmins.push({ id: docSnap.id, ...(docSnap.data() as any) });
            noteRemoteSig(`admins/${docSnap.id}`, { id: docSnap.id, ...(docSnap.data() as any) });
          });
          setAdmins(remoteAdmins);
        } else if (!snapshot.metadata.fromCache) {
          setAdmins([]);
        }
      }, (err) => console.log('Database admins listener:', err.message));

      return () => {
        unsubSettings();
        unsubSubscribers();
        unsubSubscriptions();
        unsubPayments();
        unsubAudit();
        unsubAdmins();
      };
    } catch (e) {
      console.warn('Database realtime listeners fallback:', e);
    }
  }, []);

  // Log Audit Action helper (immutable append-only)
  const logAuditAction = (params: {
    action: string;
    entity: AuditLog['entity'];
    entityId: string;
    entityName?: string;
    before?: unknown;
    after?: unknown;
  }) => {
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      uid: currentAdmin?.id || 'system',
      userName: currentAdmin?.name || 'مستخدم النظام',
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      entityName: params.entityName,
      before: params.before,
      after: params.after,
      at: new Date().toISOString()
    };

    setAuditLogs(prev => [newLog, ...prev]);

    // Async write to database — strip any undefined fields
    if (db) {
      trackWrite(setDoc(doc(db, 'auditLogs', newLog.id), cleanForFirestore(newLog))).catch(err =>
        console.warn('Error saving audit log to database:', err)
      );
    }
  };

  // Granular Permission Verification
  const hasPermission = (permission: ModeratorPermission): boolean => {
    if (!currentAdmin) return false;
    if (currentAdmin.active === false) return false;
    if (currentAdmin.role === 'admin') return true;
    if (currentAdmin.role === 'moderator') {
      return Boolean(currentAdmin.permissions?.includes(permission));
    }
    return false;
  };

  // Authentication: Login
  const loginWithFirebase = async (email: string, password: string, opts?: { rememberMe?: boolean }) => {
    const rememberMe = opts?.rememberMe !== false;
    try {
      // Checked  -> session survives tab/browser restarts on this device.
      // Unchecked -> session ends when the tab closes.
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
      try {
        localStorage.setItem('tajdeed_remember', rememberMe ? '1' : '0');
        if (rememberMe) {
          localStorage.setItem('tajdeed_saved_email', email.trim());
        } else {
          localStorage.removeItem('tajdeed_saved_email');
        }
      } catch {
        // ignore
      }
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;

      if (db) {
        const snap = await getDoc(doc(db, 'admins', uid));
        if (snap.exists()) {
          const userDoc = snap.data() as Admin;
          if (userDoc.active === false) {
            await signOut(auth);
            throw new Error('تم تعطيل هذا الحساب من قبل إدارة النظام');
          }
          setCurrentAdmin(userDoc);
          touchLastLogin(uid);
          logSessionStart(uid, userDoc.name);
          toast.success(`مرحباً بعودتك، ${userDoc.name}`);
          return;
        } else {
          // If no doc by UID, search if any admin accounts exist at all
          const allSnap = await getDocs(collection(db, 'admins'));
          if (allSnap.empty) {
            // First time setup: make this authenticated user the primary Admin
            const firstAdmin: Admin = {
              id: uid,
              name: cred.user.displayName || email.split('@')[0] || 'المدير العام',
              email: email.trim(),
              role: 'admin',
              active: true,
              createdAt: new Date().toISOString(),
              lastLoginAt: new Date().toISOString()
            };
            await trackWrite(setDoc(doc(db, 'admins', uid), cleanForFirestore(firstAdmin)));
            setCurrentAdmin(firstAdmin);
            logSessionStart(uid, firstAdmin.name);
            toast.success('تم إعداد حساب المسؤول الرئيسي بنجاح');
            return;
          } else {
            // Check if account was created with matching email
            let matched: Admin | null = null;
            allSnap.forEach(d => {
              const a = d.data() as Admin;
              if (a.email?.toLowerCase() === email.toLowerCase()) {
                matched = a;
              }
            });
            if (matched) {
              const updated: Admin = { ...(matched as Admin), id: uid, lastLoginAt: new Date().toISOString() };
              await trackWrite(setDoc(doc(db, 'admins', uid), cleanForFirestore(updated)));
              setCurrentAdmin(updated);
              logSessionStart(uid, updated.name);
              toast.success(`مرحباً بعودتك، ${updated.name}`);
              return;
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Login error:', err);
      let msg = 'فشل تسجيل الدخول';
      if (isPermissionError(err)) {
        msg = PERMISSION_DENIED_MSG;
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'صيغة البريد الإلكتروني غير صالحة';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'تم تعليق المحاولات مؤقتاً بسبب تكرار الأخطاء، يرجى المحاولة لاحقاً';
      } else if (err.message) {
        msg = err.message;
      }
      throw new Error(msg);
    }
  };

  // Authentication: Setup first Admin
  const setupInitialAdmin = async (name: string, email: string, password: string) => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = cred.user.uid;
      const adminData: Admin = {
        id: uid,
        name: name.trim(),
        email: email.trim(),
        role: 'admin',
        active: true,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString()
      };
      if (db) {
        await trackWrite(setDoc(doc(db, 'admins', uid), cleanForFirestore(adminData)));
      }
      setCurrentAdmin(adminData);
      logSessionStart(uid, adminData.name);
      toast.success(`تم إنشاء حساب المسؤول الرئيسي (${name}) بنجاح`);
    } catch (err: any) {
      let msg = 'تعذر إنشاء الحساب';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'البريد الإلكتروني مسجل مسبقاً، يرجى تسجيل الدخول';
      } else if (err.code === 'auth/weak-password') {
        msg = 'كلمة المرور يجب ألا تقل عن 6 خانات';
      } else if (err.message) {
        msg = err.message;
      }
      throw new Error(msg);
    }
  };

  // Authentication: Logout
  const logoutFromFirebase = async () => {
    logSessionEnd();
    try {
      await signOut(auth);
    } catch (e) {
      console.warn('Sign out error:', e);
    }
    setCurrentAdmin(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_ADMIN);
    toast.info('تم تسجيل الخروج بنجاح');
  };

  // Update Settings (Restricted to role === 'admin')
  const updateSettings = async (newSettings: Partial<Settings>) => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: تعديل إعدادات الشبكة متاح للمسؤول (Admin) فقط');
      return;
    }

    const prev = { ...settings };
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    logAuditAction({
      action: 'تحديث إعدادات الشبكة',
      entity: 'settings',
      entityId: 'main',
      before: prev,
      after: updated
    });

    if (db) {
      confirmWrite(
        trackWrite(setDoc(doc(db, 'settings', 'main'), cleanForFirestore(updated), { merge: true })),
        'تم حفظ الإعدادات بنجاح'
      );
    } else {
      toast.success('تم حفظ الإعدادات محلياً');
    }
  };

  // Create Moderator / Admin Account
  const createModerator = async (params: {
    name: string;
    email: string;
    password?: string;
    permissions: ModeratorPermission[];
    active?: boolean;
    role?: Role;
  }) => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: إنشاء وتعيين المشرفين متاح للمسؤول (Admin) فقط');
      return;
    }

    let uid = `mod-${Date.now()}`;
    if (params.password) {
      try {
        const secondaryAuth = getSecondaryAuth();
        const cred = await createUserWithEmailAndPassword(secondaryAuth, params.email.trim(), params.password);
        uid = cred.user.uid;
        await signOut(secondaryAuth);
      } catch (authErr: any) {
        console.warn('Secondary auth error:', authErr);
        if (isPermissionError(authErr)) {
          throw new Error(PERMISSION_DENIED_MSG);
        } else if (authErr.code === 'auth/email-already-in-use') {
          throw new Error('البريد الإلكتروني مسجل مسبقاً، يرجى استخدام بريد آخر');
        } else if (authErr.code === 'auth/weak-password') {
          throw new Error('كلمة المرور يجب ألا تقل عن 6 أحرف أو أرقام');
        }
        throw new Error(authErr.message || 'تعذر إنشاء حساب المشرف في نظام الدخول');
      }
    }

    const newMod: Admin = {
      id: uid,
      name: params.name.trim(),
      email: params.email.trim(),
      role: params.role || 'moderator',
      permissions: params.permissions || [],
      active: params.active !== undefined ? params.active : true,
      createdAt: new Date().toISOString()
    };

    setAdmins(prev => [...prev.filter(a => a.id !== uid), newMod]);

    logAuditAction({
      action: `إنشاء حساب ${newMod.role === 'admin' ? 'مسؤول' : 'مشرف'} جديد: ${newMod.name}`,
      entity: 'admin',
      entityId: uid,
      entityName: newMod.name,
      after: newMod
    });

    if (db) {
      await trackWrite(setDoc(doc(db, 'admins', uid), cleanForFirestore(newMod)));
    }

    toast.success(`تمت إضافة ${newMod.role === 'admin' ? 'المسؤول' : 'المشرف'} بنجاح`);
  };

  // Update Moderator permissions / details
  const updateModerator = async (
    id: string,
    updates: {
      name?: string;
      email?: string;
      permissions?: ModeratorPermission[];
      active?: boolean;
      role?: Role;
    },
    opts?: { base?: unknown; force?: boolean }
  ) => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: تعديل صلاحيات وحسابات المشرفين متاح للمسؤول (Admin) فقط');
      return;
    }

    const target = admins.find(a => a.id === id);
    if (!target) return;

    if (opts?.base && !opts.force && isRemoteChanged(`admins/${id}`, opts.base)) {
      setPendingConflict({
        kind: 'admin',
        id,
        name: target.name,
        retry: () => void updateModerator(id, updates, { force: true })
      });
      return;
    }

    const before = { ...target };
    const updated: Admin = {
      ...target,
      ...cleanForFirestore(updates)
    };

    setAdmins(prev => prev.map(a => (a.id === id ? updated : a)));
    if (currentAdmin.id === id) {
      setCurrentAdmin(updated);
    }

    logAuditAction({
      action: `تعديل صلاحيات/بيانات: ${target.name} (${updated.role})`,
      entity: 'admin',
      entityId: id,
      entityName: target.name,
      before,
      after: updated
    });

    if (db) {
      confirmWrite(
        trackWrite(setDoc(doc(db, 'admins', id), cleanForFirestore(updated), { merge: true })),
        'تم حفظ التعديلات والصلاحيات بنجاح'
      );
    } else {
      toast.success('تم حفظ التعديلات محلياً');
    }
  };

  // Toggle Admin / Moderator Active status
  const toggleAdminActive = async (id: string) => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: تفعيل/تعطيل الحسابات متاح للمسؤول (Admin) فقط');
      return;
    }
    if (currentAdmin.id === id) {
      toast.error('لا يمكنك تعطيل حسابك الحالي المسجل به');
      return;
    }

    const target = admins.find(a => a.id === id);
    if (!target) return;

    const newActive = !target.active;
    // updateModerator confirms honestly (synced / queued); no second toast here.
    await updateModerator(id, { active: newActive });
  };

  // Delete Moderator account (database record only — full login deletion requires elevated privileges)
  const deleteModerator = async (id: string) => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: حذف الحسابات متاح للمسؤول (Admin) فقط');
      return;
    }
    if (currentAdmin.id === id) {
      toast.error('لا يمكنك حذف حسابك الشخصي الحالي');
      return;
    }

    const target = admins.find(a => a.id === id);
    if (!target) return;

    setAdmins(prev => prev.filter(a => a.id !== id));

    logAuditAction({
      action: `حذف حساب ${target.role === 'admin' ? 'مسؤول' : 'مشرف'}: ${target.name}`,
      entity: 'admin',
      entityId: id,
      entityName: target.name,
      before: target
    });

    if (db) {
      confirmWrite(
        trackWrite(deleteDoc(doc(db, 'admins', id))),
        `تم حذف حساب (${target.name}) بنجاح`
      );
    } else {
      toast.success(`تم حذف حساب (${target.name}) محلياً`);
    }
  };

  // Backwards compatible wrappers
  const updateAdminRole = (id: string, role: Role, active: boolean) => {
    updateModerator(id, { role, active });
  };

  const createAdmin = (newAdmin: Omit<Admin, 'id' | 'createdAt'>) => {
    createModerator({
      name: newAdmin.name,
      email: newAdmin.email,
      role: newAdmin.role,
      permissions: newAdmin.permissions || [],
      active: newAdmin.active
    });
  };

  // Subscribers
  const addSubscriber = async (
    subData: Omit<Subscriber, 'id' | 'archived' | 'createdAt'>,
    initialSubCycle?: {
      username: string;
      password: string;
      durationDays?: number;
      price?: number;
      startDate?: string;
      endDate?: string;
      paidAmount?: number;
    }
  ): Promise<string> => {
    if (!hasPermission('subscribers_create')) {
      toast.error('غير مصرح: ليس لديك صلاحية إضافة مشتركين');
      throw new Error('غير مصرح بإضافة مشتركين');
    }

    const id = `sub-${Date.now()}`;
    const newSub: Subscriber = {
      ...subData,
      id,
      archived: false,
      createdAt: new Date().toISOString()
    };

    setSubscribers(prev => [newSub, ...prev]);

    const pendingSaves: Promise<unknown>[] = [];
    if (db) {
      pendingSaves.push(trackWrite(setDoc(doc(db, 'subscribers', id), cleanForFirestore(newSub))));
    }

    logAuditAction({
      action: `إضافة مشترك جديد: ${newSub.name}`,
      entity: 'subscriber',
      entityId: id,
      entityName: newSub.name,
      after: newSub
    });

    // Create initial subscription if provided
    if (initialSubCycle) {
      const fallbackDuration = initialSubCycle.durationDays || settings.defaultDurationDays;
      const price = initialSubCycle.price || settings.plans[subData.planType]?.defaultPrice || 100;
      // Manual dates win when provided; otherwise today + default duration.
      const resolved = resolveCycleDates({
        manualStart: initialSubCycle.startDate,
        manualEnd: initialSubCycle.endDate,
        durationDays: fallbackDuration
      });
      const { startDate, endDate } = resolved;
      const duration = resolved.durationDays;

      const paid = initialSubCycle.paidAmount || 0;
      let payStatus: PayStatus = 'unpaid';
      if (paid >= price) payStatus = 'paid';
      else if (paid > 0) payStatus = 'partial';

      const cycleId = `sub-cyc-${Date.now()}`;
      const newCycle: Subscription = {
        id: cycleId,
        subscriberId: id,
        planType: subData.planType,
        username: initialSubCycle.username,
        password: initialSubCycle.password,
        startDate,
        endDate,
        durationDays: duration,
        price,
        payStatus,
        paidAmount: paid,
        createdAt: new Date().toISOString()
      };

      setSubscriptions(prev => [newCycle, ...prev]);

      if (db) {
        pendingSaves.push(trackWrite(setDoc(doc(db, 'subscriptions', cycleId), cleanForFirestore(newCycle))));
      }

      if (paid > 0) {
        const paymentId = `pay-${Date.now()}`;
        let firstReceiptNo: string | null = null;
        if (db && typeof navigator !== 'undefined' && navigator.onLine) {
          try {
            firstReceiptNo = await allocateReceiptNo(String(new Date().getFullYear()));
          } catch {
            firstReceiptNo = null;
          }
        }
        const newPayment: Payment = {
          id: paymentId,
          subscriptionId: cycleId,
          subscriberId: id,
          amount: paid,
          date: new Date().toISOString(),
          receivedBy: currentAdmin?.name || 'الأدمن',
          note: 'الدفعة الأولى عند التسجيل',
          receiptNo: firstReceiptNo
        };

        setPayments(prev => [newPayment, ...prev]);

        if (db) {
          pendingSaves.push(trackWrite(setDoc(doc(db, 'payments', paymentId), cleanForFirestore(newPayment))));
        }
      }
    }

    if (pendingSaves.length > 0) {
      confirmWrite(
        Promise.all(pendingSaves),
        `تمت إضافة المشترك (${newSub.name}) وتخزينه في قاعدة البيانات`
      );
    } else {
      toast.success(`تمت إضافة المشترك (${newSub.name}) محلياً`);
    }
    return id;
  };

  const updateSubscriber = async (id: string, updates: Partial<Subscriber>, opts?: { base?: unknown; force?: boolean }) => {
    if (!hasPermission('subscribers_edit')) {
      toast.error('غير مصرح: ليس لديك صلاحية تعديل بيانات المشتركين');
      return;
    }

    const target = subscribers.find(s => s.id === id);
    if (!target) return;

    if (opts?.base && !opts.force && isRemoteChanged(`subscribers/${id}`, opts.base)) {
      setPendingConflict({
        kind: 'subscriber',
        id,
        name: target.name,
        retry: () => void updateSubscriber(id, updates, { force: true })
      });
      return;
    }

    const before = { ...target };
    const updated = { ...target, ...updates };

    setSubscribers(prev => prev.map(s => (s.id === id ? updated : s)));

    if (db) {
      confirmWrite(
        trackWrite(setDoc(doc(db, 'subscribers', id), cleanForFirestore(updated), { merge: true })),
        'تم تحديث بيانات المشترك'
      );
    } else {
      toast.success('تم تحديث بيانات المشترك محلياً');
    }

    logAuditAction({
      action: `تعديل بيانات المشترك: ${target.name}`,
      entity: 'subscriber',
      entityId: id,
      entityName: target.name,
      before,
      after: updated
    });
  };

  const toggleArchiveSubscriber = async (id: string) => {
    if (!hasPermission('subscribers_archive')) {
      toast.error('غير مصرح: ليس لديك صلاحية أرشفة المشتركين');
      return;
    }

    const target = subscribers.find(s => s.id === id);
    if (!target) return;
    const newArchived = !target.archived;
    const updated = { ...target, archived: newArchived };

    setSubscribers(prev => prev.map(s => (s.id === id ? updated : s)));

    if (db) {
      confirmWrite(
        trackWrite(setDoc(doc(db, 'subscribers', id), { archived: newArchived }, { merge: true })),
        newArchived ? 'تمت أرشفة المشترك' : 'تم استرجاع المشترك من الأرشيف'
      );
    } else {
      toast.success(newArchived ? 'تمت أرشفة المشترك محلياً' : 'تم استرجاع المشترك محلياً');
    }

    logAuditAction({
      action: newArchived ? `أرشفة المشترك: ${target.name}` : `إلغاء أرشفة المشترك: ${target.name}`,
      entity: 'subscriber',
      entityId: id,
      entityName: target.name,
      after: { archived: newArchived }
    });
  };

  const deleteSubscriber = async (id: string) => {
    if (!hasPermission('subscribers_delete') && currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: ليس لديك صلاحية حذف المشتركين نهائياً');
      throw new Error('غير مصرح بحذف المشترك');
    }

    const target = subscribers.find(s => s.id === id);
    if (!target) return;

    // Remove subscriber from state
    setSubscribers(prev => prev.filter(s => s.id !== id));

    // Also remove their subscriptions & payments from state
    const cyclesToDelete = subscriptions.filter(s => s.subscriberId === id);
    const paymentsToDelete = payments.filter(p => p.subscriberId === id);

    setSubscriptions(prev => prev.filter(s => s.subscriberId !== id));
    setPayments(prev => prev.filter(p => p.subscriberId !== id));

    // Delete from database
    const pendingDeletes: Promise<unknown>[] = [];
    if (db) {
      pendingDeletes.push(trackWrite(deleteDoc(doc(db, 'subscribers', id))));
      for (const cycle of cyclesToDelete) {
        pendingDeletes.push(trackWrite(deleteDoc(doc(db, 'subscriptions', cycle.id))));
      }
      for (const payment of paymentsToDelete) {
        pendingDeletes.push(trackWrite(deleteDoc(doc(db, 'payments', payment.id))));
      }
    }

    logAuditAction({
      action: `حذف المشترك نهائياً مع كافة سجلاته: ${target.name}`,
      entity: 'subscriber',
      entityId: id,
      entityName: target.name,
      before: target
    });

    if (pendingDeletes.length > 0) {
      confirmWrite(
        Promise.all(pendingDeletes),
        `تم حذف المشترك (${target.name}) وسجلاته نهائياً`
      );
    } else {
      toast.success(`تم حذف المشترك (${target.name}) محلياً`);
    }
  };

  // Subscriptions & Renewal
  const renewSubscription = async (
    subscriberId: string,
    customOptions?: {
      durationDays?: number;
      price?: number;
      username?: string;
      password?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<string> => {
    if (!hasPermission('subscriptions_renew')) {
      toast.error('غير مصرح: ليس لديك صلاحية تجديد الاشتراكات');
      return '';
    }

    const sub = subscribers.find(s => s.id === subscriberId);
    if (!sub) return '';

    const latestCycle = subscriptions
      .filter(s => s.subscriberId === subscriberId)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

    const fallbackDuration = customOptions?.durationDays || settings.defaultDurationDays;
    const price = customOptions?.price || (latestCycle ? latestCycle.price : settings.plans[sub.planType]?.defaultPrice);

    // Manual dates win when provided; otherwise day-after-previous-end (or today).
    const resolved = resolveCycleDates({
      manualStart: customOptions?.startDate,
      manualEnd: customOptions?.endDate,
      fallbackPreviousEnd: latestCycle?.endDate,
      durationDays: fallbackDuration
    });
    const { startDate, endDate } = resolved;
    const duration = resolved.durationDays;

    // Auto-apply any prepaid credit to the new charge.
    const chargePrice = price || 100;
    const credit = applyCreditToCharge(sub.creditBalance || 0, chargePrice);

    const cycleId = `sub-cyc-${Date.now()}`;
    const newCycle: Subscription = {
      id: cycleId,
      subscriberId,
      planType: sub.planType,
      username: customOptions?.username || latestCycle?.username || `user_${Date.now().toString().slice(-4)}`,
      password: customOptions?.password || latestCycle?.password || 'Pass@1234',
      startDate,
      endDate,
      durationDays: duration,
      price: chargePrice,
      payStatus: credit.payStatus,
      paidAmount: credit.paid,
      createdAt: new Date().toISOString()
    };

    setSubscriptions(prev => [newCycle, ...prev]);

    const renewWrites: Promise<unknown>[] = [];
    if (db) {
      renewWrites.push(trackWrite(setDoc(doc(db, 'subscriptions', cycleId), cleanForFirestore(newCycle))));
    }
    if (credit.applied > 0) {
      const updatedSub: Subscriber = { ...sub, creditBalance: credit.remainingCredit };
      setSubscribers(prev => prev.map(s => (s.id === subscriberId ? updatedSub : s)));
      if (db) {
        renewWrites.push(trackWrite(setDoc(doc(db, 'subscribers', subscriberId), cleanForFirestore(updatedSub), { merge: true })));
      }
    }

    if (renewWrites.length > 0) {
      confirmWrite(
        Promise.all(renewWrites),
        credit.applied > 0
          ? `تم التجديد — خُصم ${credit.applied.toLocaleString('en-US')} ${settings.currency} من الرصيد الدائن`
          : `تم تجديد اشتراك (${sub.name}) وحفظه في قاعدة البيانات`
      );
    } else {
      toast.success(`تم تجديد اشتراك (${sub.name}) محلياً`);
    }

    logAuditAction({
      action: credit.applied > 0
        ? `تجديد اشتراك دورة جديدة: ${sub.name} (خُصم ${credit.applied} من الرصيد الدائن، المتبقي ${credit.cashDue})`
        : `تجديد اشتراك دورة جديدة: ${sub.name}`,
      entity: 'subscription',
      entityId: cycleId,
      entityName: sub.name,
      after: newCycle
    });

    return cycleId;
  };

  const updateSubscription = async (id: string, updates: Partial<Subscription>, opts?: { base?: unknown; force?: boolean }) => {
    if (!hasPermission('subscriptions_renew')) {
      toast.error('غير مصرح: ليس لديك صلاحية تعديل بيانات الاشتراك');
      return;
    }

    const target = subscriptions.find(s => s.id === id);
    if (!target) return;

    if (opts?.base && !opts.force && isRemoteChanged(`subscriptions/${id}`, opts.base)) {
      const ownerName = subscribers.find(s => s.id === target.subscriberId)?.name || id;
      setPendingConflict({
        kind: 'subscription',
        id,
        name: ownerName,
        retry: () => void updateSubscription(id, updates, { force: true })
      });
      return;
    }

    const before = { ...target };
    const updated = { ...target, ...updates };

    // Manual repricing keeps the books consistent: cap overpayment into
    // credit and recalculate status instead of silently distorting them.
    let creditNote = '';
    if (updates.price !== undefined && updates.price !== target.price) {
      const balance = computePlanChangeBalance(target.paidAmount, updates.price);
      updated.paidAmount = balance.cyclePaid;
      updated.payStatus = balance.payStatus;
      if (balance.creditAdd > 0) {
        const owner = subscribers.find(s => s.id === target.subscriberId);
        if (owner) {
          const updatedOwner: Subscriber = {
            ...owner,
            creditBalance: (owner.creditBalance || 0) + balance.creditAdd
          };
          setSubscribers(prev => prev.map(s => (s.id === owner.id ? updatedOwner : s)));
          if (db) {
            trackWrite(setDoc(doc(db, 'subscribers', owner.id), cleanForFirestore(updatedOwner), { merge: true })).catch(() => undefined);
          }
        }
        creditNote = ` — فائض ${balance.creditAdd.toLocaleString('en-US')} ${settings.currency} رُحّل كرصيد دائن`;
      }
    }

    setSubscriptions(prev => prev.map(s => (s.id === id ? updated : s)));

    if (db) {
      confirmWrite(
        trackWrite(setDoc(doc(db, 'subscriptions', id), cleanForFirestore(updated), { merge: true })),
        'تم تحديث دورة الاشتراك'
      );
    } else {
      toast.success('تم تحديث دورة الاشتراك محلياً');
    }

    logAuditAction({
      action: `تعديل بيانات دورة الاشتراك${creditNote}`,
      entity: 'subscription',
      entityId: id,
      before,
      after: updated
    });
  };

  // Change plan type mid-cycle (e.g. personal -> home after a day or two).
  // Moves the subscriber to the new plan and reprices the current cycle,
  // recalculating payment status from what was already paid.
  const changeSubscriptionPlan = async (
    subscriberId: string,
    newPlan: PlanType,
    cyclePrice: number,
    creds?: { username?: string; password?: string }
  ): Promise<void> => {
    if (!hasPermission('subscriptions_renew')) {
      toast.error('غير مصرح: ليس لديك صلاحية تعديل بيانات الاشتراك');
      return;
    }
    const sub = subscribers.find(s => s.id === subscriberId);
    if (!sub || sub.planType === newPlan) return;

    const oldLabel = settings.plans[sub.planType]?.label || sub.planType;
    const newLabel = settings.plans[newPlan]?.label || newPlan;

    const current = subscriptions
      .filter(s => s.subscriberId === subscriberId)
      .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime())[0];

    const beforeSub = { ...sub };
    // Surplus becomes explicit credit; the cycle keeps only what it costs.
    const balance = computePlanChangeBalance(
      current?.paidAmount ?? 0,
      cyclePrice > 0 ? cyclePrice : (current?.price ?? 0)
    );
    const updatedSub: Subscriber = {
      ...sub,
      planType: newPlan,
      creditBalance: (sub.creditBalance || 0) + balance.creditAdd
    };
    setSubscribers(prev => prev.map(s => (s.id === subscriberId ? updatedSub : s)));

    const writes: Promise<unknown>[] = [];
    if (db) {
      writes.push(trackWrite(setDoc(doc(db, 'subscribers', subscriberId), cleanForFirestore(updatedSub), { merge: true })));
    }

    if (current) {
      const price = cyclePrice > 0 ? cyclePrice : current.price;
      const beforeCycle = { ...current };
      const updatedCycle: Subscription = {
        ...current,
        planType: newPlan,
        price,
        paidAmount: balance.cyclePaid,
        payStatus: balance.payStatus,
        username: creds?.username?.trim() || current.username,
        password: creds?.password?.trim() || current.password
      };
      setSubscriptions(prev => prev.map(s => (s.id === current.id ? updatedCycle : s)));
      if (db) {
        writes.push(trackWrite(setDoc(doc(db, 'subscriptions', current.id), cleanForFirestore(updatedCycle), { merge: true })));
      }
      logAuditAction({
        action: `تغيير باقة المشترك من ${oldLabel} إلى ${newLabel}: ${sub.name} (مدفوع ${balance.cyclePaid + balance.creditAdd}، سعر جديد ${price}، فائض مرحّل ${balance.creditAdd}، متبقي ${balance.remaining})`,
        entity: 'subscription',
        entityId: current.id,
        entityName: sub.name,
        before: { subscriber: beforeSub, cycle: beforeCycle },
        after: { subscriber: updatedSub, cycle: updatedCycle }
      });
    } else {
      logAuditAction({
        action: `تغيير باقة المشترك من ${oldLabel} إلى ${newLabel}: ${sub.name}`,
        entity: 'subscriber',
        entityId: subscriberId,
        entityName: sub.name,
        before: beforeSub,
        after: updatedSub
      });
    }

    if (writes.length > 0) {
      confirmWrite(
        Promise.all(writes),
        balance.creditAdd > 0
          ? `تم تغيير الباقة — فائض ${balance.creditAdd.toLocaleString('en-US')} ${settings.currency} رُحّل كرصيد دائن`
          : balance.remaining > 0
            ? `تم تغيير الباقة — المتبقي الجديد ${balance.remaining.toLocaleString('en-US')} ${settings.currency}`
            : `تم تغيير باقة (${sub.name}) إلى ${newLabel} بنجاح`
      );
    } else {
      toast.success(`تم تغيير باقة (${sub.name}) محلياً`);
    }
  };

  // Payments
  const addPayment = async (params: {
    subscriptionId: string;
    subscriberId: string;
    amount: number;
    note?: string;
    date?: string;
  }): Promise<Payment | null> => {
    if (!hasPermission('payments_create')) {
      toast.error('غير مصرح: ليس لديك صلاحية تسجيل الدفعات المالية');
      return null;
    }

    const targetCycle = subscriptions.find(s => s.id === params.subscriptionId);
    const sub = subscribers.find(s => s.id === params.subscriberId);
    if (!targetCycle || !sub) return null;

    const paymentId = `pay-${Date.now()}`;
    const paymentDate = params.date || new Date().toISOString();
    // Official number now if online; otherwise null and the reconciler fills it.
    let receiptNo: string | null = null;
    if (db && typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        receiptNo = await allocateReceiptNo(String(new Date(paymentDate).getFullYear()));
      } catch {
        receiptNo = null;
      }
    }
    const newPayment: Payment = {
      id: paymentId,
      subscriptionId: params.subscriptionId,
      subscriberId: params.subscriberId,
      amount: params.amount,
      date: paymentDate,
      receivedBy: currentAdmin?.name || 'الأدمن',
      note: params.note,
      receiptNo
    };

    setPayments(prev => [newPayment, ...prev]);

    const newPaidTotal = targetCycle.paidAmount + params.amount;
    // Overpayment becomes explicit credit instead of inflating paidAmount.
    const balance = computePlanChangeBalance(newPaidTotal, targetCycle.price);
    const updatedCycle = { ...targetCycle, paidAmount: balance.cyclePaid, payStatus: balance.payStatus };

    setSubscriptions(prev =>
      prev.map(s => (s.id === params.subscriptionId ? updatedCycle : s))
    );

    const paymentWrites: Promise<unknown>[] = [];
    if (db) {
      paymentWrites.push(trackWrite(setDoc(doc(db, 'payments', paymentId), cleanForFirestore(newPayment))));
      paymentWrites.push(trackWrite(setDoc(doc(db, 'subscriptions', params.subscriptionId), cleanForFirestore(updatedCycle), { merge: true })));
    }
    if (balance.creditAdd > 0) {
      const updatedSub: Subscriber = { ...sub, creditBalance: (sub.creditBalance || 0) + balance.creditAdd };
      setSubscribers(prev => prev.map(s => (s.id === params.subscriberId ? updatedSub : s)));
      if (db) {
        paymentWrites.push(trackWrite(setDoc(doc(db, 'subscribers', params.subscriberId), cleanForFirestore(updatedSub), { merge: true })));
      }
    }

    if (paymentWrites.length > 0) {
      confirmWrite(
        Promise.all(paymentWrites),
        balance.creditAdd > 0
          ? `تم تسجيل الدفعة — فائض ${balance.creditAdd.toLocaleString('en-US')} ${settings.currency} رُحّل كرصيد دائن`
          : 'تم تسجيل الدفعة وحفظ السند في قاعدة البيانات'
      );
    } else {
      toast.success('تم تسجيل الدفعة محلياً');
    }

    logAuditAction({
      action: balance.creditAdd > 0
        ? `استلام دفعة بقيمة ${params.amount.toLocaleString('en-US')} ${settings.currency} من ${sub.name} (فائض ${balance.creditAdd.toLocaleString('en-US')} رُحّل دائناً)`
        : `استلام دفعة بقيمة ${params.amount.toLocaleString('en-US')} ${settings.currency} من ${sub.name}`,
      entity: 'payment',
      entityId: paymentId,
      entityName: sub.name,
      after: newPayment
    });

    return newPayment;
  };

  // Delete a payment and recalculate subscription balance
  const deletePayment = async (paymentId: string) => {
    if (!hasPermission('payments_create') && currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: ليس لديك صلاحية حذف الدفعات');
      return;
    }
    const target = payments.find(p => p.id === paymentId);
    if (!target) return;

    setPayments(prev => prev.filter(p => p.id !== paymentId));

    const pendingDeletes: Promise<unknown>[] = [];
    // Recalculate paidAmount for the linked subscription
    const cycle = subscriptions.find(s => s.id === target.subscriptionId);
    if (cycle) {
      const remaining = payments
        .filter(p => p.id !== paymentId && p.subscriptionId === cycle.id)
        .reduce((sum, p) => sum + p.amount, 0);
      let newPayStatus: PayStatus = 'unpaid';
      if (remaining >= cycle.price) newPayStatus = 'paid';
      else if (remaining > 0) newPayStatus = 'partial';
      const updated = { ...cycle, paidAmount: remaining, payStatus: newPayStatus };
      setSubscriptions(prev => prev.map(s => s.id === cycle.id ? updated : s));
      if (db) {
        pendingDeletes.push(trackWrite(setDoc(doc(db, 'subscriptions', cycle.id), cleanForFirestore(updated), { merge: true })));
      }
    }

    if (db) {
      pendingDeletes.push(trackWrite(deleteDoc(doc(db, 'payments', paymentId))));
    }

    logAuditAction({
      action: `حذف دفعة بقيمة ${target.amount.toLocaleString('en-US')} ${settings.currency}`,
      entity: 'payment',
      entityId: paymentId,
      before: target
    });

    if (pendingDeletes.length > 0) {
      confirmWrite(Promise.all(pendingDeletes), 'تم حذف الدفعة وتحديث رصيد الاشتراك');
    } else {
      toast.success('تم حذف الدفعة محلياً');
    }
  };

  // Update payment amount/note and recalculate subscription balance
  const updatePayment = async (paymentId: string, updates: { amount?: number; note?: string }, opts?: { base?: unknown; force?: boolean }) => {
    if (!hasPermission('payments_create') && currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: ليس لديك صلاحية تعديل الدفعات');
      return;
    }
    const target = payments.find(p => p.id === paymentId);
    if (!target) return;

    if (opts?.base && !opts.force && isRemoteChanged(`payments/${paymentId}`, opts.base)) {
      const ownerName = subscribers.find(s => s.id === target.subscriberId)?.name || paymentId;
      setPendingConflict({
        kind: 'payment',
        id: paymentId,
        name: ownerName,
        retry: () => void updatePayment(paymentId, updates, { force: true })
      });
      return;
    }

    const updated = { ...target, ...updates };
    setPayments(prev => prev.map(p => p.id === paymentId ? updated : p));

    const pendingSaves: Promise<unknown>[] = [];
    // Recalculate paidAmount for the linked subscription
    const cycle = subscriptions.find(s => s.id === target.subscriptionId);
    if (cycle) {
      const newTotal = payments
        .filter(p => p.subscriptionId === cycle.id)
        .reduce((sum, p) => sum + (p.id === paymentId ? (updates.amount ?? p.amount) : p.amount), 0);
      let newPayStatus: PayStatus = 'unpaid';
      if (newTotal >= cycle.price) newPayStatus = 'paid';
      else if (newTotal > 0) newPayStatus = 'partial';
      const updatedCycle = { ...cycle, paidAmount: newTotal, payStatus: newPayStatus };
      setSubscriptions(prev => prev.map(s => s.id === cycle.id ? updatedCycle : s));
      if (db) {
        pendingSaves.push(trackWrite(setDoc(doc(db, 'subscriptions', cycle.id), cleanForFirestore(updatedCycle), { merge: true })));
      }
    }

    if (db) {
      pendingSaves.push(trackWrite(setDoc(doc(db, 'payments', paymentId), cleanForFirestore(updated), { merge: true })));
    }

    logAuditAction({
      action: `تعديل دفعة بقيمة ${updated.amount.toLocaleString('en-US')} ${settings.currency}`,
      entity: 'payment',
      entityId: paymentId,
      before: target,
      after: updated
    });

    if (pendingSaves.length > 0) {
      confirmWrite(Promise.all(pendingSaves), 'تم تعديل الدفعة بنجاح');
    } else {
      toast.success('تم تعديل الدفعة محلياً');
    }
  };

  // Compute Subscriber Details
  const subscribersWithDetails = useMemo<SubscriberWithDetails[]>(() => {
    return subscribers.map(sub => {
      const cycles = subscriptions
        .filter(s => s.subscriberId === sub.id)
        .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

      const currentSubscription = cycles[0];
      const computedStatus = currentSubscription
        ? computeSubscriptionStatus(currentSubscription.endDate, settings.expiryAlertDays)
        : 'expired';

      const remainingAmount = currentSubscription
        ? Math.max(0, currentSubscription.price - currentSubscription.paidAmount)
        : 0;
      const netDue = Math.max(0, remainingAmount - (sub.creditBalance || 0));

      return {
        ...sub,
        currentSubscription,
        computedStatus,
        remainingAmount,
        netDue
      };
    });
  }, [subscribers, subscriptions, settings.expiryAlertDays]);

  // Export / Import
  const exportAllData = () => {
    if (!hasPermission('reports_export')) {
      toast.error('غير مصرح: ليس لديك صلاحية تصدير البيانات والتقارير');
      throw new Error('غير مصرح بتصدير البيانات');
    }

    return {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings,
      admins,
      subscribers,
      subscriptions,
      payments,
      auditLogs
    };
  };

  const importAllData = async (jsonData: any): Promise<boolean> => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: استيراد النسخ الاحتياطية متاح للمسؤول (Admin) فقط');
      return false;
    }

    try {
      const pendingSaves: Promise<unknown>[] = [];
      if (jsonData.settings) {
        setSettings(jsonData.settings);
        if (db) pendingSaves.push(trackWrite(setDoc(doc(db, 'settings', 'main'), jsonData.settings)));
      }
      if (jsonData.admins) {
        setAdmins(jsonData.admins);
      }
      if (jsonData.subscribers) {
        setSubscribers(jsonData.subscribers);
        if (db) {
          for (const s of jsonData.subscribers) {
            pendingSaves.push(trackWrite(setDoc(doc(db, 'subscribers', s.id), s)));
          }
        }
      }
      if (jsonData.subscriptions) {
        setSubscriptions(jsonData.subscriptions);
        if (db) {
          for (const sub of jsonData.subscriptions) {
            pendingSaves.push(trackWrite(setDoc(doc(db, 'subscriptions', sub.id), sub)));
          }
        }
      }
      if (jsonData.payments) {
        setPayments(jsonData.payments);
        if (db) {
          for (const p of jsonData.payments) {
            pendingSaves.push(trackWrite(setDoc(doc(db, 'payments', p.id), p)));
          }
        }
      }
      if (jsonData.auditLogs) {
        setAuditLogs(jsonData.auditLogs);
      }

      logAuditAction({
        action: 'استيراد نسخة احتياطية للبيانات',
        entity: 'settings',
        entityId: 'backup_import'
      });

      if (pendingSaves.length > 0) {
        confirmWrite(Promise.all(pendingSaves), 'تم استيراد كافة البيانات ومزامنتها بنجاح');
      } else {
        toast.success('تم استيراد كافة البيانات محلياً');
      }
      return true;
    } catch (e) {
      toast.error('فشل في استيراد البيانات، الملف غير صالح');
      return false;
    }
  };

  const resetToCleanData = async () => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: تهيئة النظام وحذف البيانات متاح للمسؤول (Admin) فقط');
      return;
    }

    // Real wipe: delete cloud documents too (otherwise listeners restore them).
    // Admins, settings and the append-only audit trail are intentionally kept.
    const deletions: Promise<unknown>[] = [];
    if (db) {
      for (const s of subscribers) {
        deletions.push(trackWrite(deleteDoc(doc(db, 'subscribers', s.id))));
      }
      for (const c of subscriptions) {
        deletions.push(trackWrite(deleteDoc(doc(db, 'subscriptions', c.id))));
      }
      for (const p of payments) {
        deletions.push(trackWrite(deleteDoc(doc(db, 'payments', p.id))));
      }
    }

    setSettings(initialSettings);
    setAdmins(initialAdmins);
    setCurrentAdmin(initialAdmins[0]);
    setSubscribers([]);
    setSubscriptions([]);
    setPayments([]);
    setAuditLogs([
      {
        id: `audit-${Date.now()}`,
        uid: currentAdmin?.id || 'admin-owner-main',
        userName: currentAdmin?.name || '(المدير العام)',
        action: 'تهيئة قاعدة البيانات بحالة نظيفة خالية من البيانات المؤقتة',
        entity: 'settings',
        entityId: 'main',
        at: new Date().toISOString()
      }
    ]);
    if (deletions.length > 0) {
      confirmWrite(Promise.all(deletions), 'تمت تهيئة قاعدة بيانات نظيفة على السحابة والجهاز');
    } else {
      toast.success('تمت تهيئة البيانات محلياً');
    }
  };

  // ── Cloud backups (chunked docs under 1MB, coordinated across devices) ──
  const BACKUP_CHUNK_BYTES = 700_000;
  const [backups, setBackups] = useState<BackupMeta[]>([]);

  useEffect(() => {
    if (!db || !hasPermission('reports_export')) {
      setBackups([]);
      return;
    }
    try {
      const q = query(collection(db, 'backups'), orderBy('createdAt', 'desc'), limit(50));
      const unsub = onSnapshot(q, (snapshot) => {
        setBackups(snapshot.docs.map(d => ({ id: d.id, ...(d.data() as Omit<BackupMeta, 'id'>) })));
      }, (err) => console.log('Database backups listener:', err.message));
      return () => unsub();
    } catch (e) {
      console.warn('Database backups listener fallback:', e);
    }
  }, [currentAdmin?.role, (currentAdmin?.permissions || []).join(',')]);

  /** Split a JSON payload into Firestore-safe (<1MB) byte chunks. */
  const splitBackupPayload = (json: string): string[] =>
    splitStringToByteChunks(json, BACKUP_CHUNK_BYTES);

  const enforceBackupRetention = async (): Promise<void> => {
    if (!db) return;
    try {
      const keep = Math.max(1, Number(settings.autoBackupRetention) || 10);
      const snap = await getDocs(query(collection(db, 'backups'), orderBy('createdAt', 'desc')));
      const stale = snap.docs.slice(keep);
      for (const metaDoc of stale) {
        const chunks = await getDocs(collection(db, 'backups', metaDoc.id, 'chunks'));
        for (const c of chunks.docs) {
          deleteDoc(c.ref).catch(() => undefined);
        }
        deleteDoc(metaDoc.ref).catch(() => undefined);
      }
    } catch (e) {
      console.warn('Backup retention cleanup failed:', e);
    }
  };

  const createCloudBackup = async (manual = false): Promise<string> => {
    if (!db || !currentAdmin) {
      if (manual) toast.error('لا يمكن إنشاء نسخة احتياطية — لا يوجد اتصال بقاعدة البيانات');
      throw new Error('backup backend unavailable');
    }
    const id = `${manual ? 'manual' : 'auto'}-${Date.now()}`;
    const payload = {
      version: '2.0',
      exportedAt: new Date().toISOString(),
      settings,
      admins,
      subscribers,
      subscriptions,
      payments,
      auditLogs
    };
    const json = JSON.stringify(payload);
    const sizeBytes = new TextEncoder().encode(json).length;
    const parts = splitBackupPayload(json);
    const meta: BackupMeta = {
      id,
      createdAt: new Date().toISOString(),
      createdByUid: currentAdmin.id,
      createdByName: currentAdmin.name,
      auto: !manual,
      chunks: parts.length,
      sizeBytes,
      counts: {
        subscribers: subscribers.length,
        subscriptions: subscriptions.length,
        payments: payments.length,
        admins: admins.length,
        auditLogs: auditLogs.length
      }
    };
    const writes: Promise<unknown>[] = [
      trackWrite(setDoc(doc(db, 'backups', id), cleanForFirestore(meta)))
    ];
    parts.forEach((data, index) => {
      writes.push(
        trackWrite(setDoc(doc(db, 'backups', id, 'chunks', String(index).padStart(4, '0')), { index, data }))
      );
    });
    try {
      await Promise.all(writes);
    } catch {
      // trackWrite already surfaced the error toast
      if (manual) throw new Error('تعذّر إنشاء النسخة الاحتياطية');
      return '';
    }
    void enforceBackupRetention();
    logAuditAction({
      action: `إنشاء نسخة احتياطية سحابية ${manual ? 'يدوية' : 'تلقائية'}`,
      entity: 'settings',
      entityId: id,
      entityName: meta.createdAt
    });
    if (manual) toast.success('تم إنشاء نسخة احتياطية سحابية بنجاح');
    return id;
  };

  const fetchBackupJson = async (id: string): Promise<string> => {
    if (!db) throw new Error('backup backend unavailable');
    const chunksSnap = await getDocs(query(collection(db, 'backups', id, 'chunks'), orderBy('index')));
    if (chunksSnap.empty) throw new Error('backup has no data');
    return chunksSnap.docs.map(d => String((d.data() as { data?: unknown }).data ?? '')).join('');
  };

  const restoreCloudBackup = async (id: string): Promise<boolean> => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: استعادة النسخ الاحتياطية متاحة للمسؤول (Admin) فقط');
      return false;
    }
    try {
      const parsed = JSON.parse(await fetchBackupJson(id));
      return await importAllData(parsed);
    } catch {
      toast.error('تعذّرت قراءة النسخة الاحتياطية');
      return false;
    }
  };

  const deleteCloudBackup = async (id: string): Promise<void> => {
    if (currentAdmin?.role !== 'admin') {
      toast.error('غير مصرح: حذف النسخ الاحتياطية متاح للمسؤول (Admin) فقط');
      return;
    }
    if (!db) {
      toast.error('لا يوجد اتصال بقاعدة البيانات');
      return;
    }
    const target = backups.find(b => b.id === id);
    const writes: Promise<unknown>[] = [];
    try {
      const chunks = await getDocs(collection(db, 'backups', id, 'chunks'));
      for (const c of chunks.docs) {
        writes.push(trackWrite(deleteDoc(c.ref)));
      }
    } catch {
      // fall through — still try deleting the meta doc
    }
    writes.push(trackWrite(deleteDoc(doc(db, 'backups', id))));
    logAuditAction({
      action: `حذف نسخة احتياطية سحابية (${target?.createdAt || id})`,
      entity: 'settings',
      entityId: id
    });
    confirmWrite(Promise.all(writes), 'تم حذف النسخة الاحتياطية بنجاح');
  };

  const downloadCloudBackup = async (id: string): Promise<void> => {
    if (!hasPermission('reports_export')) {
      toast.error('غير مصرح: ليس لديك صلاحية تصدير البيانات والتقارير');
      return;
    }
    try {
      const parsed = JSON.parse(await fetchBackupJson(id));
      downloadJsonFile(parsed, `نسخة_احتياطية_سحابية_${String(parsed.exportedAt || id).slice(0, 10)}.json`);
      toast.success('تم تحميل ملف النسخة الاحتياطية بنجاح');
    } catch {
      toast.error('تعذّر تحميل النسخة الاحتياطية');
    }
  };

  // Periodic scheduler: whichever signed-in device is open and online creates
  // the backup once the configured interval has passed since the latest one.
  const createCloudBackupRef = useRef(createCloudBackup);
  createCloudBackupRef.current = createCloudBackup;

  useEffect(() => {
    const intervalHours = Number(settings.autoBackupIntervalHours) || 0;
    if (!db || !currentAdmin || intervalHours <= 0) return;
    let stopped = false;
    const checkAndBackup = async () => {
      if (stopped) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      try {
        const snap = await getDocs(query(collection(db, 'backups'), orderBy('createdAt', 'desc'), limit(1)));
        const latest = snap.docs[0]?.data() as Partial<BackupMeta> | undefined;
        const last = latest?.createdAt ? new Date(latest.createdAt).getTime() : 0;
        if (!stopped && Date.now() - last >= intervalHours * 3600_000) {
          await createCloudBackupRef.current(false);
        }
      } catch (e) {
        console.warn('Auto backup check failed:', e);
      }
    };
    void checkAndBackup();
    const timer = window.setInterval(() => void checkAndBackup(), 15 * 60 * 1000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.autoBackupIntervalHours, currentAdmin?.id]);

  // Receipt-number reconciler: fills payments missing an official number
  // (offline-created or legacy), oldest first, once online and signed in.
  // Moderators included — rules allow receiptNo-only updates.
  useEffect(() => {
    if (!db || !isOnline || !currentAdmin) return;
    const pendingIds = payments.filter(p => !p.receiptNo).map(p => p.id);
    if (pendingIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const queue = payments
        .filter(p => !p.receiptNo)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      for (const p of queue) {
        if (cancelled) break;
        try {
          const no = await allocateReceiptNo(String(new Date(p.date).getFullYear()));
          if (cancelled) break;
          setPayments(prev => prev.map(x => (x.id === p.id ? { ...x, receiptNo: no } : x)));
          await trackWrite(setDoc(doc(db, 'payments', p.id), { receiptNo: no }, { merge: true }));
        } catch {
          break; // offline/rules — retry on the next trigger
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOnline, currentAdmin?.id, payments.filter(p => !p.receiptNo).map(p => p.id).join(',')]);

  return (
    <AppContext.Provider
      value={{
        currentAdmin,
        setCurrentAdmin,
        admins,
        hasPermission,
        createModerator,
        updateModerator,
        toggleAdminActive,
        deleteModerator,
        updateAdminRole,
        createAdmin,
        loginWithFirebase,
        setupInitialAdmin,
        logoutFromFirebase,
        authLoading,
        settings,
        updateSettings,
        subscribers,
        subscribersWithDetails,
        addSubscriber,
        updateSubscriber,
        toggleArchiveSubscriber,
        deleteSubscriber,
        subscriptions,
        renewSubscription,
        updateSubscription,
        changeSubscriptionPlan,
        payments,
        addPayment,
        deletePayment,
        updatePayment,
        auditLogs,
        logAuditAction,
        isOnline,
        isSyncing,
        pendingWrites,
        pendingConflict,
        resolveConflict,
        exportAllData,
        importAllData,
        resetToCleanData,
        backups,
        createCloudBackup,
        restoreCloudBackup,
        deleteCloudBackup,
        downloadCloudBackup
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
