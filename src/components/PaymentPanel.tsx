import Icon, { type IconName } from './Icon';
import type { StaffPaymentMethod } from '../types';

const METHODS: { key: StaffPaymentMethod; label: string; icon: IconName }[] = [
  { key: 'cash', label: 'Cash', icon: 'cash' },
  { key: 'card', label: 'Card', icon: 'card' },
  { key: 'esewa', label: 'eSewa', icon: 'wallet' },
  { key: 'khalti', label: 'Khalti', icon: 'wallet' },
];

/** Payment method picker. */
export default function PaymentPanel({ method, onMethod }: { total?: number; method: StaffPaymentMethod; onMethod: (m: StaffPaymentMethod) => void }) {
  return (
    <div className="method-grid">
      {METHODS.map((m) => (
        <button key={m.key} type="button" className="method-option" aria-pressed={method === m.key} onClick={() => onMethod(m.key)}>
          <Icon name={m.icon} /> {m.label}
        </button>
      ))}
    </div>
  );
}
