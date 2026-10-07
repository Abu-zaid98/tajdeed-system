import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from './ui/Button';

/**
 * With registerType 'prompt', a new service worker waits until the user
 * accepts. Same bottom-center toast identity as the install toast:
 * appears on every device whenever a deployed update is waiting.
 */
export const PwaUpdateBanner: React.FC = () => {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration) return;
      console.info('[PWA] service worker registered');
      // Re-check for a new version every hour while the app stays open.
      window.setInterval(() => {
        void registration.update();
      }, 60 * 60 * 1000);
    },
    onNeedRefresh() {
      console.info('[PWA] new version waiting');
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-8 inset-x-0 z-[61] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm glass-card p-4 rounded-3xl border border-brand-500/30 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <div className="w-11 h-11 rounded-2xl bg-brand-500/10 text-brand-500 flex items-center justify-center shrink-0">
          <RefreshCw className="w-5 h-5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            يتوفر إصدار جديد من التطبيق
          </p>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            حدّث الآن للحصول على آخر المزايا والإصلاحات
          </p>
        </div>

        <Button size="sm" variant="primary" onClick={() => updateServiceWorker(true)}>
          تحديث
        </Button>

        <button
          type="button"
          onClick={() => setNeedRefresh(false)}
          aria-label="إغلاق"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
