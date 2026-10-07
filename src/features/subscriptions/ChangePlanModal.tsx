import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAppStore } from '../../lib/store';
import { formatCurrency, computePlanChangeBalance } from '../../lib/utils';
import { formatArabicDate } from '../../lib/dates';
import type { PlanType, SubscriberWithDetails } from '../../types';
import { ArrowLeftRight, DollarSign, User, Key } from 'lucide-react';

interface ChangePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: SubscriberWithDetails | null;
}

export const ChangePlanModal: React.FC<ChangePlanModalProps> = ({
  isOpen,
  onClose,
  subscriber
}) => {
  const { settings, changeSubscriptionPlan } = useAppStore();

  const [newPlan, setNewPlan] = useState<PlanType>('home');
  const [price, setPrice] = useState(0);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (subscriber && isOpen) {
      const initial: PlanType = subscriber.planType === 'home' ? 'personal' : 'home';
      setNewPlan(initial);
      setPrice(settings.plans[initial]?.defaultPrice ?? subscriber.currentSubscription?.price ?? 0);
      setUsername(subscriber.currentSubscription?.username || '');
      setPassword(subscriber.currentSubscription?.password || '');
    }
  }, [subscriber, isOpen, settings]);

  if (!subscriber) return null;

  const current = subscriber.currentSubscription;
  const paid = current?.paidAmount ?? 0;
  const balance = computePlanChangeBalance(paid, price);
  const remaining = balance.remaining;
  const newStatus = balance.payStatus === 'paid' ? 'مدفوعة بالكامل' : balance.payStatus === 'partial' ? 'مدفوعة جزئياً' : 'غير مدفوعة';

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlan === subscriber.planType) {
      onClose();
      return;
    }
    await changeSubscriptionPlan(subscriber.id, newPlan, price, { username, password });
    onClose();
  };

  const planCard = (plan: PlanType, color: 'cyan' | 'purple') => {
    const selected = newPlan === plan;
    return (
      <button
        type="button"
        key={plan}
        onClick={() => {
          setNewPlan(plan);
          setPrice(settings.plans[plan]?.defaultPrice ?? 0);
        }}
        className={`p-3 rounded-xl border text-start transition-all flex items-center gap-3 ${
          selected
            ? color === 'cyan'
              ? 'bg-cyan-500/10 border-cyan-500 shadow-sm'
              : 'bg-purple-500/15 border-purple-500 shadow-sm'
            : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
        }`}
      >
        <div className={`text-xs font-bold ${selected ? 'text-slate-900 dark:text-white' : ''}`}>
          <div>{settings.plans[plan]?.label}</div>
          <div className={`text-[11px] font-semibold mt-0.5 ${color === 'cyan' ? 'text-cyan-600 dark:text-cyan-400' : 'text-purple-600 dark:text-purple-400'}`}>
            {settings.plans[plan]?.defaultPrice.toLocaleString('en-US')} {settings.currency}
          </div>
        </div>
      </button>
    );
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تغيير باقة الاشتراك"
      description={`الباقة الحالية لـ ${subscriber.name}: ${settings.plans[subscriber.planType]?.label}`}
      maxWidth="md"
    >
      <form onSubmit={handleConfirm} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {planCard('home', 'cyan')}
          {planCard('personal', 'purple')}
        </div>

        <Input
          label="سعر الدورة الحالية بعد التغيير"
          type="number"
          value={price}
          onChange={e => setPrice(Number(e.target.value))}
          startIcon={<DollarSign className="w-4 h-4" />}
          helperText={`العملة: ${settings.currency} — يُعاد حساب حالة الدفع من المدفوع (${formatCurrency(paid, settings.currency)})`}
          required
        />

        {/* New network credentials for the new plan */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="اسم الدخول الجديد بالشبكة"
            value={username}
            onChange={e => setUsername(e.target.value)}
            startIcon={<User className="w-4 h-4" />}
            helperText="حساب الباقة الجديدة (اتركه لتغيير الباقة فقط)"
            required
          />
          <Input
            label="كلمة مرور الحساب الجديد"
            value={password}
            onChange={e => setPassword(e.target.value)}
            startIcon={<Key className="w-4 h-4" />}
            required
          />
        </div>

        {current && (
          <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold">
              <ArrowLeftRight className="w-4 h-4" />
              <span>نتيجة التغيير على الدورة الحالية</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-200">
              <div>
                <span className="text-slate-400 block text-[11px]">الفترة (لا تتغير):</span>
                <span className="font-semibold">
                  {formatArabicDate(current.startDate)} ← {formatArabicDate(current.endDate)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">المتبقي الجديد:</span>
                <span className={`font-bold ${remaining > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {formatCurrency(remaining, settings.currency)} ({newStatus})
                </span>
              </div>
            </div>
            {balance.creditAdd > 0 && (
              <div className="pt-2 border-t border-brand-500/20 text-emerald-600 dark:text-emerald-400 font-semibold">
                فائض {formatCurrency(balance.creditAdd, settings.currency)} يُرحّل تلقائياً كرصيد دائن للمشترك (يُخصم من التجديد القادم)
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-slate-400">
          * تتغير الباقة والسعر فوراً مع بقاء التواريخ والمدفوعات كما هي. تُسجل العملية في سجل الرقابة.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" type="submit" leftIcon={<ArrowLeftRight className="w-4 h-4" />}>
            تأكيد تغيير الباقة
          </Button>
        </div>
      </form>
    </Modal>
  );
};
