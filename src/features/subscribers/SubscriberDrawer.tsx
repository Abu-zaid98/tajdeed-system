import React, { useState } from 'react';
import { Drawer } from '../../components/ui/Drawer';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { 
  Phone, 
  MapPin, 
  Key, 
  Eye, 
  EyeOff, 
  RefreshCw, 
  CreditCard, 
  MessageSquare, 
  RotateCcw,
  Calendar,
  Send,
  Lock,
  Edit,
  Trash2,
  Archive,
  ArrowLeftRight,
  FileText
} from 'lucide-react';
import { formatArabicDate, formatArabicDateTime, getRemainingDaysText } from '../../lib/dates';
import { formatCurrency, generateWhatsAppLink } from '../../lib/utils';
import { triggerConfetti } from '../../lib/confetti';
import { useAppStore } from '../../lib/store';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import type { SubscriberWithDetails, Subscription, Payment } from '../../types';

interface SubscriberDrawerProps {
  subscriber: SubscriberWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenPaymentModal: (subscription: Subscription) => void;
  onOpenRenewModal: (subscriber: SubscriberWithDetails) => void;
  onOpenChangePlanModal: (subscriber: SubscriberWithDetails) => void;
  onOpenEditModal: (subscriber: SubscriberWithDetails) => void;
  onViewReceipt: (payment: Payment, subscription: Subscription) => void;
}

