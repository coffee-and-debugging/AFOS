import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import FoodVisual from '../../components/FoodVisual';
import GuestHeader from '../../components/GuestHeader';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { billLabel } from '../../lib/format';
import type { MenuItem, Order } from '../../types';

type Cart = Record<number, number>;

const storageKey = (tableId: string) => `afos_orders_${tableId}`;

function savedOrderIds(tableId: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(tableId)) || '[]');
  } catch {
    return [];
  }
}

function rememberOrder(tableId: string, orderId: string) {
  const ids = savedOrderIds(tableId).filter((id) => id !== orderId);
  localStorage.setItem(storageKey(tableId), JSON.stringify([orderId, ...ids].slice(0, 10)));
}

const GUEST_STATUS: Record<Order['status'], string> = {
  pending: 'Received', cooking: 'Cooking', serving: 'Ready', completed: 'Served', cancelled: 'Cancelled',
};


export default function CustomerPage() {
  const { tableId = '' } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { money, restaurant } = useRestaurant();
  const toast = useToast();

  // The QR code carries the table's random id; ask the API which table number that is
  const loadMenu = useCallback(
    () => Promise.all([api.menu.getAll(), api.categories.getAll(), api.tables.getPublic(tableId)]),
    [tableId],
  );
  const menu = usePolling(loadMenu, 8000);
  const loadTracked = useCallback(async () => {
    const results = await Promise.allSettled(savedOrderIds(tableId).map((id) => api.orders.getById(id)));
    return results
      .filter((r): r is PromiseFulfilledResult<Order> => r.status === 'fulfilled')
      .map((r) => r.value)
      .filter((o) => o.status !== 'cancelled' && (o.status !== 'completed' || o.paymentStatus !== 'paid'));
  }, [tableId]);
  const tracked = usePolling(loadTracked, 6000);

  const [cart, setCart] = useState<Cart>({});
  const [category, setCategory] = useState('all');
  const [note, setNote] = useState('');
  const [showCart, setShowCart] = useState(false);
  const [placing, setPlacing] = useState(false);

  if (menu.loading && !menu.data) return <><GuestHeader /><LoadingState label="Loading the menu…" /></>;
  if (!menu.data) {
    if (menu.error instanceof ApiError && menu.error.status === 404) {
      return <><GuestHeader /><EmptyState icon="qr" title="This QR code isn't valid any more" text={menu.error.message} /></>;
    }
    return <><GuestHeader /><ErrorState error={menu.error} onRetry={menu.retry} /></>;
  }

  const [items, categories, table] = menu.data;
  const tableNumber = table.number;
  // Delta-based so rapid taps are never lost to a stale render
  const bump = (id: number, delta: number) =>
    setCart((prev) => {
      const next = { ...prev };
      const qty = Math.min((prev[id] || 0) + delta, 50);
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const cartItems = items.filter((m) => (cart[m.id] || 0) > 0);
  const cartCount = cartItems.reduce((s, m) => s + cart[m.id], 0);
  const cartTotal = cartItems.reduce((s, m) => s + cart[m.id] * m.price, 0);
  const sections = categories
    .filter((c) => category === 'all' || c.slug === category)
    .map((c) => ({ ...c, items: items.filter((m) => m.category === c.slug) }))
    .filter((c) => c.items.length > 0);

  async function placeOrder() {
    setPlacing(true);
    try {
      const order = await api.orders.create({
        tableId,
        items: cartItems.map((m) => ({ menuItemId: String(m.id), quantity: cart[m.id] })),
        customerNote: note,
      });
      rememberOrder(tableId, order.id);
      navigate(`/order/${order.id}`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPlacing(false);
    }
  }

  const charges = [
    restaurant.serviceChargeRate ? `${restaurant.serviceChargeRate}% service` : '',
    restaurant.taxRate ? `${restaurant.taxRate}% VAT` : '',
  ].filter(Boolean).join(' and ');

  return (
    <div className="guest">
      <GuestHeader
        chip={`Table ${tableNumber}`}
        action={
          <button className="icon-btn" onClick={() => setShowCart(true)} aria-label={`View cart, ${cartCount} items`}>
            <Icon name="cart" />
            {cartCount > 0 && <span className="icon-btn-badge">{cartCount}</span>}
          </button>
        }
      />

      <nav className="guest-tabs" aria-label="Menu categories">
        <div className="guest-tabs-inner">
          <div className="segmented" role="tablist">
            {[{ slug: 'all', name: 'All' }, ...categories].map((c) => (
              <button key={c.slug} role="tab" aria-selected={category === c.slug} className="segmented-item" onClick={() => setCategory(c.slug)}>
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="guest-body">
        {tracked.data && tracked.data.length > 0 && (
          <section>
            <h2 className="section-title">Your orders</h2>
            <div className="tracked-strip">
              {tracked.data.map((order) => (
                <button key={order.id} className="tracked-card" onClick={() => navigate(`/order/${order.id}`)}>
                  <span className="row" style={{ justifyContent: 'space-between' }}>
                    <span className="bill-no">{billLabel(order)}</span>
                    <span className={`badge badge-${order.status}`}>{GUEST_STATUS[order.status]}</span>
                  </span>
                  <span className="price">{money(order.totalAmount)}</span>
                  <span className="subtle">Tap to track</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {sections.length === 0 && <EmptyState icon="menu" title="Menu coming right up" text="Please check back in a moment." />}

        {sections.map((section) => (
          <section key={section.slug}>
            <h2 className="section-title">{section.name}</h2>
            <div className="item-grid">
              {section.items.map((item) => (
                <ItemCard key={item.id} item={item} qty={cart[item.id] || 0} price={money(item.price)} onQty={(d) => bump(item.id, d)} />
              ))}
            </div>
          </section>
        ))}
      </main>

      {cartCount > 0 && (
        <div className="cart-bar">
          <div className="cart-bar-inner">
            <div>
              <strong>{cartCount} item{cartCount !== 1 && 's'}</strong>
              <div className="price">{money(cartTotal)}</div>
            </div>
            <button className="btn btn-accent btn-lg" onClick={() => setShowCart(true)}>Review order</button>
          </div>
        </div>
      )}

      {showCart && (
        <Modal
          title="Your order"
          onClose={() => setShowCart(false)}
          footer={cartItems.length > 0 && (
            <button className="btn btn-flame btn-block btn-lg" onClick={placeOrder} disabled={placing}>
              {placing ? 'Placing order…' : `Place order · ${money(cartTotal)}`}
            </button>
          )}
        >
          {cartItems.length === 0 ? (
            <EmptyState icon="cart" title="Your cart is empty" text="Add something from the menu to get started.">
              <button className="btn btn-secondary" onClick={() => setShowCart(false)}>Browse the menu</button>
            </EmptyState>
          ) : (
            <>
              <div className="cart-list">
                {cartItems.map((item) => (
                  <div key={item.id} className="cart-row">
                    <div className="cart-thumb"><FoodVisual imageUrl={item.imageUrl} category={item.category} iconSize={20} /></div>
                    <div className="cart-info">
                      <div className="item-name">{item.name}</div>
                      <div className="price">{money(item.price * cart[item.id])}</div>
                    </div>
                    <Quantity qty={cart[item.id]} onChange={(d) => bump(item.id, d)} label={item.name} />
                  </div>
                ))}
              </div>
              <div className="cart-total">
                <span>Subtotal</span>
                <span className="price">{money(cartTotal)}</span>
              </div>
              {charges && <p className="subtle" style={{ marginTop: 'calc(-1 * var(--space-3))', marginBottom: 'var(--space-4)' }}>Plus {charges}, shown on your bill.</p>}
              <label className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Note for the kitchen <span className="subtle">(optional)</span></span>
                <textarea className="input" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Allergies, extra spicy, no onions…" />
              </label>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

function ItemCard({ item, qty, price, onQty }: { item: MenuItem; qty: number; price: string; onQty: (delta: number) => void }) {
  return (
    <article className={`item-card${item.available ? '' : ' is-unavailable'}`}>
      <div className="item-media">
        <FoodVisual imageUrl={item.imageUrl} category={item.category} />
        {!item.available && <span className="item-soldout">Not Available</span>}
      </div>
      <div className="item-body">
        <h3 className="item-name">{item.name}</h3>
        {item.description && <p className="item-desc">{item.description}</p>}
        <div className="item-foot">
          <span className="price">{price}</span>
          {item.available && (qty > 0
            ? <Quantity qty={qty} onChange={onQty} label={item.name} />
            : <button className="qty-btn is-primary" onClick={() => onQty(1)} aria-label={`Add ${item.name}`}><Icon name="plus" size={16} /></button>)}
        </div>
      </div>
    </article>
  );
}

function Quantity({ qty, onChange, label }: { qty: number; onChange: (delta: number) => void; label: string }) {
  return (
    <div className="qty">
      <button className="qty-btn" onClick={() => onChange(-1)} aria-label={`Remove one ${label}`}>−</button>
      <span className="qty-value" aria-live="polite">{qty}</span>
      <button className="qty-btn is-primary" onClick={() => onChange(1)} aria-label={`Add one ${label}`}>+</button>
    </div>
  );
}
