import { useEffect, useRef, useState, type ComponentType } from 'react';
import { RouteReady } from './RouteReady';
import { RouteShell } from './RouteShell';
import { loadRouteComponent, routeComponent, type LazyRouteKey } from '../lib/routeLoaders';
import { useNavStore } from '../store/navStore';

/**
 * Renders a code-split page without React.lazy.
 *
 * The chunk is warmed at idle and on touch intent, so `routeComponent` usually
 * answers synchronously and the page paints in the incoming layer's first
 * commit — no shell, no second commit, and a push that can start a frame after
 * the tap. A route whose chunk is not in yet still falls back to the shell.
 */
export function LazyRoute({ routeKey, pathname }: { routeKey: LazyRouteKey; pathname: string }) {
  const [Page, setPage] = useState<ComponentType | null>(() => routeComponent(routeKey));
  // A layer mounted for a transition first paints the shell and arms the page a
  // frame later. Mounting a whole page inside the tap's own commit blocks the
  // main thread for the length of that render, which is exactly the press
  // feedback the finger is waiting for; the slide waits for the page anyway.
  const deferred = useRef(useNavStore.getState().preparing);
  const [armed, setArmed] = useState(() => !deferred.current);
  useEffect(() => {
    if (armed) return undefined;
    const frame = window.requestAnimationFrame(() => setArmed(true));
    return () => window.cancelAnimationFrame(frame);
  }, [armed]);

  useEffect(() => {
    if (Page) return;
    let live = true;
    void loadRouteComponent(routeKey).then((component) => {
      if (live && component) setPage(() => component);
    });
    return () => {
      live = false;
    };
  }, [Page, routeKey]);

  if (!Page || !armed) return <RouteShell pathname={pathname} />;
  return (
    <RouteReady>
      <Page />
    </RouteReady>
  );
}
