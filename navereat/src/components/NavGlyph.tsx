import { useId } from 'react';

export type NavGlyphName = 'home' | 'history';

/**
 * Original two-tone tab glyphs. Each glyph stacks an outline layer (inactive)
 * and a gradient layer (active) so the state swap is a cross-fade, and each
 * movable part carries its own class so the tab-change animation can move it
 * (roof lifts, door fades in, bag body bounces, handle swings) with transforms
 * only.
 */
const HOUSE_OUTLINE = [
  'M3.15 12.15 11.3 3.95a1 1 0 0 1 1.4 0l8.15 8.2',
  'M5.6 11.4v7.05a2.15 2.15 0 0 0 2.15 2.15h8.5a2.15 2.15 0 0 0 2.15-2.15V11.4',
  'M10.15 20.6v-3.35a1.85 1.85 0 0 1 3.7 0v3.35',
];

const HOUSE_ROOF = 'M3.05 12.55 11.15 4.35a1.2 1.2 0 0 1 1.7 0l8.1 8.2-1.85 1.8L12 7.2 4.9 14.35l-1.85-1.8Z';
const HOUSE_BODY = 'M5.75 12.1h12.5v6.35a2.3 2.3 0 0 1-2.3 2.3H8.05a2.3 2.3 0 0 1-2.3-2.3V12.1Z';
const HOUSE_DOOR = 'M10.2 20.75v-3.15a1.8 1.8 0 0 1 3.6 0v3.15h-3.6Z';

const BAG_OUTLINE = [
  'M4.3 10.4a1.6 1.6 0 0 1 1.6-1.6h12.2a1.6 1.6 0 0 1 1.6 1.6v8a2.4 2.4 0 0 1-2.4 2.4H6.7a2.4 2.4 0 0 1-2.4-2.4v-8Z',
  'M8.9 9.2V7.7a3.1 3.1 0 0 1 6.2 0v1.5',
  'M8.8 13.1h6.4',
  'M8.8 16.4h4.3',
];

const BAG_BODY = 'M4.3 10.4a1.6 1.6 0 0 1 1.6-1.6h12.2a1.6 1.6 0 0 1 1.6 1.6v8a2.4 2.4 0 0 1-2.4 2.4H6.7a2.4 2.4 0 0 1-2.4-2.4v-8Z';
const BAG_HANDLE = 'M8.9 9.2V7.7a3.1 3.1 0 0 1 6.2 0v1.5';

interface NavGlyphProps {
  name: NavGlyphName;
  className?: string;
}

export function NavGlyph({ name, className = '' }: NavGlyphProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const warm = `navWarm${uid}`;
  const gold = `navGold${uid}`;
  return (
    <svg className={`nav-glyph ${className}`.trim()} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={warm} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FF9A6B" />
          <stop offset="0.55" stopColor="#FB5A45" />
          <stop offset="1" stopColor="#E8262B" />
        </linearGradient>
        <linearGradient id={gold} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0" stopColor="#FFD36B" />
          <stop offset="0.55" stopColor="#FFB02E" />
          <stop offset="1" stopColor="#EE8B0C" />
        </linearGradient>
      </defs>
      {name === 'home' ? (
        <>
          <g className="nav-glyph__outline" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path className="nav-glyph__roof" d={HOUSE_OUTLINE[0]} />
            <path className="nav-glyph__house-body" d={HOUSE_OUTLINE[1]} />
            <path className="nav-glyph__door" d={HOUSE_OUTLINE[2]} />
          </g>
          <g className="nav-glyph__active">
            <g className="nav-glyph__roof">
              <path d={HOUSE_ROOF} fill={`url(#${warm})`} />
              <path d="M6.1 11.5 11.4 6.2" stroke="#FFFFFF" strokeOpacity="0.42" strokeWidth="1.1" strokeLinecap="round" fill="none" />
            </g>
            <path className="nav-glyph__house-body" d={HOUSE_BODY} fill={`url(#${warm})`} />
            <path className="nav-glyph__door" d={HOUSE_DOOR} fill="#FFE7DF" />
          </g>
        </>
      ) : (
        <>
          <g className="nav-glyph__outline" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path className="nav-glyph__bag-body" d={BAG_OUTLINE[0]} />
            <path className="nav-glyph__handle" d={BAG_OUTLINE[1]} />
            <path className="nav-glyph__lines" d={BAG_OUTLINE[2]} />
            <path className="nav-glyph__lines" d={BAG_OUTLINE[3]} />
          </g>
          <g className="nav-glyph__active">
            <path className="nav-glyph__bag-body" d={BAG_BODY} fill={`url(#${gold})`} />
            <path
              className="nav-glyph__handle"
              d={BAG_HANDLE}
              fill="none"
              stroke={`url(#${gold})`}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path className="nav-glyph__lines" d={BAG_OUTLINE[2]} stroke="#FF6B4A" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <path className="nav-glyph__lines" d={BAG_OUTLINE[3]} stroke="#FF6B4A" strokeWidth="1.7" strokeLinecap="round" fill="none" />
            <path d="M6.1 10.2a1.2 1.2 0 0 1 1.2-1.2h9.4" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="1.1" strokeLinecap="round" fill="none" />
          </g>
        </>
      )}
    </svg>
  );
}
