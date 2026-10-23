import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLiveEvent, useLiveReload, useLiveStatus, usePolling, useSound, useToast } from '../../hooks';
import { billLabel, orderPlace, PAYMENT_LABEL, STATUS_LABEL, timeSince } from '../../lib/format';
import { playOrderBell, soundStore, unlockAudio } from '../../lib/sound';
import type { Order, OrderStatus } from '../../types';

// New orders arrive instantly over the live connection; polling is only the safety net.
const REFRESH_MS = 20_000;
const REPEAT_BELL_MS = 20_000; // keep ringing until someone acknowledges the new ticket

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
  const sound = useSound();
  const live = useLiveStatus();
  const [filter, setFilter] = useState<Filter>('active');
  const [busyId, setBusyId] = useState<string | null>(null);
  // New tickets waiting for a cook to acknowledge them (drives the popup and the bell)
  const [incoming, setIncoming] = useState<Order[]>([]);

  // Orders already on screen; anything new that turns up, live or via polling, is announced.
  // The first load only fills this in, so opening the screen doesn't ring for old tickets.
  const known = useRef<Set<string> | null>(null);
  const announce = useCallback((list: Order[]) => {
    if (!known.current) {
      known.current = new Set(list.map((o) => o.id));
      return;
    }
    const seen = known.current;
    const fresh = list.filter((o) => !seen.has(o.id));
    fresh.forEach((o) => seen.add(o.id));
    const newTickets = fresh.filter((o) => o.status === 'pending');
    if (!newTickets.length) return;
    setIncoming((prev) => [...prev, ...newTickets]);
    playOrderBell();
  }, []);

  const load = useCallback(async () => {
    const list = await loadKitchen();
    announce(list);
    return list;
  }, [announce]);
  const { data: orders, error, loading, retry, reload, setData } = usePolling(load, REFRESH_MS);

  useLiveEvent('order.created', (order) => {
    if (order.status === 'cancelled') return;
    setData((prev) => (prev.some((o) => o.id === order.id) ? prev : [...prev, order]));
    announce([order]);
  });
  useLiveEvent('order.updated', (order) => {
    setData((prev) => {
      if (!prev.some((o) => o.id === order.id)) return prev;
      if (order.status === 'cancelled') return prev.filter((o) => o.id !== order.id);
      return prev.map((o) => (o.id === order.id ? order : o));
    });
    // Another screen started it or it was cancelled, so stop alerting for it
    if (order.status !== 'pending') setIncoming((prev) => prev.filter((o) => o.id !== order.id));
  });
  useLiveReload(reload, []); // refetch after the live connection recovers

  // Re-ring while tickets sit unacknowledged, so a busy kitchen can't miss them
  const waiting = incoming.length > 0;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(playOrderBell, REPEAT_BELL_MS);
    return () => clearInterval(id);
  }, [waiting]);

  if (loading && !orders) return <LoadingState label="Loading kitchen…" />;
  if (!orders) return <ErrorState error={error} onRetry={retry} />;

  async function advance(order: Order) {
    const next = NEXT[order.status];
    if (!next) return;
    setBusyId(order.id);
    try {
      const updated = await api.orders.updateStatus(order.id, next.status);
      setData((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
      setIncoming((prev) => prev.filter((o) => o.id !== order.id));
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const acknowledge = (id: string) => setIncoming((prev) => prev.filter((o) => o.id !== id));
  const newIds = new Set(incoming.map((o) => o.id));

  const active = FILTERS.find((f) => f.key === filter)!;
  // Oldest first, so the ticket that has waited longest is always top-left
  const visible = orders.filter(active.match).sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <>
      <PageHeader
        icon="kitchen"
        title="Kitchen Display"
        subtitle={live === 'live' ? 'Live: new orders ring the bell instantly' : 'Reconnecting… checking for orders every 20 seconds'}
        actions={
          <button
            className="btn btn-secondary"
            onClick={() => soundStore.setEnabled(sound === 'off')}
            aria-pressed={sound !== 'off'}
          >
            <Icon name="bell" size={16} /> {sound === 'off' ? 'Bell off' : 'Bell on'}
          </button>
        }
      />

      {sound === 'blocked' && (
        <button className="alert alert-warning kds-unlock" onClick={() => { unlockAudio(); playOrderBell(); }}>
          <Icon name="bell" size={16} /> Tap here once to enable the order bell on this screen
        </button>
      )}

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
          <p className="state-note">{live === 'live' ? 'Listening for new orders…' : `Checking every ${REFRESH_MS / 1000} seconds`}</p>
        </EmptyState>
      ) : (
        <div className="ticket-grid">
          {visible.map((order) => (
            <Ticket key={order.id} order={order} isNew={newIds.has(order.id)} busy={busyId === order.id} onAdvance={() => advance(order)} />
          ))}
        </div>
      )}

      {incoming.length > 0 && (
        <NewOrderAlert
          order={incoming[0]}
          more={incoming.length - 1}
          busy={busyId === incoming[0].id}
          onAcknowledge={() => acknowledge(incoming[0].id)}
          onStart={() => advance(incoming[0])}
        />
      )}
    </>
  );
}

function NewOrderAlert({ order, more, busy, onAcknowledge, onStart }: {
  order: Order;
  more: number;
  busy: boolean;
  onAcknowledge: () => void;
  onStart: () => void;
}) {
  const startRef = useRef<HTMLButtonElement>(null);
  useEffect(() => startRef.current?.focus(), [order.id]);

  return (
    <div className="kds-alert-overlay">
      <div className="kds-alert" role="alertdialog" aria-modal="true" aria-labelledby="kds-alert-title">
        <div className="kds-alert-head">
          <span className="kds-alert-bell"><Icon name="bell" size={28} /></span>
          <div>
            <div className="kds-alert-kicker">New order{more > 0 ? ` · ${more} more waiting` : ''}</div>
            <h2 id="kds-alert-title" className="kds-alert-title">{orderPlace(order)}</h2>
            <div className="ticket-meta">{billLabel(order)} · {order.source === 'qr' ? 'QR order' : 'POS'}</div>
          </div>
        </div>
        <ul className="ticket-items">
          {order.items.map((item, i) => (
            <li key={i}><span>{item.name}</span><span className="ticket-qty">× {item.quantity}</span></li>
          ))}
        </ul>
        {order.customerNote && <p className="ticket-note">Note: {order.customerNote}</p>}
        <div className="kds-alert-actions">
          <button className="btn btn-secondary btn-lg" onClick={onAcknowledge}>Got it</button>
          <button ref={startRef} className="btn btn-primary btn-lg" onClick={onStart} disabled={busy}>
            {busy ? 'Updating…' : 'Start cooking'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Ticket({ order, isNew, busy, onAdvance }: { order: Order; isNew: boolean; busy: boolean; onAdvance: () => void }) {
  const next = NEXT[order.status];
  const step = FLOW.indexOf(order.status);

  return (
    <article className={`ticket ticket-${order.status}${isNew ? ' ticket-new' : ''}`}>
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
