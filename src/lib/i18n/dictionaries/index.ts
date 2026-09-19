import type { LeafPaths, TranslationTree } from '../dictionary';
import type { Locale } from '../locale';
import { en, type Dictionary } from './en';
import { es } from './es';

export type { Dictionary };

/** Every dot path in the English dictionary — the only valid `t()` argument. */
export type TranslationKey = LeafPaths<Dictionary>;

export const dictionaries: Record<Locale, TranslationTree> = {
  en: en as unknown as TranslationTree,
  es: es as unknown as TranslationTree,
};

/** Typed access for the parity script, which compares structure, not strings. */
export const typedDictionaries = { en, es };
