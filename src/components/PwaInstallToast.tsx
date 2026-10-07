import React, { useEffect, useState } from 'react';
import { Download, X, Share } from 'lucide-react';
import { usePwaInstall } from '../hooks/usePwaInstall';
import { Button } from './ui/Button';

const DISMISS_KEY = 'tajdeed_pwa_install_dismissed';
const DISMISS_DAYS = 7;
const APPEAR_DELAY_MS = 2500;

/**
 * Bottom-center install toast for ALL devices:
 * - Chromium (Android / desktop): real install button via beforeinstallprompt.
 * - iOS Safari: step-by-step "Add to Home Screen" guidance (no prompt API).
 * Hidden when already installed, and dismissal is remembered for 7 days.
 */
export const PwaInstallToast: React.FC = () => {
  const { isInstallable, isIOS, isInstalled, promptInstall } = usePwaInstall();
  const [ready, setReady] = useState(false);
  const [dismissedRecently, setDismissedRecently] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) {
        setDismissedRecently(false);
        return;
      }
      const at = Number(raw) || 0;
      setDismissedRecently(Date.now() - at < DISMISS_DAYS * 24 * 3600 * 1000);
    } catch {
      setDismissedRecently(false);
    }
  }, []);

  useEffect(() => {
    setReady(false);
    if (isInstalled || dismissedRecently) return;
    if (!isInstallable && !isIOS) return;
    const timer = window.setTimeout(() => setReady(true), APPEAR_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isInstalled, dismissedRecently, isInstallable, isIOS]);

  if (isInstalled || dismissedRecently || !ready) return null;
  if (!isInstallable && !isIOS) return null;

  const dismiss = () => {
    setReady(false);
    setDismissedRecently(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed bottom-24 lg:bottom-8 inset-x-0 z-[60] flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-sm glass-card p-4 rounded-3xl border border-brand-500/30 shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300">
        <img
          src={`${import.meta.env.BASE_URL}pwa-192x192.png`}
          alt="أيقونة تطبيق تجديد"
          className="w-11 h-11 rounded-2xl shrink-0 shadow-md"
        />

        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-900 dark:text-white">
            ثبّت تطبيق تجديد على جهازك
          </p>
          {isInstallable ? (
            <p className="text-[11px] text-slate-400 leading-relaxed">
              نافذة مستقلة وأيقونة وعمل دون إنترنت
            </p>
          ) : (
            <p className="text-[11px] text-slate-400 leading-relaxed flex items-start gap-1">
              <Share className="w-3 h-3 mt-0.5 shrink-0" />
              <span>من سفاري: زر المشاركة ثم «إضافة إلى الشاشة الرئيسية»</span>
            </p>
          )}
        </div>

        {isInstallable ? (
          <Button size="sm" variant="primary" onClick={() => void promptInstall()} leftIcon={<Download className="w-3.5 h-3.5" />}>
            تثبيت
          </Button>
        ) : (
          <Button size="sm" variant="primary" onClick={dismiss}>
            فهمت
          </Button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="إغلاق"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
