/**
 * Small helpers shared by the tools: the repository root, SHA-256, JSON files, and the error
 * type a command raises to stop with a message and an exit code.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The repository root. Compiled tools live in `tools/dist/`, two folders below it. */
export function repoRoot(): string {
    return path.resolve(fileURLToPath(new URL('../../', import.meta.url)));
}

/** SHA-256 of some bytes or text, as lower-case hex. */
export function sha256(data: string | Uint8Array): string {
    return createHash('sha256').update(data).digest('hex');
}

/** SHA-256 of a file's bytes, as lower-case hex. */
export function sha256OfFile(file: string): string {
    return sha256(readFileSync(file));
}

/** Read and parse a JSON file; the caller checks its shape. */
export function readJson(file: string): unknown {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
}

/** Write text as it is, creating the folder. */
export function writeText(file: string, text: string): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** Write a value as JSON, four-space indented, with a final newline, creating the folder. */
export function writeJson(file: string, value: unknown): void {
    writeText(file, `${JSON.stringify(value, null, 4)}\n`);
}

/** A plain object, as opposed to an array, null or a scalar. */
export function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Exit codes of every command: 0 when it passed, 1 when a pass condition failed or a check
 * found a problem, 2 on bad usage (a missing variable, a folder that is not what it should
 * be).
 */
export const EXIT = { ok: 0, failed: 1, usage: 2 } as const;

/** Stops a command with a message and an exit code. */
export class CommandError extends Error {
    readonly exitCode: number;

    constructor(message: string, exitCode: number) {
        super(message);
        this.name = 'CommandError';
        this.exitCode = exitCode;
    }
}

/** Path `file` relative to `root`, with forward slashes on every platform. */
export function relativePosix(root: string, file: string): string {
    return path.relative(root, file).split(path.sep).join('/');
}
