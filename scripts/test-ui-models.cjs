const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const scenarios = [];
const passed = name => scenarios.push(name);

// Exercise the real TypeScript models without importing native modules in Node.
function loader(mocks = {}) {
  const cache = new Map();
  function load(filename) {
    const absolute = path.resolve(root, filename);
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const mod = new Module(absolute, module);
    cache.set(absolute, mod);
    mod.filename = absolute;
    mod.paths = module.paths;
    mod.require = id => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}.ts`);
      if (id.startsWith('.')) return load(path.resolve(path.dirname(absolute), `${id}.ts`));
      return require(id);
    };
    const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      fileName: absolute,
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    mod._compile(source, absolute);
    return mod.exports;
  }
  return load;
}
function memoryStore() {
  const values = new Map();
  let fail = false;
  return {
    values, set fail(value) { fail = value; },
    async getItem(key) { return values.get(key) ?? null; },
    async setItem(key, value) { if (fail) throw new Error('Disk unavailable'); assert.ok(Buffer.byteLength(value, 'utf8') < 2048); values.set(key, value); },
    async removeItem(key) { values.delete(key); },
  };
}
function hookRunner() {
  let index = 0;
  const slots = [];
  let effects = [];
  let dirty = false;
  const react = {
    createContext: () => ({}), createElement: () => null, useContext: () => null,
    useState(initial) {
      const id = index++;
      if (!slots[id]) slots[id] = { value: typeof initial === 'function' ? initial() : initial };
      return [slots[id].value, value => { slots[id].value = typeof value === 'function' ? value(slots[id].value) : value; dirty = true; }];
    },
    useRef(value) { const id = index++; if (!slots[id]) slots[id] = { current: value }; return slots[id]; },
    useEffect(effect, deps) {
      const id = index++;
      const previous = slots[id];
      if (!previous || deps.some((d, i) => !Object.is(d, previous.deps[i]))) {
        effects.push(() => { previous?.cleanup?.(); slots[id] = { deps, cleanup: effect() }; });
      }
    },
  };
  return { react, render(callback) {
    let result;
    do { dirty = false; index = 0; effects = []; result = callback(); const run = effects; effects = []; run.forEach(effect => effect()); } while (dirty);
    return result;
  }, close() { slots.forEach(slot => slot?.cleanup?.()); } };
}
function streamQueue() {
  const values = [];
  let waiting;
  return {
    push(value) { if (waiting) { const resolve = waiting; waiting = null; resolve({ value, done: false }); } else values.push({ value, done: false }); },
    finish() { if (waiting) { const resolve = waiting; waiting = null; resolve({ done: true }); } else values.push({ done: true }); },
    [Symbol.asyncIterator]() { return this; },
    next() { return values.length ? Promise.resolve(values.shift()) : new Promise(resolve => { waiting = resolve; }); },
    return() { return Promise.resolve({ done: true }); },
  };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const digest = loader()('src/lib/digestSettings.ts');
  for (const time of ['00:00', '08:05', '12:00', '23:59']) assert.equal(digest.timePickerValue(digest.timePickerDate(time)), time);
  assert.equal(digest.resumeAtDate('2026-09-18', 'America/Bogota'), '2026-09-18T05:00:00.000Z');
  assert.equal(digest.resumeAtDate('2026-03-08', 'America/New_York'), '2026-03-08T05:00:00.000Z');
  assert.equal(digest.resumeAtDate('2026-03-09', 'America/New_York'), '2026-03-09T04:00:00.000Z');
  assert.equal(digest.resumeAtDate('2026-11-02', 'America/New_York'), '2026-11-02T05:00:00.000Z');
  assert.equal(digest.resumeAtDate('2026-09-06', 'America/Santiago'), '2026-09-06T04:00:00.000Z', 'skipped midnight resumes at first valid hour of requested date');
  assert.equal(digest.resumeAtDate('2026-09-18', 'Pacific/Kiritimati'), '2026-09-17T10:00:00.000Z');
  assert.equal(digest.resumeAtDate('2026-09-18', 'Asia/Kathmandu'), '2026-09-17T18:15:00.000Z');
  passed('Digest native pickers preserve wall time and resume dates across DST, midnight gaps and fractional offsets');
  assert.deepEqual(digest.exclusionChoices(['design', 'design'], ['legacy', 'private']), ['design', 'legacy', 'private']);
  assert.deepEqual(digest.toggleExclusion(['receipt', 'note', 'old-type'], 'note'), ['receipt', 'old-type']);
  assert.deepEqual(digest.toggleExclusion(['receipt', 'old-type'], 'pdf'), ['receipt', 'old-type', 'pdf']);
  const savedDigest = { locale: 'en', weekly_day: 1, excluded_categories: ['a','b'], excluded_types: ['note'] };
  assert.equal(digest.preferencesChanged(savedDigest, {...savedDigest, excluded_categories: ['b','a']}), false);
  assert.equal(digest.preferencesChanged(savedDigest, {...savedDigest, weekly_day: 7}), true);
  assert.equal(digest.preferencesChanged(savedDigest, {...savedDigest, excluded_types: []}), true);
  assert.ok(digest.digestTimezones('Pacific/Kiritimati').includes('Pacific/Kiritimati'));
  passed('Digest inclusion toggles preserve unknown exclusions and detect only meaningful unsaved changes');
  let digestCategoryQuery;
  const digestCategoryCalls = [];
  const categoryHook = loader({
    '@tanstack/react-query': { useQuery: options => { digestCategoryQuery = options; return options; } },
    '@/lib/auth': { useAuth: () => ({user:{id:'account-a'}}) },
    '@/lib/pb': { pb: { filter: (expression, values) => { digestCategoryCalls.push({expression,values}); return 'owned'; }, collection: name => { assert.equal(name,'items'); return { getFullList: async options => { assert.equal(options.fields,'category'); assert.equal(options.filter,'owned'); return [{category:'Tech'},{category:'technology'},{category:'  Design '},{category:'Tech'},{category:''}]; } }; } } },
  })('src/hooks/useDigestCategories.ts');
  categoryHook.useDigestCategories();
  assert.deepEqual(digestCategoryQuery.queryKey, ['digest-categories','account-a']);
  assert.deepEqual(await digestCategoryQuery.queryFn(), ['  Design ', 'Tech', 'technology']);
  assert.deepEqual(digestCategoryCalls[0].values, {user:'account-a'});
  passed('Digest category query is account-scoped and preserves exact stored values required by exclusion filters');

  const digestRunner = hookRunner();
  const initialDigest = {timezone:'America/Bogota',locale:'en',weekly_enabled:true,weekly_day:1,weekly_local_time:'08:00',weekly_push_enabled:false,weekly_email_enabled:false,daily_enabled:false,daily_local_time:'20:00',daily_push_enabled:false,daily_email_enabled:false,paused_until:null,excluded_types:['receipt','email','note','legacy-type'],excluded_categories:['Private']};
  const digestView = {revision:4,settings:initialDigest,effectivePlan:'free',canEnableDaily:false,capabilities:{enabled:true,push:false,email:false},emailVerified:false};
  const digestRequests = [];
  let releaseDigestSave;
  const tree = (type, props) => ({type,props});
  const Screen = loader({
    react: digestRunner.react, 'react/jsx-runtime': {jsx:tree,jsxs:tree},
    'react-native': {ActivityIndicator:'ActivityIndicator',Alert:{alert(){}},Pressable:'Pressable',ScrollView:'ScrollView',Switch:'Switch',Text:'Text',View:'View'},
    'react-native-safe-area-context': {SafeAreaView:'SafeAreaView'},
    'expo-router': {router:{back(){},push(){}},useNavigation:()=>({dispatch(){}})},
    '@react-navigation/native': {usePreventRemove(){}},
    '@/components/ui/AppIcon': {AppIcon:'AppIcon'},
    '@/components/digest/DigestControls': {DigestAction:'DigestAction',DigestChip:'DigestChip',DigestSection:'DigestSection',DigestTimezone:'DigestTimezone'},
    '@/components/digest/DigestDateField': {DigestDateField:'DigestDateField'},
    '@/lib/digestAppearance': {useDigestColors:()=>({}), useDigestVars:()=>({})},
    '@/hooks/useDigestCategories': {useDigestCategories:()=>({data:['Design','Private'],isPending:false,isError:false})},
    '@/hooks/usePushRegistration': {registerPushForCurrentUser:async()=>''},
    '@/lib/api': {api:{getDigestSettings:async()=>({data:digestView,error:null}),patchDigestSettings:payload=>{digestRequests.push(payload);return new Promise(resolve=>{releaseDigestSave=resolve;});}}},
  })('app/(app)/digest-settings.tsx').default;
  const nodes = value => !value ? [] : Array.isArray(value) ? value.flatMap(nodes) : typeof value === 'object' ? [value,...nodes(value.props?.children)] : [];
  let digestTree = digestRunner.render(Screen); await tick(); digestTree = digestRunner.render(Screen);
  const findDigest = (type, predicate) => nodes(digestTree).find(node=>node.type===type && predicate(node.props)).props;
  assert.equal(findDigest('Switch',props=>props.accessibilityLabel==='daily digest').disabled,true);
  assert.equal(findDigest('Switch',props=>props.accessibilityLabel==='weekly push').disabled,true);
  findDigest('DigestChip',props=>props.label==='Design').onPress();
  digestTree=digestRunner.render(Screen);
  findDigest('DigestChip',props=>props.label==='Private notes').onPress();
  digestTree=digestRunner.render(Screen);
  findDigest('DigestDateField',props=>props.label==='weekly publication time').onChange('23:59');
  digestTree=digestRunner.render(Screen);
  const saveDigest=findDigest('Pressable',props=>props.accessibilityLabel==='Save choices');
  saveDigest.onPress();saveDigest.onPress();
  assert.equal(digestRequests.length,1);
  assert.equal(digestRequests[0].expected_revision,4);
  assert.equal(digestRequests[0].weekly_local_time,'23:59');
  assert.deepEqual(digestRequests[0].excluded_categories,['Private','Design']);
  assert.deepEqual(digestRequests[0].excluded_types,['receipt','email','legacy-type']);
  releaseDigestSave({data:null,error:{status:409}});await tick();digestTree=digestRunner.render(Screen);
  assert.equal(findDigest('Pressable',props=>props.accessibilityLabel==='Save choices').disabled,true);
  assert.equal(findDigest('DigestChip',props=>props.label==='Design').selected,false);
  assert.ok(findDigest('DigestAction',props=>props.title==='Reload saved choices'));
  digestRunner.close();
  passed('Digest screen preserves exclusions, gates plan/channels, submits HH:MM with revision, rejects double saves and keeps edits after conflict');

  const profileModel = loader()('src/lib/personalization.ts');
  const emptyProfile = { occupation: '', currentFocus: '', preferences: '', enabled: false, onboardingDismissed: false, revision: 0, updatedAt: null };
  const savedProfile = { ...emptyProfile, occupation: 'Developer', currentFocus: 'Building Flowy', enabled: true, onboardingDismissed: true, revision: 2, updatedAt: '2026-09-10T00:00:00Z' };
  assert.equal(profileModel.shouldInvitePersonalization(emptyProfile), true);
  assert.equal(profileModel.shouldInvitePersonalization({ ...emptyProfile, onboardingDismissed: true }), false);
  assert.equal(profileModel.shouldInvitePersonalization({ ...savedProfile, enabled: false, onboardingDismissed: false }), false);
  assert.equal(profileModel.hasPersonalization({ ...emptyProfile, occupation: '  ' }), false);
  assert.deepEqual(profileModel.normalizePersonalization({ ...profileModel.personalizationDraft(savedProfile), occupation: ' Developer ', preferences: ' Keep it concise\n' }), { occupation: 'Developer', currentFocus: 'Building Flowy', preferences: 'Keep it concise', enabled: true, onboardingDismissed: true, revision: 2 });
  assert.match(profileModel.personalizationError({ code: 'PERSONALIZATION_CONFLICT' }), /edits are still here/);
  assert.equal(profileModel.initialPersonalizationDraft({ ...emptyProfile, onboardingDismissed: true, revision: 1 }).enabled, true, 'returning after dismissal should offer enabled setup');
  assert.equal(profileModel.initialPersonalizationDraft({ ...savedProfile, enabled: false }).enabled, false, 'existing paused answers stay paused');
  for (const code of ['INVALID_PERSONALIZATION', 'BODY_TOO_LARGE', 'INVALID_BODY']) assert.match(profileModel.personalizationError({ code }), /character limits/);
  passed('Personalization invitation respects dismissals, paused profiles and trimmed explicit answers');

  const profileAuth = { token: 'token-a', model: { id: 'account-a' } };
  const profileApi = loader({ './env': { ENV: { API_BASE_URL: 'https://fixture.invalid' } }, './pb': { pb: { authStore: profileAuth } } })('src/lib/api.ts').api;
  const originalFetch = global.fetch;
  const profileRequests = [];
  let releaseProfile;
  global.fetch = async (url, init) => {
    profileRequests.push({ url, init });
    return new Promise(resolve => { releaseProfile = body => resolve(new Response(JSON.stringify(body), { status: 200 })); });
  };
  try {
    const wrongAccount = await profileApi.getPersonalization('account-b');
    assert.equal(wrongAccount.error.code, 'UNAUTHORIZED');
    assert.equal(profileRequests.length, 0);
    const inFlight = profileApi.savePersonalization('account-a', profileModel.personalizationDraft(savedProfile));
    assert.equal(profileRequests[0].init.headers.Authorization, 'Bearer token-a');
    assert.deepEqual(JSON.parse(profileRequests[0].init.body), profileModel.personalizationDraft(savedProfile));
    profileAuth.model = { id: 'account-b' }; profileAuth.token = 'token-b';
    releaseProfile({ data: savedProfile, error: null });
    assert.equal((await inFlight).error.code, 'UNAUTHORIZED', 'late old-session profile must be discarded');
    const clearing = profileApi.clearPersonalization('account-b', 8);
    assert.equal(profileRequests.at(-1).init.method, 'DELETE');
    assert.deepEqual(JSON.parse(profileRequests.at(-1).init.body), { revision: 8 });
    releaseProfile({ data: { ...emptyProfile, revision: 9, onboardingDismissed: true }, error: null });
    assert.equal((await clearing).data.revision, 9);
  } finally { global.fetch = originalFetch; }
  passed('Personalization REST captures session, rejects cross-account results and sends CAS revisions');

  const profileRunner = hookRunner();
  let profileQuery;
  const profileCacheWrites = [];
  const cancelKeys = [];
  let saveCount = 0;
  let releaseSave;
  const queryClient = { cancelQueries: async ({ queryKey }) => cancelKeys.push(queryKey), setQueryData: (key, data) => profileCacheWrites.push({ key, data }) };
  const profileModule = loader({
    react: profileRunner.react,
    '@tanstack/react-query': { useQuery: options => { profileQuery = options; return { data: savedProfile }; }, useQueryClient: () => queryClient },
    '@/lib/pb': { pb: { authStore: profileAuth } },
    '@/lib/api': { api: {
      getPersonalization: async () => ({ data: savedProfile, error: null }),
      savePersonalization: async () => { saveCount++; return new Promise(resolve => { releaseSave = resolve; }); },
      clearPersonalization: async () => ({ data: { ...emptyProfile, revision: 3, onboardingDismissed: true }, error: null }),
    } },
  })('src/hooks/usePersonalization.ts');
  profileAuth.model = { id: 'account-a' };
  let profileHook = profileRunner.render(() => profileModule.usePersonalization('account-a'));
  assert.deepEqual(profileQuery.queryKey, ['personalization', 'account-a']);
  assert.equal((await profileQuery.queryFn({ signal: new AbortController().signal })).occupation, 'Developer');
  const firstSave = profileHook.save(profileModel.personalizationDraft(savedProfile));
  const duplicateSave = profileHook.save(profileModel.personalizationDraft(savedProfile));
  await tick();
  assert.equal(saveCount, 1);
  assert.equal(await duplicateSave, null);
  releaseSave({ data: null, error: { code: 'PERSONALIZATION_CONFLICT', status: 409 } });
  assert.equal(await firstSave, null);
  profileHook = profileRunner.render(() => profileModule.usePersonalization('account-a'));
  assert.equal(profileHook.mutationError.code, 'PERSONALIZATION_CONFLICT');
  assert.equal(profileCacheWrites.length, 0, 'conflict cannot replace the saved profile with a draft');
  passed('Personalization mutations prevent duplicate saves and preserve cache on revision conflict');
  const secondSave = profileHook.save(profileModel.personalizationDraft(savedProfile));
  await tick();
  profileAuth.model = { id: 'account-b' };
  profileHook = profileRunner.render(() => profileModule.usePersonalization('account-b'));
  releaseSave({ data: savedProfile, error: null });
  assert.equal(await secondSave, null);
  assert.equal(profileCacheWrites.length, 0, 'late save cannot repopulate a signed-out account cache');
  profileHook = profileRunner.render(() => profileModule.usePersonalization('account-b'));
  assert.equal(profileHook.pending, false);
  assert.equal(profileHook.mutationError, null);
  assert.deepEqual(profileQuery.queryKey, ['personalization', 'account-b']);
  await profileHook.clear(2);
  assert.deepEqual(profileCacheWrites.at(-1).key, ['personalization', 'account-b']);
  assert.equal(profileCacheWrites.at(-1).data.enabled, false);
  assert.equal(profileCacheWrites.at(-1).data.onboardingDismissed, true);
  assert.ok(cancelKeys.every(key => key[0] === 'personalization'));
  profileRunner.close();
  passed('Personalization account switch drops stale saves; clear publishes disabled dismissed profile');

  const citations = loader()('src/lib/chatCitations.ts');
  const citationItems = [
    { id: 'known', type: 'instagram', title: 'A long title', site_name: '   ', source_url: 'https://www.instagram.com/p/one' },
    { id: 'another', type: 'file', title: 'Local document' },
  ];
  const prepared = citations.prepareCitations('First [[missing]] then [[known]] and again [[known]], finally [[another]].');
  assert.deepEqual([...prepared.indexById], [['missing', 1], ['known', 2], ['another', 3]]);
  assert.ok(prepared.content.includes('[2](item://known)'));
  passed('Source numbering preserves repeated references and gaps for missing metadata');
  assert.equal(citations.prepareCitations('Answer [[unfinished').content, 'Answer ');
  assert.equal(citations.prepareCitations('Answer [[unfinished]').content, 'Answer ');
  assert.equal(citations.prepareCitations('Answer [[known]]').content, 'Answer [1](item://known)');
  passed('Streaming citations remain hidden until their token is complete');
  assert.equal(citations.domainLabelForRef(citationItems[0]), 'instagram.com');
  assert.equal(citations.domainLabelForRef(citationItems[1]), 'File');
  assert.equal(citations.domainLabelForRef({ ...citationItems[0], source_url: 'bad url', raw_url: 'https://example.com/x' }), 'example.com');
  passed('Source cards show publisher or domain instead of repeating the title');
  assert.equal(citations.copyWithCitations('Saved [[known]]', citationItems), 'Saved [1] https://www.instagram.com/p/one');
  passed('Copied answers retain their source references');
  const model = loader()('src/lib/chatModel.ts');
  const restored = model.restoreChat({ activeId: 'c', conversations: [{ id: 'c', title: 'Saved', draft: 'Draft ✨', updated: 1, messages: [{ id: 'a', role: 'assistant', content: 'Partial', streaming: true, citations: [{ id: 'valid', type: 'url', title: 'Source' }, { id: 'bad', type: 'url', title: {} }] }] }] });
  assert.equal(restored.conversations[0].messages[0].interrupted, true);
  assert.equal(restored.conversations[0].messages[0].streaming, false);
  assert.equal(restored.conversations[0].messages[0].citations.length, 1);
  assert.equal(restored.conversations[0].draft, 'Draft ✨');
  passed('Restore validation and interrupted response recovery');
  assert.ok(model.restoreChat(null).activeId);
  passed('First-run snapshot');
  assert.deepEqual(model.retryTurn([{ id: '1', role: 'user', content: 'First' }, { id: '2', role: 'assistant', content: 'Answer' }, { id: '3', role: 'user', content: 'Again' }, { id: '4', role: 'assistant', content: '', error: 'offline' }]), { question: 'Again', history: [{ id: '1', role: 'user', content: 'First' }, { id: '2', role: 'assistant', content: 'Answer' }] });

  passed('Retry preserves prior context');
  const store = memoryStore();
  const { createChatStorage } = loader({ './secureStore': { localSecureStore: store } })('src/lib/chatStorage.ts');
  const storage = createChatStorage(store);
  const long = model.emptyChat();
  long.conversations[0].draft = 'á😀🚀'.repeat(2200);
  await storage.write('account-a', long);
  assert.deepEqual(await storage.read('account-a'), long);
  passed('Unicode-safe chunked storage');
  assert.equal(await storage.read('account-b'), null);
  passed('Account storage isolation');
  const newer = model.emptyChat();
  await Promise.all([storage.write('account-a', long), storage.write('account-a', newer)]);
  assert.deepEqual(await storage.read('account-a'), newer, 'later snapshot wins serialized writes');
  passed('Serialized concurrent writes');
  store.fail = true;
  await assert.rejects(storage.write('account-a', long));
  assert.deepEqual(await storage.read('account-a'), newer, 'failed write preserves published snapshot');
  passed('Atomic write failure preserves published data');
  store.fail = false;
  await storage.write('account-a', long);
  assert.deepEqual(await storage.read('account-a'), long, 'queue recovers after write failure');
  passed('Recovery after storage failure');
  await storage.write('account-b', newer);
  assert.deepEqual(await storage.read('account-a'), long, 'account stores are isolated');
  await storage.remove('account-a');
  await storage.write('account-a', long);
  assert.equal(await storage.read('account-a'), null, 'deleted accounts cannot be recreated by stale saves');
  assert.ok([...store.values.keys()].every(key => !key.startsWith('flowy.chat.account-a')));
  assert.deepEqual(await storage.read('account-b'), newer);
  passed('Account deletion blocks stale saves');

  let searchParams;
  const fixture = { items: [{ id: 'old-item', title: 'An older saved item' }], page: 3, perPage: 20, totalItems: 41, totalPages: 3, categories: ['technology'] };
  const items = loader({ '@tanstack/react-query': { useInfiniteQuery: options => options }, '@/lib/pb': { pb: {} }, '@/lib/api': { api: { listItems: async params => { searchParams = params; return { data: fixture, error: null }; } } } })('src/hooks/useItems.ts');
  const options = items.useItems({ userId: 'account-a', sortField: 'created', sortDir: 'desc', search: ' older ', category: ' Tech ' });
  const page = await options.queryFn({ pageParam: 3 });
  assert.deepEqual(searchParams, { page: 3, perPage: 20, q: 'older', category: 'technology', sort: 'date', direction: 'desc' });
  assert.equal(page.items[0].id, 'old-item');
  assert.equal(options.getNextPageParam(fixture), undefined);
  assert.notDeepEqual(items.itemsQueryKey({ userId: 'account-a', search: 'one', sortField: 'created', sortDir: 'desc' }), items.itemsQueryKey({ userId: 'account-a', search: 'two', sortField: 'created', sortDir: 'desc' }));

  passed('Global search pagination category and cache keys');
  const runner = hookRunner();
  const streams = [];
  const writes = [];
  const remoteChats = new Map();
  const chatApi = {
    async chatHistoryRequest(op) {
      if (op.op === 'list') return {data:{conversations:[...remoteChats.values()].map(({messages,...c})=>c),next:null},error:null};
      if (op.op === 'import') {
        if (!remoteChats.has(op.conversation.id)) remoteChats.set(op.conversation.id,{...op.conversation,revision:1,messageCount:op.conversation.messages.length,pending:false,deleted:false});
        return {data:structuredClone(remoteChats.get(op.conversation.id)),error:null};
      }
      const c = remoteChats.get(op.id);
      if (!c) return {data:null,error:{code:'NOT_FOUND'}};
      if (op.op === 'get') return {data:{conversation:{...c,messages:undefined},messages:structuredClone(c.messages),before:null},error:null};
      if (op.op === 'stop') {c.pending=false;c.revision++;const m=c.messages.find(m=>m.id===op.requestId);if(m)m.status='stopped';}
      if (op.op === 'delete') {c.deleted=true;c.messages=[];c.revision++;}
      return {data:c,error:null};
    },
    async *chatStream(question, history, signal, digestContext, turn) {
      const stream=streamQueue();streams.push(stream);
      const c=remoteChats.get(turn.conversationId);
      c.pending=true;c.revision++;
      c.messages.push({id:turn.userMessageId,role:'user',content:question,status:'complete'});
      const m={id:turn.requestId,role:'assistant',content:'',status:'streaming',items:[]};c.messages.push(m);c.messageCount=c.messages.length;
      for await(const e of stream) {
        if(signal.aborted)break;
        if(e.type==='sources')m.items=e.citations.map(i=>({...i,source_url:i.source_url || null}));
        if(e.type==='token')m.content+=e.value;
        if(e.type==='done'){m.status='complete';c.pending=false;c.revision++;}
        yield e;
      }
    },
  };
  const { useChatState } = loader({ react: runner.react, 'react-native': { AppState: { currentState:'active',addEventListener: () => ({ remove() {} }) } }, './chatStorage': { chatStorage: { read: async () => null, write: async (account, snapshot) => { writes.push({ account, snapshot }); },remove:async()=>{} } }, './api':chatApi })('src/hooks/useChat.ts');
  let chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.ready, false);
  await tick();
  chat = runner.render(() => useChatState('account-a'));
  chat.setDraft('A saved draft');
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.draft, 'A saved draft');
  passed('Account draft state');
  const first = chat.send('Question one');
  chat.send('Double tap');
  await tick();
  assert.equal(streams.length, 1, 'synchronous generation guard prevents duplicate sends');
  passed('Duplicate send prevention');
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.pending, true);
  streams[0].push({ type: 'sources', citations: [{ id: 'item', type: 'url', title: 'Source' }] });
  await tick();
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.messages[1].citations[0].id, 'item', 'sources arrive before tokens');
  passed('Early source metadata');
  chat.stop();
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.messages[1].interrupted, true);
  passed('Stop preserves partial turn');
  assert.equal(chat.pending, false);
  await tick();
  const second = chat.send('Question two');
  await tick();
  streams[0].push({ type: 'token', value: 'STALE' });
  await first;
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.pending, true, 'old finalizer cannot clear newer generation');
  assert.ok(!chat.messages.some(m => m.content.includes('STALE')));
  passed('Stale stream and finalizer isolation');
  streams[1].push({ type: 'token', value: 'New response' });
  await tick();
  streams[1].push({ type: 'done', citations: [] });
  await tick();
  streams[1].finish();
  await second;
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.pending, false);
  assert.equal(chat.messages.at(-1).content, 'New response');
  const originalId = chat.active.id;
  chat.reset();
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.snapshot.conversations.length, 2, 'new chat preserves previous history');
  passed('New chat preserves history');
  chat.select(originalId);
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.messages.at(-1).content, 'New response');
  chat.retry();
  await tick();
  assert.equal(streams.length, 3);
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.messages.filter(m => m.content === 'Question two').length, 2, 'retry appends an explicit new attempt while preserving the old answer');
  passed('Retry preserves previous attempts in shared history');
  chat.stop();
  streams[2].finish();
  await tick();
  runner.close();
  assert.ok(writes.every(w => w.account === 'account-a'));
  passed('Unmount persistence scoped to account');
  const chatOriginalFetch=global.fetch;
  let sentTurn;
  global.fetch=async(_url,init)=>{sentTurn=JSON.parse(init.body).turn;return new Response('Answer',{headers:{'x-items':JSON.stringify([{id:'source',type:'url',title:'Saved source',category:null,source_url:null,r2_key:null}])}});};
  try {
    const apiLoader=loader({'./env':{ENV:{API_BASE_URL:'https://fixture.test'}},'./pb':{pb:{authStore:{token:'fixture'}}}});
    const apiModule=apiLoader('src/lib/api.ts'),events=[];
    const turn={conversationId:'c',revision:1,requestId:'r',userMessageId:'u'};
    for await(const event of apiModule.chatStream('Question',[],undefined,undefined,turn))events.push(event);
    assert.deepEqual(sentTurn,turn);
    assert.equal(events.find(e=>e.type==='sources').citations[0].title,'Saved source');
    assert.equal(events.find(e=>e.type==='sources').citations[0].source_url,undefined);
    passed('Native stream sends persisted turn IDs and normalizes nullable source metadata');
    global.fetch=async()=>new Response('<html>404: route missing</html>',{status:404,headers:{'content-type':'text/html'}});
    assert.equal((await apiModule.chatHistoryRequest({op:'list'})).error.code,'CHAT_HISTORY_UNAVAILABLE');
    global.fetch=async()=>Response.json({error:'CHAT_DELETED'},{status:404});
    assert.equal((await apiModule.chatHistoryRequest({op:'get',id:'deleted'})).error.code,'CHAT_DELETED');
    global.fetch=async()=>Response.json({error:'NOT_FOUND'},{status:404});
    assert.equal((await apiModule.chatHistoryRequest({op:'get',id:'missing'})).error.code,'NOT_FOUND');
    passed('Native history distinguishes an undeployed route from typed missing and deleted chats');
  } finally {global.fetch=chatOriginalFetch;}
  const localRunner=hookRunner();
  let localSnapshot=null;
  const localBodies=[];
  global.fetch=async(url,init)=>{
    if(url.endsWith('/api/chat/history'))return new Response('<html>Not found</html>',{status:404});
    localBodies.push(JSON.parse(init.body));
    return new Response('Local saved answer',{headers:{'x-items':'[]'}});
  };
  try {
    const {useChatState:useLocalChat}=loader({
      react:localRunner.react,
      'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})}},
      './env':{ENV:{API_BASE_URL:'https://fixture.test'}},
      './pb':{pb:{authStore:{token:'fixture'}}},
      './chatStorage':{chatStorage:{read:async()=>null,write:async(_user,value)=>{localSnapshot=structuredClone(value);},remove:async()=>{}}},
    })('src/hooks/useChat.ts');
    let localChat=localRunner.render(()=>useLocalChat('empty-account'));
    await tick();
    localChat=localRunner.render(()=>useLocalChat('empty-account'));
    assert.equal(localChat.localOnly,true);
    assert.equal(localChat.storageError,null);
    await localChat.send('First new question');
    localChat=localRunner.render(()=>useLocalChat('empty-account'));
    assert.equal(localChat.pending,false);
    assert.equal(localChat.messages.at(-1).content,'Local saved answer');
    assert.equal(localSnapshot.conversations[0].messages.at(-1).content,'Local saved answer');
    assert.equal(localBodies[0].turn,undefined);
    assert.deepEqual(localBodies[0].history,[]);
    await localChat.send('Follow up');
    assert.deepEqual(localBodies[1].history,[{role:'user',content:'First new question'},{role:'assistant',content:'Local saved answer'}]);
    passed('Empty-device chat sends through the existing endpoint and keeps local follow-up history');
  } finally {global.fetch=chatOriginalFetch;localRunner.close();}
  const {notificationIntent}=loader()('src/lib/notificationIntent.ts');
  assert.deepEqual(notificationIntent('response',{type:'digest',digestId:'abcdefghijklmno',deliveryId:'delivery1234567'}),{key:'delivery1234567',path:'/digest/abcdefghijklmno'});
  assert.equal(notificationIntent('response',{type:'digest',digestId:'../../account'}),null);
  assert.equal(notificationIntent('response',{type:'external',digestId:'abcdefghijklmno',url:'https://example.test'}),null);
  assert.equal(notificationIntent('response',{type:'item',itemId:'abcdefghijklmno',url:'https://evil.test'}).path,'/item/abcdefghijklmno');
  passed('Push intents accept only typed internal IDs and dedupe by delivery');
  const {restoreChat:restoreDigestChat,newConversation:newDigestConversation}=loader()('src/lib/chatModel.ts');
  const scoped={...newDigestConversation(),digestContext:{digestId:'abcdefghijklmno',scope:'digest'}};
  assert.deepEqual(restoreDigestChat({activeId:scoped.id,conversations:[scoped]}).conversations[0].digestContext,scoped.digestContext);
  const unsafe={...scoped,digestContext:{digestId:'../../secret',scope:'digest'}};
  assert.equal(restoreDigestChat({activeId:unsafe.id,conversations:[unsafe]}).conversations[0].digestContext,undefined);
  passed('Saved digest chat context validates IDs');
  const intentRunner=hookRunner(),intentStore=memoryStore(),destinations=[];
  let intentAuth={user:null,ready:false},intentSegments=['(auth)'],responseListener;
  const coldResponse={notification:{request:{identifier:'cold-response',content:{data:{type:'digest',digestId:'abcdefghijklmno',deliveryId:'delivery1234567'}}}}};
  const useIntent=loader({
    react:intentRunner.react,
    'react-native':{Linking:{addEventListener:()=>({remove(){}}),getInitialURL:async()=>null}},
    'expo-notifications':{addNotificationResponseReceivedListener:callback=>{responseListener=callback;return{remove(){}};},getLastNotificationResponseAsync:async()=>coldResponse,clearLastNotificationResponseAsync:async()=>{}},
    'expo-router':{router:{push:path=>destinations.push(path),replace:path=>destinations.push(path)},useRootNavigationState:()=>({key:'ready'}),useSegments:()=>intentSegments},
    '@/lib/auth':{useAuth:()=>intentAuth},
    '@/lib/secureStore':{sharedSecureStore:intentStore},
  })('src/hooks/useNotificationIntent.ts').useNotificationIntent;
  intentRunner.render(useIntent);await tick();await tick();intentRunner.render(useIntent);
  assert.deepEqual(destinations,[],'cold push waits for session restoration');
  intentAuth={user:null,ready:true};intentRunner.render(useIntent);assert.equal(destinations.at(-1),'/login');
  intentAuth={user:{id:'account-a'},ready:true};intentSegments=['(app)'];intentRunner.render(useIntent);await tick();
  assert.equal(destinations.at(-1),'/digest/abcdefghijklmno');
  const navigations=destinations.length;
  responseListener(coldResponse);await tick();intentRunner.render(useIntent);
  assert.equal(destinations.length,navigations,'same response is consumed once');
  assert.equal(intentStore.values.has('flowy.notification.pending'),false);
  intentRunner.close();passed('Cold push waits through login and consumes the exact destination once');
  console.log(`PASS: ${scenarios.length} UI model regression scenarios.\n${scenarios.map(name => `  ✓ ${name}`).join('\n')}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
