import { useState, type CSSProperties, type FormEvent } from 'react';
import Icon from './Icon';
import { GATEWAYS, type Gateway } from '../lib/gateways';

type Stage = 'form' | 'processing' | 'success';

interface Props {
  gateway: Gateway;
  amount: string;
  onSuccess: () => void;
  onCancel: () => void;
}

/** Demo checkout: simulates a gateway round-trip. No real transaction occurs. */
export default function PaymentGateway({ gateway, amount, onSuccess, onCancel }: Props) {
  const cfg = GATEWAYS[gateway];
  const [stage, setStage] = useState<Stage>('form');
  const [id, setId] = useState('');
  const [pin, setPin] = useState('');

  async function pay(e: FormEvent) {
    e.preventDefault();
    setStage('processing');
    await new Promise((r) => setTimeout(r, 1800));
    setStage('success');
    await new Promise((r) => setTimeout(r, 1200));
    onSuccess();
  }

  return (
    <div className="gateway" style={{ '--gw': cfg.color } as CSSProperties}>
      <div className="gateway-head">
        <span className="gateway-logo">{cfg.logo}</span>
        <div className="spacer">
          <strong>{cfg.name}</strong>
          <div style={{ fontSize: 'var(--text-xs)', opacity: 0.85 }}>Secure digital payment</div>
        </div>
        <span style={{ fontSize: 'var(--text-xs)', opacity: 0.85 }}>DEMO</span>
      </div>

      <div className="gateway-body">
        {stage === 'form' && (
          <form onSubmit={pay}>
            <div className="gateway-amount">
              <span className="subtle">Amount to pay</span>
              <strong>{amount}</strong>
            </div>
            <label className="field">
              <span className="field-label">{cfg.idLabel}</span>
              <input className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder="98XXXXXXXX" inputMode="numeric" required />
            </label>
            <label className="field">
              <span className="field-label">{cfg.pinLabel}</span>
              <input type="password" className="input" value={pin} onChange={(e) => setPin(e.target.value)} required />
            </label>
            <div className="row" style={{ flexWrap: 'nowrap' }}>
              <button type="button" className="btn btn-secondary" onClick={onCancel}>Back</button>
              <button type="submit" className="btn btn-pay spacer">Pay {amount}</button>
            </div>
            <p className="subtle" style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>Demo mode — no real money moves.</p>
          </form>
        )}

        {stage === 'processing' && (
          <div className="state">
            <div className="spinner gateway-spinner" />
            <p>Processing payment…</p>
          </div>
        )}

        {stage === 'success' && (
          <div className="state">
            <div className="state-icon"><Icon name="check" size={32} /></div>
            <h3 className="state-title">Payment successful</h3>
            <p className="state-text">{amount} paid via {cfg.name}</p>
          </div>
        )}
      </div>
    </div>
  );
}
