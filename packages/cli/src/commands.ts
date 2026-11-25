/**
 * The command table: every command of the command line, in the order the usage text lists
 * them. Dispatch and the usage text read this table only, so a later build step adds its
 * command by adding its entry here (`format` came with step 8, `source` with step 9; `log` comes
 * with step 11); nothing else changes.
 */

import { checkCommand } from './check.js';
import type { Command } from './command.js';
import { explainCommand } from './explain.js';
import { formatCommand } from './format.js';
import { lookupCommand } from './lookup.js';
import { sourceCommand } from './source.js';

export const COMMANDS: readonly Command[] = [
    checkCommand,
    lookupCommand,
    sourceCommand,
    formatCommand,
    explainCommand,
];
