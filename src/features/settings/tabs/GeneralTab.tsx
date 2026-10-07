import React, { useState } from 'react';
import { Wifi, Phone } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { toast } from 'sonner';
import type { Settings } from '../../../types';

interface GeneralTabProps {
  settings: Settings;
  isAdmin: boolean;
  updateSettings: (s: Partial<Settings>) => void;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({ settings, isAdmin, updateSettings }) => {
  const [networkName, setNetworkName] = useState(settings.networkName);
  const [currency, setCurrency] = useState(settings.currency);
  const [contactPhone, setContactPhone] = useState(settings.contactPhone || '');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('تعديل إعدادات الشبكة متاح للمسؤول (Admin) فقط');
      return;
    }
    updateSettings({ networkName, currency, contactPhone });
  };

  return (
    <form onSubmit={handleSave} className="glass-card p-5 sm:p-6 rounded-3xl space-y-5">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">الهوية العامة ومعلومات الشبكة</h2>
            <p className="text-xs text-slate-400">تظهر في الترويسة وسندات القبض ورسائل الواتساب</p>
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
          label="اسم الشبكة الرسمي"
          value={networkName}
          onChange={e => setNetworkName(e.target.value)}
          disabled={!isAdmin}
          required
        />
        <Input
          label="العملة الرسمية"
          value={currency}
          onChange={e => setCurrency(e.target.value)}
          disabled={!isAdmin}
          helperText="مثال: ₪ (شيكل) ، $ ، د.ع"
          required
        />
        <Input
          label="هاتف الدعم الفني للشبكة"
          value={contactPhone}
          onChange={e => setContactPhone(e.target.value)}
          disabled={!isAdmin}
          startIcon={<Phone className="w-4 h-4" />}
          dir="ltr"
          className="text-start sm:col-span-2"
        />
      </div>
    </form>
  );
};
