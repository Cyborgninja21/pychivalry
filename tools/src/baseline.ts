/**
 * The speed baselines of release 2.3.0 (docs/PLAN.md item 1.11), `task baseline:speed`.
 *
 * Release 2.3.0 is built from an export of `legacy/` outside the repository
 * (`task baseline:prepare`), so its scripts, which write their own records into their own
 * tree, never touch `legacy/`. Its own tools are run unchanged, one process at a time:
 *
 * - `corpus-acceptance.js <corpus dir> <game dir> <slug>`: per mod, the workspace load
 *   (the mod and the base game) and the whole-mod check, load included, and the peak memory of
 *   the process that did them.
 * - `vanilla-acceptance.js <game dir> <out>`: the base game alone, parsed and then checked;
 *   its peak memory comes from `rusage-preload.js`.
 * - the extension's integration harness (`out/test/runTest.js`) under `xvfb-run`: per mod, a
 *   real VS Code's time from activation to the first full result, and the language server's
 *   peak memory. Only when `xvfb-run` is installed.
 *
 * Every series is one first run and then the later runs; the record keeps the first apart and
 * states the median and spread of the later ones.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, openSync, closeSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadavg } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gameInfo, requireGameDir } from './game.js';
import { git, machineInfo, now, type SpecRef, type SuiteRecord, type ToolInfo } from './record.js';
import { checkSpec } from './spec.js';
import { summarize } from './stats.js';
import { corpusManifestFile, pinnedCorpus, type SuiteEnv } from './suites.js';
import { CommandError, EXIT, isObject, readJson, writeJson } from './util.js';

export const BASELINE_PARTS = ['mods', 'base-game', 'editor'] as const;
export type BaselinePart = (typeof BASELINE_PARTS)[number];

export interface BaselineEnv extends SuiteEnv {
    /** A built copy of `legacy/`, outside the repository. */
    LEGACY_BUILD?: string | undefined;
    /** Runs per series, the first included; at least 6. */
    BASELINE_RUNS?: string | undefined;
    /** Comma-separated parts to run; default all. */
    BASELINE_PARTS?: string | undefined;
    /**
     * V8 heap limit in MiB for the base-game run (`--max-old-space-size`); unset keeps Node's
     * default. 2.3.0's vanilla script needs more than the default on the 1.21 game.
     */
    BASELINE_NODE_HEAP?: string | undefined;
}

interface Measure {
    unit: 'ms' | 'KiB';
    first: number;
    later: ReturnType<typeof summarize>;
}

interface Series {
    name: string;
    method: 'corpus-acceptance' | 'vanilla-acceptance' | 'editor';
    mod: string | null;
    runs: number;
    measures: Record<string, Measure>;
    context: Record<string, unknown>;
}

const COMMON_NOTES = [
    'Release 2.3.0 (the v2.3.0 tree, identical to legacy/), built from an export of legacy/ outside the repository by task baseline:prepare, run with its own spec package (1.20.0.2, format 4) on the current game build. Its spec predates that build, so it reports many unknown-name findings; only the timings and memory are recorded here, not the findings.',
    'Each series is one first run and then the later runs, one process at a time. "first" is the first run of the series in a fresh process; it is not a cold start: the operating system file cache could not be dropped, and the base game and corpus files had already been read (by the corpus copy, the manifest hashing and earlier series), so they were most likely cached. "later" gives the median, minimum, maximum and spread (maximum minus minimum) of the remaining runs, and every value.',
    'The machine was in ordinary use while the runs were made; other processes were running. context.load_average_1m is the one-minute load average just before each run.',
];

function measure(unit: Measure['unit'], values: readonly number[]): Measure {
    const [first, ...later] = values;
    if (first === undefined || later.length < 5) {
        throw new Error('a measure needs a first run and at least five later ones');
    }
    return { unit, first, later: summarize(later) };
}

