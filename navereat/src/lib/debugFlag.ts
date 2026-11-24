/** Where the field debug panel keeps its on/off flag (survives relaunches). */
export const DEBUG_STORAGE_KEY = 'nbp-debug';
export const DEBUG_EVENT = 'nbp:debug-changed';

export const debugWanted = (): boolean => {
  try {
    if (window.localStorage.getItem(DEBUG_STORAGE_KEY) === '1') return true;
    if (new URLSearchParams(window.location.search).get('debug') === '1') return true;
    return window.location.hash.includes('debug=1');
  } catch {
    return false;
  }
};

export const setDebugEnabled = (on: boolean): void => {
  try {
    if (on) window.localStorage.setItem(DEBUG_STORAGE_KEY, '1');
    else window.localStorage.removeItem(DEBUG_STORAGE_KEY);
  } catch {
    /* storage may be unavailable */
  }
  window.dispatchEvent(new CustomEvent(DEBUG_EVENT, { detail: on }));
};
