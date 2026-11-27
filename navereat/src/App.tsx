import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BottomNav } from './components/BottomNav';
import { CartBar } from './components/CartBar';
import { CustomizeProvider } from './components/CustomizeSheet';
import { PageTransition } from './components/PageTransition';
import { LazyRoute } from './components/LazyRoute';
import { RouteBoundary } from './components/RouteBoundary';
import { RouteReady } from './components/RouteReady';
import { RouteShell } from './components/RouteShell';
import { SearchOverlay } from './components/SearchOverlay';
import { ToastHost } from './components/ToastHost';
import { useBackButton } from './hooks/useBackButton';
import { installTapFeedback } from './lib/gsap';
import { installFlipOriginCapture } from './lib/sharedElement';
import { useChromePathname } from './lib/chromeRoute';
import { isTabPath, NavBridge } from './lib/navigation';
import { useAppStore } from './store/appStore';
import { useSearchStore } from './store/searchStore';
import { useNavStore } from './store/navStore';
import { statusBarStyle, statusBarTheme } from './lib/statusBarTheme';
import { createRoot, type Root } from 'react-dom/client';
import { debugWanted } from './lib/debugFlag';
import { primeFonts } from './lib/fonts';
import { installPreloadOnIntent, preloadAllRoutes, preloadLikelyRoutes } from './lib/routeLoaders';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { useDataSourceMode } from './data';



function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const setDirection = useNavStore((s) => s.setDirection);
  const token = useAppStore((s) => s.token);
  const searchOpen = useSearchStore((s) => s.isOpen);

  useBackButton();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const theme = statusBarTheme(location.pathname);
    void StatusBar.setOverlaysWebView({ overlay: false });
    void StatusBar.setStyle({ style: statusBarStyle(theme) === 'Dark' ? Style.Dark : Style.Light });
    void StatusBar.setBackgroundColor({ color: theme.color });
  }, [location.pathname]);

  useEffect(() => {
    if (!token) return;
    const run = () => preloadLikelyRoutes(location.pathname);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 200);
    return () => window.clearTimeout(id);
  }, [location.pathname, token]);

  useEffect(() => {
    if (!token) return;
    const run = () => preloadAllRoutes();
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 900 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 600);
    return () => window.clearTimeout(id);
  }, [token]);

  useEffect(() => installPreloadOnIntent(), []);

  useEffect(() => installTapFeedback(), []);
  useEffect(() => installFlipOriginCapture(), []);

  useEffect(() => {
    const run = () => void primeFonts();
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 900 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(run, 400);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!token && location.pathname !== '/login') {
      setDirection('pop');
      navigate('/login', { replace: true });
    } else if (token && location.pathname === '/login') {
      setDirection('tab');
      navigate('/', { replace: true });
    }
  }, [token, location.pathname, navigate, setDirection]);

  // Declared above the guard: hooks may not run conditionally.
  // The shell paints one slide behind the router on a push, so the cart pill
  // cannot move out from under a Home that is still on screen. See chromeRoute.
  const chromePathname = useChromePathname(location.pathname);

  if (!token && location.pathname !== '/login') return null;

  const cartBarVisible =
    !searchOpen &&
    (chromePathname === '/' ||
      chromePathname === '/under99' ||
      chromePathname.startsWith('/category/') ||
      chromePathname.startsWith('/restaurant/'));
  const cartBarMode = chromePathname.startsWith('/restaurant/') ? 'pink' : 'home';
  // The shell still paints the outgoing tab's bar while a pushed page covers
  // it, exactly like the floating nav.
  const cartBarCovered = cartBarVisible && chromePathname !== location.pathname;
  // Only the two tab routes draw the floating nav.
  const cartBarAboveNav = cartBarVisible && isTabPath(chromePathname);

  return (
    <div className="app-shell">
      <div className="app-viewport">
        <PageTransition
          location={location}
          swipeBack={!isTabPath(location.pathname) && location.pathname !== '/login'}
          render={(routeLocation) => (
            <Suspense fallback={<RouteShell pathname={routeLocation.pathname} />}>
              <Routes location={routeLocation}>
                <Route path="/login" element={<RouteBoundary><Login /></RouteBoundary>} />
                <Route
                  path="/"
                  element={
                    <RouteBoundary>
                      <RouteReady>
                        <Home />
                      </RouteReady>
                    </RouteBoundary>
                  }
                />
                <Route path="/under99" element={<LazyRoute routeKey="under99" pathname={routeLocation.pathname} />} />
                <Route path="/category/:type" element={<LazyRoute routeKey="category" pathname={routeLocation.pathname} />} />
                <Route path="/restaurant/:id" element={<LazyRoute routeKey="restaurant" pathname={routeLocation.pathname} />} />
                <Route path="/cart" element={<LazyRoute routeKey="cart" pathname={routeLocation.pathname} />} />
                <Route path="/orders" element={<LazyRoute routeKey="orders" pathname={routeLocation.pathname} />} />
                <Route path="/track/:id" element={<LazyRoute routeKey="track" pathname={routeLocation.pathname} />} />
                <Route path="/profile" element={<LazyRoute routeKey="profile" pathname={routeLocation.pathname} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          )}
        />
      </div>
      <CartBar
        visible={cartBarVisible}
        mode={cartBarMode}
        aboveNav={cartBarAboveNav}
        covered={cartBarCovered}
      />
      <BottomNav />
      <ToastHost />
    </div>
  );
}


/**
 * The field debug panel is a tester overlay, not part of the page tree. It gets
 * its own React root on document.body so its 500 ms stats updates and rAF loop
 * can never re-render (or re-time the commits of) the app it is measuring.
 */
function DebugPanelRoot(): null {
  useEffect(() => {
    if (!debugWanted()) return undefined;
    let disposed = false;
    let host: HTMLDivElement | undefined;
    let root: Root | undefined;
    // Testers only: keeping the overlay out of the entry chunk means its stats
    // table and rAF loop are not parsed on the path to first paint.
    void import('./dev/StressDebugPanel').then(({ StressDebugPanel }) => {
      if (disposed) return;
      host = document.createElement('div');
      host.id = 'nbp-debug-root';
      document.body.appendChild(host);
      root = createRoot(host);
      root.render(<StressDebugPanel />);
    });
    return () => {
      disposed = true;
      root?.unmount();
      host?.remove();
    };
  }, []);
  return null;
}

const ServiceClosedGate = lazy(() => import('./components/ServiceClosedGate').then((module) => ({ default: module.ServiceClosedGate })));

export default function App() {
  const dataMode = useDataSourceMode();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const hide = () => void SplashScreen.hide();
    window.addEventListener('navereat:home-painted', hide, { once: true });
    const fallback = window.setTimeout(hide, 2500);
    return () => {
      window.removeEventListener('navereat:home-painted', hide);
      window.clearTimeout(fallback);
    };
  }, []);

  return (
    <HashRouter>
      <NavBridge />
      <CustomizeProvider>
        <AppRoutes />
        {dataMode === 'api' && (
          <Suspense fallback={null}>
            <ServiceClosedGate />
          </Suspense>
        )}
        <SearchOverlay />
        <DebugPanelRoot />
      </CustomizeProvider>
    </HashRouter>
  );
}
