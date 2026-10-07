import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  RefreshCw, 
  CreditCard, 
  Archive, 
  CheckSquare, 
  Square, 
  MoreVertical,
  Phone,
  MapPin,
  Calendar,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { formatArabicDate, getRemainingDaysText } from '../../lib/dates';
import { formatCurrency, exportToCsv } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { triggerConfetti } from '../../lib/confetti';
import type { SubscriberWithDetails, Subscription, PlanType, SubscriptionStatus, PayStatus } from '../../types';

interface SubscribersViewProps {
  onSelectSubscriber: (id: string) => void;
  onOpenAddSubscriber: () => void;
  onOpenPaymentModal: (subscription: Subscription) => void;
  onOpenRenewModal: (subscriber: SubscriberWithDetails) => void;
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({
  onSelectSubscriber,
  onOpenAddSubscriber,
  onOpenPaymentModal,
  onOpenRenewModal
}) => {
  const { subscribersWithDetails, settings, renewSubscription, hasPermission } = useAppStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<PlanType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<SubscriptionStatus | 'all'>('all');
  const [selectedPayStatus, setSelectedPayStatus] = useState<PayStatus | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);

  // Bulk renewal selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Incremental rendering for large lists
  const [visibleCount, setVisibleCount] = useState(60);
  useEffect(() => {
    setVisibleCount(60);
  }, [searchQuery, selectedPlan, selectedStatus, selectedPayStatus, showArchived]);

  const canCreateSubscriber = hasPermission('subscribers_create');
  const canRenew = hasPermission('subscriptions_renew');
  const canPay = hasPermission('payments_create');
  const canExport = hasPermission('reports_export');
  const canArchive = hasPermission('subscribers_archive');

  // Filtered subscribers
  const filteredSubscribers = useMemo(() => {
    return subscribersWithDetails.filter(sub => {
      // Archive filter
      if (showArchived ? !sub.archived : sub.archived) return false;

      // Plan filter
      if (selectedPlan !== 'all' && sub.planType !== selectedPlan) return false;

      // Status filter
      if (selectedStatus !== 'all' && sub.computedStatus !== selectedStatus) return false;

      // PayStatus filter
      if (selectedPayStatus !== 'all') {
        if (!sub.currentSubscription || sub.currentSubscription.payStatus !== selectedPayStatus) {
          return false;
        }
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = sub.name.toLowerCase().includes(q);
        const matchesPhone = sub.phone ? sub.phone.includes(q) : false;
        const matchesArea = sub.area ? sub.area.toLowerCase().includes(q) : false;
        const matchesUsername = sub.currentSubscription
          ? sub.currentSubscription.username.toLowerCase().includes(q)
          : false;

        if (!matchesName && !matchesPhone && !matchesArea && !matchesUsername) {
          return false;
        }
      }

      return true;
    });
  }, [subscribersWithDetails, searchQuery, selectedPlan, selectedStatus, selectedPayStatus, showArchived]);

  const visibleSubscribers = filteredSubscribers.slice(0, visibleCount);

