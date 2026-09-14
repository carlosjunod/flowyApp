const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

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
    mod.require = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith("@/")) return load(`src/${id.slice(2)}.ts`);
      if (id.startsWith("."))
        return load(path.resolve(path.dirname(absolute), `${id}.ts`));
      return require(id);
    };
    const source = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      fileName: absolute,
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
        jsx: ts.JsxEmit.ReactJSX,
      },
    }).outputText;
    mod._compile(source, absolute);
    return mod.exports;
  }
  return load;
}
(async () => {
  const labels = loader()("src/lib/labels.ts");
  const facets = [
    { name: "zebra", count: 3 },
    { name: "apple", count: 3 },
    { name: "design", count: 9 },
  ];
  assert.deepEqual(
    labels.orderLabels(facets, "count").map((x) => x.name),
    ["design", "apple", "zebra"],
  );
  assert.deepEqual(
    labels.orderLabels(facets, "alphabetical").map((x) => x.name),
    ["apple", "design", "zebra"],
  );
  assert.equal(facets[0].name, "zebra");
  const labelApi = loader({
    "./pb": { pb: { authStore: { token: "label-session" } } },
    "./env": { ENV: { API_BASE_URL: "https://fixture.invalid" } },
  })("src/lib/api.ts").api;
  const originalFetch = global.fetch;
  const labelRequests = [];
  global.fetch = async (url, init) => {
    labelRequests.push({ url, init });
    return Response.json({
      data: { count: 4, revision: "a".repeat(64) },
      error: null,
    });
  };
  try {
    await labelApi.listLabels();
    await labelApi.previewLabel("tag", "design");
    await labelApi.changeLabel({
      kind: "tag",
      name: "design",
      replacement: null,
      revision: "a".repeat(64),
    });
    await labelApi.listItems({ tag: "design", category: "technology", author: "instagram:alice", unread: true, q: "saved", page: 2 });
    assert.equal(labelRequests[0].url, "https://fixture.invalid/api/labels");
    assert.equal(
      labelRequests[1].init.headers.Authorization,
      "Bearer label-session",
    );
    assert.deepEqual(JSON.parse(labelRequests[2].init.body), {
      op: "apply",
      kind: "tag",
      name: "design",
      replacement: null,
      revision: "a".repeat(64),
    });
    const filters = new URL(labelRequests[3].url).searchParams;
    for (const [name, value] of Object.entries({tag: "design", category: "technology", author: "instagram:alice", unread: "true", q: "saved", page: "2"})) assert.equal(filters.get(name), value);
    global.fetch = async () =>
      Response.json({ data: null, error: "LABEL_CHANGED" }, { status: 409 });
    const stale = await labelApi.changeLabel({
      kind: "category",
      name: "design",
      replacement: "art",
      revision: "a".repeat(64),
    });
    assert.equal(stale.error.code, "LABEL_CHANGED");
  } finally {
    global.fetch = originalFetch;
  }
  let queryOptions;
  let queryParams;
  const itemModel = loader({
    "@tanstack/react-query": { useInfiniteQuery: options => { queryOptions = options; } },
    "@/lib/api": { api: { listItems: async params => { queryParams = params; return { data: { items: [] }, error: null }; } } },
    "@/lib/auth": {},
    "@/lib/pb": { pb: { authStore: { model: { id: "owner" }, token: "session" } } },
  })("src/hooks/useItems.ts");
  const combined = { userId: "owner", sortField: "created", sortDir: "desc", search: " saved ", category: "TECH", tag: " Design ", author: "instagram:alice", unread: true };
  itemModel.useItems(combined);
  await queryOptions.queryFn({ pageParam: 2 });
  assert.deepEqual(queryParams, { page: 2, perPage: 20, q: "saved", category: "technology", tag: "design", author: "instagram:alice", unread: true, sort: "date", direction: "desc" });
  for (const patch of [{tag: "other"}, {category: "art"}, {author: "instagram:bob"}, {unread: false}, {userId: "other"}]) assert.notDeepEqual(itemModel.itemsQueryKey(combined), itemModel.itemsQueryKey({...combined, ...patch}));
  assert.deepEqual(itemModel.itemsQueryKey(combined), itemModel.itemsQueryKey({...combined, tag: "design", category: "technology", search: "saved"}));
  console.log(
    "PASS native label ordering, authenticated API, filters and stale review errors",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
