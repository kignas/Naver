import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { gsap, prefersReducedMotion } from '../../lib/gsap';
import { MAX_WAIT_MS, MIN_SKELETON_MS, REVEAL_MS } from './revealSettings';
import './reveal.css';

interface RevealGateProps {
  children: ReactNode;
  skeleton: ReactNode;
  dataReady?: boolean;
  /** performance.now() of the page mount; the min skeleton is measured from here. */
  startedAt?: number;
  className?: string;
  /** Cap the staggered blocks; Cart reveals one block to keep style work low. */
  maxBlocks?: number;
}

/**
 * Keeps the real content laid out but hidden behind a skeleton until the data is
 * ready, the first four images have decoded and the minimum skeleton time has
 * passed. The skeleton is an absolute overlay, so removing it cannot move the
 * page: the content already owns its final box.
 */
export function RevealGate({
  children,
  skeleton,
  dataReady = true,
  startedAt,
  className,
  maxBlocks = 4,
}: RevealGateProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const startedAtRef = useRef(startedAt ?? performance.now());
  const revealedRef = useRef(false);
  const [minPassed, setMinPassed] = useState(
    () => performance.now() - startedAtRef.current >= MIN_SKELETON_MS,
  );
  const [imagesReady, setImagesReady] = useState(false);
  const [forced, setForced] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [skeletonGone, setSkeletonGone] = useState(false);

  useEffect(() => {
    const elapsed = performance.now() - startedAtRef.current;
    const minTimer = window.setTimeout(() => setMinPassed(true), Math.max(0, MIN_SKELETON_MS - elapsed));
    const maxTimer = window.setTimeout(() => setForced(true), Math.max(0, MAX_WAIT_MS - elapsed));
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (imagesReady) return undefined;
    const root = contentRef.current;
    if (!root) return undefined;
    const images = Array.from(root.querySelectorAll('img')).slice(0, 4);
    if (!images.length) {
      setImagesReady(true);
      return undefined;
    }
    let live = true;
    Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => {
      if (live) setImagesReady(true);
    });
    return () => {
      live = false;
    };
  }, [children, imagesReady]);

  const ready = forced || (dataReady && imagesReady && minPassed);

  useEffect(() => {
    if (!ready || revealedRef.current) return;
    revealedRef.current = true;
    setRevealed(true);
  }, [ready]);

  useEffect(() => {
    if (!revealed) return undefined;
    const timer = window.setTimeout(() => setSkeletonGone(true), prefersReducedMotion() ? 0 : REVEAL_MS);
    return () => window.clearTimeout(timer);
  }, [revealed]);

  useLayoutEffect(() => {
    if (!revealed) return undefined;
    const root = contentRef.current;
    if (!root) return undefined;
    const blocks = Array.from(root.children).slice(0, maxBlocks) as HTMLElement[];
    if (!blocks.length) return undefined;
    if (prefersReducedMotion()) {
      gsap.set(blocks, { clearProps: 'opacity,transform' });
      return undefined;
    }
    gsap.fromTo(
      blocks,
      { opacity: 0, y: 8 },
      { opacity: 1, y: 0, duration: REVEAL_MS / 1000, ease: 'power2.out', stagger: 0.05, overwrite: 'auto' },
    );
    return () => {
      gsap.killTweensOf(blocks);
      gsap.set(blocks, { clearProps: 'opacity,transform' });
    };
  }, [maxBlocks, revealed]);

  return (
    <div className={`reveal-gate${revealed ? ' is-revealed' : ''}${className ? ` ${className}` : ''}`}>
      <div
        ref={contentRef}
        className="reveal-gate__content"
        aria-hidden={!revealed}
        style={{ visibility: revealed ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
      {!skeletonGone && (
        <div className={`reveal-gate__skeleton${revealed ? ' is-hidden' : ''}`} aria-hidden="true">
          {skeleton}
        </div>
      )}
    </div>
  );
}
