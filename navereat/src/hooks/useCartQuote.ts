import { useCallback, useEffect, useRef, useState } from 'react';
import { api, isApiFailure, type ApiFailure, type Quote } from '../api/restaurantApi';

/** `EWCartQuoteUI`'s visible states: pending note, quote rows, or failure card. */
export type QuoteStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface QuoteBody {
  restaurantId: string | number;
  addressId: string;
  items: Array<{ menuItem: string | number; name?: string; price: number; quantity: number }>;
  paymentMethod: 'upi' | 'cod';
  couponCode?: string | null;
  tipAmount?: number;
}

export interface CartQuote {
  status: QuoteStatus;
  quote: Quote | null;
  error: ApiFailure | null;
  retry: () => void;
}

const FAILURE: ApiFailure = { kind: 'network', message: "Can't reach the server. Check your connection.", retryable: true };

/**
 * `cart-quote-ui.js` `schedule()`: a 200 ms debounce, one request per basket
 * key, stale answers dropped (`epoch`). `body === null` is the legacy path
 * (multi-restaurant basket or no saved address), which is never priced by the
 * backend and keeps the client estimate.
 */
export function useCartQuote(body: QuoteBody | null): CartQuote {
  const key = body ? JSON.stringify(body) : null;
  const [state, setState] = useState<{ status: QuoteStatus; quote: Quote | null; error: ApiFailure | null }>({
    status: 'idle',
    quote: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const epoch = useRef(0);

  useEffect(() => {
    if (!body || !key) {
      epoch.current += 1;
      setState({ status: 'idle', quote: null, error: null });
      return;
    }
    const ticket = ++epoch.current;
    setState({ status: 'loading', quote: null, error: null });
    const timer = window.setTimeout(() => {
      api
        .getQuote(body)
        .then((quote) => {
          if (epoch.current === ticket) setState({ status: 'ready', quote, error: null });
        })
        .catch((error: unknown) => {
          if (epoch.current !== ticket) return;
          setState({ status: 'error', quote: null, error: isApiFailure(error) ? error : FAILURE });
        });
    }, 200);
    return () => window.clearTimeout(timer);
    // `key` covers every priced field of `body`; `body` identity must not re-quote.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, retry };
}
