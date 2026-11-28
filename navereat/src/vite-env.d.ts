/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 'demo' (default) or 'live'. Only 'live' selects the typed stub. */
  readonly VITE_DATA_MODE?: 'demo' | 'live';
  /** Live API origin; read by liveApi only, never by demo code. */
  readonly VITE_API_BASE_URL?: string;
}
