/**
 * Locale negotiation, device detection, persistence and the translator.
 *
 * Runs the real modules through the same transpile-and-mock loader the other
 * native scripts use (see test-reader-navigation.cjs). Nothing here touches a
 * device, a keychain or a network: `react-native` and `expo-secure-store` are
 * replaced with in-memory fakes, so every assertion is about our own logic.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

/**
 * Turn a module specifier into the file that actually holds the code.
 *
 * `existsSync` alone is not enough: `src/lib/i18n/dictionaries/en` exists as a
 * *directory*, so a bare existence check picks it and `readFileSync` then fails
 * with EISDIR. Every candidate is stat'd and only a regular file is accepted,
 * with directory imports resolving to their `index` the way the bundler does.
 */
function resolveModule(candidate) {
  const attempts = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    path.join(candidate, 'index.ts'),
    path.join(candidate, 'index.tsx'),
  ];
  for (const attempt of attempts) {
    try {
      if (fs.statSync(attempt).isFile()) return attempt;
    } catch {
      // Missing path: try the next candidate.
    }
  }
  throw new Error(`Cannot resolve module: ${candidate}`);
}

/** Resolves `@/…` like the app's tsconfig paths and compiles TS on the fly. */
function loader(mocks = {}) {
  const cache = new Map();
  function load(filename) {
    const full = resolveModule(path.resolve(root, filename));
    if (cache.has(full)) return cache.get(full).exports;
    const mod = new Module(full, module);
    cache.set(full, mod);
    mod.filename = full;
    mod.paths = module.paths;
    mod.require = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}`);
      if (id.startsWith('.')) return load(path.resolve(path.dirname(full), id));
      return require(id);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(full, 'utf8'), {
        fileName: full,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
      full,
    );
    return mod.exports;
  }
  return load;
}

let checks = 0;
const passed = (label) => {
  checks++;
  console.log(`PASS ${label}`);
};

/* ------------------------------------------------------------------ *
 * 1. Negotiation
 * ------------------------------------------------------------------ */
function testNegotiation() {
  const { normalizeLocale, matchLocale, resolveLocale, isLocale } =
    loader()('src/lib/i18n/locale.ts');

  for (const tag of ['es', 'es-419', 'es-MX', 'es_CO', 'ES-ar', '  es-ES  ']) {
    assert.equal(normalizeLocale(tag), 'es', `${tag} should resolve to es`);
  }
  for (const tag of ['en', 'en-US', 'en_GB', 'EN']) {
    assert.equal(normalizeLocale(tag), 'en');
  }
  passed('every Spanish and English regional variant collapses onto its base locale');

  // `esperanto` matters: a naive prefix match would read it as Spanish.
  for (const tag of ['fr-FR', 'pt-BR', 'esperanto', '', '   ', null, undefined, 42, {}]) {
    assert.equal(normalizeLocale(tag), null, `${String(tag)} is not a supported locale`);
  }
  passed('unsupported and malformed tags return null rather than a false match');

  assert.equal(matchLocale(['fr-FR', 'es-419', 'en-US']), 'es', 'first supported tag wins');
  assert.equal(matchLocale(['en-US', 'es-419']), 'en', 'order decides, not presence');
  assert.equal(matchLocale(['*', 'es-MX']), 'es', 'the wildcard is skipped, not matched');
  assert.equal(matchLocale(['de', 'fr']), null);
  assert.equal(matchLocale([]), null);
  passed('ordered preference lists are honoured and the wildcard is ignored');

  assert.equal(resolveLocale({ stored: 'es', preferences: ['en-US'] }), 'es');
  assert.equal(resolveLocale({ stored: 'en', preferences: ['es-419'] }), 'en');
  passed('an explicit stored choice beats the device language in both directions');

  assert.equal(resolveLocale({ stored: null, preferences: ['es-CO', 'en-US'] }), 'es');
  assert.equal(
    resolveLocale({ stored: 'fr', preferences: ['es-CO'] }),
    'es',
    'a corrupt stored value is ignored rather than forcing the default',
  );
  assert.equal(resolveLocale({ preferences: ['de-DE'] }), 'en');
  assert.equal(resolveLocale({}), 'en');
  passed('detection falls through to English when nothing supported is offered');

  assert.equal(isLocale('es'), true);
  assert.equal(isLocale('es-419'), false, 'only normalized values are locales');
}

/* ------------------------------------------------------------------ *
 * 2. Device detection across React Native module shapes
 *
 * React Native 0.81 exposes these constants through `getConstants()`.
 * Reading the legacy own-property returns `undefined` there, which silently
 * dropped the ordered iOS list and left only the `Intl` fallback — the exact
 * regression these cases exist to prevent.
 * ------------------------------------------------------------------ */
function detect({ platform, settings, i18nManager, nativeModules = {}, intl = 'en-US' }) {
  const { deviceLanguageTags } = loader({
    'react-native': {
      Platform: { OS: platform },
      Settings: settings ?? {
        get() {
          throw new Error('Settings is unavailable on this platform');
        },
      },
      I18nManager: i18nManager ?? {
        getConstants() {
          throw new Error('I18nManager is unavailable');
        },
      },
      NativeModules: nativeModules,
    },
  })('src/lib/i18n/device.ts');

  const realDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = function () {
    return { resolvedOptions: () => ({ locale: intl }) };
  };
  // Node may expose a global `navigator`; pin it to a shape with no language
  // fields so these cases exercise only the native paths.
  const hadNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let pinnedNavigator = false;
  try {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
    pinnedNavigator = true;
  } catch {
    // Not configurable on this runtime; the fake below simply is not applied.
  }
  try {
    return deviceLanguageTags();
  } finally {
    Intl.DateTimeFormat = realDateTimeFormat;
    if (pinnedNavigator) {
      if (hadNavigator) Object.defineProperty(globalThis, 'navigator', hadNavigator);
      else delete globalThis.navigator;
    }
  }
}

function testDevice() {
  // Getter-only iOS: `Settings.get` reads `getConstants().settings` internally.
  assert.deepEqual(
    detect({
      platform: 'ios',
      settings: { get: (key) => ({ AppleLanguages: ['es-CO', 'en-US'] })[key] },
      intl: 'en-US',
    }),
    ['es-CO', 'en-US'],
    'the ordered iOS list must survive and precede the Intl fallback',
  );
  passed('iOS getter-only Settings keeps Spanish ahead of an en-US Intl fallback');

  // The same device with the module reachable only as a native constant.
  assert.deepEqual(
    detect({
      platform: 'ios',
      nativeModules: {
        SettingsManager: {
          getConstants: () => ({ settings: { AppleLanguages: ['es-419', 'en-US'] } }),
        },
      },
      intl: 'en-US',
    }),
    ['es-419', 'en-US'],
  );
  assert.deepEqual(
    detect({
      platform: 'ios',
      // Pre-0.71 shape: constants hang off the module itself.
      nativeModules: { SettingsManager: { settings: { AppleLocale: 'es_MX' } } },
      intl: 'en-US',
    }),
    ['es_MX', 'en-US'],
  );
  passed('SettingsManager is read through getConstants() and the legacy property alike');

  assert.deepEqual(
    detect({
      platform: 'android',
      i18nManager: { getConstants: () => ({ localeIdentifier: 'es_CO' }) },
      intl: 'en-US',
    }),
    ['es_CO', 'en-US'],
  );
  assert.deepEqual(
    detect({
      platform: 'android',
      nativeModules: { I18nManager: { localeIdentifier: 'es-419' } },
      intl: 'en-US',
    }),
    ['es-419', 'en-US'],
  );
  passed('Android reads localeIdentifier from getConstants() or the legacy property');

  assert.deepEqual(
    detect({ platform: 'ios', intl: 'es-ES' }),
    ['es-ES'],
    'a device with no native locale module still reports its language',
  );
  assert.deepEqual(detect({ platform: 'android', intl: 'en-GB' }), ['en-GB']);
  passed('absent native modules degrade to Intl instead of throwing');

  assert.deepEqual(
    detect({
      platform: 'ios',
      settings: { get: (key) => ({ AppleLanguages: ['en-US', 'en-US', 'es-MX'] })[key] },
      intl: 'en-US',
    }),
    ['en-US', 'es-MX'],
    'duplicates collapse but the first occurrence keeps its position',
  );
  passed('duplicate tags are collapsed without reordering the preference list');

  // End to end: detection must feed negotiation, not just return strings.
  const { matchLocale } = loader()('src/lib/i18n/locale.ts');
  assert.equal(
    matchLocale(
      detect({ platform: 'ios', settings: { get: (k) => ({ AppleLanguages: ['es-CO', 'en-US'] })[k] } }),
    ),
    'es',
  );
  assert.equal(
    matchLocale(
      detect({ platform: 'ios', settings: { get: (k) => ({ AppleLanguages: ['en-US', 'es-CO'] })[k] } }),
    ),
    'en',
  );
  passed('an es-first device resolves to Spanish and an en-first device to English');
}

/* ------------------------------------------------------------------ *
 * 3. Persistence
 * ------------------------------------------------------------------ */
async function testStorage() {
  const store = new Map();
  const failures = { get: false, set: false, remove: false };
  const { readStoredLocale, writeStoredLocale, clearStoredLocale } = loader({
    '@/lib/secureStore': {
      localSecureStore: {
        async getItem(key) {
          if (failures.get) throw new Error('keychain locked');
          return store.has(key) ? store.get(key) : null;
        },
        async setItem(key, value) {
          if (failures.set) throw new Error('keychain locked');
          store.set(key, value);
        },
        async removeItem(key) {
          if (failures.remove) throw new Error('keychain locked');
          store.delete(key);
        },
      },
    },
  })('src/lib/i18n/storage.ts');

  assert.equal(await readStoredLocale(), null, 'a fresh install has no explicit choice');
  await writeStoredLocale('es');
  assert.equal(store.get('flowy.locale'), 'es');
  assert.equal(await readStoredLocale(), 'es');
  passed('an explicit choice round-trips through the local secure store');

  // This is what makes "Automatic" survive a restart.
  await clearStoredLocale();
  assert.equal(store.has('flowy.locale'), false, 'choosing Automatic must delete the row');
  assert.equal(await readStoredLocale(), null);
  passed('clearing the choice removes the row so the next launch re-detects');

  store.set('flowy.locale', 'klingon');
  assert.equal(await readStoredLocale(), null, 'a corrupt value is not trusted');
  store.set('flowy.locale', 'es-419');
  assert.equal(await readStoredLocale(), null, 'only normalized locales are accepted back');
  store.delete('flowy.locale');
  passed('an invalid persisted value is discarded instead of crashing startup');

  failures.get = true;
  assert.equal(await readStoredLocale(), null, 'a locked keychain must not reject');
  failures.get = false;
  failures.set = true;
  await writeStoredLocale('es');
  failures.set = false;
  failures.remove = true;
  await clearStoredLocale();
  failures.remove = false;
  passed('every storage failure resolves quietly rather than blocking startup');
}

/* ------------------------------------------------------------------ *
 * 4. The translator
 * ------------------------------------------------------------------ */
function testTranslator() {
  const { createTranslate, selectPluralForm, interpolate } = loader()('src/lib/i18n/translate.ts');
  const { dictionaries } = loader()('src/lib/i18n/dictionaries/index.ts');

  const es = createTranslate({
    locale: 'es',
    dictionary: dictionaries.es,
    fallback: dictionaries.en,
  });
  const en = createTranslate({ locale: 'en', dictionary: dictionaries.en });

  assert.equal(es('inbox.page.title'), 'Bandeja');
  assert.equal(es('settings.index.title'), 'Ajustes');
  assert.equal(es('inbox.labels.tags'), 'Etiquetas');
  assert.equal(es('digest.history.title'), 'Resúmenes');
  assert.equal(es('inbox.status.deepDive'), 'Análisis profundo');
  passed('the agreed Spanish vocabulary is what the dictionary actually returns');

  assert.equal(es('inbox.page.authorFilter', { author: 'flowy' }), 'Tus guardados · @flowy');
  assert.equal(
    es('settings.alias.loadFailed', { error: 'NOT_FOUND' }),
    'No se pudo cargar tu alias: NOT_FOUND',
  );
  passed('placeholders are interpolated, including values that are not translated');

  assert.equal(es('inbox.groups.count', { count: 1 }), '1 elemento');
  assert.equal(es('inbox.groups.count', { count: 5 }), '5 elementos');
  assert.equal(en('inbox.groups.count', { count: 1 }), '1 item');
  assert.equal(en('inbox.groups.count', { count: 5 }), '5 items');
  assert.equal(es('common.counts.items', { count: 0 }), 'Sin elementos');
  assert.equal(en('common.counts.items', { count: 0 }), 'No items');
  passed('plural selection picks one/other and honours the explicit zero form');

  assert.equal(selectPluralForm({ one: 'x', other: 'y' }, 1, 'es'), 'x');
  assert.equal(selectPluralForm({ one: 'x', other: 'y' }, 0, 'es'), 'y');
  assert.equal(selectPluralForm({ one: 'x', other: 'y' }, Number.NaN, 'es'), 'y');
  assert.equal(
    selectPluralForm({ one: 'x', other: 'y' }, 2, 'es'),
    'y',
    'one at exactly 1, other everywhere else — the rule used when Intl.PluralRules is absent',
  );
  passed('plural selection is correct for en/es with or without Intl.PluralRules');

  assert.equal(interpolate('{count}', { count: 12500 }, 'en'), '12,500');
  assert.equal(interpolate('{count}', { count: 12500 }, 'es'), '12.500');
  // Spanish CLDR minimumGroupingDigits=2: 4-digit numbers are not grouped (1250 → '1250')
  assert.equal(interpolate('{count}', { count: 1250 }, 'es'), '1250');
  assert.equal(
    interpolate('{missing}', {}, 'en'),
    '{missing}',
    'an absent value stays visible instead of leaving a gap',
  );
  passed('interpolated numbers are localized and missing values stay visible');

  const partial = createTranslate({
    locale: 'es',
    dictionary: { inbox: { page: { title: 'Bandeja' } } },
    fallback: dictionaries.en,
  });
  assert.equal(partial('inbox.page.title'), 'Bandeja');
  assert.equal(
    partial('settings.index.title'),
    'Settings',
    'a gap in a locale falls back to English rather than rendering nothing',
  );
  assert.equal(
    partial('inbox.page.doesNotExist'),
    'inbox.page.doesNotExist',
    'an unknown key surfaces as visibly wrong text, not as an empty region',
  );
  assert.equal(partial('inbox'), 'inbox', 'a path that stops on a subtree is not a translation');
  passed('fallback order is locale → English → the key itself');
}

/* ------------------------------------------------------------------ *
 * 5. Formatting
 * ------------------------------------------------------------------ */
function testFormatting() {
  const { formatRelativeDate, formatBytes, formatDate, toDate } = loader()('src/lib/i18n/format.ts');
  const { createTranslate } = loader()('src/lib/i18n/translate.ts');
  const { dictionaries } = loader()('src/lib/i18n/dictionaries/index.ts');
  const es = createTranslate({ locale: 'es', dictionary: dictionaries.es, fallback: dictionaries.en });
  const en = createTranslate({ locale: 'en', dictionary: dictionaries.en });

  const now = Date.parse('2026-09-17T12:00:00Z');
  const ago = (ms) => new Date(now - ms).toISOString();
  const MINUTE = 60_000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  assert.equal(formatRelativeDate(ago(5_000), 'en', en, now), 'just now');
  assert.equal(formatRelativeDate(ago(5_000), 'es', es, now), 'ahora mismo');
  assert.equal(formatRelativeDate(ago(3 * MINUTE), 'en', en, now), '3m ago');
  assert.equal(formatRelativeDate(ago(3 * MINUTE), 'es', es, now), 'hace 3 min');
  assert.equal(formatRelativeDate(ago(5 * HOUR), 'es', es, now), 'hace 5 h');
  assert.equal(formatRelativeDate(ago(3 * DAY), 'es', es, now), 'hace 3 d');
  assert.equal(formatRelativeDate(ago(14 * DAY), 'es', es, now), 'hace 2 sem');
  assert.equal(formatRelativeDate(ago(30 * DAY), 'es', es, now), 'hace 1 mes');
  assert.equal(formatRelativeDate(ago(60 * DAY), 'es', es, now), 'hace 2 meses');
  assert.equal(formatRelativeDate(ago(800 * DAY), 'es', es, now), 'hace 2 años');
  passed('relative time keeps the original thresholds and changes only the words');

  assert.equal(formatRelativeDate(null, 'es', es, now), '');
  assert.equal(formatRelativeDate('not a date', 'es', es, now), '');
  // PocketBase serialises with a space rather than `T`.
  assert.notEqual(toDate('2026-09-17 11:59:00Z'), null);
  passed('unparsable inputs render nothing and PocketBase timestamps still parse');

  assert.equal(formatBytes(512, 'en'), '512 B');
  assert.equal(formatBytes(1536, 'en'), '1.5 KB');
  assert.equal(formatBytes(1536, 'es'), '1,5 KB');
  assert.equal(formatBytes(-1, 'es'), '');
  passed('byte sizes use the locale decimal separator and keep international units');

  assert.notEqual(
    formatDate('2026-09-17T12:00:00Z', 'es', { month: 'long' }),
    formatDate('2026-09-17T12:00:00Z', 'en', { month: 'long' }),
    'month names must differ between locales',
  );
  passed('dates are formatted through the active locale');
}

(async () => {
  testNegotiation();
  testDevice();
  await testStorage();
  testTranslator();
  testFormatting();
  console.log(`${checks} native i18n core scenarios passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
