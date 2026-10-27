import { useCallback, useState, type ReactNode } from 'react';
import { api, type DateRange } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import BillModal from '../../components/BillModal';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import RangePicker from '../../components/RangePicker';
import { ReceiptModal } from '../../components/Receipt';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { presetRange, type RangePreset } from '../../lib/dates';
import { billLabel, formatDateTime, orderPlace, PAYMENT_LABEL, STATUS_LABEL } from '../../lib/format';
import type { Order, OrderStatus, OrderType } from '../../types';

const FILTERS: ('' | OrderStatus)[] = ['', 'pending', 'cooking', 'serving', 'completed', 'cancelled'];
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'cooking', 'serving', 'completed'];

const isPayable = (o: Order) => o.status !== 'cancelled' && o.paymentStatus !== 'paid';
const itemCount = (o: Order) => o.items.reduce((s, i) => s + i.quantity, 0);

function PaymentBadge({ order }: { order: Order }) {
  if (order.status === 'cancelled') return <span className="badge">—</span>;
  if (order.paymentStatus === 'paid') {
    return <span className="badge badge-paid">Paid · {order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] : '—'}</span>;
  }
  if (order.paymentStatus === 'pending_counter') return <span className="badge badge-pending_counter">Pay at counter</span>;
  return <span className="badge badge-unpaid">Unpaid</span>;
}

/** Dine-in orders are shown one row per table; takeaways stay one row per order. */
type Row =
  | { kind: 'table'; key: string; tableNumber: number; orders: Order[]; latest: string }
  | { kind: 'order'; key: string; order: Order; latest: string };

function toRows(orders: Order[]): Row[] {
  const tables = new Map<number, Order[]>();
  const rows: Row[] = [];
  for (const o of orders) {
    if (o.type === 'dine_in' && o.tableNumber != null) {
      tables.set(o.tableNumber, [...(tables.get(o.tableNumber) ?? []), o]);
    } else {
      rows.push({ kind: 'order', key: o.id, order: o, latest: o.createdAt });
    }
  }
  for (const [tableNumber, list] of tables) {
    const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    rows.push({ kind: 'table', key: `table-${tableNumber}`, tableNumber, orders: sorted, latest: sorted[0].createdAt });
  }
  return rows.sort((a, b) => b.latest.localeCompare(a.latest));
}

