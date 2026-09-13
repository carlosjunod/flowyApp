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
  const authStore = { token: 'token-a', model: { id: 'alice' } };
  const requests = [];
  const oldFetch = global.fetch;
  global.fetch = async (url, init) => { requests.push({url, init}); return new Response(JSON.stringify({data:{id:'one', first_opened_at:'server-time', read_at:''},error:null}),{status:200}); };
  const api = loader({'./env':{ENV:{API_BASE_URL:'https://fixture.invalid'}}, './pb':{pb:{authStore}}})('src/lib/api.ts').api;
  assert.equal((await api.itemEngagement('alice','one','open')).data.read_at, '');
  assert.deepEqual(JSON.parse(requests[0].init.body), {action:'open'});
  assert.equal(requests[0].init.headers.Authorization, 'Bearer token-a');
  assert.equal((await api.itemEngagement('bob','one','mark_read')).error.code, 'UNAUTHORIZED');
  assert.equal(requests.length,1);
  let resolveFetch;
  global.fetch = () => new Promise(resolve => {resolveFetch=resolve;});
  const late = api.itemEngagement('alice','one','mark_read');
  authStore.model={id:'bob'}; authStore.token='token-b';
  resolveFetch(new Response(JSON.stringify({data:{id:'one',first_opened_at:'t',read_at:'t'}}),{status:200}));
  assert.equal((await late).error.code,'UNAUTHORIZED');
  global.fetch = oldFetch;
  passed('REST sends action only and binds initial and late responses to originating session');

  authStore.model={id:'alice'}; authStore.token='token-a';
  let user = {id:'alice'};
  let foreground, realtime, unsubscribed=0;
  const appState={currentState:'active',addEventListener:(_name,fn)=>{foreground=fn;return {remove(){foreground=null;}};}};
  const calls=[], invalidations=[];
  let fail=false, hold=null;
  const harness=hookRunner();
  const useItemEngagement=loader({
    react:harness.react, 'react-native':{AppState:appState},
    '@tanstack/react-query':{useQueryClient:()=>qc},
    '@/lib/auth':{useAuth:()=>({user})},
    '@/lib/pb':{pb:{authStore,collection:()=>({subscribe:async (_id,fn)=>{realtime=fn;return ()=>{unsubscribed++;};}})}},
    '@/lib/api':{api:{itemEngagement:async (account,id,action)=>{calls.push({account,id,action});if(hold)await hold;return fail?{data:null,error:{code:'NETWORK_ERROR'}}:{data:{id,first_opened_at:'server',read_at:action==='mark_read'?'server':''},error:null};}}},
  })('src/hooks/useItemEngagement.ts').useItemEngagement;
  const qc={invalidateQueries:async value=>{invalidations.push(value.queryKey);}};
  let item={id:'one',user:'alice',status:'ready'};
  const render=()=>harness.render(()=>useItemEngagement(item));
  let state=render();await tick();
  assert.deepEqual(calls.map(c=>c.action),['open']);
  state=render();await state.toggleRead();
  assert.deepEqual(calls.map(c=>c.action),['open','mark_read']);
  item={...item,read_at:'server',first_opened_at:'server'};state=render();await state.toggleRead();
  assert.equal(calls.at(-1).action,'mark_unread');
  passed('historical item opening does not mark read; explicit mark and reversal use separate actions');
  const count=invalidations.length;realtime({record:item});assert.ok(invalidations.length>count);
  foreground('active');await tick();assert.equal(calls.filter(c=>c.action==='open').length,1);
  passed('ready items reconcile realtime and foreground without repeating successful first-open request');
  fail=true;state=render();await state.toggleRead();state=render();assert.match(state.error,/Could not save/);fail=false;
  let release;hold=new Promise(resolve=>{release=resolve;});state=render();const first=state.toggleRead();const before=calls.length;await state.toggleRead();assert.equal(calls.length,before);
  const oldInvalidations=invalidations.length;authStore.model={id:'bob'};authStore.token='token-b';user={id:'bob'};item=undefined;render();release();await first;
  assert.equal(invalidations.length,oldInvalidations);assert.equal(render().error,null);assert.ok(unsubscribed>0);
  harness.close();
  passed('failed updates remain retryable; rapid taps and late responses cannot cross account boundaries');
  console.log(scenarios.map(name=>'PASS '+name).join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1;});
