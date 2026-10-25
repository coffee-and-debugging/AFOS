import { useState, type ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import Icon, { type IconName } from './Icon';
import LiveAlerts from './LiveAlerts';
import { OfflineBanner } from './States';
import { clearAuth, getAuthUser } from '../api/client';
import { liveEvents } from '../api/events';
import { useConnectivity, useNow, useRestaurant } from '../hooks';
import type { Role } from '../types';

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  roles: Role[];
  quick?: boolean;
}

const ALL: Role[] = ['admin', 'cashier', 'chef'];

const NAV: NavEntry[] = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['admin', 'cashier'] },
  { to: '/menu', label: 'Menu', icon: 'menu', roles: ['admin'] },
  { to: '/tables', label: 'Tables & QR', icon: 'qr', roles: ['admin', 'cashier'] },
  { to: '/pos', label: 'POS / Billing', icon: 'pos', roles: ['admin', 'cashier'], quick: true },
  { to: '/purchases', label: 'Purchases', icon: 'purchases', roles: ['admin'] },
  { to: '/stock', label: 'Stock', icon: 'stock', roles: ['admin', 'chef'] },
  { to: '/orders', label: 'Orders', icon: 'orders', roles: ['admin', 'cashier'], quick: true },
  { to: '/kitchen', label: 'Kitchen', icon: 'kitchen', roles: ALL, quick: true },
  { to: '/staff', label: 'Staff & Payroll', icon: 'user', roles: ['admin'] },
  { to: '/reports', label: 'Reports', icon: 'reports', roles: ['admin'] },
];

const ROLE_LABEL: Record<Role, string> = { admin: 'Manager', cashier: 'Cashier', chef: 'Kitchen' };

export default function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const user = getAuthUser();
  const { restaurant } = useRestaurant();
  const connectivity = useConnectivity();
  const now = useNow();
  const [navOpen, setNavOpen] = useState(false);

  const role = user?.role ?? 'chef';
  const entries = NAV.filter((n) => n.roles.includes(role));
  const quick = entries.filter((n) => n.quick);
  const closeNav = () => setNavOpen(false);

  function logout() {
    clearAuth();
    liveEvents.close();
    navigate('/login');
  }

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="sidebar-brand">
          <span className="brand-mark"><Icon name="flame" size={22} /></span>
          <div style={{ minWidth: 0 }}>
            <div className="brand-name">{restaurant.name}</div>
            <div className="brand-meta">Restaurant OS</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {entries.map((n) => (
            <NavLink key={n.to} to={n.to} className="nav-item" onClick={closeNav}>
              <Icon name={n.icon} /> {n.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          {role !== 'chef' && (
            <Link to="/pos" className="take-order" onClick={closeNav}>
              <Icon name="plus" /> Take Order
            </Link>
          )}
          <div className="user-card">
            <span className="avatar">{user?.name.charAt(0).toUpperCase()}</span>
            <div>
              <div className="user-name">{user?.name}</div>
              <div className="user-meta">
                {ROLE_LABEL[role]}
                {role === 'admin' && <> · <Link to="/settings" onClick={closeNav}>Settings</Link></>}
              </div>
            </div>
          </div>
          <button className="nav-item" onClick={logout}>
            <Icon name="logout" /> Log out
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={closeNav} />

      <div className="shell-main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-toggle" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Icon name="hamburger" />
          </button>
          {quick.length > 1 && (
            <nav className="segmented" aria-label="Quick switch">
              {quick.map((n) => (
                <NavLink key={n.to} to={n.to} className="segmented-item">
                  <Icon name={n.icon} size={16} /> {n.label}
                </NavLink>
              ))}
            </nav>
          )}
          <div className="topbar-right">
            {(role === 'admin' || role === 'cashier') && <LiveAlerts />}
            <span className={`conn-chip${connectivity === 'offline' ? ' is-offline' : ''}`}>
              {connectivity === 'online' ? 'Online' : 'Reconnecting'}
            </span>
            <span className="clock">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </header>
        <OfflineBanner />
        <main className="content">{children}</main>
        <footer className="statusbar">
          <span>{restaurant.name} · v{__APP_VERSION__}</span>
          <span>{connectivity === 'online' ? 'All systems normal' : 'Waiting for the server…'}</span>
        </footer>
      </div>
    </div>
  );
}

export function PageHeader({ icon, title, subtitle, actions }: { icon: IconName; title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div className="page-heading">
        <span className="page-icon"><Icon name={icon} size={22} /></span>
        <div style={{ minWidth: 0 }}>
          <h1>{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
