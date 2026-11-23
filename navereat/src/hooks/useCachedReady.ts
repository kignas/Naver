import { useEffect } from 'react';
import { useNavStore } from '../store/navStore';
import { useUiStore } from '../store/uiStore';

/** First visit gets the short skeleton; later visits read the cached ready flag. */
export function useCachedReady(key: string, min = 400, max = 700): boolean {
  const ready = useUiStore((state) => state.ready[key] === true);
  const markReady = useUiStore((state) => state.markReady);
  const preparing = useNavStore((state) => state.preparing);

  useEffect(() => {
    if (preparing) {
      if (!ready) markReady(key);
      return;
    }
    if (ready) return;
    const delay = min + Math.random() * Math.max(0, max - min);
    const id = window.setTimeout(() => markReady(key), delay);
    return () => window.clearTimeout(id);
  }, [key, max, min, preparing, ready, markReady]);

  // A route mounted for a transition is rendered in full while hidden, so the
  // skeleton cannot swap content in during the slide.
  return preparing || ready;
}
