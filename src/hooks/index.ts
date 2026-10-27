import { useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { connectivityStore } from '../api/client';
import { liveEvents, type LiveEventName } from '../api/events';
import { soundStore } from '../lib/sound';
import { stockAlertPrefs } from '../lib/alertPrefs';
import type { LiveEvents } from '../types';
import { RestaurantContext, ToastContext } from '../lib/contexts';
import { formatMoney } from '../lib/format';
import { amountMaskStore, MASK } from '../lib/privacy';

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  const { currency } = ctx.restaurant;
  const money = useCallback((amount: number) => formatMoney(amount, currency), [currency]);
  return { ...ctx, money };
}

export const useToast = () => useContext(ToastContext);

/**
 * Show/hide sensitive amounts. `show(amount)` returns the formatted money or a mask,
 * so screens swap `money(x)` for `show(x)` and get masking for free.
 */
export function useAmountMask() {
  const { money } = useRestaurant();
  const { restaurant } = useContext(RestaurantContext);
  const hidden = useSyncExternalStore(amountMaskStore.subscribe, amountMaskStore.getSnapshot);
  const toggle = useCallback(() => amountMaskStore.set(!amountMaskStore.getSnapshot()), []);
  const show = useCallback(
    (amount: number) => (hidden ? `${restaurant.currency} ${MASK}` : money(amount)),
    [hidden, money, restaurant.currency],
  );
  return { hidden, toggle, show };
}

/** Ref + whether its text is currently cut off by a CSS line clamp; re-checks on resize and when `text` changes. */
export function useIsClamped<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const [clamped, setClamped] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);
  return [ref, clamped] as const;
}

export function useConnectivity() {
  return useSyncExternalStore(connectivityStore.subscribe, connectivityStore.getSnapshot);
}

interface PollingState<T> {
  data?: T;
  error?: Error;
  loading: boolean;
}

/**
 * Loads data and optionally refreshes it on an interval. On failure the last good
 * data is kept, so a brief API outage never blanks the screen.
 * `fetcher` must be stable (wrap it in useCallback).
 */
export function usePolling<T>(fetcher: () => Promise<T>, intervalMs?: number) {
  const [state, setState] = useState<PollingState<T>>({ loading: true });

  const load = useCallback(async () => {
    try {
      const data = await fetcher();
      setState({ data, loading: false });
    } catch (error) {
      setState((s) => ({ ...s, error: error as Error, loading: false }));
    }
  }, [fetcher]);

  useEffect(() => {
    load();
    if (!intervalMs) return;
    const id = setInterval(load, intervalMs);
    return () => clearInterval(id);
  }, [load, intervalMs]);

  const retry = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: undefined }));
    load();
  }, [load]);

  const setData = useCallback((update: (prev: T) => T) => {
    setState((s) => (s.data === undefined ? s : { ...s, data: update(s.data) }));
  }, []);

  return { ...state, reload: load, retry, setData };
}

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Runs `handler` for every real-time event of this type while the component is mounted. */
export function useLiveEvent<K extends LiveEventName>(name: K, handler: (data: LiveEvents[K]) => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useEffect(() => liveEvents.subscribe(name, (data) => latest.current(data)), [name]);
}

/**
 * Calls `reload` shortly after any of the given events (debounced, so a burst of orders
 * causes one refresh) and again whenever the live connection recovers after a drop.
 */
export function useLiveReload(reload: () => void, names: LiveEventName[], delayMs = 800) {
  const latest = useRef(reload);
  useEffect(() => {
    latest.current = reload;
  });
  const key = names.join(',');
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), delayMs);
    };
    const offs = key.split(',').map((n) => liveEvents.subscribe(n as LiveEventName, schedule));
    let wasLive = liveEvents.getStatus() === 'live';
    offs.push(liveEvents.onStatus(() => {
      const live = liveEvents.getStatus() === 'live';
      if (live && !wasLive) schedule(); // catch up on anything missed while disconnected
      wasLive = live;
    }));
    return () => {
      clearTimeout(timer);
      offs.forEach((off) => off());
    };
  }, [key, delayMs]);
}

export const useLiveStatus = () => useSyncExternalStore(liveEvents.onStatus, liveEvents.getStatus);

export const useSound = () => useSyncExternalStore(soundStore.subscribe, soundStore.getSnapshot);

/** This device's low-stock notification settings (pop-ups, sound, muted items) */
export const useStockAlertPrefs = () => useSyncExternalStore(stockAlertPrefs.subscribe, stockAlertPrefs.getSnapshot);
