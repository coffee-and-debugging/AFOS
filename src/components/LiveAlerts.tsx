import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { api, getAuthUser } from '../api/client';
import { useLiveEvent, useLiveReload, usePolling, useStockAlertPrefs } from '../hooks';
import { isUnread, stockAlertPrefs } from '../lib/alertPrefs';
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
 * item over the line. The bell counts unread alerts; marking them read clears the count.
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
    stockAlertPrefs.markUnread(items.map((i) => i.id));
    const current = stockAlertPrefs.getSnapshot(); // latest choice, even mid-render
    if (!current.popups || items.length === 0) return;
    setPopups((prev) => {
      // A newer alert for the same item replaces the older one
      const fresh = items.map((i) => ({ ...i, key: `${i.id}-${at}` }));
      const rest = prev.filter((p) => !items.some((i) => i.id === p.id));
      return [...fresh, ...rest].slice(0, MAX_POPUPS);
    });
    if (current.sound) playAlertChime();
  });

  // Items back above their reorder level are forgotten, so their next alert starts unread
  useEffect(() => {
    if (low) stockAlertPrefs.keepOnly(low.map((s) => s.id));
  }, [low]);

  const dismiss = useCallback((key: string) => setPopups((prev) => prev.filter((p) => p.key !== key)), []);
  const readPopup = (p: Popup) => {
    stockAlertPrefs.markRead([p]);
    dismiss(p.key);
  };
  const openSettings = () => {
    setView('settings');
    setOpen(true);
  };

  // Turning pop-ups off hides them from the screen right away
  const shown = prefs.popups ? popups : [];

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
  const unread = items.filter((s) => isUnread(prefs, s));
  const count = unread.length;
  const quiet = !prefs.popups;

  return (
    <>
      <div className="alert-bell" ref={panelRef}>
        <button
          className={`btn btn-ghost btn-icon${count ? ' has-alerts' : ''}${quiet ? ' is-quiet' : ''}`}
          onClick={() => { setView('list'); setOpen((o) => !o); }}
          aria-expanded={open}
          aria-label={`${count ? `${count} unread inventory alerts` : 'No unread inventory alerts'}${quiet ? ', pop-ups off' : ''}`}
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
                    {items.length === 0 ? 'Inventory is all good' : [out.length && `${out.length} out`, running.length && `${running.length} running low`, count && `${count} unread`].filter(Boolean).join(' · ')}
                  </div>
                )}
              </div>
              <div className="row" style={{ gap: 'var(--space-1)', flexWrap: 'nowrap' }}>
                {view === 'list' && count > 0 && (
                  <button className="btn btn-ghost btn-sm" onClick={() => stockAlertPrefs.markRead(unread)}>
                    <Icon name="check" size={14} /> Mark all as read
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setView((v) => (v === 'list' ? 'settings' : 'list'))}
                  aria-label={view === 'list' ? 'Notification settings' : 'Back to alerts'}
                  title={view === 'list' ? 'Notification settings' : 'Back to alerts'}
                >
                  <Icon name={view === 'list' ? 'settings' : 'close'} size={16} />
                </button>
              </div>
            </div>

            {view === 'settings' ? (
              <AlertSettings />
            ) : (
              <>
                {quiet && (
                  <button className="alert-panel-notice" onClick={() => setView('settings')}>
                    <Icon name="bellOff" size={14} /> Pop-ups are off on this device. <strong>Turn on</strong>
                  </button>
                )}
                {items.length === 0 ? (
                  <div className="alert-panel-empty">
                    <span className="alert-panel-empty-icon"><Icon name="check" size={20} /></span>
                    Everything is above its reorder level.
                  </div>
                ) : (
                  <div className="alert-panel-body">
                    {out.length > 0 && <AlertGroup title="Out of stock" tone="out" items={out} />}
                    {running.length > 0 && <AlertGroup title="Running low" tone="low" items={running} />}
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
              <span className="stock-popup-icon"><Icon name="alert" size={20} /></span>
              <div className="stock-popup-body">
                <div className="stock-popup-kicker">{p.outOfStock ? 'Out of stock' : 'Low inventory'}</div>
                <div className="stock-popup-title">{p.name}</div>
                <div className="stock-popup-text">
                  <strong>{formatStock(Math.max(p.quantity, 0), p)} left</strong> · reorder at {formatStock(p.reorderLevel, p)}
                </div>
                <div className="stock-popup-actions">
                  {canOpenStock && (
                    <Link to="/inventory" className="btn btn-primary btn-sm" onClick={() => dismiss(p.key)}>View inventory</Link>
                  )}
                  <button className="btn btn-secondary btn-sm" onClick={() => readPopup(p)}>
                    <Icon name="check" size={14} /> Mark as read
                  </button>
                </div>
              </div>
              <button className="stock-popup-close" onClick={() => dismiss(p.key)} aria-label={`Dismiss alert for ${p.name}`}>
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AlertGroup({ title, tone, items }: { title: string; tone: 'out' | 'low'; items: StockItem[] }) {
  const prefs = useStockAlertPrefs();
  return (
    <section className={`alert-group is-${tone}`}>
      <div className="alert-group-title"><span className="alert-group-dot" />{title} <span className="alert-group-count">{items.length}</span></div>
      <ul className="alert-items">
        {items.map((s) => {
          const unread = isUnread(prefs, s);
          // Bar = how full the item is relative to its reorder level (full bar = at the reorder level)
          const level = s.reorderLevel > 0 ? Math.max(0, Math.min(1, s.quantity / s.reorderLevel)) : 0;
          return (
            <li key={s.id} className={`alert-item${unread ? ' is-unread' : ' is-read'}`}>
              <div className="alert-item-main">
                <div className="alert-item-name">
                  {unread && <span className="alert-item-dot" aria-label="Unread" />}
                  {s.name}
                </div>
                <div className="alert-item-meta">
                  {s.quantity <= 0 ? 'None left' : `${formatStock(s.quantity, s)} left`} · reorder at {formatStock(s.reorderLevel, s)}
                </div>
                <div className="alert-item-bar" aria-hidden="true"><span style={{ width: `${Math.max(level * 100, s.quantity > 0 ? 6 : 0)}%` }} /></div>
              </div>
              {unread && (
                <button
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => stockAlertPrefs.markRead([s])}
                  aria-label={`Mark ${s.name} as read`}
                  title="Mark as read"
                >
                  <Icon name="check" size={15} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function AlertSettings() {
  const prefs = useStockAlertPrefs();
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
