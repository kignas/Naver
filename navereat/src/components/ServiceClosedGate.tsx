import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { usePlatformStatusData } from '../data';
import { toast } from '../store/toastStore';
import './service-gate.css';

const BANNER_DISMISSED_KEY = 'eg_banner_closed';
const OVERLAY_DISMISSED_KEY = 'eg_overlay_closed';
const POLL_MS = 30000;
const OPEN_TIMER_PAD_MS = 1500;

/** Only these states lock ordering; a rider shortage never does. */
const LOCK_STATES = new Set(['closed_hours', 'closed_manual', 'maintenance']);

const sessionFlag = (key: string): boolean => {
  try {
    return window.sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};

const setSessionFlag = (key: string): void => {
  try {
    window.sessionStorage.setItem(key, '1');
  } catch {
    /* storage may be unavailable */
  }
};

/**
 * The original's "Ordering is closed" gate (service-closed-gate.js): a
 * non-blocking sticky banner everywhere, a dismissible full screen on the home
 * route only, checkout taps refused while closed, a 30 s re-check, and
 * fail-open on any error.
 */
export function ServiceClosedGate() {
  const { status, mode, reload } = usePlatformStatusData();
  const location = useLocation();
  const [bannerDismissed, setBannerDismissed] = useState(() => sessionFlag(BANNER_DISMISSED_KEY));
  const [overlayDismissed, setOverlayDismissed] = useState(() => sessionFlag(OVERLAY_DISMISSED_KEY));

  const service = status?.service;
  const closed = Boolean(service && service.canOrder === false && LOCK_STATES.has(service.state));

  // Re-check while visible, on focus, and once at nextOpenAt + 1.5 s.
  useEffect(() => {
    if (mode !== 'api' || !status) return undefined;
    const bump = () => reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') bump();
    }, POLL_MS);
    window.addEventListener('focus', bump);
    let openTimer = 0;
    if (service?.nextOpenAt) {
      const wait = new Date(service.nextOpenAt).getTime() - Date.now() + OPEN_TIMER_PAD_MS;
      if (Number.isFinite(wait) && wait > 0) openTimer = window.setTimeout(bump, Math.min(wait, 24 * 60 * 60 * 1000));
    }
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(openTimer);
      window.removeEventListener('focus', bump);
    };
  }, [mode, reload, status, service?.nextOpenAt]);

  const message = useMemo(() => {
    if (!closed || !service) return '';
    return service.message || service.title || 'Ordering is currently closed.';
  }, [closed, service]);

  // Refuse checkout / add-to-cart taps while closed, like the original.
  useEffect(() => {
    if (!closed) return undefined;
    const onTap = (event: Event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const blocked = target.closest(
        '#cart-bar, [data-checkout], .ct-cta, .u99-add, .add-btn, .ct-add, [data-add-to-cart]',
      );
      if (!blocked) return;
      event.preventDefault();
      event.stopPropagation();
      toast(message);
    };
    document.addEventListener('click', onTap, true);
    return () => document.removeEventListener('click', onTap, true);
  }, [closed, message]);

  const dismissBanner = useCallback(() => {
    setSessionFlag(BANNER_DISMISSED_KEY);
    setBannerDismissed(true);
  }, []);
  const dismissOverlay = useCallback(() => {
    setSessionFlag(OVERLAY_DISMISSED_KEY);
    setOverlayDismissed(true);
  }, []);

  if (mode !== 'api' || !status || !closed) return null;

  const title = service?.title || 'Ordering is closed';
  const detail = service?.detail || message;
  const isHome = location.pathname === '/';

  return (
    <>
      {!bannerDismissed && (
        <div className="sg-banner" role="status">
          <span className="sg-banner__text">{message}</span>
          <button className="sg-banner__close" type="button" aria-label="Dismiss" onClick={dismissBanner}>
            ×
          </button>
        </div>
      )}
      {isHome && !overlayDismissed && (
        <div className="sg-overlay" role="dialog" aria-modal="true" aria-labelledby="sg-title">
          <div className="sg-card">
            <p className="sg-emoji" aria-hidden="true">
              🌙
            </p>
            <h2 className="sg-title" id="sg-title">
              {title}
            </h2>
            <p className="sg-message">{message}</p>
            {detail && detail !== message && <p className="sg-detail">{detail}</p>}
            {service?.nextOpenLabel && <p className="sg-next">Back {service.nextOpenLabel}</p>}
            <button className="sg-browse" type="button" onClick={dismissOverlay}>
              Browse Menu Anyway
            </button>
          </div>
        </div>
      )}
    </>
  );
}
