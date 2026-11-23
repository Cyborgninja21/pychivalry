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
 *   advice proof                   the advice checks of item 4.7 on the base game: per row, the
 *                                  units it applies to and the findings it raises there
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openSpec } from '@pychivalry/core';
import { adviceProof, proofText } from './advice-proof.js';
import { prepareLegacySpec, runResultBaseline, runSpeedBaseline } from './baseline.js';
import { requireGameDir } from './game.js';
import { checkRecords } from './records-check.js';
import { checkRulesTable, RULES_SOURCE, rulesUse } from './rules-table.js';
import { checkSpecFolder, SCHEMA_FILE } from './spec.js';
import { GAME_SUITES, runGameSuite, writeCorpusManifest, type GameSuite } from './suites.js';
import { CommandError, EXIT, repoRoot } from './util.js';
import { buildWiki, publishWiki } from './wiki.js';

const USAGE = `usage: pychivalry-tools <command>
  spec check
  records check
  game ${GAME_SUITES.join('|')}
  corpus manifest
  baseline spec|speed|results
  wiki check|build|publish
  advice proof`;

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
        return proof.rows.every((r) => r.verdict === 'holds') ? EXIT.ok : EXIT.failed;
    }
    process.stderr.write(`${USAGE}\n`);
    return EXIT.usage;
}

try {
    process.exitCode = run(process.argv.slice(2));
} catch (err) {
    if (err instanceof CommandError) {
        process.stderr.write(`${err.message}\n`);
        process.exitCode = err.exitCode;
    } else {
        throw err;
    }
}
