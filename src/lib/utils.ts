import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Ensures any number is strictly formatted as 0123456789 with clean thousand separators
 */
export function formatStandardNumber(val: number | string): string {
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return String(val);
  return num.toLocaleString('en-US');
}

export function formatCurrency(amount: number, currency = '₪'): string {
  return `${formatStandardNumber(amount)} ${currency}`;
}

/** Human-readable byte size with Arabic units. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 بايت';
  if (bytes < 1024) return `${bytes.toLocaleString('en-US')} بايت`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} ك.ب`;
  return `${(kb / 1024).toFixed(2)} م.ب`;
}

export type CyclePayStatus = 'paid' | 'unpaid' | 'partial';

function payStatusFor(paid: number, price: number): CyclePayStatus {
  if (paid >= price) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

/**
 * Plan-change repricing math (pure): given what was paid and the new price,
 * returns the capped cycle payment, its status, any surplus to credit,
 * and the remaining cash due. Nothing vanishes: paid 100 -> price 60
 * yields cyclePaid 60 + creditAdd 40 + remaining 0.
 */
export function computePlanChangeBalance(paid: number, newPrice: number): {
  cyclePaid: number;
  payStatus: CyclePayStatus;
  creditAdd: number;
  remaining: number;
} {
  const safePaid = Math.max(0, paid || 0);
  const safePrice = Math.max(0, newPrice || 0);
  const cyclePaid = Math.min(safePaid, safePrice);
  const creditAdd = safePaid - cyclePaid;
  return {
    cyclePaid,
    payStatus: payStatusFor(cyclePaid, safePrice),
    creditAdd,
    remaining: Math.max(0, safePrice - cyclePaid),
  };
}

/**
 * Credit application math (pure): apply a credit balance to a new charge.
 */
export function applyCreditToCharge(credit: number, price: number): {
  applied: number;
  paid: number;
  remainingCredit: number;
  payStatus: CyclePayStatus;
  cashDue: number;
} {
  const safeCredit = Math.max(0, credit || 0);
  const safePrice = Math.max(0, price || 0);
  const applied = Math.min(safeCredit, safePrice);
  return {
    applied,
    paid: applied,
    remainingCredit: safeCredit - applied,
    payStatus: payStatusFor(applied, safePrice),
    cashDue: Math.max(0, safePrice - applied),
  };
}

/**
 * Split text into byte-safe chunks (never cuts a UTF-8 sequence in half).
 * Joined chunks always reassemble the exact original string.
 */
export function splitStringToByteChunks(text: string, maxBytes: number): string[] {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) return [text];
  // Leave headroom: the final flush can append one cut multi-byte sequence.
  const step = Math.max(1, maxBytes - 4);
  const parts: string[] = [];
  const decoder = new TextDecoder();
  for (let i = 0; i < bytes.length; i += step) {
    parts.push(decoder.decode(bytes.slice(i, i + step), { stream: true }));
  }
  const tail = decoder.decode();
  if (tail) parts[parts.length - 1] += tail;
  return parts;
}

/**
 * Deterministic JSON (sorted keys, undefined treated as null)
 * for reliable change comparison regardless of key order.
 */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function generateWhatsAppLink(params: {
  phone?: string;
  subscriberName: string;
  endDate: string;
  remainingAmount: number;
  currency: string;
  networkName: string;
}): string {
  const cleanPhone = normalizePhone(params.phone);
  if (!cleanPhone) return '';

  const message = buildReminderMessage({
    subscriberName: params.subscriberName,
    endDate: params.endDate,
    amount: params.remainingAmount,
    currency: params.currency,
    networkName: params.networkName,
  });

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/** Normalize a local phone number to international digits (no leading +). */
export function normalizePhone(phone?: string): string {
  if (!phone) return '';
  // Clean phone number (remove spaces, dashes)
  const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
  if (cleanPhone.startsWith('05')) {
    return '970' + cleanPhone.substring(1);
  } else if (cleanPhone.startsWith('+')) {
    return cleanPhone.substring(1);
  }
  return cleanPhone;
}

export interface ReminderMessageParams {
  subscriberName: string;
  endDate: string;
  amount: number;
  currency: string;
  networkName: string;
  template?: string;
}

export const DEFAULT_REMINDER_TEMPLATE = `السلام عليكم أخي الكريم {name}،
نود تذكيرك بأن اشتراك الإنترنت في ({network}) ينتهي بتاريخ: {endDate}.
المبلغ المستحق: {amount} {currency}.
شاكرين ثقتكم بنا ورعايتكم.`;

/** Fill {name} {network} {endDate} {amount} {currency} placeholders. */
export function buildReminderMessage(params: ReminderMessageParams): string {
  const tpl = params.template || DEFAULT_REMINDER_TEMPLATE;
  return tpl
    .replace(/{name}/g, params.subscriberName)
    .replace(/{network}/g, params.networkName)
    .replace(/{endDate}/g, params.endDate)
    .replace(/{amount}/g, formatStandardNumber(params.amount))
    .replace(/{currency}/g, params.currency);
}

/** Clipboard copy with legacy fallback (non-secure contexts). */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function downloadJsonFile(data: unknown, filename: string) {
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToCsv(data: Record<string, unknown>[], filename: string) {
  if (data.length === 0) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => 
    headers.map(h => {
      const val = row[h];
      const str = val === undefined || val === null ? '' : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }).join(',')
  );

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
