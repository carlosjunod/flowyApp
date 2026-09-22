/**
 * Dictionary parity and cross-platform contract coverage.
 *
 * `npm run typecheck` already proves the Spanish dictionary has the same
 * *shape* as the English one — that is what `const es: Dictionary['…']` buys.
 * This script guards the invariants the compiler cannot see:
 *
 *   - no empty or placeholder-only strings hiding behind a valid type;
 *   - identical `{placeholders}` on both sides, so an interpolated value does
 *     not vanish in one language;
 *   - plural leaves that are plural on both sides and always take `count`;
 *   - every key the SHARED PRESENTATION CONTRACTS emit actually exists. Those
 *     modules (`types/inbox-presentation.ts`, `types/reader.ts`,
 *     `types/semantic.ts`, `hooks/useChatEngine.ts`) are mirrored byte-for-byte
 *     with the web client and return key paths rather than sentences, so a
 *     rename on either side has to fail here rather than at runtime.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');

/**
 * Turn a module specifier into the file that actually holds the code.
 *
 * `existsSync` alone is not enough: `src/lib/i18n/dictionaries/en` exists as a
 * *directory*, so a bare existence check picks it and `readFileSync` then fails
 * with EISDIR. Every candidate is stat'd and only a regular file is accepted,
 * with directory imports resolving to their `index` the way the bundler does.
 */
function resolveModule(candidate) {
  const attempts = [
    candidate,
    `${candidate}.ts`,
    `${candidate}.tsx`,
    path.join(candidate, 'index.ts'),
    path.join(candidate, 'index.tsx'),
  ];
  for (const attempt of attempts) {
    try {
      if (fs.statSync(attempt).isFile()) return attempt;
    } catch {
      // Missing path: try the next candidate.
    }
  }
  throw new Error(`Cannot resolve module: ${candidate}`);
}

