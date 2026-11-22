/**
 * The baselines of release 2.3.0 (docs/PLAN.md item 1.11): its speed, `task baseline:speed`,
 * and its results, `task baseline:results`.
 *
 * Release 2.3.0 is built from an export of `legacy/` outside the repository
 * (`task baseline:prepare`), so its scripts, which write their own records into their own
 * tree, never touch `legacy/`. The export is pointed at the committed format 4 copy of the
 * spec (`spec/legacy/`, the only spec 2.3.0 can read) by its own `spec.config.json`, which
 * `prepareLegacySpec` writes before the build. Its own tools are run unchanged, one process
 * at a time:
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
 * Every speed series is one first run and then the later runs; the record keeps the first
 * apart and states the median and spread of the later ones. A results baseline runs the first
 * two tools once each and records what 2.3.0 found: its parse and check counts on the base
 * game with every error, and its findings on each mod by code and severity with every error.
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
    closeSync,
    copyFileSync,
    existsSync,
    mkdirSync,
    openSync,
    readFileSync,
    statSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { loadavg } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { gameInfo, requireGameDir } from './game.js';
import { git, machineInfo, now, type SpecRef, type SuiteRecord, type ToolInfo } from './record.js';
import { checkLegacySpec, checksumFileOf, type LegacySpec } from './spec.js';
import { summarize } from './stats.js';
import { corpusManifestFile, pinnedCorpus, type SuiteEnv } from './suites.js';
import { CommandError, EXIT, isObject, readJson, sha256, writeJson, writeText } from './util.js';

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

/** The notes every baseline record carries: what was run, on which spec, and where. */
function commonNotes(legacy: LegacyBuild): string[] {
    const changes =
        legacy.changedFromTag.length === 0
            ? 'identical to the v2.3.0 tree'
            : `the v2.3.0 tree with one change the owner decided (it accepts the since value 1.21.0.3 of the format 4 copy), in ${legacy.changedFromTag.map((f) => `legacy/${f}`).join(' and ')}`;
    return [
        `Release 2.3.0: legacy/ at commit ${legacy.tool.commit.slice(0, 7)}, ${changes}. It was built from an export of legacy/ outside the repository by task baseline:prepare, whose spec.config.json points it at the committed format 4 copy of the spec, ${legacy.specFile} (game ${legacy.spec.version}), the only format release 2.3.0 reads; ${legacy.tool.dirty ? 'other tracked files of the export differ from legacy/ too (tool.dirty).' : 'nothing else in the export differs from legacy/.'}`,
        'The game files read are the build the format 4 copy was derived for, and the corpus is the committed one: records/README.md, "Baselines".',
    ];
}

