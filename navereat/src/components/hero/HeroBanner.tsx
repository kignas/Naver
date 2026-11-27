import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { HERO_DISHES, type HeroDishId } from './heroAssets';
import './HeroBanner.css';

export interface HeroBannerProps {
  /** Kept for callers; the pass-1 layout prints no price. */
  price?: number;
  /** Text of the static bottom strip. */
  stripText?: string;
  /** Fired by the ORDER NOW pill. */
  onOrder?: () => void;
}

/** Four dish slots, in slot order: cup, mug, poha, idli tray. */
const SCENE_A: readonly HeroDishId[] = ['paperCup', 'chaiMug', 'pohaPlate', 'idliTray'];
const SCENE_B: readonly HeroDishId[] = ['brassTumbler', 'chaiMug', 'paperCup', 'idliTray'];

/** Slot names drive the layout classes, so art and position stay in one order. */
const SLOTS = ['cup', 'mug', 'poha', 'tray'] as const;

const DEFAULT_STRIP_TEXT = 'Breakfast staples · served fresh';

/** Seconds. Everything below is laid out on these; the last float lands at 8.4s. */
const ENTER = 0.8;
const ENTER_STAGGER = 0.12;
const EXIT = 0.45;
const EXIT_STAGGER = 0.06;

export function HeroBanner({ stripText = DEFAULT_STRIP_TEXT, onOrder }: HeroBannerProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root) return;

      const dishesA = Array.from(root.querySelectorAll<HTMLElement>('.hb-dish--a'));
      const dishesB = Array.from(root.querySelectorAll<HTMLElement>('.hb-dish--b'));
      const copyA = Array.from(root.querySelectorAll<HTMLElement>('.hb-copy__scene--a .hb-line'));
      const copyB = Array.from(root.querySelectorAll<HTMLElement>('.hb-copy__scene--b .hb-line'));
      const cta = root.querySelector<HTMLElement>('.hb-cta');

      const mm = gsap.matchMedia();

      // Scene A is the CSS default, so only the motion branch needs a timeline;
      // under prefers-reduced-motion nothing is created and the banner stays still.
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const float = (timeline: gsap.core.Timeline, targets: HTMLElement[], at: number, duration: number) =>
          timeline.to(
            targets,
            {
              y: -6,
              rotation: (index: number) => (index % 2 === 0 ? 1.5 : -1.5),
              duration,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: 1,
            },
            at,
          );

        const enter = (timeline: gsap.core.Timeline, targets: HTMLElement[], at: number) =>
          timeline.fromTo(
            targets,
            { y: 56, rotation: -4, autoAlpha: 0 },
            {
              y: 0,
              rotation: 0,
              autoAlpha: 1,
              duration: ENTER,
              stagger: ENTER_STAGGER,
              ease: 'power3.out',
            },
            at,
          );

        const exit = (timeline: gsap.core.Timeline, targets: HTMLElement[], at: number, rotation: number) =>
          timeline.to(
            targets,
            { y: 56, rotation, autoAlpha: 0, duration: EXIT, stagger: EXIT_STAGGER, ease: 'power2.in' },
            at,
          );

        // The loop starts and ends with scene A at rest (the last float lands at
        // 8.4s), so the seam is invisible and the cycle never snaps.
        const loop = gsap.timeline({ repeat: -1, paused: true });

        float(loop, dishesA, 0, 1.2);
        loop.to(copyA, { autoAlpha: 0, y: -8, duration: 0.35, ease: 'power2.in' }, 2.4);
        exit(loop, dishesA, 2.4, 4);

        // B starts while A is still fading out, so the swap reads as a crossfade.
        enter(loop, dishesB, 2.6);
        loop.fromTo(copyB, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 2.6);
        float(loop, dishesB, 3.9, 1.1);

        loop.to(copyB, { autoAlpha: 0, y: -8, duration: 0.35, ease: 'power2.in' }, 6.2);
        exit(loop, dishesB, 6.2, -4);

        enter(loop, dishesA, 6.4);
        loop.fromTo(copyA, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 6.4);
        float(loop, dishesA, 7.56, 0.42);

        const entrance = gsap.timeline({
          onComplete: () => {
            loop.play(0);
            sync();
          },
        });
        enter(entrance, dishesA, 0);
        entrance.fromTo(copyA, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.1);
        if (cta) entrance.fromTo(cta, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' }, 0.25);

        // A looping hero must cost nothing while it is off screen, covered by a
        // pushed route, or competing with a route transition. Everything here is
        // class-state reads: a hit test or a rect read would force layout right in
        // the middle of the slide it is meant to protect.
        const stage = root.closest('.route-stage');
        const layer = root.closest('.route-layer');
        const isCovered = () =>
          Boolean(stage?.classList.contains('has-detail')) || Boolean(layer && !layer.classList.contains('is-active'));
        const isTransitioning = () => Boolean(stage?.classList.contains('is-animating'));
        // A sheet or overlay locks the page scroller; the hero is behind it and
        // must not keep animating while the user is in the sheet.
        const isOverlayOpen = () => document.body.classList.contains('nb-scroll-lock');
        let intersecting = true;
        function sync() {
          const play =
            intersecting && !document.hidden && !isTransitioning() && !isCovered() && !isOverlayOpen();
          for (const timeline of [entrance, loop]) {
            if (play) timeline.resume();
            else timeline.pause();
          }
        }
        const viewportObserver = new IntersectionObserver(([entry]) => {
          intersecting = entry.isIntersecting;
          sync();
        });
        viewportObserver.observe(root);
        // Class only: the app writes inline styles on the stage every frame of a
        // slide, and watching those would run sync() on every one of them.
        const attributeObserver = new MutationObserver(sync);
        for (const node of [stage, layer, document.body]) {
          attributeObserver.observe(node as Element, { attributes: true, attributeFilter: ['class'] });
        }
        document.addEventListener('visibilitychange', sync);
        sync();

        return () => {
          viewportObserver.disconnect();
          attributeObserver.disconnect();
          document.removeEventListener('visibilitychange', sync);
          entrance.kill();
          loop.kill();
        };
      });

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <section className="hb" id="hero-banner-region" ref={rootRef} aria-label="Breakfast offer">
      {/* 1. Static base */}
      <div className="hb-base" aria-hidden="true" />

      {/* 2. Animated middle: arches, beams, copy, dishes */}
      <div className="hb-stage">
        <span className="hb-arch hb-arch--cup" aria-hidden="true" />
        <span className="hb-arch hb-arch--mug" aria-hidden="true" />
        <span className="hb-beam hb-beam--cup" aria-hidden="true" />
        <span className="hb-beam hb-beam--mug" aria-hidden="true" />

        <div className="hb-copy">
          <div className="hb-copy__stack">
            <div className="hb-copy__scene hb-copy__scene--a">
              <p className="hb-line hb-line--with">with</p>
              <p className="hb-line hb-line--free">FREE</p>
              <p className="hb-line hb-line--delivery">Delivery</p>
            </div>
            {/* Scene B repeats the headline so the swap keeps its copy beat. */}
            <div className="hb-copy__scene hb-copy__scene--b" aria-hidden="true">
              <p className="hb-line hb-line--with">with</p>
              <p className="hb-line hb-line--free">FREE</p>
              <p className="hb-line hb-line--delivery">Delivery</p>
            </div>
          </div>
          <button type="button" className="hb-cta" onClick={onOrder}>
            ORDER NOW
          </button>
        </div>

        <div className="hb-dishes">
          {SCENE_A.map((id, index) => {
            const dishA = HERO_DISHES[id];
            const dishB = HERO_DISHES[SCENE_B[index]];
            return (
              <div className={`hb-slot hb-slot--${SLOTS[index]}`} key={`${id}-${index}`}>
                <span className="hb-shadow" aria-hidden="true" />
                <img
                  className="hb-dish hb-dish--a"
                  src={dishA.src}
                  width={dishA.width}
                  height={dishA.height}
                  alt={dishA.alt}
                  decoding="async"
                  draggable={false}
                />
                <img
                  className="hb-dish hb-dish--b"
                  src={dishB.src}
                  width={dishB.width}
                  height={dishB.height}
                  alt=""
                  aria-hidden="true"
                  decoding="async"
                  draggable={false}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Static bottom strip */}
      <div className="hb-strip">
        <span className="hb-strip__rule" aria-hidden="true" />
        <p className="hb-strip__text">{stripText}</p>
        <span className="hb-strip__rule" aria-hidden="true" />
      </div>
    </section>
  );
}
