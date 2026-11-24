import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { DemoOffer } from '../data/demo';
import { lockPageScroll } from '../lib/scrollLock';
import { registerSheet } from '../lib/sheetStack';
import '../styles/original/ew-offer-popup.css';

const AUTO_CLOSE_MS = 5200;
const CONFETTI_COLORS = ['#0b7a2a', '#f4b13d', '#d6246e', '#3b82d6', '#ee8a3a', '#7ac28f'];

const ART_RIDER = (
  <svg viewBox="0 0 160 160" width="150" height="150" aria-hidden="true" focusable="false">
    <defs>
      <clipPath id="ew-offer-clip">
        <circle cx="80" cy="80" r="78" />
      </clipPath>
    </defs>
    <circle cx="80" cy="80" r="78" fill="#dff3e6" />
    <g clipPath="url(#ew-offer-clip)">
      <ellipse cx="80" cy="136" rx="48" ry="5" fill="#0b3d1c" opacity=".12" />
      <circle cx="114" cy="122" r="14" fill="#262a31" />
      <circle cx="114" cy="122" r="5.5" fill="#aab2bc" />
      <circle cx="42" cy="122" r="14" fill="#262a31" />
      <circle cx="42" cy="122" r="5.5" fill="#aab2bc" />
      <path d="M42 122 L50 84" stroke="#2f7d4f" strokeWidth="5" strokeLinecap="round" />
      <path d="M42 80h14" stroke="#1f2430" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M52 112h60c7 0 11-4 11-10v-6H68c-5 0-9 2-11 7z" fill="#2f7d4f" />
      <rect x="99" y="46" width="40" height="48" rx="6" fill="#d6246e" />
      <rect x="99" y="46" width="40" height="9" rx="4" fill="#b81a5a" />
      <text x="119" y="71" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="Manrope,system-ui,sans-serif">FREE</text>
      <text x="119" y="82" textAnchor="middle" fontSize="6.4" fontWeight="800" fill="#fff" fontFamily="Manrope,system-ui,sans-serif">DELIVERY</text>
      <path d="M74 98 L62 106 L54 114" stroke="#262a31" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M86 98 L80 108" stroke="#262a31" strokeWidth="10" strokeLinecap="round" fill="none" />
      <path d="M66 56 Q80 47 94 56 L97 96 Q80 102 64 96 Z" fill="#2f8f56" />
      <path d="M88 60 L64 74 L50 80" stroke="#27794a" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="49" cy="80" r="4.6" fill="#e0a878" />
      <path d="M72 60 L56 66 L55 52" stroke="#2f8f56" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <rect x="51.5" y="39" width="5.6" height="12" rx="2.8" fill="#e0a878" transform="rotate(-14 54 50)" />
      <rect x="47" y="46" width="17" height="14" rx="6" fill="#e0a878" />
      <path d="M49.5 51h12M49.5 55h12" stroke="#c98d5c" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="82" cy="40" r="11.5" fill="#e0a878" />
      <path d="M70.5 39 Q71 26 83 26.5 Q95 27 93.5 40 Q88 33 70.5 39z" fill="#1b1b1f" />
      <path d="M72 43 Q82 58 93 43 Q91 51 82 52 Q74 51 72 43z" fill="#1b1b1f" />
      <rect x="75" y="36" width="19" height="6.4" rx="3.2" fill="#d6246e" />
    </g>
  </svg>
);

const ART_BADGE = (
  <svg viewBox="0 0 120 110" width="112" height="102" aria-hidden="true" focusable="false">
    <path d="M60 8l7 5 8-1 4 7 8 3-1 8 5 7-5 6 1 8-8 3-4 7-8-1-7 5-7-5-8 1-4-7-8-3 1-8-5-6 5-7-1-8 8-3 4-7 8 1z" fill="#2f7d4f" transform="translate(0 -2) scale(.96) translate(2.5 0)" />
    <text x="60" y="44" textAnchor="middle" fontSize="26" fontWeight="800" fill="#fff" fontFamily="Manrope,system-ui,sans-serif">%</text>
    <path d="M16 62h88c0 20-16 34-44 34S16 82 16 62z" fill="#f4b13d" />
    <rect x="42" y="94" width="36" height="8" rx="3" fill="#ee8a3a" />
    <path d="M24 22l4 8M96 18l-4 8M12 46l7 3M104 44l-7 3" stroke="#f3c8a8" strokeWidth="3" strokeLinecap="round" />
    <path d="M100 8l2.5 5.5L108 16l-5.5 2.5L100 24l-2.5-5.5L92 16l5.5-2.5z" fill="#3b82d6" />
    <path d="M18 14l1.8 3.7L23.5 19l-3.7 1.8L18 24.5l-1.8-3.7L12.5 19l3.7-1.3z" fill="#3b82d6" />
  </svg>
);

const SQUIG = (
  <svg className="ew-offer-squig" viewBox="0 0 300 90" aria-hidden="true" focusable="false">
    <path pathLength="1" d="M30 62c18-4 34-18 26-34" stroke="#f4b13d" />
    <path pathLength="1" d="M68 34c14-6 6 14 20 18" stroke="#d6246e" />
    <path pathLength="1" d="M104 44c26 12 60 8 70-14" stroke="#3b82d6" />
    <path pathLength="1" d="M146 20c0 20 28 6 36 28" stroke="#7ac28f" />
    <path pathLength="1" d="M214 26c28 4 46 24 26 44-12 10-30 4-34-2" stroke="#0b7a2a" />
    <circle cx="22" cy="30" r="2.5" fill="#f4b13d" />
    <circle cx="96" cy="70" r="2.5" fill="#3b82d6" />
    <circle cx="196" cy="62" r="2.5" fill="#d6246e" />
    <circle cx="262" cy="26" r="2.5" fill="#ee8a3a" />
    <circle cx="270" cy="62" r="2" fill="#0b7a2a" />
    <circle cx="130" cy="78" r="2" fill="#f4b13d" />
  </svg>
);

