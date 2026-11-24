/**
 * Tactile feedback for the Android shell.
 *
 * `navigator.vibrate` is the platform path the WebView already exposes (the
 * manifest requests VIBRATE); browsers without it, and desktop, fall through to
 * a no-op. Haptics are a nicety, never a precondition for the tap to work.
 */
export function tapHaptic(durationMs = 8): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    navigator.vibrate(durationMs);
  } catch {
    /* vibration is optional */
  }
}
