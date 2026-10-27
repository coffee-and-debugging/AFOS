import { useCallback, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, getAuthUser } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { formatDateTime, formatQty, formatStock } from '../../lib/format';
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
  const [converting, setConverting] = useState<StockItem | null>(null);

  if (loading && !items) return <LoadingState label="Loading inventory…" />;
  if (!items) return <ErrorState error={error} onRetry={retry} />;

  async function remove(item: StockItem) {
    if (!confirm(`Delete ${item.name}? Menu items linked to it will no longer deduct it.`)) return;
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
        title="Inventory"
        actions={isAdmin && (
          <>
            <Link to="/purchases" className="btn btn-secondary"><Icon name="purchases" size={16} /> Record purchase</Link>
            <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add item</button>
          </>
        )}
      />

      <div className="stats-grid">
        <Stat label="Inventory items" value={items.length} tone="primary" />
        <Stat label="Low inventory" value={low.length} tone={low.length ? 'warning' : 'success'} />
        <Stat label="Inventory value" value={money(value)} tone="accent" />
      </div>

      <section className="card">
        <div className="toolbar">
          <div className="segmented" role="tablist">
            <button role="tab" aria-selected={filter === 'all'} className="segmented-item" onClick={() => setFilter('all')}>All <span className="segmented-count">{items.length}</span></button>
            <button role="tab" aria-selected={filter === 'low'} className="segmented-item" onClick={() => setFilter('low')}>Low <span className="segmented-count">{low.length}</span></button>
          </div>
          <input className="input input-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search items" aria-label="Search inventory" />
        </div>

        {visible.length === 0 ? (
          <EmptyState icon="stock" title={items.length ? 'Nothing here' : 'No inventory items yet'} text={items.length ? 'No items match this view.' : undefined} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th className="num">On hand</th><th className="num">Reorder at</th><th className="num">Cost / unit</th><th className="num">Value</th><th /></tr></thead>
              <tbody>
                {visible.map((i) => (
                  <tr key={i.id}>
                    <td><strong>{i.name}</strong> {i.lowStock && <span className="badge badge-low" style={{ marginLeft: 'var(--space-2)' }}>Low</span>}</td>
                    <td className={`num${i.lowStock ? ' danger-text' : ''}`}>
                      {formatStock(i.quantity, i)}
                      {i.packUnit && i.unitsPerPack && Math.abs(i.quantity) >= i.unitsPerPack && (
                        <div className="muted cell-sub">{formatQty(i.quantity)} {i.unit} total</div>
                      )}
                    </td>
                    <td className="num muted">{formatStock(i.reorderLevel, i)}</td>
                    <td className="num">
                      {money(i.costPerUnit)}
                      {i.packUnit && i.unitsPerPack && <div className="muted cell-sub">{money(i.costPerUnit * i.unitsPerPack)} / {i.packUnit}</div>}
                    </td>
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

      {editing && (
        <ItemForm
          item={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
          onConvert={(item) => { setEditing(null); setConverting(item); }}
        />
      )}
      {converting && <ConvertForm item={converting} onClose={() => setConverting(null)} onSaved={() => { setConverting(null); reload(); }} />}
      {adjusting && <AdjustForm item={adjusting} onClose={() => setAdjusting(null)} onSaved={() => { setAdjusting(null); reload(); }} />}
      {history && <History item={history} onClose={() => setHistory(null)} />}
    </>
  );
}

function ItemForm({ item, onClose, onSaved, onConvert }: {
  item: StockItem | null;
  onClose: () => void;
  onSaved: () => void;
  onConvert: (item: StockItem) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState({
    name: item?.name ?? '',
    unit: item?.unit ?? '',
    quantity: '',
    reorderLevel: item ? String(item.reorderLevel) : '',
    costPerUnit: item ? String(item.costPerUnit) : '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const data = {
      name: form.name,
      unit: form.unit,
      // No pack fields in the form; an existing pack size (e.g. from Convert) is kept as is
      packUnit: item?.packUnit ?? null,
      unitsPerPack: item?.unitsPerPack ?? null,
      reorderLevel: Number(form.reorderLevel) || 0,
      costPerUnit: Number(form.costPerUnit) || 0,
    };
    try {
      if (item) await api.stock.update(item.id, data);
      else await api.stock.create({ ...data, quantity: Number(form.quantity) || 0 });
      toast.success('Inventory item saved');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={item ? `Edit ${item.name}` : 'Add inventory item'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="stock-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <form id="stock-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="field-label">Name</span><input className="input" data-icon="box" value={form.name} placeholder="Item name" onChange={set('name')} required autoFocus /></label>
          <label className="field">
            <span className="field-label">Unit</span>
            <input className="input" data-icon="ruler" value={form.unit} onChange={set('unit')} placeholder="pcs, kg, bottle" required />
          </label>
        </div>
        <div className={item ? 'grid-2' : 'grid-3'}>
          {!item && <label className="field"><span className="field-label">Opening qty ({form.unit})</span><input className="input" data-icon="hash" type="number" step="any" min="0" value={form.quantity} placeholder="0" onChange={set('quantity')} /></label>}
          <label className="field"><span className="field-label">Reorder level ({form.unit})</span><input className="input" data-icon="bell" type="number" step="any" min="0" value={form.reorderLevel} placeholder="10" onChange={set('reorderLevel')} /></label>
          <label className="field"><span className="field-label">Cost per {form.unit || 'unit'}</span><input className="input" data-icon="money" type="number" step="any" min="0" value={form.costPerUnit} placeholder="0" onChange={set('costPerUnit')} /></label>
        </div>
        {item && (
          <p className="field-hint">
            <button type="button" className="link-button" onClick={() => onConvert(item)}>Convert to loose units…</button>
          </p>
        )}
      </form>
    </Modal>
  );
}

function AdjustForm({ item, onClose, onSaved }: { item: StockItem; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<'add' | 'remove' | 'wastage'>('remove');
  const [qty, setQty] = useState('');
  const [note, setNote] = useState('');
  const [inPacks, setInPacks] = useState(false);
  const [saving, setSaving] = useState(false);
  const size = inPacks && item.unitsPerPack ? item.unitsPerPack : 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = Number(qty);
    if (!(n > 0)) return toast.error('Enter a quantity greater than zero');
    if (tooMuch) return toast.error(`Only ${formatStock(Math.max(item.quantity, 0), item)} on hand`);
    setSaving(true);
    try {
      await api.stock.adjust(item.id, mode === 'add' ? n : -n, mode === 'wastage' ? 'wastage' : 'adjustment', note, inPacks);
      toast.success('Inventory updated');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const after = item.quantity + (mode === 'add' ? 1 : -1) * (Number(qty) || 0) * size;
  const tooMuch = mode !== 'add' && after < -1e-6; // on hand never goes below zero

  return (
    <Modal
      title={`Adjust ${item.name}`}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="adjust-form" disabled={saving || tooMuch}>{saving ? 'Saving…' : 'Update inventory'}</button>
      </>}
    >
      <form id="adjust-form" onSubmit={submit}>
        <div className="segmented" role="tablist" style={{ width: '100%', marginBottom: 'var(--space-4)' }}>
          {([['add', 'Add'], ['remove', 'Correct down'], ['wastage', 'Wastage']] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={mode === k} className="segmented-item" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setMode(k)}>{label}</button>
          ))}
        </div>
        <label className="field">
          <span className="field-label">Quantity ({inPacks ? item.packUnit : item.unit})</span>
          <div className="row" style={{ gap: 'var(--space-2)' }}>
            <input className="input" data-icon="hash" type="number" step="any" min="0" value={qty} placeholder="0" onChange={(e) => setQty(e.target.value)} required autoFocus />
            {item.packUnit && item.unitsPerPack && (
              <select className="input" data-icon="ruler" style={{ width: 'auto' }} value={inPacks ? 'pack' : 'unit'} onChange={(e) => setInPacks(e.target.value === 'pack')} aria-label="Counted in">
                <option value="unit">{item.unit}</option>
                <option value="pack">{item.packUnit} ({item.unitsPerPack})</option>
              </select>
            )}
          </div>
          <span className="field-hint">On hand: {formatStock(item.quantity, item)} → after: <strong>{formatStock(after, item)}</strong></span>
        </label>
        <label className="field" style={{ marginBottom: 0 }}>
          <span className="field-label">Note</span>
          <input className="input" data-icon="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'wastage' ? 'Spoiled, dropped…' : 'Reason'} />
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

/** Re-bases an item onto a smaller unit, e.g. counted in packs → counted in single pieces. */
function ConvertForm({ item, onClose, onSaved }: { item: StockItem; onClose: () => void; onSaved: () => void }) {
  const { money } = useRestaurant();
  const toast = useToast();
  const [unit, setUnit] = useState('pcs');
  const [factor, setFactor] = useState('');
  const [saving, setSaving] = useState(false);
  const f = Number(factor);
  const newUnit = unit.trim();
  const valid = newUnit !== '' && newUnit !== item.unit && f > 0 && f !== 1;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid) return toast.error(`Enter a new unit and how many of them make one ${item.unit}`);
    setSaving(true);
    try {
      await api.stock.convert(item.id, { unit: newUnit, factor: f, packUnit: item.unit });
      toast.success(`${item.name} is now counted in ${newUnit}`);
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Convert ${item.name} to loose units`}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="convert-form" disabled={saving || !valid}>{saving ? 'Converting…' : 'Convert'}</button>
      </>}
    >
      <form id="convert-form" onSubmit={submit}>
        <div className="grid-2">
          <label className="field"><span className="field-label">New base unit</span><input className="input" data-icon="ruler" value={unit} placeholder="pcs" onChange={(e) => setUnit(e.target.value)} required autoFocus /></label>
          <label className="field">
            <span className="field-label">{newUnit || 'Units'} in one {item.unit}</span>
            <input className="input" data-icon="hash" type="number" step="any" min="0" value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="20" required />
          </label>
        </div>
        {valid && (
          <ul className="line-items">
            <li><span>On hand</span><span>{formatQty(item.quantity)} {item.unit} → <strong>{formatQty(item.quantity * f)} {newUnit}</strong></span></li>
            <li><span>Reorder level</span><span>{formatQty(item.reorderLevel)} {item.unit} → <strong>{formatQty(item.reorderLevel * f)} {newUnit}</strong></span></li>
            <li><span>Cost</span><span>{money(item.costPerUnit)} / {item.unit} → <strong>{money(Math.round((item.costPerUnit / f) * 100) / 100)} / {newUnit}</strong></span></li>
            <li><span>Menu links</span><span>quantities × {formatQty(f)}</span></li>
          </ul>
        )}
      </form>
    </Modal>
  );
}
