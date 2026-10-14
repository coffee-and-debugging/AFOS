import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { DEFAULT_RESTAURANT, RestaurantContext, ToastContext } from '../lib/contexts';
import type { Restaurant } from '../types';

function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurant, setRestaurant] = useState<Restaurant>(DEFAULT_RESTAURANT);
  const [loaded, setLoaded] = useState(false);

  // Defaults render immediately; keep retrying in the background until the API answers.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = (delay: number) =>
      api.restaurant.get().then(
        (r) => { if (!cancelled) { setRestaurant(r); setLoaded(true); } },
        () => { if (!cancelled) timer = setTimeout(() => load(Math.min(delay * 2, 30_000)), delay); },
      );
    load(2000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  useEffect(() => {
    document.title = restaurant.name;
  }, [restaurant.name]);

  const value = useMemo(() => ({ restaurant, setRestaurant, loaded }), [restaurant, loaded]);
  return <RestaurantContext.Provider value={value}>{children}</RestaurantContext.Provider>;
}

interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((kind: Toast['kind'], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  const value = useMemo(
    () => ({ success: (m: string) => push('success', m), error: (m: string) => push('error', m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <RestaurantProvider>
      <ToastProvider>{children}</ToastProvider>
    </RestaurantProvider>
  );
}