function loader(mocks = {}) {
  const cache = new Map();
  function load(filename) {
    const full = resolveModule(path.resolve(root, filename));
    if (cache.has(full)) return cache.get(full).exports;
    const mod = new Module(full, module);
    cache.set(full, mod);
    mod.filename = full;
    mod.paths = module.paths;
    mod.require = (id) => {
      if (Object.hasOwn(mocks, id)) return mocks[id];
      if (id.startsWith('@/')) return load(`src/${id.slice(2)}`);
      if (id.startsWith('.')) return load(path.resolve(path.dirname(full), id));
      return require(id);
    };
    mod._compile(
      ts.transpileModule(fs.readFileSync(full, 'utf8'), {
        fileName: full,
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
          esModuleInterop: true,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
      full,
    );
    return mod.exports;
  }
  return load;
}

let checks = 0;
const passed = (label) => {
  checks++;
  console.log(`PASS ${label}`);
};

const load = loader();
const { typedDictionaries, dictionaries } = load('src/lib/i18n/dictionaries/index.ts');
const { collectKeys, lookup, isPluralForms } = load('src/lib/i18n/dictionary.ts');
const { createTranslate } = load('src/lib/i18n/translate.ts');

const LOCALES = ['en', 'es'];
const PLACEHOLDER_RE = /\{(\w+)\}/g;

const placeholders = (text) => [...text.matchAll(PLACEHOLDER_RE)].map((m) => m[1]).sort();
const leafStrings = (leaf) => (typeof leaf === 'string' ? [leaf] : Object.values(leaf));

/* ------------------------------------------------------------------ *
 * 1. Same keys on both sides
 * ------------------------------------------------------------------ */
{
  const en = collectKeys(typedDictionaries.en);
  const es = collectKeys(typedDictionaries.es);
  const missing = en.filter((key) => !es.includes(key));
  const extra = es.filter((key) => !en.includes(key));
  assert.deepEqual(missing, [], `Spanish is missing keys: ${missing.join(', ')}`);
  assert.deepEqual(extra, [], `Spanish has keys English does not: ${extra.join(', ')}`);
  // A floor, not a target: it catches a dictionary module dropping out of the
  // barrel, which would otherwise still "match" between the two locales.
  assert.ok(en.length > 300, `expected a substantial dictionary, found ${en.length} keys`);
  passed(`English and Spanish define the same ${en.length} keys`);
}

/* ------------------------------------------------------------------ *
 * 2. No empty strings, no untranslated leftovers
 * ------------------------------------------------------------------ */
{
  for (const locale of LOCALES) {
    for (const key of collectKeys(typedDictionaries[locale])) {
      const leaf = lookup(dictionaries[locale], key);
      for (const value of leafStrings(leaf)) {
        assert.equal(typeof value, 'string', `${locale}:${key} must be a string`);
        assert.notEqual(value.trim(), '', `${locale}:${key} is empty`);
        assert.ok(
          !/^\{\w+\}$/.test(value.trim()),
          `${locale}:${key} is nothing but a placeholder`,
        );
      }
    }
  }
  passed('no dictionary entry is empty or a bare placeholder');
}

/* ------------------------------------------------------------------ *
 * 3. Placeholder and plural parity
 * ------------------------------------------------------------------ */
{
  for (const key of collectKeys(typedDictionaries.en)) {
    const en = lookup(dictionaries.en, key);
    const es = lookup(dictionaries.es, key);

    assert.equal(
      isPluralForms(en),
      isPluralForms(es),
      `${key} is a plural in one locale and a plain string in the other`,
    );

    if (isPluralForms(en)) {
      assert.deepEqual(
        Object.keys(en).sort(),
        Object.keys(es).sort(),
        `${key} declares different plural categories per locale`,
      );
      // `one` and `other` are the only categories en/es actually select, so a
      // plural leaf that omits either can render as the key at runtime.
      for (const locale of LOCALES) {
        const forms = lookup(dictionaries[locale], key);
        assert.equal(typeof forms.one, 'string', `${locale}:${key} is missing its "one" form`);
        assert.equal(typeof forms.other, 'string', `${locale}:${key} is missing its "other" form`);
      }
    }

    // Every English placeholder must exist in Spanish and vice versa.
    const enVars = [...new Set(leafStrings(en).flatMap(placeholders))].sort();
    const esVars = [...new Set(leafStrings(es).flatMap(placeholders))].sort();
    assert.deepEqual(
      esVars,
      enVars,
      `${key} interpolates ${JSON.stringify(enVars)} in English but ${JSON.stringify(esVars)} in Spanish`,
    );
  }
  passed('placeholders and plural categories match across both locales');
}

/* ------------------------------------------------------------------ *
 * 4. Keys emitted by the shared presentation contracts
 * ------------------------------------------------------------------ */
{
  const translators = Object.fromEntries(
    LOCALES.map((locale) => [
      locale,
      // No fallback: a key that only exists in English must fail here.
      createTranslate({ locale, dictionary: dictionaries[locale] }),
    ]),
  );

  /** A key resolves when it renders to something other than itself. */
  const assertResolves = (key, vars, context) => {
    for (const locale of LOCALES) {
      const rendered = translators[locale](key, vars);
      assert.notEqual(
        rendered,
        key,
        `${context}: "${key}" is not defined in the ${locale} dictionary`,
      );
      assert.ok(!/\{\w+\}/.test(rendered), `${context}: "${key}" left an unfilled placeholder in ${locale}`);
    }
  };

  /* -- itemPresentation ------------------------------------------- */
  const { itemPresentation } = load('src/types/inbox-presentation.ts');
  const displayItems = [
    { status: 'pending', exploration: undefined },
    { status: 'processing', exploration: undefined },
    { status: 'error', source_url: 'https://example.com' },
    { status: 'error' },
    { status: 'ready', exploration: { status: 'exploring', candidates: [] } },
    { status: 'ready', exploration: { status: 'exploring', deep: true, candidates: [] } },
    { status: 'ready', exploration: { status: 'enriched', deep_analysis: { synthesis: 'x' }, candidates: [] } },
    { status: 'ready', exploration: { status: 'error', deep: true, candidates: [] } },
    { status: 'ready', exploration: { status: 'error', candidates: [] } },
    { status: 'ready', exploration: { status: 'no_match', deep: true, candidates: [] } },
    { status: 'ready' },
  ];
  let presentationKeys = 0;
  for (const item of displayItems) {
    const presentation = itemPresentation(item);
    assertResolves(presentation.labelKey, undefined, 'itemPresentation.labelKey');
    presentationKeys++;
    if (presentation.noticeKey) {
      assertResolves(presentation.noticeKey, undefined, 'itemPresentation.noticeKey');
      presentationKeys++;
    }
  }
  assert.ok(presentationKeys >= 15, `expected broad status coverage, exercised ${presentationKeys}`);
  passed(`every itemPresentation key resolves in both locales (${presentationKeys} renders)`);

  /* -- readerAction / READER_COPY --------------------------------- */
  const { readerAction, READER_COPY, readerSummary, readerResearch } = load('src/types/reader.ts');
  for (const key of Object.values(READER_COPY)) {
    assertResolves(key, undefined, 'READER_COPY');
  }

  const semanticList = {
    schema: 'semantic-content',
    version: 1,
    layout: 'list',
    domain: 'example.com',
    coverage: 'partial',
    sourceHash: 'a'.repeat(64),
    extractorVersion: 1,
    entries: [
      {
        id: '1',
        kind: 'book',
        name: 'A book',
        resolution: 'unresolved',
        evidence: [{ quote: 'q' }],
        links: [],
      },
    ],
  };
  const readerItems = [
    { type: 'url', status: 'ready' },
    { type: 'receipt', status: 'ready' },
    { type: 'receipt', status: 'ready', exploration: { status: 'error' } },
    { type: 'url', status: 'ready', exploration: { status: 'error' } },
    { type: 'url', status: 'ready', exploration: { status: 'exploring' } },
    { type: 'url', status: 'ready', exploration: { status: 'no_match' } },
    { type: 'url', status: 'ready', exploration: { status: 'enriched', deep_analysis: {} } },
    { type: 'url', status: 'ready', structured_content: semanticList, exploration: { status: 'no_match' } },
  ];
  for (const item of readerItems) {
    for (const starting of [false, true]) {
      const action = readerAction(item, starting);
      assertResolves(action.labelKey, undefined, 'readerAction.labelKey');
      assertResolves(action.hintKey, undefined, 'readerAction.hintKey');
      if (action.coverage) {
        assertResolves(
          action.coverage.key,
          { ...action.coverage.vars, unit: 'x' },
          'readerAction.coverage',
        );
      }
    }
  }
  passed('every readerAction label, hint and coverage key resolves in both locales');

  const summary = readerSummary({ type: 'url', status: 'pending' });
  assert.ok('key' in summary, 'a missing summary must produce a key, not prose');
  assertResolves(summary.key, undefined, 'readerSummary');
  assert.deepEqual(readerSummary({ type: 'url', status: 'ready', summary: ' text ' }), { text: 'text' });
  passed('readerSummary returns AI text verbatim and a translatable key otherwise');

  const research = readerResearch({
    primary_link: { title: 'T', url: 'https://example.com' },
    candidates: [
      { name: 'A', url: 'https://a.example', reason: 'because' },
      { name: 'B', url: 'https://b.example' },
    ],
    notes: 'n',
    deep_analysis: {
      synthesis: 's',
      key_findings: ['k'],
      link_excerpts: [{ title: 't', url: 'https://c.example', excerpt: 'e' }],
    },
    video_insights: { frames_analyzed: 3, on_screen_text: 'o', visual_cues: ['c'] },
  });
  assert.equal(research.length, 6, 'every populated research field becomes a section');
  for (const section of research) {
    assertResolves(section.labelKey, undefined, 'readerResearch.labelKey');
    if (section.textKey) assertResolves(section.textKey, section.textVars, 'readerResearch.textKey');
    for (const link of section.links ?? []) {
      if (link.detailKey) assertResolves(link.detailKey, link.detailVars, 'readerResearch.detailKey');
    }
  }
  passed('research section labels and generated captions resolve in both locales');

  /* -- semantic --------------------------------------------------- */
  const { semanticLabelParts, semanticCoverageKey, semanticEvidenceKey } = load('src/types/semantic.ts');
  const layouts = [
    { ...semanticList, layout: 'entity', entries: [semanticList.entries[0]], coverage: 'complete' },
    { ...semanticList, layout: 'narrative', entries: [], coverage: 'complete' },
    { ...semanticList, layout: 'generic', entries: [], coverage: 'unknown' },
    semanticList,
    { ...semanticList, recipe: { servings: 2, quote: 'serves 2' } },
  ];
  for (const content of layouts) {
    const parts = semanticLabelParts(content);
    assertResolves(parts.key, { ...parts.vars, unit: 'x' }, 'semanticLabelParts');
    if (parts.unitKey) assertResolves(parts.unitKey, parts.vars, 'semanticLabelParts.unitKey');
    if (parts.partial) assertResolves('inbox.semantic.listPartialSuffix', undefined, 'listPartialSuffix');
    const coverage = semanticCoverageKey(content);
    if (coverage) assertResolves(coverage.key, coverage.vars, 'semanticCoverageKey');
  }
  for (const origin of ['caption', 'ocr', 'transcript', 'comment', 'source_text', undefined]) {
    assertResolves(semanticEvidenceKey(origin), undefined, 'semanticEvidenceKey');
  }
  // Every kind must have both plural forms, since a list label agrees with its count.
  for (const kind of ['repository', 'movie', 'book', 'product', 'place', 'paper', 'other']) {
    for (const count of [1, 2]) {
      assertResolves(`inbox.semantic.kinds.${kind}`, { count }, 'semantic kind');
    }
  }
  passed('semantic labels, coverage notes, evidence captions and kinds all resolve');

  /* -- chatErrorKey ------------------------------------------------ */
  const { chatErrorKey } = loader({ react: { useState: () => [], useRef: () => ({}), useEffect: () => {} } })(
    'src/hooks/useChatEngine.ts',
  );
  const codes = [
    'CHAT_BUSY',
    'REVISION_CONFLICT',
    'REQUEST_EXISTS',
    'CHAT_DELETED',
    'NOT_FOUND',
    'CHAT_HISTORY_UNAVAILABLE',
    'CHAT_TIMEOUT',
    'UNAUTHORIZED',
    'BODY_TOO_LARGE',
    'VALIDATION_FAILED',
    'SOMETHING_NEW_FROM_THE_SERVER',
  ];
  for (const code of codes) {
    assertResolves(chatErrorKey(new Error(code)), undefined, 'chatErrorKey');
  }
  assert.equal(
    chatErrorKey(new Error('SOMETHING_NEW_FROM_THE_SERVER')),
    'chat.errors.DEFAULT',
    'an unrecognised code must not leak to the UI',
  );
  // The engine also sets these directly.
  for (const key of ['chat.errors.storageWrite', 'chat.errors.storageRead', 'chat.errors.tooLong', 'chat.message.failed']) {
    assertResolves(key, undefined, 'chat engine state');
  }
  passed('every chat error code maps to a key defined in both locales');

  /* -- the remaining generated-key helpers ------------------------- */
  const { apiErrorKey } = load('src/lib/apiErrors.ts');
  for (const code of ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'ITEM_NOT_FOUND', 'RATE_LIMITED', 'NETWORK_ERROR', 'SERVER_ERROR', 'INVALID_INPUT', 'INVALID_BODY', 'ORIGINAL_REQUIRED', 'UNKNOWN']) {
    assertResolves(apiErrorKey({ code }), undefined, 'apiErrorKey');
  }

  const { personalizationErrorKey } = load('src/lib/personalization.ts');
  for (const error of [
    { code: 'PERSONALIZATION_CONFLICT' },
    { code: 'UNKNOWN', status: 409 },
    { code: 'UNAUTHORIZED' },
    { code: 'NETWORK_ERROR' },
    { code: 'INVALID_INPUT' },
    { code: 'BODY_TOO_LARGE' },
    { code: 'ANYTHING_ELSE' },
  ]) {
    assertResolves(personalizationErrorKey(error), undefined, 'personalizationErrorKey');
  }

  const { socialAuthErrorKey } = loader({ './googleSignIn': {} })('src/lib/googleAuth.ts');
  for (const code of [
    'GOOGLE_NOT_CONFIGURED',
    'GOOGLE_PLAY_SERVICES_UNAVAILABLE',
    'NETWORK_ERROR',
    'EMAIL_IN_USE',
    'INVALID_APPLE_TOKEN',
    'INVALID_GOOGLE_TOKEN',
    'INVALID_TOKEN',
    'GOOGLE_TOKEN_MISSING',
    'RATE_LIMITED',
    'INVALID_SESSION',
  ]) {
    assertResolves(socialAuthErrorKey(code), { provider: 'Apple' }, 'socialAuthErrorKey');
  }

  const { itemTypeLabelKey } = loader({ '@expo/vector-icons': { Feather: {} } })('src/lib/itemIcons.ts');
  for (const key of Object.values(itemTypeLabelKey)) {
    assertResolves(key, undefined, 'itemTypeLabelKey');
  }

  const { sourceChip } = loader({ '@expo/vector-icons': { Feather: {} } })('src/lib/sourceChip.ts');
  const itemTypes = Object.keys(itemTypeLabelKey);
  for (const type of itemTypes.concat(['something_new'])) {
    for (const contentType of ['generic', 'carousel', 'youtube', 'reel', 'receipt']) {
      const chip = sourceChip({ type, media: [{}, {}] }, contentType);
      assertResolves(chip.labelKey, chip.labelVars, 'sourceChip');
    }
  }
  passed('sourceChip, item types and every error-code mapper resolve in both locales');

  const { analysisLabelKey, RETENTION_OPTIONS } = load('src/types/files.ts');
  for (const state of ['uploading', 'stored', 'queued', 'analyzing', 'complete', 'partial', 'unsupported', 'error']) {
    assertResolves(analysisLabelKey(state), undefined, 'analysisLabelKey');
  }
  for (const option of RETENTION_OPTIONS) {
    assertResolves(option.labelKey, undefined, 'RETENTION_OPTIONS');
  }

  const { DIGEST_CADENCE_LABEL_KEYS, DIGEST_DAY_KEYS, DIGEST_DAY_SHORT_KEYS, DIGEST_TYPE_KEYS } = loader({
    './digestTimezones': { DIGEST_TIMEZONES: [] },
    '@expo/vector-icons': { Feather: {} },
  })('src/lib/digestSettings.ts');
  assert.equal(DIGEST_DAY_KEYS.length, 7, 'weekly_day is 1-based over seven days');
  assert.equal(DIGEST_DAY_SHORT_KEYS.length, 7);
  for (const key of [
    ...Object.values(DIGEST_CADENCE_LABEL_KEYS),
    ...DIGEST_DAY_KEYS,
    ...DIGEST_DAY_SHORT_KEYS,
    ...Object.values(DIGEST_TYPE_KEYS),
  ]) {
    assertResolves(key, undefined, 'digest settings');
  }
  passed('file states, retention options and digest schedule labels all resolve');
}

/* ------------------------------------------------------------------ *
 * 5. The interface locale never leaks into the digest report language
 * ------------------------------------------------------------------ */
{
  const source = fs.readFileSync(path.join(root, 'app/(app)/digest-settings.tsx'), 'utf8');
  assert.ok(
    source.includes("change(\"locale\", \"en\")") && source.includes("change(\"locale\", \"es\")"),
    'the digest report language must still be chosen explicitly on this screen',
  );
  assert.ok(
    !/setLocale\(/.test(source),
    'the digest screen must never call the interface-language setter (D-041)',
  );
  const provider = fs.readFileSync(path.join(root, 'src/lib/i18n/LocaleProvider.tsx'), 'utf8');
  assert.ok(
    !/DigestPreferences|patchDigestSettings|digest/i.test(provider),
    'changing the interface language must not touch digest preferences (D-041)',
  );
  passed('interface language and digest report language stay independent (D-041)');
}

console.log(`${checks} native i18n parity scenarios passed`);
