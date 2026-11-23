import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavStore } from '../store/navStore';
import { preloadRoute } from './routeLoaders';

export const TAB_PATHS = ['/', '/under99', '/orders', '/profile'] as const;

export const isTabPath = (pathname: string): boolean =>
  (TAB_PATHS as readonly string[]).includes(pathname);

const notifyBeforeNavigate = (): void => {
  try {
    window.dispatchEvent(new CustomEvent('navereat:before-navigate'));
  } catch {
    /* non-browser test environment */
  }
};

export function useAppNav() {
  const navigate = useNavigate();
  const setDirection = useNavStore((s) => s.setDirection);
  const requestId = useRef(0);

  return useMemo(() => {
    const go = (to: string, direction: 'push' | 'tab') => {
      const id = requestId.current + 1;
      requestId.current = id;
      void preloadRoute(to).then(() => {
        if (requestId.current !== id) return;
        if (direction === 'push') notifyBeforeNavigate();
        setDirection(direction);
        navigate(to, { flushSync: true });
      });
    };

    return {
      push: (to: string) => go(to, 'push'),
      tab: (to: string) => {
        requestId.current += 1;
        setDirection('tab');
        navigate(to, { flushSync: true });
      },
      back: () => {
        notifyBeforeNavigate();
        setDirection('pop');
        navigate(-1);
      },
      replace: (to: string) => {
        notifyBeforeNavigate();
        setDirection('pop');
        navigate(to, { replace: true, flushSync: true });
      },
      reset: (to: string) => {
        setDirection('tab');
        navigate(to, { replace: true, flushSync: true });
      },
    };
  }, [navigate, setDirection]);
}
