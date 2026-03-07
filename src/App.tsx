import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getAuthUser } from './api/client';
import Login from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import MenuManagement from './pages/admin/MenuManagement';
import TablesManagement from './pages/admin/TablesManagement';
import ChefDashboard from './pages/chef/ChefDashboard';
import CustomerPage from './pages/customer/CustomerPage';
import OrderStatus from './pages/customer/OrderStatus';

function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles: string[];
}) {
  const user = getAuthUser();
  if (!user) return <Navigate to="/login" replace />;
  if (!allowedRoles.includes(user.role)) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RootRedirect() {
  const user = getAuthUser();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'admin') return <Navigate to="/admin" replace />;
  if (user.role === 'chef') return <Navigate to="/chef" replace />;
  return <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/menu"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <MenuManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/tables"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <TablesManagement />
            </ProtectedRoute>
          }
        />

        <Route
          path="/chef"
          element={
            <ProtectedRoute allowedRoles={['chef']}>
              <ChefDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="/table/:tableId" element={<CustomerPage />} />
        <Route path="/order/:orderId" element={<OrderStatus />} />

        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
