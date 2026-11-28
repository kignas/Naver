/**
 * Payment method selected in checkout, persisted under the legacy
 * `nearbite_payment_method` key ('cod' | 'upi'; anything else means 'upi').
 */
export const PAYMENT_METHOD_KEY = 'nearbite_payment_method';
export type PaymentMethod = 'upi' | 'cod';

export function readPaymentMethod(): PaymentMethod {
  try {
    return localStorage.getItem(PAYMENT_METHOD_KEY) === 'cod' ? 'cod' : 'upi';
  } catch {
    return 'upi';
  }
}

export function writePaymentMethod(method: PaymentMethod): void {
  try {
    localStorage.setItem(PAYMENT_METHOD_KEY, method === 'cod' ? 'cod' : 'upi');
  } catch {
    /* storage may be unavailable */
  }
}

export function clearPaymentMethod(): void {
  try {
    localStorage.removeItem(PAYMENT_METHOD_KEY);
  } catch {
    /* storage may be unavailable */
  }
}
