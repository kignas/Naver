import type { MenuItem } from '../../data/demo';

export type MenuFilter = 'popular' | 'rating' | 'price' | 'veg' | 'nonveg';

export interface MenuGroup {
  name: string;
  items: MenuItem[];
}

export const FILTER_CHIPS: { id: MenuFilter; label: string; className?: string }[] = [
  { id: 'popular', label: 'Popular' },
  { id: 'rating', label: '4.0+ rating' },
  { id: 'price', label: '₹99–₹149' },
  { id: 'veg', label: 'Veg', className: 'veg-chip veg-type diet-chip' },
  { id: 'nonveg', label: 'Non-veg', className: 'veg-chip nonveg-type diet-chip' },
];

export function categoryId(name: string, index: number): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `cat-${slug || 'menu'}-${index}`;
}
