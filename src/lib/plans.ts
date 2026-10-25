import type { Plan } from '../types';

// Subscription plan shown in Settings. Keep in sync with server/lib/plans.js.
export const PLAN_LABEL: Record<Plan, string> = { free: 'Free', pro: 'Pro' };
