/**
 * pychivalry's core: parse, index, check, lookup, format and fix data (docs/MVP.md,
 * "Architecture"). It is the only package that knows CK3, it has no runtime dependencies, and
 * it knows nothing of VS Code. Build step 2 adds `syntax/`, the parser.
 */

export * from './syntax/index.js';

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/core';
