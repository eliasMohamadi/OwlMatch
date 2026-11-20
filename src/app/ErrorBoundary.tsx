import { Component, type ErrorInfo, type ReactNode } from 'react';

/** Last line of defense: a broken screen shows a recovery option instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ui] unhandled error', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-extrabold text-ink">Something went wrong</h1>
        <p className="max-w-sm text-muted">This screen hit an unexpected error. Your saved events and swipes are safe.</p>
        <button type="button" className="h-11 rounded-full bg-gold px-6 font-semibold text-ink" onClick={() => window.location.assign('/discover')}>
          Back to Discover
        </button>
      </div>
    );
  }
}