  // Bulk actions
  const toggleSelectAll = () => {
    if (selectedIds.length === filteredSubscribers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredSubscribers.map(s => s.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkRenew = () => {
    if (!canRenew || selectedIds.length === 0) return;
    selectedIds.forEach(id => {
      renewSubscription(id);
    });
    triggerConfetti();
    setSelectedIds([]);
  };

  const handleExportCsv = () => {
    if (!canExport) return;
    const exportData = filteredSubscribers.map(s => ({
      'الاسم': s.name,
      'رقم الهاتف': s.phone || '',
      'المنطقة': s.area || '',
      'نوع الباقة': s.planType === 'home' ? 'منزلي' : 'شخصي',
      'حالة الاشتراك': s.computedStatus === 'active' ? 'فعال' : s.computedStatus === 'expiring_soon' ? 'ينتهي قريباً' : 'منتهي',
      'تاريخ الانتهاء': s.currentSubscription ? formatArabicDate(s.currentSubscription.endDate) : '',
      'اسم الدخول': s.currentSubscription ? s.currentSubscription.username : '',
      'حالة الدفع': s.currentSubscription ? s.currentSubscription.payStatus : '',
      'المبلغ المتبقي': s.netDue,
      'رصيد دائن': s.creditBalance || 0
    }));

    exportToCsv(exportData, `مشتركو_الشبكة_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-5 text-start">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span>سجل المشتركين</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20">
              {filteredSubscribers.length.toLocaleString('en-US')} مشترك
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            إدارة بيانات المشتركين، التجديد الشهري، والتحقق من حالات الدفع
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canExport && (
            <Button
              variant="glass"
              size="sm"
              onClick={handleExportCsv}
              leftIcon={<FileSpreadsheet className="w-4 h-4 text-emerald-500" />}
            >
              تصدير Excel/CSV
            </Button>
          )}

          {canCreateSubscriber && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenAddSubscriber}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              مشترك جديد (N)
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="glass-card p-4 rounded-2xl space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* Quick Search */}
          <div className="flex-1">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم، رقم الهاتف، اسم المستخدم، المنطقة..."
              startIcon={<Search className="w-4 h-4" />}
            />
          </div>

          {/* Filters Group */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Plan Filter */}
            <CustomSelect
              value={selectedPlan}
              onChange={(v) => setSelectedPlan(v as any)}
              size="sm"
              options={[
                { value: 'all', label: 'كافة الباقات' },
                { value: 'home', label: 'منزلي (عائلي)' },
                { value: 'personal', label: 'شخصي (اقتصادي)' },
              ]}
            />

            {/* Status Filter */}
            <CustomSelect
              value={selectedStatus}
              onChange={(v) => setSelectedStatus(v as any)}
              size="sm"
              options={[
                { value: 'all', label: 'كافة الحالات' },
                { value: 'active', label: 'فعّال' },
                { value: 'expiring_soon', label: 'ينتهي قريباً' },
                { value: 'expired', label: 'منتهي الصلاحية' },
              ]}
            />

            {/* Pay Status Filter */}
            <CustomSelect
              value={selectedPayStatus}
              onChange={(v) => setSelectedPayStatus(v as any)}
              size="sm"
              options={[
                { value: 'all', label: 'كافة حالات الدفع' },
                { value: 'paid', label: 'مدفوع' },
                { value: 'partial', label: 'دفعة جزئية' },
                { value: 'unpaid', label: 'غير مدفوع' },
              ]}
            />

            {/* Archive Toggle */}
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`p-2.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                showArchived
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  : 'bg-white dark:bg-[#0c101d] border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-brand-500/40'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{showArchived ? 'المشتركون المؤرشفون' : 'النشطون'}</span>
            </button>
          </div>
        </div>

        {/* Bulk Action Bar (if selected) */}
        {selectedIds.length > 0 && (
          <div className="pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between bg-brand-500/5 -mx-4 -mb-4 p-4 rounded-b-2xl">
            <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
              تم تحديد {selectedIds.length} مشترك
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleBulkRenew}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                تجديد جماعي للجميع ({selectedIds.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
                إلغاء التحديد
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-start text-xs">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-white/5 bg-slate-100/60 dark:bg-white/[0.02] text-slate-600 dark:text-slate-400">
              <th className="p-4 w-10 text-center">
                <button onClick={toggleSelectAll} className="p-1">
                  {selectedIds.length === filteredSubscribers.length && filteredSubscribers.length > 0 ? (
                    <CheckSquare className="w-4 h-4 text-brand-500" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                </button>
              </th>
              <th className="p-4 text-start font-bold">المشترك</th>
              <th className="p-4 text-start font-bold">الباقة</th>
              <th className="p-4 text-start font-bold">حالة الاشتراك</th>
              <th className="p-4 text-start font-bold">تاريخ الانتهاء</th>
              <th className="p-4 text-start font-bold">حالة الدفع والمتبقي</th>
              <th className="p-4 text-end font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {visibleSubscribers.length > 0 ? (
              visibleSubscribers.map(sub => {
                const isSelected = selectedIds.includes(sub.id);
                const current = sub.currentSubscription;
                const remaining = current ? getRemainingDaysText(current.endDate) : null;

                return (
                  <tr
                    key={sub.id}
                    className={`hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors ${
                      isSelected ? 'bg-brand-500/5' : ''
                    }`}
                  >
                    <td className="p-4 text-center">
                      <button onClick={() => toggleSelectOne(sub.id)} className="p-1">
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-500" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>
                    </td>

                    {/* Subscriber Info */}
                    <td 
                      className="p-4 cursor-pointer"
                      onClick={() => onSelectSubscriber(sub.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-xs">
                          {sub.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white hover:text-brand-500 transition-colors">
                            {sub.name}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            {sub.phone && <span className="dir-ltr">{sub.phone}</span>}
                            {sub.area && <span>• {sub.area}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Plan */}
                    <td className="p-4">
                      <Badge planType={sub.planType} size="sm" />
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      <Badge status={sub.computedStatus} size="sm" />
                    </td>

                    {/* End Date */}
                    <td className="p-4 text-slate-700 dark:text-slate-300">
                      {current ? (
                        <div>
                          <span className="font-semibold">{formatArabicDate(current.endDate)}</span>
                          {remaining && (
                            <span className={`block text-[11px] ${remaining.isExpired ? 'text-rose-500' : 'text-slate-400'}`}>
                              {remaining.text}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">لا يوجد اشتراك</span>
                      )}
                    </td>

                    {/* Payment & Remaining */}
                    <td className="p-4">
                      {current ? (
                        <div className="space-y-1">
                          <Badge payStatus={current.payStatus} size="sm" />
                          {sub.netDue > 0 && (
                            <div className="text-[11px] font-bold text-rose-500">
                              متبقي: {formatCurrency(sub.netDue, settings.currency)}
                            </div>
                          )}
                          {(sub.creditBalance || 0) > 0 && (
                            <div className="text-[11px] font-bold text-emerald-500">
                              رصيد: {formatCurrency(sub.creditBalance || 0, settings.currency)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-end">
                      <div className="flex items-center justify-end gap-1.5">
                        {current && sub.netDue > 0 && canPay && (
                          <Button
                            size="sm"
                            variant="glass"
                            onClick={() => onOpenPaymentModal(current)}
                            leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                          >
                            سداد
                          </Button>
                        )}
                        {canRenew && (
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onOpenRenewModal(sub)}
                            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                          >
                            تجديد
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSelectSubscriber(sub.id)}
                        >
                          التفاصيل
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                  لا يوجد مشتركون مطابقون للفلاتر الحالية
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {filteredSubscribers.length > visibleSubscribers.length && (
          <button
            type="button"
            onClick={() => setVisibleCount(c => c + 60)}
            className="hidden md:block w-full mt-3 py-3 rounded-2xl glass text-xs font-bold text-brand-500 hover:bg-brand-500/10 transition-colors"
          >
            عرض المزيد ({(filteredSubscribers.length - visibleSubscribers.length).toLocaleString('en-US')} متبقية)
          </button>
        )}
      </div>

      {/* Mobile Cards View */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {visibleSubscribers.length > 0 ? (
          visibleSubscribers.map(sub => {
            const current = sub.currentSubscription;
            const remaining = current ? getRemainingDaysText(current.endDate) : null;

            return (
              <div
                key={sub.id}
                className="glass-card p-4 rounded-2xl space-y-3"
              >
                <div 
                  className="flex items-start justify-between cursor-pointer"
                  onClick={() => onSelectSubscriber(sub.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm">
                      {sub.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white">
                        {sub.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        {sub.phone && <span className="dir-ltr">{sub.phone}</span>}
                        {sub.area && <span>• {sub.area}</span>}
                      </div>
                    </div>
                  </div>
                  <Badge planType={sub.planType} size="sm" />
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-100 dark:border-white/5">
                  <div>
                    <span className="text-slate-400 block text-[11px]">حالة الاشتراك:</span>
                    <Badge status={sub.computedStatus} size="sm" className="mt-1" />
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">حالة الدفع:</span>
                    {current ? <Badge payStatus={current.payStatus} size="sm" className="mt-1" /> : '-'}
                  </div>
                </div>

                {current && (
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>ينتهي: {formatArabicDate(current.endDate)}</span>
                    {remaining && (
                      <span className={remaining.isExpired ? 'text-rose-500 font-bold' : 'text-slate-400'}>
                        {remaining.text}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  {current && sub.netDue > 0 && canPay && (
                    <Button
                      size="sm"
                      variant="glass"
                      className="flex-1"
                      onClick={() => onOpenPaymentModal(current)}
                      leftIcon={<CreditCard className="w-3.5 h-3.5" />}
                    >
                      سداد ({formatCurrency(sub.netDue, settings.currency)})
                    </Button>
                  )}
                  {canRenew && (
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onClick={() => onOpenRenewModal(sub)}
                      leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                    >
                      تجديد
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onSelectSubscriber(sub.id)}
                  >
                    التفاصيل
                  </Button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-slate-400 text-xs">
            لا يوجد مشتركون مطابقون للفلاتر الحالية
          </div>
        )}
        {filteredSubscribers.length > visibleSubscribers.length && (
          <button
            type="button"
            onClick={() => setVisibleCount(c => c + 60)}
            className="md:hidden w-full py-3 rounded-2xl glass text-xs font-bold text-brand-500 hover:bg-brand-500/10 transition-colors"
          >
            عرض المزيد ({(filteredSubscribers.length - visibleSubscribers.length).toLocaleString('en-US')} متبقية)
          </button>
        )}
      </div>
    </div>
  );
};
