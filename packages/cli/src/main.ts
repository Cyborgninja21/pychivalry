#!/usr/bin/env node
/**
 * The command line's entry point: `node packages/cli/dist/main.js <command> ...`. It runs
 * the command on this process's arguments, streams and environment and exits with its code.
 */

import { processIo } from './io.js';
import { run } from './run.js';

process.exitCode = run(process.argv.slice(2), processIo());
