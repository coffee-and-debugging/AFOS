import { useCallback, useState, type FormEvent } from 'react';
import { api, type DateRange } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import Icon from '../../components/Icon';
import Modal from '../../components/Modal';
import RangePicker from '../../components/RangePicker';
import Stat from '../../components/Stat';
import { EmptyState, ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { presetRange, toDateInput, type RangePreset } from '../../lib/dates';
import { formatDate, formatQty } from '../../lib/format';
import type { Purchase, StockItem, Supplier } from '../../types';

export default function Purchases() {
  const [tab, setTab] = useState<'purchases' | 'suppliers'>('purchases');
  return (
    <>
      <PageHeader icon="purchases" title="Purchases" />
      <div className="toolbar">
        <div className="segmented" role="tablist">
          <button role="tab" aria-selected={tab === 'purchases'} className="segmented-item" onClick={() => setTab('purchases')}><Icon name="purchases" size={16} /> Purchases</button>
          <button role="tab" aria-selected={tab === 'suppliers'} className="segmented-item" onClick={() => setTab('suppliers')}><Icon name="customers" size={16} /> Suppliers</button>
        </div>
      </div>
      {tab === 'purchases' ? <PurchaseList /> : <SupplierList />}
    </>
  );
}

const loadRefs = () => Promise.all([api.suppliers.list(), api.stock.list()]);

function PurchaseList() {
  const { money } = useRestaurant();
  const toast = useToast();
  const [preset, setPreset] = useState<RangePreset>('30d');
  const [range, setRange] = useState<DateRange>(() => presetRange('30d'));
  const load = useCallback(() => api.purchases.list(range), [range]);
  const { data: purchases, error, loading, retry, reload } = usePolling(load);
  const refs = usePolling(loadRefs);
  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<Purchase | null>(null);

  async function togglePaid(p: Purchase) {
    try {
      const updated = await api.purchases.setPaid(p.id, p.paymentStatus === 'paid' ? 'unpaid' : 'paid');
      setViewing((v) => (v?.id === p.id ? updated : v));
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function voidPurchase(p: Purchase) {
    if (!confirm('Void this purchase? Its quantities will be removed from inventory.')) return;
    try {
      await api.purchases.delete(p.id);
      setViewing(null);
      toast.success('Purchase voided');
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const list = purchases ?? [];
  const total = list.reduce((s, p) => s + p.totalAmount, 0);
  const unpaid = list.filter((p) => p.paymentStatus === 'unpaid').reduce((s, p) => s + p.totalAmount, 0);

  return (
    <>
      <div className="toolbar">
        <RangePicker preset={preset} onChange={(p, r) => { setPreset(p); setRange(r); }} />
        <button className="btn btn-primary" onClick={() => setCreating(true)} disabled={!refs.data}><Icon name="plus" size={16} /> New purchase</button>
      </div>

      <div className="stats-grid">
        <Stat label="Purchases" value={list.length} tone="primary" />
        <Stat label="Total spent" value={money(total)} tone="accent" />
        <Stat label="Unpaid to suppliers" value={money(unpaid)} tone={unpaid ? 'warning' : 'success'} />
      </div>

      <section className="card">
        {loading && !purchases ? <LoadingState /> : !purchases ? <ErrorState error={error} onRetry={retry} /> : list.length === 0 ? (
          <EmptyState icon="purchases" title="No purchases in this period" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Supplier</th><th>Invoice</th><th>Items</th><th className="num">Total</th><th>Status</th><th /></tr></thead>
              <tbody>
                {list.map((p) => (
                  <tr key={p.id}>
                    <td className="nowrap">{formatDate(p.date)}</td>
                    <td><strong>{p.supplier?.name ?? '—'}</strong></td>
                    <td className="muted">{p.invoiceNo || '—'}</td>
                    <td className="muted">{p.items.map((i) => i.stockItem.name).join(', ')}</td>
                    <td className="num">{money(p.totalAmount)}</td>
                    <td><span className={`badge badge-${p.paymentStatus === 'paid' ? 'paid' : 'low'}`}>{p.paymentStatus === 'paid' ? 'Paid' : 'Unpaid'}</span></td>
                    <td><div className="row-actions"><button className="btn btn-secondary btn-sm" onClick={() => setViewing(p)}>View</button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {creating && refs.data && (
        <PurchaseForm
          suppliers={refs.data[0]}
          stock={refs.data[1]}
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); reload(); refs.reload(); toast.success('Purchase recorded and inventory updated'); }}
        />
      )}

      {viewing && (
        <Modal
          title={`${viewing.supplier?.name ?? 'Purchase'} · ${formatDate(viewing.date)}`}
          wide
          onClose={() => setViewing(null)}
          footer={<>
            <button className="btn btn-danger" onClick={() => voidPurchase(viewing)}><Icon name="trash" size={16} /> Void</button>
            <span className="spacer" />
            <button className="btn btn-secondary" onClick={() => togglePaid(viewing)}>
              Mark as {viewing.paymentStatus === 'paid' ? 'unpaid' : 'paid'}
            </button>
            <button className="btn btn-primary" onClick={() => setViewing(null)}>Done</button>
          </>}
        >
          <p className="muted" style={{ marginBottom: 'var(--space-3)' }}>
            Invoice {viewing.invoiceNo || '—'} · <span className={`badge badge-${viewing.paymentStatus === 'paid' ? 'paid' : 'low'}`}>{viewing.paymentStatus}</span>
            {viewing.notes && <><br />{viewing.notes}</>}
          </p>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Item</th><th className="num">Qty</th><th className="num">Unit cost</th><th className="num">Subtotal</th></tr></thead>
              <tbody>
                {viewing.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.stockItem.name}</td>
                    <td className="num">{formatQty(i.quantity)} {i.stockItem.unit}</td>
                    <td className="num">{money(i.unitCost)}</td>
                    <td className="num">{money(i.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="totals section-gap"><div className="grand"><span>Total</span><span>{money(viewing.totalAmount)}</span></div></div>
        </Modal>
      )}
    </>
  );
}

// Free-text item and unit. Bought in an item's pack unit, quantity and cost are per pack;
// the API converts to the item's base unit. A new item name creates the inventory item.
interface Line { name: string; unit: string; quantity: string; unitCost: string }
const EMPTY_LINE: Line = { name: '', unit: '', quantity: '', unitCost: '' };
const findByName = <T extends { name: string }>(list: T[], name: string) => list.find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());

function PurchaseForm({ suppliers, stock, onClose, onSaved }: { suppliers: Supplier[]; stock: StockItem[]; onClose: () => void; onSaved: () => void }) {
  const { money } = useRestaurant();
  const toast = useToast();
  const [supplierName, setSupplierName] = useState(suppliers[0]?.name ?? '');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [date, setDate] = useState(toDateInput(new Date()));
  const [paid, setPaid] = useState(true);
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([EMPTY_LINE]);
  const [saving, setSaving] = useState(false);

  const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const items = lines.filter((l) => l.name.trim()).map((l) => ({ name: l.name.trim(), unit: l.unit.trim(), quantity: Number(l.quantity), unitCost: Number(l.unitCost) }));
    if (!items.length) return toast.error('Add at least one item');
    setSaving(true);
    try {
      const [y, m, d] = date.split('-').map(Number);
      await api.purchases.create({
        supplierId: findByName(suppliers, supplierName)?.id,
        supplierName: supplierName.trim() || undefined,
        invoiceNo,
        date: new Date(y, m - 1, d, 12).toISOString(),
        notes,
        paymentStatus: paid ? 'paid' : 'unpaid',
        items,
      });
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="New purchase"
      wide
      onClose={onClose}
      footer={<>
        <span className="spacer price">Total {money(Math.round(total * 100) / 100)}</span>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="purchase-form" disabled={saving}>{saving ? 'Saving…' : 'Record purchase'}</button>
      </>}
    >
      <form id="purchase-form" onSubmit={submit}>
        <div className="grid-3">
          <label className="field">
            <span className="field-label">Supplier</span>
            <input className="input" data-icon="truck" list="purchase-suppliers" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} placeholder="Supplier name" />
            <datalist id="purchase-suppliers">{suppliers.map((s) => <option key={s.id} value={s.name} />)}</datalist>
          </label>
          <label className="field"><span className="field-label">Invoice no.</span><input className="input" data-icon="receipt" value={invoiceNo} placeholder="Invoice number" onChange={(e) => setInvoiceNo(e.target.value)} /></label>
          <label className="field"><span className="field-label">Date</span><input className="input" data-icon="calendar" type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></label>
        </div>

        <div className="field-label" style={{ marginBottom: 'var(--space-2)' }}>Items</div>
        <datalist id="purchase-items">{stock.map((s) => <option key={s.id} value={s.name} />)}</datalist>
        {lines.map((l, i) => {
          const item = findByName(stock, l.name);
          const units = item ? [item.unit, ...(item.packUnit ? [item.packUnit] : [])] : [];
          return (
            <div key={i} className="line-editor packs">
              <input
                className="input" data-icon="box"
                list="purchase-items"
                value={l.name}
                onChange={(e) => {
                  const name = e.target.value;
                  const match = findByName(stock, name);
                  if (!match || match === item) return setLine(i, { name });
                  // Known item: items with a pack size are usually bought by the pack
                  const inPacks = Boolean(match.packUnit && match.unitsPerPack);
                  const cost = inPacks ? match.costPerUnit * match.unitsPerPack! : match.costPerUnit;
                  setLine(i, { name, unit: inPacks ? match.packUnit! : match.unit, unitCost: String(Math.round(cost * 100) / 100) });
                }}
                placeholder="Item"
                aria-label="Item"
              />
              <input className="input" data-icon="hash" type="number" step="any" min="0" value={l.quantity} onChange={(e) => setLine(i, { quantity: e.target.value })} placeholder="Qty" aria-label="Quantity" required={!!l.name.trim()} />
              <input
                className="input" data-icon="ruler"
                list={`purchase-units-${i}`}
                value={l.unit}
                onChange={(e) => setLine(i, { unit: e.target.value })}
                placeholder="Unit"
                aria-label="Unit"
                required={!!l.name.trim()}
                title={item?.packUnit ? `1 ${item.packUnit} = ${item.unitsPerPack} ${item.unit}` : undefined}
              />
              <datalist id={`purchase-units-${i}`}>
                {(units.length ? units : ['pcs', 'kg', 'g', 'L', 'ml', 'pack', 'box']).map((u) => <option key={u} value={u} />)}
              </datalist>
              <input className="input" data-icon="money" type="number" step="any" min="0" value={l.unitCost} onChange={(e) => setLine(i, { unitCost: e.target.value })} placeholder={`Cost / ${l.unit.trim() || 'unit'}`} aria-label="Unit cost" required={!!l.name.trim()} />
              <button type="button" className="btn btn-ghost btn-icon" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label="Remove line"><Icon name="close" size={16} /></button>
            </div>
          );
        })}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLines((ls) => [...ls, EMPTY_LINE])}>
          <Icon name="plus" size={14} /> Add line
        </button>

        <div className="grid-2 section-gap">
          <label className="field"><span className="field-label">Notes</span><input className="input" data-icon="note" value={notes} placeholder="Optional" onChange={(e) => setNotes(e.target.value)} /></label>
          <label className="field">
            <span className="field-label">Payment</span>
            <select className="input" data-icon="card" value={paid ? 'paid' : 'unpaid'} onChange={(e) => setPaid(e.target.value === 'paid')}>
              <option value="paid">Paid</option>
              <option value="unpaid">Unpaid (on credit)</option>
            </select>
          </label>
        </div>
      </form>
    </Modal>
  );
}

function SupplierList() {
  const { money } = useRestaurant();
  const toast = useToast();
  const { data: suppliers, error, loading, retry, reload } = usePolling(api.suppliers.list);
  const [editing, setEditing] = useState<Supplier | 'new' | null>(null);

  async function remove(s: Supplier) {
    if (!confirm(`Delete ${s.name}? Past purchases are kept without a supplier.`)) return;
    try {
      await api.suppliers.delete(s.id);
      reload();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2 className="card-title">Suppliers</h2>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" size={16} /> Add supplier</button>
      </div>
      {loading && !suppliers ? <LoadingState /> : !suppliers ? <ErrorState error={error} onRetry={retry} /> : suppliers.length === 0 ? (
        <EmptyState icon="purchases" title="No suppliers yet" />
      ) : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th className="num">Purchases</th><th className="num">Total bought</th><th /></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.name}</strong>{s.email && <div className="subtle">{s.email}</div>}</td>
                  <td className="muted">{s.phone || '—'}</td>
                  <td className="muted">{s.address || '—'}</td>
                  <td className="num">{s.purchases}</td>
                  <td className="num">{money(s.totalPurchased)}</td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-secondary btn-sm btn-icon" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}><Icon name="edit" size={14} /></button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => remove(s)} aria-label={`Delete ${s.name}`}><Icon name="trash" size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <SupplierForm supplier={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
    </section>
  );
}

function SupplierForm({ supplier, onClose, onSaved }: { supplier: Supplier | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: supplier?.name ?? '', phone: supplier?.phone ?? '', email: supplier?.email ?? '', address: supplier?.address ?? '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (supplier) await api.suppliers.update(supplier.id, form);
      else await api.suppliers.create(form);
      toast.success('Supplier saved');
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={supplier ? 'Edit supplier' : 'Add supplier'}
      onClose={onClose}
      footer={<>
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" type="submit" form="supplier-form" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <form id="supplier-form" onSubmit={submit}>
        <label className="field"><span className="field-label">Name</span><input className="input" data-icon="truck" value={form.name} placeholder="Supplier name" onChange={set('name')} required autoFocus /></label>
        <div className="grid-2">
          <label className="field"><span className="field-label">Phone</span><input className="input" data-icon="phone" type="tel" value={form.phone} placeholder="98XXXXXXXX" onChange={set('phone')} /></label>
          <label className="field"><span className="field-label">Email</span><input className="input" data-icon="mail" type="email" value={form.email} placeholder="name@example.com" onChange={set('email')} /></label>
        </div>
        <label className="field" style={{ marginBottom: 0 }}><span className="field-label">Address</span><input className="input" data-icon="pin" value={form.address} placeholder="Supplier address" onChange={set('address')} /></label>
      </form>
    </Modal>
  );
}
