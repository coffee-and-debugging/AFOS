import { useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useToast } from '../../hooks';
import { billLabel, orderPlace, PAYMENT_LABEL, STATUS_LABEL, timeSince } from '../../lib/format';
import type { Order, OrderStatus } from '../../types';

const REFRESH_MS = 5000;

// Tickets from the last two days; older unfinished orders are almost always stale.
const loadKitchen = async () => {
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  from.setDate(from.getDate() - 1);
  const orders = await api.orders.list({ from: from.toISOString(), limit: 1000 });
  return orders.filter((o) => o.status !== 'cancelled');
};
const FLOW: OrderStatus[] = ['pending', 'cooking', 'serving'];
const NEXT: Partial<Record<OrderStatus, { status: OrderStatus; label: string }>> = {
  pending: { status: 'cooking', label: 'Start cooking' },
  cooking: { status: 'serving', label: 'Ready to serve' },
  serving: { status: 'completed', label: 'Mark served' },
};

type Filter = 'active' | 'serving' | 'completed' | 'all';
const FILTERS: { key: Filter; label: string; match: (o: Order) => boolean }[] = [
  { key: 'active', label: 'In progress', match: (o) => o.status === 'pending' || o.status === 'cooking' },
  { key: 'serving', label: 'Ready', match: (o) => o.status === 'serving' },
  { key: 'completed', label: 'Completed', match: (o) => o.status === 'completed' },
  { key: 'all', label: 'All', match: () => true },
];

export default function KitchenDisplay() {
  const toast = useToast();
  const { data: orders, error, loading, retry, setData } = usePolling(loadKitchen, REFRESH_MS);
  const [filter, setFilter] = useState<Filter>('active');
  const [busyId, setBusyId] = useState<string | null>(null);

  if (loading && !orders) return <LoadingState label="Loading kitchen…" />;
  if (!orders) return <ErrorState error={error} onRetry={retry} />;

  async function advance(order: Order) {
    const next = NEXT[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      const updated = await api.orders.updateStatus(order.id, next.status);
      setData((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const active = FILTERS.find((f) => f.key === filter)!;
  // Oldest first, so the ticket that has waited longest is always top-left
  const visible = orders.filter(active.match).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <>
      <PageHeader icon="kitchen" title="Kitchen Display" subtitle="Tickets update automatically as guests order" />

      <div className="toolbar">
        <div className="segmented" role="tablist">
          {FILTERS.map((f) => (
            <button key={f.key} role="tab" aria-selected={filter === f.key} className="segmented-item" onClick={() => setFilter(f.key)}>
              {f.label} <span className="segmented-count">{orders.filter(f.match).length}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon="kitchen"
          title={filter === 'active' ? 'Kitchen is clear!' : 'Nothing here'}
          text={filter === 'active' ? 'No pending orders at the moment.' : 'No orders match this view.'}
        >
          <p className="state-note">Auto-refreshing every {REFRESH_MS / 1000} seconds</p>
        </EmptyState>
      ) : (
        <div className="ticket-grid">
          {visible.map((order) => (
            <Ticket key={order.id} order={order} busy={busyId === order.id} onAdvance={() => advance(order)} />
          ))}
        </div>
      )}
    </>
  );
}

function Ticket({ order, busy, onAdvance }: { order: Order; busy: boolean; onAdvance: () => void }) {
  const next = NEXT[order.status];
  const step = FLOW.indexOf(order.status);

  return (
    <article className={`ticket ticket-${order.status}`}>
      <div className="ticket-head">
        <div>
          <div className="ticket-table">{orderPlace(order)}</div>
          <div className="ticket-meta">{billLabel(order)} · {timeSince(order.createdAt)}{order.source === 'qr' ? ' · QR order' : ''}</div>
        </div>
        <span className={`badge badge-${order.status}`}>{STATUS_LABEL[order.status]}</span>
      </div>

      <ul className="ticket-items">
        {order.items.map((item, i) => (
          <li key={i}><span>{item.name}</span><span className="ticket-qty">× {item.quantity}</span></li>
        ))}
      </ul>

      {order.customerNote && <p className="ticket-note">Note: {order.customerNote}</p>}

      {next ? (
        <>
          <div className="ticket-progress" aria-hidden="true">
            {FLOW.map((s, i) => (
              <span key={s} className="row" style={{ gap: 'var(--space-1)' }}>
                <span className={`ticket-dot${i <= step ? ' is-on' : ''}`} />
                {i < FLOW.length - 1 && <span className={`ticket-bar${i < step ? ' is-on' : ''}`} />}
              </span>
            ))}
          </div>
          <button className="btn btn-primary btn-block" onClick={onAdvance} disabled={busy}>
            {busy ? 'Updating…' : next.label}
          </button>
        </>
      ) : (
        <div className="ticket-done">
          Served
          {order.paymentStatus === 'paid' && ` · Paid (${order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] : '—'})`}
          {order.paymentStatus === 'pending_counter' && ' · Pay at counter'}
          {order.paymentStatus === 'unpaid' && ' · Unpaid'}
        </div>
      )}
    </article>
  );
}
