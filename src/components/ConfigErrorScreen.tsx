import React from 'react';
import { ServerCog, Copy, Check } from 'lucide-react';

/**
 * Shown instead of the app when backend env vars are missing (e.g. Vercel
 * deploy without Environment Variables). Actionable in both themes —
 * never a blank page.
 */
export const ConfigErrorScreen: React.FC<{ message: string }> = ({ message }) => {
  const [copied, setCopied] = React.useState(false);
  const varNames = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
    'VITE_FIREBASE_STORAGE_BUCKET',
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'VITE_FIREBASE_APP_ID',
  ];

  const copyNames = async () => {
    try {
      await navigator.clipboard.writeText(varNames.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50 dark:bg-[#07090e]">
      <div className="w-full max-w-lg glass-card p-6 sm:p-8 rounded-3xl space-y-5 text-start">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <ServerCog className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-900 dark:text-white">تعذّر الاتصال بالخادم</h1>
            <p className="text-xs text-slate-500 font-mono dir-ltr text-start">{message}</p>
          </div>
        </div>

        <ol className="space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed list-none p-0 m-0">
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">1</span>
            <span>
              في <strong>Vercel</strong> افتح المشروع ← <strong>Settings ← Environment Variables</strong> وأضف المتغيرات الستة بقيم Firebase، ثم
              <strong> أعد النشر (Redeploy)</strong> — إضافة المتغيرات وحدها لا تكفي دون إعادة نشر.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">2</span>
            <span>
              في <strong>Firebase console ← Authentication ← Settings ← Authorized domains</strong> أضف دومين Vercel.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-[11px] font-bold flex items-center justify-center shrink-0">3</span>
            <span>
              في <strong>Firestore ← Rules</strong> الصق محتوى ملف <strong className="font-mono">firestore.rules</strong> وانشر.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="w-5 h-5 rounded-full bg-slate-400 text-white text-[11px] font-bold flex items-center justify-center shrink-0">•</span>
            <span>محلياً: انسخ <strong className="font-mono">.env.example</strong> إلى <strong className="font-mono">.env.local</strong> وعبّئ القيم.</span>
          </li>
        </ol>

        <button
          type="button"
          onClick={copyNames}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold glass hover:bg-white/80 dark:hover:bg-slate-800 transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          {copied ? 'تم النسخ' : 'نسخ أسماء المتغيرات الستة'}
        </button>
      </div>
    </div>
  );
};
