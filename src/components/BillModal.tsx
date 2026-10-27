import { useState } from 'react';
import { api } from '../api/client';
import Modal from './Modal';
import PaymentPanel from './PaymentPanel';
import { ReceiptModal } from './Receipt';
import { useRestaurant, useToast } from '../hooks';
import { billLabel, orderPlace } from '../lib/format';
import { computeTotals, splitDiscount } from '../lib/pricing';
import type { Order, StaffPaymentMethod } from '../types';

type Totals = ReturnType<typeof computeTotals>;

const sumTotals = (list: Totals[]): Totals => {
  const r = (n: number) => Math.round(n * 100) / 100;
  return list.reduce((a, t) => ({
    subtotal: r(a.subtotal + t.subtotal),
    discount: r(a.discount + t.discount),
    serviceCharge: r(a.serviceCharge + t.serviceCharge),
    tax: r(a.tax + t.tax),
    totalAmount: r(a.totalAmount + t.totalAmount),
  }), { subtotal: 0, discount: 0, serviceCharge: 0, tax: 0, totalAmount: 0 });
};

/**
 * Settle unpaid orders: optional discount, payment method, then a printable receipt.
 * Pass `order` for one bill, or `orders` to charge several together (e.g. a whole table);
 * the discount is then split across them by subtotal, exactly as the API does.
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

  const shares = splitDiscount(list.map((o) => o.subtotal), Number(discount) || 0);
  const totals = sumTotals(list.map((o, i) => computeTotals(o.subtotal, shares[i], o.type, restaurant)));

  async function pay() {
    setSaving(true);
    try {
      const updated = single
        ? [await api.orders.pay(list[0].id, method, Number(discount) || 0)]
        : await api.orders.payMany(list.map((o) => o.id), method, Number(discount) || 0);
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
          <button className="btn btn-accent btn-lg" onClick={pay} disabled={saving}>
            {saving ? 'Charging…' : `Charge ${money(totals.totalAmount)}`}
          </button>
        </>
      }
    >
      {list.map((o) => (
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
      ))}
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
