import type { MenuItem, Portion } from '../types';

// Carts are keyed per item and portion: "12" is a full plate of item 12, "12~half" a half plate.
export type Cart = Record<string, number>;

export const PORTION_LABEL: Record<Portion, string> = { full: 'Full plate', half: 'Half plate' };

export const cartKey = (id: number, portion: Portion = 'full') => (portion === 'half' ? `${id}~half` : String(id));

export const hasHalf = (item: MenuItem) => item.halfPrice != null && item.halfPrice > 0;

export const portionPrice = (item: MenuItem, portion: Portion) => (portion === 'half' ? item.halfPrice ?? item.price : item.price);

export interface CartLine {
  key: string;
  item: MenuItem;
  portion: Portion;
  qty: number;
  unitPrice: number;
}

/** Cart contents in menu order, full plate before half plate. */
export function cartLines(items: MenuItem[], cart: Cart): CartLine[] {
  const lines: CartLine[] = [];
  for (const item of items) {
    for (const portion of ['full', 'half'] as const) {
      const qty = cart[cartKey(item.id, portion)] || 0;
      if (qty > 0) lines.push({ key: cartKey(item.id, portion), item, portion, qty, unitPrice: portionPrice(item, portion) });
    }
  }
  return lines;
}

/** Adds `delta` to a cart line (max 50), removing it at zero. */
export function bumpCart(prev: Cart, key: string, delta: number): Cart {
  const next = { ...prev };
  const qty = Math.min((prev[key] || 0) + delta, 50);
  if (qty <= 0) delete next[key];
  else next[key] = qty;
  return next;
}

/** Order request lines; full plates send no portion so the request looks exactly as before. */
export const orderItems = (lines: CartLine[]) =>
  lines.map((l) => ({ menuItemId: String(l.item.id), quantity: l.qty, ...(l.portion === 'half' && { portion: 'half' as const }) }));
