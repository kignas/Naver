import { useLayoutEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { markRouteReady } from '../lib/routeReady';

/**
 * Marks the real page as committed, not the route shell, for transitions.
 *
 * It sits inside the route element and reads the location from the router
 * context, so a page that renders a shell first (a chunk still in flight) only
 * reports ready once its content is actually mounted.
 */
export function RouteReady({ children }: { children: ReactNode }) {
  const routeKey = useLocation().key;
  useLayoutEffect(() => {
    markRouteReady(routeKey);
  }, [routeKey]);
  return <>{children}</>;
}
