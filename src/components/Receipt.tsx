import Icon from './Icon';
import Modal from './Modal';
import { useRestaurant } from '../hooks';
import { billLabel, formatDateTime, orderPlace, PAYMENT_LABEL } from '../lib/format';
import type { Order } from '../types';

const sum = (list: Order[], key: 'subtotal' | 'discount' | 'serviceCharge' | 'tax' | 'totalAmount') =>
  Math.round(list.reduce((s, o) => s + o[key], 0) * 100) / 100;

/** One bill, or several settled together (e.g. a whole table) as a single combined receipt. */
export function Receipt({ order, orders }: { order?: Order; orders?: Order[] }) {
  const { restaurant, money } = useRestaurant();
  const list = orders ?? (order ? [order] : []);
  if (list.length === 0) return null;
  const first = list[0];
  const many = list.length > 1;
  return (
    <div className="receipt">
      <div className="receipt-center">
        <div className="receipt-title">{restaurant.name}</div>
        {restaurant.address && <div>{restaurant.address}</div>}
        {restaurant.phone && <div>Tel: {restaurant.phone}</div>}
      </div>
      <hr />
      <div className="receipt-row"><span>{many ? 'Bills' : 'Bill'} {list.map(billLabel).join(', ')}</span><span>{formatDateTime(first.createdAt)}</span></div>
      <div className="receipt-row"><span>{orderPlace(first)}</span></div>
      <hr />
      {list.map((o) => (
        <div key={o.id}>
          {many && <div><strong>Bill {billLabel(o)}</strong></div>}
          {o.items.map((item, i) => (
            <div key={i}>
              <div>{item.name}</div>
              <div className="receipt-row"><span>&nbsp;&nbsp;{item.quantity} × {item.price}</span><span>{money(item.subtotal)}</span></div>
            </div>
          ))}
        </div>
      ))}
      <hr />
      <div className="receipt-row"><span>Subtotal</span><span>{money(sum(list, 'subtotal'))}</span></div>
      {sum(list, 'discount') > 0 && <div className="receipt-row"><span>Discount</span><span>−{money(sum(list, 'discount'))}</span></div>}
      {sum(list, 'serviceCharge') > 0 && <div className="receipt-row"><span>Service charge</span><span>{money(sum(list, 'serviceCharge'))}</span></div>}
      {sum(list, 'tax') > 0 && <div className="receipt-row"><span>VAT</span><span>{money(sum(list, 'tax'))}</span></div>}
      <div className="receipt-row receipt-total"><span>TOTAL</span><span>{money(sum(list, 'totalAmount'))}</span></div>
      <hr />
      <div className="receipt-row">
        <span>{list.every((o) => o.paymentStatus === 'paid') ? 'Paid' : 'Unpaid'}</span>
        <span>{first.paymentMethod ? PAYMENT_LABEL[first.paymentMethod] : '—'}</span>
      </div>
      {list.map((o) => o.paymentRef && <div key={o.id} className="receipt-row"><span>Txn ref</span><span>{o.paymentRef}</span></div>)}
      {restaurant.receiptFooter && <><hr /><div className="receipt-center">{restaurant.receiptFooter}</div></>}
    </div>
  );
}

export function ReceiptModal({ order, orders, onClose }: { order?: Order; orders?: Order[]; onClose: () => void }) {
  const list = orders ?? (order ? [order] : []);
  return (
    <Modal
      title={list.length > 1 ? `${list.length} bills · ${orderPlace(list[0])}` : `Bill ${list[0] ? billLabel(list[0]) : ''}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
          <button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={16} /> Print</button>
        </>
      }
    >
      <div className="print-area"><Receipt orders={list} /></div>
    </Modal>
  );
}
