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

/** Maps a server error *code* to a translation key under `settings.personalization.errors.*`. */
export function personalizationErrorKey(error: Pick<ApiError, 'code' | 'status'>): string {
  if (error.code === 'PERSONALIZATION_CONFLICT' || error.status === 409) return 'settings.personalization.errors.conflict';
  if (error.code === 'UNAUTHORIZED') return 'settings.personalization.errors.session';
  if (error.code === 'NETWORK_ERROR') return 'settings.personalization.errors.network';
  if (['INVALID_INPUT', 'INVALID_PERSONALIZATION', 'BODY_TOO_LARGE', 'INVALID_BODY'].includes(error.code)) return 'settings.personalization.errors.invalid';
  return 'settings.personalization.errors.unknown';
}
