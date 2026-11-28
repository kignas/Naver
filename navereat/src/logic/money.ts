/**
 * Display-only money helpers, ported 1:1 from the legacy `ew-money.js`.
 * Every value formatted here was already decided elsewhere; nothing in this
 * module prices an order.
 */

export const paiseToRupees = (paise: unknown): number => {
  const n = Number(paise);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n) / 100;
};

export const rupeesToPaise = (rupees: unknown): number => {
  const n = Number(rupees);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
};

export const isNum = (value: unknown): boolean => {
  if (value === null || value === undefined || value === '') return false;
  return Number.isFinite(Number(value));
};

const manualIndianGroup = (abs: number): string => {
  const rounded = Math.round(abs * 100) / 100;
  const [intPart, frac = ''] = String(rounded).split('.');
  const last3 = intPart.slice(-3);
  let rest = intPart.slice(0, -3);
  if (rest) rest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  let out = rest ? `${rest},${last3}` : last3;
  if (frac) out += `.${frac}`;
  return out;
};

/** `₹1,23,456.78` — Indian grouping, up to 2 decimals, trailing `.00` dropped. */
export const format = (value: unknown): string => {
  if (!isNum(value)) return '';
  const n = Number(value);
  const negative = n < 0;
  const abs = Math.abs(n);
  let s: string;
  try {
    s = abs.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  } catch {
    s = manualIndianGroup(abs);
  }
  return `${negative ? '-' : ''}₹${s}`;
};

/** Whole-rupee display, no decimals (fees shown as "₹25"). */
export const formatInt = (value: unknown): string => {
  if (!isNum(value)) return '';
  const n = Number(value);
  const negative = n < 0;
  const abs = Math.abs(Math.round(n));
  let s: string;
  try {
    s = abs.toLocaleString('en-IN');
  } catch {
    s = manualIndianGroup(abs);
  }
  return `${negative ? '-' : ''}₹${s}`;
};

export const money = { paiseToRupees, rupeesToPaise, isNum, format, formatInt, manualIndianGroup };
