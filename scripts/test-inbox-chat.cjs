const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function load(relative, mocks = {}) {
  const filename = path.resolve(__dirname, '..', relative);
  const mod = new Module(filename, module);
  mod.require = name => {
    if (name in mocks) return mocks[name];
    throw new Error(`Unexpected dependency ${name}`);
  };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { fileName: filename, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
const { answerSources } = load('src/lib/chatSources.ts');
const a = { id: 'source000000001', type: 'url' }, b = { id: 'source000000002', type: 'url' };
const answer = { role: 'assistant', content: `Read [[${b.id}]] then [[${a.id}]], again [[${b.id}]] and [[unknown00000001]].`, citations: [a, b] };
assert.deepEqual(answerSources(answer), { items: [b, a], cited: true });
assert.deepEqual(answerSources({ ...answer, content: 'Related ideas', citations: [a, a, b] }), { items: [a, b], cited: false });
assert.deepEqual(answerSources({ ...answer, role: 'user' }).items, []);
let calls = [], rows = [], fail = false, afterRead = () => {};
const authStore = { isValid: true, model: { id: 'alice' }, token: 'token' };
class PocketBase {
  constructor() { this.authStore = authStore; }
  filter(expression, data) { return expression.replace(/\{:(\w+)\}/g, (_, key) => JSON.stringify(data[key])); }
  collection() { return { getList: async (...args) => { calls.push(args); if (fail) throw Error('offline'); afterRead(); return { items: rows }; } }; }
}
const { loadChatSources } = load('src/lib/pb.ts', { pocketbase: { __esModule: true, default: PocketBase, AsyncAuthStore: class {} }, './env': { ENV: { PB_URL: 'http://fixture.test', AUTH_KEY: 'fixture' } }, './secureStore': { sharedSecureStore: { setItem() {}, removeItem() {} } } });
async function main() {
  rows = [{ ...a, user: 'alice' }, { ...b, user: 'alice' }, { id: 'foreign', user: 'bob' }];
  assert.deepEqual((await loadChatSources('alice', [b.id, a.id, b.id, 'deleted', 'foreign'])).map(x => x.id), [b.id, a.id]);
  assert.match(calls[0][2].filter, /^user = "alice" && /);
  calls = []; rows = [];
  await loadChatSources('alice', Array.from({ length: 101 }, (_, i) => `source${i}`));
  assert.deepEqual(calls.map(x => x[1]), [50, 50, 1]);
  calls = [];
  assert.deepEqual(await loadChatSources('alice', []), []); assert.equal(calls.length, 0);
  fail = true; await assert.rejects(loadChatSources('alice', [a.id]), /offline/); fail = false;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(loadChatSources('alice', [a.id], controller.signal), /cancelled/);
  afterRead = () => { authStore.model.id = 'bob'; };
  await assert.rejects(loadChatSources('alice', [a.id]), /Session changed/);
  authStore.model.id = 'alice'; authStore.isValid = false;
  await assert.rejects(loadChatSources('alice', [a.id]), /Sign in/);
  console.log('10 source selection/loading scenarios passed');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
