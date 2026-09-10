// Run against the exact server checkout that will be deployed with this client.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const server = path.resolve(process.argv[2] || path.join(__dirname, '../../Flowy'));

function load(filename, allowedImports = {}) {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const mod = { exports: {} };
  new Function('require', 'module', 'exports', code)((id) => {
    if (id === 'node:crypto') return require(id);
    if (Object.hasOwn(allowedImports, id)) return allowedImports[id];
    throw new Error('Unexpected import: ' + id);
  }, mod, mod.exports);
  return mod.exports;
}

const { buildItemPushPayload } = load(path.join(server, 'worker/src/lib/itemPush.ts'), {
  './pocketbase.js': {}, './itemPushReceipt.js': {},
});
const { notificationIntent } = load(path.join(__dirname, '../src/lib/notificationIntent.ts'));
for (const kind of ['ready', 'enriched']) {
  const payload = buildItemPushPayload({ id: 'abcdefghijklmno', title: 'A saved item' }, kind);
  assert.deepEqual(payload.data, { type: 'item', itemId: 'abcdefghijklmno' });
  assert.equal(notificationIntent('response', payload.data)?.path, '/item/abcdefghijklmno');
}
console.log('PASS: real server ready/enriched payloads open the exact item in the native client.');
