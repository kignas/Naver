export type NavGlyphName = 'home' | 'history';

/**
 * The two tab glyphs at their exact 20×20 size. The house is a single even-odd
 * path, so the arched doorway is a true cut-out (no second colour to bleed on
 * the charcoal capsule); the receipt is a `currentColor` outline, so it turns
 * white on the active capsule and stays ink-dark on the white pill.
 *
 * `nav-glyph` is kept alongside `bnav-icon` because the tab-change animation
 * targets it (pop / shrink); the sizing itself comes from `svg.bnav-icon`.
 */
const HOUSE =
  'M12 3.2c.35 0 .68.12.95.35l7.8 6.55c.56.47.23 1.38-.5 1.38H18.8v7.1c0 1.22-.98 2.2-2.2 2.2H7.4c-1.22 0-2.2-.98-2.2-2.2v-7.1H3.75c-.73 0-1.06-.91-.5-1.38l2.55-2.14V5.3c0-.5.4-.9.9-.9h1.4c.5 0 .9.4.9.9v.38l2.05-1.73c.27-.23.6-.35.95-.35ZM10 20.78v-4.38c0-1.1.9-2 2-2s2 .9 2 2v4.38h-4Z';

interface NavGlyphProps {
  name: NavGlyphName;
}

export function NavGlyph({ name }: NavGlyphProps) {
  if (name === 'home') {
    return (
      <svg
        className="nav-glyph bnav-icon bnav-icon--home"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d={HOUSE}
          fill="#F06464"
        />
      </svg>
    );
  }
  return (
    <svg
      className="nav-glyph bnav-icon bnav-icon--history"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7.2 4.2h9.6l1.2 3.3H6l1.2-3.3Z" />
      <path d="M6 7.5h12l.6 11.1c.06 1.15-.85 2.1-2 2.1H7.4c-1.15 0-2.06-.95-2-2.1L6 7.5Z" />
      <path d="M9 11.5h6" />
      <path d="M9 15h4.2" />
    </svg>
  );
}
