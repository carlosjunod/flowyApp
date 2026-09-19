/**
 * Sign in, sign up and the social-provider buttons.
 *
 * Server error *codes* (`EMAIL_TAKEN`, `INVALID_APPLE_TOKEN`, …) are part of the
 * API contract and are never translated — only the human sentence each code maps
 * to lives here, keyed by the code itself.
 */
export const auth = {
  login: {
    subtitle: 'Sign in to your inbox',
    submit: 'Sign in',
    submitting: 'Signing in…',
    noAccount: 'No account?',
    createOne: 'Create one',
    missingCredentials: 'Email and password are required',
    googleUnavailable: 'Google sign-in is being set up — use email for now.',
  },
  signup: {
    title: 'Create account',
    subtitle: 'Join Flowy',
    submit: 'Create account',
    submitting: 'Creating account…',
    haveAccount: 'Already have an account?',
    signIn: 'Sign in',
    missingCredentials: 'Email and password are required',
    passwordTooShort: 'Password must be at least 8 characters',
    passwordMismatch: 'Passwords do not match',
    termsRequired: 'Please accept the Terms of Service and Privacy Policy to create an account.',
    consentRequired: 'Please accept the AI processing disclosure to create an account.',
    failed: 'Could not create account. Please try again.',
  },
  fields: {
    email: 'Email',
    password: 'Password',
    passwordMin: 'Password (min 8 chars)',
    confirmPassword: 'Confirm password',
  },
  consent: {
    modalTitle: 'Create your Flowy account',
    modalBody: 'One more step before creating your account with {provider}.',
    modalAi: 'I agree that Flowy may send my saved content and chat requests to Anthropic, OpenAI, and Voyage AI to summarize, transcribe, search, and answer questions.',
    accept: 'Create account',
    cancel: 'Cancel',
    termsLabel: 'Accept Terms of Service and Privacy Policy',
    terms: 'I agree to the Terms of Service and Privacy Policy.',
    termsLink: 'Terms of Service',
    privacyLink: 'Privacy Policy',
    aiLabel: 'Accept AI processing',
    ai: 'I agree that Flowy may send the content I save and my chat requests to Anthropic, OpenAI, and Voyage AI to summarize, transcribe, search, and answer questions.',
  },
  social: {
    divider: 'or',
    continueApple: 'Continue with Apple',
    continueGoogle: 'Continue with Google',
    signingIn: 'Signing in…',
    appleUnavailable: 'Apple Sign In unavailable',
    appleNoToken: 'Apple returned no id_token',
    appleFailed: 'Couldn’t sign in with Apple. Please try again.',
    googleFailed: 'Couldn’t connect. Please try Google again.',
    retryFailed: 'Couldn’t connect. Please try signing in again.',
    /**
     * `{provider}` is a brand name (Apple / Google) interpolated at render
     * time. It replaces the previous `replaceAll('Google', provider)` rewrite,
     * which only worked because both languages happened to place the brand in
     * the same spot.
     */
    errors: {
      notConfigured: 'Sign-in with {provider} is unavailable in this build. Please use email.',
      playServices:
        '{provider} sign-in needs Google Play services. Update or enable them, then try again.',
      network: 'Couldn’t connect. Check your connection and try {provider} again.',
      emailInUse:
        'This email already has an account. Sign in with your password or reset it first.',
      expiredToken: '{provider} sign-in expired. Please choose your {provider} account again.',
      rateLimited: 'Too many attempts. Wait a moment and try again.',
      unknown: 'Couldn’t sign in with {provider}. Please try again or use email.',
    },
  },
  registerErrors: {
    EMAIL_TAKEN: 'That email is already in use. Try signing in instead.',
    INVALID_EMAIL: 'Please enter a valid email address.',
    WEAK_PASSWORD: 'Password must be at least 8 characters.',
    DEFAULT: 'Could not create account. Please try again.',
  },
};
