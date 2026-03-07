import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, saveAuth } from '../../api/client';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.auth.login(username, password);
      saveAuth(res.token, res.user);
      if (res.user.role === 'admin') navigate('/admin');
      else if (res.user.role === 'chef') navigate('/chef');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Tea Shop AFOS</h1>
        <p className="subtitle">Sign in to continue</p>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              className="form-control"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin or chef"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ marginTop: '1.25rem', fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Admin: admin / admin123 &nbsp;|&nbsp; Chef: chef / chef123
        </p>
      </div>
    </div>
  );
}
