export type NavGlyphName = 'home' | 'history';

/**
 * Tab glyphs at their crisp 18px size. The house keeps its warm coral fill in
 * both states (it reads on the white pill and inside the charcoal capsule);
 * the receipt is a pure `currentColor` outline, so the active capsule turns it
 * white and the idle pill keeps it dark. Each movable part carries a class so
 * a tab change can animate it (roof lifts, door fades in, bag bounces, handle
 * swings) with transforms only.
 */
const HOUSE_ROOF = 'M3.05 12.55 11.15 4.35a1.2 1.2 0 0 1 1.7 0l8.1 8.2-1.85 1.8L12 7.2 4.9 14.35l-1.85-1.8Z';
const HOUSE_BODY = 'M5.75 12.1h12.5v6.35a2.3 2.3 0 0 1-2.3 2.3H8.05a2.3 2.3 0 0 1-2.3-2.3V12.1Z';
const HOUSE_DOOR = 'M10.2 20.75v-3.15a1.8 1.8 0 0 1 3.6 0v3.15h-3.6Z';

const BAG_BODY =
  'M4.3 10.4a1.6 1.6 0 0 1 1.6-1.6h12.2a1.6 1.6 0 0 1 1.6 1.6v8a2.4 2.4 0 0 1-2.4 2.4H6.7a2.4 2.4 0 0 1-2.4-2.4v-8Z';
const BAG_HANDLE = 'M8.9 9.2V7.7a3.1 3.1 0 0 1 6.2 0v1.5';
const BAG_LINE_ONE = 'M8.8 13.1h6.4';
const BAG_LINE_TWO = 'M8.8 16.4h4.3';

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

interface NavGlyphProps {
  name: NavGlyphName;
  className?: string;
}

export function NavGlyph({ name, className = '' }: NavGlyphProps) {
  return (
    <svg
      className={`nav-glyph ${className}`.trim()}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {name === 'home' ? (
        <>
          <path className="nav-glyph__roof" d={HOUSE_ROOF} fill="#FF6B6B" />
          <path className="nav-glyph__house-body" d={HOUSE_BODY} fill="#F15A64" />
          <path className="nav-glyph__door" d={HOUSE_DOOR} fill="#241014" />
        </>
      ) : (
        <>
          <path className="nav-glyph__bag-body" d={BAG_BODY} {...STROKE} />
          <path className="nav-glyph__handle" d={BAG_HANDLE} {...STROKE} />
          <path className="nav-glyph__lines" d={BAG_LINE_ONE} {...STROKE} />
          <path className="nav-glyph__lines" d={BAG_LINE_TWO} {...STROKE} />
        </>
      )}
    </svg>
  );
}
