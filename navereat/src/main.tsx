import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/manrope/700.css';
import '@fontsource/manrope/800.css';
import '@fontsource/caveat/500.css';
import '@fontsource/caveat/600.css';
import '@fontsource/caveat/700.css';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// StrictMode double-mounts in dev, which prevents AnimatePresence from cleaning
// up exited routes (pages stack up). The app is verified without it.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />,
);
