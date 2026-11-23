import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import './styles/original/ew-sheet-motion.css';
import './styles/original/ew-sheet.css';
import './styles/original/filter-sheet.css';
import './styles/sheets.css';

const FONT_SPECS = [
  '400 1em Manrope',
  '500 1em Manrope',
  '600 1em Manrope',
  '700 1em Manrope',
  '800 1em Manrope',
  '500 1em Caveat',
  '600 1em Caveat',
  '700 1em Caveat',
];

async function boot() {
  if (typeof document !== 'undefined' && 'fonts' in document) {
    try {
      await Promise.race([
        Promise.all(FONT_SPECS.map((font) => document.fonts.load(font))),
        new Promise((resolve) => window.setTimeout(resolve, 1500)),
      ]);
    } catch {
      /* fall back to the bundled font files */
    }
  }
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
}

void boot();
