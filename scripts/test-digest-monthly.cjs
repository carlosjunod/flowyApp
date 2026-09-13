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
const walk = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(walk) : [node, ...walk(node.props?.children)];
const byLabel = (tree,label) => walk(tree).find(node=>node.props?.accessibilityLabel===label);
const byTitle = (tree,title) => walk(tree).find(node=>node.props?.title===title);
const textOf = node => node == null || typeof node==='boolean' ? '' : Array.isArray(node) ? node.map(textOf).join(' ') : typeof node==='object' ? textOf(node.props?.children) : String(node);
(async()=>{
  const settings = loader()('src/lib/digestSettings.ts');
  const initial = {
    timezone:'America/Bogota',locale:'en',daily_enabled:false,daily_local_time:'08:00',daily_push_enabled:false,daily_email_enabled:false,
    weekly_enabled:false,weekly_day:1,weekly_local_time:'08:00',weekly_push_enabled:false,weekly_email_enabled:false,
    monthly_enabled:false,monthly_day:1,monthly_local_time:'08:00',monthly_push_enabled:false,monthly_email_enabled:false,
    paused_until:null,excluded_types:['receipt','email','note'],excluded_categories:[],
  };
  assert.deepEqual(settings.DIGEST_MONTH_DAYS,Array.from({length:28},(_,i)=>i+1));
  assert.deepEqual(settings.availableDigestCadences(initial),['weekly','daily','monthly']);
  const old={...initial};for(const key of Object.keys(old))if(key.startsWith('monthly_'))delete old[key];
  assert.deepEqual(settings.availableDigestCadences(old),['weekly','daily']);
  assert.equal(settings.preferencesChanged(initial,{...initial,monthly_day:28}),true);
  assert.equal(settings.preferencesChanged(initial,{...initial,monthly_enabled:true}),true);
  assert.equal(settings.preferencesChanged(initial,{...initial}),false);
  assert.deepEqual([undefined,'weekly','daily','monthly'].map(settings.nextDigestCadence),['weekly','daily','monthly',undefined]);
  passed('monthly safe days, opt-in dirty state, history cycle and older-server fallback');

  function fixture(paid=true, supportsMonthly=true){
    const harness=hookRunner(), patches=[];
    let view={settings:supportsMonthly?{...initial}:{...old},revision:3,canEnableDaily:paid,effectivePlan:paid?'pro':'free',capabilities:{enabled:true,push:true,email:true},emailVerified:true,monthlyReportQuota:{limit:30,used:2,reserved:0,remaining:28,resetsAt:'2026-10-01T00:00:00Z'}};
    const screen=loader({react:harness.react,
      'react-native':{ActivityIndicator:'ActivityIndicator',Alert:{alert(){}},Pressable:'Pressable',ScrollView:'ScrollView',Switch:'Switch',Text:'Text',View:'View'},
      'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},
      'expo-router':{router:{back(){},push(){}},useNavigation:()=>({dispatch(){}})},
      '@react-navigation/native':{usePreventRemove(){}},
      '@/components/ui/AppIcon':{AppIcon:'AppIcon'},
      '@/components/digest/DigestControls':{DigestAction:'DigestAction',DigestChip:'DigestChip',DigestSection:'DigestSection',DigestTimezone:'DigestTimezone'},
      '@/components/digest/DigestDateField':{DigestDateField:'DigestDateField'},
      '@/lib/digestAppearance':{useDigestColors:()=>({}),useDigestVars:()=>({})},
      '@/hooks/useDigestCategories':{useDigestCategories:()=>({data:[]})},
      '@/hooks/usePushRegistration':{registerPushForCurrentUser:()=>{throw Error('No push registration allowed');}},
      '@/components/settings/PushNotificationSettings':{PushNotificationSettings:'PushNotificationSettings'},
      '@/lib/api':{api:{getDigestSettings:async()=>({data:view,error:null}),patchDigestSettings:async patch=>{patches.push(patch);view={...view,revision:4,settings:patch};return {data:view,error:null};}}},
    })('app/(app)/digest-settings.tsx').default;
    return {render:()=>harness.render(screen),patches,close:()=>harness.close()};
  }
  const f=fixture();f.render();await tick();let tree=f.render();
  assert.equal(byLabel(tree,'monthly digest').props.value,false);
  assert.equal(byLabel(tree,'monthly digest').props.disabled,false);
  assert.equal(byLabel(tree,'monthly push'),undefined);
  byLabel(tree,'monthly digest').props.onValueChange(true);tree=f.render();
  assert.equal(byLabel(tree,'monthly push').props.value,false);
  assert.equal(byLabel(tree,'monthly email').props.value,false);
  const days=walk(tree).filter(n=>n.props?.accessibilityLabel?.match(/^Day \d+ of each month$/));assert.equal(days.length,28);
  byLabel(tree,'Day 28 of each month').props.onPress();tree=f.render();
  const time=walk(tree).find(n=>n.props?.label==='monthly publication time');time.props.onChange('21:35');tree=f.render();
  byLabel(tree,'monthly push').props.onValueChange(true);tree=f.render();
  assert.match(textOf(tree),/previous complete calendar month/);
  assert.match(textOf(tree),/2\s+of\s+30\s+digests used this month/);
  byLabel(tree,'Save choices').props.onPress();await tick();tree=f.render();
  assert.equal(f.patches.length,1);const saved=f.patches[0];
  assert.equal(saved.expected_revision,3);assert.equal(saved.monthly_enabled,true);assert.equal(saved.monthly_day,28);assert.equal(saved.monthly_local_time,'21:35');assert.equal(saved.monthly_push_enabled,true);assert.equal(saved.monthly_email_enabled,false);
  assert.equal(saved.weekly_enabled,false);assert.equal(saved.daily_enabled,false);assert.equal(saved.timezone,'America/Bogota');assert.deepEqual(saved.excluded_types,initial.excluded_types);
  assert.equal(byTitle(tree,'Pause for a week…').props.disabled,false);
  byTitle(tree,'Turn off all digests').props.onPress();tree=f.render();assert.equal(byLabel(tree,'monthly digest').props.value,false);
  f.close();passed('real settings screen preserves consent, day/time, channels, revision, quota display and monthly-only pause/off');
  const free=fixture(false);free.render();await tick();tree=free.render();assert.equal(byLabel(tree,'monthly digest').props.disabled,true);assert.equal(byLabel(tree,'daily digest').props.disabled,true);assert.equal(byLabel(tree,'weekly digest').props.disabled,false);free.close();
  const legacy=fixture(true,false);legacy.render();await tick();tree=legacy.render();assert.equal(byLabel(tree,'monthly digest'),undefined);legacy.close();
  passed('Free daily/monthly gate and older-backend settings stay intact');
  const oldFetch=global.fetch,requests=[];
  global.fetch=async(url,init)=>{requests.push({url,init});return new Response(JSON.stringify({data:[],nextCursor:null}),{status:200});};
  try{
    const api=loader({'./env':{ENV:{API_BASE_URL:'https://fixture.invalid'}},'./pb':{pb:{authStore:{token:'fixture'}}}})('src/lib/api.ts').api;
    await api.listDigestPage('cursor-fixture',{cadence:'monthly',read:'new'});
    const url=new URL(requests[0].url);assert.equal(url.searchParams.get('cadence'),'monthly');assert.equal(url.searchParams.get('cursor'),'cursor-fixture');assert.equal(url.searchParams.get('read'),'new');assert.equal(requests[0].init.headers.Authorization,'Bearer fixture');
  }finally{global.fetch=oldFetch;}
  passed('monthly history filter retains cursor, read filter and authenticated API contract');
  console.log(scenarios.map(s=>'PASS '+s).join('\n'));
})().catch(error=>{console.error(error);process.exitCode=1;});
