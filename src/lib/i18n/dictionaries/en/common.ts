/**
 * Strings shared by more than one screen: verbs on buttons, generic states,
 * relative time and the language selector itself.
 *
 * Anything used by exactly one screen belongs in that screen's module instead —
 * a "common" bucket that accumulates single-use keys stops being reviewable.
 *
 * NOTE: no `as const` anywhere in the English dictionary. `as const` would infer
 * literal string types, and the Spanish modules would then be required to
 * repeat the English text verbatim. Plain inference widens leaves to `string`,
 * which is what makes the Spanish files type-check as translations.
 */
export const common = {
  brand: {
    // Product and company names are never translated.
    name: 'Flowy',
    tagline: 'An inbox for everything.',
  },
  actions: {
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved',
    cancel: 'Cancel',
    close: 'Close',
    confirm: 'Confirm',
    delete: 'Delete',
    remove: 'Remove',
    edit: 'Edit',
    done: 'Done',
    back: 'Back',
    next: 'Next',
    retry: 'Try again',
    refresh: 'Refresh',
    reload: 'Reload',
    copy: 'Copy',
    copied: 'Copied',
    open: 'Open',
    openOriginal: 'Open original',
    search: 'Search',
    clear: 'Clear',
    select: 'Select',
    selectAll: 'Select all',
    apply: 'Apply',
    add: 'Add',
    loadMore: 'Load more',
    showMore: 'Show more',
    showLess: 'Show less',
    signIn: 'Sign in',
    signOut: 'Sign out',
    getStarted: 'Get started',
    learnMore: 'Learn more',
    keepEditing: 'Keep editing',
    discardChanges: 'Discard changes',
    leave: 'Leave',
  },
  states: {
    loading: 'Loading…',
    working: 'Working…',
    empty: 'Nothing here yet',
    error: 'Something went wrong',
    errorRetry: 'Something went wrong. Please try again.',
    offline: 'You appear to be offline.',
    notFound: 'Not found',
    unavailable: 'Unavailable',
    unknown: 'Unknown',
    on: 'On',
    off: 'Off',
    yes: 'Yes',
    no: 'No',
  },
  /**
   * One sentence per API error *code*.
   *
   * The server's `message` is usually the code itself, so showing it raw put
   * strings like "ORIGINAL_REQUIRED" in front of users. Codes are the contract
   * and stay untranslated; these are their human form.
   */
  errors: {
    UNAUTHORIZED: 'Your session changed. Sign in again.',
    FORBIDDEN: 'You don’t have access to that.',
    NOT_FOUND: 'That item is no longer available.',
    RATE_LIMITED: 'Too many attempts. Wait a moment and try again.',
    NETWORK_ERROR: 'Couldn’t connect. Check your connection and try again.',
    SERVER_ERROR: 'The server had a problem. Please try again.',
    INVALID_INPUT: 'That request wasn’t valid. Please try again.',
    ORIGINAL_REQUIRED: 'Keep the original until its text is extracted and the item is ready.',
    DEFAULT: 'Something went wrong. Please try again.',
  },
  time: {
    justNow: 'just now',
    minutesAgo: { one: '{count}m ago', other: '{count}m ago' },
    hoursAgo: { one: '{count}h ago', other: '{count}h ago' },
    daysAgo: { one: '{count}d ago', other: '{count}d ago' },
    weeksAgo: { one: '{count}w ago', other: '{count}w ago' },
    monthsAgo: { one: '{count}mo ago', other: '{count}mo ago' },
    yearsAgo: { one: '{count}y ago', other: '{count}y ago' },
    today: 'Today',
    yesterday: 'Yesterday',
    never: 'Never',
  },
  counts: {
    items: { zero: 'No items', one: '{count} item', other: '{count} items' },
    savedItems: { zero: 'No saved items', one: '{count} saved item', other: '{count} saved items' },
    selected: { zero: 'None selected', one: '{count} selected', other: '{count} selected' },
    results: { zero: 'No results', one: '{count} result', other: '{count} results' },
    sources: { zero: 'No sources', one: '{count} source', other: '{count} sources' },
    categories: { zero: 'No categories', one: '{count} category', other: '{count} categories' },
  },
  language: {
    label: 'Language',
    // The control itself is announced in the *current* locale; the options are
    // always written in their own language so a lost user can find their way
    // back without being able to read the surrounding UI.
    selectorLabel: 'Choose language',
    change: 'Change language',
    english: 'English',
    spanish: 'Español',
    automatic: 'Automatic',
    automaticDetected: 'Automatic ({detected})',
    followsDevice: 'Follows your device language until you pick one.',
    interfaceOnly:
      'This changes the interface only. Your saved content, your notes and Flowy’s answers keep the language they were written in.',
    digestNote: 'Your digest report language is set separately, in Digest settings.',
  },
  theme: {
    label: 'Appearance',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    systemHint: 'System follows your device’s appearance setting.',
    toggle: 'Switch theme',
  },
  a11y: {
    externalLink: 'Opens in your browser',
    loading: 'Loading',
    dismiss: 'Dismiss',
    menu: 'Menu',
    charactersUsed: '{used} of {limit} characters',
  },
};
