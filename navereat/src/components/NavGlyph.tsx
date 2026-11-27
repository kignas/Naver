import type { ReactNode } from 'react';

export type NavGlyphName = 'home' | 'history';

/**
 * The two tab glyphs as two stacked 20x20 layers so the tab sequence can
 * cross-fade them instead of swapping one icon for another:
 *
 *   --outline  the idle ink outline
 *   --filled   the brand-coloured solid glyph (hidden until its tab is active)
 *
 * A white copy of the outline is exported separately for the pill's clipped
 * track, where the labels and icons whiten as the pill sweeps over them.
 *
 * The active Home is a coral house with a left chimney and an arched doorway
 * cut-out (one even-odd path, so the doorway is a true hole), the active
 * History is an amber delivery bag whose two detail lines are drawn in the
 * pill's charcoal so they stay legible on it. Colours come from the stylesheet
 * (`stroke` is inherited from the svg, so the white copy is a class swap).
 */
const HOUSE_OUTLINE = (
  <>
    <path d="M5.2 10.5v7.3a2.3 2.3 0 0 0 2.3 2.3h9a2.3 2.3 0 0 0 2.3-2.3v-7.3" />
    <path d="M3.4 10.7 12 3.8l8.6 6.9" />
    <path d="M7.2 7.7V4.7h2.2v1.2" />
    <path d="M9.6 20.1v-3.9a2.4 2.4 0 0 1 4.8 0v3.9" />
  </>
);

const HOUSE_FILLED_PATH =
  'M12 3.2c.35 0 .68.12.95.35l7.8 6.55c.56.47.23 1.38-.5 1.38H18.8v7.1c0 1.22-.98 2.2-2.2 2.2H7.4c-1.22 0-2.2-.98-2.2-2.2v-7.1H3.75c-.73 0-1.06-.91-.5-1.38l2.55-2.14V5.3c0-.5.4-.9.9-.9h1.4c.5 0 .9.4.9.9v.38l2.05-1.73c.27-.23.6-.35.95-.35ZM10 20.78v-4.38c0-1.1.9-2 2-2s2 .9 2 2v4.38h-4Z';

const BAG_FLAP = 'M7.2 4.2h9.6l1.2 3.3H6l1.2-3.3Z';
const BAG_BODY = 'M6 7.5h12l.6 11.1c.06 1.15-.85 2.1-2 2.1H7.4c-1.15 0-2.06-.95-2-2.1L6 7.5Z';

const HISTORY_OUTLINE = (
  <>
    <path d={BAG_FLAP} />
    <path d={BAG_BODY} />
    <path d="M9 11.5h6" />
    <path d="M9 15h4.2" />
  </>
);

/**
 * Each glyph's viewBox is cropped to the union of its layers' ink (getBBox,
 * plus half a stroke on the outlined copy), so the SVG box IS the visible
 * drawing instead of a 36k square with ~30% empty padding. The artwork's own
 * proportions set the box: at 1080px the History bag draws 35k wide x 43.13k
 * tall, the house 41k x 39.45k.
 *
 * `stroke` is in the cropped viewBox's units, chosen so the rendered stroke is
 * 2.4k on both glyphs (2.4k x viewBoxWidth / boxWidthK).
 */
interface GlyphBox {
  viewBox: string;
  stroke: number;
}

const GLYPH_BOX: Record<NavGlyphName, GlyphBox> = {
  home: { viewBox: '2.865 3.2 18.27 17.58', stroke: 1.07 },
  history: { viewBox: '4.911 3.714 14.178 17.472', stroke: 0.972 },
};

const ACTIVE_HOME = '#F15B64';
const ACTIVE_HISTORY = '#F4C150';
const ACTIVE_DETAIL = '#212126';

const HOUSE_FILLED = (
  <path fillRule="evenodd" clipRule="evenodd" d={HOUSE_FILLED_PATH} fill={ACTIVE_HOME} />
);

const HISTORY_FILLED = (
  <>
    <path d={BAG_FLAP} fill={ACTIVE_HISTORY} />
    <path d={BAG_BODY} fill={ACTIVE_HISTORY} />
    <path d="M9 11.5h6" stroke={ACTIVE_DETAIL} />
    <path d="M9 15h4.2" stroke={ACTIVE_DETAIL} />
  </>
);

/** Shared by the outline copies: presentation attributes inherit to their paths. */
const OUTLINE_PAINT = {
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

interface NavGlyphProps {
  name: NavGlyphName;
}

/** Ink outline + brand-filled glyph, stacked so the tab can cross-fade them. */
export function NavGlyph({ name }: NavGlyphProps) {
  const outline: ReactNode = name === 'home' ? HOUSE_OUTLINE : HISTORY_OUTLINE;
  const filled: ReactNode = name === 'home' ? HOUSE_FILLED : HISTORY_FILLED;
  const box = GLYPH_BOX[name];
  return (
    <span className="nav-glyph-stack">
      <svg
        className="nav-glyph bnav-icon nav-glyph--outline"
        width="20"
        height="20"
        viewBox={box.viewBox}
        fill="none"
        aria-hidden="true"
        strokeWidth={box.stroke}
        {...OUTLINE_PAINT}
      >
        {outline}
      </svg>
      <svg
        className="nav-glyph bnav-icon nav-glyph--filled"
        width="20"
        height="20"
        viewBox={box.viewBox}
        fill="none"
        strokeWidth={box.stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {filled}
      </svg>
    </span>
  );
}

/** The same outline in white, for the pill's clipped label/icon track. */
export function NavGlyphOutline({ name }: NavGlyphProps) {
  const box = GLYPH_BOX[name];
  return (
    <svg
      className="nav-glyph bnav-icon nav-glyph--white"
      width="20"
      height="20"
      viewBox={box.viewBox}
      fill="none"
      aria-hidden="true"
      strokeWidth={box.stroke}
      {...OUTLINE_PAINT}
    >
      {name === 'home' ? HOUSE_OUTLINE : HISTORY_OUTLINE}
    </svg>
  );
}
