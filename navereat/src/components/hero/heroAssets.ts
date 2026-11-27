/**
 * Every hero photo import lives here so swapping art is a one-file change.
 *
 * The WebP files sit next to the original PNGs in /assets: 600px wide, quality 80,
 * transparency kept (600x448 and 600x614). `width`/`height` below are the intrinsic
 * size so the browser reserves the right space.
 */
import brassTumblerSrc from '../../../assets/file_000000004ac481fab220c1021f89a1b1.webp';
import idliTraySrc from '../../../assets/file_000000004a68820aaaf9274c709c91b3.webp';
import chaiMugSrc from '../../../assets/file_000000004904820a8e258c5ad31faa61.webp';
import pohaPlateSrc from '../../../assets/file_000000004cfc820abfc6167ff37fd855.webp';
import paperCupSrc from '../../../assets/file_00000000d2f0820aa9bec0ee8d153c0e.webp';

export interface HeroDish {
  src: string;
  /** Intrinsic width of the WebP in CSS px. */
  width: number;
  /** Intrinsic height of the WebP in CSS px. */
  height: number;
  alt: string;
}

const displayBox = (sourceWidth: number, sourceHeight: number): Pick<HeroDish, 'width' | 'height'> => ({
  width: 600,
  height: Math.round((600 * sourceHeight) / sourceWidth),
});

export const HERO_DISHES = {
  /** Blue ceramic mug of chai — file_000000004904820a8e258c5ad31faa61.webp */
  chaiMug: {
    src: chaiMugSrc,
    ...displayBox(1451, 1084),
    alt: 'Blue ceramic mug of chai',
  },
  /** Idli + vada tray with sambar and chutney — file_000000004a68820aaaf9274c709c91b3.webp */
  idliTray: {
    src: idliTraySrc,
    ...displayBox(1451, 1084),
    alt: 'Idli and vada tray with sambar and chutney',
  },
  /** Blue paper cup of chai with steam — file_00000000d2f0820aa9bec0ee8d153c0e.webp */
  paperCup: {
    src: paperCupSrc,
    ...displayBox(1240, 1269),
    alt: 'Blue paper cup of steaming chai',
  },
  /** Poha plate with sev, pomegranate and lemon — file_000000004cfc820abfc6167ff37fd855.webp */
  pohaPlate: {
    src: pohaPlateSrc,
    ...displayBox(1451, 1084),
    alt: 'Poha plate with sev, pomegranate and lemon',
  },
  /** Brass tumbler and dabara of filter coffee with steam — file_000000004ac481fab220c1021f89a1b1.webp */
  brassTumbler: {
    src: brassTumblerSrc,
    ...displayBox(1451, 1084),
    alt: 'Brass tumbler and dabara of filter coffee',
  },
} satisfies Record<string, HeroDish>;

export type HeroDishId = keyof typeof HERO_DISHES;
