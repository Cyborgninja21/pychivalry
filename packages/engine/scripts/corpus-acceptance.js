#!/usr/bin/env node
/**
 * Real-mod corpus acceptance, engine path (development tool; needs the corpus folder and a
 * CK3 game directory, neither committed).
 *
 *   node scripts/corpus-acceptance.js <corpus dir> <game dir> [slug ...]
 *
 * For each mod of the corpus (every slug of <corpus dir>/MANIFEST.tsv, or the slugs given)
 * the engine (no plug-ins) diagnoses every script file of <corpus dir>/<slug> with the
 * game directory as the base game (the CLI's `check <modDir> --vanilla <game dir>`), in a
 * child process of its own so that its peak memory is the mod's alone. The record goes
 * under the `engine` key of test/corpus/real-mods/<slug>.counts.json (an `editor` key
 * written by the extension's corpus suite is kept): the mod, the spec package, the
 * command, the file count, the wall time (workspace load + base game + every file), the
 * peak RSS, the longest single-file diagnosis, the count per catalogue id with its
 * severity, and every error-severity finding (file relative to the mod, 1-based line,
 * code, message). Classifications of error findings (real-mods/classifications.json) are
 * merged into the error list. No game or mod text is copied beyond the messages.
 */
'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '..', 'test', 'corpus', 'real-mods');

function usage() {
    process.stderr.write(
        'usage: node scripts/corpus-acceptance.js <corpus dir> <game dir> [slug ...]\n'
    );
    process.exit(2);
}

function readManifest(corpus) {
    const file = path.join(corpus, 'MANIFEST.tsv');
    const rows = fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '' && !l.startsWith('#'));
    const header = rows.shift().split('\t');
    return rows.map((row) => {
        const cells = row.split('\t');
        const entry = {};
        header.forEach((h, i) => {
            entry[h] = cells[i];
        });
        return entry;
    });
}

function specInfo(engine) {
    const config = JSON.parse(
        fs.readFileSync(path.join(__dirname, '..', 'spec.config.json'), 'utf8')
    );
    const sha = fs
        .readFileSync(path.join(__dirname, '..', config.sha256), 'utf8')
        .trim()
        .split(/\s+/)[0];
    return { version: engine.defaultSpec().version(), sha256: sha };
}

/** Child: diagnose one mod and print the record as JSON. */
function runOne(corpus, game, slug) {
    const engine = require('../dist/index.js');
    const modDir = path.join(corpus, slug);
    const started = process.hrtime.bigint();
    const workspace = new engine.Workspace(modDir, { vanilla: game });
    workspace.load();
    const loadedMs = Number(process.hrtime.bigint() - started) / 1e6;
    const counts = {};
    const bySeverity = { error: 0, warning: 0, information: 0, hint: 0 };
    const errors = [];
    let files = 0;
    let longest = { ms: 0, file: undefined };
    for (const file of workspace.scriptFiles()) {
        const t0 = process.hrtime.bigint();
        const diagnostics = engine.diagnose(workspace, file);
        const ms = Number(process.hrtime.bigint() - t0) / 1e6;
        if (ms > longest.ms) {
            longest = { ms, file: workspace.relativePath(file) };
        }
        files++;
        for (const d of diagnostics) {
            const key =
                counts[d.code] && counts[d.code].severity !== d.severity
                    ? `${d.code}@${d.severity}`
                    : d.code;
            counts[key] = counts[key] || { severity: d.severity, count: 0 };
            counts[key].count++;
            bySeverity[d.severity] = (bySeverity[d.severity] || 0) + 1;
            if (d.severity === 'error') {
                errors.push({
                    file: d.file,
                    line: d.range.start.line + 1,
                    code: d.code,
                    message: d.message,
                });
            }
        }
    }
    const milliseconds = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
    const sorted = {};
    for (const key of Object.keys(counts).sort()) {
        sorted[key] = counts[key];
    }
    return {
        files,
        milliseconds,
        loadMilliseconds: Math.round(loadedMs),
        maxRssKb: process.resourceUsage().maxRSS,
        longestFile: { milliseconds: Math.round(longest.ms * 10) / 10, file: longest.file },
        bySeverity,
        counts: sorted,
        errors,
    };
}

