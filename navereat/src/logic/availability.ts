/**
 * Port of `ew-availability.js`: one reader for the backend's ranking and
 * availability fields. Never computes availability or order.
 */
export const LABELS: Record<string, string> = {
  orderable: 'Open',
  busy: 'Busy — accepting orders',
  temporarily_closed: 'Temporarily closed',
  closed_today: 'Closed today',
  outside_hours: 'Outside opening hours',
  suspended: 'Suspended',
  unapproved: 'Not approved yet',
  inactive: 'Inactive',
  unknown: 'Unavailable',
};

const OFFLINE: Record<string, true> = {
  temporarily_closed: true,
  closed_today: true,
  outside_hours: true,
  suspended: true,
  unapproved: true,
  inactive: true,
  unknown: true,
};

export interface RestaurantAvailabilityInput {
  availabilityStatus?: string;
  availabilityInfo?: { class?: string; orderable?: boolean; visible?: boolean; reason?: string; label?: string; nextOpening?: unknown } | null;
  orderable?: boolean;
  online?: boolean;
  availability?: { isOpen?: boolean; status?: string; closedReason?: string } | null;
  operational?: { nextOpening?: unknown } | null;
  isOpen?: boolean;
  closedReason?: string;
  availabilityReason?: string;
  sponsored?: boolean;
  isSponsored?: boolean;
  sponsoredLabel?: string;
  featured?: boolean;
  isFeatured?: boolean;
  pinned?: boolean;
  isPinned?: boolean;
  distanceKm?: number | string;
  serviceable?: boolean;
}

export interface Availability {
  class: string;
  orderable: boolean;
  visible: boolean;
  reason: string;
  label: string;
  nextOpening: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object';
const boolOrNull = (v: unknown): boolean | null => (typeof v === 'boolean' ? v : null);

export function classify(res: RestaurantAvailabilityInput | null | undefined): Availability {
  const r = res || {};
  const info = isObject(r.availabilityInfo) ? r.availabilityInfo : null;

  const cls = info && typeof info.class === 'string' ? info.class : typeof r.availabilityStatus === 'string' ? r.availabilityStatus : '';

  if (cls) {
    let orderable = boolOrNull(info ? info.orderable : null);
    if (orderable === null) orderable = boolOrNull(r.orderable);
    if (orderable === null) orderable = !OFFLINE[cls];
    let visible = boolOrNull(info ? info.visible : null);
    if (visible === null) visible = !(cls === 'suspended' || cls === 'unapproved' || cls === 'inactive');
    return {
      class: cls,
      orderable,
      visible,
      reason: (info && (info.reason as string)) || r.availabilityReason || '',
      label: (info && (info.label as string)) || LABELS[cls] || LABELS.unknown,
      nextOpening: (info && info.nextOpening) || (isObject(r.operational) ? r.operational.nextOpening : null) || null,
    };
  }

  let ord = boolOrNull(r.orderable);
  if (ord === null) ord = boolOrNull(r.online);
  if (ord !== null) {
    const klass = ord ? (isObject(r.availability) && r.availability.status === 'busy' ? 'busy' : 'orderable') : 'temporarily_closed';
    return { class: klass, orderable: ord, visible: true, reason: '', label: LABELS[klass], nextOpening: null };
  }

  const avail = isObject(r.availability) ? r.availability : {};
  const isOpen = typeof avail.isOpen === 'boolean' ? avail.isOpen : boolOrNull(r.isOpen);
  if (isOpen === false) {
    const reason = (avail.closedReason as string) || r.closedReason || '';
    const offlineClass =
      reason === 'closed_today'
        ? 'closed_today'
        : reason === 'outside_hours'
          ? 'outside_hours'
          : reason === 'temporarily_closed'
            ? 'temporarily_closed'
            : 'temporarily_closed';
    return { class: offlineClass, orderable: false, visible: true, reason, label: LABELS[offlineClass], nextOpening: null };
  }
  return { class: 'orderable', orderable: true, visible: true, reason: '', label: LABELS.orderable, nextOpening: null };
}

export const isOrderable = (res: RestaurantAvailabilityInput | null | undefined): boolean => classify(res).orderable === true;
export const isVisible = (res: RestaurantAvailabilityInput | null | undefined): boolean => classify(res).visible !== false;

export const isTemporaryClosure = (cls: string): boolean =>
  cls === 'temporarily_closed' || cls === 'closed_today' || cls === 'outside_hours';

export const isAdministrative = (cls: string): boolean => cls === 'suspended' || cls === 'unapproved' || cls === 'inactive';

export function isSponsored(res: RestaurantAvailabilityInput | null | undefined): boolean {
  const r = res || {};
  if (r.sponsored === true) return true;
  return r.isSponsored === true;
}

export function sponsoredLabel(res: RestaurantAvailabilityInput | null | undefined): string {
  const r = res || {};
  if (!isSponsored(r)) return '';
  return r.sponsoredLabel || 'Sponsored';
}

export const isFeatured = (res: RestaurantAvailabilityInput | null | undefined): boolean => {
  const r = res || {};
  return r.featured === true || r.isFeatured === true;
};

export const isPinned = (res: RestaurantAvailabilityInput | null | undefined): boolean => {
  const r = res || {};
  return r.pinned === true || r.isPinned === true;
};

export function distanceKm(res: RestaurantAvailabilityInput | null | undefined): number | null {
  const r = res || {};
  if (Number.isFinite(Number(r.distanceKm))) return Number(r.distanceKm);
  return null;
}

export const serviceable = (res: RestaurantAvailabilityInput | null | undefined): boolean | null => {
  const r = res || {};
  return typeof r.serviceable === 'boolean' ? r.serviceable : null;
};

export const availability = {
  LABELS,
  classify,
  isOrderable,
  isVisible,
  isTemporaryClosure,
  isAdministrative,
  isSponsored,
  sponsoredLabel,
  isFeatured,
  isPinned,
  distanceKm,
  serviceable,
};
