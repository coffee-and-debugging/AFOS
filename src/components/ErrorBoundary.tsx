import { Component, type ErrorInfo, type ReactNode } from 'react';
import Icon from './Icon';

interface State {
  error: Error | null;
}

/** Last line of defence: a render error shows a recovery screen instead of a blank page. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-page">
        <div className="state state-error" role="alert">
          <div className="state-icon"><Icon name="bell" size={32} /></div>
          <h1 className="state-title">This screen hit a problem</h1>
          <p className="state-text">Your data is safe. Reload the page to continue where you left off.</p>
          <div className="row">
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              <Icon name="refresh" size={16} /> Reload
            </button>
            <a className="btn btn-secondary" href="/">Go to start</a>
          </div>
        </div>
      </div>
    );
  }
}
