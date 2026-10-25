/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json */
declare const __APP_VERSION__: string;
/** This PC's IPv4 addresses on the local network, best first (from vite.config.ts) */
declare const __LAN_ADDRESSES__: string[];

interface ImportMetaEnv {
  /** Public origin of the API, e.g. https://afos-api.onrender.com. Empty = same origin. */
  readonly VITE_API_URL?: string;
}
