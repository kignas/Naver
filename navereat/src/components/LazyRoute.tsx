import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { RouteBoundary } from './RouteBoundary';
import { RouteErrorScreen } from './RouteErrorScreen';
import { RouteReady } from './RouteReady';
import { RouteShell } from './RouteShell';
import { loadRouteComponent, routeComponent, type LazyRouteKey } from '../lib/routeLoaders';
import { useAppNav } from '../lib/navigation';
import { useNavStore } from '../store/navStore';

/**
 * True the first time a route asks for its post-failure reload in this session.
 * The flag must survive the reload, so it lives in sessionStorage.
 */
function claimReloadSlot(routeKey: LazyRouteKey): boolean {
  const key = `navereat_route_reload:${routeKey}`;
  try {
    if (window.sessionStorage.getItem(key)) return false;
    window.sessionStorage.setItem(key, '1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Renders a code-split page without React.lazy.
 *
 * The chunk is warmed at idle and on touch intent, so `routeComponent` usually
 * answers synchronously and the page paints in the incoming layer's first
 * commit — no shell, no second commit, and a push that can start a frame after
 * the tap. A route whose chunk is not in yet still falls back to the shell.
 *
 * If the chunk never arrives (a dropped request, or a hashed file that no
 * longer exists after a redeploy) the layer shows a retry card instead of the
 * shell, because a shell that never resolves looks exactly like a dead app.
 */
export function LazyRoute({ routeKey, pathname }: { routeKey: LazyRouteKey; pathname: string }) {
  const nav = useAppNav();
  const [Page, setPage] = useState<ComponentType | null>(() => routeComponent(routeKey));
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
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
    if (Page) return undefined;
    let live = true;
    setFailed(false);
    loadRouteComponent(routeKey)
      .then((component) => {
        if (!live) return;
        if (component) setPage(() => component);
        else setFailed(true);
      })
      .catch(() => {
        if (!live) return;
        // A chunk that is gone for good (its hashed file no longer exists after
        // a redeploy) can only be fixed by fetching index.html again. Do that
        // once per route per session, so a dropped connection cannot loop.
        if (attempt > 0 && claimReloadSlot(routeKey)) {
          window.location.reload();
          return;
        }
        setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [Page, routeKey, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const home = useCallback(() => nav.tab('/'), [nav]);

  if (failed && !Page) return <RouteErrorScreen kind="chunk" onRetry={retry} onHome={home} />;
  if (!Page || !armed) return <RouteShell pathname={pathname} />;
  return (
    <RouteBoundary>
      <RouteReady>
        <Page />
      </RouteReady>
    </RouteBoundary>
  );
}
