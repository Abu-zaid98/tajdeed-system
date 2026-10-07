import React, { useState } from 'react';
import { Activity, CheckCircle2, RotateCcw, Download, MonitorSmartphone } from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { ConfirmModal } from '../../../components/ui/ConfirmModal';
import { usePwaInstall } from '../../../hooks/usePwaInstall';

interface SystemTabProps {
  isAdmin: boolean;
  currentAccountId?: string;
  resetToCleanData: () => void;
}

export const SystemTab: React.FC<SystemTabProps> = ({ isAdmin, currentAccountId, resetToCleanData }) => {
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const { isInstallable, isIOS, isInstalled, promptInstall } = usePwaInstall();

  return (
    <div className="space-y-4">
      {/* App install (always reachable, independent of the toast) */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-500/10 text-brand-500 flex items-center justify-center font-bold shrink-0">
              <MonitorSmartphone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">تثبيت التطبيق على هذا الجهاز</h2>
              <p className="text-xs text-slate-400">
                {isInstalled
                  ? 'التطبيق مثبت ويعمل في نافذة مستقلة'
                  : isIOS
                    ? 'من سفاري: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»'
                    : 'نافذة مستقلة وأيقونة وعمل دون إنترنت'}
              </p>
            </div>
          </div>
          {isInstalled ? (
            <span className="text-xs font-bold text-emerald-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> مثبت
            </span>
          ) : isInstallable ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => void promptInstall()}
              leftIcon={<Download className="w-4 h-4" />}
            >
              تثبيت الآن
            </Button>
          ) : !isIOS ? (
            <span className="text-[11px] text-slate-400">يتطلب فتح الموقع عبر HTTPS (ليس وضع التطوير)</span>
          ) : null}
        </div>
      </div>

      {/* Database status */}
      <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
              <Activity className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900 dark:text-white">حالة النظام وقاعدة البيانات</h2>
              <p className="text-xs text-slate-400">الربط المباشر مع قاعدة البيانات السحابية ونظام الدخول الآمن</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>متصل ونشط</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#0a0f1d] border border-slate-200 dark:border-white/5 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">معرف الحساب:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-white truncate block">
              {currentAccountId || 'غير معروف'}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#0a0f1d] border border-slate-200 dark:border-white/5 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">قاعدة البيانات:</span>
            <span className="font-mono text-slate-700 dark:text-slate-300">قاعدة البيانات السحابية (متصلة ونشطة)</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-[#0a0f1d] border border-slate-200 dark:border-white/5 space-y-1">
            <span className="text-slate-500 dark:text-slate-400 block text-[11px]">الوضع دون اتصال:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> مفعّل (تخزين محلي)
            </span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      {isAdmin && (
        <div className="glass-card p-5 sm:p-6 rounded-3xl space-y-4 border-rose-500/20">
          <div>
            <h2 className="font-bold text-sm text-rose-500">منطقة الخطر</h2>
            <p className="text-xs text-slate-400">إجراءات لا يمكن التراجع عنها — تُنفذ بحذر شديد</p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setShowResetConfirm(true)}
            leftIcon={<RotateCcw className="w-4 h-4" />}
          >
            تهيئة قاعدة البيانات النظيفة
          </Button>
        </div>
      )}

      {/* Confirm Reset Modal */}
      <ConfirmModal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        variant="danger"
        title="تهيئة قاعدة البيانات وحذف السجلات"
        message="هل أنت متأكد تماماً من رغبتك في مسح كافة سجلات المشتركين والدفعات وإعادة تهيئة قاعدة البيانات النظيفة بالعملة ₪ (شيكل)؟ هذا الإجراء لا يمكن التراجع عنه!"
        confirmText="نعم، تهيئة قاعدة البيانات"
        onConfirm={() => {
          resetToCleanData();
          setShowResetConfirm(false);
        }}
      />
    </div>
  );
};
