// "Hide amounts" preference: per viewer, remembered in this browser, synced across open tabs.
const KEY = 'afos_hide_amounts';
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false; // storage blocked (private mode etc.) → amounts visible
  }
}

let hidden = read();

export const amountMaskStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) { hidden = read(); listener(); }
    };
    window.addEventListener('storage', onStorage);
    return () => { listeners.delete(listener); window.removeEventListener('storage', onStorage); };
  },
  getSnapshot: () => hidden,
  set(next: boolean) {
    hidden = next;
    try { localStorage.setItem(KEY, next ? '1' : '0'); } catch { /* still works for this session */ }
    listeners.forEach((l) => l());
  },
};

export const MASK = '••••••';
