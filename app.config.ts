import type { ConfigContext, ExpoConfig } from 'expo/config';

const BUNDLE_ID = 'app.tryflowy.client';
const APP_GROUP = 'group.app.tryflowy';
const ASSOCIATED_DOMAIN = 'applinks:tryflowy.app';
const APPLE_TEAM_ID = '8C72ST495F';
const EAS_PROJECT_ID = '8e5e98ee-1773-456a-8ba6-4e552a350368';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Flowy',
  slug: 'tryflowy',
  scheme: 'tryflowy',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F8F4EA',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: BUNDLE_ID,
    usesAppleSignIn: true,
    associatedDomains: [ASSOCIATED_DOMAIN],
    entitlements: {
      'com.apple.security.application-groups': [APP_GROUP],
      'keychain-access-groups': [`$(AppIdentifierPrefix)${APP_GROUP}`],
    },
    infoPlist: {
      NSAppTransportSecurity: {
        NSAllowsLocalNetworking: true,
      },
      ITSAppUsesNonExemptEncryption: false,
    },
    appleTeamId: APPLE_TEAM_ID,
  },
  android: {
    package: BUNDLE_ID,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    './plugins/withShareExtension',
    './plugins/withPodfileSigningFix',
  ],
  experiments: {
    typedRoutes: true,
  },
  extra: {
    router: {},
    eas: {
      projectId: EAS_PROJECT_ID,
      build: {
        experimental: {
          ios: {
            appExtensions: [
              {
                targetName: 'ShareExtension',
                bundleIdentifier: `${BUNDLE_ID}.ShareExtension`,
                entitlements: {
                  'com.apple.security.application-groups': [APP_GROUP],
                },
              },
            ],
          },
        },
      },
    },
  },
});
