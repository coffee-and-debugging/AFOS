import { NavLink, useNavigate } from 'react-router-dom';
import { clearAuth, getAuthUser } from '../../api/client';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const user = getAuthUser();

  function handleLogout() {
    clearAuth();
    navigate('/login');
  }

  return (
    <div className="page-wrapper">
      <aside className="sidebar">
        <div className="sidebar-brand">
          Tea Shop AFOS
          <span>Admin Panel</span>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/admin" end>
            <span>&#9632;</span> Orders
          </NavLink>
          <NavLink to="/admin/menu">
            <span>&#9632;</span> Menu
          </NavLink>
          <NavLink to="/admin/tables">
            <span>&#9632;</span> Tables &amp; QR
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <div style={{ marginBottom: 6 }}>{user?.name}</div>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">{children}</main>
    </div>
  );
}