function runsFrom(env: BaselineEnv): number {
    const runs = Number(env.BASELINE_RUNS ?? '6');
    if (!Number.isInteger(runs) || runs < 6) {
        throw new CommandError('BASELINE_RUNS must be an integer of at least 6', EXIT.usage);
    }
    return runs;
}

function partsFrom(env: BaselineEnv): BaselinePart[] {
    const wanted = env.BASELINE_PARTS?.trim();
    if (wanted === undefined || wanted === '') {
        return [...BASELINE_PARTS];
    }
    const parts = wanted.split(',').map((p) => p.trim());
    const unknown = parts.filter((p) => !(BASELINE_PARTS as readonly string[]).includes(p));
    if (unknown.length > 0) {
        throw new CommandError(
            `BASELINE_PARTS: unknown part ${unknown.join(', ')} (known: ${BASELINE_PARTS.join(', ')})`,
            EXIT.usage,
        );
    }
    return parts as BaselinePart[];
}

/** The SHA-1 git gives a blob: the identity of one tracked file's content. */
function gitBlobSha1(content: Buffer): string {
    return createHash('sha1')
        .update(`blob ${String(content.length)}\0`)
        .update(content)
        .digest('hex');
}

/**
 * Release 2.3.0 as built in `legacyDir`: `legacy/` must be the v2.3.0 tree, and every file
 * git tracks under it must be in the build copy unchanged.
 */
export function legacyTool(root: string, legacyDir: string): ToolInfo {
    const tagTree = git(root, ['rev-parse', 'v2.3.0^{tree}']);
    if (git(root, ['rev-parse', 'HEAD:legacy']) !== tagTree) {
        throw new CommandError('legacy/ is not the v2.3.0 tree', EXIT.failed);
    }
    const listing = git(root, ['ls-tree', '-r', '-z', 'HEAD:legacy']);
    let changed = 0;
    for (const line of listing.split('\0')) {
        const match = /^(\d+) blob ([0-9a-f]{40})\t(.+)$/.exec(line);
        if (match === null) {
            continue;
        }
        const [, mode, blob, rel] = match;
        if (mode === undefined || blob === undefined || rel === undefined || mode === '120000') {
            continue;
        }
        const file = path.join(legacyDir, rel);
        if (!existsSync(file) || gitBlobSha1(readFileSync(file)) !== blob) {
            changed++;
        }
    }
    const version = readJson(path.join(legacyDir, 'packages', 'engine', 'package.json'));
    if (!isObject(version) || version['version'] !== '2.3.0') {
        throw new CommandError('LEGACY_BUILD is not release 2.3.0', EXIT.usage);
    }
    return {
        name: 'pychivalry',
        version: '2.3.0',
        commit: git(root, ['rev-parse', 'v2.3.0^{commit}']),
        dirty: changed > 0,
    };
}

/** The spec package 2.3.0 bundles and ran on. */
function legacySpec(legacyDir: string): SpecRef {
    const check = checkSpec(path.join(legacyDir, 'packages', 'engine', 'spec'));
    if (check.spec === undefined) {
        throw new CommandError(
            `2.3.0's spec package fails its check:\n  ${check.problems.join('\n  ')}`,
            EXIT.failed,
        );
    }
    return {
        version: check.spec.version,
        sha256: check.spec.sha256,
        package_format: check.spec.package_format,
    };
}

/** The environment for release 2.3.0's processes: the launching VS Code's variables removed. */
function cleanEnv(extra: Record<string, string>, drop: readonly string[] = []): NodeJS.ProcessEnv {
    const kept = Object.entries(process.env).filter(
        ([key]) =>
            !key.startsWith('VSCODE_') && key !== 'ELECTRON_RUN_AS_NODE' && !drop.includes(key),
    );
    return { ...Object.fromEntries(kept), ...extra };
}

/**
 * The environment for a VS Code under xvfb: no Wayland, no desktop session bus, X11 only, so
 * no window can reach the desktop the tools are started from.
 */
