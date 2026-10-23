import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from './Icon';
import { api, getAuthUser } from '../api/client';
import { useLiveEvent, useLiveReload, usePolling } from '../hooks';
import { formatStock } from '../lib/format';
import { playAlertChime } from '../lib/sound';
import type { LowStockAlert, StockItem } from '../types';

const MAX_POPUPS = 4;

interface Popup extends LowStockAlert {
  key: string;
}

/**
 * Low-stock awareness for the front of house: a topbar bell listing everything at or below
 * its reorder level, plus a popup (with a chime) the moment a sale or adjustment pushes an
 * item over the line. Popups stay until dismissed so they are not missed during a rush.
 */
export default function LiveAlerts() {
  const role = getAuthUser()?.role;
  const canOpenStock = role === 'admin' || role === 'chef';
  const { data: low, reload } = usePolling(api.stock.low, 120_000);
  const [popups, setPopups] = useState<Popup[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useLiveReload(reload, ['stock.low']);
  useLiveEvent('stock.low', ({ items, at }) => {
    setPopups((prev) => {
      // A newer alert for the same item replaces the older one
      const fresh = items.map((i) => ({ ...i, key: `${i.id}-${at}` }));
      const rest = prev.filter((p) => !items.some((i) => i.id === p.id));
      return [...fresh, ...rest].slice(0, MAX_POPUPS);
    });
    playAlertChime();
  });

  const dismiss = useCallback((key: string) => setPopups((prev) => prev.filter((p) => p.key !== key)), []);

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

  const count = low?.length ?? 0;

  return (
    <>
      <div className="alert-bell" ref={panelRef}>
        <button
          className={`btn btn-ghost btn-icon${count ? ' has-alerts' : ''}`}
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={count ? `${count} items low on stock` : 'No stock alerts'}
          title="Stock alerts"
        >
          <Icon name="bell" size={18} />
          {count > 0 && <span className="alert-bell-count">{count > 99 ? '99+' : count}</span>}
        </button>
        {open && (
          <div className="alert-panel" role="dialog" aria-label="Low stock">
            <div className="alert-panel-head">
              <strong>Low stock</strong>
              {canOpenStock && <Link to="/stock" className="subtle" onClick={() => setOpen(false)}>Open stock →</Link>}
            </div>
            {count === 0 ? (
              <p className="subtle" style={{ padding: 'var(--space-3)' }}>Everything is above its reorder level.</p>
            ) : (
              <ul className="line-items alert-panel-list">
                {low!.map((s: StockItem) => (
                  <li key={s.id}>
                    <span><Icon name="alert" size={14} /> {s.name}</span>
                    <span className={`nowrap${s.quantity <= 0 ? ' danger-text' : ''}`}>
                      {s.quantity <= 0 ? 'Out' : formatStock(s.quantity, s)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {popups.length > 0 && (
        <div className="stock-popups" role="alert" aria-live="assertive">
          {popups.map((p) => (
            <div key={p.key} className={`stock-popup${p.outOfStock ? ' is-out' : ''}`}>
              <span className="stock-popup-icon"><Icon name="alert" size={20} /></span>
              <div className="stock-popup-body">
                <div className="stock-popup-title">{p.outOfStock ? 'Out of stock' : 'Low stock'}: {p.name}</div>
                <div className="stock-popup-text">
                  {formatStock(Math.max(p.quantity, 0), p)} left · reorder at {formatStock(p.reorderLevel, p)}
                </div>
                {canOpenStock && (
                  <Link to="/stock" className="stock-popup-link" onClick={() => dismiss(p.key)}>View stock</Link>
                )}
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => dismiss(p.key)} aria-label="Dismiss">
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
