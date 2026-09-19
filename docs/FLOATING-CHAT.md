# Floating inbox chat

Implemented on 2026-09-15 alongside web `codex/inbox-floating-chat`.

## Experience

The inbox has a 56px orange launcher with an italic lowercase f: white letter
and black dot in light theme, dark letter and white dot in dark theme. It opens
a compact chat surface with folded history, new conversation, expand and minimize.
The same account-scoped chat provider serves both surfaces. Drafts and active
requests survive minimization; generation is not promised after the OS stops
the app. Each visible panel registers its own visibility token so a hidden panel
cannot mark an active conversation unseen.

History uses account-synced conversation metadata, including older conversations
whose messages have not loaded yet, and supports earlier message pagination.
The full chat keeps its existing history drawer; the floating window uses an
inline history list. Deletion wording reflects deletion across devices.

Each answer offers a sources action. Only known references mentioned in the
answer are treated as citations; uncited references are labeled related saves.
The results surface loads owned item IDs in batches of 50, outside the current
inbox page and filters, and keeps citation order. Missing sources, loading,
connection failure/retry and pull-to-refresh are visible. Original inbox filters,
loaded pages, view and scrolling stay mounted when results are shown.

The surface lives inside the inbox pane, below the normal item navigation.
The keyboard adjusts its composer. Android Back and accessibility escape close
the history/window. Original inbox content is hidden from accessibility while
the window is open. Capture/selection modes and hidden panes suppress the launcher.
It reuses native colors, 44px actions and existing chat/history APIs. No native
dependencies, entitlements, server request shapes or database schema changed.
The italic Instrument Serif asset comes from the already-installed font package.

## Exact paths

- `src/components/chat/InboxFloatingChat.tsx`: launcher and compact surface.
- `src/components/chat/ChatPanel.tsx`: shared toolbar, history and composer.
- `src/components/chat/ChatWindow.tsx`, `ChatMessage.tsx`: compact welcome and source action.
- `src/components/inbox/ChatSourceResults.tsx`, `src/hooks/useChatSources.ts`: results and query lifecycle.
- `src/lib/chatSources.ts`, `src/lib/pb.ts`: reference selection and owned reads.
- `src/hooks/useChat.ts`: visibility ownership for simultaneous surfaces.
- `app/(app)/(tabs)/inbox.tsx`, `chat.tsx`, `app/_layout.tsx`: integration/font.

## Validation and distribution

`node scripts/test-inbox-chat.cjs`: 10 source/ownership/batching/cancellation/error
scenarios pass. `npm run typecheck` passes. `expo export --platform ios` produces
an iOS Hermes bundle successfully. Export is not a signed build or TestFlight
submission. No new binary, OTA update or TestFlight distribution was requested
as part of preparing this native change.

## Native keyboard correction — 2026-09-16

`ChatPanel.tsx` measures the keyboard-avoiding view's parent in window coordinates
and supplies that origin as `keyboardVerticalOffset`. This accounts for safe
areas and nested/floating panels without hardcoded header heights. It remeasures
on layout, focus and history closure. The message area can shrink while the
composer remains above the keyboard. Unhandled background taps dismiss it;
message actions and Send remain independently tappable. `ChatWindow.tsx` uses
scrollable welcome content and interactive iOS / on-drag Android dismissal.

Validation: native TypeScript, 10 existing source-selection checks and iOS Hermes
export pass. An isolated Expo Go harness using the actual ChatPanel, ChatWindow,
ChatInput and user-message components was exercised on iPhone 16e / iOS 26.0.
Verified sending with the software keyboard visible, background-tap dismissal in
the message list and both welcome states, and repeated opening/closing with a
compact panel at a different vertical origin. The harness mocks chat state and
history and does not contact production. It does not validate authenticated
streaming, the complete inbox overlay, Android or a physical iPhone. No signed
build, OTA update or TestFlight distribution was performed.