function headlessEnv(extra: Record<string, string>): NodeJS.ProcessEnv {
    const env = cleanEnv(extra, [
        'WAYLAND_DISPLAY',
        'DISPLAY',
        'XAUTHORITY',
        'DBUS_SESSION_BUS_ADDRESS',
    ]);
    return {
        ...env,
        XDG_SESSION_TYPE: 'x11',
        GDK_BACKEND: 'x11',
        ELECTRON_OZONE_PLATFORM_HINT: 'x11',
        MOZ_ENABLE_WAYLAND: '0',
    };
}

function failed(what: string, result: SpawnSyncReturns<string | Buffer>, log?: string): never {
    const stderr =
        typeof result.stderr === 'string' ? result.stderr.slice(-2000) : log ? `see ${log}` : '';
    throw new CommandError(
        `${what} failed (exit ${String(result.status)}${result.error ? `, ${result.error.message}` : ''}):\n${stderr}`,
        EXIT.failed,
    );
}

/** Read one record that release 2.3.0's scripts wrote, written no earlier than `since`. */
function freshJson(file: string, since: number): Record<string, unknown> | undefined {
    if (!existsSync(file) || statSync(file).mtimeMs < since) {
        return undefined;
    }
    const value = readJson(file);
    return isObject(value) ? value : undefined;
}

function numberAt(value: unknown, ...keys: string[]): number {
    let at: unknown = value;
    for (const key of keys) {
        at = isObject(at) ? at[key] : undefined;
    }
    if (typeof at !== 'number') {
        throw new CommandError(
            `release 2.3.0's record has no number at ${keys.join('.')}`,
            EXIT.failed,
        );
    }
    return at;
}

function countsFile(legacyDir: string, slug: string): string {
    return path.join(
        legacyDir,
        'packages',
        'engine',
        'test',
        'corpus',
        'real-mods',
        `${slug}.counts.json`,
    );
}

function modSeries(
    legacyDir: string,
    game: string,
    corpus: string,
    slug: string,
    runs: number,
): Series {
    const load: number[] = [];
    const total: number[] = [];
    const rss: number[] = [];
    const files: number[] = [];
    const loadAverage: number[] = [];
    const exits: Array<number | null> = [];
    for (let run = 0; run < runs; run++) {
        loadAverage.push(Math.round((loadavg()[0] ?? 0) * 100) / 100);
        const since = Date.now();
        const result = spawnSync(
            process.execPath,
            [
                path.join('packages', 'engine', 'scripts', 'corpus-acceptance.js'),
                corpus,
                game,
                slug,
            ],
            {
                cwd: legacyDir,
                encoding: 'utf8',
                env: cleanEnv({}),
                maxBuffer: 64 * 1024 * 1024,
                timeout: 15 * 60 * 1000,
            },
        );
        // Exit 1 with a fresh record: findings the 2.3.0 classifications do not cover, as
        // expected with a 1.20.0.2 spec on a 1.21 game. Without a fresh record it failed.
        const record = freshJson(countsFile(legacyDir, slug), since);
        if (
            result.error !== undefined ||
            (result.status !== 0 && result.status !== 1) ||
            record === undefined
        ) {
            failed(`corpus-acceptance.js ${slug}, run ${String(run + 1)}`, result);
        }
        exits.push(result.status);
        load.push(numberAt(record, 'engine', 'loadMilliseconds'));
        total.push(numberAt(record, 'engine', 'milliseconds'));
        rss.push(numberAt(record, 'engine', 'maxRssKb'));
        files.push(numberAt(record, 'engine', 'files'));
        process.stdout.write(
            `  ${slug} run ${String(run + 1)}/${String(runs)}: load ${String(load.at(-1))} ms, check ${String(total.at(-1))} ms, ${String(rss.at(-1))} KiB\n`,
        );
    }
    return {
        name: `mod ${slug}: command-line check`,
        method: 'corpus-acceptance',
        mod: slug,
        runs,
        measures: {
            load_ms: measure('ms', load),
            whole_mod_check_ms: measure('ms', total),
            peak_rss_kib: measure('KiB', rss),
        },
        context: {
            script_files_checked: [...new Set(files)],
            exit_codes: exits,
            load_average_1m: loadAverage,
        },
    };
}

