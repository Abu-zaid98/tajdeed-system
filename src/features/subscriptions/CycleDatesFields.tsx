import React from 'react';
import { addDays } from 'date-fns';
import { Calendar } from 'lucide-react';
import { Input } from '../../components/ui/Input';
import {
  durationBetweenInputs,
  formatArabicDate,
  fromDateInputValue,
  toDateInputValue,
} from '../../lib/dates';

interface CycleDatesFieldsProps {
  startValue: string; // yyyy-MM-dd
  endValue: string; // yyyy-MM-dd
  defaultDuration: number;
  onChange: (start: string, end: string) => void;
  startHint?: string;
}

const PRESETS = [30, 60, 90];

/**
 * Manual cycle-period editor: start date + end date inputs with smart
 * defaults, quick duration presets, and a live preview. Changing the
 * start shifts the end to preserve the current duration; the end is
 * never allowed before the start.
 */
export const CycleDatesFields: React.FC<CycleDatesFieldsProps> = ({
  startValue,
  endValue,
  defaultDuration,
  onChange,
  startHint,
}) => {
  const duration = durationBetweenInputs(startValue, endValue, defaultDuration);

  const handleStart = (v: string) => {
    if (!v) return;
    const dur = durationBetweenInputs(startValue, endValue, defaultDuration);
    const shiftedEnd = toDateInputValue(addDays(fromDateInputValue(v), dur - 1));
    onChange(v, shiftedEnd);
  };

  const handleEnd = (v: string) => {
    if (!v) return;
    // Clamp: end can never precede start.
    onChange(startValue, v < startValue ? startValue : v);
  };

  const applyPreset = (days: number) => {
    if (!startValue) return;
    onChange(startValue, toDateInputValue(addDays(fromDateInputValue(startValue), days - 1)));
  };

  return (
    <div className="space-y-3">
      {/* Live preview */}
      <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold">
          <Calendar className="w-4 h-4" />
          <span>فترة الاشتراك ({duration} يوماً)</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-200">
          <div>
            <span className="text-slate-400 block text-[11px]">تاريخ البدء:</span>
            <span className="font-semibold">{formatArabicDate(fromDateInputValue(startValue))}</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[11px]">تاريخ الانتهاء:</span>
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              {formatArabicDate(fromDateInputValue(endValue))}
            </span>
          </div>
        </div>
      </div>

      {/* Manual date inputs */}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="تاريخ البدء (يدوي)"
          type="date"
          value={startValue}
          onChange={e => handleStart(e.target.value)}
          helperText={startHint}
          required
        />
        <Input
          label="تاريخ الانتهاء (يدوي)"
          type="date"
          value={endValue}
          min={startValue}
          onChange={e => handleEnd(e.target.value)}
          required
        />
      </div>

      {/* Quick duration presets */}
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
          مدة سريعة (تضبط الانتهاء من تاريخ البدء)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map(days => (
            <button
              type="button"
              key={days}
              onClick={() => applyPreset(days)}
              className={`py-2 rounded-xl text-xs font-semibold border transition-all ${
                duration === days
                  ? 'bg-brand-500 text-white border-brand-500 shadow-md'
                  : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-brand-500/40'
              }`}
            >
              {days} يوماً ({Math.round(days / 30)} {Math.round(days / 30) === 1 ? 'شهر' : 'أشهر'})
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
