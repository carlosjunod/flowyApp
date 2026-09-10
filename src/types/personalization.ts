/** Explicit, account-owned context. No inferred or conversation-extracted memories. */
export interface PersonalizationProfile {
  occupation: string;
  currentFocus: string;
  preferences: string;
  enabled: boolean;
  onboardingDismissed: boolean;
  revision: number;
  updatedAt: string | null;
}
export type PersonalizationInput = Omit<PersonalizationProfile, 'updatedAt'>;
export const DEFAULT_PERSONALIZATION: PersonalizationProfile = {
  occupation: '', currentFocus: '', preferences: '', enabled: false,
  onboardingDismissed: false, revision: 0, updatedAt: null,
};
export const PERSONALIZATION_LIMITS = { occupation: 600, currentFocus: 1000, preferences: 1000 } as const;
