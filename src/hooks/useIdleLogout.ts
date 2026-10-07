import { useEffect, useRef } from 'react';
import { toast } from 'sonner';

const LAST_ACTIVITY_KEY = 'tajdeed_last_activity';
const CHECK_INTERVAL_MS = 15_000;
const WRITE_THROTTLE_MS = 5_000;

function touchActivity() {
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // storage unavailable — ignore
  }
}

function readLastActivity(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVITY_KEY) || '0') || 0;
  } catch {
    return 0;
  }
}

/**
 * Automatically signs the user out after `timeoutMinutes` of inactivity.
 * Activity is shared across tabs via localStorage, so working in one tab
 * keeps every other tab alive. Pass 0 to disable.
 */
export function useIdleLogout(
  isSignedIn: boolean,
  timeoutMinutes: number,
  onIdleTimeout: () => Promise<void> | void
) {
  // Latest callback without re-subscribing on every store re-render.
  const cbRef = useRef(onIdleTimeout);
  cbRef.current = onIdleTimeout;

  useEffect(() => {
    if (!isSignedIn) return;
    const timeout = Number(timeoutMinutes) || 0;
    if (timeout <= 0) return;

    const timeoutMs = timeout * 60 * 1_000;

    // Fresh sign-in (or settings change) restarts the countdown.
    touchActivity();
    let lastWrite = Date.now();

    const activityEvents = ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'] as const;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastWrite > WRITE_THROTTLE_MS) {
        lastWrite = now;
        touchActivity();
      }
    };

    activityEvents.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true })
    );

    let fired = false;
    const interval = window.setInterval(() => {
      if (fired) return;
      const last = readLastActivity();
      if (last > 0 && Date.now() - last > timeoutMs) {
        fired = true;
        toast.warning('تم تسجيل الخروج تلقائياً بسبب عدم النشاط');
        void cbRef.current();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      activityEvents.forEach((evt) => window.removeEventListener(evt, onActivity));
    };
  }, [isSignedIn, timeoutMinutes]);
}
