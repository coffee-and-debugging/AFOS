import { useCallback, useState } from 'react';
import { api, type DateRange } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import BillModal from '../../components/BillModal';
import Icon from '../../components/Icon';
import RangePicker from '../../components/RangePicker';
import { ReceiptModal } from '../../components/Receipt';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { presetRange, type RangePreset } from '../../lib/dates';
import { billLabel, formatDateTime, orderPlace, PAYMENT_LABEL, STATUS_LABEL } from '../../lib/format';
import type { Order, OrderStatus, OrderType } from '../../types';

const FILTERS: ('' | OrderStatus)[] = ['', 'pending', 'cooking', 'serving', 'completed', 'cancelled'];
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'cooking', 'serving', 'completed'];

function PaymentBadge({ order }: { order: Order }) {
  if (order.status === 'cancelled') return <span className="badge">—</span>;
  if (order.paymentStatus === 'paid') {
    return <span className="badge badge-paid">Paid · {order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] : '—'}</span>;
  }
  if (order.paymentStatus === 'pending_counter') return <span className="badge badge-pending_counter">Pay at counter</span>;
  return <span className="badge badge-unpaid">Unpaid</span>;
}

export default function Orders() {
  const { money } = useRestaurant();
  const toast = useToast();
  const [preset, setPreset] = useState<RangePreset>('today');
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  const [filter, setFilter] = useState<'' | OrderStatus>('');
  const [type, setType] = useState<'' | OrderType>('');
  const [q, setQ] = useState('');
  const [billing, setBilling] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);

  const load = useCallback(() => api.orders.list({ ...range, limit: 2000 }), [range]);
  const { data: orders, error, loading, retry, setData } = usePolling(load, 10_000);

  const replace = (updated: Order) => setData((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  async function updateStatus(o: Order, status: OrderStatus) {
    if (status === 'cancelled' && !confirm(`Cancel bill ${billLabel(o)}? Ingredients go back into stock.`)) return;
    try {
      replace(await api.orders.updateStatus(o.id, status));
      if (status === 'cancelled') toast.success(`Bill ${billLabel(o)} cancelled`);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const all = orders ?? [];
  const term = q.trim().toLowerCase();
  const visible = all.filter((o) =>
    (!filter || o.status === filter) &&
    (!type || o.type === type) &&
    (!term || billLabel(o).includes(term) || orderPlace(o).toLowerCase().includes(term)));
  const revenue = visible.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.totalAmount, 0);

  return (
    <>
      <PageHeader icon="orders" title="Orders" subtitle="Every order from the POS and table QR codes" />

      <div className="toolbar">
        <RangePicker preset={preset} onChange={(p, r) => { setPreset(p); setRange(r); }} />
      </div>

      <div className="toolbar">
        <div className="segmented" role="tablist" aria-label="Status">
          {FILTERS.map((s) => (
            <button key={s || 'all'} role="tab" aria-selected={filter === s} className="segmented-item" onClick={() => setFilter(s)}>
              {s ? STATUS_LABEL[s] : 'All'}
              <span className="segmented-count">{s ? all.filter((o) => o.status === s).length : all.length}</span>
            </button>
          ))}
        </div>
        <div className="row">
          <select className="input input-sm" value={type} onChange={(e) => setType(e.target.value as '' | OrderType)} aria-label="Order type">
            <option value="">All types</option>
            <option value="dine_in">Dine-in</option>
            <option value="takeaway">Takeaway</option>
          </select>
          <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill # or table" aria-label="Search orders" />
        </div>
      </div>

      <section className="card">
        {loading && !orders ? <LoadingState label="Loading orders…" /> : !orders ? <ErrorState error={error} onRetry={retry} /> : visible.length === 0 ? (
          <EmptyState icon="orders" title="Nothing here" text="No orders match these filters." />
        ) : (
          <>
            <div className="card-header">
              <span className="subtle">{visible.length} orders</span>
              <span className="price">{money(revenue)}</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Bill</th><th>Placed</th><th>Where</th><th>Items</th><th className="num">Total</th><th>Status</th><th>Payment</th><th /></tr>
                </thead>
                <tbody>
                  {visible.map((o) => (
                    <tr key={o.id} className={o.status === 'cancelled' ? 'is-muted' : undefined}>
                      <td className="bill-no">{billLabel(o)}</td>
                      <td className="nowrap muted">{formatDateTime(o.createdAt)}</td>
                      <td className="nowrap">{orderPlace(o)}{o.source === 'qr' && <span className="subtle"> · QR</span>}</td>
                      <td>{o.items.reduce((s, i) => s + i.quantity, 0)}</td>
                      <td className="num">{money(o.totalAmount)}</td>
                      <td>
                        {o.status === 'cancelled' ? <span className="badge badge-cancelled">Cancelled</span> : (
                          <select className="input input-sm" value={o.status} onChange={(e) => updateStatus(o, e.target.value as OrderStatus)} aria-label={`Status for ${billLabel(o)}`}>
                            {ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                            {o.paymentStatus !== 'paid' && <option value="cancelled">Cancel order</option>}
                          </select>
                        )}
                      </td>
                      <td><PaymentBadge order={o} /></td>
                      <td>
                        <div className="row-actions">
                          {o.status !== 'cancelled' && o.paymentStatus !== 'paid' && (
                            <button className="btn btn-accent btn-sm" onClick={() => setBilling(o)}>Bill</button>
                          )}
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setReceipt(o)} aria-label={`View bill ${billLabel(o)}`}><Icon name="print" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {billing && <BillModal order={billing} onClose={() => setBilling(null)} onPaid={replace} />}
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
