import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { CartBar } from './components/CartBar';
import { CustomizeProvider } from './components/CustomizeSheet';
import { PageTransition } from './components/PageTransition';
import { SearchOverlay } from './components/SearchOverlay';
import { ToastHost } from './components/ToastHost';
import { useBackButton } from './hooks/useBackButton';
import { isTabPath } from './lib/navigation';
import { useAppStore } from './store/appStore';
import { useNavStore } from './store/navStore';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Restaurant } from './pages/Restaurant';
import { Under99 } from './pages/Under99';
import { Category } from './pages/Category';
import { Cart } from './pages/Cart';
import { Orders } from './pages/Orders';
import { Track } from './pages/Track';
import { Profile } from './pages/Profile';

function AppRoutes() {
  const location = useLocation();
  const navigate = useNavigate();
  const direction = useNavStore((s) => s.direction);
  const setDirection = useNavStore((s) => s.setDirection);
  const token = useAppStore((s) => s.token);

  useBackButton();

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
    pathname === '/' ||
    pathname === '/under99' ||
    pathname.startsWith('/category/') ||
    pathname.startsWith('/restaurant/');
  const cartBarMode = pathname.startsWith('/restaurant/') ? 'pink' : 'home';
  const cartBarAboveNav = !pathname.startsWith('/restaurant/');

  return (
    <div className="app-shell">
      <div className="app-viewport">
        <PageTransition
          location={location}
          direction={direction}
          swipeBack={!isTabPath(location.pathname) && location.pathname !== '/login'}
          render={(routeLocation) => (
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
          )}
        />
      </div>
      <CartBar visible={cartBarVisible} mode={cartBarMode} aboveNav={cartBarAboveNav} />
      <ToastHost />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setBackgroundColor({ color: '#ffffff' });
    window.setTimeout(() => void SplashScreen.hide(), 250);
  }, []);

  return (
    <HashRouter>
      <CustomizeProvider>
        <AppRoutes />
        <SearchOverlay />
      </CustomizeProvider>
    </HashRouter>
  );
}
