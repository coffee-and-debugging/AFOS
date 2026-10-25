// Low-stock notification preferences for this device (browser), e.g. the kitchen tablet can stay
// quiet while the manager's laptop keeps pop-ups on. The bell list always shows everything low.

export interface StockAlertPrefs {
  /** Show a pop-up when an item drops to or below its reorder level */
  popups: boolean;
  /** Play the chime with it */
  sound: boolean;
  /** Stock item ids that never pop up */
  muted: number[];
}

const KEY = 'afos_stock_alert_prefs';
const DEFAULTS: StockAlertPrefs = { popups: true, sound: true, muted: [] };

function read(): StockAlertPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    return {
      popups: typeof saved.popups === 'boolean' ? saved.popups : DEFAULTS.popups,
      sound: typeof saved.sound === 'boolean' ? saved.sound : DEFAULTS.sound,
      muted: Array.isArray(saved.muted) ? saved.muted.filter((n: unknown) => Number.isInteger(n)) : [],
    };
  } catch {
    return DEFAULTS;
  }
}

let prefs = read();
const listeners = new Set<() => void>();

function save(next: StockAlertPrefs) {
  prefs = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // private mode: the choice lasts until the page reloads
  }
  listeners.forEach((l) => l());
}

export const stockAlertPrefs = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => prefs,
  set: (patch: Partial<StockAlertPrefs>) => save({ ...prefs, ...patch }),
  mute: (id: number) => save({ ...prefs, muted: prefs.muted.includes(id) ? prefs.muted : [...prefs.muted, id] }),
  unmute: (id: number) => save({ ...prefs, muted: prefs.muted.filter((m) => m !== id) }),
  isMuted: (id: number) => prefs.muted.includes(id),
};
