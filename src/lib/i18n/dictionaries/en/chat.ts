/**
 * Chat: the full tab, the floating inbox window, the history drawer, message
 * actions and the sync/error vocabulary shared with the web client.
 *
 * The `errors.*` namespace is a CROSS-PLATFORM CONTRACT: `chatErrorKey()` in
 * `src/hooks/useChatEngine.ts` returns these exact paths, and the same function
 * is mirrored in the web client.
 *
 * NOT translated here: the assistant's answers (generated in whatever language
 * the user writes in), conversation titles derived from the user's own question,
 * and item titles in the source rail. Suggestion chips and the digest seed draft
 * ARE translated — they are prefilled *editable* text the user reviews before
 * sending, not a silent rewrite of a stored message.
 */
export const chat = {
  page: {
    title: 'Chat',
    loadingConversations: 'Loading conversations…',
    loadEarlier: 'Load earlier messages',
    goToLatest: 'Go to latest',
    newChat: 'New chat',
    history: 'Chat history',
    closeHistory: 'Close chat history',
    preparingElsewhere: 'A response is being prepared in another chat. View',
    stop: 'Stop',
    retrySaving: 'Retry saving',
    retryLoading: 'Retry loading',
  },
  empty: {
    heading: 'Find a thought you saved.',
    body: 'Ask about your saved content. Follow the sources to see where each answer comes from.',
    title: 'Ask anything about',
    titleAccent: 'your saved content',
    subtitle:
      'Flowy searches across every article, screenshot, video, and receipt you’ve shared.',
    promptRediscover: 'Help me rediscover something I saved recently',
    promptTopics: 'What topics appear in my saved content?',
    promptSummarize: 'Summarize my most recent saves',
  },
  composer: {
    label: 'Message',
    placeholder: 'Ask about your saved content…',
    send: 'Send message',
    stop: 'Stop response',
    stopShort: 'Stop',
    cancelConnecting: 'Cancel connecting',
    connecting: 'Connecting… Tap to cancel.',
    blocked: 'Finish or stop the other response before sending.',
  },
  message: {
    assistant: 'Flowy',
    assistantTag: '· AI',
    writing: 'Writing…',
    preparing: 'Preparing response…',
    stopped: 'Response stopped. You can retry when ready.',
    failed: 'This response could not be completed. Please try again.',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed, retry',
    retry: 'Retry',
    retryResponse: 'Retry response',
    sources: 'Sources',
    relatedSaves: 'Related saves',
    untitled: 'Untitled save',
    savedSource: 'Saved source',
    openSource: 'Open source {index}: {title}',
    openSavedItem: 'Open saved item: {title}',
    openSourceIndexed: 'Open source {index}: {title}, {domain}',
    openSavedItemDomain: 'Open saved item: {title}, {domain}',
    railLabel: '{label}, {count}',
    railSummary: '{label} · {count}',
    viewSources: {
      one: 'View {count} source in inbox ↗',
      other: 'View {count} sources in inbox ↗',
    },
    viewRelated: {
      one: 'View {count} related save in inbox ↗',
      other: 'View {count} related saves in inbox ↗',
    },
  },
  history: {
    label: 'Chat history',
    close: 'Close chat history',
    newChat: 'New chat',
    chats: 'Chats',
    empty: 'Your conversations will appear here.',
    newConversation: 'New conversation',
    draft: 'Draft',
    preparingResponse: 'Preparing response…',
    deleteNamed: 'Delete conversation {title}',
    deleteTitle: 'Delete conversation?',
    deleteBody: 'This deletes it from all your devices.',
    delete: 'Delete',
    cancel: 'Cancel',
    synced: 'Chats saved to your account. Drafts stay on this device.',
    localOnly: 'Local copy available. Connect to sync your chats.',
  },
  inboxChat: {
    ask: 'Ask Flowy',
    askReady: 'Ask Flowy, response ready',
    panelLabel: 'Flowy chat',
    minimize: 'Minimize chat',
    openFull: 'Open full chat',
    backToInbox: 'Back to inbox',
    results: { one: 'Chat results · {count}', other: 'Chat results · {count}' },
    sourcesAvailable:
      '{count} of {total} sources available. Your other inbox filters are paused.',
    sourcesLoadFailed: 'Could not load these sources. Check your connection and try again.',
    sourcesEmpty:
      'These sources are no longer available in your library. Return to your inbox or try another response.',
    retry: 'Retry',
  },
  digestSeed: {
    title: 'About your digest',
    sourceDraft: 'Help me understand this source.',
    digestDraft: 'What should I remember from this digest?',
  },
  /** CROSS-PLATFORM CONTRACT — returned by `chatErrorKey()`. */
  errors: {
    CHAT_BUSY: 'A response is already being prepared on another device. Refresh to see it.',
    REVISION_CONFLICT:
      'This conversation changed on another device. Review the latest messages and send again.',
    REQUEST_EXISTS: 'This question was already received. Refresh to see its saved response.',
    CHAT_DELETED: 'This conversation was deleted. Start a new chat to continue.',
    NOT_FOUND:
      'This conversation could not be found. Your local copy is preserved. Refresh and try again.',
    CHAT_HISTORY_UNAVAILABLE:
      'Chat sync is not available on this server yet. Your local chats are preserved.',
    CHAT_TIMEOUT: 'Connecting took too long. Your draft is preserved. Please try again.',
    UNAUTHORIZED: 'Your session expired. Sign in again to sync your chats.',
    BODY_TOO_LARGE:
      'This local chat could not be imported because it exceeds the supported format or size. Your local copy is preserved.',
    DEFAULT: 'Chat sync could not finish. Your local copy is available; reconnect and retry.',
    storageWrite: 'This device could not save its local chat copy. Keep the app open and retry.',
    storageRead: 'Saved chats could not be loaded. Retry to protect your existing conversations.',
    tooLong: 'Please keep your question under 16,000 characters.',
  },
};
