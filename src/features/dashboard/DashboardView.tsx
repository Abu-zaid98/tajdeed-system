import React from 'react';
import { 
  Wifi, 
  Users, 
  AlertTriangle, 
  Clock, 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  ArrowUpRight,
  Send,
  RefreshCw,
  Plus,
  CheckCircle2,
  Lock,
  Target,
  PieChart as PieChartIcon
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { useAppStore } from '../../lib/store';
import { formatCurrency, generateWhatsAppLink } from '../../lib/utils';
import { formatArabicDate } from '../../lib/dates';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import type { SubscriberWithDetails, Subscription } from '../../types';

interface DashboardViewProps {
  onSelectSubscriber: (id: string) => void;
  onOpenAddSubscriber: () => void;
  onOpenPaymentModal: (subscription: Subscription) => void;
  onOpenRenewModal: (subscriber: SubscriberWithDetails) => void;
  onNavigate?: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onSelectSubscriber,
  onOpenAddSubscriber,
  onOpenPaymentModal,
  onOpenRenewModal,
  onNavigate
}) => {
  const { subscribersWithDetails, settings, payments, currentAdmin, hasPermission } = useAppStore();

  const nonArchivedSubscribers = subscribersWithDetails.filter(s => !s.archived);

  // Permissions
  const canViewMoney = hasPermission('payments_view');
  const canAddSubscriber = hasPermission('subscribers_create');
  const canBrowseSubscribers = hasPermission('subscribers_view');

  // Smart greeting (morning until noon, evening after)
  const hour = new Date().getHours();
  const greeting = hour >= 5 && hour < 12 ? 'صباح الخير' : 'مساء الخير';
  const firstName = currentAdmin?.name?.split(' ')[0] || '';

  // Compute stats
  const activeCount = nonArchivedSubscribers.filter(s => s.computedStatus === 'active').length;
  const expiringSoonCount = nonArchivedSubscribers.filter(s => s.computedStatus === 'expiring_soon').length;
  const expiredCount = nonArchivedSubscribers.filter(s => s.computedStatus === 'expired').length;

  const unpaidCount = nonArchivedSubscribers.filter(
    s => s.currentSubscription && s.currentSubscription.payStatus !== 'paid'
  ).length;

  // True receivables: cycle remainder minus prepaid credit (never negative).
  const totalOutstandingDebt = nonArchivedSubscribers.reduce(
    (sum, s) => sum + s.netDue,
    0
  );

  const totalMonthlyCollected = payments.reduce(
    (sum, p) => sum + p.amount,
    0
  );

  // This month's context (trends + goal)
  const nowRef = new Date();
  const thisYear = nowRef.getFullYear();
  const thisMonth = nowRef.getMonth();
  const inThisMonth = (iso: string) => {
    const d = new Date(iso);
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  };
  const newThisMonth = nonArchivedSubscribers.filter(s => {
    try {
      return inThisMonth(s.createdAt);
    } catch {
      return false;
    }
  }).length;
  const debtorsCount = nonArchivedSubscribers.filter(s => s.netDue > 0).length;
  const collectedThisMonth = payments
    .filter(p => {
      try {
        return inThisMonth(p.date);
      } catch {
        return false;
      }
    })
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const goal = settings.monthlyCollectionGoal || 0;
  const goalPct = goal > 0 ? Math.min(100, Math.round((collectedThisMonth / goal) * 100)) : 0;
  const RING_R = 30;
  const RING_C = 2 * Math.PI * RING_R;

  // Home vs Personal distribution
  const homeCount = nonArchivedSubscribers.filter(s => s.planType === 'home').length;
  const personalCount = nonArchivedSubscribers.filter(s => s.planType === 'personal').length;

  const planPieData = [
    homeCount > 0 ? { name: settings.plans.home.label, value: homeCount, color: '#0ea5e9' } : null,
    personalCount > 0 ? { name: settings.plans.personal.label, value: personalCount, color: '#8b5cf6' } : null
  ].filter(Boolean) as { name: string; value: number; color: string }[];

  // If no subscribers at all, show placeholder
  const planPieDisplay = planPieData.length > 0
    ? planPieData
    : [{ name: 'لا يوجد مشتركون', value: 1, color: '#94a3b8' }];

  // Urgent follow-ups list: expired or expiring soon OR with net cash due
  const urgentSubscribers = nonArchivedSubscribers
    .filter(s => s.computedStatus === 'expiring_soon' || s.computedStatus === 'expired' || s.netDue > 0)
    .slice(0, 5);

  // Revenue chart: last 4 Gregorian months with real payment data
  const revenueChartData = (() => {
    const now = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (3 - i), 1);
      const yr = d.getFullYear();
      const mo = d.getMonth(); // 0-indexed
      const monthPayments = payments.filter(p => {
        const pd = new Date(p.date);
        return pd.getFullYear() === yr && pd.getMonth() === mo;
      });
      const amount = monthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      // Arabic Gregorian month name (يناير، فبراير...)
      const monthLabel = d.toLocaleString('ar-EG-u-ca-gregory', { month: 'long' });
      return { month: monthLabel, amount };
    });
  })();

  return (
    <div className="space-y-6 text-start">
      {/* Top Greeting & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2.5">
            <span>{greeting}{firstName ? `، ${firstName}` : ''}</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            {expiringSoonCount + expiredCount > 0 ? (
              <span>
                لديك {expiringSoonCount} تنتهي خلال {settings.expiryAlertDays} أيام و{expiredCount} منتهية
                {canViewMoney && debtorsCount > 0 ? ` — و${debtorsCount} بذمة مالية` : ''} تحتاج متابعة
              </span>
            ) : (
              <span>جميع الاشتراكات فعّالة — يوم موفق في التحصيل ({settings.currency})</span>
            )}
          </p>
        </div>

        {canAddSubscriber && (
          <Button
            variant="primary"
            onClick={onOpenAddSubscriber}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            إضافة مشترك جديد (N)
          </Button>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {canAddSubscriber && (
          <button
            type="button"
            onClick={onOpenAddSubscriber}
            className="glass-card p-3.5 rounded-2xl flex items-center gap-2.5 text-start hover:border-brand-500/40 transition-all group"
          >
            <span className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0 group-hover:bg-brand-500 group-hover:text-white transition-colors">
              <Plus className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">إضافة مشترك</span>
          </button>
        )}
        {canBrowseSubscribers && (
          <button
            type="button"
            onClick={() => onNavigate?.('reminders')}
            className="glass-card p-3.5 rounded-2xl flex items-center gap-2.5 text-start hover:border-emerald-500/40 transition-all group"
          >
            <span className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Send className="w-4 h-4 rotate-180" />
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">التذكيرات</span>
          </button>
        )}
        {canViewMoney && (
          <button
            type="button"
            onClick={() => onNavigate?.('payments')}
            className="glass-card p-3.5 rounded-2xl flex items-center gap-2.5 text-start hover:border-amber-500/40 transition-all group"
          >
            <span className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <CreditCard className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">الدفعات والسندات</span>
          </button>
        )}
        {canBrowseSubscribers && (
          <button
            type="button"
            onClick={() => onNavigate?.('subscribers')}
            className="glass-card p-3.5 rounded-2xl flex items-center gap-2.5 text-start hover:border-violet-500/40 transition-all group"
          >
            <span className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0 group-hover:bg-violet-500 group-hover:text-white transition-colors">
              <Users className="w-4 h-4" />
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">المشتركون</span>
          </button>
        )}
      </div>

      {/* Zero Subscribers Onboarding Banner */}
      {subscribersWithDetails.length === 0 && (
        <div className="glass-card p-6 rounded-3xl border border-brand-500/30 bg-gradient-to-r from-brand-500/10 via-brand-500/5 to-transparent flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1 text-start">
            <h3 className="font-bold text-base text-slate-900 dark:text-white flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>قاعدة البيانات السحابية متصلة وجاهزة بنجاح</span>
            </h3>
            <p className="text-xs text-slate-400">
              تم مسح كافة البيانات المؤقتة. يمكنك الآن البدء بإضافة المشتركين الحقيقيين وتحديد باقاتهم وإصدار سندات القبض بالعملة الرسمية ({settings.currency}).
            </p>
          </div>
          <Button
            variant="primary"
            onClick={onOpenAddSubscriber}
            leftIcon={<Plus className="w-4 h-4" />}
            size="md"
          >
            إضافة أول مشترك الآن
          </Button>
        </div>
      )}

      {/* KPI Stats Cards — tap a card to jump to its list */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Active */}
        <button
          type="button"
          onClick={() => canBrowseSubscribers && onNavigate?.('subscribers')}
          className="glass-card p-4 sm:p-5 rounded-2xl space-y-2 relative overflow-hidden group text-start hover:border-emerald-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">الاشتراكات الفعّالة</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {activeCount}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
            <span>+{newThisMonth} مشترك جديد هذا الشهر</span>
          </div>
        </button>

        {/* Expiring Soon */}
        <button
          type="button"
          onClick={() => canBrowseSubscribers && onNavigate?.('subscribers')}
          className="glass-card p-4 sm:p-5 rounded-2xl space-y-2 relative overflow-hidden group text-start hover:border-amber-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              تنتهي خلال {settings.expiryAlertDays} أيام
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400">
            {expiringSoonCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            تحتاج تذكير للتجديد
          </div>
        </button>

        {/* Expired / Unpaid */}
        <button
          type="button"
          onClick={() => canBrowseSubscribers && onNavigate?.('subscribers')}
          className="glass-card p-4 sm:p-5 rounded-2xl space-y-2 relative overflow-hidden group text-start hover:border-rose-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">منتهية أو غير مدفوعة</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400">
            {expiredCount}
          </div>
          <div className="text-[11px] text-rose-500 font-medium">
            {unpaidCount} اشتراك بانتظار الدفع
          </div>
        </button>

        {/* Outstanding Receivables / Debt */}
        <button
          type="button"
          onClick={() => canViewMoney && onNavigate?.('payments')}
          className="glass-card p-4 sm:p-5 rounded-2xl space-y-2 relative overflow-hidden group text-start hover:border-blue-500/40 transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">إجمالي الذمم والمستحقات</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              {canViewMoney ? <DollarSign className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
            </div>
          </div>
          {canViewMoney ? (
            <>
              <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrency(totalOutstandingDebt, settings.currency)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                على {debtorsCount} مشترك — اضغط لعرض الدفعات
              </div>
            </>
          ) : (
            <>
              <div className="text-xl sm:text-2xl font-black text-slate-400">
                ••••••
              </div>
              <div className="text-[11px] text-slate-400 font-medium">
                يتطلب صلاحية عرض الدفعات
              </div>
            </>
          )}
        </button>
      </div>

      {/* Monthly collection goal */}
      {goal > 0 && (
        <div className="glass-card p-4 sm:p-5 rounded-2xl flex items-center gap-4">
          <div className="relative w-[76px] h-[76px] shrink-0">
            <svg width="76" height="76" viewBox="0 0 76 76">
              <circle cx="38" cy="38" r={RING_R} strokeWidth="8" fill="none" className="stroke-slate-200 dark:stroke-white/10" />
              <circle
                cx="38"
                cy="38"
                r={RING_R}
                strokeWidth="8"
                fill="none"
                stroke={goalPct >= 100 ? '#10b981' : '#0284c7'}
                strokeLinecap="round"
                strokeDasharray={RING_C}
                strokeDashoffset={RING_C - (RING_C * goalPct) / 100}
                transform="rotate(-90 38 38)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-sm font-black text-slate-900 dark:text-white">
              {canViewMoney ? `${goalPct}%` : <Lock className="w-4 h-4 text-slate-400" />}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <Target className="w-4 h-4 text-brand-500" />
              <span>هدف التحصيل الشهري</span>
            </h3>
            {canViewMoney ? (
              <p className="text-xs text-slate-500 mt-1">
                حُصّل {formatCurrency(collectedThisMonth, settings.currency)} من {formatCurrency(goal, settings.currency)} هذا الشهر
                {goalPct >= 100 ? ' — تم تحقيق الهدف 🎯' : ` — متبقي ${formatCurrency(Math.max(0, goal - collectedThisMonth), settings.currency)}`}
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">يتطلب صلاحية عرض الدفعات لعرض التقدم</p>
            )}
            {canViewMoney && (
              <div className="h-2 mt-2 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${goalPct >= 100 ? 'bg-emerald-500' : 'bg-brand-500'}`}
                  style={{ width: `${goalPct}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Analytics & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Performance Chart */}
        <div className="lg:col-span-2 glass-card p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-brand-500" />
                <span>حركة التحصيل والإيرادات الشهرية</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                إجمالي المقبوضات المسجلة عبر سندات القبض
              </p>
            </div>
            {canViewMoney ? (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                {formatCurrency(totalMonthlyCollected, settings.currency)}
              </span>
            ) : (
              <span className="text-xs font-bold text-slate-400 bg-slate-500/10 px-3 py-1 rounded-full border border-slate-500/20 flex items-center gap-1">
                <Lock className="w-3 h-3" /> غير مصرح
              </span>
            )}
          </div>

          {canViewMoney ? (
          <div className="h-60 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [formatCurrency(Number(val), settings.currency), 'المحصل']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#ffffff',
                    textAlign: 'right'
                  }}
                />
                <Bar dataKey="amount" fill="#0284c7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          ) : (
          <div className="h-60 w-full flex flex-col items-center justify-center gap-2 text-slate-400">
            <Lock className="w-6 h-6" />
            <span className="text-xs">الأرقام المالية تتطلب صلاحية عرض الدفعات</span>
          </div>
          )}
        </div>

        {/* Plan Distribution Pie */}
        <div className="glass-card p-5 rounded-2xl space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-purple-500" />
              <span>توزيع الباقات والاشتراكات</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              نسبة المشتركين المنزليين مقابل الشخصيين
            </p>
          </div>

          <div className="h-44 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={planPieDisplay}
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={70}
                  paddingAngle={planPieDisplay.length > 1 ? 5 : 0}
                  dataKey="value"
                >
                  {planPieDisplay.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${Number(val).toLocaleString('en-US')} مشترك`, 'العدد']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#ffffff',
                    textAlign: 'right'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/5 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-500" />
                <span className="text-slate-700 dark:text-slate-300">منزلي (عائلي)</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{homeCount.toLocaleString('en-US')} مشترك</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-violet-500" />
                <span className="text-slate-700 dark:text-slate-300">شخصي (اقتصادي)</span>
              </div>
              <span className="font-bold text-slate-900 dark:text-white">{personalCount.toLocaleString('en-US')} مشترك</span>
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Follow-Up Section */}
      <div className="glass-card p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>قائمة تحتاج متابعة فورية (منتهية أو تنتهي قريباً أو عليها ذمة)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              إجراءات مباشرة لتجديد الاشتراك، تحصيل الدفعة، أو إرسال تذكير واتساب
            </p>
          </div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {urgentSubscribers.length > 0 ? (
            urgentSubscribers.map(sub => {
              const current = sub.currentSubscription;
              const whatsAppUrl = current ? generateWhatsAppLink({
                phone: sub.phone,
                subscriberName: sub.name,
                endDate: formatArabicDate(current.endDate),
                remainingAmount: sub.netDue > 0 ? sub.netDue : (sub.remainingAmount > 0 ? sub.remainingAmount : current.price),
                currency: settings.currency,
                networkName: settings.networkName
              }) : '';

              return (
                <div
                  key={sub.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-start"
                >
                  <div 
                    onClick={() => onSelectSubscriber(sub.id)}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-sm group-hover:bg-brand-500 group-hover:text-white transition-colors">
                      {sub.name.charAt(0)}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-brand-500 transition-colors flex items-center gap-2">
                        <span>{sub.name}</span>
                        <Badge planType={sub.planType} size="sm" />
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {current && <span>ينتهي: {formatArabicDate(current.endDate)}</span>}
                        {sub.phone && <span className="dir-ltr">• {sub.phone}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge status={sub.computedStatus} size="sm" />
                    {sub.netDue > 0 && (
                      <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                        متبقي {formatCurrency(sub.netDue, settings.currency)}
                      </span>
                    )}

                    {/* WhatsApp */}
                    {sub.phone && (
                      <a
                        href={whatsAppUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="إرسال تذكير واتساب"
                      >
                        <Send className="w-4 h-4 rotate-180" />
                      </a>
                    )}

                    {/* Pay button */}
                    {current && sub.netDue > 0 && hasPermission('payments_create') && (
                      <Button
                        size="sm"
                        variant="glass"
                        onClick={() => onOpenPaymentModal(current)}
                        leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                      >
                        سداد
                      </Button>
                    )}

                    {/* Renew button */}
                    {hasPermission('subscriptions_renew') && (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onOpenRenewModal(sub)}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      تجديد
                    </Button>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              ممتاز! جميع الاشتراكات فعّالة ومسددة بالكامل.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
