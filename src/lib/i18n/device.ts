/**
 * Device language detection — the native replacement for the web client's
 * `Accept-Language` / `navigator.languages` negotiation.
 *
 * This app deliberately adds no localization dependency (`expo-localization`
 * and friends stay out of `package.json`), so the preference list is assembled
 * from what the runtime already exposes, best source first:
 *
 *   1. iOS  — `Settings.get('AppleLanguages')`, an *ordered* list of the user's
 *             language preferences. Ordering is the whole reason this is tried
 *             before `Intl`: a phone set to Spanish-then-English must resolve to
 *             Spanish, and only an ordered list can express that. `Intl` answers
 *             with a single locale and would silently win otherwise.
 *   2. Android — `I18nManager.getConstants().localeIdentifier` ("es_MX"); there
 *             is no ordered list on the JS side.
 *   3. Web  — `navigator.languages` / `navigator.language`.
 *   4. Any  — `Intl.DateTimeFormat().resolvedOptions().locale`, the last resort.
 *
 * ## Why this reads constants three different ways
 *
 * React Native 0.81 moved both modules behind TurboModule *getters*:
 * `Settings.ios.js` reads `NativeSettingsManager.getConstants().settings` and
 * `I18nManager.js` reads `NativeI18nManager.getConstants().localeIdentifier`.
 * Reading `NativeModules.SettingsManager.settings` directly — the pre-0.71
 * shape — returns `undefined` on those builds, which silently drops the ordered
 * iOS list and leaves only the `Intl` fallback. So each source is attempted as:
 * the public JS API → `getConstants()` → the legacy own-property. Whichever
 * answers first wins, and a module that is missing entirely contributes
 * nothing rather than throwing.
 */

import { I18nManager, NativeModules, Platform, Settings } from 'react-native';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

/** Normalises a constant into an ordered list of non-empty BCP-47 tags. */
function tags(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '');
}

/** `NativeModules` is indexed as `any`; funnel it through `unknown` instead. */
function nativeModule(name: string): Record<string, unknown> | null {
  try {
    return record((NativeModules as unknown as Record<string, unknown>)[name]);
  } catch {
    return null;
  }
}

/**
 * Read `name` off a native module, preferring `getConstants()` and falling back
 * to the own property that older React Native versions exposed directly.
 */
function constant(module: Record<string, unknown> | null, name: string): unknown {
  if (!module) return undefined;
  const getConstants = module.getConstants;
  if (typeof getConstants === 'function') {
    try {
      const constants = record((getConstants as () => unknown).call(module));
      if (constants && constants[name] !== undefined) return constants[name];
    } catch {
      // A module that refuses to hand over its constants is simply skipped.
    }
  }
  return module[name];
}

function fromIos(): string[] {
  const collected: string[] = [];
  // 1. The public API. It already knows how to reach the constants on this
  //    React Native version, which is exactly the compatibility problem here.
  try {
    collected.push(...tags(Settings.get('AppleLanguages')));
    // `AppleLocale` is the single region-formatted locale, a fallback for
    // systems that do not publish the ordered list.
    if (!collected.length) collected.push(...tags(Settings.get('AppleLocale')));
  } catch {
    // `Settings` is iOS-only and can be absent in a test or web bundle.
  }
  // 2. The native module directly, for builds where `Settings` is unavailable.
  if (!collected.length) {
    const settings = record(constant(nativeModule('SettingsManager'), 'settings'));
    if (settings) {
      collected.push(...tags(settings.AppleLanguages), ...tags(settings.AppleLocale));
    }
  }
  return collected;
}

function fromAndroid(): string[] {
  try {
    const identifier = I18nManager.getConstants().localeIdentifier;
    if (typeof identifier === 'string' && identifier.trim()) return [identifier];
  } catch {
    // Fall through to the native module below.
  }
  return tags(constant(nativeModule('I18nManager'), 'localeIdentifier'));
}

function fromNavigator(): string[] {
  const nav = record(typeof navigator === 'undefined' ? undefined : navigator);
  if (!nav) return [];
  return [...tags(nav.languages), ...tags(nav.language)];
}

function fromIntl(): string[] {
  try {
    return tags(new Intl.DateTimeFormat().resolvedOptions().locale);
  } catch {
    return [];
  }
}

/**
 * The device's language preferences, most preferred first.
 *
 * Duplicates are collapsed but order is preserved, because `matchLocale` stops
 * at the first supported tag.
 */
export function deviceLanguageTags(): string[] {
  const sources: string[] = [];
  if (Platform.OS === 'ios' || Platform.OS === 'macos') sources.push(...fromIos());
  if (Platform.OS === 'android') sources.push(...fromAndroid());
  sources.push(...fromNavigator(), ...fromIntl());
  return [...new Set(sources)];
}
