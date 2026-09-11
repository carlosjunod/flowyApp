import type { ConfigContext, ExpoConfig } from 'expo/config';

const BUNDLE_ID = 'app.tryflowy.client';
const APP_GROUP = 'group.app.tryflowy';
const ASSOCIATED_DOMAIN = 'applinks:tryflowy.app';
const APPLE_TEAM_ID = '8C72ST495F';
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
if (googleIosClientId && !/^[0-9]+-[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(googleIosClientId)) {
  throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID must be a Google OAuth client ID for iOS.');
}
const googleIosUrlScheme = googleIosClientId?.split('.').reverse().join('.');

const EAS_PROJECT_ID = '8e5e98ee-1773-456a-8ba6-4e552a350368';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Flowy',
  slug: 'tryflowy',
  scheme: 'tryflowy',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './icons/icon-1024.png',
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
    // EAS file variable, or a local path supplied for a native Android build.
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON,
    adaptiveIcon: {
      foregroundImage: './icons/adaptive-icon-1024.png',
      backgroundColor: '#ffffff',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    favicon: './icons/favicon-48.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    '@react-native-community/datetimepicker',
    'expo-secure-store',
    ['expo-notifications', { defaultChannel: 'default' }],
    'expo-apple-authentication',
    ...(googleIosUrlScheme ? [[
      '@react-native-google-signin/google-signin',
      { iosUrlScheme: googleIosUrlScheme },
    ] as [string, { iosUrlScheme: string }]] : []),
    'expo-video',
    [
      'expo-share-intent',
      {
        // iOS has a purpose-built extension with its own save/status UI. This
        // plugin only owns Android's ACTION_SEND/ACTION_SEND_MULTIPLE entrypoints.
        disableIOS: true,
        androidIntentFilters: ['text/*', 'image/*', 'video/*', 'application/pdf', '*/*'],
        androidMultiIntentFilters: ['image/*', 'video/*', 'application/pdf', '*/*'],
      },
    ],
    './plugins/withShareExtension',
    './plugins/withPodfileSigningFix',
    './plugins/withAdaptiveOrientation',
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
