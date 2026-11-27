#!/usr/bin/env node
/**
 * The language server's entry point: `node packages/lsp/dist/main.js --node-ipc` as the
 * extension starts it (a Node module over IPC on VS Code's own runtime), or `--stdio` over
 * standard input and output (the tests). `--spec <file or folder>` names another spec package
 * than the one pychivalry ships; `--clientProcessId <id>`, which the editor adds, is read by
 * the protocol library, which stops the server when that process is gone.
 *
 * The server talks to the program that started it: over IPC, or over its own standard input
 * and output. Once its base game is open it also lends it to pychivalry's agent servers and
 * command line on this machine, over a local channel in the user's own folder: a Unix domain
 * socket or a Windows named pipe, never a port (docs/shared-index.md; AGENTS.md, rule 12). Bad
 * arguments stop it before it speaks the protocol, with the reason on standard error and exit
 * code 2.
 */

import { defaultCacheDir, findGameFolders } from '@pychivalry/core';
import { homedir } from 'node:os';
import { createConnection, IPCMessageReader, IPCMessageWriter } from 'vscode-languageserver/node';
import { serverArguments, specFrom, USAGE, UsageError } from './args.js';
import { startServer } from './server.js';

function main(): void {
    let args;
    let spec;
    try {
        args = serverArguments(process.argv.slice(2));
        spec = specFrom(args.spec, process.cwd());
    } catch (err) {
        if (err instanceof UsageError) {
            process.stderr.write(`pychivalry-lsp: ${err.message}\n${USAGE}\n`);
            process.exitCode = 2;
            return;
        }
        throw err;
    }
    const connection =
        args.transport === 'ipc'
            ? createConnection(new IPCMessageReader(process), new IPCMessageWriter(process))
            : createConnection(process.stdin, process.stdout);
    const env = process.env;
    const platform = process.platform;
    const home = homedir();
    startServer(connection, {
        spec,
        cacheDir: defaultCacheDir(),
        findGame: (gameId) => findGameFolders(gameId, { env, platform, home })[0] ?? null,
        place: { env, platform, home },
        logSearch: { env, platform, home },
    });
}

main();
