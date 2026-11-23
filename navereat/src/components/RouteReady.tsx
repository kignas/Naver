import { useLayoutEffect, type ReactNode } from 'react';
import { markRouteReady } from '../lib/routeReady';

/** Marks the real page as committed, not the Suspense fallback, for transitions. */
export function RouteReady({ routeKey, children }: { routeKey: string; children: ReactNode }) {
  useLayoutEffect(() => {
    markRouteReady(routeKey);
  }, [routeKey]);
  return <>{children}</>;
}
