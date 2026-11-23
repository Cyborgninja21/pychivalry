#!/usr/bin/env node
/**
 * The agent server's entry point: `node packages/mcp/dist/main.js [--mod <folder>] ...`. It
 * reads its arguments, then serves the protocol over standard input and output until its
 * input closes. Standard output carries only the protocol; anything else goes to standard
 * error, which a harness shows in its log of the server.
 */

import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { processSurroundings, sessionOptions, USAGE, UsageError } from './args.js';
import { createServer } from './server.js';
import { Session } from './session.js';

function main(): void {
    let session: Session;
    try {
        session = new Session(sessionOptions(process.argv.slice(2), processSurroundings()));
    } catch (err) {
        if (err instanceof UsageError) {
            process.stderr.write(`pychivalry-mcp: ${err.message}\n${USAGE}\n`);
            process.exitCode = 2;
            return;
        }
        throw err;
    }
    const handle = serveStdio(() => createServer(session), {
        onerror: (error) => {
            process.stderr.write(`pychivalry-mcp: ${error.message}\n`);
        },
    });
    process.on('SIGINT', () => {
        void handle.close();
    });
}

main();
