import type { Settings, Admin, Subscriber, Subscription, Payment, AuditLog } from '../types';

export const initialSettings: Settings = {
  networkName: 'منظومة تجديد لخدمات الإنترنت',
  logoUrl: '',
  currency: '₪',
  defaultDurationDays: 30,
  expiryAlertDays: 3,
  sessionTimeoutMinutes: 0,
  autoBackupIntervalHours: 0,
  autoBackupRetention: 10,
  monthlyCollectionGoal: 0,
  plans: {
    home: { label: 'اشتراك منزلي', defaultPrice: 100 },
    personal: { label: 'اشتراك شخصي', defaultPrice: 60 },
  },
  defaultTheme: 'dark',
  contactPhone: ''
};

export const initialAdmins: Admin[] = [
  {
    id: 'admin-owner-main',
    name: 'المهندس محمد (المدير العام)',
    email: 'admin@tajdeed.com',
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString()
  }
];

// Empty real production datasets (cleared per user request)
export const initialSubscribers: Subscriber[] = [];
export const initialSubscriptions: Subscription[] = [];
export const initialPayments: Payment[] = [];
export const initialAuditLogs: AuditLog[] = [
  {
    id: 'audit-init-1',
    uid: 'admin-owner-main',
    userName: 'المهندس محمد (المدير العام)',
    action: 'تهيئة منظومة تجديد وربط قاعدة البيانات السحابية',
    entity: 'settings',
    entityId: 'main',
    at: new Date().toISOString()
  }
];
