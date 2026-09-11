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
  const { useChatState } = loader({ react: runner.react, 'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } }, '@/lib/chatStorage': { chatStorage: { read: async () => null, write: async (account, snapshot) => { writes.push({ account, snapshot }); } } }, '@/lib/api': { chatStream: () => { const stream = streamQueue(); streams.push(stream); return stream; } } })('src/hooks/useChat.ts');
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
  const second = chat.send('Question two');
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
  assert.equal(streams.length, 3);
  chat = runner.render(() => useChatState('account-a'));
  assert.equal(chat.messages.filter(m => m.content === 'Question two').length, 1, 'retry replaces turn without duplicating question');
  passed('Retry replaces only current turn');
  chat.stop();
  streams[2].finish();
  await tick();
  runner.close();
  assert.ok(writes.every(w => w.account === 'account-a'));
  passed('Unmount persistence scoped to account');
  const {notificationIntent}=loader()('src/lib/notificationIntent.ts');
  assert.deepEqual(notificationIntent('response',{type:'digest',digestId:'abcdefghijklmno',deliveryId:'delivery1234567'}),{key:'delivery1234567',path:'/digest/abcdefghijklmno'});
  assert.equal(notificationIntent('response',{type:'digest',digestId:'../../account'}),null);
  assert.equal(notificationIntent('response',{type:'external',digestId:'abcdefghijklmno',url:'https://example.test'}),null);
  assert.equal(notificationIntent('response',{type:'item',itemId:'abcdefghijklmno',url:'https://evil.test'}).path,'/item/abcdefghijklmno');
  passed('Push intents accept only typed internal IDs and dedupe by delivery');
  assert.equal(notificationIntent('legacy',{itemId:'abcdefghijklmno'}).path,'/item/abcdefghijklmno');
  assert.equal(notificationIntent('legacy',{itemId:'../../account'}),null);
  assert.equal(notificationIntent('unknown',{type:'external',itemId:'abcdefghijklmno'}),null);
  passed('Previously sent item pushes remain navigable; unknown types stay rejected');
  const permissionCalls = [];
  let permission = {status:'undetermined',canAskAgain:true};
  let tokenFailure = false, saveFailure = false, saveGate = null;
  const pushAuth = { model:{id:'account-a'}, token:'auth-a' };
  const pushPlatform = {OS:'android'};
  const register = loader({
    react: {useEffect(){}},
    'react-native':{Platform:pushPlatform,AppState:{addEventListener:()=>({remove(){}})}},
    'expo-constants':{easConfig:{projectId:'test-project'}},
    '@/lib/auth':{useAuth:()=>({user:pushAuth.model})},
    '@/lib/pb':{pb:{authStore:pushAuth}},
    '@/lib/pushDevice':{flushPushUnlinks:async()=>{},savePushDevice:async(account,token)=>{
      permissionCalls.push(['save',account,token]); if(saveGate)await saveGate;if(saveFailure)throw Error('server private error');
    }},
    'expo-notifications':{
      AndroidImportance:{HIGH:4},
      setNotificationChannelAsync:async(id,settings)=>{permissionCalls.push(['channel',id,settings]);},
      getPermissionsAsync:async()=>{permissionCalls.push('permission');return permission;},
      requestPermissionsAsync:async()=>{permissionCalls.push('prompt');return permission={status:'granted',canAskAgain:true};},
      getExpoPushTokenAsync:async()=>{permissionCalls.push('token');if(tokenFailure)throw Error('private APNs data');return{data:'ExpoPushToken[test]'};},
    },
  })('src/hooks/usePushRegistration.ts').registerPushForCurrentUser;
  assert.equal((await register(false)).status,'permission-required');
  assert.deepEqual(permissionCalls,[['channel','updates',{name:'Flowy updates',importance:4,sound:'default'}],'permission']);
  passed('Automatic registration never requests permission or registers an unapproved token');
  permissionCalls.length=0;
  assert.equal((await register(true)).status,'registered');
  assert.deepEqual(permissionCalls,[['channel','updates',{name:'Flowy updates',importance:4,sound:'default'}],'permission','prompt','token',['save','account-a','ExpoPushToken[test]']]);
  passed('Android creates its channel before permission and persists the approved device');
  permission={status:'denied',canAskAgain:false};permissionCalls.length=0;
  assert.equal((await register(true)).status,'settings-required');
  assert.deepEqual(permissionCalls,[['channel','updates',{name:'Flowy updates',importance:4,sound:'default'}],'permission']);
  passed('Denied permission points to system settings without another prompt');
  permission={status:'granted',canAskAgain:false};saveFailure=true;
  const failedSave=await register(true);
  assert.equal(failedSave.status,'error');assert.ok(failedSave.message.includes('could not finish setting up'));
  assert.ok(!failedSave.message.includes('private'));
  passed('Server registration failure is visible and never reports success');
  saveFailure=false;tokenFailure=true;permissionCalls.length=0;
  assert.equal((await register(true)).status,'error');
  assert.ok(!permissionCalls.some(call=>Array.isArray(call)&&call[0]==='save'));
  passed('Token acquisition failure does not save an invalid device');
  tokenFailure=false;pushPlatform.OS='ios';permissionCalls.length=0;
  assert.equal((await register(false)).status,'registered');
  assert.ok(!permissionCalls.some(call=>Array.isArray(call)&&call[0]==='channel')&&!permissionCalls.includes('prompt'));
  passed('Granted iOS permission refreshes registration without prompting');
  permissionCalls.length=0;
  let releaseSave;
  saveGate=new Promise(resolve=>{releaseSave=resolve;});
  const foregroundRegistration=register(false);
  const settingsRegistration=register(true);
  await tick();
  assert.equal(foregroundRegistration,settingsRegistration);
  assert.equal(permissionCalls.filter(call=>call==='token').length,1);
  assert.equal(permissionCalls.filter(call=>Array.isArray(call)).length,1);
  releaseSave();
  await Promise.all([foregroundRegistration,settingsRegistration]);
  saveGate=null;
  passed('Concurrent foreground and settings events share one push registration');
  pushAuth.model=null;permissionCalls.length=0;
  assert.equal((await register(true)).status,'error');assert.deepEqual(permissionCalls,[]);
  passed('Signed-out users cannot register a device');
  const deviceStore=memoryStore(),deviceRequests=[];
  const deviceAuth={model:{id:'account-a'},token:'auth-a'};
  let registrationReply={data:{revocation:'r'.repeat(43)}};
  const originalDeviceFetch=globalThis.fetch;
  const originalAbortTimeout=AbortSignal.timeout;
  AbortSignal.timeout=undefined;
  globalThis.fetch=async(url,options)=>{
    deviceRequests.push({url,method:options.method,body:JSON.parse(options.body)});
    return {ok:true,json:async()=>registrationReply};
  };
  try {
    const device=loader({
      './pb':{pb:{authStore:deviceAuth}},'./env':{ENV:{API_BASE_URL:'https://test.invalid'}},
      './secureStore':{sharedSecureStore:deviceStore},
    })('src/lib/pushDevice.ts');
    await device.savePushDevice('account-a','ExpoPushToken[test]');
    assert.equal(JSON.parse(deviceStore.values.get('flowy.push.device')).revocation,'r'.repeat(43));
    registrationReply={data:{}};
    await assert.rejects(device.savePushDevice('account-a','ExpoPushToken[test]'),/INVALID_PUSH_REGISTRATION/);
    assert.equal(JSON.parse(deviceStore.values.get('flowy.push.device')).revocation,'r'.repeat(43));
    passed('Registration requires a valid revocation capability and preserves the previous one on malformed replies');
    await device.unlinkPushDevice();
    assert.equal(deviceRequests.at(-1).method,'DELETE');
    assert.deepEqual(deviceRequests.at(-1).body,{revocation:'r'.repeat(43)});
    assert.equal(deviceStore.values.has('flowy.push.device'),false);
    passed('Logout unlinks only the stored registration capability');
  } finally {
    globalThis.fetch=originalDeviceFetch;
    AbortSignal.timeout=originalAbortTimeout;
  }
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
