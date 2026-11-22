#!/usr/bin/env node
/**
 * The tools behind the local tasks (Taskfile.yml). Exit codes: 0 passed, 1 a check or pass
 * condition failed, 2 bad usage.
 *
 *   spec check                     the committed spec package (task spec:check)
 *   records check                  every committed record (task records:check)
 *   game parse|index|check|mods|bench    a game-file suite (task game:<suite>)
 *   corpus manifest                measure the corpus into records/corpus/MANIFEST.tsv
 *   baseline speed                 release 2.3.0's speed baselines (task baseline:speed)
 *   wiki check|build|publish       the repository wiki, generated from docs/ (task wiki:*)
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runSpeedBaseline } from './baseline.js';
import { checkRecords } from './records-check.js';
import { checkRulesTable, RULES_FILE } from './rules-table.js';
import { checkSpec } from './spec.js';
import { GAME_SUITES, runGameSuite, writeCorpusManifest, type GameSuite } from './suites.js';
import { CommandError, EXIT, repoRoot } from './util.js';
import { buildWiki, publishWiki } from './wiki.js';

const USAGE = `usage: pychivalry-tools <command>
  spec check
  records check
  game ${GAME_SUITES.join('|')}
  corpus manifest
  baseline speed
  wiki check|build|publish`;

function run(args: readonly string[]): number {
    const root = repoRoot();
    const [group, command] = args;
    if (group === 'spec' && command === 'check') {
        const check = checkSpec(path.join(root, 'spec'));
        const rules = checkRulesTable(path.join(root, 'spec'));
        const problems = [...check.problems, ...rules.problems];
        if (check.spec === undefined || rules.table === undefined || problems.length > 0) {
            process.stderr.write(`spec check failed:\n  ${problems.join('\n  ')}\n`);
            return EXIT.failed;
        }
        const { file, sha256, package_format: format } = check.spec;
        process.stdout.write(
            `spec check: ${file} is package format ${String(format)}, sha256 ${sha256} (uncompressed): ok\n`,
        );
        process.stdout.write(
            `spec check: ${RULES_FILE} is a ${rules.table.status} rules table of ${String(rules.table.rules.length)} rows, digest ${String(rules.sha256)}: ok\n`,
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
    if (group === 'baseline' && command === 'speed') {
        for (const file of runSpeedBaseline(root, process.env)) {
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
