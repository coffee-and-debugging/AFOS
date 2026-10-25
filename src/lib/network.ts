import { useEffect, useState } from 'react';
import type { Restaurant } from '../types';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export const isLocalhost = (hostname = window.location.hostname) => LOCAL_HOSTS.has(hostname);

const toOrigin = (ip: string) => {
  const { protocol, port } = window.location;
  return `${protocol}//${ip}${port ? `:${port}` : ''}`;
};

/**
 * This PC's Wi-Fi address as a web address, e.g. http://192.168.100.20:5173. Asked fresh from the
 * web server each time, so it follows the current Wi-Fi address; falls back to the address seen
 * when the server started. Null when the PC has no network address.
 */
export async function detectLanOrigin(): Promise<string | null> {
  try {
    const res = await fetch('/__afos/lan', { cache: 'no-store' });
    if (res.ok) {
      const ips = (await res.json()) as string[];
      if (Array.isArray(ips)) return ips[0] ? toOrigin(ips[0]) : null;
    }
  } catch {
    // not served by the dev/preview server: use the start-up value
  }
  return __LAN_ADDRESSES__[0] ? toOrigin(__LAN_ADDRESSES__[0]) : null;
}

/** The automatic address: the Wi-Fi address, or the address staff are browsing on when it isn't localhost. */
export async function automaticGuestBaseUrl(): Promise<string | null> {
  if (!isLocalhost()) return window.location.origin;
  return detectLanOrigin();
}

/**
 * Address printed in table QR codes: the manual address from Settings when one is saved
 * (never changed automatically), otherwise the automatic Wi-Fi address.
 */
export async function guestBaseUrl(restaurant: Pick<Restaurant, 'qrBaseUrl'>): Promise<{ url: string; found: boolean }> {
  if (restaurant.qrBaseUrl) return { url: restaurant.qrBaseUrl, found: true };
  const auto = await automaticGuestBaseUrl();
  return auto ? { url: auto, found: true } : { url: window.location.origin, found: false };
}

/** The automatic address, refreshed while the component is on screen. */
export function useAutomaticGuestBaseUrl(refreshMs = 15_000) {
  const [url, setUrl] = useState<string | null | undefined>(undefined); // undefined = still detecting
  useEffect(() => {
    let alive = true;
    const load = () => automaticGuestBaseUrl().then((u) => { if (alive) setUrl(u); });
    load();
    const id = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(id); };
  }, [refreshMs]);
  return url;
}

/** Normalises what an admin types: "192.168.1.5:5173/" → "http://192.168.1.5:5173". Null if invalid. */
export function normalizeBaseUrl(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `http://${value}`);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.origin : null;
  } catch {
    return null;
  }
}

export const tableUrl = (base: string, tableId: string) => `${base}/table/${tableId}/`;
