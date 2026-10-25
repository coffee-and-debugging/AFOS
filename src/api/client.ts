import type {
  AuthUser, Category, MenuItem, Order, OrderType, PaymentGatewayInfo, PaymentResult, Purchase, RecipeLine, Report,
  Restaurant, StaffCategory, StaffMember, StaffPayment, StaffPaymentMethod, StockItem, StockMovement, Supplier, Table,
} from '../types';

// Empty in development (Vite proxies /api); the API's public origin in production.
const API_ORIGIN = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const API_BASE = `${API_ORIGIN}/api`;
const TIMEOUT_MS = 10_000;
const TOKEN_KEY = 'afos_token';
const USER_KEY = 'afos_user';

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The server could not be reached (network down, API restarting, gateway errors). */
export class NetworkError extends Error {
  constructor() {
    super("Can't reach the server. Retrying automatically…");
  }
}

/* ---------- Connectivity tracking (consumed by useConnectivity) ---------- */

type Connectivity = 'online' | 'offline';
let connectivity: Connectivity = 'online';
const listeners = new Set<() => void>();
let healthTimer: ReturnType<typeof setInterval> | undefined;

function setConnectivity(next: Connectivity) {
  if (next === connectivity) return;
  connectivity = next;
  listeners.forEach((l) => l());
  // While offline, probe /health so the app recovers on its own once the API is back.
  if (next === 'offline' && !healthTimer) {
    healthTimer = setInterval(() => {
      fetch(`${API_BASE}/health`, { cache: 'no-store' })
        .then((r) => r.ok && setConnectivity('online'))
        .catch(() => {});
    }, 5000);
  } else if (next === 'online' && healthTimer) {
    clearInterval(healthTimer);
    healthTimer = undefined;
  }
}

export const connectivityStore = {
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot: () => connectivity,
};

/* ---------- Auth storage ---------- */

export function saveAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export const getToken = () => localStorage.getItem(TOKEN_KEY);

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/* ---------- Requests ---------- */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function send(path: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: controller.signal });
    if (res.status === 502 || res.status === 503 || res.status === 504) throw new NetworkError();
    return res;
  } catch (err) {
    throw err instanceof NetworkError ? err : new NetworkError();
  } finally {
    clearTimeout(timer);
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const isForm = options.body instanceof FormData;
  const init: RequestInit = {
    ...options,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string>),
    },
  };

  // Reads are safe to repeat, so retry them briefly before reporting the API as unreachable.
  const attempts = (options.method ?? 'GET') === 'GET' ? 3 : 1;
  let res: Response | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      res = await send(path, init);
      break;
    } catch (err) {
      if (i === attempts - 1) {
        setConnectivity('offline');
        throw err;
      }
      await sleep(500 * 2 ** i);
    }
  }
  setConnectivity('online');

  const body = await res!.json().catch(() => ({}));
  if (!res!.ok) {
    if (res!.status === 401 && token && !path.startsWith('/auth/')) {
      clearAuth();
      window.location.assign('/login?expired=1');
    }
    throw new ApiError(body.error || 'Request failed', res!.status, body.code);
  }
  return body as T;
}

const json = (method: string, data?: unknown): RequestInit => ({
  method,
  body: data === undefined ? undefined : JSON.stringify(data),
});

/** Uploaded images are served by the API; prefix relative paths with its origin. */
export function assetUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.startsWith('/') ? `${API_ORIGIN}${path}` : path;
}

const query = (params: Record<string, string | number | boolean | undefined | null>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const str = q.toString();
  return str ? `?${str}` : '';
};

