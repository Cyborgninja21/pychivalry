/**
 * The local game-file suites (docs/PLAN.md item 1.8): `task game:parse`, `game:check`,
 * `game:mods` and `game:bench`. Each reads `CK3_GAME_PATH` and, where it reads mods,
 * `CK3_CORPUS` (and `CK3_CORPUS_SLUGS`), and writes its record to
 * `records/game/<suite>.json`.
 *
 * In build step 1 every suite is a stub, as the plan defines: it establishes the run's context
 * (game build and manifest, the committed spec, the pinned corpus) and writes a valid record
 * whose results are empty. The steps that build each suite fill its results in: parse at
 * step 2, check and mods at step 4, bench at step 13.
 */

import { existsSync, readFileSync } from 'node:fs';
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
import { gameInfo, requireGameDir } from './game.js';
import {
    committedSpec,
    machineInfo,
    now,
    toolInfo,
    type CorpusRef,
    type SuiteRecord,
} from './record.js';
import { CommandError, EXIT, sha256, writeJson, writeText } from './util.js';

export const GAME_SUITES = ['parse', 'check', 'mods', 'bench'] as const;
export type GameSuite = (typeof GAME_SUITES)[number];

/** Which suites read the mod corpus. */
const READS_CORPUS: Record<GameSuite, boolean> = {
    parse: false,
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

/**
 * The record of one suite run, a stub's: the run's context and empty results. `root` is the
 * repository the tool and spec come from; `manifestFile` the corpus manifest to pin against.
 */
export function gameSuiteRecord(
    root: string,
    suite: GameSuite,
    env: SuiteEnv,
    manifestFile = corpusManifestFile(root),
): SuiteRecord {
    const gameDir = requireGameDir(env.CK3_GAME_PATH);
    const corpus = READS_CORPUS[suite] ? pinnedCorpus(manifestFile, env).ref : null;
    return {
        record_format: 1,
        suite: `game:${suite}`,
        command: `task game:${suite}`,
        made_at: now(),
        tool: toolInfo(root),
        machine: machineInfo(),
        game: gameInfo(gameDir),
        spec: committedSpec(root),
        corpus,
        notes: [
            `Build step 1 stub: game:${suite} records the run's context and no results yet (docs/PLAN.md, item 1.8).`,
        ],
        results: {},
    };
}

/** Run one suite and write its record. Returns the record file, relative to the root. */
export function runGameSuite(root: string, suite: GameSuite, env: SuiteEnv): string {
    const record = gameSuiteRecord(root, suite, env);
    const file = path.join('records', 'game', `${suite}.json`);
    writeJson(path.join(root, file), record);
    return file.split(path.sep).join('/');
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
