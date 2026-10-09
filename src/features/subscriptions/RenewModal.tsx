import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAppStore } from '../../lib/store';
import {
  calculateRenewalDates,
  durationBetweenInputs,
  fromDateInputValue,
  toDateInputValue,
} from '../../lib/dates';
import { CycleDatesFields } from './CycleDatesFields';
import { formatCurrency } from '../../lib/utils';
import { triggerConfetti } from '../../lib/confetti';
import type { SubscriberWithDetails } from '../../types';
import { RefreshCw, DollarSign, User, Key } from 'lucide-react';

interface RenewModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriber: SubscriberWithDetails | null;
}

export const RenewModal: React.FC<RenewModalProps> = ({
  isOpen,
  onClose,
  subscriber
}) => {
  const { settings, renewSubscription } = useAppStore();

  const [price, setPrice] = useState(35000);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');

  useEffect(() => {
    if (subscriber) {
      const current = subscriber.currentSubscription;
      const defaultP = current?.price || settings.plans[subscriber.planType]?.defaultPrice || 35000;
      setPrice(defaultP);
      setUsername(current?.username || `user_${subscriber.phone?.slice(-4) || '1234'}`);
      setPassword(current?.password || 'Pass@1234');

      // Default: day after current cycle ends (or today), for its own duration.
      const dur = current?.durationDays || settings.defaultDurationDays;
      const auto = calculateRenewalDates(current?.endDate, dur);
      setStartStr(toDateInputValue(auto.startDate));
      setEndStr(toDateInputValue(auto.endDate));
    }
  }, [subscriber, settings, isOpen]);

  const handleRenew = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriber || !startStr || !endStr) return;

    renewSubscription(subscriber.id, {
      durationDays: durationBetweenInputs(startStr, endStr, settings.defaultDurationDays),
      price,
      username,
      password,
      startDate: fromDateInputValue(startStr).toISOString(),
      endDate: fromDateInputValue(endStr).toISOString()
    });

    triggerConfetti();
    onClose();
  };

  if (!subscriber) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="تجديد دورة اشتراك جديدة"
      description={`تجديد الاشتراك لـ: ${subscriber.name}`}
      maxWidth="md"
    >
      <form onSubmit={handleRenew} className="space-y-4">
        {/* Manual period: start + end with smart defaults */}
        <CycleDatesFields
          startValue={startStr}
          endValue={endStr}
          defaultDuration={settings.defaultDurationDays}
          onChange={(s, e) => { setStartStr(s); setEndStr(e); }}
          startHint={
            subscriber.currentSubscription
              ? 'الافتراضي: اليوم التالي لنهاية الدورة الحالية'
              : 'الافتراضي: تاريخ اليوم'
          }
        />

        {/* Available credit (auto-applied to the new cycle) */}
        {(subscriber.creditBalance || 0) > 0 && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
            <div className="font-bold text-emerald-600 dark:text-emerald-400">
              الرصيد الدائن: {formatCurrency(subscriber.creditBalance || 0, settings.currency)}
            </div>
            <div className="text-slate-500 dark:text-slate-400">
              سيُخصم تلقائياً من سعر التجديد — المطلوب نقداً: {formatCurrency(Math.max(0, price - (subscriber.creditBalance || 0)), settings.currency)}
            </div>
          </div>
        )}

        {/* Price */}
        <Input
          label="سعر التجديد"
          type="number"
          value={price}
          onChange={e => setPrice(Number(e.target.value))}
          startIcon={<DollarSign className="w-4 h-4" />}
          helperText={`العملة: ${settings.currency}`}
          min={0}
          required
        />

        {/* Credentials */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="اسم المستخدم"
            value={username}
            onChange={e => setUsername(e.target.value)}
            startIcon={<User className="w-4 h-4" />}
            required
          />
          <Input
            label="كلمة المرور"
            value={password}
            onChange={e => setPassword(e.target.value)}
            startIcon={<Key className="w-4 h-4" />}
            required
          />
        </div>

        {/* Note on Zero Data Loss */}
        <p className="text-[11px] text-slate-400">
          * سيتم إنشاء سجل جديد في تاريخ المشترك وحفظ السجلات السابقة دون أي تعديل. حالة الدفع الافتراضية: غير مدفوع (Unpaid).
        </p>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" type="submit" leftIcon={<RefreshCw className="w-4 h-4" />}>
            تأكيد التجديد الآن
          </Button>
        </div>
      </form>
    </Modal>
  );
};
