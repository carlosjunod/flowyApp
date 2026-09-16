// Contract checks for src/lib/digestEditorial.ts against real server output.
// FLOWY_SERVER_ROOT points at the Flowy checkout that produced
// artifacts/digest-editorial/fixture-digest.json (default ../Flowy).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const server = path.resolve(root, process.env.FLOWY_SERVER_ROOT || '../Flowy');
const fixtureFile = path.join(server, 'artifacts/digest-editorial/fixture-digest.json');
assert.ok(fs.existsSync(fixtureFile), `Missing ${fixtureFile}; set FLOWY_SERVER_ROOT to the server checkout`);

function load(filename) {
  const absolute = path.resolve(root, filename);
  const mod = new Module(absolute, module);
  mod.filename = absolute;
  mod.paths = module.paths;
  mod.require = (id) => require(id);
  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    fileName: absolute,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  mod._compile(source, absolute);
  return mod.exports;
}

const lib = load('src/lib/digestEditorial.ts');
const { content } = JSON.parse(fs.readFileSync(fixtureFile, 'utf8'));
const scenarios = [];
const check = (name, fn) => {
  fn();
  scenarios.push(name);
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const https = (c) => {
  const copy = clone(c);
  const rewrite = (p) => p && ['webp', 'jpeg'].forEach((f) => p.image.variants[f].forEach((v) => (v.url = 'https://files.tryflowy.app/' + v.key)));
  rewrite(copy.editorial.cover);
  copy.editorial.interior.forEach(rewrite);
  return copy;
};

check('server fixture edition validates with loopback preview URLs in development', () => {
  const edition = lib.readEdition(content, { editorial: true }, true);
  assert.equal(edition.cover.image.id, 'vida-cotidiana-04');
  assert.equal(edition.interior.length, content.editorial.interior.length);
});
check('loopback URLs are rejected outside development; https accepted', () => {
  assert.equal(lib.readEdition(content, { editorial: true }, false), null);
  assert.equal(lib.readEdition(https(content), { editorial: true }, false).cover.image.id, 'vida-cotidiana-04');
});
check('presentation off, missing presentation (older server) and absent edition render typographically', () => {
  assert.equal(lib.readEdition(https(content), { editorial: false }), null);
  assert.equal(lib.readEdition(https(content), undefined), null);
  const plain = clone(content);
  delete plain.editorial;
  assert.equal(lib.readEdition(plain, { editorial: true }), null);
});
check('corrupted editions are ignored rather than crashing', () => {
  for (const mutate of [
    (c) => (c.editorial.cover.image.variants.jpeg[0].url = 'javascript:alert(1)'),
    (c) => (c.editorial.cover.image.id = '../../etc'),
    (c) => (c.editorial.version = 2),
    (c) => (c.editorial.cover.image.focal_point.x = 3),
    (c) => (c.editorial.cover = null),
  ]) {
    const copy = https(content);
    mutate(copy);
    assert.equal(lib.readEdition(copy, { editorial: true }), null);
  }
  const duplicate = https(content);
  duplicate.editorial.interior = [{ ...duplicate.editorial.interior[0], image: duplicate.editorial.cover.image }];
  assert.deepEqual(lib.readEdition(duplicate, { editorial: true }).interior, []);
});
check('interior placement lookup and variant choice never upscale', () => {
  const edition = lib.readEdition(https(content), { editorial: true });
  const interior = edition.interior[0];
  assert.equal(lib.placementFor(edition, interior.section, interior.block_id).image.id, interior.image.id);
  assert.equal(lib.pickVariant(edition.cover.image, 700).w, 960);
  assert.equal(lib.pickVariant(edition.cover.image, 5000).w, 1440);
  assert.equal(lib.pickVariant(edition.cover.image, 100).w, 480);
});
check('period label treats window_end as exclusive, matching web/email/PDF', () => {
  assert.equal(lib.periodLabel(content.window_start, content.window_end, content.timezone, 'es'), '7 de septiembre – 13 de septiembre de 2026');
  assert.equal(lib.periodLabel('2026-09-15T05:00:00.000Z', '2026-09-16T05:00:00.000Z', 'America/Bogota', 'en'), 'September 15, 2026');
  assert.equal(lib.periodLabel('', '', undefined, 'en'), '');
});

console.log(scenarios.map((name) => 'ok ' + name).join('\n'));
