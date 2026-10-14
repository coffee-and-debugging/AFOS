import type { OrderType, Restaurant } from '../types';

const round = (n: number) => Math.round(n * 100) / 100;

/** Mirrors server/lib/orders.js computeTotals so the POS can preview the bill exactly. */
export function computeTotals(subtotal: number, discount: number, type: OrderType, settings: Pick<Restaurant, 'taxRate' | 'serviceChargeRate'>) {
  const disc = Math.min(Math.max(round(discount || 0), 0), subtotal);
  const base = subtotal - disc;
  const serviceCharge = type === 'dine_in' ? round((base * settings.serviceChargeRate) / 100) : 0;
  const tax = round(((base + serviceCharge) * settings.taxRate) / 100);
  return { subtotal: round(subtotal), discount: disc, serviceCharge, tax, totalAmount: round(base + serviceCharge + tax) };
}
