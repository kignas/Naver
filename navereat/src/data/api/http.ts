import type { ApiFailure, ApiFailureKind, Session } from '../dataSource';

/**
 * Transport for the Eatswada customer API — see docs/API_CONTRACT.md §1.
 * No secrets here: the base URL is public and the token comes from storage.
 */
export const API_BASE_URL = 'https://api.eatswada.com/api';
const DEFAULT_TIMEOUT_MS = 12000;

export const SESSION_KEYS = {
  token: 'nearbite_token',
  legacyToken: 'token',
  eatswadaToken: 'eatswada_token',
  user: 'nearbite_user',
} as const;

export const CACHE_KEYS = {
  restaurants: 'es_restaurants_v4',
  categories: 'es_categories_v4',
  banners: 'ew_banners_v1',
  menu: 'ew_menu_v1',
  menuIndex: 'ew_menu_v1:index',
} as const;

const TEN_MINUTES = 10 * 60 * 1000;
const MENU_MAX_ENTRIES = 6;
const MENU_MAX_BYTES = 600 * 1024;

const MESSAGES = {
  network: "Can't reach the server. Check your connection.",
  timeout: 'The server took too long to respond.',
  parse: 'The server sent a response we could not read.',
  shape: 'The server sent unexpected data.',
  notFound: 'Not found.',
  server: 'The server is having trouble right now.',
  generic: 'Something went wrong while loading.',
} as const;

export const failure = (
  kind: ApiFailureKind,
  message: string,
  extra: { status?: number; code?: string } = {},
): ApiFailure => ({
  kind,
  message,
  retryable: kind === 'network' || kind === 'timeout' || (kind === 'http' && (extra.status ?? 0) >= 500),
  ...extra,
});

const storage = (kind: 'local' | 'session'): Storage | null => {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
};

export const readToken = (): string => {
  for (const key of [SESSION_KEYS.token, SESSION_KEYS.legacyToken, SESSION_KEYS.eatswadaToken]) {
    const value = storage('local')?.getItem(key) ?? storage('session')?.getItem(key);
    if (value) return value;
  }
  return '';
};

export const readUser = <T>(): T | null => {
  const raw = storage('local')?.getItem(SESSION_KEYS.user);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
};

export const saveSession = (session: Session): void => {
  storage('local')?.setItem(SESSION_KEYS.token, session.token);
  storage('local')?.setItem(SESSION_KEYS.legacyToken, session.token);
  storage('session')?.setItem(SESSION_KEYS.token, session.token);
  storage('local')?.setItem(SESSION_KEYS.user, JSON.stringify(session.user));
};

export const clearSession = (): void => {
  for (const key of [SESSION_KEYS.token, SESSION_KEYS.legacyToken, SESSION_KEYS.eatswadaToken, SESSION_KEYS.user]) {
    storage('local')?.removeItem(key);
    storage('session')?.removeItem(key);
  }
  window.dispatchEvent(new CustomEvent('navereat:session-expired'));
};

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
const networkFetcher: Fetcher = (input, init) => fetch(input, init);
let fetcher: Fetcher = networkFetcher;

/** Test/gate seam: serve recorded fixtures instead of the network. */
export const setFetcher = (next: Fetcher | null): void => {
  fetcher = next ?? networkFetcher;
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Skip the read side of the cache for this call (the response is still stored). */
  fresh?: boolean;
}

interface CachedEntry {
  at: number;
  maxAge: number;
  data: unknown;
}

const readCache = (store: 'local' | 'session', key: string): unknown => {
  const raw = storage(store)?.getItem(key);
  if (!raw) return undefined;
  try {
    const entry = JSON.parse(raw) as CachedEntry;
    if (!entry || typeof entry.at !== 'number' || Date.now() - entry.at > entry.maxAge) return undefined;
    return entry.data;
  } catch {
    return undefined;
  }
};

const writeCache = (store: 'local' | 'session', key: string, data: unknown, maxAge: number): void => {
  try {
    storage(store)?.setItem(key, JSON.stringify({ at: Date.now(), maxAge, data } satisfies CachedEntry));
  } catch {
    /* quota — caching is an optimisation */
  }
};

