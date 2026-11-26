import { memo, useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionStyle,
  type Variants,
} from 'framer-motion';
import { useAmbientPause } from '../../hooks/useAmbientPause';
import { useAppNav } from '../../lib/navigation';
import { HERO_ART } from './heroArt';
import { HERO_SLIDES, type HeroItemKey, type HeroSlide } from './heroSlides';
import { HeroSteam } from './HeroSteam';
import './HeroBanner.css';

export interface HeroBannerProps {
  /** The Home scroll container; drives the scroll-linked hero shrink. */
  scrollerRef: RefObject<HTMLElement | null>;
  brandBadge?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
  /** Slides to rotate through; defaults to the built-in set. */
  slides?: HeroSlide[];
}

/* ── Choreography ───────────────────────────────────────────────────────
   One shared diagonal carries everything: the old scene leaves up-right, the
   new one arrives from the lower right. Tune these two vectors first. */
const ENTER_FROM = { x: 70, y: 90 };
const EXIT_TO = { x: 110, y: -80 };
const HOLD_MS = 5000;

type Bezier = [number, number, number, number];
const EASE_OUT: Bezier = [0.22, 1, 0.36, 1];
const EASE_IN: Bezier = [0.5, 0, 0.9, 0.4];

/** Arches: smooth and weighty, no bounce. They set the stage. */
const archVariants: Variants = {
  enter: (i: number) => ({
    x: ENTER_FROM.x * (1.5 + i * 0.35),
    y: ENTER_FROM.y * (1.5 + i * 0.35),
    opacity: 0,
  }),
  show: (i: number) => ({
    x: 0,
    y: 0,
    opacity: 1,
    transition: { duration: 0.8, ease: EASE_OUT, delay: i * 0.07 },
  }),
  exit: (i: number) => ({
    x: EXIT_TO.x * 1.5,
    y: EXIT_TO.y * 1.5,
    opacity: 0,
    transition: { duration: 0.45, ease: EASE_IN, delay: i * 0.03 },
  }),
};

/** Food: snappy spring with a little overshoot. This is the "toing". */
const foodVariants: Variants = {
  enter: { x: ENTER_FROM.x, y: ENTER_FROM.y, scale: 0.9, opacity: 0 },
  show: (i: number) => ({
    x: 0,
    y: 0,
    scale: 1,
    opacity: 1,
    transition: {
      type: 'spring',
      stiffness: 210,
      damping: 16,
      mass: 0.9,
      delay: 0.14 + i * 0.07,
      opacity: { duration: 0.2, delay: 0.14 + i * 0.07 },
    },
  }),
  exit: (i: number) => ({
    x: EXIT_TO.x,
    y: EXIT_TO.y,
    scale: 0.94,
    opacity: 0,
    transition: { duration: 0.4, ease: EASE_IN, delay: i * 0.03 },
  }),
};

/** Headline: blur-fades in after the art has started moving. */
const headlineVariants: Variants = {
  enter: { opacity: 0, y: 10, filter: 'blur(8px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: EASE_OUT, delay: 0.4 },
  },
  exit: { opacity: 0, y: -4, filter: 'blur(6px)', transition: { duration: 0.25 } },
};

const ITEMS: Record<HeroItemKey, { src: string; className: string }> = {
  paperCup: { src: HERO_ART.paperCup, className: 'nv-hero-item nv-hero-item--paper' },
  chaiMug: { src: HERO_ART.chaiMug, className: 'nv-hero-item nv-hero-item--mug' },
  idliPlate: { src: HERO_ART.idliPlate, className: 'nv-hero-item nv-hero-item--idli' },
  lemonRice: { src: HERO_ART.lemonRice, className: 'nv-hero-item nv-hero-item--rice' },
  filterCoffee: { src: HERO_ART.filterCoffee, className: 'nv-hero-item nv-hero-item--filter' },
};

function Sparkle({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c1.1 6.4 4.5 9.9 12 12-7.5 2.1-10.9 5.6-12 12-1.1-6.4-4.5-9.9-12-12C7.5 9.9 10.9 6.4 12 0Z" />
    </svg>
  );
}

function backgroundOf(slide: HeroSlide): string {
  const { bgA, bgB, bgC, glow } = slide.theme;
  return `radial-gradient(92% 72% at 82% 10%, ${glow} 0%, rgba(0,0,0,0) 62%), linear-gradient(165deg, ${bgA} 0%, ${bgB} 48%, ${bgC} 100%)`;
}

/**
 * The Home hero as a slide carousel. Each slide is data (copy, theme, which
 * cut-outs); the choreography is shared: arches and food sweep along one
 * diagonal, food lands with a spring overshoot, the headline blur-fades in
 * last, and the CTA and search chrome never move. Nothing loops while a slide
 * is resting, and the carousel holds whenever the page is covered, hidden or
 * off-screen.
 */
