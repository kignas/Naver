import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Loads a verbatim copy of a legacy module from `tests/original/`.
 * The files are CommonJS (UMD) so Node can `require` them directly. The
 * browser-only modules assign to `window.*` instead of `module.exports`, so
 * those pass the global name they publish under.
 */
export function oracle<T>(name: string, globalName?: string): T {
  const path = require.resolve(`../original/${name}.cjs`);
  delete require.cache[path];
  const globals = globalThis as unknown as Record<string, unknown>;
  if (globalName) delete globals[globalName];
  const exported = require(path) as unknown;
  if (globalName) {
    const value = globals[globalName];
    if (value) return value as T;
  }
  return exported as T;
}
