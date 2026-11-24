import { lazy, Suspense, useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { BottomNav } from './components/BottomNav';
import { CartBar } from './components/CartBar';
import { CustomizeProvider } from './components/CustomizeSheet';
import { PageTransition } from './components/PageTransition';
import { RouteReady } from './components/RouteReady';
import { RouteShell } from './components/RouteShell';
import { SearchOverlay } from './components/SearchOverlay';
import { ToastHost } from './components/ToastHost';
import { useBackButton } from './hooks/useBackButton';
import { isTabPath, NavBridge } from './lib/navigation';
import { useAppStore } from './store/appStore';
import { useSearchStore } from './store/searchStore';
import { useNavStore } from './store/navStore';
import { statusBarStyle, statusBarTheme } from './lib/statusBarTheme';
import { StressDebugPanel } from './dev/StressDebugPanel';
import { primeFonts } from './lib/fonts';
import { installPreloadOnIntent, preloadAllRoutes, preloadLikelyRoutes, routeLoaders } from './lib/routeLoaders';
import { Login } from './pages/Login';
import { Home } from './pages/Home';

const Restaurant = lazy(() => routeLoaders.restaurant().then((module) => ({ default: module.Restaurant })));
const Under99 = lazy(() => routeLoaders.under99().then((module) => ({ default: module.Under99 })));
const Category = lazy(() => routeLoaders.category().then((module) => ({ default: module.Category })));
const Cart = lazy(() => routeLoaders.cart().then((module) => ({ default: module.Cart })));
const Orders = lazy(() => routeLoaders.orders().then((module) => ({ default: module.Orders })));
const Track = lazy(() => routeLoaders.track().then((module) => ({ default: module.Track })));
const Profile = lazy(() => routeLoaders.profile().then((module) => ({ default: module.Profile })));

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

  if (!token && location.pathname !== '/login') return null;

  const pathname = location.pathname;
  const cartBarVisible =
    !searchOpen &&
    (pathname === '/' ||
      pathname === '/under99' ||
      pathname.startsWith('/category/') ||
      pathname.startsWith('/restaurant/'));
  const cartBarMode = pathname.startsWith('/restaurant/') ? 'pink' : 'home';
  // Only the two tab routes draw the floating nav.
  const cartBarAboveNav = cartBarVisible && isTabPath(pathname);

  return (
    <div className="app-shell">
      <div className="app-viewport">
        <PageTransition
          location={location}
          swipeBack={!isTabPath(location.pathname) && location.pathname !== '/login'}
          render={(routeLocation) => (
            <Suspense fallback={<RouteShell pathname={routeLocation.pathname} />}>
              <RouteReady routeKey={routeLocation.key}>
                <Routes location={routeLocation}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/" element={<Home />} />
                  <Route path="/under99" element={<Under99 />} />
                  <Route path="/category/:type" element={<Category />} />
                  <Route path="/restaurant/:id" element={<Restaurant />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/orders" element={<Orders />} />
                  <Route path="/track/:id" element={<Track />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </RouteReady>
            </Suspense>
          )}
        />
      </div>
      <CartBar visible={cartBarVisible} mode={cartBarMode} aboveNav={cartBarAboveNav} />
      <BottomNav />
      <ToastHost />
    </div>
  );
}

export default function App() {
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
        <SearchOverlay />
        <StressDebugPanel />
      </CustomizeProvider>
    </HashRouter>
  );
}
