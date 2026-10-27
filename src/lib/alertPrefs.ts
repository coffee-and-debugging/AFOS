// Low-stock notification preferences for this device (browser), e.g. the kitchen tablet can stay
// quiet while the manager's laptop keeps pop-ups on. Read state is also kept per device.

export interface StockAlertPrefs {
  /** Show a pop-up when an item drops to or below its reorder level */
  popups: boolean;
  /** Play the chime with it */
  sound: boolean;
  /** Inventory item id → quantity when its alert was marked as read */
  read: Record<string, number>;
}

const KEY = 'afos_stock_alert_prefs';
const DEFAULTS: StockAlertPrefs = { popups: true, sound: true, read: {} };

function read(): StockAlertPrefs {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
    const readMap = saved.read && typeof saved.read === 'object' ? saved.read : {};
    return {
      popups: typeof saved.popups === 'boolean' ? saved.popups : DEFAULTS.popups,
      sound: typeof saved.sound === 'boolean' ? saved.sound : DEFAULTS.sound,
      read: Object.fromEntries(Object.entries(readMap).filter(([, q]) => typeof q === 'number')) as Record<string, number>,
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
  set: (patch: Partial<Omit<StockAlertPrefs, 'read'>>) => save({ ...prefs, ...patch }),
  /** Marks these alerts read at their current quantity */
  markRead: (items: { id: number; quantity: number }[]) => {
    const next = { ...prefs.read };
    items.forEach((i) => { next[i.id] = i.quantity; });
    save({ ...prefs, read: next });
  },
  /** A fresh alert for the item (it just crossed its reorder level again) */
  markUnread: (ids: number[]) => {
    if (!ids.some((id) => id in prefs.read)) return;
    const next = { ...prefs.read };
    ids.forEach((id) => delete next[id]);
    save({ ...prefs, read: next });
  },
  /** Forgets items that are no longer low, so their next alert starts unread */
  keepOnly: (ids: number[]) => {
    const keep = Object.keys(prefs.read).filter((id) => ids.includes(Number(id)));
    if (keep.length === Object.keys(prefs.read).length) return;
    save({ ...prefs, read: Object.fromEntries(keep.map((id) => [id, prefs.read[id]])) });
  },
};

/** Unread until marked read; becomes unread again if the item has dropped further since. */
export const isUnread = (p: StockAlertPrefs, item: { id: number; quantity: number }) =>
  !(item.id in p.read) || item.quantity < p.read[item.id] - 1e-9;
