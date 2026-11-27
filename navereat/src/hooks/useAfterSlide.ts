import { useEffect, useState } from 'react';
import { isSlideActive, SLIDE_COMPLETE_EVENT } from '../lib/slideGate';

/**
 * False while the page is still travelling, true once its slide has finished
 * (or immediately on a direct load, where no slide runs).
 */
export function useAfterSlide(): boolean {
  const [done, setDone] = useState(() => !isSlideActive());

  useEffect(() => {
    if (done) return undefined;
    if (!isSlideActive()) {
      setDone(true);
      return undefined;
    }
    const onComplete = () => setDone(true);
    window.addEventListener(SLIDE_COMPLETE_EVENT, onComplete, { once: true });
    return () => window.removeEventListener(SLIDE_COMPLETE_EVENT, onComplete);
  }, [done]);

  return done;
}
