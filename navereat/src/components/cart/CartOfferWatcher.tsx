import { useEffect } from 'react';
import type { DemoOffer } from '../../data/demo';
import { useCartTotals } from './cartTotals';

interface CartOfferWatcherProps {
  offerMode: string | null;
  blocked: boolean;
  preparing: boolean;
  onShow: (offers: DemoOffer[]) => void;
}

const SEEN_KEY = 'ew_offers_seen_v1';

/** Owns the cart's offer-popup timer so the shell never subscribes to totals. */
export function CartOfferWatcher({ offerMode, blocked, preparing, onShow }: CartOfferWatcherProps) {
  const { offers, subtotal } = useCartTotals();

  useEffect(() => {
    if (preparing || !offers.length || blocked || offerMode === 'none') return;
    const popupOffers = offerMode === 'single' ? offers.slice(0, 1) : offers;
    const key = `cart|${offers.map((offer) => offer.id).join('+')}|${subtotal}`;
    let seen: string[] = [];
    try {
      seen = JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]') as string[];
    } catch {
      seen = [];
    }
    if (seen.includes(key)) return;
    const timer = window.setTimeout(() => {
      onShow(popupOffers);
      try {
        sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen, key].slice(-60)));
      } catch {
        /* session storage may be unavailable */
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [blocked, offerMode, offers, onShow, preparing, subtotal]);

  return null;
}