export const HeroBanner = memo(function HeroBanner({
  scrollerRef,
  brandBadge = 'Navereat',
  ctaLabel = 'Order now',
  onCtaClick,
  className,
  slides = HERO_SLIDES,
}: HeroBannerProps) {
  const nav = useAppNav();
  const rootRef = useRef<HTMLElement>(null);
  const paused = useAmbientPause(rootRef);
  const reduced = useReducedMotion() ?? false;
  const idle = paused || reduced;

  const [index, setIndex] = useState(0);
  const slide = slides[index % slides.length];

  // Re-armed after every slide change, so a pause always restarts a full hold.
  useEffect(() => {
    if (idle || slides.length < 2) return undefined;
    const timer = window.setTimeout(() => setIndex((i) => (i + 1) % slides.length), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [idle, index, slides.length]);

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

  const { headline } = slide;
  const rootStyle = { '--nv-strip-bg': slide.theme.strip, '--nv-strip-fg': slide.theme.stripText } as CSSProperties;
  // Custom properties are CSS-only; `MotionStyle` is what `motion.h2` takes.
  const headlineStyle = {
    '--nv-hl-scale': headline.scale ?? 1,
    '--nv-hl-accent': slide.theme.accent,
  } as unknown as MotionStyle;

  return (
    <section
      ref={rootRef}
      id="hero-banner-region"
      aria-label="Promotions"
      className={['nv-hero-root', 'es-header-item', paused ? 'is-paused' : '', className ?? ''].filter(Boolean).join(' ')}
      style={rootStyle}
    >
      <div className="nv-hero-banner">
        {/* New background fades in on top while the old one holds, so the
            colour change never dips through a blank frame. */}
        <AnimatePresence initial={false}>
          <motion.div
            key={slide.id}
            className="nv-hero-bg"
            style={{ background: backgroundOf(slide) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.6, ease: 'easeOut' } }}
            exit={{ opacity: 1, transition: { duration: 0.6 } }}
            aria-hidden="true"
          />
        </AnimatePresence>

        <motion.div className="nv-hero-inner" style={{ scale, opacity }}>
          <AnimatePresence mode="wait" initial={!reduced}>
            <motion.div
              key={slide.id}
              className="nv-hero-stage"
              aria-hidden="true"
              initial="enter"
              animate="show"
              exit="exit"
            >
              <motion.span className="nv-hero-arch nv-hero-arch--a" custom={0} variants={archVariants} />
              <motion.span className="nv-hero-arch nv-hero-arch--b" custom={1} variants={archVariants} />
              {slide.items.map((key, i) => (
                <motion.div key={key} className={ITEMS[key].className} custom={i} variants={foodVariants}>
                  <img className="nv-hero-art" src={ITEMS[key].src} alt="" draggable={false} decoding="async" />
                </motion.div>
              ))}
              {slide.items.includes('chaiMug') && <HeroSteam />}
            </motion.div>
          </AnimatePresence>

          <div className="nv-hero-copy">
            <p className="nv-hero-eyebrow">
              <span>Powered by</span>
              <span className="nv-hero-brand-pill">{brandBadge}</span>
            </p>

            <div className="nv-hero-headwrap">
              <AnimatePresence mode="wait" initial={!reduced}>
                <motion.h2
                  key={slide.id}
                  className="nv-hero-headline"
                  style={headlineStyle}
                  variants={headlineVariants}
                  initial="enter"
                  animate="show"
                  exit="exit"
                >
                  {headline.pre && <span className="nv-hero-with">{headline.pre}</span>}
                  <span className="nv-hero-free">{headline.line1}</span>
                  <span className="nv-hero-delivery">{headline.line2}</span>
                  {headline.sub && <span className="nv-hero-sub">{headline.sub}</span>}
                </motion.h2>
              </AnimatePresence>
            </div>

            <motion.button type="button" className="nv-hero-cta" whileTap={{ scale: 0.94 }} onClick={handleCtaClick}>
              <span className="nv-hero-cta-label">{ctaLabel}</span>
              <span className="nv-hero-sheen" aria-hidden="true" />
            </motion.button>
          </div>
        </motion.div>
      </div>

      <div className="nv-hero-strip">
        <Sparkle className="nv-hero-sparkle nv-hero-sparkle--left" />
        <span className="nv-hero-strip-text">{slide.stripLabel}</span>
        <Sparkle className="nv-hero-sparkle nv-hero-sparkle--right" />
      </div>
    </section>
  );
});
