/**
 * pychivalry's core: parse, index, check, lookup, format and fix data (docs/MVP.md,
 * "Architecture"). It is the only package that knows CK3, it has no runtime dependencies, and
 * it knows nothing of VS Code. Build step 1 leaves it empty; step 2 adds `syntax/`.
 */

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/core';
