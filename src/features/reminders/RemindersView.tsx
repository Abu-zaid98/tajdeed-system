import React, { useMemo, useState, useEffect } from 'react';
import { Send, Copy, CheckSquare, Square, Search, PhoneOff, MessageCircle } from 'lucide-react';
import { useAppStore } from '../../lib/store';
import { formatArabicDate } from '../../lib/dates';
import {
  buildReminderMessage,
  copyTextToClipboard,
  normalizePhone,
  DEFAULT_REMINDER_TEMPLATE,
} from '../../lib/utils';
import { formatCurrency } from '../../lib/utils';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { toast } from 'sonner';
import type { SubscriberWithDetails } from '../../types';

type ReminderFilter = 'all' | 'expiring_soon' | 'expired' | 'debt';

const FILTERS: { key: ReminderFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'expiring_soon', label: 'ينتهي قريباً' },
  { key: 'expired', label: 'منتهي' },
  { key: 'debt', label: 'عليه ذمة' },
];

function reminderAmount(sub: SubscriberWithDetails): number {
  if (sub.netDue > 0) return sub.netDue;
  if (sub.remainingAmount > 0) return sub.remainingAmount;
  return sub.currentSubscription?.price ?? 0;
}

function reminderEndDate(sub: SubscriberWithDetails): string {
  return sub.currentSubscription ? formatArabicDate(sub.currentSubscription.endDate) : 'غير محدد';
}

