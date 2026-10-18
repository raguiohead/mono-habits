import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raguiohead.monohabits',
  appName: 'MONO // HABITS',
  webDir: 'dist',
  backgroundColor: '#000000',
  server: {
    // androidScheme 'https' garante que o app rode em um contexto seguro (https://localhost) no WebView, viabilizando Web APIs modernas, cookies seguros e Auth
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#000000',
  },
  plugins: {
    StatusBar: {
      backgroundColor: '#000000',
      style: 'DARK',
      overlaysWebView: false,
    },
    SplashScreen: {
      backgroundColor: '#000000',
      launchShowDuration: 1000,
      showSpinner: false,
    },
    LocalNotifications: {
      iconColor: '#FFFFFF',
    },
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['google.com'],
    },
    // No Android 15+ (targetSdk 36) edge-to-edge é obrigatório; SystemBars injeta insets via CSS e define viewport-fit cover para evitar quebras visuais
    SystemBars: {
      insetsHandling: 'css',
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
