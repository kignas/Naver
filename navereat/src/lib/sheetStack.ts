type SheetCloser = () => void;

const openSheets: SheetCloser[] = [];

export function registerSheet(close: SheetCloser): () => void {
  openSheets.push(close);
  return () => {
    const index = openSheets.lastIndexOf(close);
    if (index !== -1) openSheets.splice(index, 1);
  };
}

export function closeTopSheet(): boolean {
  const close = openSheets[openSheets.length - 1];
  if (!close) return false;
  close();
  return true;
}
