/**
 * The signed-in shell: bottom navigation, the AI-processing consent gate that
 * blocks the app until accepted, the split-view placeholder, and the alerts the
 * Android share intent raises before any screen is mounted.
 */
export const app = {
  nav: {
    inbox: 'Inbox',
    chat: 'Chat',
    digests: 'Digests',
    settings: 'Settings',
    /** Appended to a tab's accessibility label while a response is running. */
    tabPreparing: '{tab}, preparing response',
    tabUnread: '{tab}, new response',
  },
  reader: {
    placeholder: 'Select a saved item to start reading',
  },
  consentGate: {
    title: 'Use AI features',
    body: 'To process saved content and answer chats, Flowy sends the necessary text, images, documents, audio, and chat requests to Anthropic, OpenAI, and Voyage AI. They process it only to provide these features.',
    review: 'Review the Privacy Policy and Terms of Service in Settings.',
    accept: 'I agree',
    saving: 'Saving…',
    decline: 'Not now — sign out',
  },
  share: {
    unsupportedTitle: 'Can’t save this item',
    unsupportedBody: 'Share a link, photo, video, PDF, or file to Flowy.',
    failedTitle: 'Couldn’t save item',
    failedUnauthorized: 'Your session has ended. Sign in to save shared items.',
    failedNetwork: 'Check your connection and try sharing again.',
    unreadableTitle: 'Couldn’t read this item',
    unreadableBody: 'Check that the shared file is still available, then try again.',
  },
};