export const SubscriberDrawer: React.FC<SubscriberDrawerProps> = ({
  subscriber,
  isOpen,
  onClose,
  onOpenPaymentModal,
  onOpenRenewModal,
  onOpenChangePlanModal,
  onOpenEditModal,
  onViewReceipt
}) => {
  const { subscriptions, payments, settings, toggleArchiveSubscriber, deleteSubscriber, logAuditAction, currentAdmin, hasPermission } = useAppStore();
  const [showPassword, setShowPassword] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  if (!subscriber) return null;

  const canShowPassword = hasPermission('show_passwords');
  const canArchive = hasPermission('subscribers_archive');
  const canDelete = hasPermission('subscribers_delete') || currentAdmin?.role === 'admin';
  const canEdit = hasPermission('subscribers_edit');
  const canPay = hasPermission('payments_create');
  const canRenew = hasPermission('subscriptions_renew');

  // History cycles for this subscriber (newest first)
  const subscriberCycles = subscriptions
    .filter(s => s.subscriberId === subscriber.id)
    .sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

  const currentCycle = subscriber.currentSubscription;

  const subscriberPayments = payments
    .filter(p => p.subscriberId === subscriber.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const remainingInfo = currentCycle ? getRemainingDaysText(currentCycle.endDate) : null;

  const handleTogglePassword = () => {
    if (!canShowPassword) return;
    const nextState = !showPassword;
    setShowPassword(nextState);
    if (nextState && currentCycle) {
      logAuditAction({
        action: `إظهار كلمة مرور المشترك: ${subscriber.name}`,
        entity: 'subscription',
        entityId: currentCycle.id,
        entityName: subscriber.name
      });
    }
  };

  const whatsAppUrl = currentCycle ? generateWhatsAppLink({
    phone: subscriber.phone,
    subscriberName: subscriber.name,
    endDate: formatArabicDate(currentCycle.endDate),
    remainingAmount: subscriber.remainingAmount > 0 ? subscriber.remainingAmount : currentCycle.price,
    currency: settings.currency,
    networkName: settings.networkName
  }) : '';

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      width="xl"
      title={
        <div className="flex items-center gap-2">
          <span>{subscriber.name}</span>
          <Badge planType={subscriber.planType} size="sm" />
          {subscriber.archived && <Badge variant="warning" size="sm">مؤرشف</Badge>}
        </div>
      }
      subtitle={`معرف المشترك: ${subscriber.id}`}
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex items-center gap-2">
            {canArchive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleArchiveSubscriber(subscriber.id)}
                leftIcon={subscriber.archived ? <RotateCcw className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
              >
                {subscriber.archived ? 'استرجاع' : 'أرشفة'}
              </Button>
            )}
            {canDelete && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
                leftIcon={<Trash2 className="w-4 h-4" />}
              >
                حذف المشترك
              </Button>
            )}
          </div>
          {canEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenEditModal(subscriber)}
              leftIcon={<Edit className="w-4 h-4" />}
            >
              تعديل البيانات
            </Button>
          )}
        </div>
      }
    >
      {/* Quick Status Bar */}
      <div className="glass-card p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-lg">
            {subscriber.name.charAt(0)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge status={subscriber.computedStatus} />
              {currentCycle && <Badge payStatus={currentCycle.payStatus} />}
            </div>
            {remainingInfo && (
              <p className={`text-xs mt-1 font-medium ${remainingInfo.isExpired ? 'text-rose-500' : 'text-slate-500'}`}>
                {remainingInfo.text}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {currentCycle && canPay && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onOpenPaymentModal(currentCycle)}
              leftIcon={<CreditCard className="w-4 h-4" />}
            >
              تسجيل دفعة
            </Button>
          )}
          {canRenew && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpenRenewModal(subscriber)}
              leftIcon={<RefreshCw className="w-4 h-4" />}
            >
              تجديد الدورة
            </Button>
          )}
          {canRenew && (
            <Button
              variant="glass"
              size="sm"
              onClick={() => onOpenChangePlanModal(subscriber)}
              leftIcon={<ArrowLeftRight className="w-4 h-4" />}
            >
              تغيير الباقة
            </Button>
          )}
        </div>
      </div>

      {/* WhatsApp reminder button if phone exists */}
      {subscriber.phone && (
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-between p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 transition-all text-xs font-semibold"
        >
          <div className="flex items-center gap-2.5">
            <MessageSquare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>إرسال تذكير التجديد والمستحقات عبر واتساب</span>
          </div>
          <Send className="w-4 h-4 rotate-180" />
        </a>
      )}

      {/* Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
          <span className="text-slate-400 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> رقم الهاتف
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100 dir-ltr block text-start">
            {subscriber.phone || 'غير مسجل'}
          </span>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
          <span className="text-slate-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> المنطقة / العنوان
          </span>
          <span className="font-semibold text-slate-800 dark:text-slate-100">
            {subscriber.area || 'غير محدد'}
          </span>
        </div>

        {subscriber.notes && (
          <div className="col-span-full p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1">
            <span className="text-slate-400 block">الملاحظات الفنية</span>
            <p className="text-slate-700 dark:text-slate-300">{subscriber.notes}</p>
          </div>
        )}
      </div>

      {/* Current Subscription Cycle Credentials & Balance */}
      {currentCycle ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              بيانات الدورة الحالية
            </h4>
            <span className="text-[11px] text-slate-400 font-mono">#{currentCycle.id}</span>
          </div>

          <div className="glass-card p-4 rounded-2xl space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block mb-0.5">اسم الدخول (Username)</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-white select-all">
                  {currentCycle.username}
                </span>
              </div>

              <div>
                <span className="text-slate-400 block mb-0.5">كلمة المرور (Password)</span>
                {canShowPassword ? (
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-slate-900 dark:text-white select-all">
                      {showPassword ? currentCycle.password : '••••••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={handleTogglePassword}
                      className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title={showPassword ? 'إخفاء' : 'إظهار كلمة المرور'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-400">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">••••••••••••</span>
                    <span className="text-[10px] text-slate-500">(محمية)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-white/5 pt-3 grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block mb-0.5">تاريخ البداية</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {formatArabicDate(currentCycle.startDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">تاريخ الانتهاء</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">
                  {formatArabicDate(currentCycle.endDate)}
                </span>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="border-t border-slate-100 dark:border-white/5 pt-3 flex items-center justify-between bg-slate-50/70 dark:bg-white/[0.02] -mx-4 -mb-4 p-4 rounded-b-2xl">
              <div>
                <span className="text-slate-400 text-[11px] block">السعر الإجمالي:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatCurrency(currentCycle.price, settings.currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">المدفوع:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {formatCurrency(currentCycle.paidAmount, settings.currency)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 text-[11px] block">المتبقي (الذمة):</span>
                <span className={`font-bold ${subscriber.remainingAmount > 0 ? 'text-rose-500' : 'text-slate-400'}`}>
                  {formatCurrency(subscriber.remainingAmount, settings.currency)}
                </span>
              </div>
              {(subscriber.creditBalance || 0) > 0 && (
                <div>
                  <span className="text-slate-400 text-[11px] block">رصيد دائن:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(subscriber.creditBalance || 0, settings.currency)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-6 border border-dashed rounded-2xl text-xs text-slate-400 space-y-2">
          <p>لا يوجد اشتراك نشط لهذا المشترك حالياً</p>
          <Button size="sm" onClick={() => onOpenRenewModal(subscriber)}>
            إنشاء دورة اشتراك الآن
          </Button>
        </div>
      )}

      {/* History Timeline of Subscriptions Cycles */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-500" />
          <span>سجل دورات الاشتراك ({subscriberCycles.length})</span>
        </h4>

        <div className="space-y-2 text-xs">
          {subscriberCycles.map((cycle, idx) => (
            <div
              key={cycle.id}
              className={`p-3 rounded-xl border transition-colors ${
                idx === 0 
                  ? 'border-brand-500/30 bg-brand-500/5' 
                  : 'border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2 flex-wrap">
                  <span>من {formatArabicDate(cycle.startDate)} إلى {formatArabicDate(cycle.endDate)}</span>
                  {cycle.planType && <Badge planType={cycle.planType} size="sm" />}
                </span>
                <Badge payStatus={cycle.payStatus} size="sm" />
              </div>
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>المبلغ: {formatCurrency(cycle.price, settings.currency)}</span>
                <span>المدفوع: {formatCurrency(cycle.paidAmount, settings.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Payments History */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-500" />
          <span>سجل سندات القبض والدفعات ({subscriberPayments.length})</span>
        </h4>

        {subscriberPayments.length > 0 ? (
          <div className="space-y-2 text-xs">
            {subscriberPayments.map(payment => {
              const matchedCycle = subscriptions.find(s => s.id === payment.subscriptionId);
              return (
                <div
                  key={payment.id}
                  className="p-3 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] flex items-center justify-between"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(payment.amount, settings.currency)}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {payment.receiptNo ? `#${payment.receiptNo} • ` : ''}
                      {formatArabicDateTime(payment.date)} • المستلم: {payment.receivedBy}
                    </div>
                    {payment.note && <div className="text-[11px] text-slate-500">{payment.note}</div>}
                  </div>
                  <Button
                    size="sm"
                    variant="glass"
                    onClick={() => matchedCycle && onViewReceipt(payment, matchedCycle)}
                    leftIcon={<FileText className="w-3.5 h-3.5" />}
                  >
                    السند
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3 text-center">لا توجد دفعات مسجلة حتى الآن</p>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => {
          deleteSubscriber(subscriber.id);
          setShowDeleteConfirm(false);
          onClose();
        }}
        title="حذف المشترك نهائياً"
        message={`هل أنت متأكد من حذف المشترك "${subscriber.name}" بشكل نهائي؟ سيتم حذف جميع بيانات الاشتراكات والدفعات المرتبطة به. لا يمكن التراجع عن هذا الإجراء.`}
        confirmText="نعم، احذف نهائياً"
        variant="danger"
      />
    </Drawer>
  );
};
