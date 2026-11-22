import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import badgeSvg from '../assets/order-success-badge.svg?raw';
import { demoOrders, type Order } from '../data/demo';
import { useAppNav } from '../lib/navigation';
import { useAppStore } from '../store/appStore';
import successSheetCss from '../styles/original/order-success-sheet.css?raw';
import '../styles/pages/success.css';

const CONF_COLORS = ['#FFFFFF', '#FDE68A', '#BAE6FD', '#FBCFE8', '#FACC15', '#FFFFFF', '#A7F3D0'];

function confettiStyle(index: number, total: number): CSSProperties {
  const angle = (index / total) * Math.PI * 2 + ((index % 3) - 1) * 0.12;
  const radius = 96 + ((index * 37) % 5) * 16;
  const pill = index % 3 === 1;
  const width = pill ? 4 : 5 + (index % 4);
  const height = pill ? 10 : 5 + (index % 4);
  return {
    '--c': CONF_COLORS[index % CONF_COLORS.length],
    '--dx': `${Math.round(Math.sin(angle) * radius * 1.15)}px`,
    '--dy': `${Math.max(-104, Math.round(-Math.cos(angle) * radius * 0.8))}px`,
    '--r': `${(index % 2 ? 1 : -1) * (180 + ((index * 53) % 220))}deg`,
    '--w': `${width}px`,
    '--h': `${height}px`,
    '--br': pill ? '2px' : '50%',
    '--d': `${(index % 4) * 0.025}s`,
  } as CSSProperties;
}

export function Success() {
  const nav = useAppNav();
  const orders = useAppStore((s) => s.orders);
  const [entered, setEntered] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const style = document.createElement('style');
    style.dataset.navereatSuccess = 'true';
    style.textContent = successSheetCss;
    document.head.appendChild(style);
    const frame = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(frame);
      style.remove();
    };
  }, []);

  const order = useMemo<Order | undefined>(() => {
    return orders.find((entry) => entry.status !== 'delivered' && entry.status !== 'cancelled') ?? orders[0] ?? demoOrders[0];
  }, [orders]);

  const go = () => {
    if (timer.current) window.clearTimeout(timer.current);
    if (order) nav.push(`/track/${order.id}`);
    else nav.tab('/orders');
  };

  useEffect(() => {
    timer.current = window.setTimeout(go, 2600);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id]);

  const confetti = Array.from({ length: 18 }, (_, index) => (
    <i key={index} style={confettiStyle(index, 18)} />
  ));

  return (
    <div className="success-page">
      <div className={`ew-os ew-os--done ew-os--direct${entered ? ' is-open' : ''}`} role="dialog" aria-modal="true" aria-labelledby="ew-os-title">
        <div className="ew-os__scrim" />
        <div className="ew-os__sheet" tabIndex={-1}>
          <div className="ew-os__wash">
            <div className="ew-os__wash-fill" />
          </div>
          <span className="ew-os__grab" />
          <div className="ew-os__hero">
            <span className="ew-os__pulse" />
            <span className="ew-os__ring" />
            <span className="ew-os__ring ew-os__ring--2" />
            <div className="ew-os__confetti">{confetti}</div>
            <span dangerouslySetInnerHTML={{ __html: badgeSvg }} />
          </div>
          <h2 className="ew-os__title" id="ew-os-title">Order placed</h2>
          <p className="ew-os__msg" role="status">The restaurant is getting your order ready.</p>
          <div className="ew-os__actions">
            <button className="ew-os__btn tap" type="button" onClick={go}>
              Track my order
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