export interface DateRange {
  from: string;
  to: string;
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: AuthUser }>('/auth/login', json('POST', { username, password })),
  },

  restaurant: {
    get: () => request<Restaurant>('/restaurant'),
    update: (data: Partial<Restaurant>) => request<Restaurant>('/restaurant', json('PUT', data)),
  },

  categories: {
    getAll: () => request<Category[]>('/categories'),
    create: (name: string) => request<Category>('/categories', json('POST', { name })),
    delete: (slug: string) => request<{ success: boolean }>(`/categories/${encodeURIComponent(slug)}`, json('DELETE')),
  },

  menu: {
    getAll: () => request<MenuItem[]>('/menu'),
    create: (item: Partial<MenuItem>) => request<MenuItem>('/menu', json('POST', item)),
    update: (id: number, item: Partial<MenuItem>) => request<MenuItem>(`/menu/${id}`, json('PUT', item)),
    delete: (id: number) => request<{ success: boolean }>(`/menu/${id}`, json('DELETE')),
    getRecipe: (id: number) => request<RecipeLine[]>(`/menu/${id}/recipe`),
    setRecipe: (id: number, lines: RecipeLine[]) => request<RecipeLine[]>(`/menu/${id}/recipe`, json('PUT', lines)),
    uploadImage: (file: File, itemName?: string) => {
      const formData = new FormData();
      if (itemName) formData.append('itemName', itemName); // must precede the file for multer
      formData.append('image', file);
      return request<{ imageUrl: string }>('/menu/upload', { method: 'POST', body: formData });
    },
  },

  tables: {
    getAll: () => request<Table[]>('/tables'),
    /** Public: which table a QR code belongs to */
    getPublic: (id: string) => request<Pick<Table, 'id' | 'number'>>(`/tables/${encodeURIComponent(id)}/public`),
    create: (number: number) => request<Table>('/tables', json('POST', { number })),
    delete: (id: string) => request<{ success: boolean }>(`/tables/${id}`, json('DELETE')),
    getQR: (id: string, baseUrl: string) =>
      request<{ qrCode: string; url: string; tableNumber: number }>(`/tables/${id}/qr${query({ baseUrl })}`),
  },

  orders: {
    list: (params: Partial<DateRange> & { status?: string; type?: string; unpaid?: boolean; limit?: number } = {}) =>
      request<Order[]>(`/orders${query(params)}`),
    getById: (id: string) => request<Order>(`/orders/${id}`),
    create: (data: { tableId: string; items: { menuItemId: string; quantity: number }[]; customerNote?: string }) =>
      request<Order>('/orders', json('POST', data)),
    createPos: (data: {
      type: OrderType;
      tableId?: string;
      items: { menuItemId: string; quantity: number }[];
      customerNote?: string;
      discount?: number;
      payWith?: StaffPaymentMethod;
    }) => request<Order>('/orders/pos', json('POST', data)),
    updateStatus: (id: string, status: Order['status']) =>
      request<Order>(`/orders/${id}/status`, json('PUT', { status })),
    /** Guest chooses to pay at the counter. Online payments go through `api.payments`. */
    processPayment: (id: string, method: 'counter') =>
      request<Order>(`/orders/${id}/payment`, json('POST', { method })),
    pay: (id: string, method: StaffPaymentMethod, discount?: number) =>
      request<Order>(`/orders/${id}/pay`, json('POST', { method, discount })),
  },

  payments: {
    gateways: () => request<PaymentGatewayInfo[]>('/payments/gateways'),
    /** Returns the form the browser must POST to eSewa */
    startEsewa: (orderId: string) =>
      request<{ action: string; fields: Record<string, string> }>(`/payments/orders/${orderId}/esewa`, json('POST')),
    /** Returns the Khalti checkout page to send the guest to */
    startKhalti: (orderId: string) => request<{ paymentUrl: string }>(`/payments/orders/${orderId}/khalti`, json('POST')),
    confirmEsewa: (data: string) => request<PaymentResult>('/payments/esewa/confirm', json('POST', { data })),
    confirmKhalti: (pidx: string) => request<PaymentResult>('/payments/khalti/confirm', json('POST', { pidx })),
    /** Re-checks unfinished online payments for an order with the gateway */
    check: (orderId: string) => request<PaymentResult>(`/payments/orders/${orderId}/check`, json('POST')),
  },

  suppliers: {
    list: () => request<Supplier[]>('/suppliers'),
    create: (data: Partial<Supplier>) => request<Supplier>('/suppliers', json('POST', data)),
    update: (id: string, data: Partial<Supplier>) => request<Supplier>(`/suppliers/${id}`, json('PUT', data)),
    delete: (id: string) => request<{ success: boolean }>(`/suppliers/${id}`, json('DELETE')),
  },

  stock: {
    list: () => request<StockItem[]>('/stock'),
    low: () => request<StockItem[]>('/stock/low'),
    create: (data: Partial<StockItem> & { inPacks?: boolean }) => request<StockItem>('/stock', json('POST', data)),
    update: (id: number, data: Partial<StockItem>) => request<StockItem>(`/stock/${id}`, json('PUT', data)),
    delete: (id: number) => request<{ success: boolean }>(`/stock/${id}`, json('DELETE')),
    /** `change` is in packs when `inPacks` is true, otherwise in the base unit */
    adjust: (id: number, change: number, reason: 'adjustment' | 'wastage', note: string, inPacks = false) =>
      request<StockItem>(`/stock/${id}/adjust`, json('POST', { change, reason, note, inPacks })),
    /** Re-base onto a smaller unit: 1 old unit = `factor` new units (e.g. pack → 20 pcs) */
    convert: (id: number, data: { unit: string; factor: number; packUnit?: string }) =>
      request<StockItem>(`/stock/${id}/convert`, json('POST', data)),
    movements: (id: number) => request<StockMovement[]>(`/stock/${id}/movements`),
  },

  purchases: {
    list: (range?: DateRange) => request<Purchase[]>(`/purchases${query({ ...range })}`),
    create: (data: {
      supplierId?: string;
      invoiceNo?: string;
      date?: string;
      notes?: string;
      paymentStatus: 'paid' | 'unpaid';
      /** With `inPacks`, quantity and unitCost are per pack */
      items: { stockItemId: number; quantity: number; unitCost: number; inPacks?: boolean }[];
    }) => request<Purchase>('/purchases', json('POST', data)),
    setPaid: (id: string, paymentStatus: 'paid' | 'unpaid') => request<Purchase>(`/purchases/${id}`, json('PATCH', { paymentStatus })),
    delete: (id: string) => request<{ success: boolean }>(`/purchases/${id}`, json('DELETE')),
  },

  staff: {
    list: (period?: string) => request<StaffMember[]>(`/staff${query({ period })}`),
    create: (data: Partial<StaffMember> & { password?: string }) => request<StaffMember>('/staff', json('POST', data)),
    update: (id: string, data: Partial<StaffMember> & { password?: string }) => request<StaffMember>(`/staff/${id}`, json('PUT', data)),
    setActive: (id: string, active: boolean) => request<StaffMember>(`/staff/${id}/active`, json('PATCH', { active })),
    payments: (id: string) => request<StaffPayment[]>(`/staff/${id}/payments`),
    allPayments: (params: { period?: string } & Partial<DateRange> = {}) => request<StaffPayment[]>(`/staff/payments${query(params)}`),
    pay: (id: string, data: Partial<StaffPayment>) => request<StaffPayment>(`/staff/${id}/payments`, json('POST', data)),
    deletePayment: (paymentId: string) => request<{ success: boolean }>(`/staff/payments/${paymentId}`, json('DELETE')),
    categories: {
      list: () => request<StaffCategory[]>('/staff/categories'),
      create: (data: Pick<StaffCategory, 'name'> & Partial<Pick<StaffCategory, 'color' | 'description'>>) =>
        request<StaffCategory>('/staff/categories', json('POST', data)),
      update: (id: number, data: Partial<Pick<StaffCategory, 'name' | 'color' | 'description'>>) =>
        request<StaffCategory>(`/staff/categories/${id}`, json('PUT', data)),
      reorder: (ids: number[]) => request<{ success: boolean }>('/staff/categories', json('PUT', ids)),
      /** People still in the category move to `moveTo` (a category id, or 'none' for uncategorised) */
      delete: (id: number, moveTo?: number | 'none') =>
        request<{ success: boolean; moved: number }>(`/staff/categories/${id}${query({ moveTo })}`, json('DELETE')),
    },
  },

  reports: {
    summary: (range: DateRange) =>
      request<Report>(`/reports/summary${query({ ...range, tz: new Date().getTimezoneOffset() })}`),
  },
};
