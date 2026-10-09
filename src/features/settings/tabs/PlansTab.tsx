import React, { useState } from 'react';
import { Tag, Clock, Bell, DollarSign } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from 'sonner';
import type { Settings } from '../../../types';

interface PlansTabProps {
  settings: Settings;
  isAdmin: boolean;
  updateSettings: (s: Partial<Settings>) => void;
}

export const PlansTab: React.FC<PlansTabProps> = ({ settings, isAdmin, updateSettings }) => {
  const [defaultDurationDays, setDefaultDurationDays] = useState(settings.defaultDurationDays);
  const [expiryAlertDays, setExpiryAlertDays] = useState(settings.expiryAlertDays);
  const [homePrice, setHomePrice] = useState(settings.plans.home.defaultPrice);
  const [homeLabel, setHomeLabel] = useState(settings.plans.home.label);
  const [personalPrice, setPersonalPrice] = useState(settings.plans.personal.defaultPrice);
  const [personalLabel, setPersonalLabel] = useState(settings.plans.personal.label);
  const [monthlyCollectionGoal, setMonthlyCollectionGoal] = useState(settings.monthlyCollectionGoal || 0);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('تعديل الباقات والمدد متاح للمسؤول (Admin) فقط');
      return;
    }
    updateSettings({
      defaultDurationDays,
      expiryAlertDays,
      monthlyCollectionGoal,
      plans: {
        home: { label: homeLabel, defaultPrice: homePrice },
        personal: { label: personalLabel, defaultPrice: personalPrice }
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="glass-card p-5 sm:p-6 rounded-3xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold">
            <Tag className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">الباقات والمدد الافتراضية</h2>
            <p className="text-xs text-slate-400">تُستخدم تلقائياً عند إنشاء الاشتراكات والتجديد</p>
          </div>
        </div>
        {isAdmin && (
          <Button size="sm" type="submit">
            حفظ التغييرات
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="مدة الاشتراك الافتراضية (بالأيام)"
          type="number"
          value={defaultDurationDays}
          onChange={e => setDefaultDurationDays(Number(e.target.value))}
          disabled={!isAdmin}
          startIcon={<Clock className="w-4 h-4" />}
          min={1}
          required
        />
        <Input
          label="تنبيه الانتهاء قبل (عدد الأيام)"
          type="number"
          value={expiryAlertDays}
          onChange={e => setExpiryAlertDays(Number(e.target.value))}
          disabled={!isAdmin}
          startIcon={<Bell className="w-4 h-4" />}
          helperText="المدة التي يتحول عندها الاشتراك لحالة (ينتهي قريباً)"
          min={1}
          required
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-3">
          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400 block">الباقة الأولى (المنزلية)</span>
          <Input
            label="مسمى الباقة"
            value={homeLabel}
            onChange={e => setHomeLabel(e.target.value)}
            disabled={!isAdmin}
          />
          <Input
            label="السعر الافتراضي"
            type="number"
            value={homePrice}
            onChange={e => setHomePrice(Number(e.target.value))}
            disabled={!isAdmin}
            startIcon={<DollarSign className="w-4 h-4" />}
            min={0}
          />
        </div>

        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-3">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400 block">الباقة الثانية (الشخصية)</span>
          <Input
            label="مسمى الباقة"
            value={personalLabel}
            onChange={e => setPersonalLabel(e.target.value)}
            disabled={!isAdmin}
          />
          <Input
            label="السعر الافتراضي"
            type="number"
            value={personalPrice}
            onChange={e => setPersonalPrice(Number(e.target.value))}
            disabled={!isAdmin}
            startIcon={<DollarSign className="w-4 h-4" />}
            min={0}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Input
          label="هدف التحصيل الشهري (0 لإخفاء الحلقة من اللوحة)"
          type="number"
          value={monthlyCollectionGoal}
          onChange={e => setMonthlyCollectionGoal(Number(e.target.value))}
          disabled={!isAdmin}
          startIcon={<DollarSign className="w-4 h-4" />}
          helperText={`تظهر حلقة التقدم في لوحة التحكم بالعملة (${settings.currency})`}
        />
      </div>
    </form>
  );
};
