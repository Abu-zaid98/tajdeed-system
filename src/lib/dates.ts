import { 
  format, 
  addDays, 
  differenceInDays, 
  isAfter, 
  isBefore, 
  parseISO, 
  startOfDay
} from 'date-fns';
import { arSA } from 'date-fns/locale';
import type { SubscriptionStatus } from '../types';

/**
 * Converts any Eastern Arabic digits (٠-٩) to standard digits (0123456789)
 */
export function toStandardDigits(str: string | number): string {
  const easternDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(str).replace(/[٠-٩]/g, d => String(easternDigits.indexOf(d)));
}

export function parseAppDate(date: string | Date): Date {
  if (typeof date === 'string') {
    return parseISO(date);
  }
  return date;
}

export function formatArabicDate(date: string | Date, formatStr = 'dd MMMM yyyy'): string {
  try {
    const d = parseAppDate(date);
    const raw = format(d, formatStr, { locale: arSA });
    return toStandardDigits(raw);
  } catch {
    return toStandardDigits(String(date));
  }
}

export function formatArabicDateTime(date: string | Date): string {
  try {
    const d = parseAppDate(date);
    const raw = format(d, 'dd MMMM yyyy - hh:mm a', { locale: arSA });
    return toStandardDigits(raw);
  } catch {
    return toStandardDigits(String(date));
  }
}

export function computeSubscriptionStatus(
  endDateStr: string | Date,
  expiryAlertDays = 3
): SubscriptionStatus {
  try {
    const now = startOfDay(new Date());
    const end = startOfDay(parseAppDate(endDateStr));

    if (isBefore(end, now)) {
      return 'expired';
    }

    const diffDays = differenceInDays(end, now);
    if (diffDays <= expiryAlertDays) {
      return 'expiring_soon';
    }

    return 'active';
  } catch {
    return 'expired';
  }
}

export function getRemainingDaysText(endDateStr: string | Date): { text: string; isExpired: boolean; days: number } {
  try {
    const now = startOfDay(new Date());
    const end = startOfDay(parseAppDate(endDateStr));
    const diff = differenceInDays(end, now);
    const absDiff = Math.abs(diff);

    if (diff < 0) {
      return {
        text: `منتهي منذ ${absDiff} ${absDiff === 1 ? 'يوم' : 'أيام'}`,
        isExpired: true,
        days: diff
      };
    } else if (diff === 0) {
      return {
        text: 'ينتهي اليوم',
        isExpired: false,
        days: 0
      };
    } else if (diff === 1) {
      return {
        text: 'ينتهي غداً',
        isExpired: false,
        days: 1
      };
    } else {
      return {
        text: `متبقي ${diff} يوماً`,
        isExpired: false,
        days: diff
      };
    }
  } catch {
    return { text: 'غير محدد', isExpired: true, days: 0 };
  }
}

export function calculateRenewalDates(previousEndDateStr?: string, durationDays = 30): { startDate: string; endDate: string } {
  let start: Date;
  const now = startOfDay(new Date());

  if (previousEndDateStr) {
    const prevEnd = startOfDay(parseAppDate(previousEndDateStr));
    if (isAfter(prevEnd, now)) {
      start = addDays(prevEnd, 1);
    } else {
      start = now;
    }
  } else {
    start = now;
  }

  const end = addDays(start, durationDays - 1);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString()
  };
}

/* ── Manual cycle-date helpers (yyyy-MM-dd inputs, inclusive day counting) ── */

/** ISO datetime -> 'yyyy-MM-dd' for <input type="date"> (local day). */
export function toDateInputValue(date: string | Date): string {
  try {
    return format(startOfDay(parseAppDate(date)), 'yyyy-MM-dd');
  } catch {
    return format(startOfDay(new Date()), 'yyyy-MM-dd');
  }
}

/** Today as 'yyyy-MM-dd'. */
export function todayInputValue(): string {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
}

/** 'yyyy-MM-dd' -> local midnight Date (avoids UTC-day shift of parseISO). */
export function fromDateInputValue(value: string): Date {
  const parts = String(value || '').split('-').map(Number);
  if (parts.length === 3 && parts.every(n => Number.isFinite(n))) {
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d);
    if (!Number.isNaN(dt.getTime())) return startOfDay(dt);
  }
  return startOfDay(new Date());
}

/** Inclusive duration in days between two 'yyyy-MM-dd' values (min 1). */
export function durationBetweenInputs(startValue: string, endValue: string, fallback: number): number {
  try {
    const diff = differenceInDays(
      startOfDay(fromDateInputValue(endValue)),
      startOfDay(fromDateInputValue(startValue))
    ) + 1;
    return diff >= 1 ? diff : fallback;
  } catch {
    return fallback;
  }
}

/** Plain 'yyyy-MM-dd' or full ISO -> local-midnight day (no UTC shift). */
function toLocalDay(value: string): Date {
  const v = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return fromDateInputValue(v);
  return startOfDay(parseAppDate(v));
}

export interface ResolvedCycleDates {
  startDate: string;
  endDate: string;
  durationDays: number;
}

/**
 * Single source of truth for a cycle period:
 * - manual start/end (ISO or yyyy-MM-dd) win when provided;
 * - otherwise falls back to the automatic rule (today or day-after-previous-end).
 * End is clamped to >= start; duration is the inclusive day count.
 */
export function resolveCycleDates(opts: {
  manualStart?: string;
  manualEnd?: string;
  fallbackPreviousEnd?: string;
  durationDays?: number;
}): ResolvedCycleDates {
  const fallbackDuration = opts.durationDays && opts.durationDays > 0
    ? Math.floor(opts.durationDays)
    : 30;
  try {
    if (opts.manualStart) {
      const s = toLocalDay(opts.manualStart);
      if (Number.isNaN(s.getTime())) throw new Error('bad manual start');
      let e: Date;
      if (opts.manualEnd) {
        const me = toLocalDay(opts.manualEnd);
        e = !Number.isNaN(me.getTime()) && me >= s ? me : addDays(s, fallbackDuration - 1);
      } else {
        e = addDays(s, fallbackDuration - 1);
      }
      return {
        startDate: s.toISOString(),
        endDate: e.toISOString(),
        durationDays: differenceInDays(e, s) + 1
      };
    }
  } catch {
    // fall through to automatic calculation
  }
  const { startDate, endDate } = calculateRenewalDates(opts.fallbackPreviousEnd, fallbackDuration);
  return { startDate, endDate, durationDays: fallbackDuration };
}
