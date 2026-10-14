// Which subscription plans unlock which premium features.
// Keep in sync with src/lib/plans.ts (the UI uses it to show the "Feature locked" page).
const PLANS = ['free', 'pro'];

const FEATURE_PLANS = {
  customers: ['pro'],
};

const hasFeature = (plan, feature) => (FEATURE_PLANS[feature] ?? PLANS).includes(plan);

module.exports = { PLANS, FEATURE_PLANS, hasFeature };
