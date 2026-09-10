# Personalization V1 — 2026-09-10

Flowy can use a user's explicit profile to tailor future chat answers to their work, current projects and preferences. The profile is shared with the signed-in account's web app. It is optional, editable, pausable and removable. V1 does not infer a biography from saved links or extract memories from conversations.

## Product flow

- Inbox and Chat display an orange banner across the full screen width, above their headers inside the top safe area. **Get answers that fit you** explains **Three short questions about your work and goals.** The **Complete interview** action opens the profile form; an accessible 44-point close control dismisses it. The banner has no inset card margins, border or rounded corners. Completed profiles and dismissals hide it across both views and the web app through shared account state. A failed dismissal remains visible with retry. Loading/API failures hide the invitation without blocking the app. This is an in-app reminder; no push notification is sent.
- Settings → **What Flowy knows about you** opens `/personalization`. Three optional questions cover occupation/learning, current focus and recommendation preferences.
- Starting the interview with an empty profile, including after a previous dismissal, starts with **Use this profile in chat** enabled. Nothing is saved until **Save profile**. At least one answer is required to enable it. Users may save a paused profile and enable it later.
- Switching personalization off and saving preserves the answers. **Clear profile** confirms removal of the saved answers and disables personalization. Existing chat messages remain in history.
- The form explains that enabled answers are shared with Flowy's AI provider for future chat responses. Saved links remain the source evidence for answers and citations.
- Failed saves retain typed answers. A revision conflict blocks resubmission and offers **Reload saved profile**; replacing the local draft requires an explicit confirmation. Background refetches never silently overwrite a draft.

## Files

| Path | Responsibility |
| --- | --- |
| `app/(app)/personalization.tsx` | Native profile editor, load/retry, character limits, enable toggle, save/clear, conflict recovery |
| `app/(app)/_layout.tsx` | Registers the stack route under the account-keyed app layout |
| `app/(app)/(tabs)/settings.tsx` | Permanent profile entry |
| `app/(app)/(tabs)/chat.tsx` | Full-width orange reminder above the Chat header |
| `app/(app)/(tabs)/inbox.tsx` | Full-width orange reminder above the Inbox header |
| `src/components/personalization/PersonalizationInvitation.tsx` | Server-persisted optional onboarding invitation |
| `src/hooks/usePersonalization.ts` | Account-keyed React Query reads and guarded mutations |
| `src/lib/api.ts` | Bearer-authenticated profile REST calls; captures session and discards late responses after auth changes |
| `src/lib/personalization.ts` | Draft normalization, invitation eligibility and user-facing error messages |
| `src/types/personalization.ts` | Mirrored server contract, defaults and limits |
| `scripts/test-ui-models.cjs` | Regression coverage for account isolation, CAS conflicts, dismissal and clear |

## Shared server contract

The authoritative implementation is the matching Flowy server worktree, `apps/web/app/api/profile/personalization/route.ts`. No native backend, direct PocketBase profile writes, new environment variables or new chat payload fields are needed.

```ts
interface PersonalizationProfile {
  occupation: string;
  currentFocus: string;
  preferences: string;
  enabled: boolean;
  onboardingDismissed: boolean;
  revision: number;
  updatedAt: string | null;
}
```

- `GET /api/profile/personalization` → `{ data: PersonalizationProfile, error: null }`. An absent profile is empty, disabled and not dismissed, with revision `0` and `updatedAt: null`.
- `PUT /api/profile/personalization` sends every field except `updatedAt`. `revision` is the expected saved revision; success returns the new profile. Answers are trimmed, with limits `600 / 1000 / 1000` characters respectively.
- `DELETE /api/profile/personalization` sends `{ revision }`. Success returns cleared answers, `enabled: false`, `onboardingDismissed: true` and an incremented revision.
- Errors return `{ data: null, error: string }`. HTTP 409 / `PERSONALIZATION_CONFLICT` means another write won; the client must reload explicitly before replacing it.
- The mobile API boundary converts the wire error into its existing `ApiError` shape. React Query uses `['personalization', accountId]`. Mutations cancel older reads, guard duplicate taps, and reject stale account/session results. Profile answers are not persisted to device storage.
- `POST /api/chat` remains a plain-text stream with `x-items` and `[[itemId]]` citations. The server loads the account profile for both chat paths, so web/native clients benefit without sending profile text in each request.

## Verification and rollout

TypeScript and all **29 UI-model regression scenarios** pass, including four new personalization scenarios that exercise the real helper, API and hook code. They cover paused/dismissed invitations, empty-profile setup after dismissal, actionable validation errors, trimming, captured bearer session, cross-account and late-response rejection, CAS request bodies, duplicate-save prevention, conflict cache preservation and clear behavior.

The iOS Metro export was attempted but did not complete because NativeWind required writing a shared dependency cache outside the worktree. No export, simulator or native-device pass is claimed.

Ship the matching server migration and API before this client release. No native dependencies, capabilities, entitlements, generated projects or auth identifiers changed. The changed JavaScript must be delivered through the project's normal compatible client release process. This work does not deploy the server or submit a native build.

Native device acceptance remains required: verify keyboard scrolling through all three questions, VoiceOver labels and focus, Dynamic Type, dark/light appearance, back navigation, offline retry, dismiss and revisit through Settings, create on mobile and read/update on web, a simultaneous web/mobile edit conflict, pause and clear before new chat responses, and logout/login with two accounts. A Metro export only validates bundling; it does not establish device interaction or personalized model quality.
