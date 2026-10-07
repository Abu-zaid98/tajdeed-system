import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Last-resort safety net: any uncaught render crash shows a recoverable
 * screen (both themes) instead of a blank page.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Uncaught UI error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocalData = () => {
    if (!window.confirm('سيتم مسح البيانات المحلية على هذا الجهاز فقط (البيانات السحابية لن تتأثر). متابعة؟')) {
      return;
    }
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('tajdeed_'))
        .forEach(k => localStorage.removeItem(k));
    } catch {
      // storage unavailable — reload anyway
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50 dark:bg-[#07090e]">
        <div className="w-full max-w-md glass-card p-6 sm:p-8 rounded-3xl space-y-5 text-center">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-black text-slate-900 dark:text-white">
              حدث خطأ غير متوقع
            </h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              تعذر عرض هذه الشاشة. بياناتك محفوظة — جرّب إعادة التحميل، وإن تكرر الخطأ امسح البيانات المحلية (ستُعاد مزامنتها من السحابة).
            </p>
          </div>
          <details className="text-start text-[11px] text-slate-400 bg-slate-100 dark:bg-white/5 rounded-xl p-3 max-h-32 overflow-auto" dir="ltr">
            <summary className="cursor-pointer font-mono">تفاصيل الخطأ</summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </details>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-brand-500 text-white shadow-md shadow-brand-500/30 hover:brightness-110 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              إعادة تحميل التطبيق
            </button>
            <button
              type="button"
              onClick={this.handleResetLocalData}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 border border-rose-500/30 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              مسح البيانات المحلية
            </button>
          </div>
        </div>
      </div>
    );
  }
}
