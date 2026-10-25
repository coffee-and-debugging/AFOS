import { useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import { Receipt } from '../../components/Receipt';
import { ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { RestaurantContext } from '../../lib/contexts';
import { normalizeBaseUrl, tableUrl, useAutomaticGuestBaseUrl } from '../../lib/network';
import { PLAN_LABEL } from '../../lib/plans';
import type { Order, Restaurant } from '../../types';

export default function Settings() {
  // Load fresh from the API so the form never starts from placeholder defaults.
  const { data, error, loading, retry } = usePolling(api.restaurant.get);

  return (
    <>
      <PageHeader icon="settings" title="Settings" subtitle="Your restaurant's details, billing rules and receipt" />
      {data ? <SettingsForm initial={data} /> : loading ? <LoadingState /> : <ErrorState error={error} onRetry={retry} />}
    </>
  );
}

const SAMPLE_ORDER: Order = {
  id: 'sample', billNo: 42, type: 'dine_in', source: 'pos', tableId: 'table-3', tableNumber: 3,
  items: [{ menuItemId: '1', name: 'Crispy Chicken Burger', category: 'burgers', price: 450, quantity: 2, subtotal: 900 }],
  customerNote: '', status: 'completed', paymentStatus: 'paid', paymentMethod: 'cash',
  subtotal: 900, discount: 0, serviceCharge: 0, tax: 0, totalAmount: 900, paidAt: null,
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

function SettingsForm({ initial }: { initial: Restaurant }) {
  const { setRestaurant } = useRestaurant();
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Restaurant) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  // Table QR address: automatic (this PC's current Wi-Fi address) or a manual address saved as typed.
  // The manual text is kept separately, so switching to Automatic and back never loses it.
  const [qrMode, setQrMode] = useState<'auto' | 'manual'>(initial.qrBaseUrl ? 'manual' : 'auto');
  const [manualBase, setManualBase] = useState(initial.qrBaseUrl);
  const autoBase = useAutomaticGuestBaseUrl();
  const manualNormalized = normalizeBaseUrl(manualBase);
  const manualValid = manualNormalized !== null;
  const effectiveBase = qrMode === 'manual' ? manualNormalized : autoBase;
  const { data: tables } = usePolling(api.tables.getAll);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (qrMode === 'manual' && !manualValid) return toast.error('Enter a manual address like http://192.168.100.20:5173, or choose Automatic');
    setSaving(true);
    try {
      const saved = await api.restaurant.update({
        ...form,
        taxRate: Number(form.taxRate),
        serviceChargeRate: Number(form.serviceChargeRate),
        qrBaseUrl: qrMode === 'manual' ? manualNormalized! : '',
      });
      setRestaurant(saved);
      setForm(saved);
      if (saved.qrBaseUrl) setManualBase(saved.qrBaseUrl);
      toast.success('Settings saved');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  // Preview the receipt with the current (unsaved) rates applied
  const base = SAMPLE_ORDER.subtotal;
  const service = Math.round(base * Number(form.serviceChargeRate)) / 100;
  const tax = Math.round((base + service) * Number(form.taxRate)) / 100;
  const preview = { ...SAMPLE_ORDER, serviceCharge: service, tax, totalAmount: base + service + tax };

  return (
    <div className="chart-grid" style={{ alignItems: 'start' }}>
      <section className="card span-2">
        <form onSubmit={submit}>
          <div className="card-header">
            <h2 className="card-title">Restaurant</h2>
            <span className={`badge ${initial.plan === 'pro' ? 'badge-accent' : ''}`} title="Subscription plan">
              {PLAN_LABEL[initial.plan] ?? initial.plan} plan
            </span>
          </div>
          <div className="grid-2">
            <label className="field"><span className="field-label">Name</span><input className="input" value={form.name} onChange={set('name')} required /></label>
            <label className="field"><span className="field-label">Tagline</span><input className="input" value={form.tagline} onChange={set('tagline')} placeholder="Shown on guest menus" /></label>
            <label className="field"><span className="field-label">Address</span><input className="input" value={form.address} onChange={set('address')} /></label>
            <label className="field"><span className="field-label">Phone</span><input className="input" value={form.phone} onChange={set('phone')} /></label>
          </div>

          <h2 className="card-title" style={{ margin: 'var(--space-3) 0 var(--space-4)' }}>Billing</h2>
          <div className="grid-3">
            <label className="field"><span className="field-label">Currency symbol</span><input className="input" value={form.currency} onChange={set('currency')} required /></label>
            <label className="field"><span className="field-label">VAT / tax %</span><input className="input" type="number" step="0.01" min="0" max="100" value={form.taxRate} onChange={set('taxRate')} required /></label>
            <label className="field"><span className="field-label">Service charge %</span><input className="input" type="number" step="0.01" min="0" max="100" value={form.serviceChargeRate} onChange={set('serviceChargeRate')} required /></label>
          </div>
          <p className="field-hint" style={{ marginTop: 'calc(-1 * var(--space-2))', marginBottom: 'var(--space-4)' }}>
            Service charge applies to dine-in only. Tax is calculated on the subtotal after discount plus service charge.
          </p>
          <label className="field"><span className="field-label">Receipt footer</span><input className="input" value={form.receiptFooter} onChange={set('receiptFooter')} /></label>

          <h2 className="card-title" style={{ margin: 'var(--space-3) 0 var(--space-2)' }}>Table QR codes</h2>
          <p className="field-hint" style={{ marginTop: 0, marginBottom: 'var(--space-3)' }}>The address guests' phones open when they scan a table's QR code.</p>
          <div className="qr-mode" role="radiogroup" aria-label="Guest ordering address">
            <label className={`qr-mode-option${qrMode === 'auto' ? ' is-selected' : ''}`}>
              <input type="radio" name="qr-mode" checked={qrMode === 'auto'} onChange={() => setQrMode('auto')} />
              <span>
                <strong>Automatic (this PC's Wi-Fi)</strong>
                <span className="qr-mode-value">
                  {autoBase === undefined ? 'Detecting…' : autoBase ?? 'No Wi-Fi address found. Connect to Wi-Fi or use Manual.'}
                </span>
                <span className="qr-mode-hint">Follows the Wi-Fi IPv4 address every time the system runs.</span>
              </span>
            </label>
            <label className={`qr-mode-option${qrMode === 'manual' ? ' is-selected' : ''}`}>
              <input type="radio" name="qr-mode" checked={qrMode === 'manual'} onChange={() => setQrMode('manual')} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>Manual</strong>
                <input
                  className="input"
                  value={manualBase}
                  onChange={(e) => { setManualBase(e.target.value); setQrMode('manual'); }}
                  onFocus={() => setQrMode('manual')}
                  placeholder={autoBase ? autoBase : 'http://192.168.100.20:5173'}
                  inputMode="url"
                  aria-label="Manual guest ordering address"
                  aria-invalid={qrMode === 'manual' && !manualValid}
                />
                <span className="qr-mode-hint">
                  {qrMode === 'manual' && manualBase && !manualValid
                    ? 'Enter an address like http://192.168.100.20:5173'
                    : 'Kept exactly as saved; never changed automatically. Use it for a fixed IP or your website.'}
                </span>
              </span>
            </label>
          </div>

          <div className="qr-preview">
            <div className="qr-preview-head">
              <span>Table links {qrMode === 'manual' && manualValid && manualBase !== initial.qrBaseUrl ? '(preview, not saved yet)' : ''}</span>
              <span className="subtle">{tables?.length ?? 0} tables</span>
            </div>
            {!effectiveBase ? (
              <p className="subtle" style={{ margin: 0 }}>{qrMode === 'manual' ? 'Enter an address to see the links.' : 'Detecting this PC\'s Wi-Fi address…'}</p>
            ) : (
              <ul className="qr-preview-list">
                {(tables ?? []).map((t) => (
                  <li key={t.id}>
                    <span className="qr-preview-table">Table {t.number}</span>
                    <code>{tableUrl(effectiveBase, t.id)}</code>
                  </li>
                ))}
              </ul>
            )}
            <p className="field-hint" style={{ margin: 'var(--space-2) 0 0' }}>Reprint the QR codes from <strong>Tables &amp; QR</strong> after the address changes.</p>
          </div>

          <button className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
        </form>
      </section>

      <section className="card">
        <h2 className="card-title" style={{ marginBottom: 'var(--space-4)' }}>Receipt preview</h2>
        <PreviewReceipt order={preview} restaurant={form} />
      </section>
    </div>
  );
}

function PreviewReceipt({ order, restaurant }: { order: Order; restaurant: Restaurant }) {
  const { setRestaurant } = useRestaurant();
  // Render the receipt against the unsaved form values
  return (
    <RestaurantContext.Provider value={{ restaurant, setRestaurant, loaded: true }}>
      <Receipt order={order} />
    </RestaurantContext.Provider>
  );
}
