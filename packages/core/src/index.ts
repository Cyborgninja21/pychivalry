/**
 * pychivalry's core: parse, index, check, lookup, format and fix data (docs/MVP.md,
 * "Architecture"). It is the only package that knows CK3, it has no runtime dependencies, and
 * it knows nothing of VS Code. Build step 2 adds `syntax/`, the parser; build step 3 adds
 * `index/`, the workspace index; build step 4 adds `spec/`, the typed spec reader, and
 * `check/`, the engine checks; build step 8 adds `fix/`, fix data, and `format/`, the formatter;
 * build step 10 adds `gui/`, the GUI parser and what a GUI file gives the index, and
 * `calls/`, the call graph; build step 11 adds `log/`, the game-log analysis.
 */

export * from './syntax/index.js';
export * from './index/index.js';
export * from './spec/index.js';
export * from './check/index.js';
export * from './lookup/index.js';
export * from './fix/index.js';
export * from './format/index.js';
export * from './share/index.js';
export * from './gui/index.js';
export * from './calls/index.js';
export * from './log/index.js';
export { drain, drainInSlices, type Steps } from './steps.js';

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/core';
