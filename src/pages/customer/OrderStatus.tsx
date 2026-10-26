import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import GuestHeader from '../../components/GuestHeader';
import Icon, { type IconName } from '../../components/Icon';
import Modal from '../../components/Modal';
import OnlinePayment from '../../components/OnlinePayment';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant } from '../../hooks';
import { billLabel, formatTime, orderPlace, PAYMENT_LABEL } from '../../lib/format';
import type { OrderStatus as Status } from '../../types';
import type { PaymentNotice } from './PaymentReturn';

// Guests' "Pay online" button is hidden for now. Set to true to show it again;
// all online-payment code and flows below are unchanged.
const SHOW_PAY_ONLINE_BUTTON = false;

const STEPS: { status: Status; label: string; icon: IconName }[] = [
  { status: 'pending', label: 'Received', icon: 'check' },
  { status: 'cooking', label: 'Cooking', icon: 'flame' },
  { status: 'serving', label: 'Ready', icon: 'bell' },
  { status: 'completed', label: 'Served', icon: 'star' },
];

const MESSAGE: Record<Status, { tone: string; text: string }> = {
  pending: { tone: 'alert-warning', text: 'Order received — the kitchen will start on it shortly.' },
  cooking: { tone: 'alert-info', text: 'The kitchen is preparing your order.' },
  serving: { tone: 'alert-success', text: 'Your order is ready! It will be brought to your table.' },
  completed: { tone: 'alert-success', text: 'Enjoy your meal — thank you for visiting!' },
  cancelled: { tone: 'alert-error', text: 'This order was cancelled. Please ask our staff if this is unexpected.' },
};

export default function OrderStatus() {
  const { orderId = '' } = useParams<{ orderId: string }>();
  // Set by the payment return page with the outcome of an online payment
  const notice = (useLocation().state as { notice?: PaymentNotice } | null)?.notice;
  const { money } = useRestaurant();
  const { data: order, error, loading, retry, setData } = usePolling(
    useCallback(() => api.orders.getById(orderId), [orderId]),
    5000,
  );
  const [paying, setPaying] = useState(false);

  // If the guest paid but never made it back from eSewa/Khalti, ask the gateway once on open
  const rechecked = useRef(false);
  const unpaid = order ? order.paymentStatus !== 'paid' && order.status !== 'cancelled' : false;
  useEffect(() => {
    if (!unpaid || rechecked.current || notice) return;
    rechecked.current = true;
    api.payments.check(orderId).then((r) => { if (r.paid) setData(() => r.order); }, () => {});
  }, [unpaid, orderId, notice, setData]);

  if (loading && !order) return <><GuestHeader title="Your order" /><LoadingState /></>;
  if (!order) {
    if (error instanceof ApiError && error.status === 404) {
      return <><GuestHeader title="Your order" /><EmptyState icon="orders" title="Order not found" text="Please check the link or ask our staff for help." /></>;
    }
    return <><GuestHeader title="Your order" /><ErrorState error={error} onRetry={retry} /></>;
  }

  const current = STEPS.findIndex((s) => s.status === order.status);

  return (
    <div className="guest">
      <GuestHeader
        kicker="Thanks for ordering"
        title="Your order"
        chip={`${orderPlace(order)} · Bill ${billLabel(order)}`}
        action={order.tableId && (
          <Link to={`/table/${order.tableId}`} className="btn btn-accent btn-sm">
            <Icon name="plus" size={14} /> Order more
          </Link>
        )}
      />

      <main className={`guest-body stack${order.tableId ? ' has-menu-bar' : ''}`}>
        {notice && (
          <p className={`alert alert-${notice.kind}`} role="status" style={{ marginBottom: 0 }}>{notice.message}</p>
        )}
        <section className="card">
          <div className="card-header" style={{ marginBottom: 0 }}>
            <h2 className="card-title">Progress</h2>
            <span className="subtle">Placed at {formatTime(order.createdAt)}</span>
          </div>
          <div className="steps">
            {STEPS.map((step, i) => (
              <div key={step.status} className="row" style={{ flex: i < STEPS.length - 1 ? 1 : 0, gap: 0, flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                <div className="step">
                  <span className={`step-dot${i === current ? ' is-active' : i < current ? ' is-done' : ''}`}>
                    <Icon name={step.icon} size={16} />
                  </span>
                  <span className="step-label">{step.label}</span>
                </div>
                {i < STEPS.length - 1 && <span className={`step-line${i < current ? ' is-done' : ''}`} />}
              </div>
            ))}
          </div>
          <p className={`alert ${MESSAGE[order.status].tone}`} style={{ marginBottom: 0 }}>{MESSAGE[order.status].text}</p>
        </section>

        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 'var(--space-3)' }}>Details</h2>
          <ul className="line-items">
            {order.items.map((item, i) => (
              <li key={i}>
                <span>{item.name} <span className="muted">× {item.quantity}</span></span>
                <span className="nowrap">{money(item.subtotal)}</span>
              </li>
            ))}
          </ul>
          {order.customerNote && <p className="ticket-note" style={{ marginTop: 'var(--space-3)' }}>Note: {order.customerNote}</p>}
          <div className="totals section-gap">
            <div><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
            {order.discount > 0 && <div><span>Discount</span><span>−{money(order.discount)}</span></div>}
            {order.serviceCharge > 0 && <div><span>Service charge</span><span>{money(order.serviceCharge)}</span></div>}
            {order.tax > 0 && <div><span>VAT</span><span>{money(order.tax)}</span></div>}
            <div className="grand"><span>Total</span><span>{money(order.totalAmount)}</span></div>
          </div>
        </section>

        {order.status !== 'cancelled' && <section className="card">
          <div className="card-header">
            <h2 className="card-title">Payment</h2>
            <span className={`badge badge-${order.paymentStatus}`}>
              {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'pending_counter' ? 'Pay at counter' : 'Unpaid'}
            </span>
          </div>
          {order.paymentStatus === 'paid' && (
            <p className="alert alert-success" style={{ marginBottom: 0 }}>
              {money(order.totalAmount)} received via {order.paymentMethod ? PAYMENT_LABEL[order.paymentMethod] : 'counter'}. Thank you!
              {order.paymentRef && <><br /><span className="subtle">Transaction ref: {order.paymentRef}</span></>}
            </p>
          )}
          {order.paymentStatus === 'pending_counter' && (
            <p className="alert alert-warning">Please pay {money(order.totalAmount)} at the counter, or pay online below.</p>
          )}
          {order.paymentStatus !== 'paid' && (
            <>
              {order.paymentStatus === 'unpaid' && <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>Kindly settle your bill at the counter. Online checkout is on the way!</p>}
              {SHOW_PAY_ONLINE_BUTTON && (
                <button className="btn btn-primary btn-block btn-lg" onClick={() => setPaying(true)}>
                  Pay online · {money(order.totalAmount)}
                </button>
              )}
            </>
          )}
        </section>}
      </main>

      {order.tableId && (
        <div className="menu-bar">
          <Link to={`/table/${order.tableId}`} className="btn btn-primary btn-lg menu-bar-btn">
            <Icon name="menu" size={18} />
            <span>Back to menu<span className="menu-bar-extra"> · Order more</span></span>
          </Link>
        </div>
      )}

      {paying && (
        <Modal title="Pay online" onClose={() => setPaying(false)}>
          <OnlinePayment order={order} />
        </Modal>
      )}
    </div>
  );
}
