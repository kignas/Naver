import { describe, expect, it } from 'vitest';
import * as ts from '../src/logic/availability';
import { oracle } from './helpers/oracles';

interface LegacyAvailability {
  LABELS: Record<string, string>;
  classify: (r: unknown) => unknown;
  isOrderable: (r: unknown) => boolean;
  isVisible: (r: unknown) => boolean;
  isSponsored: (r: unknown) => boolean;
  sponsoredLabel: (r: unknown) => string;
  isFeatured: (r: unknown) => boolean;
  isPinned: (r: unknown) => boolean;
  distanceKm: (r: unknown) => number | null;
  serviceable: (r: unknown) => boolean | null;
}

const legacy = oracle<LegacyAvailability>('ew-availability');

const RESTAURANTS: unknown[] = [
  { availabilityStatus: 'orderable' },
  { availabilityStatus: 'busy' },
  { availabilityStatus: 'temporarily_closed', availabilityInfo: { reason: 'CLOSED' } },
  { availabilityStatus: 'suspended' },
  { availabilityInfo: { class: 'outside_hours', orderable: false, visible: true, label: 'Opens at 7 pm', nextOpening: '19:00' } },
  { orderable: true },
  { online: false },
  { availability: { isOpen: false, closedReason: 'closed_today' } },
  { availability: { isOpen: false, closedReason: 'outside_hours' } },
  { availability: { isOpen: false } },
  { availability: { isOpen: true } },
  { isOpen: false },
  { orderable: false, availability: { status: 'busy' } },
  { orderable: true, availability: { status: 'busy' } },
  { sponsored: true, sponsoredLabel: 'Ad', featured: true, pinned: true, distanceKm: 3.4, serviceable: true },
  { isSponsored: true, isFeatured: true, isPinned: true, distanceMeters: 3400, serviceable: false },
  {},
  null,
];

describe('availability parity with ew-availability.js', () => {
  it('labels (neutral brand wording is the only intentional difference)', () => {
    const neutral = { ...legacy.LABELS, suspended: ts.LABELS.suspended };
    expect(ts.LABELS).toEqual(neutral);
    expect(ts.LABELS.suspended).toBe('Suspended');
  });

  it.each(RESTAURANTS)('classify(%#)', (restaurant) => {
    const expected = legacy.classify(restaurant) as { label?: string } | null;
    if (expected && expected.label === 'Suspended by Eatswada') expected.label = 'Suspended';
    expect(ts.classify(restaurant as never)).toEqual(expected);
  });

  it.each(RESTAURANTS)('boolean readers(%#)', (restaurant) => {
    expect(ts.isOrderable(restaurant as never)).toBe(legacy.isOrderable(restaurant));
    expect(ts.isVisible(restaurant as never)).toBe(legacy.isVisible(restaurant));
    expect(ts.isSponsored(restaurant as never)).toBe(legacy.isSponsored(restaurant));
    expect(ts.sponsoredLabel(restaurant as never)).toBe(legacy.sponsoredLabel(restaurant));
    expect(ts.isFeatured(restaurant as never)).toBe(legacy.isFeatured(restaurant));
    expect(ts.isPinned(restaurant as never)).toBe(legacy.isPinned(restaurant));
    expect(ts.distanceKm(restaurant as never)).toBe(legacy.distanceKm(restaurant));
    expect(ts.serviceable(restaurant as never)).toBe(legacy.serviceable(restaurant));
  });
});
