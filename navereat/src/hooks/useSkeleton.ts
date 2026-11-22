import { useEffect, useState } from 'react';

/** Short fake load (400–700 ms) so skeleton shimmer matches the legacy pages. */
export function useSkeleton(min = 400, max = 700): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const delay = min + Math.random() * (max - min);
    const id = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(id);
  }, [min, max]);

  return ready;
}
