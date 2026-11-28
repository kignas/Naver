/**
 * Guest checkout → login → back to the cart, using the legacy keys so a real
 * backend keeps working: `nearbite_cart_before_auth` holds the cart JSON and
 * `nearbite_after_login` the route to return to.
 */
import { useAppStore } from '../store/appStore';
import type { Cart } from './cart';

export const CART_BEFORE_AUTH_KEY = 'nearbite_cart_before_auth';
export const AFTER_LOGIN_KEY = 'nearbite_after_login';

export function rememberCartForAuth(): void {
  try {
    const raw = localStorage.getItem('nearbite_cart');
    if (raw) localStorage.setItem(CART_BEFORE_AUTH_KEY, raw);
    localStorage.setItem(AFTER_LOGIN_KEY, '/cart');
  } catch {
    /* storage may be unavailable */
  }
}

/** Reads and clears `nearbite_after_login`, restoring the pre-auth cart. */
export function consumeLoginReturn(): string | null {
  let target: string | null = null;
  try {
    target = localStorage.getItem(AFTER_LOGIN_KEY);
    localStorage.removeItem(AFTER_LOGIN_KEY);
  } catch {
    target = null;
  }
  try {
    const raw = localStorage.getItem(CART_BEFORE_AUTH_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Cart;
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        useAppStore.getState().restoreCart(parsed);
      }
      localStorage.removeItem(CART_BEFORE_AUTH_KEY);
    }
  } catch {
    /* keep the current cart if the snapshot is unreadable */
  }
  return target;
}
