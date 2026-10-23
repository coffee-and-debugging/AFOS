import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api, saveAuth } from '../api/client';
import Icon from '../components/Icon';
import PasswordInput from '../components/PasswordInput';
import { OfflineBanner } from '../components/States';
import { useRestaurant } from '../hooks';
import type { Role } from '../types';

const HOME: Record<Role, string> = { admin: '/dashboard', cashier: '/pos', chef: '/kitchen' };

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { restaurant } = useRestaurant();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('expired') ? 'Your session expired. Please sign in again.' : '');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login(username, password);
      saveAuth(res.token, res.user);
      navigate(HOME[res.user.role] ?? '/', { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <OfflineBanner />
      <div className="auth-page">
        <section className="auth-poster" aria-hidden="true">
          <div className="row" style={{ gap: 'var(--space-3)' }}>
            <span className="brand-mark"><Icon name="flame" size={22} /></span>
            <span className="brand-name">{restaurant.name}</span>
          </div>
          <div>
            <div className="hero-kicker">Restaurant OS</div>
            <div className="hero-title">Run your<br />restaurant<br />in one place</div>
            <p className="hero-sub">Orders, billing, kitchen, stock and reports, updating live across every screen.</p>
          </div>
          <p className="subtle">AFOS Restaurant OS · v{__APP_VERSION__}</p>
        </section>

        <section className="auth-form-wrap">
          <div className="auth-card">
            <div className="hero-kicker" style={{ color: 'var(--color-primary)' }}>Welcome back</div>
            <h2 style={{ marginBottom: 'var(--space-5)' }}>Staff sign in</h2>

            {error && <div className="alert alert-error" role="alert">{error}</div>}

            <form onSubmit={handleSubmit}>
              <label className="field">
                <span className="field-label">Username</span>
                <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
              </label>
              <label className="field">
                <span className="field-label">Password</span>
                <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </label>
              <button type="submit" className="btn btn-flame btn-block btn-lg" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            {import.meta.env.DEV && (
              <p className="auth-hint">
                Demo accounts — <strong>admin</strong> / admin123 · <strong>cashier</strong> / cashier123 · <strong>chef</strong> / chef123
              </p>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
