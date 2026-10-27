import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuthUser } from './api/client';
import Providers from './components/Providers';
import AppShell from './components/AppShell';
import { LoadingState } from './components/States';
import type { Role } from './types';
import Login from './pages/Login';
import CustomerPage from './pages/customer/CustomerPage';
import OrderStatus from './pages/customer/OrderStatus';
import PaymentReturn from './pages/customer/PaymentReturn';

// Staff pages load on demand, so guests' phones only download the ordering screens.
const Dashboard = lazy(() => import('./pages/admin/Dashboard'));
const MenuManagement = lazy(() => import('./pages/admin/MenuManagement'));
const TablesManagement = lazy(() => import('./pages/admin/TablesManagement'));
const Pos = lazy(() => import('./pages/pos/Pos'));
const Purchases = lazy(() => import('./pages/purchases/Purchases'));
const Stock = lazy(() => import('./pages/stock/Stock'));
const Orders = lazy(() => import('./pages/admin/Orders'));
const KitchenDisplay = lazy(() => import('./pages/kitchen/KitchenDisplay'));
const Reports = lazy(() => import('./pages/reports/Reports'));
const StaffPage = lazy(() => import('./pages/staff/Staff'));
const Settings = lazy(() => import('./pages/admin/Settings'));

const HOME: Record<Role, string> = { admin: '/dashboard', cashier: '/pos', chef: '/kitchen' };

function Staff({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = getAuthUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={HOME[user.role]} replace />;
  return (
    <AppShell>
      <Suspense fallback={<LoadingState />}>{children}</Suspense>
    </AppShell>
  );
}

function RootRedirect() {
  const user = getAuthUser();
  return <Navigate to={user ? HOME[user.role] : '/login'} replace />;
}

const ADMIN: Role[] = ['admin'];
const FRONT: Role[] = ['admin', 'cashier'];

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={<Staff roles={FRONT}><Dashboard /></Staff>} />
          <Route path="/menu" element={<Staff roles={ADMIN}><MenuManagement /></Staff>} />
          <Route path="/tables" element={<Staff roles={FRONT}><TablesManagement /></Staff>} />
          <Route path="/pos" element={<Staff roles={FRONT}><Pos /></Staff>} />
          <Route path="/purchases" element={<Staff roles={ADMIN}><Purchases /></Staff>} />
          <Route path="/inventory" element={<Staff roles={['admin', 'chef']}><Stock /></Staff>} />
          <Route path="/orders" element={<Staff roles={FRONT}><Orders /></Staff>} />
          <Route path="/kitchen" element={<Staff roles={['admin', 'cashier', 'chef']}><KitchenDisplay /></Staff>} />
          <Route path="/reports" element={<Staff roles={ADMIN}><Reports /></Staff>} />
          <Route path="/staff" element={<Staff roles={ADMIN}><StaffPage /></Staff>} />
          <Route path="/settings" element={<Staff roles={ADMIN}><Settings /></Staff>} />

          {/* Older links */}
          <Route path="/admin" element={<Navigate to="/dashboard" replace />} />
          <Route path="/admin/:page" element={<RootRedirect />} />
          <Route path="/chef" element={<Navigate to="/kitchen" replace />} />
          <Route path="/stock" element={<Navigate to="/inventory" replace />} />

          <Route path="/table/:tableId" element={<CustomerPage />} />
          <Route path="/order/:orderId" element={<OrderStatus />} />
          {/* eSewa / Khalti send guests back here after paying */}
          <Route path="/payment/:gateway/:result/:orderId?" element={<PaymentReturn />} />

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </Providers>
  );
}
