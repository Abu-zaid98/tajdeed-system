import { useEffect, useRef } from 'react';

const ENABLE_KEY = 'tajdeed_notify_enabled';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isNotifyEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setNotifyEnabled(on: boolean): void {
  try {
    localStorage.setItem(ENABLE_KEY, on ? '1' : '0');
  } catch {
    // ignore
  }
}

/**
 * Per-device expiry digest via the OS notification channel.
 * No server needed (works offline): while signed in, checks counts and
 * notifies only when the numbers change — same tag replaces, no stacking.
 */
export function useExpiryNotifications(
  isSignedIn: boolean,
  expiringSoonCount: number,
  expiredCount: number
) {
  const countsRef = useRef({ expiringSoonCount, expiredCount });
  countsRef.current = { expiringSoonCount, expiredCount };

  useEffect(() => {
    if (!isSignedIn || !isNotificationSupported()) return;
    let stopped = false;
    const lastSig = { value: '' };

    const check = () => {
      if (stopped || !isNotifyEnabled()) return;
      if (Notification.permission !== 'granted') return;
      const { expiringSoonCount, expiredCount } = countsRef.current;
      const total = expiringSoonCount + expiredCount;
      if (total <= 0) return;
      const sig = `${expiringSoonCount}/${expiredCount}`;
      if (sig === lastSig.value) return;
      lastSig.value = sig;
      try {
        const n = new Notification('تجديد — اشتراكات تحتاج متابعة', {
          body: `تنتهي قريباً: ${expiringSoonCount} • منتهية: ${expiredCount} — افتح التذكيرات للمتابعة`,
          icon: `${import.meta.env.BASE_URL}pwa-192x192.png`,
          tag: 'tajdeed-expiry-digest',
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      } catch {
        // notifications blocked — ignore
      }
    };

    const soon = window.setTimeout(check, 20000);
    const timer = window.setInterval(check, 30 * 60 * 1000);
    return () => {
      stopped = true;
      window.clearTimeout(soon);
      window.clearInterval(timer);
    };
  }, [isSignedIn]);
}
