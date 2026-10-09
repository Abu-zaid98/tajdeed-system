import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAppStore } from '../../lib/store';
import { normalizePhone } from '../../lib/utils';
import type { PlanType, Subscriber, SubscriberWithDetails } from '../../types';
import { todayInputValue, toDateInputValue, fromDateInputValue } from '../../lib/dates';
import { CycleDatesFields } from '../subscriptions/CycleDatesFields';
import { addDays } from 'date-fns';
import { User, Phone, MapPin, FileText, Home, Key, DollarSign, AlertTriangle } from 'lucide-react';

interface SubscriberFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriberToEdit?: SubscriberWithDetails | null;
  onViewExisting?: (id: string) => void;
}

const normalizeName = (s: string) => s.trim().replace(/\s+/g, ' ');

const DupeRow: React.FC<{ sub: Subscriber; onView: () => void }> = ({ sub, onView }) => (
  <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/5">
    <div className="min-w-0">
      <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{sub.name}</div>
      <div className="text-[11px] text-slate-400 font-mono dir-ltr text-start">{sub.phone || 'بدون رقم'}</div>
    </div>
    <button
      type="button"
      onClick={onView}
      className="text-[11px] font-bold text-brand-500 hover:underline shrink-0"
    >
      عرض السجل
    </button>
  </div>
);

