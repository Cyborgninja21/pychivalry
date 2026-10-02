#!/usr/bin/env node
/**
 * Vanilla acceptance run (development tool; needs a CK3 game directory, never committed).
 *
 *   node scripts/vanilla-acceptance.js <game dir holding common/ events/ history/> [out.json]
 *
 * 1. Parses every .txt under common/, events/ and history/ and records the file count, the
 *    parse time and every parse error.
 * 2. Loads the same tree as a workspace and runs the registry, schema and scope checks over
 *    it (the calibration of src/check/structural.ts and contexts.ts),
 *    recording the count per catalogue id and every error-level diagnostic.
 * 3. Records how much of vanilla the scope check could judge: trigger/effect keyword uses in a
 *    block whose scope type the resolver knows (and how many of them have documented,
 *    non-`none` supported scopes), and link steps taken from a known scope type.
 * Writes the record as JSON (default test/acceptance/vanilla-<spec version>.json). Paths in
 * the record are relative to the game directory; no game text is copied into it.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const engine = require('../dist/index.js');

const gameDir = process.argv[2];
if (!gameDir || !fs.existsSync(path.join(gameDir, 'common'))) {
    process.stderr.write('usage: node scripts/vanilla-acceptance.js <game dir> [out.json]\n');
    process.exit(2);
}
const spec = engine.defaultSpec();
const out =
    process.argv[3] ||
    path.join(__dirname, '..', 'test', 'acceptance', `vanilla-${spec.version()}.json`);

function walk(dir, acc) {
    for (const entry of fs
        .readdirSync(dir, { withFileTypes: true })
        .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, acc);
        } else if (entry.name.toLowerCase().endsWith('.txt')) {
            acc.push(full);
        }
    }
    return acc;
}

const trees = {};
const parseErrors = [];
let totalFiles = 0;
let bom = 0;
const parseStart = process.hrtime.bigint();
for (const tree of ['common', 'events', 'history']) {
    const files = walk(path.join(gameDir, tree), []);
    trees[tree] = files.length;
    totalFiles += files.length;
    for (const file of files) {
        const rel = path.relative(gameDir, file).split(path.sep).join('/');
        const parser = new engine.CK3Parser({ spec, file: rel });
        const result = parser.parse(fs.readFileSync(file, 'utf8'));
        if (result.bom) {
            bom++;
        }
        for (const e of result.errors) {
            parseErrors.push({
                file: rel,
                line: e.range.start.line + 1,
                column: e.range.start.character + 1,
                code: e.code,
                message: e.message,
            });
        }
    }
}
const parseMs = Number((process.hrtime.bigint() - parseStart) / 1000000n);

const checkStart = process.hrtime.bigint();
const workspace = new engine.Workspace(gameDir, { spec, vanilla: gameDir }).load();
const byCode = {};
const errorDiagnostics = [];
const scope = {
    keywordUses: 0,
    keywordUsesKnownScope: 0,
    keywordUsesJudged: 0,
    linkStepsJudged: 0,
};
const byType = {};
for (const file of workspace.scriptFiles()) {
    const rel = workspace.relativePath(file);
    if (!/^(common|events|history)\//.test(rel)) {
        continue;
    }
    const input = {
        spec,
        workspace,
        file: rel,
        uri: engine.pathToUri(file),
        ast: workspace.parse(file).ast,
    };
    const ds = [
        ...engine.checkRegistry(input),
        ...engine.checkSchema(input),
        ...engine.checkScope(input),
    ];
    const res = engine.resolveScopes(input);
    for (const [nodes, ctx] of res.contexts) {
        if (ctx.kind !== 'trigger' && ctx.kind !== 'effect') {
            continue;
        }
        const bucket = ctx.kind === 'trigger' ? 'triggers' : 'effects';
        for (const node of nodes) {
            if (
                !node.key ||
                node.keyChain ||
                !(spec.has(node.key, bucket) || spec.isIterator(node.key))
            ) {
                continue;
            }
            scope.keywordUses++;
            const current = res.nodeFrames.get(node)?.this;
            if (current === undefined) {
                continue;
            }
            scope.keywordUsesKnownScope++;
            byType[current] = (byType[current] || 0) + 1;
            const doc = spec.scopeValidity(node.key, bucket);
            if (doc && doc.supported_scopes.length > 0 && !doc.supported_scopes.includes('none')) {
                scope.keywordUsesJudged++;
            }
        }
    }
    for (const map of [res.keyChains, res.valueChains]) {
        for (const chain of map.values()) {
            let prev = undefined;
            chain.steps.forEach((step, i) => {
                if (i > 0 && prev !== undefined && (step.type !== undefined || step.mismatch)) {
                    scope.linkStepsJudged++;
                }
                prev = step.type;
            });
        }
    }
    for (const d of ds) {
        const key = `${d.severity} ${d.code}`;
        byCode[key] = (byCode[key] || 0) + 1;
        if (d.severity === 'error') {
            errorDiagnostics.push({
                file: rel,
                line: d.range.start.line + 1,
                code: d.code,
                message: d.message,
            });
        }
    }
}
const checkMs = Number((process.hrtime.bigint() - checkStart) / 1000000n);

const record = {
    spec: { version: spec.version(), exe_sha256: spec.data.manifest.exe.sha256 },
    command: 'node scripts/vanilla-acceptance.js <game dir>',
    parse: {
        trees,
        files: totalFiles,
        filesWithBom: bom,
        errors: parseErrors.length,
        milliseconds: parseMs,
        errorList: parseErrors,
    },
    checks: {
        milliseconds: checkMs,
        countsBySeverityAndCode: byCode,
        errors: errorDiagnostics.length,
        errorList: errorDiagnostics,
    },
    scope: {
        ...scope,
        keywordUsesByKnownScopeType: Object.fromEntries(
            Object.entries(byType).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        ),
        findings: errorDiagnostics.filter((d) =>
            [
                'wrong_scope_for_trigger_X_expected_X',
                'wrong_scope_for_effect_X_expected_X',
                'trying_to_use_X_link_on_an_invalid_scope_X',
            ].includes(d.code)
        ).length,
    },
};
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify(record, null, 4)}\n`);
process.stdout.write(
    `${totalFiles} files parsed in ${parseMs} ms: ${parseErrors.length} parse errors; ` +
        `checks: ${errorDiagnostics.length} errors (${checkMs} ms) -> ${out}\n`
);
