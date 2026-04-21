const required = (key: string, fallback?: string): string => {
  const value = process.env[key] ?? fallback;
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const ENV = {
  API_BASE_URL: required('EXPO_PUBLIC_API_BASE_URL', 'http://localhost:4000'),
  PB_URL: required('EXPO_PUBLIC_PB_URL', 'http://localhost:8090'),
  R2_PUBLIC_URL: required('EXPO_PUBLIC_R2_PUBLIC_URL', 'https://files.tryflowy.app'),
  APP_GROUP: 'group.app.tryflowy',
  AUTH_KEY: 'pb_auth',
} as const;
