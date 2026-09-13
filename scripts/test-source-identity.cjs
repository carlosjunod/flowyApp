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

(async () => {
  const source = loader()('src/types/source.ts');
  assert.equal(source.readAuthor({ type: 'instagram', content: 'Author: Alice @alice' }).url, 'https://www.instagram.com/alice/');
  assert.equal(source.readAuthor({ type: 'instagram', content: 'Caption: @bob' }), undefined);
  assert.equal(source.githubRepository('https://github.com/acme/tool.git').url, 'https://github.com/acme/tool');
  let received;
  const items = loader({ '@tanstack/react-query': { useInfiniteQuery: options => options }, '@/lib/auth': { useAuth: () => ({ user: { id: 'alice' } }) }, '@/lib/pb': { pb: { authStore: { model: { id: 'alice' }, token: 'fixture-token' } } }, '@/lib/api': { api: { listItems: async params => { received = params; return { data: { items: [], totalItems: 0, page: 1, perPage: 20 }, error: null }; } } } })('src/hooks/useItems.ts');
  const params = { userId: 'alice', sortField: 'created', sortDir: 'desc', category: 'design', unread: true, author: 'instagram:bob' };
  await items.useItems(params).queryFn({ pageParam: 2 });
  assert.equal(received.author, 'instagram:bob');
  assert.equal(received.category, 'design');
  assert.equal(received.unread, true);
  assert.notDeepEqual(items.itemsQueryKey(params), items.itemsQueryKey({ ...params, unread: false }));
  assert.equal(received.page, 2);
  assert.notDeepEqual(items.itemsQueryKey(params), items.itemsQueryKey({ ...params, author: 'instagram:carol' }));
  assert.notDeepEqual(items.itemsQueryKey(params), items.itemsQueryKey({ ...params, userId: 'carol' }));
  const MarkdownIt = require('markdown-it');
  const html = new MarkdownIt({ html: false, linkify: true }).render('Visit https://github.com/acme/tool or [Docs](https://example.com).');
  assert.ok(html.includes('href="https://github.com/acme/tool"'));
  assert.ok(html.includes('href="https://example.com"'));
  console.log('PASS native source identity, author/category pagination, account/author cache isolation, raw and Markdown links');
})().catch(error => { console.error(error); process.exitCode = 1; });
