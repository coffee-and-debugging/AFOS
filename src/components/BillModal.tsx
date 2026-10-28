import { useState } from 'react';
import { api } from '../api/client';
import Icon from './Icon';
import Modal from './Modal';
import PaymentPanel from './PaymentPanel';
import { ReceiptModal } from './Receipt';
import { useRestaurant, useToast } from '../hooks';
import { billLabel, orderPlace } from '../lib/format';
import { computeTotals, splitDiscount } from '../lib/pricing';
import type { Order, StaffPaymentMethod } from '../types';

type Totals = ReturnType<typeof computeTotals>;

const round2 = (n: number) => Math.round(n * 100) / 100;

const sumTotals = (list: Totals[]): Totals => list.reduce((a, t) => ({
  subtotal: round2(a.subtotal + t.subtotal),
  discount: round2(a.discount + t.discount),
  serviceCharge: round2(a.serviceCharge + t.serviceCharge),
  tax: round2(a.tax + t.tax),
  totalAmount: round2(a.totalAmount + t.totalAmount),
}), { subtotal: 0, discount: 0, serviceCharge: 0, tax: 0, totalAmount: 0 });

/** Same dish at the same price across the chosen bills, shown as one line in "Pick items". */
interface ItemGroup {
  key: string;
  name: string;
  price: number;
  total: number;
  parts: { orderItemId: string; orderId: string; quantity: number }[];
}

function groupItems(list: Order[]): ItemGroup[] {
  const groups = new Map<string, ItemGroup>();
  for (const o of list) {
    for (const it of o.items) {
      if (!it.id) continue;
      const key = `${it.name}|${it.price}`;
      const g = groups.get(key) ?? { key, name: it.name, price: it.price, total: 0, parts: [] };
      g.total += it.quantity;
      g.parts.push({ orderItemId: it.id, orderId: o.id, quantity: it.quantity });
      groups.set(key, g);
    }
  }
  return [...groups.values()];
}

/** Spreads each picked quantity over the underlying order lines, oldest first. */
function allocate(groups: ItemGroup[], picked: Record<string, number>) {
  const lines: { orderItemId: string; orderId: string; quantity: number; price: number }[] = [];
  for (const g of groups) {
    let left = picked[g.key] ?? 0;
    for (const p of g.parts) {
      if (left <= 0) break;
      const take = Math.min(left, p.quantity);
      lines.push({ orderItemId: p.orderItemId, orderId: p.orderId, quantity: take, price: g.price });
      left -= take;
    }
  }
  return lines;
}

/**
 * Settle unpaid orders: optional discount, payment method, then a printable receipt.
 * Pass `order` for one bill, or `orders` to charge several together (e.g. a whole table);
 * the discount is then split across them by subtotal, exactly as the API does.
 * "Pick items" charges only chosen dishes; they move to their own bill and the rest stays unpaid.
 */
