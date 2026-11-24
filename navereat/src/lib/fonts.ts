/**
 * Bundled font priming.
 *
 * Every face declared in styles/fonts.css is loaded before a route is laid out,
 * so a face can never arrive after first paint and reflow text (that is the
 * "layout shift sometimes, on real devices" class of bug: the fallback face is
 * wider, so a label wraps to two lines and every sibling below it moves when
 * the real face swaps in).
 */
type FontFaceSetLike = {
  load: (font: string) => Promise<unknown>;
  ready?: Promise<unknown>;
  forEach: (callback: (face: FontFace) => void) => void;
};

const FALLBACK_SPECS = [
  '400 1em Manrope',
  '500 1em Manrope',
  '600 1em Manrope',
  '700 1em Manrope',
  '800 1em Manrope',
  '500 1em Caveat',
  '600 1em Caveat',
  '700 1em Caveat',
  '400 1em Poppins',
  '500 1em Poppins',
  '600 1em Poppins',
  '700 1em Poppins',
  '800 1em Poppins',
  '900 1em Poppins',
];

const fontSet = (): FontFaceSetLike | null => {
  if (typeof document === 'undefined' || !('fonts' in document)) return null;
  return document.fonts as unknown as FontFaceSetLike;
};

/** One spec per declared face, derived from the CSS (not a hand-kept list). */
export function fontSpecs(): string[] {
  const set = fontSet();
  if (!set) return FALLBACK_SPECS;
  const specs = new Set<string>();
  set.forEach((face) => {
    const family = /[\s'"]/.test(face.family) ? `"${face.family.replace(/["']/g, '')}"` : face.family;
    specs.add(`${face.style || 'normal'} ${face.weight || '400'} 1em ${family}`);
  });
  return specs.size ? [...specs] : FALLBACK_SPECS;
}

let priming: Promise<void> | null = null;

/** Loads every bundled face once; safe to call from anywhere. */
export function primeFonts(): Promise<void> {
  if (priming) return priming;
  const set = fontSet();
  if (!set) {
    priming = Promise.resolve();
    return priming;
  }
  priming = Promise.allSettled(fontSpecs().map((spec) => set.load(spec))).then(() => undefined);
  return priming;
}

/** Resolves when the bundled faces are in (or the budget is up). */
export function fontsReady(maxMs = 400): Promise<void> {
  return Promise.race([primeFonts(), new Promise<void>((resolve) => window.setTimeout(resolve, maxMs))]);
}