const SEAL = (
  <div className="ew-offer-seal" aria-hidden="true">
    <svg viewBox="0 0 80 80" width="76" height="76" focusable="false">
      <circle cx="40" cy="40" r="38" fill="#fff" />
      <path d="M40 7l6.2 4.6 7.6-1.2 3.4 6.9 7 3.4-1.1 7.7L68 40l-4.9 5.6 1.1 7.7-7 3.4-3.4 6.9-7.6-1.2L40 73l-6.2-4.6-7.6 1.2-3.4-6.9-7-3.4 1.1-7.7L12 40l4.9-5.6-1.1-7.7 7-3.4 3.4-6.9 7.6 1.2z" fill="#0b7a2a" />
      <text x="40" y="51" textAnchor="middle" fontSize="30" fontWeight="800" fill="#fff" fontFamily="Manrope,system-ui,sans-serif">%</text>
    </svg>
  </div>
);

function confettiStyle(index: number): CSSProperties {
  const angle = (index / 16) * 360 + (index % 2 ? 8 : -8);
  const distance = 92 + (index % 4) * 16;
  return {
    '--a': `${angle}deg`,
    '--d': `${distance}px`,
    '--c': CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    '--dl': `${(index % 5) * 28}ms`,
    borderRadius: index % 3 === 0 ? '50%' : undefined,
  } as CSSProperties;
}

const CONFETTI = Array.from({ length: 16 }, (_, index) => <i key={index} style={confettiStyle(index)} />);

interface OfferPopupProps {
  offers: DemoOffer[] | null;
  onClose: () => void;
}

export function OfferPopup({ offers, onClose }: OfferPopupProps) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const barRef = useRef<HTMLElement>(null);
  const timerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const single = offers?.length === 1 ? offers[0] : null;
  const total = useMemo(() => (offers ?? []).reduce((sum, offer) => sum + offer.amount, 0), [offers]);

  const close = () => {
    if (closing) return;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    setClosing(true);
    setOpen(false);
    closeTimerRef.current = window.setTimeout(() => {
      onCloseRef.current();
    }, 200);
  };

  const startTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const bar = barRef.current;
    if (bar) {
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(0)';
      void bar.offsetWidth;
      bar.style.transition = `transform ${AUTO_CLOSE_MS}ms linear`;
      bar.style.transform = 'scaleX(1)';
    }
    timerRef.current = window.setTimeout(close, AUTO_CLOSE_MS);
  };

  const pauseTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    const bar = barRef.current;
    if (bar) {
      bar.style.transition = 'none';
      bar.style.transform = 'scaleX(0)';
    }
  };

  // The back gesture closes the offer sheet before it can pop the route or
  // background the app behind it.
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return undefined;
    return registerSheet(() => closeRef.current());
  }, [open]);

  useEffect(() => {
    if (!offers?.length) return;
    const unlock = lockPageScroll();
    const frame = window.requestAnimationFrame(() => {
      setOpen(true);
      startTimer();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      unlock();
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', onKeyDown);
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
    // The popup is mounted per offer set; internal timers must start once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offers]);

  if (!offers?.length || (!open && !closing)) return null;

  const rootClass = `ew-offer${open ? ' is-open' : ''}`;

  return createPortal(
    <div className={rootClass}>
      <div className="ew-offer-scrim" onClick={close} />
      <div
        className="ew-offer-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ew-offer-big"
        aria-describedby="ew-offer-sub"
        onPointerDown={pauseTimer}
        onPointerUp={startTimer}
        onPointerCancel={startTimer}
      >
        <button type="button" className="ew-offer-x" onClick={close} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
          </svg>
        </button>
        <div className={`ew-offer-art${single?.kind === 'delivery' ? ' is-rider' : ''}`}>
          {single?.kind === 'delivery' ? ART_RIDER : ART_BADGE}
        </div>
        <img className="ew-offer-img" alt="" hidden />
        <div className="ew-offer-confetti" aria-hidden="true">
          {CONFETTI}
        </div>
        {SEAL}
        {SQUIG}
        <p className="ew-offer-eyebrow" hidden={single?.kind === 'delivery'}>
          {single?.kind === 'delivery' ? '' : 'Congratulations!'}
        </p>
        <p className="ew-offer-code" hidden />
        <h2 className="ew-offer-big" id="ew-offer-big">
          {single
            ? single.big
            : total > 0
              ? `You’re saving ₹${total}!`
              : 'Offers applied!'}
        </h2>
        <p className="ew-offer-sub" id="ew-offer-sub" hidden={!single?.sub && !!single}>
          {single ? single.sub : 'These offers are applied to your order'}
        </p>
        <p className="ew-offer-desc" hidden />
        <p className="ew-offer-chip" hidden={!single?.chip}>
          {single?.chip ?? ''}
        </p>
        <dl className="ew-offer-details" hidden />
        <ul className="ew-offer-list" hidden={!!single}>
          {!single &&
            offers.map((offer) => (
              <li key={offer.id}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>{offer.row}</span>
              </li>
            ))}
        </ul>
        <button type="button" className="ew-offer-btn" onClick={close} id="ew-offer-ok">
          YAY!
        </button>
        <span className="ew-offer-timer" aria-hidden="true">
          <i id="ew-offer-bar" ref={barRef} />
        </span>
      </div>
    </div>,
    document.body,
  );
}
