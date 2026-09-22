const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
// Node has no keychain: the i18n layer's storage boundary (only) is in-memory.
const secureStore = (() => { const m = new Map(); return { getItemAsync: async k => m.get(k) ?? null, setItemAsync: async (k, v) => { m.set(k, v); }, deleteItemAsync: async k => { m.delete(k); } }; })();
function loader(overrides) {
  const mocks = { 'expo-secure-store': secureStore, '@expo/vector-icons': { Feather: 'Feather' }, ...overrides };
  const cache = new Map();
  function load(filename) {
    // Only regular files count: `@/lib/i18n` is a directory and resolves to its index.
    const base = path.resolve(root, filename);
    const isFile = candidate => { try { return fs.statSync(candidate).isFile(); } catch { return false; } };
    const full = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')].find(isFile);
    if (!full) throw new Error(`Cannot resolve module: ${base}`);
    if (cache.has(full)) return cache.get(full).exports;
    const mod = new Module(full, module);
    cache.set(full, mod);
    mod.filename = full;
    mod.paths = module.paths;
    mod.require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}`);
      if (id.startsWith('.')) return load(path.resolve(path.dirname(full), id));
      return require(id);
    };
    mod._compile(ts.transpileModule(fs.readFileSync(full, 'utf8'), {
      fileName: full,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText, full);
    return mod.exports;
  }
  return load;
}
function hooks() {
  let index = 0;
  const slots = [];
  let effects = [];
  return {
    react: {
      // No provider is mounted: components read the i18n layer's English fallback context.
      createContext: fallback => ({ fallback, Provider: 'Provider' }),
      useContext: context => context.current ?? context.fallback,
      useState(initial) {
        const id = index++;
        if (!slots[id]) slots[id] = { value: initial };
        return [slots[id].value, value => { slots[id].value = typeof value === 'function' ? value(slots[id].value) : value; }];
      },
      useRef(initial) { const id = index++; return slots[id] ??= { current: initial }; },
      useEffect(fn, deps) {
        const id = index++;
        if (!slots[id] || deps.some((d, i) => !Object.is(d, slots[id].deps[i]))) {
          effects.push(() => { slots[id]?.cleanup?.(); slots[id] = { deps, cleanup: fn() }; });
        }
      },
    },
    render(fn) { index = 0; effects = []; const tree = fn(); effects.forEach(fn => fn()); return tree; },
    reset() { slots.length = 0; index = 0; effects = []; },
    close() { slots.forEach(s => s?.cleanup?.()); },
  };
}
function find(tree, predicate) {
  if (!tree || typeof tree !== 'object') return null;
  if (predicate(tree)) return tree;
  for (const child of [tree.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}
const identity = { idToken: 'synthetic-token', email: 'fixture@example.com' };
const session = { token: 'synthetic-pb-token', userId: 'fixture-user', email: identity.email };
const consentError = { data: null, error: { code: 'AI_PROCESSING_CONSENT_REQUIRED', status: 400 } };
let checks = 0;
const passed = label => { checks++; console.log(`PASS ${label}`); };
(async () => {
  const calls = [];
  const sdk = { GoogleSignin: {
    configure: options => calls.push(['configure', options]),
    signOut: async () => calls.push(['signOut']),
    signIn: async () => ({ type: 'success', data: { idToken: identity.idToken, user: { email: identity.email } } }),
  }, statusCodes: { SIGN_IN_CANCELLED: 'cancelled' }, isErrorWithCode: e => typeof e?.code === 'string' };
  const native = loader({ './env': { ENV: { GOOGLE_IOS_CLIENT_ID: 'ios.apps.googleusercontent.com', GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' } }, '@react-native-google-signin/google-signin': sdk })('src/lib/googleSignIn.ios.ts');
  assert.deepEqual(await native.requestGoogleIdentity(), identity);
  assert.deepEqual(calls[0], ['configure', { iosClientId: 'ios.apps.googleusercontent.com', webClientId: 'web.apps.googleusercontent.com', offlineAccess: false }]);
  assert.equal(calls[1][0], 'signOut');
  await native.requestGoogleIdentity();
  assert.equal(calls.filter(c => c[0] === 'configure').length, 1);
  assert.equal(calls.filter(c => c[0] === 'signOut').length, 4);
  passed('native uses existing server audience, configures once and clears prior Google selection');
  sdk.GoogleSignin.signIn = async () => ({ type: 'cancelled', data: null });
  assert.equal(await native.requestGoogleIdentity(), null);
  sdk.GoogleSignin.signIn = async () => { throw { code: 'cancelled' }; };
  assert.equal(await native.requestGoogleIdentity(), null);
  passed('native cancellation is silent in both SDK response shapes');
  sdk.GoogleSignin.signIn = async () => ({ type: 'success', data: { idToken: null, user: {} } });
  await assert.rejects(native.requestGoogleIdentity, /GOOGLE_TOKEN_MISSING/);
  const missing = loader({ './env': { ENV: {} } })('src/lib/googleSignIn.ios.ts');
  await assert.rejects(missing.requestGoogleIdentity, /GOOGLE_NOT_CONFIGURED/);
  passed('missing configuration/token never reaches backend');

  const androidCalls = [];
  const androidSdk = { ...sdk, statusCodes: { ...sdk.statusCodes, PLAY_SERVICES_NOT_AVAILABLE: 'play-unavailable' }, GoogleSignin: {
    configure: options => androidCalls.push(['configure', options]),
    hasPlayServices: async options => { androidCalls.push(['services', options]); return true; },
    signOut: async () => androidCalls.push(['signOut']),
    signIn: async () => ({ type: 'success', data: { idToken: identity.idToken, user: { email: identity.email } } }),
  } };
  const android = loader({ './env': { ENV: { GOOGLE_WEB_CLIENT_ID: 'web.apps.googleusercontent.com' } }, '@react-native-google-signin/google-signin': androidSdk })('src/lib/googleSignIn.android.ts');
  assert.deepEqual(await android.requestGoogleIdentity(), identity);
  assert.deepEqual(androidCalls[0], ['configure', { webClientId: 'web.apps.googleusercontent.com', offlineAccess: false }]);
  assert.deepEqual(androidCalls[1], ['services', { showPlayServicesUpdateDialog: true }]);
  await android.requestGoogleIdentity();
  assert.equal(androidCalls.filter(c => c[0] === 'configure').length, 1);
  assert.equal(androidCalls.filter(c => c[0] === 'signOut').length, 4);
  passed('Android uses shared web audience, checks Play services and clears SDK sessions');
  androidSdk.GoogleSignin.hasPlayServices = async () => false;
  await assert.rejects(android.requestGoogleIdentity, /GOOGLE_PLAY_SERVICES_UNAVAILABLE/);
  androidSdk.GoogleSignin.hasPlayServices = async () => { throw { code: 'play-unavailable' }; };
  await assert.rejects(android.requestGoogleIdentity, /GOOGLE_PLAY_SERVICES_UNAVAILABLE/);
  androidSdk.GoogleSignin.hasPlayServices = async () => true;
  for (const [code, expected] of [['10', 'GOOGLE_NOT_CONFIGURED'], ['7', 'NETWORK_ERROR']]) {
    androidSdk.GoogleSignin.signIn = async () => { throw { code }; };
    await assert.rejects(android.requestGoogleIdentity, new RegExp(expected));
  }
  passed('Android missing services, signing mismatch and network errors are recoverable');
  androidSdk.GoogleSignin.signIn = async () => ({ type: 'cancelled', data: null });
  assert.equal(await android.requestGoogleIdentity(), null);
  androidSdk.GoogleSignin.signIn = async () => { throw { code: 'cancelled' }; };
  assert.equal(await android.requestGoogleIdentity(), null);
  androidSdk.GoogleSignin.signIn = async () => ({ type: 'success', data: { idToken: null, user: {} } });
  await assert.rejects(android.requestGoogleIdentity, /GOOGLE_TOKEN_MISSING/);
  await assert.rejects(loader({ './env': { ENV: {} } })('src/lib/googleSignIn.android.ts').requestGoogleIdentity, /GOOGLE_NOT_CONFIGURED/);
  passed('Android cancellation, missing token and missing configuration never create sessions');

  const { exchangeGoogleIdentity } = loader({})('src/lib/googleAuth.ts');
  const sent = [];
  assert.deepEqual(await exchangeGoogleIdentity(identity, async (...args) => { sent.push(args); return consentError; }), { type: 'consent', identity });
  assert.deepEqual(sent[0], [identity.idToken, identity.email, false]);
  assert.deepEqual(await exchangeGoogleIdentity(identity, async (...args) => { sent.push(args); return { data: session, error: null }; }, true), { type: 'session', session });
  assert.deepEqual(sent[1], [identity.idToken, identity.email, true]);
  passed('new-account consent is explicit and retry preserves selected identity');
  for (const code of ['INVALID_TOKEN', 'NETWORK_ERROR', 'EMAIL_IN_USE', 'RATE_LIMITED', 'SERVER_ERROR']) {
    const result = await exchangeGoogleIdentity(identity, async () => ({ data: null, error: { code } }));
    assert.equal(result.type, 'error');
    // Errors are translation keys now; the raw server code must never be the copy.
    assert.match(result.messageKey, /^auth\.social\.errors\./);
    assert.ok(!result.messageKey.includes(code));
  }
  assert.equal((await exchangeGoogleIdentity(identity, async () => ({ data: {}, error: null }))).type, 'error');
  passed('provider/server errors are recoverable and malformed sessions are rejected');

  let platform;
  function fixture(exchange, getIdentity = async () => identity, props = {}) {
    const runner = hooks();
    const saved = [], routes = [], exchanges = [];
    let nativeCalls = 0;
    const load = loader({
      react: runner.react,
      'expo-apple-authentication': { isAvailableAsync: async () => true, AppleAuthenticationScope: { FULL_NAME: 1, EMAIL: 2 }, AppleAuthenticationButtonType: { CONTINUE: 1 }, AppleAuthenticationButtonStyle: { WHITE: 1, BLACK: 2 }, AppleAuthenticationButton: 'AppleButton', signInAsync: async () => { nativeCalls++; const id = await getIdentity(); return { identityToken: id.idToken, email: id.email, authorizationCode: 'one-time-code' }; } },
      '@/lib/theme': { useTheme: () => ({ resolved: 'dark' }) },
      'react-native': { Platform: { OS: platform }, Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Linking: { openURL: async () => {} } },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'expo-router': { router: { replace: route => routes.push(route) } },
      '@/components/ui/Button': { Button: 'Button' },
      '@/lib/api': { api: { authGoogle: async (...args) => { exchanges.push(args); return exchange(...args); }, authApple: async (token, email, code, consent) => { assert.equal(code, 'one-time-code'); exchanges.push([token, email, consent]); return exchange(token, email, consent); } } },
      '@/lib/auth': { useAuth: () => ({ signInWithSession: async value => saved.push(value) }) },
      '@/lib/env': { ENV: { API_BASE_URL: 'https://fixture.invalid' } },
      '@/lib/googleSignIn': { requestGoogleIdentity: async () => { nativeCalls++; return getIdentity(); } },
    });
    const { SocialSignIn: GoogleSignIn } = load('src/components/auth/SocialSignIn.tsx');
    const onBusyChange = () => {};
    const render = () => runner.render(() => GoogleSignIn({ onBusyChange, ...props }));
    const button = title => find(render(), el => el.props?.title === title);
    return { runner, render, button, saved, routes, exchanges, nativeCalls: () => nativeCalls };
  }
  for (platform of ['ios', 'android']) {
    let f = fixture(async () => ({ data: session, error: null }));
    await f.button('Continue with Google').props.onPress();
    assert.deepEqual(f.saved, [session]);
    assert.deepEqual(f.routes, ['/inbox']);
    assert.equal(find(f.render(), e => e.type === 'Modal').props.visible, false);
    passed('existing Google user goes straight to shared session and inbox');
    f = fixture(async (_token, _email, consent) => consent ? { data: session, error: null } : consentError);
    await f.button('Continue with Google').props.onPress();
    assert.equal(f.saved.length, 0);
    assert.equal(find(f.render(), e => e.type === 'Modal').props.visible, true);
    assert.equal(f.button('Create account').props.disabled, true);
    await f.button('Create account').props.onPress();
    assert.equal(f.exchanges.length, 1);
    find(f.render(), e => e.props?.accessibilityLabel === 'Accept AI processing').props.onPress();
    assert.equal(f.button('Create account').props.disabled, true);
    await f.button('Create account').props.onPress();
    assert.equal(f.exchanges.length, 1);
    find(f.render(), e => e.props?.accessibilityLabel === 'Accept Terms of Service and Privacy Policy').props.onPress();
    await f.button('Create account').props.onPress();
    assert.deepEqual(f.saved, [session]);
    assert.equal(f.nativeCalls(), 1);
    passed('new Google user must check disclosure; selected token reused only after acceptance');
    f = fixture(async () => ({ data: session, error: null }), undefined, { disabled: true });
    await f.button('Continue with Google').props.onPress();
    assert.equal(f.nativeCalls(), 0);
    passed('disabled signup cannot start Google authentication');
    f = fixture(async () => consentError);
    await f.button('Continue with Google').props.onPress();
    f.button('Cancel').props.onPress();
    assert.equal(find(f.render(), e => e.type === 'Modal').props.visible, false);
    assert.equal(f.exchanges.length, 1);
    assert.equal(f.saved.length, 0);
    passed('declining consent creates no session and makes no second request');
    f = fixture(async () => { throw new Error('must not run'); }, async () => null);
    await f.button('Continue with Google').props.onPress();
    assert.equal(f.exchanges.length, 0);
    assert.equal(find(f.render(), e => e.props?.accessibilityRole === 'alert'), null);
    passed('Google sheet cancellation leaves login usable without an error');
    let resolve;
    f = fixture(async () => ({ data: session, error: null }), () => new Promise(r => { resolve = r; }));
    const pending = f.button('Continue with Google').props.onPress();
    await f.button('Continue with Google').props.onPress();
    assert.equal(f.nativeCalls(), 1);
    f.runner.close();
    resolve(identity);
    await pending;
    assert.equal(f.exchanges.length, 0);
    assert.equal(f.saved.length, 0);
    passed('duplicate taps coalesce and leaving login prevents late authentication');
    f = fixture(async (_token, _email, consent) => consent
      ? { data: null, error: { code: 'INVALID_GOOGLE_TOKEN' } }
      : consentError);
    await f.button('Continue with Google').props.onPress();
    find(f.render(), e => e.props?.accessibilityLabel === 'Accept AI processing').props.onPress();
    assert.equal(f.button('Create account').props.disabled, true);
    await f.button('Create account').props.onPress();
    assert.equal(f.exchanges.length, 1);
    find(f.render(), e => e.props?.accessibilityLabel === 'Accept Terms of Service and Privacy Policy').props.onPress();
    await f.button('Create account').props.onPress();
    assert.equal(f.saved.length, 0);
    assert.equal(find(f.render(), e => e.type === 'Modal').props.visible, false);
    assert.ok(find(f.render(), e => e.props?.accessibilityRole === 'alert'));
    assert.equal(f.button('Continue with Google').props.loading, false);
    await f.button('Continue with Google').props.onPress();
    assert.equal(f.nativeCalls(), 2);
    assert.equal(f.button('Create account').props.disabled, true);
    passed('expired consent exchange restores login; retry uses a fresh identity and unchecked consent');
  }
  platform = 'ios';
  for (const outcome of ['existing', 'new', 'cancel', 'expired']) {
    const f = fixture(async (_token, _email, consent) => outcome === 'existing' || (consent && outcome === 'new')
      ? { data: session, error: null }
      : consent ? { data: null, error: { code: 'INVALID_APPLE_TOKEN' } } : consentError,
      undefined, { provider: 'Apple' });
    f.render();
    await Promise.resolve();
    await find(f.render(), e => e.type === 'AppleButton').props.onPress();
    if (outcome === 'existing') { assert.deepEqual(f.saved, [session]); continue; }
    assert.equal(find(f.render(), e => e.type === 'Modal').props.visible, true);
    assert.equal(f.button('Create account').props.disabled, true);
    if (outcome === 'cancel') {
      f.button('Cancel').props.onPress();
      assert.equal(f.exchanges.length, 1);
      assert.equal(f.saved.length, 0);
      continue;
    }
    find(f.render(), e => e.props?.accessibilityLabel === 'Accept AI processing').props.onPress();
    await f.button('Create account').props.onPress();
    assert.equal(f.exchanges.length, 1);
    find(f.render(), e => e.props?.accessibilityLabel === 'Accept Terms of Service and Privacy Policy').props.onPress();
    await f.button('Create account').props.onPress();
    assert.equal(f.nativeCalls(), 1);
    assert.equal(f.exchanges[1][2], true);
    assert.equal(f.saved.length, outcome === 'new' ? 1 : 0);
    if (outcome === 'expired') assert.ok(find(f.render(), e => e.props?.accessibilityRole === 'alert'));
  }
  passed('Apple existing/new/cancel/expired flows preserve one-time code and require both acceptances');
  {
    const f = fixture(async () => ({ data: session, error: null }), async () => ({ idToken: 'apple-without-email' }), { provider: 'Apple' });
    f.render(); await Promise.resolve();
    await find(f.render(), e => e.type === 'AppleButton').props.onPress();
    assert.deepEqual(f.saved, [session]);
    assert.equal(f.exchanges[0][1], undefined);
    passed('Apple subsequent authorization can omit email while the server returns the account');
    const cancelled = fixture(async () => { throw Error('must not exchange'); }, async () => { throw { code: 'ERR_REQUEST_CANCELED' }; }, { provider: 'Apple' });
    cancelled.render(); await Promise.resolve();
    await find(cancelled.render(), e => e.type === 'AppleButton').props.onPress();
    assert.equal(cancelled.exchanges.length, 0);
    assert.equal(find(cancelled.render(), e => e.props?.accessibilityRole === 'alert'), null);
    passed('Apple sheet cancellation remains silent and does not exchange credentials');
  }

  {
    const runner = hooks();
    const requests = [], sessions = [], routes = [], links = [];
    let response = { data: session, error: null };
    const load = loader({
      react: runner.react,
      'react-native': { Platform: { OS: 'ios' }, KeyboardAvoidingView: 'KeyboardAvoidingView', View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', ScrollView: 'ScrollView', Linking: { openURL: async url => links.push(url) } },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'expo-router': { Link: 'Link', router: { push: route => routes.push(route), replace: route => routes.push(route) } },
      'expo-apple-authentication': { isAvailableAsync: async () => false },
      '@/components/auth/SocialSignIn': { SocialSignIn: 'SocialSignIn' },
      '@/components/ui/Button': { Button: 'Button' },
      '@/lib/api': { api: { registerEmail: async (...args) => { requests.push(args); if (response instanceof Error) throw response; return response; } } },
      '@/lib/auth': { useAuth: () => ({ signInWithSession: async value => sessions.push(value) }) },
      '@/lib/theme': { useResolvedColors: () => ({ muted: '#888', accent: '#f60' }), useTheme: () => ({ resolved: 'light' }) },
      '@/lib/env': { ENV: { API_BASE_URL: 'https://fixture.invalid' } },
    });
    const Login = load('app/(auth)/login.tsx').default;
    const login = runner.render(Login);
    find(login, e => e.props?.accessibilityRole === 'link').props.onPress();
    assert.deepEqual(routes, ['/(auth)/signup']);
    passed('Create one pushes the explicit signup screen');
    runner.close();
    runner.reset();
    const Signup = load('app/(auth)/signup.tsx').default;
    const render = () => runner.render(Signup);
    const field = name => find(render(), e => e.props?.placeholder === name);
    const button = () => find(render(), e => e.props?.title === 'Create account');
    field('Email').props.onChangeText(' Fixture@Example.com ');
    field('Password (min 8 chars)').props.onChangeText('fixture-password');
    field('Confirm password').props.onChangeText('fixture-password');
    assert.equal(button().props.disabled, true);
    await button().props.onPress();
    assert.equal(requests.length, 0);
    find(render(), e => e.props?.accessibilityLabel === 'Accept AI processing').props.onPress();
    await button().props.onPress();
    assert.equal(requests.length, 0);
    find(render(), e => e.props?.accessibilityLabel === 'Accept Terms of Service and Privacy Policy').props.onPress();
    assert.equal(button().props.disabled, false);
    field('Confirm password').props.onChangeText('different-password');
    await button().props.onPress();
    assert.equal(requests.length, 0);
    field('Confirm password').props.onChangeText('fixture-password');
    await find(render(), e => e.props?.accessibilityRole === 'link' && e.props?.children === 'Terms of Service').props.onPress();
    await find(render(), e => e.props?.accessibilityRole === 'link' && e.props?.children === 'Privacy Policy').props.onPress();
    assert.deepEqual(links, ['https://fixture.invalid/terms', 'https://fixture.invalid/privacy']);
    assert.equal(button().props.disabled, false);
    assert.equal(find(render(), e => e.type === 'SocialSignIn' && e.props.provider === 'Google').props.disabled, false);
    assert.ok(find(render(), e => e.type === 'SocialSignIn' && e.props.provider === 'Apple'));
    response = new Error('fixture network failure');
    await button().props.onPress();
    assert.equal(button().props.loading, false);
    assert.equal(sessions.length, 0);
    response = { data: session, error: null };
    await button().props.onPress();
    assert.deepEqual(requests.at(-1), ['fixture@example.com', 'fixture-password', undefined, true]);
    assert.deepEqual(sessions, [session]);
    assert.equal(routes.at(-1), '/inbox');
    passed('email signup requires both acceptances, recovers from network failure and saves the returned session');
  }
  console.log(`${checks} auth iOS/Android regression scenarios passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
