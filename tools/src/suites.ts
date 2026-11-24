/**
 * The local game-file suites (docs/PLAN.md item 1.8): `task game:parse`, `game:index`,
 * `game:check`, `game:mods` and `game:bench`. Each reads `CK3_GAME_PATH` and, where it reads
 * mods, `CK3_CORPUS` (and `CK3_CORPUS_SLUGS`), and writes its record to
 * `records/game/<suite>.json`.
 *
 * `game:parse` is the base-game parse suite of build step 2 (parse-suite.ts); `game:index` the
 * index suite of build step 3 (index-suite.ts); `game:check` and `game:mods` the check suites
 * of item 4.10 (check-suite.ts). `game:bench` is still the stub of build step 1: it
 * establishes the run's context (game build and manifest, the committed spec, the pinned
 * corpus) and writes a valid record whose results are empty; it is filled in at step 13.
 */

import { existsSync, readFileSync } from 'node:fs';
import { loadavg } from 'node:os';
import path from 'node:path';
import {
    corpusRow,
    corpusSlugs,
    type CorpusRow,
    parseCorpusManifest,
    renderCorpusManifest,
    requireCorpusDir,
    selectSlugs,
    verifyCorpus,
} from './corpus.js';
import { catalogueFromSpec, currentPlatform, openSpec } from '@pychivalry/core';
import { runCheckSuite, runModsSuite } from './check-suite.js';
import { gameInfo, requireGameDir } from './game.js';
import { runIndexSuite } from './index-suite.js';
import {
    readClassifications,
    runParseSuite,
    type ParseSuiteResults,
    type SuiteFolder,
} from './parse-suite.js';
import {
    committedSpec,
    machineInfo,
    now,
    toolInfo,
    type CorpusRef,
    type SuiteRecord,
} from './record.js';
import { committedRules } from './rules-table.js';
import { CommandError, EXIT, sha256, writeJson, writeText } from './util.js';

export const GAME_SUITES = ['parse', 'index', 'check', 'mods', 'bench'] as const;
export type GameSuite = (typeof GAME_SUITES)[number];

/** Which suites read the mod corpus. */
const READS_CORPUS: Record<GameSuite, boolean> = {
    parse: false,
    index: true,
    check: false,
    mods: true,
    bench: true,
};

export interface SuiteEnv {
    CK3_GAME_PATH?: string | undefined;
    CK3_CORPUS?: string | undefined;
    CK3_CORPUS_SLUGS?: string | undefined;
}

/** Where the committed corpus manifest lives. */
export function corpusManifestFile(root: string): string {
    return path.join(root, 'records', 'corpus', 'MANIFEST.tsv');
}

/** A corpus manifest file: its rows and the SHA-256 of its bytes. */
export function readCorpusManifest(file: string): { rows: CorpusRow[]; sha256: string } {
    if (!existsSync(file)) {
        throw new CommandError(
            'records/corpus/MANIFEST.tsv is missing: run task corpus:manifest',
            EXIT.usage,
        );
    }
    const bytes = readFileSync(file);
    return { rows: parseCorpusManifest(bytes.toString('utf8')), sha256: sha256(bytes) };
}

/**
 * The corpus a run reads, checked against a corpus manifest (the committed one, for every
 * task). A mod whose copy on disk differs from the pinned one fails the run: its results
 * would not be comparable.
 */
export function pinnedCorpus(manifestFile: string, env: SuiteEnv): { dir: string; ref: CorpusRef } {
    const dir = requireCorpusDir(env.CK3_CORPUS);
    const manifest = readCorpusManifest(manifestFile);
    const slugs = selectSlugs(manifest.rows, env.CK3_CORPUS_SLUGS);
    const problems = verifyCorpus(dir, manifest.rows, slugs);
    if (problems.length > 0) {
        throw new CommandError(
            `the corpus on disk is not the pinned one:\n  ${problems.join('\n  ')}`,
            EXIT.failed,
        );
    }
    return { dir, ref: { manifest_sha256: manifest.sha256, slugs } };
}

