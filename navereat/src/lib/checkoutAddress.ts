/**
 * Selected delivery address, kept in the same localStorage keys as the legacy
 * checkout (`nearbite_address`, `nearbite_selected_address_id`) so a reload and
 * the /address page agree with the cart.
 */
export const ADDRESS_KEY = 'nearbite_address';
export const SELECTED_ADDRESS_KEY = 'nearbite_selected_address_id';
export const ADDRESS_CHANGED_EVENT = 'navereat:address-changed';

export interface SavedAddress {
  _id?: string;
  id?: string;
  tag?: string;
  house?: string;
  area?: string;
  city?: string;
  pincode?: string;
  receiverName?: string;
  receiverPhone?: string;
  [key: string]: unknown;
}

export const addressIdOf = (address: SavedAddress | null | undefined): string =>
  address ? String(address._id ?? address.id ?? '') : '';

export function readSavedAddress(): SavedAddress | null {
  try {
    const raw = localStorage.getItem(ADDRESS_KEY);
    if (!raw || raw === 'null') return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SavedAddress) : null;
  } catch {
    return null;
  }
}

export function readSelectedAddressId(): string {
  try {
    return localStorage.getItem(SELECTED_ADDRESS_KEY) || '';
  } catch {
    return '';
  }
}

export function selectedAddress(): SavedAddress | null {
  const saved = readSavedAddress();
  if (!saved) return null;
  const id = readSelectedAddressId();
  return !id || addressIdOf(saved) === id ? saved : saved;
}

export function formatAddressLine(address: SavedAddress | null | undefined): string {
  if (!address) return '';
  return [address.house, address.area, address.city, address.pincode].filter(Boolean).join(', ');
}

/**
 * cart-page.js `normalizeCoords`: GeoJSON `{ coordinates: [lng, lat] }` or the
 * legacy `{ longitude, latitude }` pair, in that order.
 */
export function normalizeCoords(value: unknown): [number, number] | null {
  if (!value || typeof value !== 'object') return null;
  const point = value as { coordinates?: unknown; longitude?: unknown; latitude?: unknown };
  if (Array.isArray(point.coordinates) && point.coordinates.length === 2) {
    const lng = Number(point.coordinates[0]);
    const lat = Number(point.coordinates[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90) {
      return [lng, lat];
    }
  }
  if (Number.isFinite(Number(point.longitude)) && Number.isFinite(Number(point.latitude))) {
    const lng = Number(point.longitude);
    const lat = Number(point.latitude);
    if (Math.abs(lng) <= 180 && Math.abs(lat) <= 90) return [lng, lat];
  }
  return null;
}

/** Mirror of cart-page.js `hasAddress()`'s coordinate half. */
export function addressHasCoords(address: SavedAddress | null): boolean {
  if (!address) return false;
  return normalizeCoords(address.location ?? address) !== null;
}

export function announceAddressChange(): void {
  window.dispatchEvent(new CustomEvent(ADDRESS_CHANGED_EVENT));
}
