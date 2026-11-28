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

export function addressHasCoords(address: SavedAddress | null): boolean {
  if (!address) return false;
  const location = address.location as { coordinates?: unknown } | undefined;
  const point = Array.isArray(location?.coordinates) ? location?.coordinates : null;
  if (point && point.length === 2) return true;
  const lat = Number(address.latitude);
  const lng = Number(address.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0);
}

export function announceAddressChange(): void {
  window.dispatchEvent(new CustomEvent(ADDRESS_CHANGED_EVENT));
}
