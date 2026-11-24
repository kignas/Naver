type SheetCloser = () => void;

const openSheets: SheetCloser[] = [];
const listeners = new Set<() => void>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

export function registerSheet(close: SheetCloser): () => void {
  openSheets.push(close);
  notify();
  return () => {
    const index = openSheets.lastIndexOf(close);
    if (index !== -1) openSheets.splice(index, 1);
    notify();
  };
}

export function closeTopSheet(): boolean {
  const close = openSheets[openSheets.length - 1];
  if (!close) return false;
  close();
  return true;
}

/** How many sheets/overlays currently own the screen. */
export function sheetCount(): number {
  return openSheets.length;
}

export function subscribeSheetCount(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
