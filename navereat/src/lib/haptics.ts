/**
 * Tactile feedback for the Android shell.
 *
 * The tab bar uses a Capacitor light impact (the native generator on Android);
 * in a browser the WebView's `navigator.vibrate` is the path. Haptics are a
 * nicety, never a precondition for the tap to work, so every failure is
 * swallowed.
 */
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

/** One switch for every haptic call in the app. */
export const HAPTICS_ENABLED = true;

/** Two impacts closer together than this are one event. */
const THROTTLE_MS = 80;

let lastImpactAt = Number.NEGATIVE_INFINITY;
let impactCount = 0;

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

/**
 * Light impact, at most one per {@link THROTTLE_MS}. Returns true when the
 * event was delivered; the debug panel and the gates count these.
 */
export function lightImpact(): boolean {
  if (!HAPTICS_ENABLED) return false;
  const at = now();
  if (at - lastImpactAt < THROTTLE_MS) return false;
  lastImpactAt = at;
  impactCount += 1;
  try {
    if (Capacitor.isNativePlatform()) {
      void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
    } else if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(8);
    }
  } catch {
    /* vibration is optional */
  }
  return true;
}

/** How many impacts have been delivered since the app started. */
export function hapticCount(): number {
  return impactCount;
}

/**
 * Press feedback for the quantity steppers and the veg toggle. Same platform
 * path as before, kept separate so an explicit duration still means something.
 */
export function tapHaptic(durationMs = 8): void {
  if (!HAPTICS_ENABLED) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    /* vibration is optional */
  }
}
