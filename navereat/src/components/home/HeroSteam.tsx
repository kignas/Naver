import type { CSSProperties } from 'react';

const WISPS = [
  { d: 'M 15 54 C 8 42 22 34 14 22 C 9 13 18 5 22 0', delay: 0, drift: 3 },
  { d: 'M 33 56 C 25 43 40 35 31 22 C 26 13 35 6 39 1', delay: 1.1, drift: -4 },
  { d: 'M 51 54 C 44 42 58 34 50 22 C 45 13 54 5 58 0', delay: 2.2, drift: 3.5 },
];

// Held back until the mug has landed, so steam never rises from an empty arch.
const STEAM_START_S = 0.7;

/**
 * Three hand-authored steam wisps over the chai mug: inline SVG, no Lottie
 * payload. CSS drives the rise/wave so the whole loop is composited and stops
 * with `animation-play-state` when the banner is held (`is-paused`).
 */
export function HeroSteam() {
  return (
    <svg className="nv-hero-steam" viewBox="0 0 74 58" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="nv-steam-gradient" x1="0" y1="58" x2="0" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="0.55" stopColor="#F2F8FF" stopOpacity="0.6" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {WISPS.map((wisp, index) => (
        <path
          key={wisp.d}
          d={wisp.d}
          className="nv-hero-steam-wisp"
          data-wisp={index}
          style={
            {
              animationDelay: `${STEAM_START_S + wisp.delay}s`,
              '--nv-steam-drift': `${wisp.drift}px`,
            } as CSSProperties
          }
        />
      ))}
    </svg>
  );
}
