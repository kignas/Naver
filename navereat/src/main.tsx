import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/original/ew-sheet-motion.css';
import './styles/original/ew-sheet.css';
import './styles/original/filter-sheet.css';
import './styles/sheets.css';
import { primeFonts } from './lib/fonts';
import { installViewportVars } from './lib/viewport';

// Same first-paint theme the reference applies from an inline head script: the
// only header family it ships is raspberry, and the page theme is light/dark.
try {
  const theme = localStorage.getItem('eatswada_theme') === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.ewTheme = theme;
  document.documentElement.style.colorScheme = theme;
  document.documentElement.dataset.ewHeader = 'raspberry';
} catch {
  document.documentElement.dataset.ewHeader = 'raspberry';
}

installViewportVars();

async function boot() {
  // Text must never reflow after the first paint: every bundled face (Manrope,
  // Caveat and the Poppins faces the detail pages use) is loaded before React
  // renders, with a budget so a slow network still gets a first frame.
  try {
    await Promise.race([
      primeFonts(),
      new Promise((resolve) => window.setTimeout(resolve, 1500)),
    ]);
  } catch {
    /* fall back to the bundled font files */
  }
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
}

void boot();