/** Where the classifications of the base game's parse errors live. */
export function parseClassificationsFile(root: string): string {
    return path.join(root, 'tools', 'data', 'parse-classifications.json');
}

/** Where the classifications of the base game's check errors and warnings live. */
export function checkClassificationsFile(root: string): string {
    return path.join(root, 'tools', 'data', 'check-classifications.json');
}

/** Where the classifications of the corpus mods' check errors live. */
export function modsClassificationsFile(root: string): string {
    return path.join(root, 'tools', 'data', 'mods-classifications.json');
}

/** What a test may change about a run: a smaller folder list, another classification file. */
export interface SuiteOptions {
    readonly manifestFile?: string;
    readonly parseFolders?: readonly SuiteFolder[];
    readonly classificationsFile?: string;
}

const CHECK_NOTES = [
    "Every file of the base game the index reads is checked (the .txt and .yml files of the folders the committed spec lists, in the install's clausewitz/, jomini/ and game/ folders and the DLC packs, each in its own layer), with the core's one runner, checkWorkspace, as the command line's check runs it on a mod: the parser and every engine check, over the base game's own index, built in the same process.",
    "Every error and warning is listed with its file, layer, line and column, and classified in tools/data/check-classifications.json, matched by layer, file, code and line: game-defect (a defect of the game's own files), spec-package-fault (the committed spec package is wrong or lacks what the check needs; the request is in docs/decisions.md) or pychivalry-fault (fails the run). Information and hints are counted by code.",
    "scope counts the keyword uses (triggers, effects and iterators in trigger and effect blocks) the scope checks saw, those whose scope was known, those judged against the scope data of the game's own documentation, the findings, and the uses not judged by why; and the link steps judged. baseline_2_3_0 gives release 2.3.0's figures on the same game from records/baseline-2.3.0/results-base-game.json.",
    "time_ms and peak_rss_kib are the checking process's own: listing and building the base game's index, then checking every file; times in milliseconds on this machine.",
    "The style/ family (docs/formatting.md) rests on pychivalry's own formatting rules, not on the game: its warning (style/not-formatted, one a file not in the format) and its hints are counted in by_code and by_severity, never listed or classified; warnings and warning_list are the other warnings. The base game is not written in the format, so nearly every file has a style warning.",
];

const MODS_NOTES = [
    "Each corpus mod is checked with the core's one runner, checkWorkspace, as the command line's check runs it: its .txt and .yml files in the folders the committed spec lists, over the base game's index. The index is built once into a cache in a temporary folder (base_game_cache), deleted after the run; each mod is checked in a fresh process that loads it from there.",
    'Every error is listed and classified in tools/data/mods-classifications.json, matched by mod, file, code and line: real-defect (shown from the mod and game 1.21.0.3), spec-package-fault, pychivalry-fault (fails the run) or unclassified (not shown either way: fails the run). Warnings are listed; information and hints are counted by code.',
    "baseline_2_3_0 gives release 2.3.0's results on the same mod from records/baseline-2.3.0/results-mods.json, and how many errors the two report at the same file and line.",
    "time_ms.load_base is listing the base game's files and loading its index from the cache; time_ms.check indexing the mod over it and checking it; peak_rss_kib the mod's process's own.",
    "The style/ family (docs/formatting.md) is counted in by_code and by_severity, never listed or classified: it rests on pychivalry's own formatting rules, not on the game. warnings and warning_list are the other warnings.",
];

