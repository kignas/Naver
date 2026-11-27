// Home's header backdrop is --home-hero-blue (home-final.css --hd-primary), the
// same blue as the hero banner, so the non-overlay status bar has to match it.
export const HEADER_HOME = '#0A3FA8';
export const HEADER_LOGIN_YELLOW = '#FFD92F';
export const HEADER_WHITE = '#FFFFFF';
// Rendered top-left of the 99 Store hero gradient (hd-primary -> hd-active at
// 150deg). The status bar is non-overlay, so it has to match that edge.
export const HEADER_U99 = '#B73950';

export interface StatusBarTheme {
  color: string;
  lightIcons: boolean;
}

/**
 * The Android status bar is non-overlay, so it must match the top edge of the
 * route header exactly. Home's header is the oxblood theme from
 * home-final.css; Login's hero is yellow; the remaining app bars are white.
 */
export function statusBarTheme(pathname: string): StatusBarTheme {
  if (pathname === '/') return { color: HEADER_HOME, lightIcons: true };
  if (pathname === '/login') return { color: HEADER_LOGIN_YELLOW, lightIcons: false };
  if (pathname === '/under99') return { color: HEADER_U99, lightIcons: true };
  return { color: HEADER_WHITE, lightIcons: false };
}

/** Capacitor's enum is inverted: Style.Dark = light icons, Style.Light = dark icons. */
export function statusBarStyle(theme: StatusBarTheme): 'Dark' | 'Light' {
  return theme.lightIcons ? 'Dark' : 'Light';
}
