import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft, RotateCcw } from 'lucide-react';
import { formatArabicDate } from '../../lib/dates';

export interface CustomDatePickerProps {
  value: string; // ISO date string (YYYY-MM-DD or full ISO)
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  value,
  onChange,
  label,
  placeholder = 'اختر التاريخ...',
  disabled = false,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial selected date
  const selectedDate = value ? new Date(value) : new Date();
  const [viewYear, setViewYear] = useState<number>(selectedDate.getFullYear() || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(selectedDate.getMonth() || new Date().getMonth());

  useEffect(() => {
    if (value) {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth());
      }
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(y => y - 1);
    } else {
      setViewMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(y => y + 1);
    } else {
      setViewMonth(m => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const d = new Date(viewYear, viewMonth, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const isoString = `${yyyy}-${mm}-${dd}`;
    onChange(isoString);
    setIsOpen(false);
  };

  const monthNames = [
    'كانون الثاني (1)', 'شباط (2)', 'آذار (3)', 'نيسان (4)', 
    'أيار (5)', 'حزيران (6)', 'تموز (7)', 'آب (8)', 
    'أيلول (9)', 'تشرين الأول (10)', 'تشرين الثاني (11)', 'كانون الأول (12)'
  ];

  const weekDayNames = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

  const numDays = daysInMonth(viewYear, viewMonth);
  const startDay = firstDayOfMonth(viewYear, viewMonth);

  const selectedIso = value ? value.split('T')[0] : '';

  const formatDisplay = () => {
    if (!value) return placeholder;
    try {
      return formatArabicDate(value);
    } catch {
      return value;
    }
  };

  return (
    <div className={`space-y-1.5 text-start relative ${className}`} ref={containerRef}>
      {label && (
        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full rounded-xl border border-slate-200 dark:border-white/10 
                   bg-white dark:bg-[#0c101d] text-slate-900 dark:text-white
                   hover:border-brand-500/50 focus:outline-none focus:ring-2 focus:ring-brand-500/20
                   p-2.5 text-xs sm:text-sm flex items-center justify-between gap-2 transition-all cursor-pointer shadow-xs
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-4 h-4 text-brand-500 shrink-0" />
          <span className={value ? 'font-medium font-mono' : 'text-slate-400'}>
            {formatDisplay()}
          </span>
        </span>
        <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
          {selectedIso}
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full start-0 mt-2 z-50 p-4 rounded-3xl glass-card border border-slate-200 dark:border-white/10 shadow-2xl w-72 sm:w-80 space-y-3 animate-in fade-in zoom-in-95 duration-150">
          {/* Header Month / Year controls */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2.5">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
              {monthNames[viewMonth]} {viewYear}
            </span>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400">
            {weekDayNames.map(wd => (
              <div key={wd} className="py-1">{wd}</div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center text-xs">
            {/* Empty offset slots */}
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day slots */}
            {Array.from({ length: numDays }).map((_, i) => {
              const day = i + 1;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isSelected = selectedIso === dateStr;
              const isToday = new Date().toISOString().slice(0, 10) === dateStr;

              return (
                <button
                  key={`day-${day}`}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`p-1.5 rounded-xl font-medium transition-all text-center flex items-center justify-center ${
                    isSelected
                      ? 'bg-brand-500 text-white font-bold shadow-md shadow-brand-500/25'
                      : isToday
                      ? 'border border-brand-500/30 text-brand-600 dark:text-brand-400 font-bold bg-brand-500/5'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick presets footer */}
          <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => {
                const today = new Date().toISOString().slice(0, 10);
                onChange(today);
                setIsOpen(false);
              }}
              className="text-brand-500 hover:underline font-semibold"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => {
                const nextMonth = new Date();
                nextMonth.setDate(nextMonth.getDate() + 30);
                onChange(nextMonth.toISOString().slice(0, 10));
                setIsOpen(false);
              }}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              +30 يوماً
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