const SPEED_NOTES = [
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
 * Tracked files of `legacy/` that a baseline run writes on purpose in the export: the spec
 * pointer `task baseline:prepare` writes, and the records release 2.3.0's own tools write into
 * their own tree. Any other difference marks the build as dirty.
 */
const WRITTEN_BY_THE_BASELINE = [
    /^packages\/engine\/spec\.config\.json$/,
    /^packages\/engine\/test\/corpus\/real-mods\/[^/]+\.counts\.json$/,
];

/** Release 2.3.0 as built in an export of `legacy/`, and the spec it was built with. */
export interface LegacyBuild {
    tool: ToolInfo;
    /** The files of `legacy/` that differ from the v2.3.0 tree, relative to `legacy/`. */
    changedFromTag: string[];
    spec: SpecRef;
    /** The committed format 4 copy it runs on, relative to the repository. */
    specFile: string;
}

/**
 * Release 2.3.0 as built in `legacyDir`. `legacy/` is the v2.3.0 tree, or that tree with the
 * changes committed since; the tool's commit is the one that last changed `legacy/`. Every file
 * git tracks under `legacy/` must be in the build copy unchanged, but those a baseline writes.
 */
export function legacyTool(
    root: string,
    legacyDir: string,
): { tool: ToolInfo; changedFromTag: string[] } {
    const tagTree = git(root, ['rev-parse', 'v2.3.0^{tree}']);
    const changedFromTag = git(root, ['diff', '--name-only', tagTree, 'HEAD:legacy'])
        .split('\n')
        .filter((line) => line !== '');
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
        if (WRITTEN_BY_THE_BASELINE.some((pattern) => pattern.test(rel))) {
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
        tool: {
            name: 'pychivalry',
            version: '2.3.0',
            commit: git(root, ['log', '-1', '--format=%H', 'HEAD', '--', 'legacy']),
            dirty: changed > 0,
        },
        changedFromTag,
    };
}

/** The folder of release 2.3.0's engine inside an export of `legacy/`. */
function engineDir(legacyDir: string): string {
    return path.join(legacyDir, 'packages', 'engine');
}

/**
 * Point an export of `legacy/` at the committed format 4 copy of the spec, before it is built
 * (`task baseline:prepare`): copy the copy and its checksum into the engine's `spec/` folder,
 * and write the engine's `spec.config.json`, the one place release 2.3.0 reads to know which
 * package to bundle, to name them. The engine's own `spec/schema.json` is the format 4 schema
 * of `pdx-parser-re` that the copy is valid against. Returns the copy it points at.
 */
export function prepareLegacySpec(root: string, legacyDir: string): LegacySpec {
    const check = checkLegacySpec(path.join(root, 'spec'));
    if (check.legacy === undefined) {
        throw new CommandError(
            `the committed format 4 copy fails its check:\n  ${check.problems.join('\n  ')}`,
            EXIT.failed,
        );
    }
    const engine = engineDir(legacyDir);
    if (!existsSync(path.join(engine, 'spec.config.json'))) {
        throw new CommandError(
            'LEGACY_BUILD is not an export of legacy/: packages/engine/spec.config.json is missing',
            EXIT.usage,
        );
    }
    const name = path.basename(check.legacy.file);
    const shaName = checksumFileOf(name.replace(/\.gz$/, ''));
    copyFileSync(path.join(root, 'spec', check.legacy.file), path.join(engine, 'spec', name));
    copyFileSync(
        path.join(root, 'spec', path.dirname(check.legacy.file), shaName),
        path.join(engine, 'spec', shaName),
    );
    writeText(
        path.join(engine, 'spec.config.json'),
        `${JSON.stringify({ spec: `spec/${name}`, sha256: `spec/${shaName}`, schema: 'spec/schema.json' }, null, 4)}\n`,
    );
    return check.legacy;
}

/**
 * The spec package a built copy of release 2.3.0 bundles, as its build wrote it: the
 * engine's `dist/data/ck3-spec.json.gz` with its `ck3-spec.sha256`, and the same files in the
 * extension's bundle where it has been built.
 */
export function bundledLegacySpec(legacyDir: string): SpecRef {
    const read = (dir: string): SpecRef | undefined => {
        const file = path.join(dir, 'ck3-spec.json.gz');
        if (!existsSync(file)) {
            return undefined;
        }
        const bytes = gunzipSync(readFileSync(file));
        const actual = sha256(bytes);
        const stated = readFileSync(path.join(dir, 'ck3-spec.sha256'), 'utf8')
            .trim()
            .split(/\s+/)[0];
        if (stated?.toLowerCase() !== actual) {
            throw new CommandError(
                `${file}: its uncompressed SHA-256 is ${actual}, its ck3-spec.sha256 says ${String(stated)}`,
                EXIT.failed,
            );
        }
        const data = JSON.parse(bytes.toString('utf8')) as unknown;
        const manifest = isObject(data) && isObject(data['manifest']) ? data['manifest'] : {};
        const format = isObject(data) ? data['package_format'] : undefined;
        if (typeof manifest['version'] !== 'string' || typeof format !== 'number') {
            throw new CommandError(
                `${file} has no manifest.version or package_format`,
                EXIT.failed,
            );
        }
        return { version: manifest['version'], sha256: actual, package_format: format };
    };
    const engine = read(path.join(engineDir(legacyDir), 'dist', 'data'));
    if (engine === undefined) {
        throw new CommandError(
            'LEGACY_BUILD has no built spec (packages/engine/dist/data/ck3-spec.json.gz): run task baseline:prepare',
            EXIT.usage,
        );
    }
    const extension = read(path.join(legacyDir, 'vscode-extension', 'dist', 'data', 'engine'));
    if (extension !== undefined && extension.sha256 !== engine.sha256) {
        throw new CommandError(
            'LEGACY_BUILD: the extension bundles another spec than the engine; run task baseline:prepare again',
            EXIT.failed,
        );
    }
    return engine;
}

/**
 * Release 2.3.0 as built in `legacyDir`, checked to run on the committed format 4 copy: the
 * spec the build bundles must be that copy, byte for byte.
 */
export function legacyBuild(root: string, legacyDir: string): LegacyBuild {
    const committed = checkLegacySpec(path.join(root, 'spec'));
    if (committed.legacy === undefined) {
        throw new CommandError(
            `the committed format 4 copy fails its check:\n  ${committed.problems.join('\n  ')}`,
            EXIT.failed,
        );
    }
    const spec = bundledLegacySpec(legacyDir);
    if (spec.sha256 !== committed.legacy.sha256) {
        throw new CommandError(
            `LEGACY_BUILD bundles spec ${spec.version} (${spec.sha256}), not the committed format 4 copy spec/${committed.legacy.file} (${committed.legacy.sha256}): run task baseline:prepare`,
            EXIT.failed,
        );
    }
    return { ...legacyTool(root, legacyDir), spec, specFile: `spec/${committed.legacy.file}` };
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

/** The one-minute load average, to two decimals: stated before every run. */
function currentLoad(): number {
    return Math.round((loadavg()[0] ?? 0) * 100) / 100;
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

/**
 * One run of release 2.3.0's `corpus-acceptance.js` on one mod, in a fresh process: the
 * `engine` part of the record it writes, and its exit code.
 */
function runCorpusAcceptance(
    legacyDir: string,
    game: string,
    corpus: string,
    slug: string,
    what: string,
): { engine: Record<string, unknown>; status: number | null } {
    const since = Date.now();
    const result = spawnSync(
        process.execPath,
        [path.join('packages', 'engine', 'scripts', 'corpus-acceptance.js'), corpus, game, slug],
        {
            cwd: legacyDir,
            encoding: 'utf8',
            env: cleanEnv({}),
            maxBuffer: 64 * 1024 * 1024,
            timeout: 15 * 60 * 1000,
        },
    );
    // Exit 1 with a fresh record: error findings 2.3.0's own classification file does not
    // cover, as expected on newer mods and a newer game. Without a fresh record it failed.
    const record = freshJson(countsFile(legacyDir, slug), since);
    const engine = record?.['engine'];
    if (
        result.error !== undefined ||
        (result.status !== 0 && result.status !== 1) ||
        !isObject(engine)
    ) {
        failed(`corpus-acceptance.js ${slug}, ${what}`, result);
    }
    return { engine, status: result.status };
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
        loadAverage.push(currentLoad());
        const { engine, status } = runCorpusAcceptance(
            legacyDir,
            game,
            corpus,
            slug,
            `run ${String(run + 1)}`,
        );
        exits.push(status);
        load.push(numberAt(engine, 'loadMilliseconds'));
        total.push(numberAt(engine, 'milliseconds'));
        rss.push(numberAt(engine, 'maxRssKb'));
        files.push(numberAt(engine, 'files'));
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

/**
 * One run of release 2.3.0's `vanilla-acceptance.js` on the base game, in a fresh process,
 * with the Node flags given: the record it writes, and the process's resource usage at exit.
 */
function runVanillaAcceptance(
    root: string,
    legacyDir: string,
    game: string,
    nodeFlags: readonly string[],
    what: string,
): { record: Record<string, unknown>; rusage: Record<string, unknown> } {
    const work = path.join(legacyDir, '.baseline');
    mkdirSync(work, { recursive: true });
    const preload = pathToFileURL(path.join(root, 'tools', 'dist', 'rusage-preload.js')).href;
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
        failed(`vanilla-acceptance.js, ${what}`, result);
    }
    return { record, rusage };
}

function baseGameSeries(
    root: string,
    legacyDir: string,
    game: string,
    runs: number,
    nodeFlags: readonly string[],
): Series {
    const parse: number[] = [];
    const check: number[] = [];
    const rss: number[] = [];
    const files: number[] = [];
    const loadAverage: number[] = [];
    for (let run = 0; run < runs; run++) {
        loadAverage.push(currentLoad());
        const { record, rusage } = runVanillaAcceptance(
            root,
            legacyDir,
            game,
            nodeFlags,
            `run ${String(run + 1)}`,
        );
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
            entry.loadAverage.push(currentLoad());
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

/** A built copy of `legacy/` named by `LEGACY_BUILD`, or a usage error. */
function requireLegacyBuild(env: BaselineEnv): string {
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
    return path.resolve(legacyDir);
}

/** The exit codes of a series, in a sentence, when any run did not exit 0. */
function exitNote(what: string, exits: readonly (number | null)[], why: string): string[] {
    const nonZero = exits.filter((code) => code !== 0).length;
    return nonZero === 0
        ? []
        : [`${String(nonZero)} of ${String(exits.length)} runs of ${what} exited non-zero: ${why}`];
}

/** `task baseline:speed`. Returns the record files written, relative to the root. */
export function runSpeedBaseline(root: string, env: BaselineEnv): string[] {
    const legacy = requireLegacyBuild(env);
    const game = requireGameDir(env.CK3_GAME_PATH);
    const corpus = pinnedCorpus(corpusManifestFile(root), env);
    const runs = runsFrom(env);
    const parts = partsFrom(env);
    const build = legacyBuild(root, legacy);
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
            tool: build.tool,
            machine: machineInfo(),
            game: gameRef,
            spec: build.spec,
            corpus: corpusRef,
            notes: [
                ...commonNotes(build),
                'Only the timings and memory are recorded here; what 2.3.0 found is in the results baselines (results-*.json).',
                ...SPEED_NOTES,
                ...notes,
            ],
            results: { series },
        };
        const file = path.join('records', 'baseline-2.3.0', `speed-${part}.json`);
        writeJson(path.join(root, file), record);
        written.push(file.split(path.sep).join('/'));
    };
    if (parts.includes('mods')) {
        process.stdout.write('baseline: mods (corpus-acceptance.js)\n');
        const series = corpus.ref.slugs.map((slug) =>
            modSeries(legacy, game, corpus.dir, slug, runs),
        );
        const exits = series.flatMap((s) => s.context['exit_codes'] as (number | null)[]);
        write('mods', series, corpus.ref, [
            'load_ms is the workspace load (the mod and the base game indexed) before any mod file is checked; whole_mod_check_ms is the load plus the check of every script file, as release 2.3.0 reports them; peak_rss_kib is the peak resident memory of the process that did both.',
            ...exitNote(
                'corpus-acceptance.js',
                exits,
                "the script exits 1 when an error finding is not covered by 2.3.0's own classification file, written for the corpus copy and spec of 2026-10; its record is written first.",
            ),
        ]);
    }
    if (parts.includes('base-game')) {
        process.stdout.write('baseline: base game (vanilla-acceptance.js)\n');
        const nodeFlags = heapFlags(env);
        write('base-game', [baseGameSeries(root, legacy, game, runs, nodeFlags)], null, [
            ...heapNote(nodeFlags),
            'parse_ms parses every .txt file under common/, events/ and history/; check_ms then loads the same tree as a workspace and runs the registry, schema and scope checks on it. peak_rss_kib is the peak resident memory of the whole process, read at exit.',
        ]);
    }
    if (parts.includes('editor')) {
        if (!hasXvfbRun()) {
            process.stdout.write('baseline: editor skipped: xvfb-run is not installed\n');
        } else {
            process.stdout.write('baseline: editor (the extension harness under xvfb-run)\n');
            const series = editorSeries(legacy, game, corpus.dir, corpus.ref.slugs, runs);
            const exits = series.flatMap(
                (s) => s.context['harness_exit_codes'] as (number | null)[],
            );
            write('editor', series, corpus.ref, [
                "Each run is one invocation of release 2.3.0's extension integration harness (out/test/runTest.js) under xvfb-run, with WAYLAND_DISPLAY, the desktop session bus and the launching VS Code's variables removed, so that no window reached a desktop. Each invocation measures one mod, selected with the harness's own CK3_CORPUS_SLUGS, because the harness stops at the first mod whose assertions fail. The harness runs its own integration suite first, then opens the mod in a fresh VS Code with the game path set and every other setting at its default. The runs go round the mods in turn: run 1 of every mod, then run 2, and so on.",
                "time_to_first_full_result_ms is the harness's own figure: from the extension's activation to the language server's first full background pass. server_peak_rss_kib is the language server's peak resident memory as the harness reports it.",
                ...exitNote(
                    'the harness',
                    exits,
                    "its assertions require every error finding to be classified in 2.3.0's own classification file, written for the corpus copy and spec of 2026-10. Its record of the timings is written before those assertions.",
                ),
            ]);
        }
    }
    return written;
}

/** The note on the heap limit of the base-game run, when one was set. */
function heapNote(nodeFlags: readonly string[]): string[] {
    return nodeFlags.length > 0
        ? [
              `The script ran with the Node flag ${nodeFlags.join(' ')} and was otherwise unchanged: with Node's default heap limit (about 4 GiB here) it runs out of memory on this game build during its check phase.`,
          ]
        : [];
}

// ─── Results baselines ───────────────────────────────────────────────────────

export const RESULT_PARTS = ['base-game', 'mods'] as const;
export type ResultPart = (typeof RESULT_PARTS)[number];

const SEVERITIES = ['error', 'warning', 'information', 'hint'] as const;
type Severity = (typeof SEVERITIES)[number];
type BySeverity = Record<Severity, number>;

/** One count of findings: a code and a severity, as release 2.3.0 reports them. */
export interface CodeCount {
    code: string;
    severity: Severity;
    count: number;
}

function isSeverity(value: unknown): value is Severity {
    return (SEVERITIES as readonly unknown[]).includes(value);
}

function stringAt(value: Record<string, unknown>, key: string, what: string): string {
    const at = value[key];
    if (typeof at !== 'string') {
        throw new CommandError(`release 2.3.0's ${what} has no text at ${key}`, EXIT.failed);
    }
    return at;
}

function listAt(value: unknown, what: string, ...keys: string[]): Record<string, unknown>[] {
    let at: unknown = value;
    for (const key of keys) {
        at = isObject(at) ? at[key] : undefined;
    }
    if (!Array.isArray(at)) {
        throw new CommandError(
            `release 2.3.0's ${what} has no list at ${keys.join('.')}`,
            EXIT.failed,
        );
    }
    return at.filter(isObject);
}

/** Counts by code, sorted by severity, then by count, most first, then by code. */
function sortCounts(counts: CodeCount[]): CodeCount[] {
    return counts.sort(
        (a, b) =>
            SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
            b.count - a.count ||
            (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
    );
}

/** The totals per severity of some counts by code. */
export function severityTotals(counts: readonly CodeCount[]): BySeverity {
    const totals: BySeverity = { error: 0, warning: 0, information: 0, hint: 0 };
    for (const c of counts) {
        totals[c.severity] += c.count;
    }
    return totals;
}

/**
 * The base-game results of one `vanilla-acceptance.js` record: the parse with every parse
 * error, the check with its counts by code and severity and every error, and how much of the
 * base game the scope check could judge.
 */
export function baseGameResults(record: Record<string, unknown>): Record<string, unknown> {
    const parse = isObject(record['parse']) ? record['parse'] : {};
    const checks = isObject(record['checks']) ? record['checks'] : {};
    const scope = isObject(record['scope']) ? record['scope'] : {};
    const trees = isObject(parse['trees']) ? parse['trees'] : {};
    const byCode = isObject(checks['countsBySeverityAndCode'])
        ? checks['countsBySeverityAndCode']
        : {};
    const counts: CodeCount[] = Object.entries(byCode).map(([key, count]) => {
        const [severity, ...code] = key.split(' ');
        if (!isSeverity(severity) || code.length === 0 || typeof count !== 'number') {
            throw new CommandError(
                `release 2.3.0's base-game record has a count ${JSON.stringify(key)} that is not "<severity> <code>"`,
                EXIT.failed,
            );
        }
        return { code: code.join(' '), severity, count };
    });
    const types = isObject(scope['keywordUsesByKnownScopeType'])
        ? scope['keywordUsesByKnownScopeType']
        : {};
    const parseErrors = listAt(record, 'base-game record', 'parse', 'errorList').map((e) => ({
        file: stringAt(e, 'file', 'parse error'),
        line: numberAt(e, 'line'),
        column: numberAt(e, 'column'),
        code: stringAt(e, 'code', 'parse error'),
        message: stringAt(e, 'message', 'parse error'),
    }));
    const checkErrors = listAt(record, 'base-game record', 'checks', 'errorList').map((e) => ({
        file: stringAt(e, 'file', 'check error'),
        line: numberAt(e, 'line'),
        code: stringAt(e, 'code', 'check error'),
        message: stringAt(e, 'message', 'check error'),
    }));
    const sorted = sortCounts(counts);
    return {
        parse: {
            files: numberAt(parse, 'files'),
            by_folder: Object.entries(trees).map(([folder, files]) => ({
                folder,
                files: numberAt({ files }, 'files'),
            })),
            files_with_bom: numberAt(parse, 'filesWithBom'),
            errors: numberAt(parse, 'errors'),
            error_list: parseErrors,
        },
        check: {
            by_severity: severityTotals(sorted),
            by_code: sorted,
            errors: numberAt(checks, 'errors'),
            error_list: checkErrors,
        },
        scope: {
            keyword_uses: numberAt(scope, 'keywordUses'),
            keyword_uses_known_scope: numberAt(scope, 'keywordUsesKnownScope'),
            keyword_uses_judged: numberAt(scope, 'keywordUsesJudged'),
            link_steps_judged: numberAt(scope, 'linkStepsJudged'),
            findings: numberAt(scope, 'findings'),
            keyword_uses_by_known_scope_type: Object.entries(types).map(([type, uses]) => ({
                type,
                uses: numberAt({ uses }, 'uses'),
            })),
        },
    };
}

/**
 * One mod's results from the `engine` part of a `corpus-acceptance.js` record: the files
 * checked, the findings by severity and by code, and every error with the classification
 * release 2.3.0's own classification file gave it.
 */
export function modResults(slug: string, engine: Record<string, unknown>): Record<string, unknown> {
    const raw = isObject(engine['counts']) ? engine['counts'] : {};
    const counts: CodeCount[] = Object.entries(raw).map(([key, value]) => {
        const severity = isObject(value) ? value['severity'] : undefined;
        const count = isObject(value) ? value['count'] : undefined;
        if (!isSeverity(severity) || typeof count !== 'number') {
            throw new CommandError(
                `release 2.3.0's record of ${slug} has a count ${JSON.stringify(key)} without a severity and a count`,
                EXIT.failed,
            );
        }
        // 2.3.0 keys a code met at a second severity as `<code>@<severity>`.
        return { code: key.replace(new RegExp(`@${severity}$`), ''), severity, count };
    });
    const errors = listAt(engine, `record of ${slug}`, 'errors').map((e) => {
        const reason = e['reason'];
        const issue = e['issue'];
        return {
            file: stringAt(e, 'file', `error of ${slug}`),
            line: numberAt(e, 'line'),
            code: stringAt(e, 'code', `error of ${slug}`),
            message: stringAt(e, 'message', `error of ${slug}`),
            classification: stringAt(e, 'classification', `error of ${slug}`),
            ...(typeof reason === 'string' ? { reason } : {}),
            ...(typeof issue === 'string' || typeof issue === 'number'
                ? { issue: String(issue) }
                : {}),
        };
    });
    const sorted = sortCounts(counts);
    const totals = severityTotals(sorted);
    const stated = engine['bySeverity'];
    if (
        isObject(stated) &&
        SEVERITIES.some((severity) => (stated[severity] ?? 0) !== totals[severity])
    ) {
        throw new CommandError(
            `release 2.3.0's record of ${slug}: its totals by severity ${JSON.stringify(stated)} are not those of its counts ${JSON.stringify(totals)}`,
            EXIT.failed,
        );
    }
    return {
        slug,
        files: numberAt(engine, 'files'),
        by_severity: totals,
        by_code: sorted,
        errors: errors.length,
        error_list: errors,
    };
}

function resultPartsFrom(env: BaselineEnv): ResultPart[] {
    const wanted = env.BASELINE_PARTS?.trim();
    if (wanted === undefined || wanted === '') {
        return [...RESULT_PARTS];
    }
    const parts = wanted.split(',').map((p) => p.trim());
    const unknown = parts.filter((p) => !(RESULT_PARTS as readonly string[]).includes(p));
    if (unknown.length > 0) {
        throw new CommandError(
            `BASELINE_PARTS: unknown part ${unknown.join(', ')} (known for results: ${RESULT_PARTS.join(', ')})`,
            EXIT.usage,
        );
    }
    return parts as ResultPart[];
}

/**
 * `task baseline:results`: release 2.3.0 run once on the base game and once on each mod, and
 * what it found recorded. Returns the record files written, relative to the root.
 */
export function runResultBaseline(root: string, env: BaselineEnv): string[] {
    const legacy = requireLegacyBuild(env);
    const game = requireGameDir(env.CK3_GAME_PATH);
    const parts = resultPartsFrom(env);
    const corpus = parts.includes('mods') ? pinnedCorpus(corpusManifestFile(root), env) : null;
    const build = legacyBuild(root, legacy);
    const gameRef = gameInfo(game);
    const written: string[] = [];
    const write = (
        part: ResultPart,
        results: Record<string, unknown>,
        corpusRef: SuiteRecord['corpus'],
        notes: string[],
    ): void => {
        const record: SuiteRecord = {
            record_format: 1,
            suite: 'baseline:results',
            command: `LEGACY_BUILD=<legacy build> CK3_GAME_PATH=<game dir>${part === 'mods' ? ' CK3_CORPUS=<corpus dir>' : ''} BASELINE_PARTS=${part}${part === 'base-game' && env.BASELINE_NODE_HEAP ? ` BASELINE_NODE_HEAP=${env.BASELINE_NODE_HEAP}` : ''} task baseline:results`,
            made_at: now(),
            tool: build.tool,
            machine: machineInfo(),
            game: gameRef,
            spec: build.spec,
            corpus: corpusRef,
            notes: [...commonNotes(build), ...notes],
            results,
        };
        const file = path.join('records', 'baseline-2.3.0', `results-${part}.json`);
        writeJson(path.join(root, file), record);
        written.push(file.split(path.sep).join('/'));
    };
    if (parts.includes('base-game')) {
        process.stdout.write('baseline: base-game results (vanilla-acceptance.js, one run)\n');
        const nodeFlags = heapFlags(env);
        const load = currentLoad();
        const { record } = runVanillaAcceptance(root, legacy, game, nodeFlags, 'results run');
        write(
            'base-game',
            {
                method: 'vanilla-acceptance',
                context: { node_flags: nodeFlags, load_average_1m: load },
                base_game: baseGameResults(record),
            },
            null,
            [
                ...heapNote(nodeFlags),
                "One run of vanilla-acceptance.js. parse is every .txt file under common/, events/ and history/ parsed, with every parse error; check is the same tree loaded as a workspace and run through 2.3.0's registry, schema and scope checks, with the findings counted by code and severity and every error listed; scope says how many keyword uses the scope check could judge. Messages are 2.3.0's own, as it wrote them.",
            ],
        );
    }
    if (corpus !== null) {
        process.stdout.write('baseline: mod results (corpus-acceptance.js, one run per mod)\n');
        const loads: number[] = [];
        const exits: (number | null)[] = [];
        const mods = corpus.ref.slugs.map((slug) => {
            loads.push(currentLoad());
            const { engine, status } = runCorpusAcceptance(
                legacy,
                game,
                corpus.dir,
                slug,
                'results run',
            );
            exits.push(status);
            return modResults(slug, engine);
        });
        write(
            'mods',
            {
                method: 'corpus-acceptance',
                context: { exit_codes: exits, load_average_1m: loads },
                mods,
            },
            corpus.ref,
            [
                "One run of corpus-acceptance.js per mod: the engine's check of every script file of the mod over the base game, as the command line runs it (check <mod> --vanilla <game dir>), with no plug-ins. by_code counts every finding by code and severity; error_list is every error.",
                "classification is what 2.3.0's own classification file (packages/engine/test/corpus/real-mods/classifications.json) says of an error. That file was written for the corpus copy and spec of 2026-10, so an error it does not cover is 'unclassified': it is not a judgement that the error is false.",
                ...exitNote(
                    'corpus-acceptance.js',
                    exits,
                    'the script exits 1 when an error is unclassified; its record is written first.',
                ),
            ],
        );
    }
    return written;
}
