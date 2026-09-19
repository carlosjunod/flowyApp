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
      fileName: absolute, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    mod._compile(source, absolute);
    return mod.exports;
  }
  return load;
}
function hookRunner() {
  let index = 0;
  const slots = [];
  let effects = [];
  let dirty = false;
  const react = {
    useCallback: fn => fn,
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

const tick = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  const authStore={token:'token-a',model:{id:'alice'}};
  const requests=[];
  const originalFetch=global.fetch;
  const code='FLOWY-'+ 'A'.repeat(32);
  const connection={enabled:true,referralEnabled:true,connected:false,code,expiresAt:Date.now()+600000};
  global.fetch=async (url,init)=>{requests.push({url,init});return new Response(JSON.stringify({data:connection,error:null}),{status:200});};
  const api=loader({'./env':{ENV:{API_BASE_URL:'https://fixture.invalid'}},'./pb':{pb:{authStore}}})('src/lib/api.ts').api;
  for (const method of ['getInstagramConnection','createInstagramConnection','disconnectInstagram']) {
    assert.equal((await api[method]('alice')).data.code,code);
    assert.equal((await api[method]('bob')).error.code,'UNAUTHORIZED');
  }
  assert.deepEqual(requests.map(r=>r.init.method||'GET'),['GET','POST','DELETE']);
  requests.forEach(r=>{assert.equal(r.url,'https://fixture.invalid/api/integrations/instagram');assert.equal(r.init.headers.Authorization,'Bearer token-a');assert.equal(r.init.credentials,'omit');});
  await api.getInstagramConnection('alice', undefined, '789');
  await api.createInstagramConnection('alice', '789');
  await api.disconnectInstagram('alice', '789');
  assert.ok(requests.slice(-3).every(r => r.url.endsWith('?account=789')));
  let finish;
  global.fetch=()=>new Promise(resolve=>{finish=resolve;});
  const late=api.createInstagramConnection('alice');
  authStore.model={id:'bob'};authStore.token='token-b';
  finish(new Response(JSON.stringify({data:connection,error:null}),{status:200}));
  assert.equal((await late).error.code,'UNAUTHORIZED');
  global.fetch=originalFetch;
  passed('REST methods are authenticated and reject cross-account initial and late responses');

  const {instagramConnectionUrl,instagramChatUrl}=loader()('src/lib/instagramConnection.ts');
  assert.equal(instagramConnectionUrl(connection),'https://ig.me/m/tryflowy?ref='+code);
  for(const override of [{enabled:false},{referralEnabled:false},{connected:true},{expiresAt:1},{code:'https://malicious.invalid'},{code:code+'&token=secret'}]) assert.equal(instagramConnectionUrl({...connection,...override}),null);
  assert.equal(instagramConnectionUrl({...connection,handle:'save.to.flowy'}),'https://ig.me/m/save.to.flowy?ref='+code);
  assert.equal(instagramChatUrl({handle:'guardalo.en.flowy'}),'https://ig.me/m/guardalo.en.flowy');
  assert.equal(instagramChatUrl({handle:'evil.invalid/?steal='}),'https://ig.me/m/tryflowy');
  passed('Only valid, current, rollout-enabled private codes can open referral links');

  authStore.model={id:'alice'};authStore.token='token-a';
  let accountId='alice',destination,queryData={enabled:true,referralEnabled:true,connected:false};
  let foreground,createResult=async()=>({data:connection,error:null}),openFails=false;
  const opened=[],copied=[],refreshes=[],cached=[];
  const timers=new Map();let timerId=0;
  const originalInterval=global.setInterval,originalClear=global.clearInterval;
  global.setInterval=fn=>{timers.set(++timerId,fn);return timerId;};
  global.clearInterval=id=>timers.delete(id);
  const appState={currentState:'active',addEventListener:(_event,fn)=>{foreground=fn;return {remove(){foreground=null;}};}};
  const refetch=async()=>{refreshes.push(true);};
  const harness=hookRunner();
  const useInstagramConnection=loader({
    react:harness.react,
    'react-native':{AppState:appState,Linking:{openURL:async url=>{if(openFails)throw Error('unavailable');opened.push(url);}}},
    'expo-clipboard':{setStringAsync:async value=>{copied.push(value);}},
    '@tanstack/react-query':{useQuery:()=>({data:queryData,error:null,isLoading:false,refetch}),useQueryClient:()=>({cancelQueries:async()=>{},setQueryData:(_key,data)=>{cached.push(data);queryData=data;}})},
    '@/lib/pb':{pb:{authStore}},
    '@/lib/api':{api:{createInstagramConnection:()=>createResult(),disconnectInstagram:async()=>({data:{enabled:true,referralEnabled:true,connected:false},error:null})}},
  })('src/hooks/useInstagramConnection.ts').useInstagramConnection;
  const render=()=>harness.render(()=>useInstagramConnection(accountId,destination));
  let state=render();await state.connect();state=render();
  assert.equal(opened[0],'https://ig.me/m/tryflowy?ref='+code);
  assert.equal(state.connection.code,code);
  assert.equal(cached[0].code,undefined);assert.equal(cached[0].expiresAt,undefined);
  await state.copyCode();assert.equal(copied[0],code);
  appState.currentState='background';[...timers.values()].forEach(fn=>fn());assert.equal(refreshes.length,0);
  appState.currentState='active';foreground('active');assert.equal(refreshes.length,1);
  passed('Native handoff opens the private link, keeps codes out of cache, and refreshes on foreground only');
  openFails=true;await state.connect();state=render();assert.equal(state.errorKey,'settings.instagram.errors.openFailed');assert.equal(state.connection.code,code);openFails=false;
  passed('A failed app handoff preserves the manual connection code');
  queryData={...queryData,connected:true};state=render();assert.equal(state.connection,null);
  await state.disconnect();state=render();assert.equal(state.data.connected,false);
  passed('Confirmed connection clears secrets; disconnect refreshes connection status');
  let resolveCode;
  createResult=()=>new Promise(resolve=>{resolveCode=resolve;});
  const pending=state.connect();await tick();
  accountId='bob';authStore.model={id:'bob'};authStore.token='token-b';queryData={enabled:true,referralEnabled:true,connected:false};state=render();
  const openCount=opened.length;
  resolveCode({data:connection,error:null});await pending;state=render();
  assert.equal(state.connection,null);assert.equal(opened.length,openCount);
  passed('An account change during code creation never opens or displays the prior account code');
  let finishDestination;
  createResult=()=>new Promise(resolve=>{finishDestination=resolve;});
  const oldDestination=state.connect();await tick();
  destination='789';queryData={enabled:true,referralEnabled:true,connected:false,handle:'guardalo.en.flowy',account:'789'};state=render();
  const beforeOpen=opened.length;
  finishDestination({data:{...connection,handle:'save.to.flowy',account:'123'},error:null});await oldDestination;state=render();
  assert.equal(state.connection,null);assert.equal(opened.length,beforeOpen);
  await state.openChat();assert.equal(opened.at(-1),'https://ig.me/m/guardalo.en.flowy');
  passed('Destination switching isolates in-flight codes and opens the selected account');
  harness.close();assert.equal(timers.size,0);assert.equal(foreground,null);
  global.setInterval=originalInterval;global.clearInterval=originalClear;
  console.log('PASS: '+scenarios.length+' Instagram native scenario groups\n- '+scenarios.join('\n- '));
})().catch(error=>{console.error(error);process.exit(1);});
