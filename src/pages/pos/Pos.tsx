import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import BillModal, { Totals } from '../../components/BillModal';
import FoodVisual from '../../components/FoodVisual';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import PaymentPanel from '../../components/PaymentPanel';
import { ReceiptModal } from '../../components/Receipt';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { useLiveReload, usePolling, useRestaurant, useToast } from '../../hooks';
import { billLabel, orderPlace, timeSince } from '../../lib/format';
import { computeTotals } from '../../lib/pricing';
import type { Order, OrderType, StaffPaymentMethod } from '../../types';

type Cart = Record<number, number>;

const loadMenu = () => Promise.all([api.menu.getAll(), api.categories.getAll()]);
const loadOpenBills = () => api.orders.list({ unpaid: true, limit: 200 });

export default function Pos() {
  const [params, setParams] = useSearchParams();
  const { restaurant, money } = useRestaurant();
  const toast = useToast();

  const menu = usePolling(loadMenu, 30_000);
  const tables = usePolling(api.tables.getAll, 15_000);
  const bills = usePolling(loadOpenBills, 30_000);
  // QR orders and payments from other tills show up without waiting for the next poll
  useLiveReload(() => {
    bills.reload();
    tables.reload();
  }, ['order.created', 'order.updated']);

  const billTable = params.get('bill');
  const [tab, setTab] = useState<'new' | 'bills'>(billTable ? 'bills' : 'new');
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const [type, setType] = useState<OrderType>('dine_in');
  const [tableId, setTableId] = useState(params.get('table') ?? '');
  const [note, setNote] = useState('');
  const [discount, setDiscount] = useState('');
  const [charging, setCharging] = useState(false);
  const [method, setMethod] = useState<StaffPaymentMethod>('cash');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Order | null>(null);
  const [billing, setBilling] = useState<Order | null>(null);

  const refreshAfterChange = () => {
    bills.reload();
    tables.reload();
  };

  if (menu.loading && !menu.data) return <LoadingState label="Loading POS…" />;
  if (!menu.data) return <ErrorState error={menu.error} onRetry={menu.retry} />;

  const [items, categories] = menu.data;
  const term = search.trim().toLowerCase();
  const visible = items.filter((m) =>
    (category === 'all' || m.category === category) && (!term || m.name.toLowerCase().includes(term)));

  const lines = items.filter((m) => cart[m.id] > 0);
  const count = lines.reduce((s, m) => s + cart[m.id], 0);
  const totals = computeTotals(lines.reduce((s, m) => s + m.price * cart[m.id], 0), Number(discount) || 0, type, restaurant);
  const openBills = (bills.data ?? []).filter((o) => !billTable || o.tableId === billTable);

  // Delta-based so rapid taps are never lost to a stale render
  const bump = (id: number, delta: number) =>
    setCart((prev) => {
      const next = { ...prev };
      const qty = Math.min((prev[id] || 0) + delta, 50);
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  function reset() {
    setCart({});
    setNote('');
    setDiscount('');
    setCharging(false);
    if (params.get('table')) setParams({}, { replace: true });
  }

  function validate() {
    if (count === 0) return 'Add at least one item';
    if (type === 'dine_in' && !tableId) return 'Choose a table, or switch to takeaway';
    return null;
  }

  async function submit(payWith?: StaffPaymentMethod) {
    const problem = validate();
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const order = await api.orders.createPos({
        type,
        tableId: type === 'dine_in' ? tableId : undefined,
        items: lines.map((m) => ({ menuItemId: String(m.id), quantity: cart[m.id] })),
        customerNote: note,
        discount: Number(discount) || 0,
        payWith,
      });
      reset();
      refreshAfterChange();
      if (payWith) setReceipt(order);
      else toast.success(`Bill ${billLabel(order)} sent to the kitchen`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader icon="pos" title="POS / Billing" subtitle="Take orders at the counter, send them to the kitchen and settle bills" />

      <div className="pos">
        <section className="pos-menu">
          <div className="toolbar">
            <div className="segmented" role="tablist" aria-label="Categories">
              {[{ slug: 'all', name: 'All' }, ...categories].map((c) => (
                <button key={c.slug} role="tab" aria-selected={category === c.slug} className="segmented-item" onClick={() => setCategory(c.slug)}>
                  {c.name}
                </button>
              ))}
            </div>
            <input className="input input-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu" aria-label="Search menu" />
          </div>

          {visible.length === 0 ? (
            <div className="card"><EmptyState icon="menu" title="Nothing found" text="Try another category or search term." /></div>
          ) : (
            <div className="pos-tiles">
              {visible.map((m) => (
                <button key={m.id} className="pos-tile" disabled={!m.available} onClick={() => bump(m.id, 1)} title={m.available ? `Add ${m.name}` : 'Not Available'}>
                  <div className="pos-tile-media"><FoodVisual imageUrl={m.imageUrl} category={m.category} iconSize={34} /></div>
                  <div className="pos-tile-body">
                    <div className="pos-tile-name">{m.name}</div>
                    <div className="pos-tile-price">{m.available ? money(m.price) : 'Not Available'}</div>
                  </div>
                  {cart[m.id] > 0 && <span className="pos-tile-qty">{cart[m.id]}</span>}
                </button>
              ))}
            </div>
          )}
        </section>

        <aside className="ticket-panel" aria-label="Current order">
          <div className="ticket-panel-head">
            <div className="segmented" role="tablist">
              <button role="tab" aria-selected={tab === 'new'} className="segmented-item" onClick={() => setTab('new')}>
                New order {count > 0 && <span className="segmented-count">{count}</span>}
              </button>
              <button role="tab" aria-selected={tab === 'bills'} className="segmented-item" onClick={() => setTab('bills')}>
                Open bills <span className="segmented-count">{bills.data?.length ?? 0}</span>
              </button>
            </div>
          </div>

          {tab === 'new' ? (
            <>
              <div className="ticket-panel-body">
                <div className="segmented" role="tablist" style={{ width: '100%', marginBottom: 'var(--space-3)' }}>
                  {(['dine_in', 'takeaway'] as OrderType[]).map((t) => (
                    <button key={t} role="tab" aria-selected={type === t} className="segmented-item" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setType(t)}>
                      {t === 'dine_in' ? 'Dine-in' : 'Takeaway'}
                    </button>
                  ))}
                </div>
                {type === 'dine_in' && (
                  <label className="field" style={{ marginBottom: 'var(--space-3)' }}>
                    <span className="visually-hidden">Table</span>
                    <select className="input" value={tableId} onChange={(e) => setTableId(e.target.value)}>
                      <option value="">Choose table…</option>
                      {(tables.data ?? []).map((t) => (
                        <option key={t.id} value={t.id}>Table {t.number}{t.openOrders ? ` · occupied (${money(t.openAmount)})` : ''}</option>
                      ))}
                    </select>
                  </label>
                )}

                {lines.length === 0 ? (
                  <EmptyState icon="burger" title="Ticket is empty" text="Tap menu items to add them." />
                ) : (
                  <div>
                    {lines.map((m) => (
                      <div key={m.id} className="ticket-line">
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600 }}>{m.name}</div>
                          <div className="subtle">{money(m.price)}</div>
                        </div>
                        <div className="qty">
                          <button className="qty-btn" onClick={() => bump(m.id, -1)} aria-label={`Remove one ${m.name}`}>−</button>
                          <span className="qty-value">{cart[m.id]}</span>
                          <button className="qty-btn is-primary" onClick={() => bump(m.id, 1)} aria-label={`Add one ${m.name}`}>+</button>
                        </div>
                        <span className="nowrap" style={{ fontWeight: 700, minWidth: 72, textAlign: 'right' }}>{money(m.price * cart[m.id])}</span>
                      </div>
                    ))}
                    <div className="grid-2 section-gap" style={{ gap: 'var(--space-2)' }}>
                      <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Kitchen note" aria-label="Kitchen note" />
                      <input className="input" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder={`Discount (${restaurant.currency})`} aria-label="Discount" />
                    </div>
                  </div>
                )}
              </div>
              <div className="ticket-panel-foot">
                <Totals totals={totals} />
                <div className="grid-2 section-gap" style={{ gap: 'var(--space-2)' }}>
                  <button className="btn btn-secondary btn-lg" onClick={() => submit()} disabled={busy || count === 0}>
                    <Icon name="kitchen" size={18} /> Send to kitchen
                  </button>
                  <button className="btn btn-accent btn-lg" onClick={() => (validate() ? toast.error(validate()!) : setCharging(true))} disabled={busy || count === 0}>
                    <Icon name="cash" size={18} /> Charge
                  </button>
                </div>
                {count > 0 && <button className="btn btn-ghost btn-sm btn-block section-gap" onClick={reset}>Clear ticket</button>}
              </div>
            </>
          ) : (
            <div className="ticket-panel-body">
              {billTable && (
                <div className="chosen" style={{ marginBottom: 'var(--space-3)' }}>
                  <span className="spacer">Showing bills for one table</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setParams({}, { replace: true })}>Show all</button>
                </div>
              )}
              {openBills.length === 0 ? (
                <EmptyState icon="pos" title="All bills settled" text="Unpaid orders appear here until they are charged." />
              ) : (
                <div className="stack" style={{ gap: 'var(--space-2)' }}>
                  {openBills.map((o) => (
                    <button key={o.id} className="tracked-card" style={{ minWidth: 0, width: '100%' }} onClick={() => setBilling(o)}>
                      <span className="row" style={{ justifyContent: 'space-between' }}>
                        <strong>{orderPlace(o)}</strong>
                        <span className="bill-no">{billLabel(o)}</span>
                      </span>
                      <span className="row" style={{ justifyContent: 'space-between' }}>
                        <span className="subtle">{o.items.reduce((s, i) => s + i.quantity, 0)} items · {timeSince(o.createdAt)}</span>
                        <span className="price">{money(o.totalAmount)}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>
      </div>

      {charging && (
        <Modal
          title={`Charge ${money(totals.totalAmount)}`}
          onClose={() => setCharging(false)}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setCharging(false)}>Back</button>
              <button className="btn btn-accent btn-lg" onClick={() => submit(method)} disabled={busy}>
                {busy ? 'Charging…' : `Confirm ${money(totals.totalAmount)}`}
              </button>
            </>
          }
        >
          <Totals totals={totals} />
          <div className="section-gap"><PaymentPanel total={totals.totalAmount} method={method} onMethod={setMethod} /></div>
        </Modal>
      )}

      {billing && (
        <BillModal
          order={billing}
          onClose={() => setBilling(null)}
          onPaid={() => refreshAfterChange()}
        />
      )}

      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
