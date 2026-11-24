import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { useNavStore } from '../store/navStore';
import { closeTopSheet } from '../lib/sheetStack';

const atRoot = (): boolean => {
  const hash = window.location.hash.replace(/^#/, '') || '/';
  return hash === '/' || hash === '/login';
};

/** Android hardware back: POP animation, exit the app on Home. */
export function useBackButton(): void {
  useEffect(() => {
    const setDirection = useNavStore.getState().setDirection;

    // Capture phase: the router's own popstate listener must not commit the
    // new location before the transition knows it is a pop, or the reverse
    // slide is skipped and the page swaps instantly.
    const onPopState = () => setDirection('pop');
    window.addEventListener('popstate', onPopState, true);

    let remove: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      void CapApp.addListener('backButton', () => {
        if (closeTopSheet()) return;
        if (atRoot()) {
          void CapApp.exitApp();
          return;
        }
        window.dispatchEvent(new CustomEvent('navereat:before-navigate'));
        setDirection('pop');
        window.history.back();
      }).then((handle) => {
        remove = () => void handle.remove();
      });
    }

    return () => {
      window.removeEventListener('popstate', onPopState, true);
      remove?.();
    };
  }, []);
}
