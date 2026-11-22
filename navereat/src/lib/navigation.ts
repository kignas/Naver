import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNavStore } from '../store/navStore';

export const TAB_PATHS = ['/', '/under99', '/search', '/orders', '/profile'] as const;

export const isTabPath = (pathname: string): boolean =>
  (TAB_PATHS as readonly string[]).includes(pathname);

export function useAppNav() {
  const navigate = useNavigate();
  const setDirection = useNavStore((s) => s.setDirection);

  return useMemo(
    () => ({
      push: (to: string) => {
        setDirection('push');
        navigate(to);
      },
      tab: (to: string) => {
        setDirection('tab');
        navigate(to);
      },
      back: () => {
        setDirection('pop');
        navigate(-1);
      },
      replace: (to: string) => {
        setDirection('pop');
        navigate(to, { replace: true });
      },
      reset: (to: string) => {
        setDirection('tab');
        navigate(to, { replace: true });
      },
    }),
    [navigate, setDirection],
  );
}
