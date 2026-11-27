export type NavGlyphName = 'home' | 'history';

/**
 * The two tab glyphs at their exact 19x19 size. Each tab swaps between a filled
 * "active" glyph and an outline "idle" one, like Zomato: the active Home is a
 * coral house with a left chimney and an arched doorway cut-out (one even-odd
 * path, so the doorway is a true hole, not a second colour), the active History
 * is an amber delivery bag whose two detail lines are drawn in the capsule's own
 * charcoal so they stay legible on it. The idle pair is a 1.75px ink outline.
 *
 * `nav-glyph` is kept alongside `bnav-icon` because the tab-change animation
 * targets it (pop / shrink); the sizing itself comes from `svg.bnav-icon`.
 */
const HOUSE_FILLED =
  'M12 3.2c.35 0 .68.12.95.35l7.8 6.55c.56.47.23 1.38-.5 1.38H18.8v7.1c0 1.22-.98 2.2-2.2 2.2H7.4c-1.22 0-2.2-.98-2.2-2.2v-7.1H3.75c-.73 0-1.06-.91-.5-1.38l2.55-2.14V5.3c0-.5.4-.9.9-.9h1.4c.5 0 .9.4.9.9v.38l2.05-1.73c.27-.23.6-.35.95-.35ZM10 20.78v-4.38c0-1.1.9-2 2-2s2 .9 2 2v4.38h-4Z';

const BAG_FLAP = 'M7.2 4.2h9.6l1.2 3.3H6l1.2-3.3Z';
const BAG_BODY = 'M6 7.5h12l.6 11.1c.06 1.15-.85 2.1-2 2.1H7.4c-1.15 0-2.06-.95-2-2.1L6 7.5Z';

const ACTIVE_HOME = '#F15B64';
const ACTIVE_HISTORY = '#F4C150';
const ACTIVE_DETAIL = '#212126';
const IDLE_INK = '#1E1E24';

/** Shared by both idle glyphs: presentation attributes inherit to their paths. */
const IDLE_PAINT = {
  stroke: IDLE_INK,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** The bag's two detail lines, in the capsule's charcoal while it is active. */
const ACTIVE_LINES = {
  stroke: ACTIVE_DETAIL,
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
};

interface NavGlyphProps {
  name: NavGlyphName;
  active: boolean;
}

export function NavGlyph({ name, active }: NavGlyphProps) {
  const state = active ? 'active' : 'idle';
  const idle = active ? {} : IDLE_PAINT;
  const lines = active ? ACTIVE_LINES : {};
  if (name === 'home') {
    return (
      <svg
        className="nav-glyph bnav-icon bnav-icon--home"
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        data-glyph-state={state}
        aria-hidden="true"
        {...idle}
      >
        {active ? (
          <path fillRule="evenodd" clipRule="evenodd" d={HOUSE_FILLED} fill={ACTIVE_HOME} />
        ) : (
          <>
            <path d="M5.2 10.5v7.3a2.3 2.3 0 0 0 2.3 2.3h9a2.3 2.3 0 0 0 2.3-2.3v-7.3" />
            <path d="M3.4 10.7 12 3.8l8.6 6.9" />
            <path d="M7.2 7.7V4.7h2.2v1.2" />
            <path d="M9.6 20.1v-3.9a2.4 2.4 0 0 1 4.8 0v3.9" />
          </>
        )}
      </svg>
    );
  }
  return (
    <svg
      className="nav-glyph bnav-icon bnav-icon--history"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      data-glyph-state={state}
      aria-hidden="true"
      {...idle}
    >
      <path d={BAG_FLAP} fill={active ? ACTIVE_HISTORY : 'none'} />
      <path d={BAG_BODY} fill={active ? ACTIVE_HISTORY : 'none'} />
      <path d="M9 11.5h6" {...lines} />
      <path d="M9 15h4.2" {...lines} />
    </svg>
  );
}
