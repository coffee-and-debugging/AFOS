import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, getAuthUser } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { guestBaseUrl } from '../../lib/network';
import { timeSince } from '../../lib/format';
import type { Table } from '../../types';

interface QRInfo {
  qrCode: string;
  url: string;
  tableNumber: number;
  /** False when no reachable address exists (QR would point at localhost) */
  found: boolean;
}

export default function TablesManagement() {
  const { money, restaurant } = useRestaurant();
  const toast = useToast();
  const isAdmin = getAuthUser()?.role === 'admin';
  const { data: tables, error, loading, retry, reload } = usePolling(api.tables.getAll, 10_000);
  const [newNumber, setNewNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [qr, setQr] = useState<QRInfo | null>(null);
  const [qrLoading, setQrLoading] = useState<string | null>(null);

  if (loading && !tables) return <LoadingState label="Loading tables…" />;
  if (!tables) return <ErrorState error={error} onRetry={retry} />;

  async function add(e: FormEvent) {
    e.preventDefault();
    setAdding(true);
    try {
      await api.tables.create(Number(newNumber));
      setNewNumber('');
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAdding(false);
    }
  }

  async function remove(table: Table) {
    if (!confirm(`Remove table ${table.number}? Printed QR codes for it will stop working.`)) return;
    try {
      await api.tables.delete(table.id);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function showQR(table: Table) {
    setQrLoading(table.id);
    try {
      // Manual address from Settings if saved, otherwise this PC's current Wi-Fi address
      const base = await guestBaseUrl(restaurant);
      setQr({ ...(await api.tables.getQR(table.id, base.url)), found: base.found });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setQrLoading(null);
    }
  }

  function downloadQR() {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr.qrCode;
    a.download = `table-${qr.tableNumber}-qr.png`;
    a.click();
  }

  const occupied = tables.filter((t) => t.openOrders > 0);

  return (
    <>
      <PageHeader
        icon="qr"
        title="Tables & QR"
        subtitle="Live floor status. Take orders, settle bills, or print a table's QR code for guests."
        actions={isAdmin && (
          <form className="inline-form" onSubmit={add}>
            <label className="field" style={{ minWidth: 120 }}>
              <span className="visually-hidden">New table number</span>
              <input type="number" min="1" className="input" value={newNumber} onChange={(e) => setNewNumber(e.target.value)} placeholder="Table no." required />
            </label>
            <button type="submit" className="btn btn-primary" disabled={adding}><Icon name="plus" size={16} /> Add table</button>
          </form>
        )}
      />

      <div className="stats-grid">
        <Stat label="Tables" value={tables.length} tone="primary" />
        <Stat label="Occupied" value={occupied.length} tone="warning" />
        <Stat label="Free" value={tables.length - occupied.length} tone="success" />
        <Stat label="Open bills" value={money(occupied.reduce((s, t) => s + t.openAmount, 0))} tone="accent" />
      </div>

      {tables.length === 0 ? (
        <div className="card"><EmptyState icon="tables" title="No tables yet" text="Add your first table to start taking dine-in orders." /></div>
      ) : (
        <div className="floor">
          {tables.map((t) => {
            const busy = t.openOrders > 0;
            return (
              <article key={t.id} className={`table-card${busy ? ' is-occupied' : ''}`}>
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div className="table-number"><small>TABLE</small>{t.number}</div>
                  <span className={`badge badge-${busy ? 'occupied' : 'free'}`}>{busy ? 'Occupied' : 'Free'}</span>
                </div>
                {/* Always two single lines, so free and occupied cards keep the same height */}
                <div className="table-status">
                  <strong>{busy ? `${money(t.openAmount)} open` : 'Ready for guests'}</strong>
                  <span>
                    {busy
                      ? `${t.openOrders} order${t.openOrders > 1 ? 's' : ''}${t.occupiedSince ? ` · ${timeSince(t.occupiedSince)}` : ''}`
                      : 'No open bill'}
                  </span>
                </div>
                <div className={`table-actions${isAdmin ? ' has-admin' : ''}`}>
                  <Link to={`/pos?table=${t.id}`} className="btn btn-primary btn-sm"><Icon name="plus" size={14} /> Order</Link>
                  {busy
                    ? <Link to={`/pos?bill=${t.id}`} className="btn btn-accent btn-sm"><Icon name="cash" size={14} /> Bill</Link>
                    : <button className="btn btn-accent btn-sm" disabled title="No open bill"><Icon name="cash" size={14} /> Bill</button>}
                  {isAdmin && (
                    <>
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => showQR(t)} disabled={qrLoading === t.id} aria-label={`QR code for table ${t.number}`}><Icon name="qr" size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(t)} aria-label={`Remove table ${t.number}`}><Icon name="trash" size={14} /></button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {qr && (
        <Modal
          title={`Table ${qr.tableNumber} QR`}
          onClose={() => setQr(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => window.print()}><Icon name="print" size={16} /> Print</button>
            <button className="btn btn-primary" onClick={downloadQR}><Icon name="download" size={16} /> Download PNG</button>
          </>}
        >
          <div className="print-area" style={{ textAlign: 'center' }}>
            <div className="qr-brand">{restaurant.name}</div>
            {restaurant.tagline && <div className="subtle" style={{ marginBottom: 'var(--space-2)' }}>{restaurant.tagline}</div>}
            <div className="hero-kicker" style={{ color: 'var(--color-primary)' }}>Scan to order</div>
            <div className="table-number" style={{ marginBottom: 'var(--space-3)' }}><small>TABLE</small>{qr.tableNumber}</div>
            <img src={qr.qrCode} alt={`QR code for table ${qr.tableNumber}`} className="qr-image" />
            <p className="qr-url">{qr.url}</p>
          </div>
          {/* Only shown when the code can't work: no Wi-Fi address and no manual address */}
          {!qr.found && (
            <p className="alert alert-error" style={{ marginTop: 'var(--space-4)', marginBottom: 0 }}>
              No Wi-Fi address was found, so this code points at localhost and won't open on phones.
              Connect this PC to Wi-Fi or set a manual address in <Link to="/settings">Settings</Link>.
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
