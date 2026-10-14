import { useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { connectivityStore } from '../api/client';
import { RestaurantContext, ToastContext } from '../lib/contexts';
import { formatMoney } from '../lib/format';
import { hasFeature, type Feature } from '../lib/plans';
import { amountMaskStore, MASK } from '../lib/privacy';

export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  const { currency } = ctx.restaurant;
  const money = useCallback((amount: number) => formatMoney(amount, currency), [currency]);
  return { ...ctx, money };
}

export const useToast = () => useContext(ToastContext);

/** Whether the restaurant's plan includes a premium feature. `loaded` is false until the plan is known. */
export function useFeature(feature: Feature) {
  const { restaurant, loaded } = useContext(RestaurantContext);
  return { allowed: hasFeature(restaurant.plan, feature), loaded, plan: restaurant.plan };
}

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
