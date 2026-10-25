import { useState, type CSSProperties } from 'react';
import Icon from './Icon';
import { LoadingState } from './States';
import { api } from '../api/client';
import { usePolling, useRestaurant, useToast } from '../hooks';
import { GATEWAYS, submitEsewaForm } from '../lib/gateways';
import type { Order, OnlineGateway } from '../types';

/**
 * Lets the guest pick eSewa or Khalti and hands them over to that gateway's own checkout.
 * They come back to /payment/... where the API confirms the payment with the gateway.
 */
export default function OnlinePayment({ order }: { order: Order }) {
  const { money, restaurant } = useRestaurant();
  const toast = useToast();
  const { data: gateways, error, retry } = usePolling(api.payments.gateways);
  const [starting, setStarting] = useState<OnlineGateway | null>(null);

  async function start(id: OnlineGateway) {
    setStarting(id);
    try {
      if (id === 'esewa') {
        const { action, fields } = await api.payments.startEsewa(order.id);
        submitEsewaForm(action, fields);
      } else {
        const { paymentUrl } = await api.payments.startKhalti(order.id);
        window.location.assign(paymentUrl);
      }
      // Keep the spinner up while the browser leaves for the gateway
    } catch (err) {
      toast.error((err as Error).message);
      setStarting(null);
    }
  }

  if (!gateways) {
    return error
      ? <p className="alert alert-error">Online payment is unavailable right now. <button className="link-button" onClick={retry}>Try again</button></p>
      : <LoadingState label="Loading payment options…" />;
  }

  return (
    <div className="stack" style={{ gap: 'var(--space-3)' }}>
      <div className="gateway-amount" style={{ marginBottom: 0 }}>
        <span className="subtle">Amount to pay</span>
        <strong style={{ color: 'var(--color-text)' }}>{money(order.totalAmount)}</strong>
      </div>

      {gateways.map((g) => (
        <button
          key={g.id}
          className="pay-option"
          style={{ '--gw': GATEWAYS[g.id].color } as CSSProperties}
          onClick={() => start(g.id)}
          disabled={!g.enabled || starting !== null}
        >
          <span className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
            <strong>{starting === g.id ? `Opening ${g.name}…` : `Pay with ${g.name}`}</strong>
            {g.enabled && g.testMode && <span className="badge badge-pending">Test mode</span>}
          </span>
          <span className="subtle">
            {g.enabled ? `To ${restaurant.name} · ${g.name} ${g.account}` : `${g.name} isn't available yet — please pay at the counter`}
          </span>
        </button>
      ))}

      <p className="subtle" style={{ margin: 0, display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-start' }}>
        <Icon name="lock" size={16} />
        <span>You'll log in on the official {gateways.filter((g) => g.enabled).map((g) => g.name).join(' or ') || 'payment'} page. We never see your PIN or password.</span>
      </p>
    </div>
  );
}
