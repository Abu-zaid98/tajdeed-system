import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAppStore } from '../../lib/store';
import { formatCurrency } from '../../lib/utils';
import { triggerConfetti } from '../../lib/confetti';
import type { Subscription, Payment } from '../../types';
import { CreditCard, DollarSign, FileText, CheckCircle2 } from 'lucide-react';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscription: Subscription | null;
  onPaymentSuccess?: (payment: Payment, subscription: Subscription) => void;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  subscription,
  onPaymentSuccess
}) => {
  const { subscribers, settings, addPayment, currentAdmin } = useAppStore();

  const [amount, setAmount] = useState<number>(0);
  const [note, setNote] = useState('');
  const [isFullPayment, setIsFullPayment] = useState(true);

  const subscriber = subscription
    ? subscribers.find(s => s.id === subscription.subscriberId)
    : null;

  const cycleRemainder = subscription
    ? Math.max(0, subscription.price - subscription.paidAmount)
    : 0;
  const credit = subscriber?.creditBalance || 0;
  // True cash due: cycle remainder minus prepaid credit.
  const remainingBalance = Math.max(0, cycleRemainder - credit);

  useEffect(() => {
    if (subscription) {
      const rem = Math.max(0, subscription.price - subscription.paidAmount);
      const c = subscribers.find(s => s.id === subscription.subscriberId)?.creditBalance || 0;
      setAmount(Math.max(0, rem - c));
      setIsFullPayment(true);
      setNote('');
    }
  }, [subscription, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscription || !subscriber || amount <= 0) return;

    const created = await addPayment({
      subscriptionId: subscription.id,
      subscriberId: subscriber.id,
      amount,
      note: note.trim() ? note : isFullPayment ? 'سداد كامل المبلغ' : 'دفعة جزئية'
    });
    if (!created) return;

    triggerConfetti();

    if (onPaymentSuccess) {
      onPaymentSuccess(created, subscription);
    }

    onClose();
  };

  if (!subscription || !subscriber) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل دفعة نقدية وسند قبض"
      description={`المشترك: ${subscriber.name}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Balance Status Card */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-2 text-xs">
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>سعر دورة الاشتراك:</span>
            <span className="font-semibold text-slate-700 dark:text-slate-200">
              {formatCurrency(subscription.price, settings.currency)}
            </span>
          </div>
          <div className="flex justify-between text-slate-500 dark:text-slate-400">
            <span>المبلغ المدفوع سابقاً:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              {formatCurrency(subscription.paidAmount, settings.currency)}
            </span>
          </div>
          {credit > 0 && (
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>رصيد دائن يُخصم تلقائياً:</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                −{formatCurrency(Math.min(credit, cycleRemainder), settings.currency)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t pt-2 border-slate-200 dark:border-white/10">
            <span className="text-slate-900 dark:text-white">المبلغ المتبقي المطلوب نقداً:</span>
            <span className="text-rose-600 dark:text-rose-400">
              {formatCurrency(remainingBalance, settings.currency)}
            </span>
          </div>
        </div>

        {/* Quick Amount Selection */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            خيارات السداد
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setAmount(remainingBalance);
                setIsFullPayment(true);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                isFullPayment
                  ? 'bg-emerald-500 text-white border-emerald-500 shadow-md'
                  : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-emerald-500/40'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>سداد كامل ({remainingBalance.toLocaleString('en-US')})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFullPayment(false);
                setAmount(Math.round(remainingBalance / 2));
              }}
              className={`py-2 px-3 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all ${
                !isFullPayment
                  ? 'bg-amber-500 text-white border-amber-500 shadow-md'
                  : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-amber-500/40'
              }`}
            >
              <span>دفعة جزئية (يدوي)</span>
            </button>
          </div>
        </div>

        {/* Amount Input */}
        <Input
          label="المبلغ المستلم فعلياً"
          type="number"
          value={amount}
          onChange={e => {
            setAmount(Number(e.target.value));
            setIsFullPayment(Number(e.target.value) >= remainingBalance);
          }}
          startIcon={<DollarSign className="w-4 h-4" />}
          helperText={`المتبقي بعد هذه الدفعة: ${formatCurrency(Math.max(0, remainingBalance - amount), settings.currency)}`}
          required
          min={100}
        />

        {/* Note */}
        <Input
          label="ملاحظة الدفعة (اختياري)"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="مثال: نقداً، زين كاش، تحويل، رقم إيصال يدوي..."
        />

        {/* Submitter info */}
        <div className="text-[11px] text-slate-400">
          * يتم تسجيل مستلم الدفعة تلقائياً باسم المسؤول الحالي ({currentAdmin?.name}).
        </div>

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="success" type="submit" leftIcon={<CreditCard className="w-4 h-4" />}>
            تسجيل الدفعة وإصدار السند
          </Button>
        </div>
      </form>
    </Modal>
  );
};
