import { useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import { PageHeader } from '../../components/AppShell';
import { Receipt } from '../../components/Receipt';
import { ErrorState, LoadingState } from '../../components/States';
import { usePolling, useRestaurant, useToast } from '../../hooks';
import { RestaurantContext } from '../../lib/contexts';
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
  id: 'sample', billNo: 42, type: 'dine_in', source: 'pos', tableId: 'table-3', tableNumber: 3, customerId: null, customer: null,
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await api.restaurant.update({ ...form, taxRate: Number(form.taxRate), serviceChargeRate: Number(form.serviceChargeRate) });
      setRestaurant(saved);
      setForm(saved);
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
