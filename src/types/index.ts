export interface Restaurant {
  name: string;
  tagline: string;
  currency: string;
  address: string;
  phone: string;
  taxRate: number;
  serviceChargeRate: number;
  receiptFooter: string;
  /** Address printed in table QR codes, e.g. http://192.168.100.20:5173. Empty = automatic */
  qrBaseUrl: string;
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
  /** Optional, display only (e.g. "Chicken, cheese, lettuce"). Not linked to inventory */
  ingredients?: string;
  price: number;
  /** Optional half-plate price; when set, the item can be ordered as a half plate */
  halfPrice?: number | null;
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
  /** Half plates also say "(Half plate)" in the name */
  portion?: Portion;
}

export type Portion = 'full' | 'half';

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
  items: OrderItem[];
  customerNote: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  /** eSewa / Khalti transaction id when paid online */
  paymentRef?: string | null;
  subtotal: number;
  discount: number;
  serviceCharge: number;
  tax: number;
  totalAmount: number;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  /** Base unit every quantity is counted in, e.g. "pcs" */
  unit: string;
  /** Optional bulk unit, e.g. "pack", holding `unitsPerPack` base units */
  packUnit: string | null;
  unitsPerPack: number | null;
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

export type OnlineGateway = 'esewa' | 'khalti';

export interface PaymentGatewayInfo {
  id: OnlineGateway;
  name: string;
  /** False until the merchant keys are configured on the server */
  enabled: boolean;
  /** Sandbox: no real money moves */
  testMode: boolean;
  /** Wallet the payment goes to, shown to the guest */
  account: string;
}

/** Answer after the API has checked a payment with the gateway */
export interface PaymentResult {
  paid: boolean;
  order: Order;
  message?: string;
  needsStaff?: boolean;
}

export type Role = 'admin' | 'cashier' | 'chef';
/** Roles in the staff directory; "staff" is payroll-only and cannot sign in */
export type StaffRole = Role | 'staff';

export type CategoryColor = 'red' | 'orange' | 'amber' | 'green' | 'blue' | 'purple' | 'gray';

/** Department staff are grouped by; managers can add their own */
export interface StaffCategory {
  id: number;
  name: string;
  description: string;
  color: CategoryColor;
  sortOrder: number;
  activeStaff: number;
  salaryBill: number;
}

type CategoryRef = Pick<StaffCategory, 'id' | 'name' | 'color'>;

export interface StaffMember {
  id: string;
  username: string | null;
  role: StaffRole;
  name: string;
  position: string;
  categoryId: number | null;
  category: CategoryRef | null;
  phone: string;
  active: boolean;
  baseSalary: number;
  overtimeRate: number;
  joinedAt: string;
  createdAt: string;
  canLogin: boolean;
  period: string;
  paidThisPeriod: number;
  /** Salary payouts this period (advances not counted) */
  paymentsThisPeriod: number;
  /** Advances taken this period */
  advancesThisPeriod: number;
  lastPayment: { paidAt: string; period: string; netAmount: number } | null;
}

export type PayrollMethod = 'cash' | 'bank' | 'esewa' | 'khalti';

export interface StaffPayment {
  id: string;
  /** salary payout, or an advance taken before payday (amount in netAmount) */
  type: 'salary' | 'advance';
  userId: string;
  user?: { id: string; name: string; role: StaffRole; position: string; category: CategoryRef | null };
  period: string;
  baseAmount: number;
  bonus: number;
  overtimeHours: number;
  overtimeRate: number;
  overtimeAmount: number;
  deductions: number;
  netAmount: number;
  method: PayrollMethod;
  note: string;
  paidAt: string;
  recordedBy: string;
}

/** Pushed by the API when an item drops to or below its reorder level */
export interface LowStockAlert {
  id: number;
  name: string;
  unit: string;
  packUnit: string | null;
  unitsPerPack: number | null;
  quantity: number;
  reorderLevel: number;
  outOfStock: boolean;
}

/** Staff chat message between two roles */
export interface ChatMessage {
  id: string;
  fromRole: Role;
  toRole: Role;
  fromName: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

/** Real-time events from GET /api/events */
export interface LiveEvents {
  'order.created': Order;
  'order.updated': Order;
  'stock.low': { items: LowStockAlert[]; at: string; source: Record<string, unknown> };
  'chat.message': ChatMessage;
  /** `role` read everything `with` sent it */
  'chat.read': { role: Role; with: Role };
}

export interface AuthUser {
  id: string;
  username: string;
  role: Role;
  name: string;
}
