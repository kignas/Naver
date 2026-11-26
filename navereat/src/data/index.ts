import { useCallback, useEffect, useRef, useState } from 'react';
import type { MenuItem, Restaurant } from './demo';
import type { Address, Banner, DataSource, DataSourceMode, PlatformStatus, SearchResult } from './dataSource';
import { deriveLocationLabel, type LocationLabel } from './locationLabel';

export { deriveLocationLabel, LOGGED_OUT_LABEL, PLATFORM_AREA, type LocationLabel } from './locationLabel';

export type {
  Address,
  ApiFailure,
  Banner,
  CouponCheck,
  DataSource,
  DataSourceMode,
  PlatformStatus,
  Quote,
  QuoteRequest,
  RestaurantDetail,
  SearchResult,
  Session,
} from './dataSource';
export { isApiFailure } from './dataSource';

/** `VITE_DATA_SOURCE=demo|api`, overridable at runtime from the debug panel. */
export const DATA_SOURCE_KEY = 'navereat_data_source';
export const DATA_SOURCE_EVENT = 'navereat:data-source';

const envMode = (): DataSourceMode => (import.meta.env.VITE_DATA_SOURCE === 'api' ? 'api' : 'demo');

export const sourceMode = (): DataSourceMode => {
  try {
    const stored = window.localStorage.getItem(DATA_SOURCE_KEY);
    if (stored === 'api' || stored === 'demo') return stored;
  } catch {
    /* storage may be unavailable */
  }
  return envMode();
};

export const setSourceMode = (mode: DataSourceMode): void => {
  try {
    window.localStorage.setItem(DATA_SOURCE_KEY, mode);
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new CustomEvent(DATA_SOURCE_EVENT, { detail: mode }));
};

/**
 * The api source is a separate chunk: demo is the default build and must not
 * pay for the transport, mappers and fixtures in its entry bundle.
 */
export const loadDataSource = async (mode: DataSourceMode = sourceMode()): Promise<DataSource> =>
  mode === 'api'
    ? import('./api/apiDataSource').then((module) => module.apiDataSource)
    : import('./demoDataSource').then((module) => module.demoDataSource);

export function useDataSourceMode(): DataSourceMode {
  const [mode, setMode] = useState<DataSourceMode>(sourceMode);
  useEffect(() => {
    const onChange = () => setMode(sourceMode());
    window.addEventListener(DATA_SOURCE_EVENT, onChange);
    return () => window.removeEventListener(DATA_SOURCE_EVENT, onChange);
  }, []);
  return mode;
}

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/** Runs an api call only in api mode; demo pages keep their synchronous data. */
export function useApiQuery<T>(run: () => Promise<T>, deps: unknown[], enabled: boolean): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData(null);
      setError(null);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    runRef.current().then(
      (value) => {
        if (cancelled) return;
        setData(value);
        setLoading(false);
      },
      (failure: { message?: string }) => {
        if (cancelled) return;
        setError(failure?.message ?? 'Something went wrong while loading.');
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, nonce, ...deps]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  return { data, loading, error, reload };
}

export function useHomeFeed(enabled = true) {
  const mode = useDataSourceMode();
  const query = useApiQuery(
    () => loadDataSource('api').then((source) => source.getHome()),
    [],
    enabled && mode === 'api',
  );
  return { mode, ...query };
}

/** The home hero banner copy, in api mode only; demo keeps the neutral defaults. */
export function useHomeBanners(enabled = true) {
  const mode = useDataSourceMode();
  const query = useApiQuery<Banner[]>(
    () => loadDataSource('api').then((source) => source.getBanners('home')),
    [],
    enabled && mode === 'api',
  );
  return { mode, ...query };
}

export function useRestaurantData(id: number | string, enabled = true) {
  const mode = useDataSourceMode();
  const query = useApiQuery(
    () => loadDataSource('api').then((source) => source.getRestaurant(id)),
    [String(id)],
    enabled && mode === 'api',
  );
  const restaurant: Restaurant | null = query.data?.restaurant ?? null;
  const menu: MenuItem[] = query.data?.menu ?? [];
  return { mode, restaurant, menu, loading: query.loading, error: query.error, reload: query.reload };
}

export function usePlatformStatusData(enabled = true) {
  const mode = useDataSourceMode();
  const query = useApiQuery<PlatformStatus>(
    () => loadDataSource('api').then((source) => source.getPlatformStatus()),
    [],
    enabled && mode === 'api',
  );
  return { mode, status: query.data, loading: query.loading, error: query.error, reload: query.reload };
}

const hasSession = (): boolean => {
  try {
    return Boolean(window.localStorage.getItem('nearbite_token'));
  } catch {
    return false;
  }
};

/**
 * The home header's location lines. Demo keeps its bundled labels (the hook
 * returns null and the components render them), api mode reads the customer's
 * default address and falls back to the original's logged-out pair.
 */
export function useLocationLabel(): LocationLabel | null {
  const mode = useDataSourceMode();
  const [loggedIn, setLoggedIn] = useState(hasSession);
  useEffect(() => {
    const sync = () => setLoggedIn(hasSession());
    window.addEventListener('storage', sync);
    window.addEventListener('navereat:session-changed', sync);
    window.addEventListener('navereat:session-expired', sync);
    sync();
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('navereat:session-changed', sync);
      window.removeEventListener('navereat:session-expired', sync);
    };
  }, [mode]);
  const query = useApiQuery<Address[]>(
    () => loadDataSource('api').then((source) => source.getAddresses()),
    [],
    mode === 'api' && loggedIn,
  );
  if (mode !== 'api') return null;
  const list = query.data ?? [];
  const address = list.find((entry) => entry.isDefault) ?? list[0] ?? null;
  return deriveLocationLabel(address);
}

export function useSearchResults(query: string, enabled = true) {
  const mode = useDataSourceMode();
  const trimmed = query.trim();
  const state = useApiQuery<SearchResult[]>(
    () => loadDataSource('api').then((source) => source.search(trimmed)),
    [trimmed],
    enabled && mode === 'api' && trimmed.length > 0,
  );
  return { mode, ...state };
}
