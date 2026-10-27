import type { OrderType, Restaurant } from '../types';
// Developed by Unique Adhikari

const round = (n: number) => Math.round(n * 100) / 100;

/** Splits one discount across orders by subtotal; the last takes the rounding remainder. Mirrors server/lib/orders.js. */
export function splitDiscount(subtotals: number[], discount: number) {
  const total = subtotals.reduce((s, x) => s + x, 0);
  const wanted = Math.min(Math.max(round(discount || 0), 0), round(total));
  let left = wanted;
  return subtotals.map((sub, i) => {
    const share = i === subtotals.length - 1 ? left : Math.min(round(total ? (wanted * sub) / total : 0), left);
    left = round(left - share);
    return share;
  });
}

/** Mirrors server/lib/orders.js computeTotals so the POS can preview the bill exactly. */
export function computeTotals(subtotal: number, discount: number, type: OrderType, settings: Pick<Restaurant, 'taxRate' | 'serviceChargeRate'>) {
  const disc = Math.min(Math.max(round(discount || 0), 0), subtotal);
  const base = subtotal - disc;
  const serviceCharge = type === 'dine_in' ? round((base * settings.serviceChargeRate) / 100) : 0;
  const tax = round(((base + serviceCharge) * settings.taxRate) / 100);
  return { subtotal: round(subtotal), discount: disc, serviceCharge, tax, totalAmount: round(base + serviceCharge + tax) };
}