function classify(slug, errors) {
    const file = path.join(OUT_DIR, 'classifications.json');
    if (!fs.existsSync(file)) {
        return errors;
    }
    const rules = (JSON.parse(fs.readFileSync(file, 'utf8')).rules || []).filter(
        (r) => r.mod === slug || r.mod === '*'
    );
    return errors.map((e) => {
        const rule = rules.find(
            (r) =>
                r.code === e.code &&
                (r.file === undefined || r.file === e.file) &&
                (r.line === undefined || r.line === e.line) &&
                (r.message === undefined || e.message.includes(r.message))
        );
        return rule
            ? {
                  ...e,
                  classification: rule.classification,
                  ...(rule.issue !== undefined ? { issue: rule.issue } : {}),
                  reason: rule.reason,
              }
            : { ...e, classification: 'unclassified' };
    });
}

function main() {
    const [corpus, game, ...slugs] = process.argv.slice(2);
    if (process.env.CORPUS_ACCEPTANCE_CHILD) {
        process.stdout.write(JSON.stringify(runOne(corpus, game, slugs[0])));
        return;
    }
    if (!corpus || !game || !fs.existsSync(path.join(game, 'common'))) {
        usage();
    }
    const engine = require('../dist/index.js');
    const spec = specInfo(engine);
    const manifest = readManifest(corpus);
    const wanted = slugs.length > 0 ? slugs : manifest.map((m) => m.slug);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    for (const slug of wanted) {
        const entry = manifest.find((m) => m.slug === slug);
        if (!entry || !fs.existsSync(path.join(corpus, slug))) {
            process.stderr.write(`skipping ${slug}: not in the corpus\n`);
            continue;
        }
        const child = childProcess.spawnSync(process.execPath, [__filename, corpus, game, slug], {
            env: { ...process.env, CORPUS_ACCEPTANCE_CHILD: '1' },
            maxBuffer: 1024 * 1024 * 256,
            encoding: 'utf8',
        });
        if (child.status !== 0) {
            process.stderr.write(child.stderr);
            process.exit(1);
        }
        const result = JSON.parse(child.stdout);
        const outFile = path.join(OUT_DIR, `${slug}.counts.json`);
        const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, 'utf8')) : {};
        const mod = {
            slug,
            workshop_id: entry.workshop_id,
            name: entry.name,
            supported_version: entry.supported_version,
        };
        const record = {
            mod,
            spec,
            engine: {
                mod,
                spec,
                command: `node packages/engine/scripts/corpus-acceptance.js <corpus dir> <game dir> ${slug}`,
                equivalentCli: `node packages/engine/dist/cli.js check <corpus dir>/${slug} --vanilla <game dir>`,
                ...result,
                errors: classify(slug, result.errors),
            },
        };
        if (existing.editor) {
            record.editor = existing.editor;
        }
        fs.writeFileSync(outFile, `${JSON.stringify(record, null, 4)}\n`);
        const unclassified = record.engine.errors.filter(
            (e) => e.classification === 'unclassified'
        );
        if (unclassified.length > 0) {
            process.stderr.write(
                `${slug}: ${unclassified.length} error findings are not classified in classifications.json\n`
            );
            process.exitCode = 1;
        }
        process.stdout.write(
            `${slug}: ${result.files} files, ${result.milliseconds} ms, ${result.maxRssKb} KB RSS, ` +
                `errors ${result.bySeverity.error}, warnings ${result.bySeverity.warning}, ` +
                `information ${result.bySeverity.information}, longest file ${result.longestFile.milliseconds} ms -> ${outFile}\n`
        );
    }
}

main();
