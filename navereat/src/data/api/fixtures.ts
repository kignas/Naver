import recorded from './fixtures.json';
import { setFetcher } from './http';

/**
 * Offline api mode: the recorded, scrubbed responses from the read-only pass
 * (`scripts/api-readonly.ts --fixtures`). Only loaded when
 * `VITE_API_FIXTURES=1`, so the normal build never pays for it.
 */
export const installFixtureFetcher = (): void => {
  const table = recorded as Record<string, unknown>;
  setFetcher(async (input) => {
    const url = new URL(input);
    const path = url.pathname.replace(/^\/api/, '');
    const payload = table[path] ?? { success: true, data: [] };
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
};

export const fixturePaths = (): string[] => Object.keys(recorded as Record<string, unknown>);
