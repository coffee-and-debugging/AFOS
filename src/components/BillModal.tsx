import { useState } from 'react';
import { api } from '../api/client';
import Modal from './Modal';
import PaymentPanel from './PaymentPanel';
import { ReceiptModal } from './Receipt';
import { useRestaurant, useToast } from '../hooks';
import { billLabel, orderPlace } from '../lib/format';
import { computeTotals } from '../lib/pricing';
import type { Order, StaffPaymentMethod } from '../types';

/** Settle an unpaid order: optional discount, payment method, then a printable receipt. */
export default function BillModal({ order, onClose, onPaid }: { order: Order; onClose: () => void; onPaid: (o: Order) => void }) {
  const { restaurant, money } = useRestaurant();
  const toast = useToast();
  const [discount, setDiscount] = useState(order.discount ? String(order.discount) : '');
  const [method, setMethod] = useState<StaffPaymentMethod>('cash');
  const [saving, setSaving] = useState(false);
  const [paid, setPaid] = useState<Order | null>(null);

  const totals = computeTotals(order.subtotal, Number(discount) || 0, order.type, restaurant);

  async function pay() {
    setSaving(true);
    try {
      const updated = await api.orders.pay(order.id, method, Number(discount) || 0);
      onPaid(updated);
      setPaid(updated);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (paid) return <ReceiptModal order={paid} onClose={onClose} />;

  return (
    <Modal
      title={`Bill ${billLabel(order)} · ${orderPlace(order)}`}
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
      <ul className="line-items">
        {order.items.map((item, i) => (
          <li key={i}>
            <span>{item.name} <span className="muted">× {item.quantity}</span></span>
            <span className="nowrap">{money(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      <label className="field section-gap">
        <span className="field-label">Discount ({restaurant.currency})</span>
        <input className="input" type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
      </label>
      <Totals totals={totals} />
      <div className="section-gap"><PaymentPanel total={totals.totalAmount} method={method} onMethod={setMethod} /></div>
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