/** The Node flags for the base-game run: the heap limit, when `BASELINE_NODE_HEAP` sets one. */
function heapFlags(env: BaselineEnv): string[] {
    const heap = env.BASELINE_NODE_HEAP?.trim();
    if (heap === undefined || heap === '') {
        return [];
    }
    if (!/^[1-9][0-9]*$/.test(heap)) {
        throw new CommandError('BASELINE_NODE_HEAP must be a whole number of MiB', EXIT.usage);
    }
    return [`--max-old-space-size=${heap}`];
}

function baseGameSeries(
    root: string,
    legacyDir: string,
    game: string,
    runs: number,
    nodeFlags: readonly string[],
): Series {
    const work = path.join(legacyDir, '.baseline');
    mkdirSync(work, { recursive: true });
    const preload = pathToFileURL(path.join(root, 'tools', 'dist', 'rusage-preload.js')).href;
    const parse: number[] = [];
    const check: number[] = [];
    const rss: number[] = [];
    const files: number[] = [];
    const loadAverage: number[] = [];
    for (let run = 0; run < runs; run++) {
        loadAverage.push(Math.round((loadavg()[0] ?? 0) * 100) / 100);
        const out = path.join(work, 'vanilla.json');
        const usage = path.join(work, 'vanilla-rusage.json');
        const since = Date.now();
        const result = spawnSync(
            process.execPath,
            [
                ...nodeFlags,
                '--import',
                preload,
                path.join('packages', 'engine', 'scripts', 'vanilla-acceptance.js'),
                game,
                out,
            ],
            {
                cwd: legacyDir,
                encoding: 'utf8',
                env: cleanEnv({ PYCH_RUSAGE_OUT: usage }),
                maxBuffer: 64 * 1024 * 1024,
                timeout: 60 * 60 * 1000,
            },
        );
        const record = freshJson(out, since);
        const rusage = freshJson(usage, since);
        if (
            result.error !== undefined ||
            result.status !== 0 ||
            record === undefined ||
            rusage === undefined
        ) {
            failed(`vanilla-acceptance.js, run ${String(run + 1)}`, result);
        }
        parse.push(numberAt(record, 'parse', 'milliseconds'));
        check.push(numberAt(record, 'checks', 'milliseconds'));
        files.push(numberAt(record, 'parse', 'files'));
        rss.push(numberAt(rusage, 'maxRSS'));
        process.stdout.write(
            `  base game run ${String(run + 1)}/${String(runs)}: parse ${String(parse.at(-1))} ms, check ${String(check.at(-1))} ms, ${String(rss.at(-1))} KiB\n`,
        );
    }
    return {
        name: 'base game: parse common/, events/, history/, then check them',
        method: 'vanilla-acceptance',
        mod: null,
        runs,
        measures: {
            parse_ms: measure('ms', parse),
            check_ms: measure('ms', check),
            peak_rss_kib: measure('KiB', rss),
        },
        context: {
            script_files_parsed: [...new Set(files)],
            node_flags: nodeFlags,
            load_average_1m: loadAverage,
        },
    };
}

/** Whether `xvfb-run` is on the path. */
export function hasXvfbRun(): boolean {
    const result = spawnSync('sh', ['-c', 'command -v xvfb-run'], { encoding: 'utf8' });
    return result.status === 0 && result.stdout.trim() !== '';
}

