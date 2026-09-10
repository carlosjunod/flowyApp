import type { ApiError, PersonalizationProfile, PersonalizationInput } from '@/types';

export { PERSONALIZATION_LIMITS } from '@/types/personalization';

export function personalizationDraft(profile: PersonalizationProfile): PersonalizationInput {
  const { updatedAt: _updatedAt, ...draft } = profile;
  return draft;
}


/** Starting an interview opts an empty profile in; existing paused answers stay paused. */
export function initialPersonalizationDraft(profile: PersonalizationProfile): PersonalizationInput {
  return { ...personalizationDraft(profile), enabled: hasPersonalization(profile) ? profile.enabled : true };
}

export function normalizePersonalization(draft: PersonalizationInput): PersonalizationInput {
  return { ...draft, occupation: draft.occupation.trim(), currentFocus: draft.currentFocus.trim(), preferences: draft.preferences.trim() };
}

export function hasPersonalization(profile: PersonalizationInput): boolean {
  return !!(profile.occupation.trim() || profile.currentFocus.trim() || profile.preferences.trim());
}

export function shouldInvitePersonalization(profile: PersonalizationProfile): boolean {
  return !profile.onboardingDismissed && !hasPersonalization(profile);
}

export function personalizationError(error: Pick<ApiError, 'code' | 'status'>): string {
  if (error.code === 'PERSONALIZATION_CONFLICT' || error.status === 409) return 'Your profile changed on another device. Your edits are still here. Reload the saved profile before making more changes.';
  if (error.code === 'UNAUTHORIZED') return 'Your session expired or changed. Sign in again to continue.';
  if (error.code === 'NETWORK_ERROR') return 'Could not connect. Your edits are still here. Check your connection and try again.';
  if (['INVALID_INPUT', 'INVALID_PERSONALIZATION', 'BODY_TOO_LARGE', 'INVALID_BODY'].includes(error.code)) return 'Check your answers and try again. Keep them within the character limits.';
  return 'Could not update personalization. Your edits are still here. Please try again.';
}