export default function Orders() {
  const { money } = useRestaurant();
  const toast = useToast();
  const [preset, setPreset] = useState<RangePreset>('today');
  const [range, setRange] = useState<DateRange>(() => presetRange('today'));
  const [filter, setFilter] = useState<'' | OrderStatus>('');
  const [type, setType] = useState<'' | OrderType>('');
  const [q, setQ] = useState('');
  const [billing, setBilling] = useState<Order[] | null>(null);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [openTable, setOpenTable] = useState<number | null>(null);

  const load = useCallback(() => api.orders.list({ ...range, limit: 2000 }), [range]);
  const { data: orders, error, loading, retry, setData } = usePolling(load, 10_000);

  const replace = (updated: Order) => setData((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));

  async function updateStatus(o: Order, status: OrderStatus) {
    if (status === 'cancelled' && !confirm(`Cancel bill ${billLabel(o)}? Linked items go back into inventory.`)) return;
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
  const rows = toRows(visible);
  const tableOrders = openTable == null ? [] : visible.filter((o) => o.type === 'dine_in' && o.tableNumber === openTable)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const orderActions = (o: Order) => (
    <div className="row-actions">
      {isPayable(o) && <button className="btn btn-accent btn-sm" onClick={() => setBilling([o])}>Bill</button>}
      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setReceipt(o)} aria-label={`View bill ${billLabel(o)}`}><Icon name="print" size={14} /></button>
    </div>
  );

  const statusCell = (o: Order) => (o.status === 'cancelled' ? <span className="badge badge-cancelled">Cancelled</span> : (
    <select className="input input-sm" data-icon="list" value={o.status} onChange={(e) => updateStatus(o, e.target.value as OrderStatus)} aria-label={`Status for ${billLabel(o)}`}>
      {ACTIVE_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      {o.paymentStatus !== 'paid' && <option value="cancelled">Cancel order</option>}
    </select>
  ));

  return (
    <>
      <PageHeader icon="orders" title="Orders" />

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
          <select className="input input-sm" data-icon="list" value={type} onChange={(e) => setType(e.target.value as '' | OrderType)} aria-label="Order type">
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
                  {rows.map((row) => {
                    if (row.kind === 'order') {
                      const o = row.order;
                      return (
                        <tr key={row.key} className={o.status === 'cancelled' ? 'is-muted' : undefined}>
                          <td className="bill-no">{billLabel(o)}</td>
                          <td className="nowrap muted">{formatDateTime(o.createdAt)}</td>
                          <td className="nowrap">{orderPlace(o)}{o.source === 'qr' && <span className="subtle"> · QR</span>}</td>
                          <td>{itemCount(o)}</td>
                          <td className="num">{money(o.totalAmount)}</td>
                          <td>{statusCell(o)}</td>
                          <td><PaymentBadge order={o} /></td>
                          <td>{orderActions(o)}</td>
                        </tr>
                      );
                    }
                    const live = row.orders.filter((o) => o.status !== 'cancelled');
                    const unpaid = row.orders.filter(isPayable);
                    const open = live.filter((o) => o.status !== 'completed').length;
                    return (
                      <tr
                        key={row.key}
                        className={`row-click${live.length === 0 ? ' is-muted' : ''}`}
                        onClick={() => setOpenTable(row.tableNumber)}
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setOpenTable(row.tableNumber))}
                        aria-label={`Table ${row.tableNumber}, ${row.orders.length} orders`}
                      >
                        <td><span className="bill-no">{row.orders.length} {row.orders.length === 1 ? 'bill' : 'bills'}</span></td>
                        <td className="nowrap muted">{formatDateTime(row.latest)}</td>
                        <td className="nowrap"><strong>Table {row.tableNumber}</strong></td>
                        <td>{live.reduce((s, o) => s + itemCount(o), 0)}</td>
                        <td className="num">{money(live.reduce((s, o) => s + o.totalAmount, 0))}</td>
                        <td>{open > 0 ? <span className="badge badge-pending">{open} open</span> : <span className="badge">{live.length ? 'Served' : 'Cancelled'}</span>}</td>
                        <td>
                          {unpaid.length > 0
                            ? <span className="badge badge-unpaid">Unpaid · {money(unpaid.reduce((s, o) => s + o.totalAmount, 0))}</span>
                            : live.length > 0 ? <span className="badge badge-paid">Paid</span> : <span className="badge">—</span>}
                        </td>
                        <td>
                          <div className="row-actions">
                            {unpaid.length > 0 && (
                              <button className="btn btn-accent btn-sm" onClick={(e) => { e.stopPropagation(); setBilling(unpaid); }}>
                                {unpaid.length > 1 ? 'Bill all' : 'Bill'}
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={(e) => { e.stopPropagation(); setOpenTable(row.tableNumber); }}>View</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {openTable != null && !billing && !receipt && (
        <TableOrders
          tableNumber={openTable}
          orders={tableOrders}
          onClose={() => setOpenTable(null)}
          onBill={setBilling}
          statusCell={statusCell}
          actions={orderActions}
        />
      )}
      {billing && <BillModal orders={billing} onClose={() => setBilling(null)} onPaid={replace} />}
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}

/** Every order of one table: bill them one by one, or all unpaid ones together. */
function TableOrders({ tableNumber, orders, onClose, onBill, statusCell, actions }: {
  tableNumber: number;
  orders: Order[];
  onClose: () => void;
  onBill: (orders: Order[]) => void;
  statusCell: (o: Order) => ReactNode;
  actions: (o: Order) => ReactNode;
}) {
  const { money } = useRestaurant();
  const unpaid = orders.filter(isPayable);
  const unpaidTotal = unpaid.reduce((s, o) => s + o.totalAmount, 0);

  return (
    <Modal
      title={`Table ${tableNumber}`}
      wide
      onClose={onClose}
      footer={<>
        <span className="spacer subtle">{unpaid.length ? `${unpaid.length} unpaid · ${money(unpaidTotal)}` : 'All paid'}</span>
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
        {unpaid.length > 1 && (
          <button className="btn btn-accent" onClick={() => onBill(unpaid)}>
            <Icon name="cash" size={16} /> Bill all · {money(unpaidTotal)}
          </button>
        )}
      </>}
    >
      {orders.length === 0 ? (
        <EmptyState icon="orders" title="No orders for this table" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Bill</th><th>Placed</th><th>Items</th><th className="num">Total</th><th>Status</th><th>Payment</th><th /></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={o.status === 'cancelled' ? 'is-muted' : undefined}>
                  <td className="bill-no">{billLabel(o)}{o.source === 'qr' && <span className="subtle"> · QR</span>}</td>
                  <td className="nowrap muted">{formatDateTime(o.createdAt)}</td>
                  <td className="cell-items">
                    {itemCount(o)}
                    <div className="muted cell-sub">{o.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</div>
                  </td>
                  <td className="num">{money(o.totalAmount)}</td>
                  <td>{statusCell(o)}</td>
                  <td><PaymentBadge order={o} /></td>
                  <td>{actions(o)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
