// IMPORTANT: babel-preset-expo only inlines `process.env.EXPO_PUBLIC_*` when
// accessed as a literal property. Dynamic access (process.env[key]) returns
// undefined in production builds — that broke TestFlight auth on build 962.
// Always reference these as literals here.

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || 'https://tryflowy.app';

const PB_URL =
  process.env.EXPO_PUBLIC_PB_URL || 'https://pb.tryflowy.app';

const R2_PUBLIC_URL =
  process.env.EXPO_PUBLIC_R2_PUBLIC_URL || 'https://files.tryflowy.app';

// RevenueCat PUBLIC iOS SDK key (appl_...). Public by design: it identifies
// the app to RevenueCat and cannot grant entitlement on its own — the server
// webhook is the only writer of subscription state. Empty in builds that do
// not sell (the paywall then reports every plan as unavailable).
const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY || '';

export const ENV = {
  API_BASE_URL,
  PB_URL,
  R2_PUBLIC_URL,
  REVENUECAT_IOS_KEY,
  APP_GROUP: 'group.app.tryflowy',
  AUTH_KEY: 'pb_auth',
} as const;
