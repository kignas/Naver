import { Icon } from './Icon';
import './route-error.css';

export type RouteErrorKind = 'chunk' | 'render';

const COPY: Record<RouteErrorKind, { title: string; body: string }> = {
  chunk: {
    title: "This page didn't load",
    body: 'The page could not be fetched. Check your connection and try again — nothing in your cart was lost.',
  },
  render: {
    title: 'Something went wrong',
    body: 'This page hit a problem while it was drawing. Try again, or go back to the home page.',
  },
};

/**
 * The recovery surface for a route that cannot be shown: a chunk that never
 * arrived, or a page that threw while rendering. Without it both cases left the
 * layer on the loading shell (or, for a render error, blanked the whole app
 * because React unmounts the tree), which reads as "the app is broken".
 */
export function RouteErrorScreen({
  kind,
  onRetry,
  onHome,
}: {
  kind: RouteErrorKind;
  onRetry: () => void;
  onHome: () => void;
}) {
  const copy = COPY[kind];
  return (
    <div className="route-error" role="alert" data-route-error={kind}>
      <div className="route-error__card">
        <span className="route-error__icon" aria-hidden="true">
          <Icon name="solid:triangle-exclamation" size={22} />
        </span>
        <h1 className="route-error__title">{copy.title}</h1>
        <p className="route-error__body">{copy.body}</p>
        <button className="route-error__primary tap" type="button" onClick={onRetry}>
          Try again
        </button>
        <button className="route-error__secondary tap" type="button" onClick={onHome}>
          Back to home
        </button>
      </div>
    </div>
  );
}
