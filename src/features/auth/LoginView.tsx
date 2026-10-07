import React, { useState } from 'react';
import { Wifi, Lock, Mail, Eye, EyeOff, LogIn, AlertCircle, ShieldCheck, MonitorSmartphone, MessageCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAppStore } from '../../lib/store';
import { formatArabicDate } from '../../lib/dates';
import { toast } from 'sonner';

interface LoginViewProps {
  onSuccess: () => void;
}

function readSavedEmail(): string {
  try {
    return localStorage.getItem('tajdeed_saved_email') || '';
  } catch {
    return '';
  }
}

export const LoginView: React.FC<LoginViewProps> = ({ onSuccess }) => {
  const { settings, loginWithFirebase } = useAppStore();

  const [email, setEmail] = useState(readSavedEmail());
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      await loginWithFirebase(email, password, { rememberMe });
      onSuccess();
    } catch (err: any) {
      const msg = err.message || 'حدث خطأ أثناء تسجيل الدخول';
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 bg-surface-50 dark:bg-[#07090e] relative overflow-hidden text-start">
      {/* Background glow aesthetics */}
      <div className="absolute top-1/4 start-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 end-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-brand-500 via-sky-400 to-brand-500 pointer-events-none" />

      <div className="relative w-full max-w-md space-y-4">
        <div className="glass-card p-6 sm:p-8 rounded-3xl space-y-6 shadow-2xl border-t-2 border-t-brand-500/60">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="relative w-fit mx-auto">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-brand-500 to-sky-600 text-white flex items-center justify-center shadow-lg shadow-brand-500/30">
                <Wifi className="w-9 h-9" />
              </div>
              <div className="absolute -bottom-1 -end-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white dark:border-[#0b101c] flex items-center justify-center">
                <ShieldCheck className="w-3.5 h-3.5 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                {settings.networkName || 'تجديد — إدارة شبكة الإنترنت'}
              </h1>
              <p className="text-xs text-slate-500 mt-1.5">
                تسجيل الدخول الآمن للمسؤولين والمشرفين
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {formatArabicDate(new Date(), 'EEEE، d MMMM yyyy')}
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="البريد الإلكتروني"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@network.iq"
              startIcon={<Mail className="w-4 h-4" />}
              dir="ltr"
              className="text-start"
              autoComplete="email"
              required
            />

            <Input
              label="كلمة المرور"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              startIcon={<Lock className="w-4 h-4" />}
              endIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              }
              dir="ltr"
              className="text-start"
              autoComplete="current-password"
              required
            />

            {/* Remember me */}
            <label className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/5 cursor-pointer select-none hover:border-brand-500/40 transition-colors">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-500 shrink-0"
              />
              <MonitorSmartphone className="w-4 h-4 text-brand-500 shrink-0" />
              <span className="flex-1">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  حفظ بياناتي على هذا المتصفح
                </span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  {rememberMe
                    ? 'يبقى تسجيل الدخول حتى بعد إغلاق المتصفح'
                    : 'تُنسى الجلسة عند إغلاق التبويب — أنسب للأجهزة المشتركة'}
                </span>
              </span>
            </label>

            <Button
              type="submit"
              variant="primary"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              <span className="flex items-center gap-2">
                <LogIn className="w-4 h-4" />
                تسجيل الدخول للنظام
              </span>
            </Button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-400">
          حسابات المشرفين والمدراء يتم إنشاؤها وإدارتها من قبل الإدارة
        </p>
        <a
          href="https://wa.me/972592133357"
          target="_blank"
          rel="noopener noreferrer"
          title="تواصل واتساب مع المطور"
          className="flex items-center gap-3 p-3 rounded-2xl glass hover:border-emerald-500/40 transition-all group text-start"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-emerald-500/25 shrink-0">
            م
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-slate-900 dark:text-white">م. محمد الجوجو</div>
            <div className="text-[11px] text-slate-400">تطوير ودعم النظام — اضغط للتواصل واتساب</div>
          </div>
          <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
            <MessageCircle className="w-4 h-4" />
          </span>
        </a>س
      </div>
    </div>
  );
};
