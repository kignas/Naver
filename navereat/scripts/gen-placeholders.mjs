// Generates neutral, fully local SVG placeholders (no network images).
// Run with: node scripts/gen-placeholders.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'assets', 'placeholders');
mkdirSync(outDir, { recursive: true });

const palettes = [
  ['#fff1e6', '#ffdcc2', '#c2410c'],
  ['#eaf4ff', '#d3e8ff', '#1d4ed8'],
  ['#eafbf0', '#d2f5e0', '#15803d'],
  ['#fff7da', '#ffe9ad', '#a16207'],
  ['#fdebf1', '#fad2e2', '#be185d'],
  ['#f1ecff', '#e2d8ff', '#6d28d9'],
  ['#e9f7f7', '#d1efef', '#0f766e'],
  ['#fff0f0', '#ffdada', '#b91c1c'],
];

const glyphs = {
  plate: `<circle cx="0" cy="0" r="46" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="0" cy="0" r="26" fill="none" stroke="currentColor" stroke-width="6"/>`,
  bowl: `<path d="M-52 4h104a52 52 0 0 1-104 0z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-26 -14c0-12 10-18 10-30M6 -14c0-12 10-18 10-30M38 -14c0-12 10-18 10-30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  pizza: `<path d="M0-52 52 40c-32 14-72 14-104 0z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><circle cx="-14" cy="10" r="8" fill="currentColor"/><circle cx="16" cy="6" r="8" fill="currentColor"/><circle cx="0" cy="34" r="7" fill="currentColor"/>`,
  burger: `<path d="M-48-10c0-30 96-30 96 0z" fill="none" stroke="currentColor" stroke-width="7"/><rect x="-50" y="2" width="100" height="12" rx="6" fill="currentColor"/><path d="M-50 26h100c0 18-18 24-50 24s-50-6-50-24z" fill="none" stroke="currentColor" stroke-width="7"/>`,
  cup: `<path d="M-34-34h56v42a28 28 0 0 1-56 0z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M22-24h14a14 14 0 0 1 0 28H22" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-18-44v-14M2-44v-14" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  leaf: `<path d="M-46 42C-46-8 6-50 48-48 50-4 8 46-46 42z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-46 42 26-34" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  fish: `<ellipse cx="-6" cy="0" rx="48" ry="28" fill="none" stroke="currentColor" stroke-width="7"/><path d="M42 0 64-22v44z" fill="currentColor"/><circle cx="-24" cy="-6" r="5" fill="currentColor"/>`,
  chicken: `<circle cx="-18" cy="-16" r="30" fill="none" stroke="currentColor" stroke-width="7"/><path d="M4 6 38 40" stroke="currentColor" stroke-width="14" stroke-linecap="round"/><path d="M38 40 52 54" stroke="currentColor" stroke-width="7" stroke-linecap="round"/>`,
  momo: `<path d="M-52 18a52 52 0 0 1 104 0z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-26 18c0-22 10-38 26-38s26 16 26 38" fill="none" stroke="currentColor" stroke-width="5"/>`,
  noodles: `<path d="M-52 6h104a52 52 0 0 1-104 0z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-34-6c8-22 20-30 34-30M0-6c8-22 20-30 34-30M-52-40l96-16" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  sweet: `<circle cx="0" cy="0" r="40" fill="none" stroke="currentColor" stroke-width="7"/><circle cx="-14" cy="-12" r="6" fill="currentColor"/><circle cx="14" cy="-12" r="6" fill="currentColor"/><circle cx="0" cy="18" r="6" fill="currentColor"/>`,
  roll: `<rect x="-30" y="-46" width="60" height="92" rx="30" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-18-30c12 8 24 8 36 0M-18-10c12 8 24 8 36 0M-18 10c12 8 24 8 36 0" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  rice: `<path d="M-52 8h104a52 52 0 0 1-104 0z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-30-2c4-16 14-24 30-24s26 8 30 24" fill="none" stroke="currentColor" stroke-width="6"/><path d="M-44-34l8 8M44-34l-8 8" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>`,
  bread: `<path d="M-50-18c0-18 20-26 50-26s50 8 50 26v40a10 10 0 0 1-10 10h-80a10 10 0 0 1-10-10z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-30-24v46M0-30v52M30-24v46" stroke="currentColor" stroke-width="5" stroke-linecap="round"/>`,
  store: `<path d="M-52-24h104l-10 26h-84z" fill="none" stroke="currentColor" stroke-width="7"/><rect x="-40" y="2" width="80" height="46" rx="6" fill="none" stroke="currentColor" stroke-width="7"/><path d="M-14 48V22h28v26" fill="none" stroke="currentColor" stroke-width="6"/>`,
};

