import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts';
import AdminLayout from './AdminLayout';
import { api } from '../../api/client';
import type { Order, OrderStatus } from '../../types';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending', cooking: 'Cooking', serving: 'Serving', completed: 'Completed',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  esewa: 'eSewa', khalti: 'Khalti', counter: 'Counter',
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const PIE_COLORS = ['#2d6a4f', '#c0392b', '#fd7e14'];

export default function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [confirming, setConfirming] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const data = await api.orders.getAll();
      setOrders(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 8000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  async function updateStatus(orderId: string, status: OrderStatus) {
    try {
      const updated = await api.orders.updateStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      if (selectedOrder?.id === orderId) setSelectedOrder(updated);
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function confirmPayment(orderId: string) {
    setConfirming(true);
    try {
      const updated = await api.orders.confirmPayment(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      setSelectedOrder(updated);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setConfirming(false);
    }
  }

  const paidOrders = orders.filter((o) => o.paymentStatus === 'paid');
  const unpaidOrders = orders.filter((o) => o.paymentStatus !== 'paid');
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    cooking: orders.filter((o) => o.status === 'cooking').length,
    serving: orders.filter((o) => o.status === 'serving').length,
    revenue: paidOrders.reduce((s, o) => s + o.totalAmount, 0),
    cashPending: unpaidOrders.reduce((s, o) => s + o.totalAmount, 0),
  };

  const statusChartData = [
    { name: 'Pending', count: stats.pending, fill: '#fd7e14' },
    { name: 'Cooking', count: stats.cooking, fill: '#0dcaf0' },
    { name: 'Serving', count: stats.serving, fill: '#2d6a4f' },
    { name: 'Done', count: orders.filter((o) => o.status === 'completed').length, fill: '#adb5bd' },
  ];

  const paymentChartData = [
    { name: 'Paid', value: paidOrders.length },
    { name: 'Unpaid', value: unpaidOrders.length },
  ].filter((d) => d.value > 0);

  const revenueByMethod = ['esewa', 'khalti', 'counter'].map((m) => ({
    name: PAYMENT_METHOD_LABEL[m],
    revenue: paidOrders.filter((o) => o.paymentMethod === m).reduce((s, o) => s + o.totalAmount, 0),
  })).filter((d) => d.revenue > 0);

  const filteredOrders = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;

  return (
    <AdminLayout>
      <div className="page-header">
        <h1>Orders Dashboard</h1>
        <button className="btn btn-secondary btn-sm" onClick={fetchOrders}>Refresh</button>
      </div>

      {/* Stat cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Total Orders</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#856404' }}>{stats.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#055160' }}>{stats.cooking}</div>
          <div className="stat-label">Cooking</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: '#0a3622' }}>{stats.serving}</div>
          <div className="stat-label">Serving</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '1.5rem' }}>Rs. {stats.revenue.toLocaleString()}</div>
          <div className="stat-label">Revenue Collected</div>
        </div>
        {stats.cashPending > 0 && (
          <div className="stat-card" style={{ borderLeft: '4px solid #fd7e14' }}>
            <div className="stat-value" style={{ color: '#856404', fontSize: '1.5rem' }}>Rs. {stats.cashPending.toLocaleString()}</div>
            <div className="stat-label">Cash Pending</div>
          </div>
        )}
      </div>

      {/* Charts row */}
      {orders.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Orders by Status</h3>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={statusChartData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" name="Orders" radius={[5, 5, 0, 0]}>
                  {statusChartData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Payment Breakdown</h3>
            <ResponsiveContainer width="100%" height={190}>
              <PieChart>
                <Pie data={paymentChartData} cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={4} dataKey="value">
                  {paymentChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {revenueByMethod.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Revenue by Method (Rs.)</h3>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={revenueByMethod} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => `Rs. ${Number(v).toLocaleString()}`} />
                  <Bar dataKey="revenue" name="Revenue" fill="#2d6a4f" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Orders table */}
      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['', 'pending', 'cooking', 'serving', 'completed'].map((s) => (
              <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>
                {s === '' ? 'All' : STATUS_LABELS[s as OrderStatus]}
                {s === 'pending' && stats.pending > 0 && (
                  <span style={{ background: '#fd7e14', color: '#fff', borderRadius: 10, padding: '0 5px', fontSize: '0.7rem', marginLeft: 4 }}>
                    {stats.pending}
                  </span>
                )}
              </button>
            ))}
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}</span>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="spinner" />
        ) : filteredOrders.length === 0 ? (
          <p className="text-muted text-center" style={{ padding: '2rem 0' }}>No orders found.</p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Table</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th><th>Time</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td><strong>T{order.tableNumber}</strong></td>
                    <td>{order.items.reduce((s, i) => s + i.quantity, 0)} item(s)</td>
                    <td>Rs. {order.totalAmount.toLocaleString()}</td>
                    <td><span className={`badge badge-${order.status}`}>{STATUS_LABELS[order.status]}</span></td>
                    <td>
                      <span className={`badge badge-${order.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                        {order.paymentStatus === 'paid'
                          ? `Paid (${order.paymentMethod ? PAYMENT_METHOD_LABEL[order.paymentMethod] || order.paymentMethod : '?'})`
                          : 'Unpaid'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDate(order.createdAt)} {formatTime(order.createdAt)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(order)}>View</button>
                        {order.status !== 'completed' && (
                          <select className="form-control" style={{ padding: '4px 8px', fontSize: '0.8rem', width: 'auto' }} value={order.status} onChange={(e) => updateStatus(order.id, e.target.value as OrderStatus)}>
                            <option value="pending">Pending</option>
                            <option value="cooking">Cooking</option>
                            <option value="serving">Serving</option>
                            <option value="completed">Completed</option>
                          </select>
                        )}
                        {order.paymentStatus !== 'paid' && (
                          <button className="btn btn-sm" style={{ background: '#2d6a4f', color: '#fff' }} onClick={() => confirmPayment(order.id)}>
                            Confirm Cash
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Order detail modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Order — Table {selectedOrder.tableNumber}</h2>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>&times;</button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {new Date(selectedOrder.createdAt).toLocaleString()} &nbsp;&bull;&nbsp; #{selectedOrder.id.slice(0, 8)}
            </p>
            <table style={{ marginBottom: '1rem' }}>
              <thead><tr><th>Item</th><th>Qty</th><th>Subtotal</th></tr></thead>
              <tbody>
                {selectedOrder.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>Rs. {item.subtotal.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedOrder.customerNote && (
              <p style={{ background: '#fff3cd', padding: '6px 10px', borderRadius: 6, marginBottom: 10, fontSize: '0.9rem' }}>
                <strong>Note:</strong> {selectedOrder.customerNote}
              </p>
            )}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
              <strong>Total: Rs. {selectedOrder.totalAmount.toLocaleString()}</strong>
              <span className={`badge badge-${selectedOrder.paymentStatus === 'paid' ? 'paid' : 'unpaid'}`}>
                {selectedOrder.paymentStatus === 'paid'
                  ? `Paid via ${selectedOrder.paymentMethod ? PAYMENT_METHOD_LABEL[selectedOrder.paymentMethod] || selectedOrder.paymentMethod : '?'}`
                  : 'Unpaid'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <strong>Status:</strong>
              <span className={`badge badge-${selectedOrder.status}`}>{STATUS_LABELS[selectedOrder.status]}</span>
            </div>
            <div className="modal-footer">
              {selectedOrder.paymentStatus !== 'paid' && (
                <button className="btn btn-primary" disabled={confirming} onClick={() => confirmPayment(selectedOrder.id)}>
                  {confirming ? 'Confirming...' : 'Confirm Cash Received'}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
