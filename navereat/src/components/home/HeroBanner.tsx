import { memo, useEffect, useRef } from 'react';
import { useHomeBanners } from '../../data';
import { useAppNav } from '../../lib/navigation';
import { subscribeSheetCount } from '../../lib/sheetStack';
import { overlayOpen } from '../../hooks/useOverlayOpen';
import './HeroBanner.css';

export interface HeroBannerProps {
  /** Brand pill next to the eyebrow. */
  brandBadge?: string;
  eyebrowPrefix?: string;
  /** State A headline copy */
  stateALine1?: string;
  stateALine2?: string;
  /** State B headline copy */
  stateBLine1?: string;
  stateBLine2?: string;
  /** Optional price line; rendered only when a value is supplied. */
  stateBPricePrefix?: string;
  stateBPriceValue?: string;
  /** Static CTA button copy & handler */
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

const DEFAULT_A_LINE1 = 'Good food';
const DEFAULT_A_LINE2 = 'Near you.';
const DEFAULT_B_LINE1 = 'Fresh picks';
const DEFAULT_B_LINE2 = 'Every day';
const DEFAULT_CTA = 'Order now';

/** The API belongs to the original brand; keep its copy free of that name. */
const brandSafe = (value: string | undefined): string => (value ?? '').trim().replace(/eatswada/gi, 'Navereat');

const firstText = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    const text = (value ?? '').trim();
    if (text) return text;
  }
  return '';
};

/**
 * Animated promo banner in the Home hero sheet. The five-second loop runs on
 * transform + opacity only; a single effect pauses it with a class (no React
 * state, no store writes) when the banner is off-screen, when Home is not the
 * visible top route, when a sheet or the search overlay owns the screen, or
 * when the document is hidden. `animation-play-state` keeps currentTime, so a
 * resume continues the same cycle instead of restarting it.
 */
