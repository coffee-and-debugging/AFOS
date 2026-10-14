export interface Restaurant {
  name: string;
  tagline: string;
  currency: string;
  address: string;
  phone: string;
  taxRate: number;
  serviceChargeRate: number;
  receiptFooter: string;
  plan: Plan;
}

export type Plan = 'free' | 'pro';

export interface Category {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  available: boolean;
  imageUrl?: string | null;
}

export interface RecipeLine {
  stockItemId: number;
  quantity: number;
  stockItem?: { name: string; unit: string };
}

export interface Table {
  id: string;
  number: number;
  openOrders: number;
  openAmount: number;
  occupiedSince: string | null;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export type OrderStatus = 'pending' | 'cooking' | 'serving' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'pending_counter';
export type PaymentMethod = 'cash' | 'card' | 'esewa' | 'khalti' | 'counter';
export type StaffPaymentMethod = Exclude<PaymentMethod, 'counter'>;
export type OrderType = 'dine_in' | 'takeaway';

export interface Order {
  id: string;
  billNo: number;
  type: OrderType;
  source: 'qr' | 'pos';
  tableId: string | null;
  tableNumber: number | null;
  customerId: string | null;
  customer?: { id: string; name: string; phone: string | null } | null;
  items: OrderItem[];
  customerNote: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  totalAmount: number;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  notes: string;
  createdAt: string;
  visits: number;
  totalSpent: number;
  lastVisit: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  purchases: number;
  totalPurchased: number;
}

export interface StockItem {
  id: number;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  costPerUnit: number;
  lowStock: boolean;
}

export interface StockMovement {
  id: string;
  change: number;
  reason: 'purchase' | 'sale' | 'cancel' | 'adjustment' | 'wastage' | 'purchase_void';
  note: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  supplierId: string | null;
  supplier: { id: string; name: string } | null;
  invoiceNo: string;
  date: string;
  notes: string;
  paymentStatus: 'paid' | 'unpaid';
  totalAmount: number;
  items: { id: string; stockItemId: number; quantity: number; unitCost: number; subtotal: number; stockItem: { name: string; unit: string } }[];
}

export interface Report {
  totals: {
    orders: number;
    cancelled: number;
    grossSales: number;
    discounts: number;
    serviceCharge: number;
    tax: number;
    netSales: number;
    collected: number;
    outstanding: number;
    averageTicket: number;
    itemsSold: number;
    purchases: number;
    purchasesUnpaid: number;
    costOfGoods: number;
    grossProfit: number;
  };
  byDay: { date: string; sales: number; orders: number }[];
  byHour: { hour: number; orders: number }[];
  byPayment: { method: string; amount: number }[];
  byType: { type: string; amount: number }[];
  byCategory: { name: string; amount: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  stock: { value: number; lowStock: { id: number; name: string; unit: string; quantity: number; reorderLevel: number }[] };
}

export type Role = 'admin' | 'cashier' | 'chef';

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  name: string;
}
