import type { Order, OrderStatus, OrderType, PaymentMethod } from '../types';

export function formatMoney(amount: number, currency: string) {
  // Whole amounts stay clean ("Rs. 450"); anything with paisa always shows two decimals ("Rs. 994.40")
  const digits = Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2;
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function formatQty(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} · ${formatTime(iso)}`;
}

export function timeSince(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  return `${Math.floor(seconds / 86400)} d ago`;
}

export const shortId = (id: string) => id.slice(0, 6).toUpperCase();
export const billLabel = (order: Pick<Order, 'billNo'>) => `#${String(order.billNo).padStart(5, '0')}`;

/** "Table 4" or "Takeaway" */
export const orderPlace = (order: Pick<Order, 'type' | 'tableNumber'>) =>
  order.type === 'takeaway' || order.tableNumber == null ? 'Takeaway' : `Table ${order.tableNumber}`;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pending',
  cooking: 'Cooking',
  serving: 'Ready to serve',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  esewa: 'eSewa',
  khalti: 'Khalti',
  counter: 'Counter',
};

export const ORDER_TYPE_LABEL: Record<OrderType, string> = {
  dine_in: 'Dine-in',
  takeaway: 'Takeaway',
};

export function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
