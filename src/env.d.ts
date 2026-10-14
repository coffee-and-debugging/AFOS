/// <reference types="vite/client" />

/** Injected by vite.config.ts from package.json */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Public origin of the API, e.g. https://afos-api.onrender.com. Empty = same origin. */
  readonly VITE_API_URL?: string;
  /** Where "Contact sales" / "Upgrade" emails go on the Feature locked page */
  readonly VITE_SALES_EMAIL?: string;
  /** Optional checkout/pricing page; when set, "Upgrade" opens it instead of an email */
  readonly VITE_UPGRADE_URL?: string;
}
