import { Component, useCallback, useState, type ErrorInfo, type ReactNode } from 'react';
import { useAppNav } from '../lib/navigation';
import { RouteErrorScreen } from './RouteErrorScreen';

interface BoundaryProps {
  children: ReactNode;
  onRetry: () => void;
  onHome: () => void;
  /** Changing this remounts the subtree, so "Try again" re-renders the page. */
  attempt: number;
}

interface BoundaryState {
  failed: boolean;
}

/**
 * React unmounts the whole tree when a render throws, which left a white screen
 * with no way back. Each route layer now catches its own page's error and shows
 * a recovery card instead; the shell, the nav and the other layers stay alive.
 */
class PageBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[navereat] route render failed', error, info.componentStack);
  }

  componentDidUpdate(previous: BoundaryProps): void {
    if (previous.attempt !== this.props.attempt && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  reset = (): void => {
    this.setState({ failed: false });
    this.props.onRetry();
  };

  render(): ReactNode {
    if (!this.state.failed) return this.props.children;
    return <RouteErrorScreen kind="render" onRetry={this.reset} onHome={this.props.onHome} />;
  }
}

export function RouteBoundary({ children }: { children: ReactNode }) {
  const nav = useAppNav();
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const home = useCallback(() => {
    setAttempt((value) => value + 1);
    nav.tab('/');
  }, [nav]);

  return (
    <PageBoundary attempt={attempt} onRetry={retry} onHome={home}>
      {children}
    </PageBoundary>
  );
}
