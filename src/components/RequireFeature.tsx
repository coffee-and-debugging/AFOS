import type { ReactNode } from 'react';
import FeatureLocked from './FeatureLocked';
import { LoadingState } from './States';
import { useFeature } from '../hooks';
import type { Feature } from '../lib/plans';

/**
 * Renders children only when the plan includes `feature`; otherwise the upgrade page.
 * Waits for the plan to load, so subscribers never see a flash of the locked screen.
 */
export default function RequireFeature({ feature, children }: { feature: Feature; children: ReactNode }) {
  const { allowed, loaded } = useFeature(feature);
  if (!loaded) return <LoadingState />;
  return allowed ? <>{children}</> : <FeatureLocked feature={feature} />;
}
