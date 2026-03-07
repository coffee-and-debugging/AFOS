import type { MenuItem, Order } from '../types';

const API_BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('afos_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const api = {
  auth: {
    login: (username: string, password: string) =>
      request<{ token: string; user: { id: string; username: string; role: string; name: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify({ username, password }) }
      ),
  },

  menu: {
    getAll: () => request<MenuItem[]>('/menu'),
    create: (item: Partial<MenuItem>) =>
      request<MenuItem>('/menu', { method: 'POST', body: JSON.stringify(item) }),
    update: (id: string, item: Partial<MenuItem>) =>
      request<MenuItem>(`/menu/${id}`, { method: 'PUT', body: JSON.stringify(item) }),
    delete: (id: string) => request<{ success: boolean }>(`/menu/${id}`, { method: 'DELETE' }),
  },

  tables: {
    getAll: () => request<{ id: string; number: number }[]>('/tables'),
    create: (number: number) =>
      request<{ id: string; number: number }>('/tables', { method: 'POST', body: JSON.stringify({ number }) }),
    delete: (id: string) => request<{ success: boolean }>(`/tables/${id}`, { method: 'DELETE' }),
    getQR: (id: string, baseUrl?: string) =>
      request<{ qrCode: string; url: string; tableNumber: number }>(
        `/tables/${id}/qr${baseUrl ? `?baseUrl=${encodeURIComponent(baseUrl)}` : ''}`
      ),
  },

  orders: {
    getAll: (params?: { tableId?: string; status?: string }) => {
      const q = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
      return request<Order[]>(`/orders${q}`);
    },
    getById: (id: string) => request<Order>(`/orders/${id}`),
    create: (data: {
      tableId: string;
      items: { menuItemId: string; quantity: number }[];
      customerNote?: string;
    }) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id: string, status: string) =>
      request<Order>(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
    processPayment: (id: string, method: 'esewa' | 'khalti' | 'counter') =>
      request<Order>(`/orders/${id}/payment`, { method: 'POST', body: JSON.stringify({ method }) }),
    confirmPayment: (id: string) =>
      request<Order>(`/orders/${id}/confirm-payment`, { method: 'POST' }),
  },
};

export function saveAuth(token: string, user: object) {
  localStorage.setItem('afos_token', token);
  localStorage.setItem('afos_user', JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem('afos_token');
  localStorage.removeItem('afos_user');
}

export function getAuthUser() {
  const raw = localStorage.getItem('afos_user');
  return raw ? JSON.parse(raw) : null;
}
