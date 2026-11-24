import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/original/ew-sheet-motion.css';
import './styles/original/ew-sheet.css';
import './styles/original/filter-sheet.css';
import './styles/sheets.css';
import { primeFonts } from './lib/fonts';

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
