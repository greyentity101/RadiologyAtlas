import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.radiologyatlas.app',
  appName: 'Radiology Atlas',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