export const HeroBanner = memo(function HeroBanner({
  brandBadge = 'Navereat',
  eyebrowPrefix = 'Only on',
  stateALine1,
  stateALine2,
  stateBLine1,
  stateBLine2,
  stateBPricePrefix,
  stateBPriceValue,
  ctaLabel,
  onCtaClick,
  className,
}: HeroBannerProps) {
  const nav = useAppNav();
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: banners } = useHomeBanners();
  const banner = banners?.[0];

  const lineA1 = firstText(stateALine1, brandSafe(banner?.title), DEFAULT_A_LINE1);
  const lineA2 = firstText(stateALine2, brandSafe(banner?.subtitle), DEFAULT_A_LINE2);
  const lineB1 = firstText(stateBLine1, brandSafe(banner?.offerText), DEFAULT_B_LINE1);
  const lineB2 = firstText(stateBLine2, DEFAULT_B_LINE2);
  const priceValue = firstText(stateBPriceValue);
  const cta = firstText(ctaLabel, brandSafe(banner?.ctaText), DEFAULT_CTA);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let offScreen = false;
    let hidden = document.visibilityState === 'hidden';
    let covered = window.location.hash.replace(/^#/, '') !== '/' || overlayOpen();

    const apply = () => {
      const paused = offScreen || hidden || covered;
      if (node.classList.contains('is-paused') === paused) return;
      node.classList.toggle('is-paused', paused);
    };

    const sync = () => {
      hidden = document.visibilityState === 'hidden';
      covered = window.location.hash.replace(/^#/, '') !== '/' || overlayOpen();
      apply();
    };

    const viewport =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            ([entry]) => {
              offScreen = !entry.isIntersecting;
              apply();
            },
            { threshold: 0.05 },
          );
    viewport?.observe(node);

    // Sheets and overlays announce themselves through body classes or the sheet
    // stack; both are the signals the search placeholder pauses on.
    const bodyWatcher = typeof MutationObserver === 'undefined' ? null : new MutationObserver(sync);
    bodyWatcher?.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    const unsubscribeSheets = subscribeSheetCount(sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    document.addEventListener('visibilitychange', sync);

    apply();

    return () => {
      viewport?.disconnect();
      bodyWatcher?.disconnect();
      unsubscribeSheets();
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const handleCtaClick = () => {
    if (onCtaClick) {
      onCtaClick();
      return;
    }
    nav.push('/under99');
  };

  return (
    <section
      ref={rootRef}
      id="hero-banner-region"
      aria-label="Promotions"
      className={['nv-hero-banner', 'es-header-item', className ?? ''].filter(Boolean).join(' ')}
    >
      {/* Right-half gold curved S-bend road */}
      <svg className="nv-hero-road" viewBox="0 0 220 160" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 32 160 C 50 120, 108 106, 128 74 C 146 44, 152 20, 168 0 L 220 0 L 220 26 C 194 42, 174 62, 168 86 C 162 112, 188 134, 214 160 Z" />
      </svg>

      {/* Left column: eyebrow, animated headline slot, static CTA */}
      <div className="nv-hero-copy">
        <div className="nv-hero-eyebrow">
          <span className="nv-hero-eyebrow-text">{eyebrowPrefix}</span>
          <span className="nv-hero-brand-pill">{brandBadge}</span>
        </div>

        <div className="nv-hero-headline-stage">
          <div className="nv-hero-headline nv-hero-headline--a">
            <span className="nv-hero-a-line1">{lineA1}</span>
            <span className="nv-hero-a-line2">{lineA2}</span>
          </div>

          <div className="nv-hero-headline nv-hero-headline--b" aria-hidden="true">
            <span className="nv-hero-b-line1">{lineB1}</span>
            <span className="nv-hero-b-line2">{lineB2}</span>
            {priceValue ? (
              <span className="nv-hero-b-price">
                {stateBPricePrefix ? `${stateBPricePrefix} ` : null}
                <strong className="nv-hero-b-price-val">{priceValue}</strong>
              </span>
            ) : null}
          </div>
        </div>

        <button type="button" className="nv-hero-cta" onClick={handleCtaClick}>
          {cta}
        </button>
      </div>

      {/* Right column: pure vector animated food stage */}
      <div className="nv-hero-stage" aria-hidden="true">
        {/* Group A: bottom plates (poha + South Indian tray) */}
        <svg className="nv-hero-food nv-hero-food--plates" viewBox="0 0 214 118" fill="none">
          {/* Round white plate of yellow poha */}
          <g>
            <ellipse cx="52" cy="84" rx="44" ry="26" fill="rgba(62, 7, 16, 0.28)" />
            <ellipse cx="51" cy="79" rx="43" ry="26" fill="#FFFFFF" />
            <ellipse cx="51" cy="79" rx="36" ry="21" fill="#E6ECF3" />
            <ellipse cx="51" cy="78" rx="34" ry="19.5" fill="#F8FAFC" />
            {/* Poha mound */}
            <ellipse cx="51" cy="77" rx="28" ry="16" fill="#EBB816" />
            <ellipse cx="50" cy="75" rx="26" ry="14" fill="#F8D233" />
            <ellipse cx="48" cy="73" rx="18" ry="9" fill="#FFE059" />
            {/* Peanuts & onion flecks */}
            <ellipse cx="38" cy="73" rx="3.2" ry="2" transform="rotate(-18 38 73)" fill="#B56522" />
            <ellipse cx="62" cy="76" rx="3" ry="1.8" transform="rotate(22 62 76)" fill="#B56522" />
            <ellipse cx="49" cy="81" rx="2.8" ry="1.8" fill="#B56522" />
            <circle cx="43" cy="69" r="1.8" fill="#D94350" />
            <circle cx="57" cy="71" r="1.6" fill="#D94350" />
            <circle cx="53" cy="79" r="1.7" fill="#D94350" />
            {/* Sev garnish */}
            <path d="M 35 76 Q 40 72 44 76" stroke="#D98218" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M 46 70 Q 51 67 55 71" stroke="#DF8D1E" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M 55 75 Q 60 73 63 77" stroke="#D98218" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M 41 79 Q 46 82 51 78" stroke="#E59822" strokeWidth="1.5" strokeLinecap="round" />
            {/* Coriander leaves */}
            <ellipse cx="46" cy="74" rx="2.8" ry="1.5" transform="rotate(-30 46 74)" fill="#2D9B46" />
            <ellipse cx="54" cy="73" rx="2.6" ry="1.4" transform="rotate(35 54 73)" fill="#2D9B46" />
            <ellipse cx="50" cy="68" rx="2.3" ry="1.3" fill="#35AD50" />
            {/* Lemon wedge on rim */}
            <path d="M 73 68 A 7 7 0 0 1 81 74 L 74 75 Z" fill="#FFE14D" stroke="#E5B918" strokeWidth="1" />
          </g>

          {/* Rectangular white South Indian tray */}
          <g transform="translate(148, 68) rotate(-5) translate(-52, -38)">
            <rect x="4" y="8" width="98" height="72" rx="11" fill="rgba(62, 7, 16, 0.28)" />
            <rect x="2" y="3" width="98" height="72" rx="11" fill="#FFFFFF" />
            <rect x="7" y="8" width="88" height="62" rx="8" fill="#E8EEF4" />
            <rect x="9" y="10" width="84" height="58" rx="7" fill="#F8FAFC" />

            {/* Sambar bowl (top-left) */}
            <circle cx="29" cy="27" r="13.5" fill="#DCE4EC" />
            <circle cx="29" cy="26" r="12.5" fill="#FFFFFF" />
            <circle cx="29" cy="26" r="10.2" fill="#C65114" />
            <ellipse cx="27" cy="24" rx="5.5" ry="3.5" fill="#DF6E22" />
            <circle cx="31" cy="27" r="1.6" fill="#2D9B46" />

            {/* Green chutney bowl (top-right) */}
            <circle cx="67" cy="25" r="12" fill="#DCE4EC" />
            <circle cx="67" cy="24" r="11" fill="#FFFFFF" />
            <circle cx="67" cy="24" r="8.8" fill="#57B340" />
            <ellipse cx="65.5" cy="22.5" rx="4.5" ry="2.6" fill="#77CE5E" />
            <circle cx="68.5" cy="24.5" r="1" fill="#264D1E" />
            <circle cx="65" cy="26" r="0.9" fill="#264D1E" />

            {/* Two fluffy white idlis (bottom-left) */}
            <ellipse cx="26" cy="52" rx="12" ry="9.5" fill="#E2E8F0" />
            <ellipse cx="26" cy="50.5" rx="11.5" ry="9" fill="#FFFFFF" />
            <ellipse cx="24" cy="48.5" rx="6" ry="4" fill="#F8FAFC" />

            <ellipse cx="44" cy="54" rx="12" ry="9.5" fill="#E2E8F0" />
            <ellipse cx="44" cy="52.5" rx="11.5" ry="9" fill="#FFFFFF" />
            <ellipse cx="42" cy="50.5" rx="6" ry="4" fill="#F8FAFC" />

            {/* One golden-brown medu vada (bottom-right) */}
            <circle cx="72" cy="51" r="12.5" fill="#B55D16" />
            <circle cx="72" cy="49.5" r="12" fill="#D57B26" />
            <ellipse cx="69" cy="46.5" rx="7" ry="4.5" fill="#E89840" />
            <circle cx="72" cy="49.5" r="3.6" fill="#F8FAFC" />
            <circle cx="66" cy="52" r="0.9" fill="#5E2D08" />
            <circle cx="77" cy="48" r="0.9" fill="#5E2D08" />
          </g>
        </svg>

        {/* Group B: top chai cups (paper cup + ceramic mug) */}
        <svg className="nv-hero-food nv-hero-food--chai" viewBox="0 0 186 116" fill="none">
          {/* Tall paper chai cup */}
          <g transform="translate(18, 6)">
            <ellipse cx="38" cy="96" rx="26" ry="8" fill="rgba(62, 7, 16, 0.28)" />
            {/* Tapered cup body */}
            <path d="M 10 22 L 66 22 L 56 92 C 55 96, 21 96, 20 92 Z" fill="#1752CE" />
            <path d="M 10 22 L 32 22 L 29 94 C 24 94, 20.5 93, 20 92 Z" fill="#2D70F2" />
            <path d="M 52 22 L 66 22 L 56 92 C 55.5 93.5, 51 94.5, 46 95 Z" fill="#1140A8" />
            {/* Minimal cup sleeve band */}
            <path d="M 14 48 Q 38 54 62 48 L 60 64 Q 38 70 16 64 Z" fill="rgba(255, 255, 255, 0.16)" />
            {/* Brown rim + open chai top */}
            <ellipse cx="38" cy="21" rx="29" ry="9.5" fill="#B87844" />
            <ellipse cx="38" cy="19.5" rx="28" ry="8.5" fill="#D59A66" />
            <ellipse cx="38" cy="19.5" rx="23.5" ry="6.2" fill="#9A531E" />
            <ellipse cx="38" cy="20.2" rx="22" ry="5.5" fill="#CC7C36" />
            <ellipse cx="35" cy="19.5" rx="13" ry="3" fill="#E39D5B" />
          </g>

          {/* Blue ceramic tea mug with handle */}
          <g transform="translate(96, 28)">
            <ellipse cx="32" cy="78" rx="27" ry="7.5" fill="rgba(62, 7, 16, 0.28)" />
            {/* Ceramic handle */}
            <path d="M 56 26 C 74 26, 74 58, 54 58" stroke="#154EC4" strokeWidth="8.5" strokeLinecap="round" />
            <path d="M 57 28 C 71 28, 71 54, 56 55" stroke="#3375F5" strokeWidth="3" strokeLinecap="round" />
            {/* Mug body */}
            <path d="M 6 16 L 58 16 L 56 64 C 55 76, 9 76, 8 64 Z" fill="#1C5CE0" />
            <path d="M 6 16 L 23 16 L 22 72 C 14 71, 8.5 68, 8 64 Z" fill="#3A7DF8" />
            <path d="M 46 16 L 58 16 L 56 64 C 55.5 68, 50 71.5, 43 72.5 Z" fill="#1345B0" />
            {/* Ceramic rim & warm chai */}
            <ellipse cx="32" cy="16" rx="26" ry="8.5" fill="#4686FA" />
            <ellipse cx="32" cy="16" rx="22" ry="6.2" fill="#8C4818" />
            <ellipse cx="32" cy="16.8" rx="20.5" ry="5.4" fill="#C97631" />
            <ellipse cx="29" cy="16" rx="12" ry="2.8" fill="#E09652" />
          </g>
        </svg>
      </div>
    </section>
  );
});
