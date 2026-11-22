/**
 * pychivalry's core: parse, index, check, lookup, format and fix data (docs/MVP.md,
 * "Architecture"). It is the only package that knows CK3, it has no runtime dependencies, and
 * it knows nothing of VS Code. Build step 2 adds `syntax/`, the parser; build step 3 adds
 * `index/`, the workspace index.
 */

export * from './syntax/index.js';
export * from './index/index.js';

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/core';
