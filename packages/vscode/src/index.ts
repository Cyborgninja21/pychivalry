/**
 * The pychivalry VS Code extension. It bundles the command line, the agent server and the
 * language server, starts the servers, registers the agent server with VS Code and sets it up
 * for Claude Code; it holds no checking, parsing or lookup logic (docs/MVP.md,
 * "Architecture"). Its entry point is `extension.ts`, bundled to `dist/bundle/extension.cjs`
 * (`bundle.ts`); the agent server's command line is `launch.ts`, its stored copy `install.ts`,
 * and "Set up for Claude Code" `setup.ts` with `claude.ts`.
 */

/** This package's name, as in its package.json: the extension's name. */
export const packageName = 'pychivalry';

/** The extension's publisher (docs/PLAN.md, "Technical choices"). */
export const publisher = 'cyborgninja21';
