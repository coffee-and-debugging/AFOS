export type Gateway = 'esewa' | 'khalti';

// Brand colors belong to the payment providers, not the app theme.
export const GATEWAYS: Record<Gateway, { name: string; color: string; idLabel: string; pinLabel: string; logo: string }> = {
  esewa: { name: 'eSewa', color: '#60bb47', idLabel: 'eSewa ID or mobile number', pinLabel: 'eSewa password', logo: 'e' },
  khalti: { name: 'Khalti', color: '#5c2d91', idLabel: 'Khalti mobile number', pinLabel: 'Khalti MPIN', logo: 'K' },
};
