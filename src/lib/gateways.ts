import type { OnlineGateway } from '../types';

export type Gateway = OnlineGateway;

// Brand colors belong to the payment providers, not the app theme.
export const GATEWAYS: Record<Gateway, { name: string; color: string; logo: string }> = {
  esewa: { name: 'eSewa', color: '#60bb47', logo: 'e' },
  khalti: { name: 'Khalti', color: '#5c2d91', logo: 'K' },
};

/** Sends the browser to eSewa by POSTing the signed checkout form the API prepared. */
export function submitEsewaForm(action: string, fields: Record<string, string>) {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = action;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}
