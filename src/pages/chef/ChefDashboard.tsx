import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, clearAuth, getAuthUser } from '../../api/client';
import type { Order, OrderStatus } from '../../types';

const STATUS_SEQUENCE: OrderStatus[] = ['pending', 'cooking', 'serving', 'completed'];

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  cooking: 'Cooking',
  serving: 'Serving',
  completed: 'Completed',
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'cooking',
  cooking: 'serving',
  serving: 'completed',
};

function getNextLabel(status: OrderStatus): string | null {
  const next = NEXT_STATUS[status];
  return next ? `Mark as ${STATUS_LABELS[next]}` : null;
}

function timeSince(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function ChefDashboard() {
  const navigate = useNavigate();
  const user = getAuthUser();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.orders.getAll();
      setOrders(data);
    } catch {
      // silently retry on next poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 5000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  async function advanceStatus(order: Order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    try {
      const updated = await api.orders.updateStatus(order.id, next);
      setOrders((prev) => prev.map((o) => (o.id === order.id ? updated : o)));
    } catch (err) {
      alert((err as Error).message);
    }
  }

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  const displayed = orders.filter((o) => {
    if (filter === 'active') return o.status === 'pending' || o.status === 'cooking';
    if (filter === 'serving') return o.status === 'serving';
    if (filter === 'completed') return o.status === 'completed';
    return true;
  });

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const cookingCount = orders.filter((o) => o.status === 'cooking').length;
  const completedCount = orders.filter((o) => o.status === 'completed').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top bar */}
      <header style={{ background: 'var(--primary)', color: '#fff', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.2rem' }}>Chef Station</h1>
          <span style={{ fontSize: '0.8rem', opacity: 0.8 }}>Welcome, {user?.name}</span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {pendingCount > 0 && (
            <span style={{ background: '#fd7e14', color: '#fff', borderRadius: 20, padding: '2px 10px', fontSize: '0.8rem', fontWeight: 700 }}>
              {pendingCount} new
            </span>
          )}
          <button
            style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', padding: '6px 14px', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </header>

      <div className="chef-layout">
        {/* Stats row */}
        <div className="stats-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#856404' }}>{pendingCount}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#055160' }}>{cookingCount}</div>
            <div className="stat-label">Cooking</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#0a3622' }}>{orders.filter((o) => o.status === 'serving').length}</div>
            <div className="stat-label">Serving</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: '#6c757d' }}>{completedCount}</div>
            <div className="stat-label">Completed</div>
          </div>
        </div>

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: '1rem' }}>
          {[
            { key: 'active', label: 'Active' },
            { key: 'serving', label: 'Serving' },
            { key: 'completed', label: 'Completed' },
            { key: 'all', label: 'All' },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`btn btn-sm ${filter === key ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="spinner" />
        ) : displayed.length === 0 ? (
          <div className="card text-center" style={{ padding: '3rem' }}>
            <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)' }}>No orders in this view.</p>
          </div>
        ) : (
          <div className="orders-grid">
            {displayed.map((order) => {
              const nextLabel = getNextLabel(order.status);
              const stepIdx = STATUS_SEQUENCE.indexOf(order.status);
              return (
                <div key={order.id} className={`card order-card ${order.status}`}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <strong style={{ fontSize: '1.05rem' }}>Table {order.tableNumber}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        #{order.id.slice(0, 8)} &bull; {timeSince(order.createdAt)}
                      </div>
                    </div>
                    <span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status]}</span>
                  </div>

                  {/* Items */}
                  <div style={{ marginBottom: 10 }}>
                    {order.items.map((item, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '3px 0', borderBottom: i < order.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <span>{item.name}</span>
                        <strong>x{item.quantity}</strong>
                      </div>
                    ))}
                  </div>

                  {order.customerNote && (
                    <div style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', padding: '6px 10px', borderRadius: 6, fontSize: '0.82rem', marginBottom: 10 }}>
                      Note: {order.customerNote}
                    </div>
                  )}

                  {/* Progress dots */}
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 12 }}>
                    {STATUS_SEQUENCE.slice(0, 3).map((s, i) => (
                      <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <div style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: i <= stepIdx ? 'var(--primary)' : 'var(--border)',
                        }} />
                        {i < 2 && <div style={{ width: 18, height: 2, background: i < stepIdx ? 'var(--primary)' : 'var(--border)' }} />}
                      </div>
                    ))}
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                      {STATUS_LABELS[order.status]}
                    </span>
                  </div>

                  {nextLabel && (
                    <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => advanceStatus(order)}>
                      {nextLabel}
                    </button>
                  )}
                  {order.status === 'completed' && (
                    <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#6c757d', padding: '6px 0', background: '#f8f9fa', borderRadius: 6 }}>
                      ✓ Order completed
                      {order.paymentStatus === 'paid' && <span style={{ marginLeft: 8, color: '#0a3622', fontWeight: 600 }}>· Paid ({order.paymentMethod?.toUpperCase()})</span>}
                      {order.paymentStatus === 'pending_counter' && <span style={{ marginLeft: 8, color: '#856404', fontWeight: 600 }}>· Pay at counter</span>}
                      {order.paymentStatus === 'unpaid' && <span style={{ marginLeft: 8, color: '#842029', fontWeight: 600 }}>· Unpaid</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
