import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.navereat.app',
  appName: 'Navereat',
  webDir: 'dist',
  backgroundColor: '#9E1535',
  android: { allowMixedContent: false, captureInput: true },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: false,
      backgroundColor: '#9E1535',
      showSpinner: false,
      splashFullScreen: false,
      splashImmersive: false,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#9E1535',
      overlaysWebView: false,
    },
  },
};

export default config;