const INDEX_NOTES = [
    "The base game is the install's clausewitz/, jomini/ and game/ folders and the DLC packs inside game/dlc/, each its own layer; a pack's files sit at their path inside the pack (the spec package's override rules, part D1, the pack-layer row). The files read are the .txt and .yml files in the folders the committed spec lists; results.base_game.not_described counts the .txt and .yml files in other folders, not read, and not_read every other file by extension.",
    "A definition is a top-level key of a file in a listed folder, recorded with how it is written (record, value, prefixed, constant, container, entry, localization key), less the forms the package's part D2 confirms declare no name (namespace, settings), and with the nested definitions and file-named records its part D3 confirms (records/README.md, Index records); a constant holds for its file where D2 says so. A use is a word written anywhere else. uses counts every word; uses_of_defined_names those whose name something in the index defines, the references of item 3.4.",
    "Names defined more than once are resolved with the spec package's override rules (part D1): a row decides when its status is settled or derived and its kind is one the index applies; a partial or open row decides nothing. by_status counts each name of each database once; an unknown name (defined more than once, winner not known) is counted under the docs/overrides.md rule of each reason that leaves it open (unknown_by_rule, which may sum to more than the unknown names) and by its reasons (unknown_by_reason).",
    "The fresh build, the reload from the cache and each mod over the base game run one at a time, each in a fresh process (tools/src/index-worker.ts), with Node's default heap. peak_rss_kib is that process's peak resident memory, read right after the build, the reload or the mod; times are in milliseconds on this machine. The cache is written to a temporary folder and deleted after the run; its key is the spec checksum, the rules digest, the platform, the game build and the manifest of the files read.",
];

/** What the index record says of the spec's game version against the installed build. */
export function specGameNote(specVersion: string, gameBuild: string): string {
    return specVersion === gameBuild
        ? `The spec is for game ${specVersion}, the build installed. not_described lists the folders the spec does not list that hold .txt or .yml files (beside_spec_folders true when a folder of the spec shares their first folder), and spec_folders_without_files the spec's folders that hold no file read in this install.`
        : `The spec is for game ${specVersion} and the game is ${gameBuild}: a folder the newer game adds is not described by the spec (not_described with beside_spec_folders true), and spec_folders_without_files lists the spec's folders that hold no file read in this install.`;
}

const PARSE_NOTES = [
    'The folders and extensions read, with the evidence that each holds script and the number of files expected, are listed in results.folders; text files not read, and why, in results.not_read (docs/encoding.md, "What the parser reads").',
    'Files are decoded as UTF-8, the default: no fallback encoding is named. A file that is not valid UTF-8 is read in full and gets one information note (results.notes).',
    'Every error is classified in tools/data/parse-classifications.json, matched by file, finding and line. parse_ms is the time to decode and parse, on this machine, in one process.',
    'results.encoding measures every text file of the game folder, whether the suite parses it or not: the figures of docs/encoding.md.',
    "results.round_trip is the formatter's round trip (docs/PLAN.md item 8.3) over every file parsed, with the rules every surface uses (docs/formatting.md): each is formatted, its output parsed and compared with the input without offsets (the same items in order and nesting, of the same kinds, with the same texts, scalar types, operators, names before keys, closings and chain segments, and comments but for their trailing spaces and tabs), its tokens compared, its comments counted and each checked to keep the tokens around it and its own line or not, and formatted a second time to the same bytes. A file with a parse error is left as it is (results.round_trip.left). by_rule counts the places, files and lines each style/ hint names; width the lines over 120 columns (a tab to the next multiple of four, every code point one column) before formatting, formatted without the 120-column rule and with it, and the files that rule changes on its own. format_ms is formatting alone, in one process. results.round_trip_localization is the same over the game's localization/ .yml files, their reading by the index's localization reader compared.",
];

/** The load average just before a run, as a note. */
function loadNote(context: { machine: { logical_cpus: number } }, load: number): string {
    return `The load average over one minute was ${load.toFixed(2)} on ${String(context.machine.logical_cpus)} logical CPUs just before the run: the times are this machine's, under that load.`;
}

/**
 * The record of one suite run. `root` is the repository the tool and spec come from; the
 * corpus manifest pinned against is the committed one unless a test names another.
 */