export const SubscriberFormModal: React.FC<SubscriberFormModalProps> = ({
  isOpen,
  onClose,
  subscriberToEdit,
  onViewExisting
}) => {
  const { addSubscriber, updateSubscriber, settings, subscribers } = useAppStore();

  const isEditing = Boolean(subscriberToEdit);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [notes, setNotes] = useState('');
  const [planType, setPlanType] = useState<PlanType>('home');

  // Initial subscription cycle (when creating)
  const [includeCycle, setIncludeCycle] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [price, setPrice] = useState(settings.plans.home.defaultPrice);
  const [paidAmount, setPaidAmount] = useState(settings.plans.home.defaultPrice);
  const [cycleStart, setCycleStart] = useState(todayInputValue());
  const [cycleEnd, setCycleEnd] = useState(todayInputValue());

  // Duplicate warning (creation only)
  const [dupeCheck, setDupeCheck] = useState<{ phone: Subscriber[]; name: Subscriber[] } | null>(null);
  const [dupeAck, setDupeAck] = useState(false);

  useEffect(() => {
    if (subscriberToEdit) {
      setName(subscriberToEdit.name);
      setPhone(subscriberToEdit.phone || '');
      setArea(subscriberToEdit.area || '');
      setNotes(subscriberToEdit.notes || '');
      setPlanType(subscriberToEdit.planType);
      setIncludeCycle(false);
    } else {
      setName('');
      setPhone('');
      setArea('');
      setNotes('');
      setPlanType('home');
      setIncludeCycle(true);
      const defaultP = settings.plans.home.defaultPrice;
      setPrice(defaultP);
      setPaidAmount(defaultP);
      setUsername(`user_${Math.floor(1000 + Math.random() * 9000)}`);
      setPassword(`Pass@${Math.floor(1000 + Math.random() * 9000)}`);
      // Default period: today + default duration (changeable below).
      const start = todayInputValue();
      setCycleStart(start);
      setCycleEnd(toDateInputValue(addDays(fromDateInputValue(start), settings.defaultDurationDays - 1)));
      setDupeCheck(null);
      setDupeAck(false);
    }
  }, [subscriberToEdit, isOpen, settings]);

  const handlePlanTypeChange = (type: PlanType) => {
    setPlanType(type);
    if (!isEditing) {
      const defaultP = settings.plans[type]?.defaultPrice || 35000;
      setPrice(defaultP);
      setPaidAmount(defaultP);
    }
  };

  // Any name/phone edit invalidates a previous duplicate acknowledgement.
  useEffect(() => {
    setDupeCheck(null);
    setDupeAck(false);
  }, [name, phone]);

  const findDuplicates = (excludeId?: string) => {
    const phoneNorm = normalizePhone(phone);
    const nameNorm = normalizeName(name);
    const inScope = (s: Subscriber) => !excludeId || s.id !== excludeId;
    const phoneDupes = phoneNorm
      ? subscribers.filter(s => inScope(s) && normalizePhone(s.phone) === phoneNorm)
      : [];
    const nameDupes = nameNorm
      ? subscribers.filter(s =>
        inScope(s) && !phoneDupes.some(p => p.id === s.id) && normalizeName(s.name) === nameNorm
      )
      : [];
    return { phone: phoneDupes, name: nameDupes };
  };

  const doCreate = () => {
    addSubscriber(
      {
        name: name.trim(),
        phone: phone.trim() || undefined,
        area: area.trim() || undefined,
        notes: notes.trim() || undefined,
        planType
      },
      includeCycle
        ? {
          username: username.trim() || `user_${Date.now().toString().slice(-4)}`,
          password: password.trim() || 'Pass@1234',
          price,
          paidAmount,
          startDate: fromDateInputValue(cycleStart).toISOString(),
          endDate: fromDateInputValue(cycleEnd).toISOString()
        }
        : undefined
    );
  };

  const doSaveEdit = () => {
    if (!subscriberToEdit) return;
    updateSubscriber(subscriberToEdit.id, {
      name: name.trim(),
      phone: phone.trim() || undefined,
      area: area.trim() || undefined,
      notes: notes.trim() || undefined,
      planType
    }, { base: subscriberToEdit });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEditing && subscriberToEdit) {
      if (!dupeAck) {
        const dupes = findDuplicates(subscriberToEdit.id);
        if (dupes.phone.length + dupes.name.length > 0) {
          setDupeCheck(dupes);
          return;
        }
      }
      doSaveEdit();
    } else if (!dupeAck) {
      const dupes = findDuplicates();
      if (dupes.phone.length + dupes.name.length > 0) {
        setDupeCheck(dupes);
        return;
      }
      doCreate();
    } else {
      doCreate();
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'تعديل بيانات المشترك' : 'إضافة مشترك جديد'}
      description={isEditing ? 'تحديث البيانات الأساسية للمشترك' : 'إدخال مشترك جديد إلى النظام وتعيين اشتراكه'}
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <Input
          label="اسم المشترك الرباعي أو التجاري"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="مثال: محمد أحمد علي حسن"
          startIcon={<User className="w-4 h-4" />}
          required
        />

        {/* Phone & Area */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="رقم الهاتف (واتساب)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="972599999999"
            startIcon={<Phone className="w-4 h-4" />}
            dir="ltr"
            className="text-start"
          />

          <Input
            label="المنطقة / الحي / العنوان"
            value={area}
            onChange={e => setArea(e.target.value)}
            placeholder="مثال: الوسطى - شارع صلاح الدين"
            startIcon={<MapPin className="w-4 h-4" />}
          />
        </div>

        {/* Plan Type Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            نوع الاشتراك
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handlePlanTypeChange('home')}
              className={`p-3 rounded-xl border text-start transition-all flex items-center gap-3 ${planType === 'home'
                ? 'bg-cyan-500/10 border-cyan-500 text-cyan-800 dark:text-cyan-200 shadow-sm'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                }`}
            >
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                <Home className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{settings.plans.home.label}</div>
                <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-semibold mt-0.5">
                  {settings.plans.home.defaultPrice.toLocaleString('en-US')} {settings.currency}
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => handlePlanTypeChange('personal')}
              className={`p-3 rounded-xl border text-start transition-all flex items-center gap-3 ${planType === 'personal'
                ? 'bg-purple-500/15 border-purple-500 text-purple-800 dark:text-purple-200 shadow-sm'
                : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400'
                }`}
            >
              <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{settings.plans.personal.label}</div>
                <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold mt-0.5">
                  {settings.plans.personal.defaultPrice.toLocaleString('en-US')} {settings.currency}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Initial Cycle Settings (only when adding) */}
        {!isEditing && (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                تفعيل دورة اشتراك فورية
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCycle}
                  onChange={e => setIncludeCycle(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
              </label>
            </div>

            {includeCycle && (
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="اسم الدخول بالشبكة"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    startIcon={<User className="w-4 h-4" />}
                    required={includeCycle}
                  />
                  <Input
                    label="كلمة مرور الحساب"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    startIcon={<Key className="w-4 h-4" />}
                    required={includeCycle}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="سعر الاشتراك"
                    type="number"
                    value={price}
                    onChange={e => setPrice(Number(e.target.value))}
                    startIcon={<DollarSign className="w-4 h-4" />}
                    min={0}
                    required={includeCycle}
                  />
                  <Input
                    label="المبلغ المدفوع مقدماً"
                    type="number"
                    value={paidAmount}
                    onChange={e => setPaidAmount(Number(e.target.value))}
                    startIcon={<DollarSign className="w-4 h-4" />}
                    min={0}
                    helperText={paidAmount >= price ? 'مدفوع بالكامل' : paidAmount > 0 ? 'دفعة جزئية' : 'غير مدفوع (ذمة)'}
                  />
                </div>

                {/* Manual cycle period (defaults to today + default duration) */}
                <CycleDatesFields
                  startValue={cycleStart}
                  endValue={cycleEnd}
                  defaultDuration={settings.defaultDurationDays}
                  onChange={(s, e) => { setCycleStart(s); setCycleEnd(e); }}
                  startHint="اتركه كما هو للاشتراك الفوري بتاريخ اليوم"
                />
              </div>
            )}
          </div>
        )}

        {/* Technical Notes */}
        <div className="space-y-1.5 text-start">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
            ملاحظات فنية (نوع النانو، إشارة البرج، الماك أدرس...)
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
            placeholder="مثال: راوتر بالطابق الثالث، نانو M5، إشارة ضعيفة، ماك: AA:BB:CC..."
          />
        </div>

        {/* Duplicate warning (creation and edit) */}
        {dupeCheck && (dupeCheck.phone.length + dupeCheck.name.length > 0) && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>تشابه مع سجلات موجودة — راجع قبل الإضافة</span>
            </div>

            {dupeCheck.phone.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                  نفس رقم الهاتف ({dupeCheck.phone.length}):
                </span>
                {dupeCheck.phone.map(s => (
                  <DupeRow key={s.id} sub={s} onView={() => { onClose(); onViewExisting?.(s.id); }} />
                ))}
              </div>
            )}

            {dupeCheck.name.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block">
                  نفس الاسم ({dupeCheck.name.length}):
                </span>
                {dupeCheck.name.map(s => (
                  <DupeRow key={s.id} sub={s} onView={() => { onClose(); onViewExisting?.(s.id); }} />
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" type="button" onClick={() => setDupeCheck(null)}>
                إلغاء ومراجعة
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="button"
                onClick={() => {
                  setDupeAck(true);
                  setDupeCheck(null);
                  if (isEditing) {
                    doSaveEdit();
                  } else {
                    doCreate();
                  }
                  onClose();
                }}
              >
                {isEditing ? 'متابعة الحفظ رغم ذلك' : 'متابعة الإضافة رغم ذلك'}
              </Button>
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            إلغاء
          </Button>
          <Button variant="primary" type="submit">
            {isEditing ? 'حفظ التعديلات' : 'إضافة المشترك'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