function svg({ w, h, label, sub, palette, glyph, radius = 28 }) {
  const [bg1, bg2, ink] = palette;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" rx="${radius}" fill="url(#g)"/>
  <circle cx="${w * 0.82}" cy="${h * 0.16}" r="${Math.min(w, h) * 0.22}" fill="#ffffff" opacity="0.35"/>
  <circle cx="${w * 0.12}" cy="${h * 0.9}" r="${Math.min(w, h) * 0.16}" fill="#ffffff" opacity="0.3"/>
  <g transform="translate(${w / 2} ${h * 0.44}) scale(${Math.min(w, h) / 190})" color="${ink}">${glyph}</g>
  <text x="${w / 2}" y="${h * 0.85}" text-anchor="middle" font-family="Poppins, Arial, sans-serif" font-size="${Math.round(w * (w > 400 ? 0.09 : 0.075))}" font-weight="800" fill="${ink}" opacity="0.9">${sub}</text>
</svg>`;
}

const restaurants = [
  ['restaurant-domino', "Domino's Pizza", 'DP', 'plate'],
  ['restaurant-ruby', "Ruby's Swader Prantik", 'RS', 'bowl'],
  ['restaurant-dosa', 'Mumbai Dosa Plaza', 'MD', 'dosa'],
  ['restaurant-mistanna', 'Shri Radhakrishna Mistanna', 'SR', 'sweet'],
  ['restaurant-burger', 'Burger King', 'BK', 'burger'],
  ['restaurant-biryani', 'The Biryani Life', 'TB', 'rice'],
  ['restaurant-china', 'China Town', 'CT', 'noodles'],
  ['restaurant-rolls', 'Rolls Mania', 'RM', 'roll'],
];

const categories = [
  ['cat-momos', 'Momos', 'momo'],
  ['cat-noodles', 'Noodles', 'noodles'],
  ['cat-pizza', 'Pizzas', 'pizza'],
  ['cat-biryani', 'Biryani', 'rice'],
  ['cat-rolls', 'Rolls', 'roll'],
  ['cat-burger', 'Burgers', 'burger'],
  ['cat-chinese', 'Chinese', 'noodles'],
  ['cat-south-indian', 'South Indian', 'dosa'],
  ['cat-sweets', 'Sweets', 'sweet'],
  ['cat-beverages', 'Beverages', 'cup'],
];

const dishes = [
  ['dish-pizza', 'Pizza', 'pizza'],
  ['dish-paneer', 'Paneer', 'plate'],
  ['dish-bread', 'Garlic Bread', 'bread'],
  ['dish-cake', 'Choco Lava', 'sweet'],
  ['dish-rice', 'Rice', 'rice'],
  ['dish-curry', 'Curry', 'bowl'],
  ['dish-fish', 'Fish', 'fish'],
  ['dish-chicken', 'Chicken', 'chicken'],
  ['dish-dosa', 'Dosa', 'plate'],
  ['dish-idli', 'Idli', 'plate'],
  ['dish-sweets', 'Sweets', 'sweet'],
  ['dish-burger', 'Burger', 'burger'],
  ['dish-fries', 'Fries', 'bread'],
  ['dish-drink', 'Drink', 'cup'],
  ['dish-noodles', 'Noodles', 'noodles'],
  ['dish-momo', 'Momos', 'momo'],
  ['dish-roll', 'Roll', 'roll'],
  ['dish-soup', 'Soup', 'bowl'],
  ['dish-salad', 'Salad', 'leaf'],
  ['dish-store', '99 Store', 'store'],
];

let n = 0;
const emit = (name, content) => {
  writeFileSync(join(outDir, `${name}.svg`), content);
  n += 1;
};

restaurants.forEach(([name, label, sub, glyph], i) => {
  emit(name, svg({ w: 600, h: 400, label, sub, palette: palettes[i % palettes.length], glyph: glyphs[glyph], radius: 32 }));
});

categories.forEach(([name, label, glyph], i) => {
  emit(name, svg({ w: 220, h: 220, label, sub: label, palette: palettes[(i + 2) % palettes.length], glyph: glyphs[glyph], radius: 110 }));
});

dishes.forEach(([name, label, glyph], i) => {
  emit(name, svg({ w: 320, h: 320, label, sub: label, palette: palettes[(i + 1) % palettes.length], glyph: glyphs[glyph], radius: 36 }));
});

console.log(`Wrote ${n} SVG placeholders to ${outDir}`);
