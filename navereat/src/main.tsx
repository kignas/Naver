import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';

// StrictMode double-mounts in dev, which prevents AnimatePresence from cleaning
// up exited routes (pages stack up). The app is verified without it.
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />,
);
