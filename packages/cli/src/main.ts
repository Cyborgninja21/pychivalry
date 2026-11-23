#!/usr/bin/env node
/**
 * The command line's entry point: `node packages/cli/dist/main.js <command> ...`. It runs
 * the command on this process's arguments, streams and environment and exits with its code: a
 * command that reads the base game is answered by the program that lends one when there is one
 * (`runShared`, docs/shared-index.md), otherwise here.
 */

import { processIo } from './io.js';
import { runShared } from './share.js';

process.exitCode = await runShared(process.argv.slice(2), processIo());
