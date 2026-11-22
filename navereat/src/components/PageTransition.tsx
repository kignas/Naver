import { motion, useDragControls, useIsPresent, type PanInfo, type Variants } from 'framer-motion';
import type { ReactNode } from 'react';
import { useAppNav } from '../lib/navigation';
import type { NavDirection } from '../store/navStore';

const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];
const DURATION = 0.3;
const TAB_DURATION = 0.2;

/**
 * Toing-style route transition.
 * push: new page 100% → 0 while the old page shifts to -25% and dims.
 * pop:  current page 0 → 100% while the revealed page returns from -25%.
 * tab:  cross-fade only.
 */
const variants: Variants = {
  initial: (direction: NavDirection) => {
    if (direction === 'tab') return { x: 0, opacity: 0, zIndex: 1 };
    if (direction === 'push') return { x: '100%', opacity: 0.6, zIndex: 2 };
    return { x: '-25%', opacity: 0.85, zIndex: 1 };
  },
  animate: (direction: NavDirection) => ({
    x: 0,
    opacity: 1,
    zIndex: direction === 'pop' ? 1 : 2,
    transition: { duration: direction === 'tab' ? TAB_DURATION : DURATION, ease: EASE },
  }),
  exit: (direction: NavDirection) => {
    if (direction === 'tab') {
      return { opacity: 0, zIndex: 1, transition: { duration: TAB_DURATION, ease: 'easeOut' } };
    }
    if (direction === 'push') {
      return { x: '-25%', opacity: 0.7, zIndex: 1, transition: { duration: DURATION, ease: EASE } };
    }
    return { x: '100%', opacity: 0.4, zIndex: 2, transition: { duration: DURATION, ease: EASE } };
  },
};

interface PageTransitionProps {
  children: ReactNode;
  direction: NavDirection;
  swipeBack?: boolean;
}

export function PageTransition({ children, direction, swipeBack = false }: PageTransitionProps) {
  const controls = useDragControls();
  const isPresent = useIsPresent();
  const nav = useAppNav();
  const width = typeof window === 'undefined' ? 390 : window.innerWidth;

  const handleDragEnd = (_event: unknown, info: PanInfo) => {
    if (info.offset.x > width * 0.35) nav.back();
  };

  return (
    <motion.div
      className="page-motion"
      custom={direction}
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      drag={swipeBack && isPresent ? 'x' : false}
      dragListener={false}
      dragControls={controls}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={{ left: 0, right: 0.55 }}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {children}
      {swipeBack && (
        <div
          className="swipe-edge"
          onPointerDown={(event) => controls.start(event)}
          aria-hidden="true"
        />
      )}
    </motion.div>
  );
}
