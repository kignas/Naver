import type { Address } from './dataSource';

/* The home header's two lines, derived the way home.js does it:
   the tag (or the city) on top, the address detail underneath, and the
   logged-out pair when there is no saved address. */

/** The service town the original prints in its "Nearby restaurants · X" strip. */
export const PLATFORM_AREA = 'Maynaguri';

export const LOGGED_OUT_LABEL = {
  name: 'Set delivery location',
  sub: 'Choose your delivery location',
} as const;

export interface LocationLabel {
  name: string;
  sub: string;
  area: string;
}

const tagLabel = (tag?: string): string => {
  const value = String(tag || '').trim();
  if (/^(work|office)$/i.test(value)) return 'Office';
  if (/^(home|house)$/i.test(value)) return 'Home';
  return value;
};

const uniqueParts = (values: Array<string | undefined>): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  values.forEach((value) => {
    String(value || '')
      .split(',')
      .forEach((piece) => {
        const text = piece.replace(/\s+/g, ' ').trim();
        const key = text.toLowerCase();
        if (!text || seen.has(key)) return;
        seen.add(key);
        out.push(text);
      });
  });
  return out;
};

export function deriveLocationLabel(address: Address | null, fallbackArea = PLATFORM_AREA): LocationLabel {
  if (!address) return { ...LOGGED_OUT_LABEL, area: fallbackArea };
  const name = tagLabel(address.tag) || address.city || 'Delivering to';
  const detail = uniqueParts([address.house, address.landmark, address.area, address.city]).join(', ');
  return {
    name,
    sub: detail || 'Saved delivery address',
    area: address.city || address.area || fallbackArea,
  };
}
