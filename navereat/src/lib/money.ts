/** Money helpers ported from the legacy app (integer rupees, no decimals). */
export const formatMoney = (value: number): string => `₹${Math.round(value)}`;

export const formatCount = (n: number, singular: string, plural = `${singular}s`): string =>
  `${n} ${n === 1 ? singular : plural}`;

export const itemWord = (n: number): string => (n === 1 ? 'ITEM' : 'ITEMS');
