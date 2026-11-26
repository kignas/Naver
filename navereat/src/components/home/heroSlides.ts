/**
 * Hero slide data. Everything the admin will later control lives here: copy,
 * theme colours and which cut-outs appear. The layout and motion stay in code
 * (HeroBanner.tsx) so every slide keeps the same premium choreography.
 * Later, replace HERO_SLIDES with the response of /api/banners/active.
 */
export type HeroItemKey = 'paperCup' | 'chaiMug' | 'filterCoffee' | 'idliPlate' | 'lemonRice';

export interface HeroTheme {
  /** Three-stop background gradient, top-left to bottom-right. */
  bgA: string;
  bgB: string;
  bgC: string;
  /** Soft highlight glow, top right. */
  glow: string;
  /** Colour of the first headline line. */
  accent: string;
  /** Bottom promo strip. */
  strip: string;
  stripText: string;
}

export interface HeroSlide {
  id: string;
  theme: HeroTheme;
  headline: {
    pre?: string;
    line1: string;
    line2: string;
    sub?: string;
    /** Shrinks long words so they fit the copy column (1 = default size). */
    scale?: number;
  };
  /** Draw order doubles as the entrance stagger order. */
  items: HeroItemKey[];
  stripLabel: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'free-delivery',
    theme: {
      bgA: '#6b1520',
      bgB: '#5d0d18',
      bgC: '#44070e',
      glow: 'rgba(235, 203, 139, 0.2)',
      accent: '#ebcb8b',
      strip: '#44070e',
      stripText: '#ebcb8b',
    },
    headline: { pre: 'with', line1: 'FREE', line2: 'Delivery' },
    items: ['paperCup', 'chaiMug', 'idliPlate', 'lemonRice', 'filterCoffee'],
    stripLabel: 'Get additional ₹40 free cash',
  },
  {
    id: 'breakfast-staples',
    theme: {
      bgA: '#0f6a55',
      bgB: '#0b5543',
      bgC: '#073a2e',
      glow: 'rgba(255, 226, 150, 0.2)',
      accent: '#ffd978',
      strip: '#073a2e',
      stripText: '#ffd978',
    },
    headline: { line1: 'Breakfast', line2: 'Staples', sub: 'Starting at ₹49', scale: 0.84 },
    items: ['chaiMug', 'filterCoffee', 'idliPlate', 'lemonRice'],
    stripLabel: 'Fresh from 6 AM',
  },
  {
    id: 'late-night',
    theme: {
      bgA: '#243a7a',
      bgB: '#16224f',
      bgC: '#0b1230',
      glow: 'rgba(160, 190, 255, 0.22)',
      accent: '#ffd166',
      strip: '#0b1230',
      stripText: '#ffd166',
    },
    headline: { line1: 'Late-night', line2: 'Cravings', sub: 'Hot & fresh, any hour', scale: 0.8 },
    items: ['paperCup', 'chaiMug', 'lemonRice'],
    stripLabel: 'Free delivery after 9 PM',
  },
];