export function gameSuiteRecord(
    root: string,
    suite: GameSuite,
    env: SuiteEnv,
    options: SuiteOptions = {},
): SuiteRecord {
    const gameDir = requireGameDir(env.CK3_GAME_PATH);
    const manifestFile = options.manifestFile ?? corpusManifestFile(root);
    const pinned = READS_CORPUS[suite] ? pinnedCorpus(manifestFile, env) : null;
    const corpus = pinned?.ref ?? null;
    const context = {
        record_format: 1 as const,
        suite: `game:${suite}` as const,
        command: `task game:${suite}`,
        made_at: now(),
        tool: toolInfo(root),
        machine: machineInfo(),
        game: gameInfo(gameDir),
        spec: committedSpec(root),
        corpus,
    };
    if (suite === 'parse') {
        const results: ParseSuiteResults = runParseSuite(gameDir, {
            catalogue: catalogueFromSpec(openSpec(path.join(root, 'spec')).data),
            classifications: readClassifications(
                options.classificationsFile ?? parseClassificationsFile(root),
            ),
            ...(options.parseFolders === undefined ? {} : { folders: options.parseFolders }),
        });
        return { ...context, notes: PARSE_NOTES, results: { ...results } };
    }
    if (suite === 'check') {
        const loadBefore = loadavg()[0] ?? 0;
        const results = runCheckSuite({
            root,
            gameDir,
            classificationsFile: options.classificationsFile ?? checkClassificationsFile(root),
        });
        return { ...context, notes: [...CHECK_NOTES, loadNote(context, loadBefore)], results };
    }
    if (suite === 'mods') {
        const loadBefore = loadavg()[0] ?? 0;
        const results = runModsSuite({
            root,
            gameDir,
            corpus: { dir: pinned?.dir ?? '', slugs: pinned?.ref.slugs ?? [] },
            classificationsFile: options.classificationsFile ?? modsClassificationsFile(root),
        });
        return { ...context, notes: [...MODS_NOTES, loadNote(context, loadBefore)], results };
    }
    if (suite === 'index') {
        const loadBefore = loadavg()[0] ?? 0;
        const results = runIndexSuite({
            root,
            gameDir,
            corpus: pinned === null ? null : { dir: pinned.dir, slugs: pinned.ref.slugs },
            rulesSha256: committedRules(root).sha256,
            platform: currentPlatform() ?? process.platform,
        });
        const load = `The load average over one minute was ${loadBefore.toFixed(2)} on ${String(context.machine.logical_cpus)} logical CPUs just before the run: the times are this machine's, under that load.`;
        return {
            ...context,
            notes: [...INDEX_NOTES, specGameNote(context.spec.version, context.game.build), load],
            results,
        };
    }
    return {
        ...context,
        notes: [
            `Build step 1 stub: game:${suite} records the run's context and no results yet (docs/PLAN.md, item 1.8).`,
        ],
        results: {},
    };
}

/** What a suite run wrote, and whether it passed. */
export interface SuiteRun {
    /** The record file, relative to the root. */
    readonly file: string;
    readonly passed: boolean;
    readonly failures: readonly string[];
}

/** Run one suite and write its record, passed or not. */
export function runGameSuite(root: string, suite: GameSuite, env: SuiteEnv): SuiteRun {
    const record = gameSuiteRecord(root, suite, env);
    const file = path.join('records', 'game', `${suite}.json`);
    writeJson(path.join(root, file), record);
    const failures = Array.isArray(record.results['failures'])
        ? (record.results['failures'] as unknown[]).map(String)
        : [];
    return {
        file: file.split(path.sep).join('/'),
        passed: record.results['passed'] !== false,
        failures,
    };
}

/**
 * `task corpus:manifest`: measure every mod folder in `CK3_CORPUS` and write the manifest to
 * `records/corpus/MANIFEST.tsv` and, for release 2.3.0's scripts, which read it there, to
 * `<corpus dir>/MANIFEST.tsv`.
 */
export function writeCorpusManifest(root: string, env: SuiteEnv): string {
    const dir = requireCorpusDir(env.CK3_CORPUS);
    const slugs = corpusSlugs(dir);
    if (slugs.length === 0) {
        throw new CommandError('CK3_CORPUS holds no mod folders', EXIT.usage);
    }
    const text = renderCorpusManifest(slugs.map((slug) => corpusRow(dir, slug)));
    writeText(corpusManifestFile(root), text);
    writeText(path.join(dir, 'MANIFEST.tsv'), text);
    return text;
}
