import { useState, useEffect, useCallback, useRef } from 'react';
import { toKey } from '../lib/dates';

const THEME_KEY = 'hwk_theme';
const THEME_COLORS = { dark: '#07070d', light: '#f3f4fa' };

/** Theme preference: 'dark' | 'light' | 'system'. Returns [pref, setPref, resolved]. */
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark');
  const [resolved, setResolved] = useState('dark');

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const r = theme === 'system' ? (mq.matches ? 'light' : 'dark') : theme;
      document.documentElement.dataset.theme = r;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLORS[r]);
      setResolved(r);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  return [theme, setTheme, resolved];
}

/** Current local date key; updates after midnight or when the app is reopened. */
export function useTodayKey() {
  const [today, setToday] = useState(toKey);
  useEffect(() => {
    const check = () => setToday((prev) => (prev === toKey() ? prev : toKey()));
    const id = setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return today;
}

/** PWA install prompt handling (Android/desktop) + iOS detection. */
export function useInstallPrompt() {
  const [evt, setEvt] = useState(null);
  const [installed, setInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true,
  );

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setEvt(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setEvt(null);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isIOS =
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const promptInstall = useCallback(async () => {
    if (!evt) return false;
    evt.prompt();
    const { outcome } = await evt.userChoice;
    setEvt(null);
    return outcome === 'accepted';
  }, [evt]);

  return { canInstall: !!evt && !installed, installed, isIOS, promptInstall };
}

/** Lightweight toast state with optional action (e.g. undo). */
export function useToast() {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);

  const hideToast = useCallback(() => {
    clearTimeout(timer.current);
    setToast(null);
  }, []);

  const showToast = useCallback((message, opts = {}) => {
    clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone: 'default', ...opts });
    timer.current = setTimeout(() => setToast(null), opts.duration ?? (opts.action ? 5000 : 3000));
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return { toast, showToast, hideToast };
}

/** Keeps the last non-null value so sheets can animate out with their content. */
export function useLatest(value) {
  const ref = useRef(value);
  if (value != null) ref.current = value;
  return value ?? ref.current;
}

export const haptic = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
};
