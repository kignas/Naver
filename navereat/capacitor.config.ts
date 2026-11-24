import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navereat.app',
  appName: 'Navereat',
  webDir: 'dist',
  backgroundColor: '#5D0D18',
  android: { allowMixedContent: false, captureInput: true },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: false,
      backgroundColor: '#5D0D18',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
      androidScaleType: 'CENTER_CROP',
      // Hide is driven by the shell's first paint; the fade keeps the handoff
      // from looking like a cut between two different windows.
      fadeOutDuration: 120,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#5D0D18',
      overlaysWebView: false,
    },
  },
};

export default config;
