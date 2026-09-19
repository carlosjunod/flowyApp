/**
 * Dictionary shape and the compile-time key union.
 *
 * Native-owned copy of `apps/web/lib/i18n/dictionary.ts` in the Flowy server
 * repository. It is copied rather than imported: the Expo bundler must be able
 * to build this app on its own, and a cross-repo runtime import would break
 * that. Keep the two files behaviourally identical when either changes.
 *
 * The English dictionary is the schema: `Dictionary = typeof en`. Every other
 * locale is declared `const es: Dictionary['…']`, so a missing, extra or
 * wrongly-shaped key is a `tsc --noEmit` error rather than a runtime
 * `undefined` that silently ships an English string to a Spanish user.
 * `npm run typecheck` is therefore the real parity gate; the parity script
 * (`npm run test:i18n-parity`) guards the runtime invariants type checking
 * cannot see — empty strings, stray plural forms, placeholder drift.
 */

/**
 * CLDR plural forms. `one`/`other` are required because they are the only two
 * categories both English and Spanish actually use; `zero`/`two`/`few`/`many`
 * are optional so a future locale (or a deliberate "No items" copy) can opt in.
 */
export interface PluralForms {
  zero?: string;
  one: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
}

export type TranslationLeaf = string | PluralForms;

export interface TranslationTree {
  [key: string]: TranslationLeaf | TranslationTree;
}

/** Values allowed in an interpolation payload. */
export type TranslationVars = Record<string, string | number | boolean | null | undefined>;

export function isPluralForms(value: unknown): value is PluralForms {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PluralForms).other === 'string' &&
    typeof (value as PluralForms).one === 'string'
  );
}

export function isTranslationLeaf(value: unknown): value is TranslationLeaf {
  return typeof value === 'string' || isPluralForms(value);
}

/* ------------------------------------------------------------------ *
 * Dot-path key union
 * ------------------------------------------------------------------ */

type Depth = [never, 0, 1, 2, 3, 4, 5, 6];

/**
 * A leaf is a string or a plural group.
 *
 * Both `one` AND `other` are required, exactly matching the `isPluralForms`
 * runtime guard. Testing `{ other: string }` alone was a real bug (fixed the
 * same way in `apps/web/lib/i18n/dictionary.ts`): any namespace that happens
 * to contain a key called `other` — such as
 * `inbox.content.receipt.categories.other` ("Other") — was mistaken for a
 * plural group, which collapsed the whole namespace and made its siblings
 * (`categories.dairy`, `categories.produce`, …) invalid `TranslationKey`s.
 * Keep this predicate and `isPluralForms` in agreement.
 */
type IsLeaf<T> = T extends string
  ? true
  : T extends { one: string; other: string }
    ? true
    : false;

type Join<K extends string, P extends string> = P extends '' ? K : `${K}.${P}`;

/**
 * Recursive dot paths to every leaf. Depth-limited so a malformed dictionary
 * can never trigger TypeScript's "type instantiation is excessively deep".
 */
export type LeafPaths<T, D extends number = 6> = [D] extends [never]
  ? never
  : IsLeaf<T> extends true
    ? ''
    : T extends object
      ? {
          [K in keyof T & string]: Join<K, LeafPaths<T[K], Depth[D]>>;
        }[keyof T & string]
      : '';

/**
 * Walk a dot path at runtime. Returns the leaf, or `undefined` when any segment
 * is missing or the path stops on a subtree rather than a translatable value.
 */
export function lookup(tree: TranslationTree, key: string): TranslationLeaf | undefined {
  let node: TranslationLeaf | TranslationTree | undefined = tree;
  for (const segment of key.split('.')) {
    if (typeof node !== 'object' || node === null || isPluralForms(node)) return undefined;
    node = (node as TranslationTree)[segment];
    if (node === undefined) return undefined;
  }
  return isTranslationLeaf(node) ? node : undefined;
}

/** Collect every dot path in a tree — used by the parity script. */
export function collectKeys(tree: TranslationTree, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTranslationLeaf(value)) keys.push(path);
    else keys.push(...collectKeys(value as TranslationTree, path));
  }
  return keys.sort();
}
