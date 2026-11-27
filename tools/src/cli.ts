#!/usr/bin/env node
/**
 * The tools behind the local tasks (Taskfile.yml). Exit codes: 0 passed, 1 a check or pass
 * condition failed, 2 bad usage.
 *
 *   spec check                     the committed spec package (task spec:check)
 *   records check                  every committed record (task records:check)
 *   game parse|index|check|mods|bench    a game-file suite (task game:<suite>)
 *   corpus manifest                measure the corpus into records/corpus/MANIFEST.tsv
 *   baseline spec                  point an export of legacy/ at the committed format 4 copy
 *                                  (part of task baseline:prepare)
 *   baseline speed                 release 2.3.0's speed baselines (task baseline:speed)
 *   baseline results               release 2.3.0's result baselines (task baseline:results)
 *   wiki check|build|publish       the repository wiki, generated from docs/ (task wiki:*)
 *   advice proof                   the advice checks of item 4.7 and the best-practice rules
 *                                  of the family style on the base game: per row, the units it
 *                                  applies to and the findings it raises there
 *   docs checks                    write the user guide's check reference, docs/guide/checks.md,
 *                                  from the core's check inventory (task docs:checks)
 *   scored agent-use               the scored agent-use test: test sessions of the developer's
 *                                  own Claude Code on the planted-defect mod (task
 *                                  scored:agent-use; never in CI, only on the owner's word)
 *   scored authoring               the scored authoring test: test sessions of the developer's
 *                                  own Claude Code writing the content requests of
 *                                  fixtures/requests, each result graded by the checker, by its
 *                                  expectations and by a judge's test session (task
 *                                  scored:authoring; never in CI, only on the owner's word)
 *   scored calibrate               the judge's calibration: a judge's test session on each
 *                                  result graded by hand, and the agreement (task
 *                                  scored:calibrate; never in CI, only on the owner's word)
 *   scored targets                 an authoring record read against the owner's targets, each
 *                                  met or not; starts no test session (task scored:targets)
 *   scored rejudge                 the judge run again, with the committed judge's prompt, over
 *                                  an authoring record's kept results: a judge's test session
 *                                  on each, no authoring session (task scored:rejudge; never in
 *                                  CI, only on the owner's word)
 *   game capture-log               one capture of the game's logs on the analysis machine (task
 *                                  game:capture-log; never in CI, refused without the owner's
 *                                  word recorded for a launch, game-log/guard.ts)
 *   scored in-game-load            one authoring result through the in-game load: two captures
 *                                  and the grade (task scored:in-game-load; the same guard)
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openSpec } from '@pychivalry/core';
import { adviceProof, proofText } from './advice-proof.js';
import { writeCheckReference } from './check-reference.js';
import { writeGameLogReference } from './game-log-reference.js';
import { prepareLegacySpec, runResultBaseline, runSpeedBaseline } from './baseline.js';
import { requireGameDir } from './game.js';
import { checkRecords } from './records-check.js';
import { checkRulesTable, RULES_SOURCE, rulesUse } from './rules-table.js';
import { runAuthoring } from './scored-run/authoring.js';
import { readRecordTargets, targetLines } from './scored-run/authoring-targets.js';
import { runCalibration } from './scored-run/calibration.js';
import { runRejudge } from './scored-run/rejudge.js';
import { runScored } from './scored-run/run.js';
import { LaunchRefused } from './game-log/guard.js';
import { captureFromEnv, inGameLoadFromEnv } from './game-log/launch-cli.js';
import { checkSpecFolder, SCHEMA_FILE } from './spec.js';
import { GAME_SUITES, runGameSuite, writeCorpusManifest, type GameSuite } from './suites.js';
import { CommandError, EXIT, relativePosix, repoRoot } from './util.js';
import { buildWiki, publishWiki } from './wiki.js';

const USAGE = `usage: pychivalry-tools <command>
  spec check
  records check
  game ${GAME_SUITES.join('|')}
  corpus manifest
  baseline spec|speed|results
  wiki check|build|publish
  advice proof
  docs checks|game-log
  scored agent-use|authoring|calibrate|targets|rejudge|in-game-load
  game capture-log`;

function run(args: readonly string[]): number {
    const root = repoRoot();
    const [group, command] = args;
    if (group === 'spec' && command === 'check') {
        const check = checkSpecFolder(path.join(root, 'spec'));
        const rules = checkRulesTable(path.join(root, 'spec'));
        const problems = [...check.problems, ...rules.problems];
        if (
            check.spec === undefined ||
            check.legacy === undefined ||
            rules.table === undefined ||
            problems.length > 0
        ) {
            process.stderr.write(`spec check failed:\n  ${problems.join('\n  ')}\n`);
            return EXIT.failed;
        }
        const { file, sha256, package_format: format, companions } = check.spec;
        process.stdout.write(
            `spec check: ${file} is package format ${String(format)}, sha256 ${sha256} (uncompressed), valid against ${SCHEMA_FILE}: ok\n`,
        );
        for (const companion of companions) {
            process.stdout.write(
                `spec check: companion ${companion.file}.gz (${companion.part}, ${companion.key}) has the sha256 and size the package states and is valid against ${SCHEMA_FILE}: ok\n`,
            );
        }
        process.stdout.write(
            `spec check: ${check.legacy.file} is the format ${String(check.legacy.package_format)} copy for release 2.3.0, sha256 ${check.legacy.sha256} (uncompressed): ok\n`,
        );
        const use = rulesUse(rules.table)
            .map(
                (u) =>
                    `${u.platform}: ${String(u.applied)} applied, ${String(u.not_settled)} not settled, ${String(u.skipped)} skipped (${String(u.file_conditions)} with a file condition applied)`,
            )
            .join('; ');
        process.stdout.write(
            `spec check: ${RULES_SOURCE} reads with the core's reader: ${String(rules.table.rules.length)} rows (${use}), digest ${String(rules.sha256)}: ok\n`,
        );
        return EXIT.ok;
    }
    if (group === 'records' && command === 'check') {
        const { files, problems } = checkRecords(root);
        if (problems.length > 0) {
            process.stderr.write(`records check failed:\n  ${problems.join('\n  ')}\n`);
            return EXIT.failed;
        }
        process.stdout.write(
            `records check: ${String(files.length)} records valid and made on the committed spec\n`,
        );
        return EXIT.ok;
    }
    if (group === 'game' && (GAME_SUITES as readonly string[]).includes(command ?? '')) {
        const run = runGameSuite(root, command as GameSuite, process.env);
        process.stdout.write(`game:${String(command)}: record written to ${run.file}\n`);
        if (!run.passed) {
            process.stderr.write(
                `game:${String(command)} failed:\n  ${run.failures.join('\n  ')}\n`,
            );
            return EXIT.failed;
        }
        return EXIT.ok;
    }
    if (group === 'corpus' && command === 'manifest') {
        process.stdout.write(writeCorpusManifest(root, process.env));
        return EXIT.ok;
    }
    if (group === 'baseline' && command === 'spec') {
        const legacyDir = process.env['LEGACY_BUILD'];
        if (legacyDir === undefined || legacyDir === '') {
            throw new CommandError('LEGACY_BUILD must name an export of legacy/', EXIT.usage);
        }
        const legacy = prepareLegacySpec(root, legacyDir);
        process.stdout.write(
            `baseline: the export's spec.config.json points at spec/${legacy.file} (format ${String(legacy.package_format)}, game ${legacy.version}, sha256 ${legacy.sha256})\n`,
        );
        return EXIT.ok;
    }
    if (group === 'baseline' && (command === 'speed' || command === 'results')) {
        const files =
            command === 'speed'
                ? runSpeedBaseline(root, process.env)
                : runResultBaseline(root, process.env);
        for (const file of files) {
            process.stdout.write(`baseline: record written to ${file}\n`);
        }
        return EXIT.ok;
    }
    if (group === 'wiki' && (command === 'check' || command === 'build')) {
        // A check builds into a throwaway folder; a build keeps the result to look at.
        const out =
            command === 'build'
                ? path.join(root, '.wiki-build')
                : path.join(mkdtempSync(path.join(tmpdir(), 'pychivalry-wiki-check-')), 'wiki');
        try {
            const { files, problems } = buildWiki(root, out);
            if (problems.length > 0) {
                process.stderr.write(`wiki ${command} failed:\n  ${problems.join('\n  ')}\n`);
                return EXIT.failed;
            }
            const where = command === 'build' ? `, written to ${out}` : '';
            process.stdout.write(`wiki ${command}: ${String(files.length)} files${where}: ok\n`);
            return EXIT.ok;
        } finally {
            if (command === 'check') {
                rmSync(path.dirname(out), { recursive: true, force: true });
            }
        }
    }
    if (group === 'wiki' && command === 'publish') {
        process.stdout.write(publishWiki(root, process.env));
        return EXIT.ok;
    }
    if (group === 'advice' && command === 'proof') {
        const gameDir = requireGameDir(process.env['CK3_GAME_PATH']);
        const proof = adviceProof(openSpec(path.join(root, 'spec')), gameDir);
        process.stdout.write(proofText(proof));
        return proof.rows.every((r) => r.verdict === 'holds' || r.verdict === 'follows')
            ? EXIT.ok
            : EXIT.failed;
    }
    if (group === 'docs' && command === 'game-log') {
        const file = writeGameLogReference(root);
        process.stdout.write(`docs game-log: ${path.relative(root, file)} written\n`);
        return EXIT.ok;
    }
    if (group === 'docs' && command === 'checks') {
        const file = writeCheckReference(root);
        process.stdout.write(`docs checks: ${path.relative(root, file)} written\n`);
        return EXIT.ok;
    }
    if (group === 'scored' && command === 'agent-use') {
        const { record } = runScored(root, process.env, (line) => {
            process.stdout.write(`${line}\n`);
        });
        // The run itself passes when every trial's harness held; the pass rate is the result.
        return record.results.trials.some((t) => t.harness_problems.length > 0)
            ? EXIT.failed
            : EXIT.ok;
    }
    if (group === 'scored' && command === 'authoring') {
        const { stopped, short } = runAuthoring(root, process.env, (line) => {
            process.stdout.write(`${line}\n`);
        });
        // The run is done when it did not stop early and every request it names has its trials
        // whose harness held; the measures are the result. Otherwise SCORED_CONTINUE carries on.
        return stopped === null && short.length === 0 ? EXIT.ok : EXIT.failed;
    }
    if (group === 'scored' && command === 'targets') {
        const { file, made_at, reading } = readRecordTargets(root, process.env);
        process.stdout.write(
            `scored:targets: ${relativePosix(root, file)}, made ${made_at.slice(0, 10)}\n`,
        );
        for (const line of targetLines(reading)) {
            process.stdout.write(`scored:targets: ${line}\n`);
        }
        return reading.met ? EXIT.ok : EXIT.failed;
    }
    if (group === 'scored' && command === 'calibrate') {
        const { stopped } = runCalibration(root, process.env, (line) => {
            process.stdout.write(`${line}\n`);
        });
        return stopped ? EXIT.failed : EXIT.ok;
    }
    if (group === 'scored' && command === 'rejudge') {
        const { stopped } = runRejudge(root, process.env, (line) => {
            process.stdout.write(`${line}\n`);
        });
        return stopped === null ? EXIT.ok : EXIT.failed;
    }
    process.stderr.write(`${USAGE}\n`);
    return EXIT.usage;
}

function failed(err: unknown): void {
    if (err instanceof CommandError) {
        process.stderr.write(`${err.message}\n`);
        process.exitCode = err.exitCode;
    } else if (err instanceof LaunchRefused) {
        process.stderr.write(`${err.message}\n`);
        process.exitCode = EXIT.usage;
    } else {
        throw err;
    }
}

const argv = process.argv.slice(2);
// The two commands that launch the game are asynchronous, and guarded (game-log/guard.ts).
const launch =
    argv[0] === 'game' && argv[1] === 'capture-log'
        ? captureFromEnv
        : argv[0] === 'scored' && argv[1] === 'in-game-load'
          ? inGameLoadFromEnv
          : null;
if (launch !== null) {
    launch(repoRoot(), process.env).then((code) => {
        process.exitCode = code;
    }, failed);
} else {
    try {
        process.exitCode = run(argv);
    } catch (err) {
        failed(err);
    }
}
