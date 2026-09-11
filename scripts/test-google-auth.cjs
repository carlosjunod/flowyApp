const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function loader(mocks) {
  const cache = new Map();
  function load(filename) {
    let full = path.resolve(root, filename);
    if (!fs.existsSync(full)) full += fs.existsSync(`${full}.ts`) ? '.ts' : '.tsx';
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
    assert.ok(!result.message.includes(code));
  }
  assert.equal((await exchangeGoogleIdentity(identity, async () => ({ data: {}, error: null }))).type, 'error');
  passed('provider/server errors are recoverable and malformed sessions are rejected');

  function fixture(exchange, getIdentity = async () => identity) {
    const runner = hooks();
    const saved = [], routes = [], exchanges = [];
    let nativeCalls = 0;
    const load = loader({
      react: runner.react,
      'react-native': { Platform: { OS: 'ios' }, Modal: 'Modal', View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Linking: { openURL: async () => {} } },
      'react-native-safe-area-context': { SafeAreaView: 'SafeAreaView' },
      'expo-router': { router: { replace: route => routes.push(route) } },
      '@/components/ui/Button': { Button: 'Button' },
      '@/lib/api': { api: { authGoogle: async (...args) => { exchanges.push(args); return exchange(...args); } } },
      '@/lib/auth': { useAuth: () => ({ signInWithSession: async value => saved.push(value) }) },
      '@/lib/env': { ENV: { API_BASE_URL: 'https://fixture.invalid' } },
      '@/lib/googleSignIn': { requestGoogleIdentity: async () => { nativeCalls++; return getIdentity(); } },
    });
    const { GoogleSignIn } = load('src/components/auth/GoogleSignIn.tsx');
    const onBusyChange = () => {};
    const render = () => runner.render(() => GoogleSignIn({ onBusyChange }));
    const button = title => find(render(), el => el.props?.title === title);
    return { runner, render, button, saved, routes, exchanges, nativeCalls: () => nativeCalls };
  }
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
  find(f.render(), e => e.props?.accessibilityRole === 'checkbox').props.onPress();
  await f.button('Create account').props.onPress();
  assert.deepEqual(f.saved, [session]);
  assert.equal(f.nativeCalls(), 1);
  passed('new Google user must check disclosure; selected token reused only after acceptance');
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
  find(f.render(), e => e.props?.accessibilityRole === 'checkbox').props.onPress();
  await f.button('Create account').props.onPress();
  assert.equal(f.saved.length, 0);
  assert.equal(find(f.render(), e => e.type === 'Modal').props.visible, false);
  assert.ok(find(f.render(), e => e.props?.accessibilityRole === 'alert'));
  assert.equal(f.button('Continue with Google').props.loading, false);
  await f.button('Continue with Google').props.onPress();
  assert.equal(f.nativeCalls(), 2);
  assert.equal(f.button('Create account').props.disabled, true);
  passed('expired consent exchange restores login; retry uses a fresh identity and unchecked consent');
  console.log(`${checks} Google iOS regression scenarios passed.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
