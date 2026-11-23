import type { ReactNode } from 'react';

const TITLES: Array<[RegExp, string]> = [
  [/^\/restaurant\//, 'Menu'],
  [/^\/cart$/, 'Your cart'],
  [/^\/track\//, 'Order details'],
  [/^\/orders$/, 'My orders'],
  [/^\/profile$/, 'Profile'],
  [/^\/under99$/, '₹99 Store'],
  [/^\/category\//, 'Restaurants'],
];

/**
 * Opaque first-paint shell for a lazy route. It is deliberately independent of
 * route CSS so the push animation can start before the route chunk mounts.
 */
export function RouteShell({ pathname }: { pathname: string }): ReactNode {
  const title = TITLES.find(([pattern]) => pattern.test(pathname))?.[1] ?? 'Navereat';
  return (
    <div className="route-shell" aria-hidden="true">
      <div className="route-shell__bar">
        <span className="route-shell__back">‹</span>
        <span className="route-shell__title">{title}</span>
      </div>
      <div className="route-shell__body">
        <span className="route-shell__line route-shell__line--wide" />
        <span className="route-shell__line route-shell__line--short" />
      </div>
    </div>
  );
}
