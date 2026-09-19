/**
 * English dictionary — the schema for every other locale.
 *
 * Split per surface so a translator can review one screen at a time and so a
 * diff on "the inbox strings" does not touch the settings file. Composition is
 * flat: each module owns one top-level namespace.
 */

import { common } from './common';
import { auth } from './auth';
import { app } from './app';
import { inbox } from './inbox';
import { chat } from './chat';
import { digest } from './digest';
import { settings } from './settings';

export const en = {
  common,
  auth,
  app,
  inbox,
  chat,
  digest,
  settings,
};

/**
 * The shape every locale must satisfy. Declaring `const es: Dictionary['…']`
 * turns a missing or misspelled key into a compile error instead of a silent
 * English string on a Spanish screen.
 */
export type Dictionary = typeof en;
