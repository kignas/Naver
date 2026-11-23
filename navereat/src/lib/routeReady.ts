const readyKeys = new Set<string>();
const waiters = new Map<string, Set<() => void>>();

export function markRouteReady(key: string): void {
  readyKeys.add(key);
  waiters.get(key)?.forEach((resolve) => resolve());
  waiters.delete(key);
}

export function waitForRouteReady(key: string, timeoutMs = 2500): Promise<void> {
  if (readyKeys.has(key)) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      window.clearTimeout(timer);
      waiters.get(key)?.delete(finish);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    const set = waiters.get(key) ?? new Set<() => void>();
    set.add(finish);
    waiters.set(key, set);
  });
}