export default function BillModal({ order, orders, onClose, onPaid }: {
  order?: Order;
  orders?: Order[];
  onClose: () => void;
  onPaid: (o: Order) => void;
}) {
  const { restaurant, money } = useRestaurant();
  const toast = useToast();
  const list = orders ?? (order ? [order] : []);
  const single = list.length === 1;
  const [discount, setDiscount] = useState(single && list[0].discount ? String(list[0].discount) : '');
  const [method, setMethod] = useState<StaffPaymentMethod>('cash');
  const [saving, setSaving] = useState(false);
  const [paid, setPaid] = useState<Order[] | null>(null);
  const [mode, setMode] = useState<'all' | 'items'>('all');
  const [picked, setPicked] = useState<Record<string, number>>({});

  const groups = groupItems(list);
  const canPick = groups.reduce((s, g) => s + g.total, 0) > 1;
  const lines = allocate(groups, picked);
  const pickedCount = lines.reduce((s, l) => s + l.quantity, 0);

  // Bills being charged and their subtotals: whole bills, or just the picked part of each
  // (oldest first, as the API settles them, so the discount's rounding matches to the paisa)
  const byAge = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const charged = mode === 'all'
    ? byAge.map((o) => ({ order: o, subtotal: o.subtotal }))
    : byAge
      .map((o) => ({ order: o, subtotal: round2(lines.filter((l) => l.orderId === o.id).reduce((s, l) => s + l.price * l.quantity, 0)) }))
      .filter((c) => c.subtotal > 0);
  const shares = splitDiscount(charged.map((c) => c.subtotal), Number(discount) || 0);
  const totals = sumTotals(charged.map((c, i) => computeTotals(c.subtotal, shares[i], c.order.type, restaurant)));

  const bump = (g: ItemGroup, delta: number) =>
    setPicked((p) => ({ ...p, [g.key]: Math.max(0, Math.min(g.total, (p[g.key] ?? 0) + delta)) }));

  async function pay() {
    if (mode === 'items' && pickedCount === 0) return toast.error('Pick at least one item');
    setSaving(true);
    try {
      const d = Number(discount) || 0;
      const updated = mode === 'items'
        ? await api.orders.payItems(lines.map(({ orderItemId, quantity }) => ({ orderItemId, quantity })), method, d)
        : single
          ? [await api.orders.pay(list[0].id, method, d)]
          : await api.orders.payMany(list.map((o) => o.id), method, d);
      updated.forEach(onPaid);
      setPaid(updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (paid) return <ReceiptModal orders={paid} onClose={onClose} />;
  if (list.length === 0) return null;

  return (
    <Modal
      title={single ? `Bill ${billLabel(list[0])} · ${orderPlace(list[0])}` : `${orderPlace(list[0])} · ${list.length} bills`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-accent btn-lg" onClick={pay} disabled={saving || (mode === 'items' && pickedCount === 0)}>
            {saving ? 'Charging…' : `Charge ${money(totals.totalAmount)}`}
          </button>
        </>
      }
    >
      {canPick && (
        <div className="segmented" role="tablist" style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
          {([['all', single ? 'Whole bill' : 'All bills'], ['items', 'Pick items']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} className="segmented-item" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
      )}

      {mode === 'all' ? list.map((o) => (
        <div key={o.id}>
          {!single && <div className="bill-group-title"><span className="bill-no">{billLabel(o)}</span><span>{money(o.subtotal)}</span></div>}
          <ul className="line-items">
            {o.items.map((item, i) => (
              <li key={i}>
                <span>{item.name} <span className="muted">× {item.quantity}</span></span>
                <span className="nowrap">{money(item.subtotal)}</span>
              </li>
            ))}
          </ul>
        </div>
      )) : (
        <ul className="pick-list">
          {groups.map((g) => {
            const n = picked[g.key] ?? 0;
            return (
              <li key={g.key} className={n ? 'is-picked' : undefined}>
                <div className="pick-name">
                  <strong>{g.name}</strong>
                  <span className="muted">{money(g.price)} · {g.total} on bill</span>
                </div>
                <div className="pick-qty">
                  <button type="button" className="qty-btn" onClick={() => bump(g, -1)} disabled={n === 0} aria-label={`One less ${g.name}`}>−</button>
                  <span className="qty-value">{n}</span>
                  <button type="button" className="qty-btn is-primary" onClick={() => bump(g, 1)} disabled={n === g.total} aria-label={`One more ${g.name}`}>+</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPicked((p) => ({ ...p, [g.key]: n === g.total ? 0 : g.total }))}>
                    {n === g.total ? 'None' : 'All'}
                  </button>
                </div>
                <span className="pick-sum nowrap">{n ? money(round2(g.price * n)) : ''}</span>
              </li>
            );
          })}
          {pickedCount > 0 && pickedCount < groups.reduce((s, g) => s + g.total, 0) && (
            <li className="pick-note"><Icon name="check" size={14} /> The rest stays on the bill, unpaid.</li>
          )}
        </ul>
      )}

      <label className="field section-gap">
        <span className="field-label">Discount ({restaurant.currency})</span>
        <input className="input" data-icon="money" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
      </label>
      <Totals totals={totals} />
      <div className="section-gap"><PaymentPanel method={method} onMethod={setMethod} /></div>
    </Modal>
  );
}
export function Totals({ totals }: { totals: ReturnType<typeof computeTotals> }) {
  const { restaurant, money } = useRestaurant();
  return (
    <div className="totals">
      <div><span>Subtotal</span><span>{money(totals.subtotal)}</span></div>
      {totals.discount > 0 && <div><span>Discount</span><span>−{money(totals.discount)}</span></div>}
      {totals.serviceCharge > 0 && <div><span>Service charge ({restaurant.serviceChargeRate}%)</span><span>{money(totals.serviceCharge)}</span></div>}
      {totals.tax > 0 && <div><span>VAT ({restaurant.taxRate}%)</span><span>{money(totals.tax)}</span></div>}
      <div className="grand"><span>Total</span><span>{money(totals.totalAmount)}</span></div>
    </div>
  );
}
