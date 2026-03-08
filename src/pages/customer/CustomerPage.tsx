import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../api/client';
import type { MenuItem, Order } from '../../types/index';

type Cart = Record<string, number>;

const STORAGE_KEY = (tableId: string) => `afos_orders_${tableId}`;

function loadSavedOrderIds(tableId: string): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY(tableId)) || '[]'); }
  catch { return []; }
}

function saveOrderId(tableId: string, orderId: string) {
  const ids = loadSavedOrderIds(tableId);
  if (!ids.includes(orderId)) {
    localStorage.setItem(STORAGE_KEY(tableId), JSON.stringify([orderId, ...ids]));
  }
}

const STATUS_COLOR: Record<string, string> = {
  pending:   '#856404',
  cooking:   '#055160',
  serving:   '#0a3622',
  completed: '#41464b',
};
const STATUS_BG: Record<string, string> = {
  pending:   '#fff3cd',
  cooking:   '#cff4fc',
  serving:   '#d1e7dd',
  completed: '#e2e3e5',
};
const STATUS_LABEL: Record<string, string> = {
  pending: 'Received', cooking: 'Cooking', serving: 'Ready!', completed: 'Done',
};

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
  const [trackedOrders, setTrackedOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.menu.getAll()
      .then(setMenuItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const refreshTracked = useCallback(async () => {
    if (!tableId) return;
    const ids = loadSavedOrderIds(tableId);
    if (ids.length === 0) return;
    const results = await Promise.allSettled(ids.map((id) => api.orders.getById(id)));
    const orders = results
      .filter((r): r is PromiseFulfilledResult<Order> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((o) => o.status !== 'completed' || o.paymentStatus !== 'paid');
    setTrackedOrders(orders);
  }, [tableId]);

  useEffect(() => {
    refreshTracked();
    const id = setInterval(refreshTracked, 6000);
    return () => clearInterval(id);
  }, [refreshTracked]);

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
      saveOrderId(tableId!, order.id);
      navigate(`/order/${order.id}`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  const tableNumber = tableId?.replace('table-', '');
  const teas = menuItems.filter((m) => m.category === 'tea');
  const foods = menuItems.filter((m) => m.category === 'food');

  const FALLBACK_IMG = {
    tea:  'https://picsum.photos/seed/teatime/400/260',
    food: 'https://picsum.photos/seed/foodplate/400/260',
  };

  function imgSrc(item: MenuItem) {
    if (item.imageUrl) return item.imageUrl;
    return FALLBACK_IMG[item.category];
  }

  function renderCard(item: MenuItem) {
    const qty = cart[item.id] || 0;
    return (
      <div key={item.id} className={`item-card${!item.available ? ' item-card-unavailable' : ''}`}>
        <div className="item-card-img-wrap">
          <img src={imgSrc(item)} alt={item.name} className="item-card-photo" loading="lazy" />
          {!item.available && <span className="item-card-sold-out">Not Available</span>}
          {qty > 0 && <span className="item-card-qty-badge">{qty}</span>}
        </div>
        <div className="item-card-body">
          <div className="item-card-name">{item.name}</div>
          {item.description && <div className="item-card-desc">{item.description}</div>}
          <div className="item-card-footer">
            <span className="item-card-price">Rs. {item.price}</span>
            {item.available && (
              qty > 0 ? (
                <div className="qty-control">
                  <button className="qty-btn" onClick={() => setQty(item.id, qty - 1)}>−</button>
                  <span className="qty-value">{qty}</span>
                  <button className="qty-btn qty-btn-add" onClick={() => setQty(item.id, qty + 1)}>+</button>
                </div>
              ) : (
                <button className="add-btn" onClick={() => setQty(item.id, 1)}>+ Add</button>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: '2rem' }}><div className="spinner" /></div>;
  if (error) return <div style={{ padding: '2rem' }}><div className="alert alert-error">{error}</div></div>;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f3ef' }}>

      {/* Hero header */}
      <header className="menu-hero">
        <button
          className="cart-header-btn"
          onClick={() => setShowCart(true)}
          aria-label="View cart"
        >
          🛒
          {cartCount > 0 && <span className="cart-header-badge">{cartCount}</span>}
        </button>
        <div className="menu-hero-inner">
          <h1 className="menu-shop-title">☕ Tea Shop</h1>
          <div className="menu-table-badge">Table {tableNumber}</div>
          <p className="menu-shop-sub">Scan · Order · Enjoy</p>
        </div>
      </header>

      {/* Sticky category nav */}
      <div className="menu-nav">
        {(['all', 'tea', 'food'] as const).map((c) => (
          <button key={c} className={`menu-nav-btn${category === c ? ' active' : ''}`} onClick={() => setCategory(c)}>
            {c === 'all' ? 'All Items' : c === 'tea' ? '☕ Teas' : '🍽 Food'}
          </button>
        ))}
      </div>

      {/* Active orders tracker */}
      {trackedOrders.length > 0 && (
        <div className="tracked-orders-bar">
          <div className="tracked-orders-label">Your Orders</div>
          <div className="tracked-orders-list">
            {trackedOrders.map((order) => (
              <button
                key={order.id}
                className="tracked-order-card"
                onClick={() => navigate(`/order/${order.id}`)}
              >
                <div className="tracked-order-top">
                  <span className="tracked-order-id">#{order.id.slice(0, 6)}</span>
                  <span
                    className="tracked-order-status"
                    style={{ background: STATUS_BG[order.status], color: STATUS_COLOR[order.status] }}
                  >
                    {STATUS_LABEL[order.status]}
                  </span>
                </div>
                <div className="tracked-order-amount">Rs. {order.totalAmount.toLocaleString()}</div>
                <div className="tracked-order-tap">Tap to track →</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Menu cards */}
      <div className="menu-page-body">
        {category === 'all' ? (
          <>
            {teas.length > 0 && (
              <>
                <div className="menu-section-header"><span>☕ Teas</span></div>
                <div className="item-grid">{teas.map(renderCard)}</div>
              </>
            )}
            {foods.length > 0 && (
              <>
                <div className="menu-section-header"><span>🍽 Food</span></div>
                <div className="item-grid">{foods.map(renderCard)}</div>
              </>
            )}
          </>
        ) : (
          <div className="item-grid">{displayed.map(renderCard)}</div>
        )}
      </div>

      {/* Sticky cart summary bar */}
      {cartCount > 0 && (
        <div className="cart-bar">
          <div className="cart-bar-info">
            <strong>{cartCount} item{cartCount !== 1 ? 's' : ''}</strong>
            <span>Rs. {cartTotal.toLocaleString()}</span>
          </div>
          <button onClick={() => setShowCart(true)}>View Cart →</button>
        </div>
      )}

      {/* Cart modal */}
      {showCart && (
        <div className="modal-overlay" onClick={() => setShowCart(false)}>
          <div className="cart-modal" onClick={(e) => e.stopPropagation()}>

            <div className="cart-modal-header">
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Your Cart</h2>
                {cartCount > 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cartCount} item{cartCount !== 1 ? 's' : ''}</span>
                )}
              </div>
              <button className="modal-close" onClick={() => setShowCart(false)}>&times;</button>
            </div>

            {cartItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🛒</div>
                <div>Your cart is empty</div>
                <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => setShowCart(false)}>Browse Menu</button>
              </div>
            ) : (
              <>
                <div className="cart-items-list">
                  {cartItems.map((item) => (
                    <div key={item.id} className="cart-item-row">
                      <img src={imgSrc(item)} alt={item.name} className="cart-item-thumb" />
                      <div className="cart-item-info">
                        <div className="cart-item-name">{item.name}</div>
                        <div className="cart-item-price">Rs. {(item.price * (cart[item.id] || 0)).toLocaleString()}</div>
                      </div>
                      <div className="cart-item-controls">
                        <button className="qty-btn" onClick={() => setQty(item.id, (cart[item.id] || 1) - 1)}>−</button>
                        <span className="qty-value">{cart[item.id]}</span>
                        <button className="qty-btn qty-btn-add" onClick={() => setQty(item.id, (cart[item.id] || 0) + 1)}>+</button>
                        <button className="cart-remove-btn" onClick={() => setQty(item.id, 0)} title="Remove">🗑</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="cart-total-row">
                  <span>Total</span>
                  <strong>Rs. {cartTotal.toLocaleString()}</strong>
                </div>

                <div className="cart-note-wrap">
                  <div className="cart-note-label">Special Note <span>(optional)</span></div>
                  <textarea
                    className="cart-note-input"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Allergies, extra sugar, no ice..."
                    rows={2}
                  />
                </div>

                <div className="cart-modal-footer">
                  <button className="btn btn-secondary" onClick={() => setShowCart(false)}>Back to Menu</button>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={placeOrder} disabled={placing}>
                    {placing ? 'Placing...' : `Place Order · Rs. ${cartTotal.toLocaleString()}`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
