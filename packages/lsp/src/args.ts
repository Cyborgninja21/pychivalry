/**
 * The server's own command-line arguments, read once when it starts: the transport and the
 * spec package. The editor starts it as `pychivalry-lsp --node-ipc [--clientProcessId=<id>]`;
 * the tests as `pychivalry-lsp --stdio`. `--spec` names another spec package file or its folder;
 * by default the server reads the one pychivalry ships, the repository's `spec/` folder beside
 * this package (the extension that bundles the server keeps it as a data file beside it, and
 * passes its folder with `--spec`).
 */

import { openSpec, packageFileIn, SpecError, type Spec } from '@pychivalry/core';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Bad arguments: the server does not start. */
export class UsageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UsageError';
    }
}

export const USAGE =
    'usage: pychivalry-lsp (--node-ipc | --stdio) [--spec <file or folder>] [--clientProcessId <id>]';

export interface ServerArguments {
    /** `ipc`: the Node module over IPC the editor starts; `stdio`: standard input and output. */
    readonly transport: 'ipc' | 'stdio';
    /** The spec package file or folder given, or null for the one pychivalry ships. */
    readonly spec: string | null;
}

/** The arguments given; `UsageError` when they cannot be used. */
export function serverArguments(argv: readonly string[]): ServerArguments {
    let transport: ServerArguments['transport'] | null = null;
    let spec: string | null = null;
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i] ?? '';
        if (arg === '--node-ipc' || arg === '--stdio') {
            const given = arg === '--node-ipc' ? 'ipc' : 'stdio';
            if (transport !== null) {
                throw new UsageError('give one transport: --node-ipc or --stdio');
            }
            transport = given;
        } else if (arg === '--spec') {
            const value = argv[i + 1];
            if (value === undefined || value.startsWith('--')) {
                throw new UsageError('--spec needs a value');
            }
            if (spec !== null) {
                throw new UsageError('--spec is given twice');
            }
            spec = value;
            i++;
        } else if (arg === '--clientProcessId') {
            // Read by the protocol library itself.
            i++;
        } else if (arg.startsWith('--clientProcessId=')) {
            // Read by the protocol library itself.
        } else {
            throw new UsageError(`unknown argument: ${arg}`);
        }
    }
    if (transport === null) {
        throw new UsageError('give the transport: --node-ipc or --stdio');
    }
    return { transport, spec };
}

/** The spec folder of the repository, beside this package: the committed package. */
export function defaultSpecDir(): string {
    return fileURLToPath(new URL('../../../spec/', import.meta.url));
}

/** The spec package `--spec` names, or the one pychivalry ships. */
export function specFrom(given: string | null, cwd: string): Spec {
    const target = given === null ? defaultSpecDir() : path.resolve(cwd, given);
    try {
        if (existsSync(target) && statSync(target).isDirectory()) {
            return openSpec(target);
        }
        if (!existsSync(target)) {
            throw new UsageError(`--spec: no such file: ${target}`);
        }
        const dir = path.dirname(target);
        if (packageFileIn(dir).file !== path.basename(target)) {
            throw new UsageError(
                `--spec: ${path.basename(target)} is not a spec package file (ck3-spec-<version>.json.gz)`,
            );
        }
        return openSpec(dir);
    } catch (err) {
        if (err instanceof SpecError) {
            throw new UsageError(`the spec package cannot be read: ${err.message}`);
        }
        throw err;
    }
}
