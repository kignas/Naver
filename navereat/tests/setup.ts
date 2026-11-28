/* Test-only shims so the legacy UMD modules (which expect a browser global)
   can be loaded in Node as parity oracles. Nothing here ships. */
import { beforeEach } from 'vitest';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
}

const globalRecord = globalThis as unknown as Record<string, unknown>;
if (!globalRecord.window) globalRecord.window = globalThis;
if (!globalRecord.localStorage) globalRecord.localStorage = new MemoryStorage();
if (!globalRecord.sessionStorage) globalRecord.sessionStorage = new MemoryStorage();

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
