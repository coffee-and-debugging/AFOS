import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client';
import GuestHeader from '../../components/GuestHeader';
import { EmptyState, LoadingState } from '../../components/States';
import type { PaymentResult } from '../../types';

/** Where the guest's order page shows the outcome of an online payment */
export interface PaymentNotice {
  kind: 'success' | 'warning' | 'error';
  message: string;
}

/**
 * Landing page after eSewa or Khalti sends the guest back. Asks the API to confirm the
 * payment with the gateway, then returns the guest to their order with the outcome.
 *   /payment/esewa/success?data=…          eSewa success
 *   /payment/esewa/failure/:orderId        eSewa cancel/failure
 *   /payment/khalti/return?pidx=…          Khalti (success or cancel)
 */
export default function PaymentReturn() {
  const { gateway = '', result = '', orderId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [problem, setProblem] = useState<string | null>(null);
  const started = useRef(false); // confirm once, even under StrictMode's double effects

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const finish = (target: string, notice: PaymentNotice) => navigate(`/order/${target}`, { replace: true, state: { notice } });
    const fromResult = (r: PaymentResult) => finish(r.order.id, {
      kind: r.paid ? 'success' : r.needsStaff ? 'warning' : 'error',
      message: r.message ?? (r.paid ? 'Payment received. Thank you!' : 'The payment was not completed.'),
    });

    (async () => {
      try {
        if (gateway === 'esewa' && result === 'failure' && orderId) {
          // eSewa sends no details on failure; still re-check in case it went through
          const r = await api.payments.check(orderId);
          if (r.paid) return fromResult(r);
          return finish(orderId, { kind: 'error', message: 'The eSewa payment was cancelled. No money was taken.' });
        }
        if (gateway === 'esewa' && result === 'success') {
          const data = params.get('data');
          if (!data) throw new Error('eSewa did not send payment details back.');
          return fromResult(await api.payments.confirmEsewa(data));
        }
        if (gateway === 'khalti' && result === 'return') {
          const pidx = params.get('pidx');
          if (!pidx) throw new Error('Khalti did not send payment details back.');
          return fromResult(await api.payments.confirmKhalti(pidx));
        }
        throw new Error('Unknown payment page.');
      } catch (err) {
        setProblem((err as Error).message);
      }
    })();
  }, [gateway, result, orderId, params, navigate]);

  return (
    <div className="guest">
      <GuestHeader kicker="Payment" title="Confirming payment" />
      <main className="guest-body">
        {problem ? (
          <EmptyState icon="alert" title="We couldn't confirm this payment" text={`${problem} If money left your wallet, please show this screen to our staff.`}>
            {orderId && <Link to={`/order/${orderId}`} className="btn btn-primary">Back to my order</Link>}
          </EmptyState>
        ) : (
          <LoadingState label="Checking with the payment provider… please don't close this page." />
        )}
      </main>
    </div>
  );
}
