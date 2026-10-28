// Notification sounds synthesised with the Web Audio API, so there are no audio files to ship.
// Browsers only allow audio after the user has interacted with the page; the first click or
// key press anywhere unlocks it, and `soundStore` tells screens whether it is ready.

const PREF_KEY = 'afos_sound';

let ctx: AudioContext | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function getContext() {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  ctx.addEventListener('statechange', notify);
  return ctx;
}

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

let enabled = readPref();

/** Resume audio after a user gesture. Safe to call repeatedly. */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

if (typeof window !== 'undefined') {
  // Try at once: browsers that allow sound for this site (used before, or set to "Allow sound")
  // start right away with no tap. Otherwise the first touch, click or key press anywhere unlocks it.
  unlockAudio();
  const unlock = () => unlockAudio();
  for (const type of ['pointerdown', 'touchstart', 'click', 'keydown']) {
    window.addEventListener(type, unlock, { passive: true, capture: true });
  }
}

export const soundStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** 'off' = muted by staff, 'blocked' = waiting for a click to unlock, 'ready' = will play */
  getSnapshot: (): 'off' | 'blocked' | 'ready' => (!enabled ? 'off' : ctx?.state === 'running' ? 'ready' : 'blocked'),
  setEnabled(on: boolean) {
    enabled = on;
    try {
      localStorage.setItem(PREF_KEY, on ? 'on' : 'off');
    } catch {
      // private mode — the preference just won't persist
    }
    if (on) unlockAudio();
    notify();
  },
};

/** One bell strike: a sine fundamental plus inharmonic partials with a long exponential decay. */
function strike(c: AudioContext, at: number, freq: number, seconds: number, volume: number) {
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(volume, at + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, at + seconds);
  out.connect(c.destination);
  for (const [ratio, amp] of [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.93, 0.1]]) {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * ratio;
    g.gain.value = amp;
    osc.connect(g).connect(out);
    osc.start(at);
    osc.stop(at + seconds);
  }
}

function play(pattern: (c: AudioContext, t: number) => void) {
  if (!enabled) return;
  const c = getContext();
  if (!c) return;
  if (c.state === 'suspended') c.resume().catch(() => {});
  pattern(c, c.currentTime + 0.03);
}

/** Kitchen "order up" bell: a bright two-tone ding-ding. */
export const playOrderBell = () => play((c, t) => {
  strike(c, t, 1046.5, 1.4, 0.4);
  strike(c, t + 0.22, 1318.5, 1.8, 0.35);
});

/** Short soft ping for a new staff chat message. */
export const playChatPing = () => play((c, t) => {
  strike(c, t, 1318.5, 0.5, 0.15);
});

/** Softer descending chime for stock warnings. */
export const playAlertChime = () => play((c, t) => {
  strike(c, t, 784, 0.9, 0.22);
  strike(c, t + 0.2, 587.3, 1.1, 0.22);
});
