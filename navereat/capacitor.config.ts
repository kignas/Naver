import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navereat.app',
  appName: 'Navereat',
  webDir: 'dist',
  backgroundColor: '#ffffff',
  android: { allowMixedContent: false, captureInput: true },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: false,
      backgroundColor: '#ffffff',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#ffffff',
      overlaysWebView: false,
    },
  },
};

export default config;
