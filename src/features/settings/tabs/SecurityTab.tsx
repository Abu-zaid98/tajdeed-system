import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, Bell, LogOut } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { CustomSelect } from '../../../components/ui/CustomSelect';
import { auth } from '../../../lib/firebase';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { isNotificationSupported, isNotifyEnabled, setNotifyEnabled } from '../../../hooks/useExpiryNotifications';
import { toast } from 'sonner';
import type { Settings } from '../../../types';

interface SecurityTabProps {
  settings: Settings;
  isAdmin: boolean;
  currentEmail?: string;
  updateSettings: (s: Partial<Settings>) => void;
}

export const SecurityTab: React.FC<SecurityTabProps> = ({ settings, isAdmin, currentEmail, updateSettings }) => {
  // Auto logout
  const [sessionTimeoutMinutes, setSessionTimeoutMinutes] = useState(settings.sessionTimeoutMinutes || 0);

  // Own password
  const [curPw, setCurPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPws, setShowPws] = useState(false);
  const [isChangingPw, setIsChangingPw] = useState(false);

  // Device notifications
  const [notifyOn, setNotifyOn] = useState<boolean>(() => isNotifyEnabled());
  const notifySupported = isNotificationSupported();

  const handleSaveSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('تعديل إعدادات الأمان متاح للمسؤول (Admin) فقط');
      return;
    }
    updateSettings({ sessionTimeoutMinutes });
  };

  const handleChangeOwnPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 6) {
      toast.error('كلمة المرور الجديدة يجب ألا تقل عن 6 خانات');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('تأكيد كلمة المرور غير متطابق');
      return;
    }
    const user = auth.currentUser;
    if (!user || !user.email) {
      toast.error('انتهت الجلسة — سجل الدخول مجدداً ثم أعد المحاولة');
      return;
    }
    setIsChangingPw(true);
    try {
      const cred = EmailAuthProvider.credential(user.email, curPw);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPw);
      setCurPw('');
      setNewPw('');
      setConfirmPw('');
      toast.success('تم تغيير كلمة المرور بنجاح');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        toast.error('كلمة المرور الحالية غير صحيحة');
      } else if (err.code === 'auth/weak-password') {
        toast.error('كلمة المرور الجديدة ضعيفة — 6 خانات على الأقل');
      } else if (err.code === 'auth/requires-recent-login') {
        toast.error('لأسباب أمنية سجل الخروج ثم الدخول مجدداً وأعد المحاولة');
      } else {
        toast.error('تعذّر تغيير كلمة المرور — تحقق من الاتصال');
      }
    } finally {
      setIsChangingPw(false);
    }
  };

  const handleNotifyToggle = async (on: boolean) => {
    if (on) {
      if (!notifySupported) {
        toast.error('هذا المتصفح لا يدعم الإشعارات');
        return;
      }
      if (Notification.permission === 'default') {
        const res = await Notification.requestPermission();
        if (res !== 'granted') {
          toast.error('تم رفض إذن الإشعارات من المتصفح');
          return;
        }
      } else if (Notification.permission !== 'granted') {
        toast.error('الإشعارات محظورة — فعّلها من إعدادات المتصفح لهذا الموقع');
        return;
      }
      setNotifyEnabled(true);
      setNotifyOn(true);
      toast.success('تم تفعيل تنبيهات الانتهاء على هذا الجهاز');
    } else {
      setNotifyEnabled(false);
      setNotifyOn(false);
      toast.info('تم إيقاف التنبيهات على هذا الجهاز');
    }
  };

  return (
    <div className="space-y-4">
      {/* Auto logout */}
      <form onSubmit={handleSaveSession} className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center font-bold">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">تسجيل الخروج التلقائي</h2>
              <p className="text-xs text-slate-400">حماية الجلسات على الأجهزة المشتركة</p>
            </div>
          </div>
          {isAdmin && (
            <Button size="sm" type="submit">
              حفظ
            </Button>
          )}
        </div>
        <div className="max-w-sm">
          <CustomSelect<number>
            label="تسجيل الخروج تلقائياً بعد عدم النشاط"
            value={sessionTimeoutMinutes}
            onChange={setSessionTimeoutMinutes}
            disabled={!isAdmin}
            options={[
              { value: 0, label: 'البقاء مسجلاً دائماً (بدون خروج تلقائي)' },
              { value: 5, label: 'بعد 5 دقائق من عدم النشاط' },
              { value: 15, label: 'بعد 15 دقيقة من عدم النشاط' },
              { value: 30, label: 'بعد 30 دقيقة من عدم النشاط' },
              { value: 60, label: 'بعد ساعة واحدة من عدم النشاط' },
            ]}
          />
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            أي نشاط يعيد ضبط المؤقت، وينطبق على جميع التبويبات المفتوحة.
          </p>
        </div>
      </form>

      {/* Own password */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center gap-2.5 border-b border-slate-100 dark:border-white/5 pb-4">
          <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-white">تغيير كلمة المرور الخاصة بي</h2>
            <p className="text-xs text-slate-400">تسجيل الدخول: {currentEmail}</p>
          </div>
        </div>

        <form onSubmit={handleChangeOwnPassword} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="كلمة المرور الحالية"
              type={showPws ? 'text' : 'password'}
              value={curPw}
              onChange={e => setCurPw(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="text-start"
              autoComplete="current-password"
              required
            />
            <Input
              label="كلمة المرور الجديدة"
              type={showPws ? 'text' : 'password'}
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              placeholder="6 خانات على الأقل"
              dir="ltr"
              className="text-start"
              autoComplete="new-password"
              required
            />
            <Input
              label="تأكيد الجديدة"
              type={showPws ? 'text' : 'password'}
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="••••••••"
              dir="ltr"
              className="text-start"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowPws(v => !v)}
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              {showPws ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showPws ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}
            </button>
            <Button
              size="sm"
              type="submit"
              variant="primary"
              isLoading={isChangingPw}
              leftIcon={<KeyRound className="w-4 h-4" />}
            >
              تغيير كلمة المرور
            </Button>
          </div>
        </form>
      </div>

      {/* Device notifications */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold shrink-0">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">تنبيهات الانتهاء على هذا الجهاز</h2>
              <p className="text-xs text-slate-400">إشعار نظام عند وجود اشتراكات تنتهي قريباً أو منتهية — يعمل حتى دون إنترنت</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={notifyOn}
              onChange={e => void handleNotifyToggle(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500"></div>
          </label>
        </div>
        {!notifySupported && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">هذا المتصفح لا يدعم الإشعارات على هذا الجهاز.</p>
        )}
      </div>
    </div>
  );
};
