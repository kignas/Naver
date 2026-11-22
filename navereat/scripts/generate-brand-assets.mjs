import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const OUT = path.resolve('assets');
const ORANGE = '#FC8019';
const CREAM = '#FFF7F0';

const nPath = (stroke = 150) =>
  `<path d="M355 720 V304 L669 720 V304" fill="none" stroke="${ORANGE}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round"/>`;

const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="220" fill="#ffffff"/>
  ${nPath(150)}
</svg>`;

const foregroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(512 512) scale(1.5) translate(-512 -512)">
    ${nPath(140)}
  </g>
</svg>`;

const backgroundSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#ffffff"/>
</svg>`;

const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#ffffff"/>
  <g transform="translate(1366 1366) scale(1.9) translate(-512 -512)">
    ${nPath(150)}
  </g>
</svg>`;

const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="220" fill="${ORANGE}"/>
  <path d="M355 720 V304 L669 720 V304" fill="none" stroke="#ffffff" stroke-width="150" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

await mkdir(OUT, { recursive: true });
await mkdir(path.resolve('public'), { recursive: true });

const render = async (svg, file, size) => {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(path.join(OUT, file));
};

await render(iconSvg, 'icon-only.png', 1024);
await render(foregroundSvg, 'icon-foreground.png', 1024);
await render(backgroundSvg, 'icon-background.png', 1024);
await sharp(Buffer.from(splashSvg)).png().toFile(path.join(OUT, 'splash.png'));
await writeFile(path.resolve('public/favicon.svg'), faviconSvg);
await sharp(Buffer.from(iconSvg)).resize(192, 192).png().toFile(path.resolve('public/icon-192.png'));

console.log('Brand assets written to assets/ and public/');
