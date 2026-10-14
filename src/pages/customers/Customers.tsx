import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, getAuthUser } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import FeatureLocked from '../../components/FeatureLocked';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import { ReceiptModal } from '../../components/Receipt';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { billLabel, formatDate, formatDateTime, orderPlace, STATUS_LABEL } from '../../lib/format';
import type { Customer, Order } from '../../types';

export default function Customers() {
  const { money } = useRestaurant();
  const toast = useToast();
  const isAdmin = getAuthUser()?.role === 'admin';
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [editing, setEditing] = useState<Customer | 'new' | null>(null);
  const [viewing, setViewing] = useState<Customer | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 250);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(() => api.customers.list(debounced || undefined), [debounced]);
  const { data: customers, error, loading, retry, reload } = usePolling(load, 30_000);

  async function remove(c: Customer) {
    if (!confirm(`Delete ${c.name}? Their past orders are kept.`)) return;
    try {
      await api.customers.delete(c.id);
      toast.success('Customer deleted');
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (error instanceof ApiError && error.code === 'feature_locked') return <FeatureLocked feature="customers" />;

  const list = customers ?? [];
  const regulars = list.filter((c) => c.visits >= 3).length;
  const lifetime = list.reduce((s, c) => s + c.totalSpent, 0);

  return (
    <>
      <PageHeader
        icon="customers"
        title="Customers"
        subtitle="Regulars, their visits and what they spend"
        actions={<button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add customer</button>}
      />

      <div className="stats-grid">
        <Stat label="Customers" value={list.length} tone="primary" />
        <Stat label="Regulars" value={regulars} hint="3 or more visits" tone="accent" />
        <Stat label="Lifetime spend" value={money(lifetime)} tone="success" />
      </div>

      <section className="card">
        <div className="toolbar">
          <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or phone" aria-label="Search customers" />
          <span className="subtle">{list.length} shown</span>
        </div>

        {loading && !customers ? <LoadingState /> : !customers ? <ErrorState error={error} onRetry={retry} /> : list.length === 0 ? (
          <EmptyState icon="customers" title={debounced ? 'No matches' : 'No customers yet'} text={debounced ? 'Try a different name or number.' : 'Add regulars here or attach them to orders at the POS.'} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Phone</th><th className="num">Visits</th><th className="num">Total spent</th><th>Last visit</th><th /></tr></thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button className="btn btn-ghost btn-sm" style={{ padding: 0, fontWeight: 700, color: 'var(--color-text)' }} onClick={() => setViewing(c)}>{c.name}</button>
                      {c.visits >= 3 && <span className="badge badge-accent" style={{ marginLeft: 'var(--space-2)' }}>Regular</span>}
                    </td>
                    <td className="muted">{c.phone || '—'}</td>
                    <td className="num">{c.visits}</td>
                    <td className="num">{money(c.totalSpent)}</td>
                    <td className="muted">{c.lastVisit ? formatDate(c.lastVisit) : '—'}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setViewing(c)}>View</button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditing(c)} aria-label={`Edit ${c.name}`}><Icon name="edit" size={14} /></button>
                        {isAdmin && (
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(c)} aria-label={`Delete ${c.name}`}><Icon name="trash" size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && (
        <CustomerForm
          customer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); toast.success('Customer saved'); }}
        />
      )}
      {viewing && <CustomerDetail customer={viewing} onClose={() => setViewing(null)} />}
    </>
  );
}

function CustomerForm({ customer, onClose, onSaved }: { customer: Customer | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    notes: customer?.notes ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (customer) await api.customers.update(customer.id, form);
      else await api.customers.create(form);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={customer ? 'Edit customer' : 'Add customer'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="customer-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <form id="customer-form" onSubmit={submit}>
        <label className="field"><span className="field-label">Name</span><input className="input" value={form.name} onChange={set('name')} required autoFocus /></label>
        <div className="grid-2">
          <label className="field"><span className="field-label">Phone</span><input className="input" type="tel" value={form.phone} onChange={set('phone')} placeholder="98XXXXXXXX" /></label>
          <label className="field"><span className="field-label">Email</span><input className="input" type="email" value={form.email} onChange={set('email')} /></label>
        </div>
        <label className="field" style={{ marginBottom: 0 }}><span className="field-label">Notes</span><textarea className="input" rows={2} value={form.notes} onChange={set('notes')} placeholder="Allergies, favourite table, birthday…" /></label>
      </form>
    </Modal>
  );
}

function CustomerDetail({ customer, onClose }: { customer: Customer; onClose: () => void }) {
  const { money } = useRestaurant();
  const load = useCallback(() => api.customers.get(customer.id), [customer.id]);
  const { data, error, loading, retry } = usePolling(load);
  const [receipt, setReceipt] = useState<Order | null>(null);

  return (
    <>
      <Modal title={customer.name} wide onClose={onClose}>
        <div className="stats-grid" style={{ marginBottom: 'var(--space-4)' }}>
          <Stat label="Visits" value={customer.visits} tone="primary" />
          <Stat label="Total spent" value={money(customer.totalSpent)} tone="accent" />
          <Stat label="Average bill" value={money(customer.visits ? customer.totalSpent / customer.visits : 0)} tone="success" />
        </div>
        <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
          {[customer.phone, customer.email].filter(Boolean).join(' · ') || 'No contact details'}
          {customer.notes && <><br /><em>{customer.notes}</em></>}
        </p>
        {loading && !data ? <LoadingState /> : !data ? <ErrorState error={error} onRetry={retry} /> : data.orders.length === 0 ? (
          <EmptyState icon="orders" title="No orders yet" text="Attach this customer to an order at the POS." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Bill</th><th>When</th><th>Where</th><th>Status</th><th className="num">Total</th><th /></tr></thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className={o.status === 'cancelled' ? 'is-muted' : undefined}>
                    <td className="bill-no">{billLabel(o)}</td>
                    <td className="muted nowrap">{formatDateTime(o.createdAt)}</td>
                    <td>{orderPlace(o)}</td>
                    <td><span className={`badge badge-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td className="num">{money(o.totalAmount)}</td>
                    <td><button className="btn btn-ghost btn-sm btn-icon" onClick={() => setReceipt(o)} aria-label="View bill"><Icon name="print" size={14} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
      {receipt && <ReceiptModal order={receipt} onClose={() => setReceipt(null)} />}
    </>
  );
}
