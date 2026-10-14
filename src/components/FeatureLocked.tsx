import { getAuthUser } from '../api/client';
import Icon from './Icon';
import { useRestaurant } from '../hooks';
import { FEATURE_INFO, PLAN_LABEL, type Feature } from '../lib/plans';

const SALES_EMAIL = import.meta.env.VITE_SALES_EMAIL || 'sales@afos.app';
const UPGRADE_URL = import.meta.env.VITE_UPGRADE_URL;

interface Props {
  /** Use a known feature's copy… */
  feature?: Feature;
  /** …or pass your own (these override the feature's copy). */
  title?: string;
  description?: string;
  benefits?: string[];
  requiredPlan?: string;
}

/** "Subscription required" screen shown in place of a premium feature. */
export default function FeatureLocked({ feature, title, description, benefits, requiredPlan = 'Pro' }: Props) {
  const { restaurant } = useRestaurant();
  const info = feature ? FEATURE_INFO[feature] : undefined;
  const name = title ?? info?.name ?? 'This feature';
  const perks = benefits ?? info?.benefits ?? [];
  const isOwner = getAuthUser()?.role === 'admin';

  const subject = encodeURIComponent(`Upgrade ${restaurant.name} to ${requiredPlan}`);
  const body = encodeURIComponent(`Hi, we'd like to unlock ${name} for ${restaurant.name}.`);
  const upgradeHref = UPGRADE_URL || `mailto:${SALES_EMAIL}?subject=${subject}&body=${body}`;
  const contactHref = `mailto:${SALES_EMAIL}?subject=${encodeURIComponent(`Question about ${name}`)}`;

  return (
    <section className="locked" aria-labelledby="locked-title">
      <div className="locked-poster">
        <span className="locked-icon"><Icon name="lock" size={30} /></span>
        <div className="hero-kicker">Premium feature</div>
        <h1 id="locked-title" className="hero-title">Unlock {name}</h1>
        <p className="hero-sub">{description ?? info?.pitch ?? `${name} is available on the ${requiredPlan} plan.`}</p>
        <span className="locked-plan">
          Your plan: <strong>{PLAN_LABEL[restaurant.plan] ?? restaurant.plan}</strong> · Requires <strong>{requiredPlan}</strong>
        </span>
      </div>

      <div className="locked-body">
        {perks.length > 0 && (
          <>
            <h2 className="card-title">What you get</h2>
            <ul className="locked-perks">
              {perks.map((p) => (
                <li key={p}><span className="locked-check"><Icon name="check" size={14} /></span>{p}</li>
              ))}
            </ul>
          </>
        )}

        {isOwner ? (
          <div className="locked-actions">
            <a className="btn btn-flame btn-lg" href={upgradeHref} target={UPGRADE_URL ? '_blank' : undefined} rel="noreferrer">
              <Icon name="sparkle" size={18} /> Upgrade to {requiredPlan}
            </a>
            <a className="btn btn-secondary btn-lg" href={contactHref}>
              <Icon name="mail" size={18} /> Contact sales
            </a>
          </div>
        ) : (
          <p className="alert alert-info" style={{ marginBottom: 0 }}>
            Ask your restaurant's manager to upgrade to {requiredPlan} to use {name}.
          </p>
        )}
      </div>
    </section>
  );
}
