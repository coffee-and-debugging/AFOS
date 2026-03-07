import { useState, type FormEvent } from 'react';

interface PaymentGatewayProps {
  gateway: 'esewa' | 'khalti';
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const CONFIG = {
  esewa: {
    name: 'eSewa',
    color: '#60BB47',
    darkColor: '#4a9a36',
    bgColor: '#f0fae8',
    textColor: '#1a5c08',
    idLabel: 'eSewa ID / Mobile Number',
    pinLabel: 'eSewa Password',
    idPlaceholder: '98XXXXXXXX',
    pinPlaceholder: '••••••',
    logo: 'e',
    tagline: 'Sewa',
  },
  khalti: {
    name: 'Khalti',
    color: '#5C2D91',
    darkColor: '#4a2275',
    bgColor: '#f5f0fa',
    textColor: '#2e1260',
    idLabel: 'Khalti Mobile Number',
    pinLabel: 'Khalti MPIN',
    idPlaceholder: '98XXXXXXXX',
    pinPlaceholder: '••••',
    logo: 'K',
    tagline: 'halti',
  },
};

type Stage = 'form' | 'processing' | 'success';

export default function PaymentGateway({ gateway, amount, onSuccess, onCancel }: PaymentGatewayProps) {
  const cfg = CONFIG[gateway];
  const [stage, setStage] = useState<Stage>('form');
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    setStage('processing');
    await new Promise((r) => setTimeout(r, 2200));
    setStage('success');
    await new Promise((r) => setTimeout(r, 1500));
    onSuccess();
  }

  return (
    <div style={{ borderRadius: 12, overflow: 'hidden', border: `2px solid ${cfg.color}` }}>
      {/* Header */}
      <div style={{ background: cfg.color, color: '#fff', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.2rem', fontWeight: 900,
        }}>
          {cfg.logo}
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1 }}>
            {gateway === 'esewa' ? <><span style={{ color: '#fff' }}>e</span><span style={{ color: '#fff', fontWeight: 900 }}>Sewa</span></> : 'Khalti'}
          </div>
          <div style={{ fontSize: '0.72rem', opacity: 0.85 }}>Secure Digital Payment</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.85 }}>DEMO</div>
      </div>

      {stage === 'form' && (
        <form onSubmit={handlePay} style={{ padding: '1.5rem' }}>
          {/* Amount box */}
          <div style={{
            background: cfg.bgColor, border: `1px solid ${cfg.color}33`,
            borderRadius: 10, padding: '12px 16px', marginBottom: '1.25rem', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.75rem', color: cfg.textColor, marginBottom: 2 }}>Amount to Pay</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: cfg.color, lineHeight: 1 }}>
              Rs. {amount.toLocaleString()}
            </div>
          </div>

          <div className="form-group">
            <label style={{ color: cfg.textColor }}>{cfg.idLabel}</label>
            <input
              className="form-control"
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder={cfg.idPlaceholder}
              style={{ borderColor: id ? cfg.color : undefined }}
              required
            />
          </div>
          <div className="form-group">
            <label style={{ color: cfg.textColor }}>{cfg.pinLabel}</label>
            <input
              type="password"
              className="form-control"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder={cfg.pinPlaceholder}
              style={{ borderColor: pin ? cfg.color : undefined }}
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: '1.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn"
              style={{ flex: 2, justifyContent: 'center', background: cfg.color, color: '#fff' }}
            >
              Pay Rs. {amount.toLocaleString()}
            </button>
          </div>

          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.75rem', marginBottom: 0 }}>
            Demo mode — no real transaction will occur
          </p>
        </form>
      )}

      {stage === 'processing' && (
        <div style={{ padding: '3.5rem 1.5rem', textAlign: 'center' }}>
          <div style={{
            width: 52, height: 52,
            border: `4px solid ${cfg.color}33`,
            borderTop: `4px solid ${cfg.color}`,
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: cfg.textColor, fontWeight: 600, margin: 0 }}>Processing payment...</p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>Please wait</p>
        </div>
      )}

      {stage === 'success' && (
        <div style={{ padding: '3rem 1.5rem', textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: cfg.bgColor, border: `3px solid ${cfg.color}`,
            color: cfg.color, fontSize: '1.8rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            ✓
          </div>
          <h3 style={{ color: cfg.textColor, margin: '0 0 6px' }}>Payment Successful!</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            Rs. {amount.toLocaleString()} paid via {cfg.name}
          </p>
        </div>
      )}
    </div>
  );
}
