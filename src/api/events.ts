import { API_BASE, getToken } from './client';
import type { LiveEvents } from '../types';

// Real-time events from the API (Server-Sent Events). Uses fetch rather than EventSource
// so the token travels in the Authorization header, never in a URL that ends up in logs.
// One shared connection serves every subscriber; it opens with the first and closes after the last.

export type LiveEventName = keyof LiveEvents;
export type LiveStatus = 'connecting' | 'live' | 'down';
type AnyHandler = (data: unknown) => void;

const STALE_MS = 60_000; // the server pings every 25 s; silence this long means a dead connection
const IDLE_CLOSE_MS = 3_000; // grace period so page navigation doesn't churn the connection

const handlers = new Map<LiveEventName, Set<AnyHandler>>();
const statusListeners = new Set<() => void>();
let status: LiveStatus = 'down';
let subscribers = 0;
let controller: AbortController | null = null;
let attempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
// Guests (no sign-in) use the guest stream, which only carries public changes and these orders
const watchedOrders = new Map<string, number>();
let connectedOrders = '';

function setStatus(next: LiveStatus) {
  if (next === status) return;
  status = next;
  statusListeners.forEach((l) => l());
}

function dispatch(block: string) {
  let type = 'message';
  let data = '';
  for (const line of block.split('\n')) {
    if (line.startsWith('event:')) type = line.slice(6).trim();
    else if (line.startsWith('data:')) data += line.slice(5).trim();
  }
  const set = handlers.get(type as LiveEventName);
  if (!set || !data) return;
  let payload: unknown;
  try {
    payload = JSON.parse(data);
  } catch {
    return;
  }
  set.forEach((h) => {
    try {
      h(payload);
    } catch (err) {
      console.error(`live event handler for ${type} failed`, err);
    }
  });
}

const guestOrderKey = () => [...watchedOrders.keys()].sort().join(',');

async function connect() {
  const token = getToken();
  connectedOrders = guestOrderKey();
  const url = token ? `${API_BASE}/events` : `${API_BASE}/events/guest?orders=${encodeURIComponent(connectedOrders)}`;
  const ctrl = new AbortController();
  controller = ctrl;
  setStatus('connecting');

  let watchdog: ReturnType<typeof setTimeout> | undefined;
  const feed = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => ctrl.abort(), STALE_MS);
  };

  try {
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' } : { Accept: 'text/event-stream' },
      cache: 'no-store',
      signal: ctrl.signal,
    });
    // Expired or deactivated sessions are handled by the regular API client's 401 redirect
    if (res.status === 401 || res.status === 403) return setStatus('down');
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

    setStatus('live');
    attempt = 0;
    feed();
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      feed();
      buffer += value.replace(/\r\n/g, '\n');
      let end;
      while ((end = buffer.indexOf('\n\n')) >= 0) {
        dispatch(buffer.slice(0, end));
        buffer = buffer.slice(end + 2);
      }
    }
  } catch {
    // network error or watchdog abort — fall through to reconnect
  } finally {
    clearTimeout(watchdog);
  }

  if (controller !== ctrl || subscribers === 0) return; // closed on purpose
  setStatus('down');
  retryTimer = setTimeout(connect, Math.min(1000 * 2 ** attempt++, 15_000));
}

function open() {
  clearTimeout(idleTimer);
  if (!controller) connect();
}

function close() {
  clearTimeout(retryTimer);
  const ctrl = controller;
  controller = null;
  ctrl?.abort();
  attempt = 0;
  setStatus('down');
}

export const liveEvents = {
  /** Subscribes to one event type; returns the unsubscribe function. */
  subscribe<K extends LiveEventName>(name: K, handler: (data: LiveEvents[K]) => void) {
    let set = handlers.get(name);
    if (!set) handlers.set(name, (set = new Set()));
    set.add(handler as AnyHandler);
    subscribers++;
    open();
    return () => {
      set.delete(handler as AnyHandler);
      if (--subscribers === 0) idleTimer = setTimeout(close, IDLE_CLOSE_MS);
    };
  },
  onStatus(listener: () => void) {
    statusListeners.add(listener);
    return () => statusListeners.delete(listener);
  },
  getStatus: () => status,
  /** Guest pages: also receive live updates for these orders. Returns the stop function. */
  watchOrders(ids: string[]) {
    ids.forEach((id) => watchedOrders.set(id, (watchedOrders.get(id) ?? 0) + 1));
    const changed = () => {
      // Only the guest stream is filtered by order; reconnect it with the new list
      if (getToken() || !controller || guestOrderKey() === connectedOrders) return;
      close();
      open();
    };
    changed();
    return () => {
      ids.forEach((id) => {
        const n = (watchedOrders.get(id) ?? 1) - 1;
        if (n > 0) watchedOrders.set(id, n);
        else watchedOrders.delete(id);
      });
    };
  },
  /** Drop the connection immediately, e.g. on logout. */
  close,
};
