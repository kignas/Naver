export const HEADER_BURGUNDY = '#5D0D18';
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
 * route header exactly. Home's header is the oxblood override from
 * home-final.css; Login's hero is yellow; the remaining app bars are white.
 */
export function statusBarTheme(pathname: string): StatusBarTheme {
  if (pathname === '/') return { color: HEADER_BURGUNDY, lightIcons: true };
  if (pathname === '/login') return { color: HEADER_LOGIN_YELLOW, lightIcons: false };
  if (pathname === '/under99') return { color: HEADER_U99, lightIcons: true };
  return { color: HEADER_WHITE, lightIcons: false };
}

/** Capacitor's enum is inverted: Style.Dark = light icons, Style.Light = dark icons. */
export function statusBarStyle(theme: StatusBarTheme): 'Dark' | 'Light' {
  return theme.lightIcons ? 'Dark' : 'Light';
}
