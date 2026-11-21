import { packageName as corePackageName } from '@pychivalry/core';

/**
 * pychivalry's command line: a thin shell that translates between `@pychivalry/core` and its
 * protocol, with no CK3 knowledge of its own (docs/MVP.md, "Architecture"). Build step 1
 * leaves it empty; it is filled in at step 5.
 */

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/cli';

/** The core package this shell is built on. */
export const builtOn = corePackageName;
