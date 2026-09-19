/**
 * LocaleProvider behaviour, and the main screens rendering in Spanish.
 *
 * Two halves:
 *
 *   1. The provider is driven through a small hook runtime (the same technique
 *      test-google-auth.cjs uses) so the startup order, the hydration race and
 *      the "Automatic" delete can be asserted without a device.
 *   2. Each main screen is rendered with a *real* translator built from the
 *      real dictionaries. That makes these integration tests rather than
 *      snapshot tests: a screen that references a key nobody defined renders
 *      the key itself, and the assertions below catch it.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

/** See test-i18n-core.cjs: a directory must never be treated as a module file. */
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

/**
 * A single-component hook runtime.
 *
 * Enough for one function component rendered repeatedly: slots keyed by call
 * order, effects flushed after the render, and a `setState` that marks the
 * tree dirty so the next `render()` observes it. Deliberately not a React
 * implementation — it exists so provider *ordering* can be asserted.
 */
function hookRuntime() {
  let index = 0;
  const slots = [];
  let effects = [];
  const api = {
    react: {
      useState(initial) {
        const id = index++;
        if (!slots[id]) slots[id] = { value: typeof initial === 'function' ? initial() : initial };
        const slot = slots[id];
        return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
      },
      useRef(initial) {
        const id = index++;
        return (slots[id] ??= { current: initial });
      },
      useMemo(factory, deps) {
        const id = index++;
        const slot = slots[id];
        if (!slot || !slot.deps || deps.some((d, i) => !Object.is(d, slot.deps[i]))) {
          slots[id] = { deps, value: factory() };
        }
        return slots[id].value;
      },
      useCallback(fn, deps) {
        return api.react.useMemo(() => fn, deps);
      },
      useEffect(fn, deps) {
        const id = index++;
        const slot = slots[id];
        if (!slot || !slot.deps || deps.some((d, i) => !Object.is(d, slot.deps[i]))) {
          effects.push(() => {
            slots[id]?.cleanup?.();
            slots[id] = { deps, cleanup: fn() };
          });
        }
      },
      createContext: (fallback) => ({ fallback, Provider: 'Provider' }),
      useContext: (context) => context.current ?? context.fallback,
    },
    render(fn) {
      index = 0;
      effects = [];
      const tree = fn();
      effects.forEach((effect) => effect());
      return tree;
    },
    unmount() {
      slots.forEach((slot) => slot?.cleanup?.());
      slots.length = 0;
      index = 0;
    },
  };
  return api;
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

/* ------------------------------------------------------------------ *
 * 1. LocaleProvider
 * ------------------------------------------------------------------ */
async function testProvider() {
  /**
   * @param deviceTags  what the device reports, ordered
   * @param stored      what the keychain holds, or null
   * @param readDelay   how long the keychain takes, in ticks
   */
  function mountProvider({ deviceTags, stored = null, readDelay = 0 }) {
    const runtime = hookRuntime();
    const writes = [];
    let pending = stored;
    const load = loader({
      react: {
        ...runtime.react,
        // The provider only renders a Provider element; capture its value.
        createElement: () => null,
      },
      'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
      './device': { deviceLanguageTags: () => deviceTags },
      './storage': {
        readStoredLocale: async () => {
          for (let tick = 0; tick < readDelay; tick++) await flush();
          return pending;
        },
        writeStoredLocale: async (locale) => {
          await flush();
          writes.push(['write', locale]);
          pending = locale;
        },
        clearStoredLocale: async () => {
          await flush();
          writes.push(['clear']);
          pending = null;
        },
      },
    });
    const { LocaleProvider } = load('src/lib/i18n/LocaleProvider.tsx');
    const render = () => runtime.render(() => LocaleProvider({ children: null }));
    let tree = render();
    return {
      writes,
      value: () => tree.props.value,
      render: () => {
        tree = render();
        return tree.props.value;
      },
      unmount: () => runtime.unmount(),
      storedNow: () => pending,
    };
  }

  // --- first render is synchronous and already in the right language -----
  let app = mountProvider({ deviceTags: ['es-CO', 'en-US'] });
  assert.equal(app.value().locale, 'es', 'the first frame must already be Spanish');
  assert.equal(app.value().explicit, false);
  assert.equal(app.value().detected, 'es');
  assert.equal(app.value().t('inbox.page.title'), 'Bandeja');
  passed('an es-first device renders Spanish on the very first frame, before any I/O');

  app = mountProvider({ deviceTags: ['en-US', 'es-CO'] });
  assert.equal(app.value().locale, 'en', 'an en-first device is not made Spanish by mere presence');
  assert.equal(app.value().t('inbox.page.title'), 'Inbox');
  passed('device preference order decides the initial language');

  app = mountProvider({ deviceTags: ['de-DE'] });
  assert.equal(app.value().locale, 'en', 'an unsupported device language falls back to English');
  passed('an unsupported device language starts in English');

  // --- hydration applies a stored choice ---------------------------------
  app = mountProvider({ deviceTags: ['en-US'], stored: 'es' });
  assert.equal(app.value().locale, 'en', 'before hydration the device language applies');
  await flush();
  let value = app.render();
  assert.equal(value.locale, 'es', 'the persisted choice wins once it has been read');
  assert.equal(value.explicit, true);
  assert.equal(value.detected, 'en', 'detection is still reported for the Automatic row');
  passed('a persisted explicit choice overrides the device language after hydration');

  // --- the race the acceptance criteria call out -------------------------
  app = mountProvider({ deviceTags: ['en-US'], stored: 'es', readDelay: 3 });
  app.value().setLocale('en');
  assert.equal(app.render().locale, 'en');
  for (let tick = 0; tick < 6; tick++) await flush();
  value = app.render();
  assert.equal(
    value.locale,
    'en',
    'a slow keychain read must not revert a choice the user already made',
  );
  assert.equal(value.explicit, true);
  passed('a choice made during hydration is never overwritten by the stale read');

  // --- the same guard protects choosing Automatic ------------------------
  app = mountProvider({ deviceTags: ['en-US'], stored: 'es', readDelay: 3 });
  app.value().useDeviceLocale();
  assert.equal(app.render().locale, 'en');
  for (let tick = 0; tick < 6; tick++) await flush();
  value = app.render();
  assert.equal(
    value.locale,
    'en',
    'Automatic is a choice too, and the in-flight read must not undo it',
  );
  assert.equal(value.explicit, false);
  passed('picking Automatic during hydration also survives the stale read');

  // --- switching language is immediate and persisted ---------------------
  app = mountProvider({ deviceTags: ['en-US'] });
  app.value().setLocale('es');
  value = app.render();
  assert.equal(value.locale, 'es', 'the switch applies to this render, not the next screen');
  assert.equal(value.explicit, true);
  assert.equal(value.t('settings.index.title'), 'Ajustes');
  assert.equal(value.formatBytes(1536), '1,5 KB', 'formatters follow the new locale too');
  await flush();
  await flush();
  assert.deepEqual(app.writes, [['write', 'es']]);
  assert.equal(app.storedNow(), 'es');
  passed('setLocale re-renders immediately and persists the choice');

  // --- Automatic clears the row, so a restart re-detects ------------------
  app.value().useDeviceLocale();
  value = app.render();
  assert.equal(value.locale, 'en', 'Automatic returns to the device language at once');
  assert.equal(value.explicit, false);
  for (let tick = 0; tick < 4; tick++) await flush();
  assert.deepEqual(
    app.writes,
    [['write', 'es'], ['clear']],
    'the write and the delete must land in the order they were requested',
  );
  assert.equal(app.storedNow(), null, 'nothing is left for the next launch to read back');
  passed('Automatic deletes the persisted choice so the next launch re-detects');

  // --- and the restart actually comes back in the device language --------
  const restarted = mountProvider({ deviceTags: ['en-US'], stored: app.storedNow() });
  await flush();
  assert.equal(restarted.render().locale, 'en');
  assert.equal(restarted.value().explicit, false, 'Automatic is still Automatic after a restart');
  passed('a relaunch after choosing Automatic follows the device, not the old choice');

  // --- rapid switches persist in order -----------------------------------
  app = mountProvider({ deviceTags: ['en-US'] });
  app.value().setLocale('es');
  app.render().setLocale('en');
  app.render().setLocale('es');
  for (let tick = 0; tick < 8; tick++) await flush();
  assert.deepEqual(app.writes, [['write', 'es'], ['write', 'en'], ['write', 'es']]);
  assert.equal(app.storedNow(), 'es', 'the last choice is what survives');
  passed('rapid switches are serialised, so the last tap is the one that persists');

  // --- an unreadable keychain must not block -----------------------------
  const runtime = hookRuntime();
  const failing = loader({
    react: { ...runtime.react, createElement: () => null },
    'react/jsx-runtime': { jsx: (type, props) => ({ type, props }) },
    './device': { deviceLanguageTags: () => ['es-MX'] },
    './storage': {
      // The real adapter swallows errors; this one resolves null like it does.
      readStoredLocale: async () => null,
      writeStoredLocale: async () => {},
      clearStoredLocale: async () => {},
    },
  })('src/lib/i18n/LocaleProvider.tsx');
  const tree = runtime.render(() => failing.LocaleProvider({ children: null }));
  assert.equal(tree.props.value.locale, 'es');
  await flush();
  assert.equal(runtime.render(() => failing.LocaleProvider({ children: null })).props.value.locale, 'es');
  passed('an unreadable keychain leaves the app in the detected language');
}

/* ------------------------------------------------------------------ *
 * 2. Screens render real translations
 * ------------------------------------------------------------------ */

/** Collects every string rendered anywhere in a tree of mock elements. */
function textOf(node, out = []) {
  if (node === null || node === undefined || node === false) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (typeof node === 'number') return out;
  if (Array.isArray(node)) {
    node.forEach((child) => textOf(child, out));
    return out;
  }
  if (typeof node !== 'object') return out;
  for (const [key, value] of Object.entries(node.props ?? {})) {
    if (typeof value === 'string' && /label|title|placeholder|hint|text/i.test(key)) out.push(value);
    if (key === 'children') textOf(value, out);
  }
  return out;
}

/** A translator over the real dictionaries, matching the provider's contract. */
function i18nFor(locale) {
  const load = loader();
  const { dictionaries } = load('src/lib/i18n/dictionaries/index.ts');
  const { createTranslate } = load('src/lib/i18n/translate.ts');
  const format = load('src/lib/i18n/format.ts');
  const t = createTranslate({ locale, dictionary: dictionaries[locale], fallback: dictionaries.en });
  return {
    locale,
    detected: locale,
    explicit: false,
    t,
    tKey: t,
    setLocale: () => {},
    useDeviceLocale: () => {},
    formatDate: (v, o) => format.formatDate(v, locale, o),
    formatDateTime: (v, o) => format.formatDateTime(v, locale, o),
    formatTime: (v, o) => format.formatTime(v, locale, o),
    formatNumber: (v, o) => format.formatNumber(v, locale, o),
    formatRelativeDate: (v) => format.formatRelativeDate(v, locale, t),
    formatBytes: (b) => format.formatBytes(b, locale),
  };
}

function testScreens() {
  const runtime = hookRuntime();
  const rendered = {};

  const screenLoader = (locale) =>
    loader({
      react: { ...runtime.react, createElement: (type, props) => ({ type, props }) },
      'react/jsx-runtime': {
        jsx: (type, props) => ({ type, props }),
        jsxs: (type, props) => ({ type, props }),
      },
      'react-native': new Proxy(
        {
          Platform: { OS: 'ios' },
          Alert: { alert: () => {} },
          Linking: { openURL: async () => {} },
          Keyboard: { dismiss: () => {} },
        },
        { get: (target, prop) => (prop in target ? target[prop] : String(prop)) },
      ),
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'expo-router': { Link: 'Link', router: { push: () => {}, replace: () => {} } },
      '@expo/vector-icons': { Feather: 'Feather' },
      '@/components/auth/SocialSignIn': { SocialSignIn: 'SocialSignIn' },
      '@/components/settings/LanguageSelector': { LanguageSelector: 'LanguageSelector' },
      '@/components/ui/Button': { Button: 'Button' },
      '@/lib/api': { api: {} },
      '@/lib/auth': { useAuth: () => ({ signIn: async () => ({ error: null }), signInWithSession: async () => {} }) },
      '@/lib/env': { ENV: { API_BASE_URL: 'https://fixture.invalid' } },
      '@/lib/theme': { useResolvedColors: () => ({ muted: '#888', accent: '#f60' }), useTheme: () => ({ resolved: 'light' }) },
      '@/lib/i18n': { useI18n: () => rendered.i18n, useTranslate: () => rendered.i18n.t },
    });

  for (const locale of ['en', 'es']) {
    rendered.i18n = i18nFor(locale);
    const load = screenLoader(locale);
    for (const screen of ['app/(auth)/login.tsx', 'app/(auth)/signup.tsx']) {
      runtime.unmount();
      const Screen = load(screen).default;
      const text = textOf(runtime.render(Screen));
      assert.ok(text.length > 5, `${screen} rendered almost nothing in ${locale}`);
      const untranslated = text.filter((value) => /^[a-z]+(\.[A-Za-z_]+){2,}$/.test(value));
      assert.deepEqual(
        untranslated,
        [],
        `${screen} rendered raw translation keys in ${locale}: ${untranslated.join(', ')}`,
      );
      rendered[`${screen}:${locale}`] = text;
    }
  }

  // The two languages must actually differ, and differ in the agreed words.
  const loginEs = rendered['app/(auth)/login.tsx:es'].join(' | ');
  const loginEn = rendered['app/(auth)/login.tsx:en'].join(' | ');
  assert.notEqual(loginEs, loginEn, 'the login screen renders identically in both languages');
  assert.ok(loginEs.includes('Iniciar sesión'), 'login must offer to iniciar sesión');
  assert.ok(loginEs.includes('bandeja'), 'login should mention the bandeja');
  assert.ok(loginEn.includes('Sign in'));
  passed('the login screen renders real Spanish and English, with no leaked keys');

  const signupEs = rendered['app/(auth)/signup.tsx:es'].join(' | ');
  assert.ok(signupEs.includes('Crear cuenta'), 'signup must offer to crear cuenta');
  assert.ok(signupEs.includes('Contraseña'), 'the password field is translated');
  assert.ok(
    signupEs.includes('Términos del Servicio') && signupEs.includes('Política de Privacidad'),
    'the legal links are translated',
  );
  assert.ok(
    signupEs.includes('Anthropic, OpenAI y Voyage AI'),
    'provider names stay as brands inside the translated consent sentence',
  );
  assert.notEqual(signupEs, rendered['app/(auth)/signup.tsx:en'].join(' | '));
  passed('the signup screen translates its copy while keeping brand names intact');
}

/* ------------------------------------------------------------------ *
 * 3. The selector is reachable from both auth and settings
 * ------------------------------------------------------------------ */
function testSelectorPlacement() {
  const surfaces = [
    'app/(auth)/login.tsx',
    'app/(auth)/signup.tsx',
    'app/(app)/(tabs)/settings.tsx',
  ];
  for (const surface of surfaces) {
    const source = fs.readFileSync(path.join(root, surface), 'utf8');
    assert.ok(
      source.includes('LanguageSelector'),
      `${surface} must expose the language selector — someone in the wrong language needs a way out before signing in`,
    );
  }
  passed('the language selector is reachable from the auth screens and from settings');
}

(async () => {
  await testProvider();
  testScreens();
  testSelectorPlacement();
  console.log(`${checks} native i18n screen scenarios passed`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
