import { memo, useRef, type ReactNode, type RefObject } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from 'framer-motion';
import { useAmbientPause } from '../../hooks/useAmbientPause';
import { useAppNav } from '../../lib/navigation';
import { HERO_ART } from './heroArt';
import { HeroSteam } from './HeroSteam';
import './HeroBanner.css';

export interface HeroBannerProps {
  /** The Home scroll container; drives the scroll-linked hero shrink. */
  scrollerRef: RefObject<HTMLElement | null>;
  brandBadge?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
}

const SPRING_ARCH = { type: 'spring', stiffness: 260, damping: 22 } as const;
const SPRING_POP = { type: 'spring', stiffness: 320, damping: 18 } as const;
const SPRING_COPY = { type: 'spring', stiffness: 300, damping: 26 } as const;

const rootVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const stageVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const copyVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.44 } },
};

const archVariants: Variants = {
  hidden: { y: 30, opacity: 0 },
  show: { y: 0, opacity: 1, transition: SPRING_ARCH },
};

const popVariants: Variants = {
  hidden: { y: 20, scale: 0.85, opacity: 0 },
  show: { y: 0, scale: 1, opacity: 1, transition: SPRING_POP },
};

const copyItemVariants: Variants = {
  hidden: { x: -16, opacity: 0 },
  show: { x: 0, opacity: 1, transition: SPRING_COPY },
};

interface StageItem {
  key: string;
  src: string;
  className: string;
  /** Idle-bob offset so the layers never breathe in lockstep. */
  delay: number;
}

const STAGE_ITEMS: StageItem[] = [
  { key: 'paper-cup', src: HERO_ART.paperCup, className: 'nv-hero-item nv-hero-item--paper', delay: 0 },
  { key: 'chai-mug', src: HERO_ART.chaiMug, className: 'nv-hero-item nv-hero-item--mug', delay: 0.4 },
  { key: 'idli-plate', src: HERO_ART.idliPlate, className: 'nv-hero-item nv-hero-item--idli', delay: 0.85 },
  { key: 'lemon-rice', src: HERO_ART.lemonRice, className: 'nv-hero-item nv-hero-item--rice', delay: 1.25 },
  { key: 'filter-coffee', src: HERO_ART.filterCoffee, className: 'nv-hero-item nv-hero-item--filter', delay: 1.65 },
];

/** Idle bob on a dedicated layer so it never fights the entrance variants. */
function Floating({ paused, delay, children }: { paused: boolean; delay: number; children: ReactNode }) {
  return (
    <motion.div
      className="nv-hero-float"
      initial={false}
      animate={paused ? { y: 0 } : { y: [0, -4, 0] }}
      transition={paused ? { duration: 0 } : { duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  );
}

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c1.1 6.4 4.5 9.9 12 12-7.5 2.1-10.9 5.6-12 12-1.1-6.4-4.5-9.9-12-12C7.5 9.9 10.9 6.4 12 0Z" />
    </svg>
  );
}

/**
 * The Home hero: two gold arches framing the transparent cups, a foreground
 * food spread, spring-staggered entrance, idle float, vector steam, and a
 * scroll-linked shrink. Every loop is held while the page is covered, hidden
 * or off-screen, so a cached Home writes no styles at all.
 */
export const HeroBanner = memo(function HeroBanner({
  scrollerRef,
  brandBadge = 'Navereat',
  ctaLabel = 'Order now',
  onCtaClick,
  className,
}: HeroBannerProps) {
  const nav = useAppNav();
  const rootRef = useRef<HTMLElement>(null);
  const paused = useAmbientPause(rootRef);
  const reduced = useReducedMotion() ?? false;
  const idle = paused || reduced;

  // `layoutEffect: false`: the parent `.home-scroll` ref is attached after its
  // children's layout effects, so a layout-time read would see null.
  const { scrollY } = useScroll({ container: scrollerRef, layoutEffect: false });
  const scale = useTransform(scrollY, [0, 240], [1, 0.96]);
  const opacity = useTransform(scrollY, [0, 240], [1, 0.45]);

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
      className={['nv-hero-root', 'es-header-item', paused ? 'is-paused' : '', className ?? ''].filter(Boolean).join(' ')}
    >
      <div className="nv-hero-banner">
        <motion.div
          className="nv-hero-inner"
          style={{ scale, opacity }}
          variants={rootVariants}
          initial={reduced ? false : 'hidden'}
          animate="show"
        >
          <motion.div className="nv-hero-stage" aria-hidden="true" variants={stageVariants}>
            <motion.span className="nv-hero-arch nv-hero-arch--a" variants={archVariants} />
            <motion.span className="nv-hero-arch nv-hero-arch--b" variants={archVariants} />
            {STAGE_ITEMS.map((item) => (
              <motion.div key={item.key} className={item.className} variants={popVariants}>
                <Floating paused={idle} delay={item.delay}>
                  <img className="nv-hero-art" src={item.src} alt="" draggable={false} decoding="async" />
                </Floating>
              </motion.div>
            ))}
            <HeroSteam />
          </motion.div>

          <motion.div className="nv-hero-copy" variants={copyVariants}>
            <motion.p className="nv-hero-eyebrow" variants={copyItemVariants}>
              <span>Powered by</span>
              <span className="nv-hero-brand-pill">{brandBadge}</span>
            </motion.p>

            <motion.h2 className="nv-hero-headline" variants={copyItemVariants}>
              <span className="nv-hero-with">with</span>
              <span className="nv-hero-free">FREE</span>
              <span className="nv-hero-delivery">Delivery</span>
            </motion.h2>

            <motion.button
              type="button"
              className="nv-hero-cta"
              variants={copyItemVariants}
              whileTap={{ scale: 0.94 }}
              onClick={handleCtaClick}
            >
              <span className="nv-hero-cta-label">{ctaLabel}</span>
              <span className="nv-hero-sheen" aria-hidden="true" />
            </motion.button>
          </motion.div>
        </motion.div>
      </div>

      <div className="nv-hero-strip">
        <Sparkle className="nv-hero-sparkle nv-hero-sparkle--left" />
        <span className="nv-hero-strip-text">Get additional ₹40 free cash</span>
        <Sparkle className="nv-hero-sparkle nv-hero-sparkle--right" />
      </div>
    </section>
  );
});
