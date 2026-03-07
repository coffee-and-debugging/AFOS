import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { MenuItem } from '../../types';

type Cart = Record<string, number>;

export default function CustomerPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Cart>({});
  const [category, setCategory] = useState<'all' | 'tea' | 'food'>('all');
  const [note, setNote] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    api.menu.getAll()
      .then(setMenuItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      if (qty <= 0) { const next = { ...prev }; delete next[id]; return next; }
      return { ...prev, [id]: qty };
    });
  }

  const cartCount = Object.values(cart).reduce((s, q) => s + q, 0);
  const cartTotal = menuItems.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0);
  const cartItems = menuItems.filter((m) => (cart[m.id] || 0) > 0);
  const displayed = menuItems.filter((m) => category === 'all' || m.category === category);

  async function placeOrder() {
    if (cartCount === 0) return;
    setPlacing(true);
    try {
      const items = Object.entries(cart).map(([menuItemId, quantity]) => ({ menuItemId, quantity }));
      const order = await api.orders.create({ tableId: tableId!, items, customerNote: note });
      navigate(`/order/${order.id}`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  if (loading) return <div style={{ padding: '2rem' }}><div className="spinner" /></div>;
  if (error) return <div style={{ padding: '2rem' }}><div className="alert alert-error">{error}</div></div>;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header className="customer-header">
        <div>
          <h1>Tea Shop</h1>
          <span>Browse menu &amp; place your order</span>
        </div>
      </header>

      <div className="customer-layout">
        <div className="category-tabs">
          {(['all', 'tea', 'food'] as const).map((c) => (
            <button key={c} className={`tab-btn ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>
              {c === 'all' ? 'All Items' : c === 'tea' ? '☕ Teas' : '🍽 Food'}
            </button>
          ))}
        </div>

        <div className="menu-grid">
          {displayed.map((item) => {
            const qty = cart[item.id] || 0;
            return (
              <div key={item.id} className={`menu-item-card${!item.available ? ' unavailable' : ''}`}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: item.category === 'tea' ? 'var(--primary)' : '#8B4513', marginBottom: 2 }}>
                  {item.category === 'tea' ? '☕ Tea' : '🍽 Food'}
                </div>
                <div className="menu-item-name">{item.name}</div>
                <div className="menu-item-desc">{item.description}</div>
                <div className="menu-item-footer">
                  <span className="menu-item-price">Rs. {item.price}</span>
                  {item.available ? (
                    <div className="qty-control">
                      {qty > 0 && <button className="qty-btn" onClick={() => setQty(item.id, qty - 1)}>−</button>}
                      {qty > 0 && <span className="qty-value">{qty}</span>}
                      <button className="qty-btn" onClick={() => setQty(item.id, qty + 1)}>+</button>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', background: '#f0f0f0', padding: '2px 8px', borderRadius: 20 }}>Unavailable</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {cartCount > 0 && (
        <div className="cart-bar">
          <div className="cart-bar-info">
            <strong>{cartCount} item{cartCount !== 1 ? 's' : ''} selected</strong>
            Rs. {cartTotal.toLocaleString()} total
          </div>
          <button onClick={() => setShowCart(true)}>View Cart &rarr;</button>
        </div>
      )}

      {showCart && (
        <div className="modal-overlay" onClick={() => setShowCart(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Your Order</h2>
              <button className="modal-close" onClick={() => setShowCart(false)}>&times;</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              {cartItems.map((item) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Rs. {item.price} each</div>
                  </div>
                  <div className="qty-control">
                    <button className="qty-btn" onClick={() => setQty(item.id, (cart[item.id] || 1) - 1)}>−</button>
                    <span className="qty-value">{cart[item.id]}</span>
                    <button className="qty-btn" onClick={() => setQty(item.id, (cart[item.id] || 0) + 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '1rem', padding: '10px 0', borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Total</span>
              <span>Rs. {cartTotal.toLocaleString()}</span>
            </div>

            <div className="form-group">
              <label>Special Note (optional)</label>
              <input className="form-control" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Allergies, extra sugar, no ice..." />
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCart(false)}>Back to Menu</button>
              <button className="btn btn-primary" onClick={placeOrder} disabled={placing}>
                {placing ? 'Placing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