export const RemindersView: React.FC = () => {
  const { subscribersWithDetails, settings } = useAppStore();

  const [filter, setFilter] = useState<ReminderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyWithPhone, setOnlyWithPhone] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [template, setTemplate] = useState(DEFAULT_REMINDER_TEMPLATE);
  const [isCopying, setIsCopying] = useState(false);

  // Incremental rendering for large lists
  const [visibleCount, setVisibleCount] = useState(100);
  useEffect(() => {
    setVisibleCount(100);
  }, [filter, searchQuery, onlyWithPhone]);

  const candidates = useMemo(() => {
    return subscribersWithDetails.filter(s => {
      if (s.archived) return false;
      if (filter === 'expiring_soon' && s.computedStatus !== 'expiring_soon') return false;
      if (filter === 'expired' && s.computedStatus !== 'expired') return false;
      if (filter === 'debt' && !(s.netDue > 0)) return false;
      if (onlyWithPhone && !normalizePhone(s.phone)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.phone || '').includes(q)) return false;
      }
      return true;
    });
  }, [subscribersWithDetails, filter, searchQuery, onlyWithPhone]);

  const withoutPhoneCount = useMemo(() => {
    return subscribersWithDetails.filter(s => {
      if (s.archived) return false;
      if (filter === 'expiring_soon' && s.computedStatus !== 'expiring_soon') return false;
      if (filter === 'expired' && s.computedStatus !== 'expired') return false;
      if (filter === 'debt' && !(s.netDue > 0)) return false;
      return !normalizePhone(s.phone);
    }).length;
  }, [subscribersWithDetails, filter]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = candidates.length > 0 && candidates.every(c => selectedSet.has(c.id));

  const toggleSelect = (id: string) => {
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(prev => prev.filter(id => !candidates.some(c => c.id === id)));
    } else {
      setSelected(prev => [...new Set([...prev, ...candidates.map(c => c.id)])]);
    }
  };

  const buildMessageFor = (sub: SubscriberWithDetails): string => {
    return buildReminderMessage({
      subscriberName: sub.name,
      endDate: reminderEndDate(sub),
      amount: reminderAmount(sub),
      currency: settings.currency,
      networkName: settings.networkName,
      template,
    });
  };

  const waLinkFor = (sub: SubscriberWithDetails): string => {
    const phone = normalizePhone(sub.phone);
    if (!phone) return '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(buildMessageFor(sub))}`;
  };

  const handleCopySelected = async () => {
    const targets = candidates.filter(c => selectedSet.has(c.id));
    if (targets.length === 0) {
      toast.error('حدد مشتركاً واحداً على الأقل أولاً');
      return;
    }
    setIsCopying(true);
    try {
      const text = targets
        .map(sub => `إلى: ${sub.name} (${sub.phone})\n${buildMessageFor(sub)}`)
        .join('\n────────────\n');
      const ok = await copyTextToClipboard(text);
      if (ok) {
        toast.success(`تم نسخ رسائل ${targets.length} مشتركين — جاهزة للقوائم الجماعية`);
      } else {
        toast.error('تعذّر النسخ التلقائي — انسخ يدوياً');
      }
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <div className="space-y-6 text-start max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-emerald-500" />
            <span>تذكيرات الواتساب</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            حدد المشتركين، خصص الرسالة، ثم أرسل لكل واحد أو انسخ الكل لقوائم البث
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="glass"
            size="sm"
            onClick={handleCopySelected}
            isLoading={isCopying}
            leftIcon={<Copy className="w-4 h-4 text-brand-500" />}
          >
            نسخ رسائل المحدد ({selectedSet.size})
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 sm:p-5 rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الهاتف..."
              startIcon={<Search className="w-4 h-4" />}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  filter === f.key
                    ? 'bg-brand-500 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyWithPhone}
            onChange={e => setOnlyWithPhone(e.target.checked)}
            className="w-4 h-4 rounded accent-brand-500"
          />
          إظهار من لديه رقم هاتف فقط
          {withoutPhoneCount > 0 && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <PhoneOff className="w-3.5 h-3.5" />
              ({withoutPhoneCount} بدون رقم في هذا التصفية)
            </span>
          )}
        </label>

        {/* Message template */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
            قالب الرسالة (المتغيرات: {'{name} {network} {endDate} {amount} {currency}'})
          </label>
          <textarea
            value={template}
            onChange={e => setTemplate(e.target.value)}
            rows={4}
            className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-slate-900/60 p-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 leading-relaxed"
          />
        </div>
      </div>

      {/* List */}
      <div className="glass-card p-4 sm:p-5 rounded-3xl space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:text-brand-500 transition-colors"
          >
            {allSelected ? (
              <CheckSquare className="w-4 h-4 text-brand-500" />
            ) : (
              <Square className="w-4 h-4 text-slate-400" />
            )}
            {allSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل'} ({candidates.length})
          </button>
          <span className="text-[11px] text-slate-400">المحدد: {selectedSet.size}</span>
        </div>

        <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
          {candidates.length > 0 ? (
            candidates.slice(0, visibleCount).map(sub => {
              const checked = selectedSet.has(sub.id);
              const link = waLinkFor(sub);
              return (
                <div
                  key={sub.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center gap-3 ${
                    checked
                      ? 'border-brand-500/50 bg-brand-500/[0.07]'
                      : 'border-slate-200/80 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleSelect(sub.id)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-start"
                  >
                    {checked ? (
                      <CheckSquare className="w-5 h-5 text-brand-500 shrink-0" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400 shrink-0" />
                    )}
                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-sm shrink-0">
                      {sub.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {sub.name}
                        </span>
                        <Badge status={sub.computedStatus} size="sm" />
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span className="dir-ltr font-mono">{sub.phone}</span>
                        <span>ينتهي: {reminderEndDate(sub)}</span>
                        <span className="font-bold text-rose-500">
                          {formatCurrency(reminderAmount(sub), settings.currency)}
                        </span>
                      </div>
                    </div>
                  </button>

                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors shrink-0"
                    >
                      <Send className="w-3.5 h-3.5 rotate-180" />
                      إرسال
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400 shrink-0">بدون رقم</span>
                  )}
                </div>
              );
            })
          ) : (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا يوجد مشتركون مطابقون — جرّب تصفية أخرى أو أضف أرقام الهواتف
            </div>
          )}
          {candidates.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount(c => c + 100)}
              className="w-full py-3 rounded-2xl glass text-xs font-bold text-brand-500 hover:bg-brand-500/10 transition-colors"
            >
              عرض المزيد ({(candidates.length - visibleCount).toLocaleString('en-US')} متبقية)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
