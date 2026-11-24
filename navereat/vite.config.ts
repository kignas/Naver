import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  server: { host: '0.0.0.0', port: 5173, allowedHosts: ['.prod-runtime.all-hands.dev'] },
  build: {
    outDir: 'dist',
    // Every WebView Capacitor 6 runs on is Chrome 80+, so es2020 needs no downlevel pass.
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
  },
});
