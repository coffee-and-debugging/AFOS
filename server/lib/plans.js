// Which subscription plans unlock which premium features.
// Keep in sync with src/lib/plans.ts (the UI uses it to show the "Feature locked" page).
const PLANS = ['free', 'pro'];

// No premium features at the moment; add entries like `reports: ['pro']` to gate one.
const FEATURE_PLANS = {};

const hasFeature = (plan, feature) => (FEATURE_PLANS[feature] ?? PLANS).includes(plan);

module.exports = { PLANS, FEATURE_PLANS, hasFeature };
