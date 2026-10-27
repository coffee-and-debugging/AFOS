import { useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../../api/client';
import ExpandableText from '../../components/ExpandableText';
import FoodVisual from '../../components/FoodVisual';
import GuestHeader from '../../components/GuestHeader';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { billLabel } from '../../lib/format';
import { bumpCart, cartKey, cartLines, hasHalf, orderItems, PORTION_LABEL, type Cart } from '../../lib/portions';
import type { MenuItem, Order } from '../../types';

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
  const [details, setDetails] = useState<MenuItem | null>(null);
  /** null = search bar closed */
  const [search, setSearch] = useState<string | null>(null);
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
  const bump = (key: string, delta: number) => setCart((prev) => bumpCart(prev, key, delta));

  const cartItems = cartLines(items, cart);
  const cartCount = cartItems.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cartItems.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const term = (search ?? '').trim().toLowerCase();
  const matches = (m: MenuItem) => !term || [m.name, m.description, m.ingredients].some((t) => t?.toLowerCase().includes(term));
  const sections = categories
    .filter((c) => category === 'all' || c.slug === category)
    .map((c) => ({ ...c, items: items.filter((m) => m.category === c.slug && matches(m)) }))
    .filter((c) => c.items.length > 0);

  function openSearch() {
    setCategory('all'); // search the whole menu; tabs still narrow the results
    setSearch('');
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const order = await api.orders.create({
        tableId,
        items: orderItems(cartItems),
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
          <div className="guest-actions">
            <button className="icon-btn" onClick={() => (search === null ? openSearch() : setSearch(null))} aria-label={search === null ? 'Search the menu' : 'Close search'} aria-expanded={search !== null}>
              <Icon name={search === null ? 'search' : 'close'} />
            </button>
            <button className="icon-btn" onClick={() => setShowCart(true)} aria-label={`View cart, ${cartCount} items`}>
              <Icon name="cart" />
              {cartCount > 0 && <span className="icon-btn-badge">{cartCount}</span>}
            </button>
          </div>
        }
      />

      <nav className="guest-tabs" aria-label="Menu categories">
        {search !== null && (
          <div className="guest-search" role="search">
            <input
              className="input input-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setSearch(null)}
              placeholder="Search dishes"
              aria-label="Search the menu"
              enterKeyHint="search"
              autoFocus
            />
            {search && (
              <button className="guest-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <Icon name="close" size={16} />
              </button>
            )}
          </div>
        )}
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

        {sections.length === 0 && (term
          ? <EmptyState icon="menu" title={`No dishes match “${search?.trim()}”`} />
          : <EmptyState icon="menu" title="Menu coming right up" text="Please check back in a moment." />)}

        {sections.map((section) => (
          <section key={section.slug}>
            <h2 className="section-title">{section.name}</h2>
            <div className="item-grid">
              {section.items.map((item) => (
                <ItemCard key={item.id} item={item} cart={cart} money={money} onQty={bump} onDetails={() => setDetails(item)} />
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

      {details && (
        <Modal title={details.name} onClose={() => setDetails(null)}>
          <div className="item-detail-media"><FoodVisual imageUrl={details.imageUrl} category={details.category} /></div>
          {details.description && <p className="item-detail-text">{details.description}</p>}
          {details.ingredients && (
            <>
              <h3 className="item-detail-label">Ingredients</h3>
              <p className="item-detail-text">{details.ingredients}</p>
            </>
          )}
          <p className="price" style={{ margin: 0 }}>
            {money(details.price)}
            {hasHalf(details) && <span className="subtle"> · {PORTION_LABEL.half} {money(details.halfPrice!)}</span>}
          </p>
        </Modal>
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
                {cartItems.map(({ key, item, portion, qty, unitPrice }) => (
                  <div key={key} className="cart-row">
                    <div className="cart-thumb"><FoodVisual imageUrl={item.imageUrl} category={item.category} iconSize={20} /></div>
                    <div className="cart-info">
                      <div className="item-name">{item.name}</div>
                      {hasHalf(item) && <div className={`portion-tag is-${portion}`}>{PORTION_LABEL[portion]}</div>}
                      <div className="price">{money(unitPrice * qty)}</div>
                    </div>
                    <Quantity qty={qty} onChange={(d) => bump(key, d)} label={`${item.name}${portion === 'half' ? ' half plate' : ''}`} />
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

function ItemCard({ item, cart, money, onQty, onDetails }: {
  item: MenuItem;
  cart: Cart;
  money: (n: number) => string;
  onQty: (key: string, delta: number) => void;
  onDetails: () => void;
}) {
  // Items with a half-plate price get a Full and a Half row; everything else is unchanged
  const portions = hasHalf(item)
    ? [{ portion: 'full' as const, price: item.price }, { portion: 'half' as const, price: item.halfPrice! }]
    : [{ portion: 'full' as const, price: item.price }];

  return (
    <article className={`item-card${item.available ? '' : ' is-unavailable'}`}>
      <div className="item-media">
        <FoodVisual imageUrl={item.imageUrl} category={item.category} />
        {!item.available && <span className="item-soldout">Not Available</span>}
      </div>
      <div className="item-body">
        <h3 className="item-name">{item.name}</h3>
        {/* "See more" opens the full description and ingredients; nothing is rendered when there is neither */}
        {item.description
          ? <ExpandableText text={item.description} className="item-desc" onMore={onDetails} forceMore={!!item.ingredients} />
          : item.ingredients && <button type="button" className="link-button see-more" onClick={onDetails}>See more</button>}
        {portions.map(({ portion, price }) => {
          const key = cartKey(item.id, portion);
          const qty = cart[key] || 0;
          const label = portions.length > 1 ? `${item.name} ${PORTION_LABEL[portion].toLowerCase()}` : item.name;
          return (
            <div key={portion} className={`item-foot${portions.length > 1 ? ' item-portion' : ''}`}>
              <span>
                {portions.length > 1 && <span className="item-portion-label">{PORTION_LABEL[portion]}</span>}
                <span className="price">{money(price)}</span>
              </span>
              {item.available && (qty > 0
                ? <Quantity qty={qty} onChange={(d) => onQty(key, d)} label={label} />
                : <button className="qty-btn is-primary" onClick={() => onQty(key, 1)} aria-label={`Add ${label}`}><Icon name="plus" size={16} /></button>)}
            </div>
          );
        })}
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
