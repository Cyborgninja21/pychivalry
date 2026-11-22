/**
 * The local game-file suites (docs/PLAN.md item 1.8): `task game:parse`, `game:index`,
 * `game:check`, `game:mods` and `game:bench`. Each reads `CK3_GAME_PATH` and, where it reads
 * mods, `CK3_CORPUS` (and `CK3_CORPUS_SLUGS`), and writes its record to
 * `records/game/<suite>.json`.
 *
 * `game:parse` is the base-game parse suite of build step 2 (parse-suite.ts); `game:index` the
 * index suite of build step 3 (index-suite.ts). The others are still the stubs of build step 1:
 * each establishes the run's context (game build and manifest, the committed spec, the pinned
 * corpus) and writes a valid record whose results are empty. Check and mods are filled in at
 * step 4, bench at step 13.
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
import { catalogueFromSpec, currentPlatform } from '@pychivalry/core';
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
import { readSpecPackage } from './spec.js';
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

/** What a test may change about a run: a smaller folder list, another classification file. */
export interface SuiteOptions {
    readonly manifestFile?: string;
    readonly parseFolders?: readonly SuiteFolder[];
    readonly classificationsFile?: string;
}

const INDEX_NOTES = [
    "The base game is the install's clausewitz/, jomini/ and game/ folders and the DLC packs inside game/dlc/, each its own layer; a pack's files sit at their path inside the pack (spec/override-rules.json, the pack-layer row). The files read are the .txt and .yml files in the folders the committed spec lists; results.base_game.not_described counts the .txt and .yml files in other folders, not read, and not_read every other file by extension.",
    'A definition is a top-level key of a file in a listed folder, recorded with how it is written (record, value, prefixed, constant, container, entry, localization key); a use is a word written anywhere else (records/README.md, Index records). uses counts every word; uses_of_defined_names those whose name something in the index defines, the references of item 3.4.',
    'Names defined more than once are resolved with the committed stand-in rules table, which carries only the rules docs/overrides.md marks settled. by_status counts each name of each database once; an unknown name (defined more than once, winner not known) is counted under every open rule of docs/overrides.md that leaves it open, so unknown_by_rule may sum to more than the unknown names.',
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
];

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
            catalogue: catalogueFromSpec(readSpecPackage(path.join(root, 'spec'))),
            classifications: readClassifications(
                options.classificationsFile ?? parseClassificationsFile(root),
            ),
            ...(options.parseFolders === undefined ? {} : { folders: options.parseFolders }),
        });
        return { ...context, notes: PARSE_NOTES, results: { ...results } };
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
