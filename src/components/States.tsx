import type { ReactNode } from 'react';
import Icon, { type IconName } from './Icon';
import { NetworkError } from '../api/client';
import { useConnectivity } from '../hooks';

export function EmptyState({ icon, title, text, children }: { icon: IconName; title: string; text?: string; children?: ReactNode }) {
  return (
    <div className="state">
      <div className="state-icon"><Icon name={icon} size={32} /></div>
      <h2 className="state-title">{title}</h2>
      {text && <p className="state-text">{text}</p>}
      {children}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  const offline = !error || error instanceof NetworkError;
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon"><Icon name={offline ? 'wifiOff' : 'bell'} size={32} /></div>
      <h2 className="state-title">{offline ? "We can't reach the server" : 'Something went wrong'}</h2>
      <p className="state-text">
        {offline
          ? 'This usually fixes itself in a few seconds. We will keep trying in the background.'
          : error.message}
      </p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Try again
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" aria-live="polite">
      <div className="spinner" />
      <p className="subtle">{label}</p>
    </div>
  );
}

export function OfflineBanner() {
  const status = useConnectivity();
  if (status === 'online') return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="wifiOff" size={16} /> Connection lost — showing the last saved data and reconnecting…
    </div>
  );
}
