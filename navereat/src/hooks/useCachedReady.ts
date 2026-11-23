import { useEffect } from 'react';
import { useUiStore } from '../store/uiStore';

/** First visit gets the short skeleton; later visits read the cached ready flag. */
export function useCachedReady(key: string, min = 400, max = 700): boolean {
  const ready = useUiStore((state) => state.ready[key] === true);
  const markReady = useUiStore((state) => state.markReady);

  useEffect(() => {
    if (ready) return;
    const delay = min + Math.random() * Math.max(0, max - min);
    const id = window.setTimeout(() => markReady(key), delay);
    return () => window.clearTimeout(id);
  }, [key, max, min, ready, markReady]);

  return ready;
}
