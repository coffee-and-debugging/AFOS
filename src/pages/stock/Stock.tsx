import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, getAuthUser } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { formatDateTime, formatQty } from '../../lib/format';
import type { StockItem, StockMovement } from '../../types';

const REASON_LABEL: Record<StockMovement['reason'], string> = {
  purchase: 'Purchase',
  sale: 'Sold',
  cancel: 'Order cancelled',
  adjustment: 'Adjustment',
  wastage: 'Wastage',
  purchase_void: 'Purchase voided',
};

export default function Stock() {
  const { money } = useRestaurant();
  const toast = useToast();
  const isAdmin = getAuthUser()?.role === 'admin';
  const { data: items, error, loading, retry, reload } = usePolling(api.stock.list, 30_000);
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<StockItem | 'new' | null>(null);
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const [history, setHistory] = useState<StockItem | null>(null);

  if (loading && !items) return <LoadingState label="Loading stock…" />;
  if (!items) return <ErrorState error={error} onRetry={retry} />;

  async function remove(item: StockItem) {
    if (!confirm(`Delete ${item.name}? Recipes using it will no longer deduct it.`)) return;
    try {
      await api.stock.delete(item.id);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const low = items.filter((i) => i.lowStock);
  const value = items.reduce((s, i) => s + Math.max(i.quantity, 0) * i.costPerUnit, 0);
  const term = q.trim().toLowerCase();
  const visible = items.filter((i) => (filter === 'all' || i.lowStock) && (!term || i.name.toLowerCase().includes(term)));

  return (
    <>
      <PageHeader
        icon="stock"
        title="Stock"
        subtitle="Ingredients on hand. Sales deduct automatically from menu recipes; purchases add to stock."
        actions={isAdmin && (
          <>
            <Link to="/purchases" className="btn btn-secondary"><Icon name="purchases" size={16} /> Record purchase</Link>
            <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add item</button>
          </>
        )}
      />

      <div className="stats-grid">
        <Stat label="Stock items" value={items.length} tone="primary" />
        <Stat label="Low stock" value={low.length} hint="At or below reorder level" tone={low.length ? 'warning' : 'success'} />
        <Stat label="Stock value" value={money(value)} hint="At latest purchase cost" tone="accent" />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={filter === 'all'} className="segmented-item" onClick={() => setFilter('all')}>All <span className="segmented-count">{items.length}</span></button>
            <button role="tab" aria-selected={filter === 'low'} className="segmented-item" onClick={() => setFilter('low')}>Low stock <span className="segmented-count">{low.length}</span></button>
          </div>
          <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" aria-label="Search stock" />
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="stock" title={items.length ? 'Nothing here' : 'No stock items yet'} text={items.length ? 'No items match this view.' : 'Add the ingredients you buy, then link them to menu items as recipes.'} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th className="num">On hand</th><th className="num">Reorder at</th><th className="num">Cost / unit</th><th className="num">Value</th><th /></tr></thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.name}</strong> {i.lowStock && <span className="badge badge-low" style={{ marginLeft: 'var(--space-2)' }}>Low</span>}</td>
                    <td className={`num${i.lowStock ? ' danger-text' : ''}`}>{formatQty(i.quantity)} {i.unit}</td>
                    <td className="num muted">{formatQty(i.reorderLevel)} {i.unit}</td>
                    <td className="num">{money(i.costPerUnit)}</td>
                    <td className="num">{money(Math.max(i.quantity, 0) * i.costPerUnit)}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-secondary btn-sm" onClick={() => setAdjusting(i)}>Adjust</button>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setHistory(i)} aria-label={`History for ${i.name}`}><Icon name="history" size={14} /></button>
                        {isAdmin && <>
                          <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditing(i)} aria-label={`Edit ${i.name}`}><Icon name="edit" size={14} /></button>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(i)} aria-label={`Delete ${i.name}`}><Icon name="trash" size={14} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <ItemForm item={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {adjusting && <AdjustForm item={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); reload(); }} />}
      {history && <History item={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function ItemForm({ item, onClose, onSaved }: { item: StockItem | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: item?.name ?? '',
    unit: item?.unit ?? 'kg',
    quantity: '',
    reorderLevel: item ? String(item.reorderLevel) : '',
    costPerUnit: item ? String(item.costPerUnit) : '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data = { name: form.name, unit: form.unit, reorderLevel: Number(form.reorderLevel) || 0, costPerUnit: Number(form.costPerUnit) || 0 };
    try {
      if (item) await api.stock.update(item.id, data);
      else await api.stock.create({ ...data, quantity: Number(form.quantity) || 0 });
      toast.success('Stock item saved');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={item ? `Edit ${item.name}` : 'Add stock item'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="stock-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <form id="stock-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="field-label">Name</span><input className="input" value={form.name} onChange={set('name')} required autoFocus /></label>
          <label className="field">
            <span className="field-label">Unit</span>
            <input className="input" list="units" value={form.unit} onChange={set('unit')} required />
            <datalist id="units"><option value="kg" /><option value="g" /><option value="L" /><option value="ml" /><option value="pcs" /><option value="pack" /></datalist>
          </label>
        </div>
        <div className={item ? 'grid-2' : 'grid-3'}>
          {!item && <label className="field"><span className="field-label">Opening qty</span><input className="input" type="number" step="any" min="0" value={form.quantity} onChange={set('quantity')} /></label>}
          <label className="field"><span className="field-label">Reorder level</span><input className="input" type="number" step="any" min="0" value={form.reorderLevel} onChange={set('reorderLevel')} /></label>
          <label className="field"><span className="field-label">Cost per unit</span><input className="input" type="number" step="any" min="0" value={form.costPerUnit} onChange={set('costPerUnit')} /></label>
        </div>
        {item && <p className="field-hint">To change the quantity on hand, use Adjust or record a purchase so every change is logged.</p>}
      </form>
    </Modal>
  );
}

function AdjustForm({ item, onClose, onSaved }: { item: StockItem; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'add' | 'remove' | 'wastage'>('remove');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!(n > 0)) return toast.error('Enter a quantity greater than zero');
    setSaving(true);
    try {
      await api.stock.adjust(item.id, mode === 'add' ? n : -n, mode === 'wastage' ? 'wastage' : 'adjustment', note);
      toast.success('Stock updated');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const after = item.quantity + (mode === 'add' ? 1 : -1) * (Number(qty) || 0);

  return (
    <Modal
      title={`Adjust ${item.name}`}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="adjust-form" disabled={saving}>{saving ? 'Saving…' : 'Update stock'}</button>
      </>}
    >
      <form id="adjust-form" onSubmit={submit}>
        <div className="segmented" role="tablist" style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
          {([['add', 'Add'], ['remove', 'Correct down'], ['wastage', 'Wastage']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} className="segmented-item" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">Quantity ({item.unit})</span>
          <input className="input" type="number" step="any" min="0" value={qty} onChange={(e) => setQty(e.target.value)} required autoFocus />
          <span className="field-hint">On hand: {formatQty(item.quantity)} {item.unit} → after: <strong>{formatQty(after)} {item.unit}</strong></span>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Note</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'wastage' ? 'e.g. spoiled, dropped' : 'e.g. stock count correction'} />
        </label>
      </form>
    </Modal>
  );
}

function History({ item, onClose }: { item: StockItem; onClose: () => void }) {
  const load = useCallback(() => api.stock.movements(item.id), [item.id]);
  const { data, error, loading, retry } = usePolling(load);

  return (
    <Modal title={`${item.name} history`} wide onClose={onClose}>
      {loading && !data ? <LoadingState /> : !data ? <ErrorState error={error} onRetry={retry} /> : data.length === 0 ? (
        <EmptyState icon="history" title="No movements yet" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Reason</th><th>Note</th><th className="num">Change</th></tr></thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td className="muted nowrap">{formatDateTime(m.createdAt)}</td>
                  <td><span className={`badge${m.change < 0 ? ' badge-unpaid' : ' badge-paid'}`}>{REASON_LABEL[m.reason] ?? m.reason}</span></td>
                  <td className="muted">{m.note}</td>
                  <td className={`num${m.change < 0 ? ' danger-text' : ''}`}>{m.change > 0 ? '+' : ''}{formatQty(m.change)} {item.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
