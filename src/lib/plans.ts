import type { Plan } from '../types';

// Keep in sync with server/lib/plans.js, which enforces the same rules on the API.
export type Feature = 'customers';

const FEATURE_PLANS: Record<Feature, Plan[]> = {
  customers: ['pro'],
};

export const PLAN_LABEL: Record<Plan, string> = { free: 'Free', pro: 'Pro' };

export const hasFeature = (plan: Plan, feature: Feature) => FEATURE_PLANS[feature].includes(plan);

/** Copy for the "Feature locked" page. */
export const FEATURE_INFO: Record<Feature, { name: string; pitch: string; benefits: string[] }> = {
  customers: {
    name: 'Customers',
    pitch: 'Know your regulars, attach them to bills and see what each guest spends over time.',
    benefits: [
      'Customer profiles with visits and lifetime spend',
      'Attach customers to orders at the POS',
      'Full order history per guest',
      'Spot your regulars automatically',
    ],
  },
};
