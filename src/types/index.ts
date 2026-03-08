export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  category: 'tea' | 'food';
  available: boolean;
}

export interface Table {
  id: string;
  number: number;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
}

export type OrderStatus = 'pending' | 'cooking' | 'serving' | 'completed';
export type PaymentStatus = 'unpaid' | 'paid' | 'pending_counter';

export interface Order {
  id: string;
  tableId: string;
  tableNumber: number;
  items: OrderItem[];
  customerNote: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: 'online' | 'counter' | null;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  id: string;
  username: string;
  role: 'admin' | 'chef';
  name: string;
}