const unwrap = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (record.success === false) {
      throw failure('http', typeof record.message === 'string' ? record.message : MESSAGES.generic, {
        code: typeof record.code === 'string' ? record.code : undefined,
      });
    }
    if ('data' in record) return record.data as T;
  }
  return payload as T;
};

let fixturesLoading: Promise<void> | null = null;

/**
 * `VITE_API_FIXTURES=1` serves the recorded responses instead of the network so
 * the api-mode gates can run offline. The chunk is lazy: a normal build never
 * loads it.
 */
const ensureFixtures = (): Promise<void> => {
  fixturesLoading ??= import('./fixtures').then((module) => module.installFixtureFetcher());
  return fixturesLoading;
};

/** One call, one error shape. Never throws anything but an ApiFailure. */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (import.meta.env.VITE_API_FIXTURES === '1') await ensureFixtures();
  const { method = 'GET', body, auth = false, timeoutMs = DEFAULT_TIMEOUT_MS, headers = {} } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json';
  const token = readToken();
  if (auth && token) requestHeaders.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetcher(`${API_BASE_URL}${path}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      cache: 'no-store',
    });
  } catch (error) {
    clearTimeout(timer);
    if ((error as { name?: string })?.name === 'AbortError') throw failure('timeout', MESSAGES.timeout);
    throw failure('network', MESSAGES.network);
  }
  clearTimeout(timer);

  let text = '';
  try {
    text = await response.text();
  } catch {
    throw failure('network', MESSAGES.network);
  }
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw failure('parse', MESSAGES.parse);
    }
  }

  if (!response.ok) {
    const serverMessage =
      payload && typeof payload === 'object' && typeof (payload as { message?: string }).message === 'string'
        ? (payload as { message: string }).message
        : '';
    if (response.status === 401 || response.status === 403) {
      if (auth) clearSession();
      throw failure('auth', serverMessage || MESSAGES.generic, { status: response.status });
    }
    const message =
      response.status === 404
        ? MESSAGES.notFound
        : response.status >= 500
          ? MESSAGES.server
          : serverMessage || MESSAGES.generic;
    throw failure('http', message, {
      status: response.status,
      code: payload && typeof payload === 'object' ? ((payload as { code?: string }).code ?? undefined) : undefined,
    });
  }
  return unwrap<T>(payload);
}

export interface CachedRequestOptions extends RequestOptions {
  key: string;
  store: 'local' | 'session';
  maxAgeMs: number;
}

export async function cachedRequest<T>(path: string, options: CachedRequestOptions): Promise<T> {
  const { key, store, maxAgeMs, fresh, ...rest } = options;
  if (!fresh) {
    const hit = readCache(store, key);
    if (hit !== undefined) return hit as T;
  }
  const data = await request<T>(path, rest);
  writeCache(store, key, data, maxAgeMs);
  return data;
}

export const CACHE_TTL = { tenMinutes: TEN_MINUTES } as const;

/** Menu cache with the contract's 6-entry / 600 kB eviction. */
export const menuCache = {
  read(id: string): unknown {
    return readCache('local', `${CACHE_KEYS.menu}:${id}`);
  },
  write(id: string, data: unknown): void {
    const index = (readCache('local', CACHE_KEYS.menuIndex) as string[] | undefined) ?? [];
    const next = [id, ...index.filter((entry) => entry !== id)].slice(0, MENU_MAX_ENTRIES);
    const serialised = JSON.stringify({ at: Date.now(), maxAge: TEN_MINUTES, data });
    if (serialised.length > MENU_MAX_BYTES) return;
    writeCache('local', `${CACHE_KEYS.menu}:${id}`, data, TEN_MINUTES);
    writeCache('local', CACHE_KEYS.menuIndex, next, TEN_MINUTES);
    for (const dropped of index.slice(MENU_MAX_ENTRIES - 1)) {
      if (!next.includes(dropped)) storage('local')?.removeItem(`${CACHE_KEYS.menu}:${dropped}`);
    }
  },
};