function editorSeries(
    legacyDir: string,
    game: string,
    corpus: string,
    slugs: readonly string[],
    runs: number,
): Series[] {
    const work = path.join(legacyDir, '.baseline');
    mkdirSync(work, { recursive: true });
    const extensionDir = path.join(legacyDir, 'vscode-extension');
    const empty = (): {
        first: number[];
        rss: number[];
        validated: number[];
        versions: string[];
        loadAverage: number[];
        exits: Array<number | null>;
    } => ({ first: [], rss: [], validated: [], versions: [], loadAverage: [], exits: [] });
    const perMod = new Map(slugs.map((slug) => [slug, empty()]));
    // One invocation per mod and run: the harness stops at the first mod whose assertions
    // fail, so a run over several mods would leave the later ones unmeasured.
    for (let run = 0; run < runs; run++) {
        for (const slug of slugs) {
            const entry = perMod.get(slug) ?? empty();
            entry.loadAverage.push(Math.round((loadavg()[0] ?? 0) * 100) / 100);
            const log = path.join(work, `editor-run-${String(run + 1)}-${slug}.log`);
            const fd = openSync(log, 'w');
            const since = Date.now();
            let result: SpawnSyncReturns<Buffer>;
            try {
                result = spawnSync(
                    'xvfb-run',
                    ['-a', process.execPath, path.join('out', 'test', 'runTest.js')],
                    {
                        cwd: extensionDir,
                        env: headlessEnv({
                            CK3_CORPUS: corpus,
                            CK3_GAME_PATH: game,
                            CK3_CORPUS_SLUGS: slug,
                        }),
                        stdio: ['ignore', fd, fd],
                        timeout: 60 * 60 * 1000,
                    },
                );
            } finally {
                closeSync(fd);
            }
            const record = freshJson(countsFile(legacyDir, slug), since);
            const editor = record?.['editor'];
            if (result.error !== undefined || !isObject(editor)) {
                failed(
                    `the editor harness, run ${String(run + 1)}, ${slug}: no fresh editor record`,
                    result,
                    log,
                );
            }
            entry.exits.push(result.status);
            entry.first.push(numberAt(editor, 'timeToFirstFullResultMs'));
            entry.rss.push(numberAt(editor, 'peakServerRssKb'));
            entry.validated.push(numberAt(editor, 'filesValidated'));
            const version = editor['vscodeVersion'];
            entry.versions.push(typeof version === 'string' ? version : 'unknown');
            process.stdout.write(
                `  editor run ${String(run + 1)}/${String(runs)} ${slug}: ${String(entry.first.at(-1))} ms, ${String(entry.rss.at(-1))} KiB\n`,
            );
        }
    }
    return slugs.map((slug) => {
        const entry = perMod.get(slug) ?? empty();
        return {
            name: `mod ${slug}: editor, time to first full result`,
            method: 'editor' as const,
            mod: slug,
            runs,
            measures: {
                time_to_first_full_result_ms: measure('ms', entry.first),
                server_peak_rss_kib: measure('KiB', entry.rss),
            },
            context: {
                files_validated: [...new Set(entry.validated)],
                vscode_versions: [...new Set(entry.versions)],
                harness_exit_codes: entry.exits,
                load_average_1m: entry.loadAverage,
            },
        };
    });
}

