/**
 * The command table: every command of the command line, in the order the usage text lists
 * them. Dispatch and the usage text read this table only, so a later build step adds its
 * command by adding its entry here (`format` in step 8, `log` in step 11); nothing else
 * changes.
 */

import { checkCommand } from './check.js';
import type { Command } from './command.js';
import { explainCommand } from './explain.js';

export const COMMANDS: readonly Command[] = [checkCommand, explainCommand];
