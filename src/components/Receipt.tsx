import Icon from './Icon';
import Modal from './Modal';
import { useRestaurant } from '../hooks';
import { billLabel, formatDateTime, orderPlace, PAYMENT_LABEL } from '../lib/format';
import type { Order } from '../types';

export function Receipt({ order }: { order: Order }) {
  const { restaurant, money } = useRestaurant();
  return (
    <div className="receipt">
      <div className="receipt-center">
        <div className="receipt-title">{restaurant.name}</div>
        {restaurant.address && <div>{restaurant.address}</div>}
        {restaurant.phone && <div>Tel: {restaurant.phone}</div>}
      </div>
      <hr />
      <div className="receipt-row"><span>Bill {billLabel(order)}</span><span>{formatDateTime(order.createdAt)}</span></div>
      <div className="receipt-row"><span>{orderPlace(order)}</span></div>
      <hr />
      {order.items.map((item, i) => (
        <div key={i}>
          <div>{item.name}</div>
          <div className="receipt-row"><span>&nbsp;&nbsp;{item.quantity} × {item.price}</span><span>{money(item.subtotal)}</span></div>
        </div>
      ))}
      <hr />
      <div className="receipt-row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
      {order.discount > 0 && <div className="receipt-row"><span>Discount</span><span>−{money(order.discount)}</span></div>}
      {order.serviceCharge > 0 && <div className="receipt-row"><span>Service charge</span><span>{money(order.serviceCharge)}</span></div>}
      {order.tax > 0 && <div className="receipt-row"><span>VAT</span><span>{money(order.tax)}</span></div>}
      <div className="receipt-row receipt-total"><span>TOTAL</span><span>{money(order.totalAmount)}</span></div>
      <hr />
      <div className="receipt-row">
        <span>{order.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</span>
        <span>{order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] : '—'}</span>
      </div>
      {order.paymentRef && <div className="receipt-row"><span>Txn ref</span><span>{order.paymentRef}</span></div>}
      {restaurant.receiptFooter && <><hr /><div className="receipt-center">{restaurant.receiptFooter}</div></>}
    </div>
  );
}

export function ReceiptModal({ order, onClose }: { order: Order; onClose: () => void }) {
  return (
    <Modal
      title={`Bill ${billLabel(order)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose}>Done</button>
          <button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" size={16} /> Print</button>
        </>
      }
    >
      <div className="print-area"><Receipt order={order} /></div>
    </Modal>
  );
}
