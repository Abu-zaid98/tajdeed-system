export type PlanType = 'home' | 'personal';
export type PayStatus = 'paid' | 'unpaid' | 'partial';
export type Role = 'admin' | 'moderator';

export type ModeratorPermission =
  | 'subscribers_view'       // عرض المشتركين
  | 'subscribers_create'     // إضافة مشترك جديد
  | 'subscribers_edit'       // تعديل بيانات المشترك
  | 'subscribers_archive'    // أرشفة / استرجاع المشترك
  | 'subscribers_delete'     // حذف مشترك نهائياً
  | 'subscriptions_renew'    // تجديد دورة اشتراك
  | 'payments_view'          // عرض الدفعات وسندات القبض
  | 'payments_create'        // تسجيل دفعة وإصدار سند قبض
  | 'audit_view'             // الاطلاع على سجل الحركات والرقابة
  | 'reports_export'         // تصدير التقارير وسجلات المشتركين (Excel / CSV)
  | 'settings_view'          // الاطلاع على إعدادات الشبكة (قراءة فقط)
  | 'show_passwords';        // إظهار كلمات مرور حسابات المشتركين

export interface PermissionDefinition {
  key: ModeratorPermission;
  label: string;
  description: string;
  group: 'المشتركون' | 'الاشتراكات' | 'المالية' | 'التقارير' | 'الرقابة' | 'الإعدادات';
}

export const ALL_MODERATOR_PERMISSIONS: PermissionDefinition[] = [
  { key: 'subscribers_view', label: 'عرض المشتركين', description: 'الاطلاع على قائمة المشتركين وتفاصيلهم', group: 'المشتركون' },
  { key: 'subscribers_create', label: 'إضافة مشترك جديد', description: 'إضافة مشتركين جدد وتعيين باقاتهم واشتراكاتهم', group: 'المشتركون' },
  { key: 'subscribers_edit', label: 'تعديل بيانات المشترك', description: 'تعديل هواتف ومناطق وملاحظات المشتركين', group: 'المشتركون' },
  { key: 'subscribers_archive', label: 'أرشفة المشتركين', description: 'أرشفة المشترك أو استرجاعه من الأرشيف', group: 'المشتركون' },
  { key: 'subscribers_delete', label: 'حذف المشترك نهائياً', description: 'حذف حساب المشترك وسجلاته نهائياً من المنظومة', group: 'المشتركون' },
  { key: 'subscriptions_renew', label: 'تجديد الاشتراكات', description: 'تجديد دورات الاشتراكات الشهرية وتعديل المدد', group: 'الاشتراكات' },
  { key: 'show_passwords', label: 'إظهار كلمات المرور', description: 'الاطلاع على كلمات مرور حسابات المشتركين بالشبكة', group: 'الاشتراكات' },
  { key: 'payments_view', label: 'عرض سجل الدفعات', description: 'الاطلاع على سندات القبض والدفعات المالية المسجلة', group: 'المالية' },
  { key: 'payments_create', label: 'تسجيل المقبوضات والسندات', description: 'تحصيل الأموال وإصدار سندات القبض للمشتركين', group: 'المالية' },
  { key: 'reports_export', label: 'تصدير التقارير (CSV/Excel)', description: 'تحميل كشوفات المشتركين وسندات القبض كملفات', group: 'التقارير' },
  { key: 'audit_view', label: 'عرض سجل الرقابة والحركات', description: 'متابعة سجل العمليات الحساسة في النظام', group: 'الرقابة' },
  { key: 'settings_view', label: 'الاطلاع على الإعدادات', description: 'مشاهدة إعدادات الشبكة والباقات (قراءة فقط دون تعديل)', group: 'الإعدادات' },
];

export type SubscriptionStatus = 'active' | 'expiring_soon' | 'expired';

export interface Settings {
  networkName: string;
  logoUrl?: string;
  currency: string;
  defaultDurationDays: number;
  expiryAlertDays: number;
  /** Auto logout after inactivity, in minutes. 0 = stay signed in (no auto logout). */
  sessionTimeoutMinutes: number;
  /** Automatic cloud backup interval in hours. 0 = manual only. */
  autoBackupIntervalHours: number;
  /** How many cloud backups to keep (older ones auto-deleted). */
  autoBackupRetention: number;
  /** Monthly collection target in currency units. 0 = hidden. */
  monthlyCollectionGoal: number;
  plans: Record<PlanType, { label: string; defaultPrice: number }>;
  defaultTheme: 'light' | 'dark';
  contactPhone?: string;
}

export interface Admin {
  id: string; // Login UID (primary identity)
  name: string;
  email: string;
  role: Role; // 'admin' | 'moderator'
  active: boolean;
  permissions?: ModeratorPermission[]; // Granular permissions (Admin has all automatically)
  createdAt: string; // ISO string for portability
  lastLoginAt?: string;
}

export interface Subscriber {
  id: string;
  name: string;
  phone?: string;
  area?: string;
  notes?: string;
  planType: PlanType;
  archived: boolean;
  /** Prepaid credit from plan-downgrade surpluses. Auto-applied to new charges. */
  creditBalance?: number;
  createdAt: string;
}

export interface Subscription {
  id: string;
  subscriberId: string;
  planType?: PlanType; // plan snapshot for this cycle (older cycles may lack it)
  username: string;
  password: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  durationDays: number;
  price: number;
  payStatus: PayStatus;
  paidAmount: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  subscriptionId: string;
  subscriberId: string;
  amount: number;
  date: string; // ISO date
  receivedBy: string;
  note?: string;
  /** Official sequential receipt number (YYYY-NNNN). Null while pending allocation. */
  receiptNo?: string | null;
}

export interface AuditLog {
  id: string;
  uid: string;
  userName: string;
  action: string;
  entity: 'subscriber' | 'subscription' | 'payment' | 'settings' | 'admin' | 'auth';
  entityId: string;
  entityName?: string;
  before?: unknown;
  after?: unknown;
  at: string; // ISO date
}

export interface SubscriberWithDetails extends Subscriber {
  currentSubscription?: Subscription;
  computedStatus: SubscriptionStatus;
  remainingAmount: number;
  /** True cash still due: cycle remainder minus available credit (never negative). */
  netDue: number;
}

/** Arabic display labels for audit-log entity kinds (never show raw keys). */
export const AUDIT_ENTITY_LABELS: Record<AuditLog['entity'], string> = {
  subscriber: 'مشترك',
  subscription: 'اشتراك',
  payment: 'دفعة مالية',
  settings: 'إعدادات النظام',
  admin: 'إدارة المستخدمين',
  auth: 'تسجيل الدخول',
};

/** One automatic/manual cloud backup (payload lives in `chunks` subcollection). */
export interface BackupMeta {
  id: string;
  createdAt: string; // ISO
  createdByUid: string;
  createdByName: string;
  auto: boolean;
  chunks: number;
  sizeBytes: number;
  counts: {
    subscribers: number;
    subscriptions: number;
    payments: number;
    admins: number;
    auditLogs: number;
  };
}
