import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { api, getAuthUser } from '../api/client';
import { useLiveEvent, useLiveReload, usePolling, useStockAlertPrefs } from '../hooks';
import { stockAlertPrefs } from '../lib/alertPrefs';
import { formatStock } from '../lib/format';
import { playAlertChime } from '../lib/sound';
import type { LowStockAlert, StockItem } from '../types';

const MAX_POPUPS = 4;

interface Popup extends LowStockAlert {
  key: string;
}

/**
 * Low-stock awareness for the front of house: a topbar bell listing everything at or below
 * its reorder level, plus a pop-up (with a chime) the moment a sale or adjustment pushes an
 * item over the line. Pop-ups, sound and individual items can be switched off per device.
 */
export default function LiveAlerts() {
  const role = getAuthUser()?.role;
  const canOpenStock = role === 'admin' || role === 'chef';
  const prefs = useStockAlertPrefs();
  const { data: low, reload } = usePolling(api.stock.low, 120_000);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'list' | 'settings'>('list');
  const panelRef = useRef<HTMLDivElement>(null);

  useLiveReload(reload, ['stock.low']);
  useLiveEvent('stock.low', ({ items, at }) => {
    const current = stockAlertPrefs.getSnapshot(); // latest choice, even mid-render
    const wanted = items.filter((i) => !current.muted.includes(i.id));
    if (!current.popups || wanted.length === 0) return;
    setPopups((prev) => {
      // A newer alert for the same item replaces the older one
      const fresh = wanted.map((i) => ({ ...i, key: `${i.id}-${at}` }));
      const rest = prev.filter((p) => !wanted.some((i) => i.id === p.id));
      return [...fresh, ...rest].slice(0, MAX_POPUPS);
    });
    if (current.sound) playAlertChime();
  });

  const dismiss = useCallback((key: string) => setPopups((prev) => prev.filter((p) => p.key !== key)), []);
  const muteItem = useCallback((id: number) => stockAlertPrefs.mute(id), []);
  const openSettings = () => {
    setView('settings');
    setOpen(true);
  };

  // Turning pop-ups off, or muting an item from the bell, hides them from the screen right away
  const shown = prefs.popups ? popups.filter((p) => !prefs.muted.includes(p.id)) : [];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = low ?? [];
  const out = items.filter((s) => s.quantity <= 0);
  const running = items.filter((s) => s.quantity > 0);
  const count = items.length;
  const quiet = !prefs.popups;

  return (
    <>
      <div className="alert-bell" ref={panelRef}>
        <button
          className={`btn btn-ghost btn-icon${count ? ' has-alerts' : ''}${quiet ? ' is-quiet' : ''}`}
          onClick={() => { setView('list'); setOpen((o) => !o); }}
          aria-expanded={open}
          aria-label={`${count ? `${count} items low in inventory` : 'No inventory alerts'}${quiet ? ', pop-ups off' : ''}`}
          title={quiet ? 'Inventory alerts (pop-ups off)' : 'Inventory alerts'}
        >
          <Icon name={quiet ? 'bellOff' : 'bell'} size={18} />
          {count > 0 && <span className="alert-bell-count">{count > 99 ? '99+' : count}</span>}
        </button>

        {open && (
          <div className="alert-panel" role="dialog" aria-label="Inventory alerts">
            <div className="alert-panel-head">
              <div>
                <div className="alert-panel-title">{view === 'settings' ? 'Notification settings' : 'Inventory alerts'}</div>
                {view === 'list' && (
                  <div className="alert-panel-sub">
                    {count === 0 ? 'Inventory is all good' : [out.length && `${out.length} out`, running.length && `${running.length} running low`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setView((v) => (v === 'list' ? 'settings' : 'list'))}
                aria-label={view === 'list' ? 'Notification settings' : 'Back to alerts'}
                title={view === 'list' ? 'Notification settings' : 'Back to alerts'}
              >
                <Icon name={view === 'list' ? 'settings' : 'close'} size={16} />
              </button>
            </div>

            {view === 'settings' ? (
              <AlertSettings items={items} />
            ) : (
              <>
                {quiet && (
                  <button className="alert-panel-notice" onClick={() => setView('settings')}>
                    <Icon name="bellOff" size={14} /> Pop-ups are off on this device. <strong>Turn on</strong>
                  </button>
                )}
                {count === 0 ? (
                  <div className="alert-panel-empty">
                    <span className="alert-panel-empty-icon"><Icon name="check" size={20} /></span>
                    Everything is above its reorder level.
                  </div>
                ) : (
                  <div className="alert-panel-body">
                    {out.length > 0 && <AlertGroup title="Out of stock" tone="out" items={out} muted={prefs.muted} />}
                    {running.length > 0 && <AlertGroup title="Running low" tone="low" items={running} muted={prefs.muted} />}
                  </div>
                )}
                {canOpenStock && (
                  <Link to="/inventory" className="alert-panel-foot" onClick={() => setOpen(false)}>
                    Open inventory <Icon name="external" size={14} />
                  </Link>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {shown.length > 0 && (
        <div className="stock-popups" role="alert" aria-live="assertive">
          <div className="stock-popups-head">
            <span><Icon name="bell" size={16} /> {shown.length === 1 ? 'Inventory alert' : `${shown.length} inventory alerts`}</span>
            <span className="row" style={{ gap: 'var(--space-1)' }}>
              <button className="stock-popups-clear" onClick={openSettings} title="Notification settings">
                <Icon name="settings" size={13} /> Settings
              </button>
              {shown.length > 1 && <button className="stock-popups-clear" onClick={() => setPopups([])}>Dismiss all</button>}
            </span>
          </div>
          {shown.map((p) => (
            <div key={p.key} className={`stock-popup${p.outOfStock ? ' is-out' : ''}`}>
              <span className="stock-popup-icon"><Icon name="alert" size={24} /></span>
              <div className="stock-popup-body">
                <div className="stock-popup-kicker">{p.outOfStock ? 'Out of stock' : 'Low inventory'}</div>
                <div className="stock-popup-title">{p.name}</div>
                <div className="stock-popup-text">
                  <strong>{formatStock(Math.max(p.quantity, 0), p)} left</strong> · reorder at {formatStock(p.reorderLevel, p)}
                </div>
                <div className="stock-popup-actions">
                  {canOpenStock && (
                    <Link to="/inventory" className="stock-popup-link" onClick={() => dismiss(p.key)}>View inventory →</Link>
                  )}
                  <button className="stock-popup-mute" onClick={() => muteItem(p.id)} title={`Stop pop-ups for ${p.name} on this device`}>
                    <Icon name="bellOff" size={13} /> Mute item
                  </button>
                </div>
              </div>
              <button className="stock-popup-close" onClick={() => dismiss(p.key)} aria-label={`Dismiss alert for ${p.name}`}>
                <Icon name="close" size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AlertGroup({ title, tone, items, muted }: { title: string; tone: 'out' | 'low'; items: StockItem[]; muted: number[] }) {
  return (
    <section className={`alert-group is-${tone}`}>
      <div className="alert-group-title"><span className="alert-group-dot" />{title} <span className="alert-group-count">{items.length}</span></div>
      <ul className="alert-items">
        {items.map((s) => {
          const isMuted = muted.includes(s.id);
          // Bar = how full the item is relative to its reorder level (full bar = at the reorder level)
          const level = s.reorderLevel > 0 ? Math.max(0, Math.min(1, s.quantity / s.reorderLevel)) : 0;
          return (
            <li key={s.id} className={`alert-item${isMuted ? ' is-muted' : ''}`}>
              <div className="alert-item-main">
                <div className="alert-item-name">
                  {s.name}
                  {isMuted && <span className="alert-item-tag"><Icon name="bellOff" size={11} /> muted</span>}
                </div>
                <div className="alert-item-meta">
                  {s.quantity <= 0 ? 'None left' : `${formatStock(s.quantity, s)} left`} · reorder at {formatStock(s.reorderLevel, s)}
                </div>
                <div className="alert-item-bar" aria-hidden="true"><span style={{ width: `${Math.max(level * 100, s.quantity > 0 ? 6 : 0)}%` }} /></div>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => (isMuted ? stockAlertPrefs.unmute(s.id) : stockAlertPrefs.mute(s.id))}
                aria-label={isMuted ? `Unmute ${s.name}` : `Mute pop-ups for ${s.name}`}
                title={isMuted ? 'Unmute: show pop-ups for this item again' : 'Mute: no pop-ups for this item on this device'}
              >
                <Icon name={isMuted ? 'bell' : 'bellOff'} size={15} />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AlertSettings({ items }: { items: StockItem[] }) {
  const prefs = useStockAlertPrefs();
  // Muted items that are currently low are named; others are counted (the bell only knows low items)
  const mutedLow = items.filter((s) => prefs.muted.includes(s.id));
  const mutedOther = prefs.muted.length - mutedLow.length;

  return (
    <div className="alert-settings">
      <Toggle
        label="Pop-up alerts"
        checked={prefs.popups}
        onChange={(popups) => stockAlertPrefs.set({ popups })}
      />
      <Toggle
        label="Alert sound"
        checked={prefs.sound}
        disabled={!prefs.popups}
        onChange={(sound) => stockAlertPrefs.set({ sound })}
      />

      <div className="alert-settings-muted">
        <div className="alert-group-title">Muted items <span className="alert-group-count">{prefs.muted.length}</span></div>
        {prefs.muted.length === 0 ? (
          <p className="alert-settings-empty">
            No muted items.
          </p>
        ) : (
          <>
            <ul className="alert-items">
              {mutedLow.map((s) => (
                <li key={s.id} className="alert-item">
                  <div className="alert-item-main"><div className="alert-item-name">{s.name}</div></div>
                  <button className="btn btn-secondary btn-sm" onClick={() => stockAlertPrefs.unmute(s.id)}>Unmute</button>
                </li>
              ))}
            </ul>
            {mutedOther > 0 && <p className="alert-settings-empty">{mutedOther} more muted item{mutedOther === 1 ? '' : 's'} not currently low.</p>}
            <button className="link-button alert-settings-unmute" onClick={() => stockAlertPrefs.set({ muted: [] })}>Unmute all</button>
          </>
        )}
      </div>

    </div>
  );
}

function Toggle({ label, checked, disabled, onChange }: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className={`toggle-row${disabled ? ' is-disabled' : ''}`}>
      <span className="toggle-label">{label}</span>
      <input type="checkbox" role="switch" className="toggle" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
