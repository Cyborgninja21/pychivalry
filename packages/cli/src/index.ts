import { packageName as corePackageName } from '@pychivalry/core';

/**
 * pychivalry's command line (docs/PLAN.md step 5): a thin shell that translates between
 * `@pychivalry/core` and its protocol, with no CK3 knowledge of its own (docs/MVP.md,
 * "Architecture"). Its entry point is `main.js`; `run` is the same command line for a caller
 * that brings its own streams (`Io`). It ships inside the VS Code extension and is never
 * published on its own.
 */

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/cli';

/** The core package this shell is built on. */
export const builtOn = corePackageName;

export { InputError, parseArgs, UsageError, type OptionSpec, type Parsed } from './args.js';
export { EXIT, type Command } from './command.js';
export { COMMANDS } from './commands.js';
export { defaultSpecDir, processIo, type Io } from './io.js';
export { run, runSteps, usage } from './run.js';
export {
    readsBaseGame,
    runShared,
    serveCliSteps,
    type Ask,
    type CliAnswer,
    type CliHost,
    type CliRequest,
} from './share.js';
export { TOOL, version } from './version.js';
