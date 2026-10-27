import { useState } from 'react';
import Icon, { type IconName } from './Icon';
import { useRestaurant } from '../hooks';
import type { StaffPaymentMethod } from '../types';

const METHODS: { key: StaffPaymentMethod; label: string; icon: IconName }[] = [
  { key: 'cash', label: 'Cash', icon: 'cash' },
  { key: 'card', label: 'Card', icon: 'card' },
  { key: 'esewa', label: 'eSewa', icon: 'wallet' },
  { key: 'khalti', label: 'Khalti', icon: 'wallet' },
];

/** Method picker with cash-tendered / change calculation. */
export default function PaymentPanel({ total, method, onMethod }: { total: number; method: StaffPaymentMethod; onMethod: (m: StaffPaymentMethod) => void }) {
  const { money } = useRestaurant();
  const [tendered, setTendered] = useState('');
  const change = Number(tendered) - total;

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="method-grid">
        {METHODS.map((m) => (
          <button key={m.key} type="button" className="method-option" aria-pressed={method === m.key} onClick={() => onMethod(m.key)}>
            <Icon name={m.icon} /> {m.label}
          </button>
        ))}
      </div>
      {method === 'cash' && (
        <>
          <label className="field" style={{ marginBottom: 0 }}>
            <span className="field-label">Cash received</span>
            <input className="input" data-icon="money" type="number" min="0" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} placeholder={String(Math.ceil(total))} />
          </label>
          {tendered !== '' && (
            <div className="change-due">
              {change >= 0 ? `Change: ${money(Math.round(change * 100) / 100)}` : `Short by ${money(Math.round(-change * 100) / 100)}`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
