/**
 * The pychivalry VS Code extension. It bundles the command line, the agent server and the
 * language server, starts the servers, registers the agent server with VS Code and sets it up
 * for Claude Code; it holds no checking, parsing or lookup logic (docs/MVP.md,
 * "Architecture"). Build step 1 leaves it empty; it is filled in at step 7.
 */

/** This package's name, as in its package.json: the extension's name. */
export const packageName = 'pychivalry';

/** The extension's publisher (docs/PLAN.md, "Technical choices"). */
export const publisher = 'cyborgninja21';
