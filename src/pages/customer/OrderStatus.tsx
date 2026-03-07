import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import PaymentGateway from '../../components/PaymentGateway';
import type { Order, OrderStatus } from '../../types';

const STEPS: { status: OrderStatus; label: string; icon: string }[] = [
  { status: 'pending', label: 'Received', icon: '✓' },
  { status: 'cooking', label: 'Cooking', icon: '♨' },
  { status: 'serving', label: 'Serving', icon: '☕' },
  { status: 'completed', label: 'Done', icon: '★' },
];

type PayStep = 'choose' | 'esewa' | 'khalti';

export default function OrderStatus() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payStep, setPayStep] = useState<PayStep>('choose');

  const fetchOrder = useCallback(async () => {
    try {
      const data = await api.orders.getById(orderId!);
      setOrder(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    fetchOrder();
    const id = setInterval(fetchOrder, 5000);
    return () => clearInterval(id);
  }, [fetchOrder]);

  async function handleGatewaySuccess(method: 'esewa' | 'khalti') {
    try {
      const updated = await api.orders.processPayment(orderId!, method);
      setOrder(updated);
      setShowPayModal(false);
      setPayStep('choose');
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function openPayModal() {
    setPayStep('choose');
    setShowPayModal(true);
  }

  if (loading) return <div style={{ padding: '2rem' }}><div className="spinner" /></div>;
  if (error || !order) return <div style={{ padding: '2rem' }}><div className="alert alert-error">{error || 'Order not found'}</div></div>;

  const currentStep = STEPS.findIndex((s) => s.status === order.status);

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ef' }}>
      <header className="menu-hero">
        <button
          className="cart-header-btn"
          onClick={() => navigate(`/table/${order.tableId}`)}
          title="New Order"
          style={{ fontSize: '0.75rem', width: 'auto', padding: '0 12px', borderRadius: 20, fontWeight: 700, letterSpacing: '0.02em' }}
        >
          + New Order
        </button>
        <div className="menu-hero-inner">
          <h1 className="menu-shop-title" style={{ fontSize: '1.6rem' }}>Order Status</h1>
          <div className="menu-table-badge">Table {order.tableNumber}</div>
          <p className="menu-shop-sub">#{order.id.slice(0, 8)}</p>
        </div>
      </header>

      <div className="order-status-page">
        {/* Status progress */}
        <div className="card">
          <h2 style={{ marginBottom: '0.25rem' }}>Order Progress</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: '0 0 1rem' }}>
            Placed at {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>

          <div className="status-progress">
            {STEPS.map((step, i) => {
              const isDone = i < currentStep;
              const isActive = i === currentStep;
              return (
                <div key={step.status} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                  <div className="status-step">
                    <div className={`status-dot ${isActive ? 'active' : isDone ? 'done' : ''}`}>{step.icon}</div>
                    <div className="status-label">{step.label}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`status-line ${isDone ? 'done' : ''}`} />}
                </div>
              );
            })}
          </div>

          {order.status === 'pending' && (
            <div className="alert" style={{ background: '#fff3cd', color: '#856404', border: '1px solid #ffecb5', textAlign: 'center' }}>
              Order received — waiting for the kitchen
            </div>
          )}
          {order.status === 'cooking' && (
            <div className="alert alert-info" style={{ textAlign: 'center' }}>
              The chef is preparing your order...
            </div>
          )}
          {order.status === 'serving' && (
            <div className="alert alert-success" style={{ textAlign: 'center', fontWeight: 600 }}>
              Your order is ready! Our staff will bring it to your table shortly.
            </div>
          )}
          {order.status === 'completed' && (
            <div className="alert alert-success" style={{ textAlign: 'center', fontWeight: 600 }}>
              Order complete — thank you for visiting!
            </div>
          )}
        </div>

        {/* Order items */}
        <div className="card" style={{ marginTop: '1rem' }}>
          <h3 style={{ marginBottom: '0.75rem' }}>Order Details</h3>
          {order.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span>{item.name} <span style={{ color: 'var(--text-muted)' }}>×{item.quantity}</span></span>
              <span>Rs. {item.subtotal.toLocaleString()}</span>
            </div>
          ))}
          {order.customerNote && (
            <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-muted)', background: '#fff3cd', padding: '6px 10px', borderRadius: 6 }}>
              Note: {order.customerNote}
            </p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.05rem', marginTop: 12, paddingTop: 10, borderTop: '2px solid var(--border)' }}>
            <span>Total</span>
            <span>Rs. {order.totalAmount.toLocaleString()}</span>
          </div>
        </div>

        {/* Payment */}
        <div className="card" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Payment</h3>
            <span className={`badge badge-${order.paymentStatus}`}>
              {order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'pending_counter' ? 'Pending (Counter)' : 'Unpaid'}
            </span>
          </div>

          {order.paymentStatus === 'paid' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#d1e7dd', borderRadius: 8 }}>
              <span style={{ fontSize: '1.3rem' }}>✓</span>
              <div>
                <div style={{ fontWeight: 700, color: '#0a3622' }}>Payment Confirmed</div>
                <div style={{ fontSize: '0.8rem', color: '#155724' }}>
                  Rs. {order.totalAmount.toLocaleString()} via {order.paymentMethod?.toUpperCase()}
                </div>
              </div>
            </div>
          )}

          {order.paymentStatus === 'pending_counter' && (
            <div style={{ padding: '10px 14px', background: '#fff3cd', borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: '#856404' }}>Please pay at the counter</div>
              <div style={{ fontSize: '0.85rem', color: '#856404', marginTop: 2 }}>
                Amount due: Rs. {order.totalAmount.toLocaleString()}
              </div>
            </div>
          )}

          {order.paymentStatus === 'unpaid' && (
            <div>
              <div style={{ padding: '10px 14px', background: '#f8f9fa', borderRadius: 8, marginBottom: 10, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                You can pay at the counter — or pay online below.
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '1rem' }}
                onClick={openPayModal}
              >
                Pay Online — Rs. {order.totalAmount.toLocaleString()}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {showPayModal && (
        <div className="modal-overlay" onClick={() => { setShowPayModal(false); setPayStep('choose'); }}>
          <div className="modal" style={{ padding: 0, overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
            {payStep === 'choose' && (
              <>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h2 style={{ margin: 0 }}>Pay Online</h2>
                  <button className="modal-close" onClick={() => setShowPayModal(false)}>&times;</button>
                </div>
                <div style={{ padding: '1.5rem' }}>
                  <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                    Total: <strong>Rs. {order.totalAmount.toLocaleString()}</strong>
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {/* eSewa */}
                    <button
                      className="pay-option-btn"
                      style={{ '--gw-color': '#60BB47' } as React.CSSProperties}
                      onClick={() => setPayStep('esewa')}
                    >
                      <span style={{ fontWeight: 900, fontSize: '1rem' }}>e<span style={{ fontWeight: 400 }}>Sewa</span></span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Pay with eSewa</span>
                    </button>

                    {/* Khalti */}
                    <button
                      className="pay-option-btn"
                      style={{ '--gw-color': '#5C2D91' } as React.CSSProperties}
                      onClick={() => setPayStep('khalti')}
                    >
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>Khalti</span>
                      <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Pay with Khalti</span>
                    </button>

                  </div>
                </div>
              </>
            )}

            {(payStep === 'esewa' || payStep === 'khalti') && (
              <div style={{ padding: '1rem' }}>
                <PaymentGateway
                  gateway={payStep}
                  amount={order.totalAmount}
                  onSuccess={() => handleGatewaySuccess(payStep)}
                  onCancel={() => setPayStep('choose')}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
