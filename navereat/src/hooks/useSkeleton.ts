import { useEffect, useState } from 'react';

/** Short first-paint fake load. Keep the cap at 400 ms. */
export function useSkeleton(min = 180, max = 320): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const delay = min + Math.random() * (max - min);
    const id = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(id);
  }, [min, max]);

  return ready;
}
