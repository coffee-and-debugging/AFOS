import { useEffect, useState } from 'react';
import { api } from '../api/client';
import Icon from './Icon';
import { useToast } from '../hooks';
import type { Customer } from '../types';

type Picked = Pick<Customer, 'id' | 'name' | 'phone'>;

/** Search existing customers by name/phone, or add one inline. */
export default function CustomerPicker({ value, onChange }: { value: Picked | null; onChange: (c: Picked | null) => void }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.customers.list(q.trim() || undefined).then((r) => setResults(r.slice(0, 8)), () => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  async function quickAdd() {
    const isPhone = /^[\d+\s-]{6,}$/.test(q.trim());
    const name = isPhone ? prompt('Customer name?') : q.trim();
    if (!name) return;
    try {
      const created = await api.customers.create({ name, phone: isPhone ? q.trim() : null });
      onChange(created);
      setQ('');
      setOpen(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (value) {
    return (
      <div className="chosen">
        <Icon name="user" size={16} />
        <span className="spacer"><strong>{value.name}</strong> {value.phone && <span className="subtle">· {value.phone}</span>}</span>
        <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => onChange(null)} aria-label="Remove customer">
          <Icon name="close" size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="picker">
      <input
        className="input input-search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Customer name or phone (optional)"
        aria-label="Find customer"
      />
      {open && (results.length > 0 || q.trim()) && (
        <div className="picker-list">
          {results.map((c) => (
            <button key={c.id} type="button" className="picker-option" onMouseDown={() => { onChange(c); setQ(''); }}>
              <span>{c.name}</span><span className="subtle">{c.phone}</span>
            </button>
          ))}
          {q.trim() && (
            <button type="button" className="picker-option" onMouseDown={quickAdd}>
              <span><Icon name="plus" size={14} /> Add “{q.trim()}” as new customer</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
