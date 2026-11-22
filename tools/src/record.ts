/**
 * The parts every record carries (records/README.md): the tool build, the machine, the time,
 * and the spec the run used.
 */

import { execFileSync } from 'node:child_process';
import { availableParallelism, arch, platform, totalmem } from 'node:os';
import path from 'node:path';
import type { GameInfo } from './game.js';
import { checkSpec } from './spec.js';
import { CommandError, EXIT, isObject, readJson } from './util.js';

export type Suite =
    'game:parse' | 'game:index' | 'game:check' | 'game:mods' | 'game:bench' | 'baseline:speed';

export interface ToolInfo {
    name: 'pychivalry';
    version: string;
    commit: string;
    dirty: boolean;
}

export interface MachineInfo {
    os: string;
    arch: string;
    logical_cpus: number;
    memory_gib: number;
    node: string;
}

export interface SpecRef {
    version: string;
    sha256: string;
    package_format: number;
}

export interface CorpusRef {
    manifest_sha256: string;
    slugs: string[];
}

export interface SuiteRecord {
    record_format: 1;
    suite: Suite;
    command: string;
    made_at: string;
    tool: ToolInfo;
    machine: MachineInfo;
    game: GameInfo;
    spec: SpecRef;
    corpus: CorpusRef | null;
    notes?: string[];
    results: Record<string, unknown>;
}

/** The machine, described generically: operating system family, architecture, size, Node. */
export function machineInfo(): MachineInfo {
    return {
        os: platform(),
        arch: arch(),
        logical_cpus: availableParallelism(),
        memory_gib: Math.round(totalmem() / 1024 ** 3),
        node: process.version,
    };
}

/** Run git in the repository and return its trimmed output. */
export function git(root: string, args: readonly string[]): string {
    try {
        return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    } catch (err) {
        throw new CommandError(
            `git ${args.join(' ')} failed: ${(err as Error).message}`,
            EXIT.usage,
        );
    }
}

/** This checkout's build of pychivalry: the root package version and the git commit. */
export function toolInfo(root: string): ToolInfo {
    const manifest = readJson(path.join(root, 'package.json'));
    const version = isObject(manifest) ? manifest['version'] : undefined;
    if (typeof version !== 'string') {
        throw new CommandError('package.json has no version', EXIT.usage);
    }
    const status = git(root, [
        'status',
        '--porcelain',
        '--untracked-files=no',
        '--',
        '.',
        ':(exclude)records',
    ]);
    return {
        name: 'pychivalry',
        version,
        commit: git(root, ['rev-parse', 'HEAD']),
        dirty: status !== '',
    };
}

/** The committed spec, verified; a suite does not run on a spec that fails its check. */
export function committedSpec(root: string): SpecRef {
    const check = checkSpec(path.join(root, 'spec'));
    if (check.spec === undefined) {
        throw new CommandError(
            `the committed spec package fails its check:\n  ${check.problems.join('\n  ')}`,
            EXIT.failed,
        );
    }
    return {
        version: check.spec.version,
        sha256: check.spec.sha256,
        package_format: check.spec.package_format,
    };
}

/** The current time in the record's form. */
export function now(): string {
    return new Date().toISOString();
}