/** `task baseline:speed`. Returns the record files written, relative to the root. */
export function runSpeedBaseline(root: string, env: BaselineEnv): string[] {
    const legacyDir = env.LEGACY_BUILD;
    if (
        legacyDir === undefined ||
        legacyDir === '' ||
        !existsSync(path.join(legacyDir, 'packages', 'engine', 'dist', 'index.js'))
    ) {
        throw new CommandError(
            'LEGACY_BUILD must name a built copy of legacy/ (task baseline:prepare)',
            EXIT.usage,
        );
    }
    const legacy = path.resolve(legacyDir);
    const game = requireGameDir(env.CK3_GAME_PATH);
    const corpus = pinnedCorpus(corpusManifestFile(root), env);
    const runs = runsFrom(env);
    const parts = partsFrom(env);
    const tool = legacyTool(root, legacy);
    const spec = legacySpec(legacy);
    const gameRef = gameInfo(game);
    const written: string[] = [];
    const write = (
        part: BaselinePart,
        series: Series[],
        corpusRef: SuiteRecord['corpus'],
        notes: string[],
    ): void => {
        const record: SuiteRecord = {
            record_format: 1,
            suite: 'baseline:speed',
            command: `LEGACY_BUILD=<legacy build> CK3_GAME_PATH=<game dir> CK3_CORPUS=<corpus dir> BASELINE_PARTS=${part} BASELINE_RUNS=${String(runs)}${part === 'base-game' && env.BASELINE_NODE_HEAP ? ` BASELINE_NODE_HEAP=${env.BASELINE_NODE_HEAP}` : ''} task baseline:speed`,
            made_at: now(),
            tool,
            machine: machineInfo(),
            game: gameRef,
            spec,
            corpus: corpusRef,
            notes: [...COMMON_NOTES, ...notes],
            results: { series },
        };
        const file = path.join('records', 'baseline-2.3.0', `speed-${part}.json`);
        writeJson(path.join(root, file), record);
        written.push(file.split(path.sep).join('/'));
    };
    if (parts.includes('mods')) {
        process.stdout.write('baseline: mods (corpus-acceptance.js)\n');
        write(
            'mods',
            corpus.ref.slugs.map((slug) => modSeries(legacy, game, corpus.dir, slug, runs)),
            corpus.ref,
            [
                'load_ms is the workspace load (the mod and the base game indexed) before any mod file is checked; whole_mod_check_ms is the load plus the check of every script file, as release 2.3.0 reports them; peak_rss_kib is the peak resident memory of the process that did both.',
                "Exit code 1 is expected: findings that 2.3.0's classification file does not cover, from its 1.20.0.2 spec on the newer game and newer mod versions.",
            ],
        );
    }
    if (parts.includes('base-game')) {
        process.stdout.write('baseline: base game (vanilla-acceptance.js)\n');
        const nodeFlags = heapFlags(env);
        write('base-game', [baseGameSeries(root, legacy, game, runs, nodeFlags)], null, [
            ...(nodeFlags.length > 0
                ? [
                      `The script ran with the Node flag ${nodeFlags.join(' ')} and was otherwise unchanged: with Node's default heap limit (about 4 GiB here) it ran out of memory on this game build during its check phase.`,
                  ]
                : []),
            'parse_ms parses every .txt file under common/, events/ and history/; check_ms then loads the same tree as a workspace and runs the registry, schema and scope checks on it. peak_rss_kib is the peak resident memory of the whole process, read at exit.',
        ]);
    }
    if (parts.includes('editor')) {
        if (!hasXvfbRun()) {
            process.stdout.write('baseline: editor skipped: xvfb-run is not installed\n');
        } else {
            process.stdout.write('baseline: editor (the extension harness under xvfb-run)\n');
            write(
                'editor',
                editorSeries(legacy, game, corpus.dir, corpus.ref.slugs, runs),
                corpus.ref,
                [
                    "Each run is one invocation of release 2.3.0's extension integration harness (out/test/runTest.js) under xvfb-run, with WAYLAND_DISPLAY, the desktop session bus and the launching VS Code's variables removed, so that no window reached a desktop. Each invocation measures one mod, selected with the harness's own CK3_CORPUS_SLUGS, because the harness stops at the first mod whose assertions fail. The harness runs its own integration suite first, then opens the mod in a fresh VS Code with the game path set and every other setting at its default. The runs go round the mods in turn: run 1 of every mod, then run 2, and so on.",
                    "time_to_first_full_result_ms is the harness's own figure: from the extension's activation to the language server's first full background pass. server_peak_rss_kib is the language server's peak resident memory as the harness reports it.",
                    'The harness exits non-zero on these runs: its assertions require every error finding to be classified, which the 1.20.0.2 spec on the newer game does not meet. Its record of the timings is written before those assertions.',
                ],
            );
        }
    }
    return written;
}
