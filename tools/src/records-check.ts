/**
 * The record check (`task records:check`, docs/PLAN.md item 1.9): every record under
 * `records/` is valid against `records/record.schema.json`, was made on the committed spec
 * (a record made on another spec fails, so a spec change forces the suites to be re-run),
 * names the committed corpus manifest if it read the corpus, holds no local path, and states
 * statistics that agree with its own values; a parse record's totals agree with its folders;
 * an index record's totals agree with its layers, and it was made on the committed rules table.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { checkRulesTable } from './rules-table.js';
import { checkSpec } from './spec.js';
import { summarize } from './stats.js';
import { isObject, relativePosix, sha256OfFile } from './util.js';

/** What every record must agree with: the committed spec and corpus manifest. */
export interface Expected {
    spec: { version: string; sha256: string };
    /** SHA-256 of the committed records/corpus/MANIFEST.tsv; undefined when there is none. */
    corpusManifestSha256: string | undefined;
    /** The core's digest of the committed rules table; undefined when it fails its check. */
    rulesSha256?: string | undefined;
}

/** Compile the record schema. */
export function compileRecordSchema(schemaFile: string): ValidateFunction {
    const ajv = new Ajv2020({ allErrors: true, strict: true });
    return ajv.compile(JSON.parse(readFileSync(schemaFile, 'utf8')) as object);
}

function describeError(error: ErrorObject): string {
    const where = error.instancePath === '' ? '(root)' : error.instancePath;
    const params = error.params as Record<string, unknown>;
    const extra =
        typeof params['additionalProperty'] === 'string'
            ? ` (${params['additionalProperty']})`
            : Array.isArray(params['allowedValues'])
              ? ` (one of ${params['allowedValues'].map((v) => JSON.stringify(v)).join(', ')})`
              : '';
    return `${where}: ${error.message ?? 'is invalid'}${extra}`;
}

const ABSOLUTE = [/^\//, /^~[\\/]/, /^[A-Za-z]:[\\/]/, /^\\\\/];

/** Every string in `value` (keys included) that holds an absolute or home-relative path. */
export function localPaths(value: unknown, at = ''): string[] {
    const found: string[] = [];
    const visitString = (text: string, where: string): void => {
        const tokens = text.split(/[\s"'=,;()]+/);
        if (tokens.some((token) => ABSOLUTE.some((pattern) => pattern.test(token)))) {
            found.push(`${where === '' ? '(root)' : where}: ${JSON.stringify(text)}`);
        }
    };
    if (typeof value === 'string') {
        visitString(value, at);
    } else if (Array.isArray(value)) {
        value.forEach((item, i) => found.push(...localPaths(item, `${at}/${String(i)}`)));
    } else if (isObject(value)) {
        for (const [key, item] of Object.entries(value)) {
            visitString(key, `${at}/${key}`);
            found.push(...localPaths(item, `${at}/${key}`));
        }
    }
    return found;
}

/** Statistics of a speed record that disagree with the values they summarize. */
function statisticsProblems(results: unknown): string[] {
    const problems: string[] = [];
    const series = isObject(results) ? results['series'] : undefined;
    if (!Array.isArray(series)) {
        return problems;
    }
    series.forEach((item: unknown, i) => {
        if (!isObject(item) || !isObject(item['measures'])) {
            return;
        }
        for (const [name, measure] of Object.entries(item['measures'])) {
            const later = isObject(measure) ? measure['later'] : undefined;
            if (!isObject(later) || !Array.isArray(later['values'])) {
                continue;
            }
            const values = later['values'].filter((v): v is number => typeof v === 'number');
            if (values.length === 0) {
                continue;
            }
            const stats = summarize(values);
            const where = `/results/series/${String(i)}/measures/${name}/later`;
            for (const key of ['n', 'median', 'min', 'max', 'spread'] as const) {
                if (later[key] !== stats[key]) {
                    problems.push(
                        `${where}/${key}: ${JSON.stringify(later[key])} does not agree with the values (${String(stats[key])})`,
                    );
                }
            }
            if (item['runs'] !== stats.n + 1) {
                problems.push(
                    `/results/series/${String(i)}/runs: ${JSON.stringify(item['runs'])} is not the first run plus ${String(stats.n)} later ones (measure ${name})`,
                );
            }
        }
    });
    return problems;
}

/**
 * A parse record's figures that disagree with each other: the totals and the folders, the
 * error counts and the error list, `passed` and the failures, and every error classified.
 */
function parseProblems(results: unknown): string[] {
    if (!isObject(results)) {
        return [];
    }
    const problems: string[] = [];
    const folders = Array.isArray(results['folders']) ? results['folders'].filter(isObject) : [];
    const errors = Array.isArray(results['errors']) ? results['errors'].filter(isObject) : [];
    const failures = Array.isArray(results['failures']) ? results['failures'] : [];
    const sum = (key: string): number =>
        folders.reduce((n, f) => n + (typeof f[key] === 'number' ? f[key] : 0), 0);
    for (const key of ['files', 'trees'] as const) {
        if (results[key] !== sum(key)) {
            problems.push(
                `/results/${key}: ${JSON.stringify(results[key])} is not the folders' total (${String(sum(key))})`,
            );
        }
    }
    if (sum('errors') !== errors.length) {
        problems.push(
            `/results/errors: ${String(errors.length)} listed, but the folders count ${String(sum('errors'))}`,
        );
    }
    if (results['passed'] !== (failures.length === 0)) {
        problems.push(
            `/results/passed: ${JSON.stringify(results['passed'])} with ${String(failures.length)} failures`,
        );
    }
    if (results['passed'] === true) {
        errors.forEach((error, i) => {
            if (error['classification'] !== 'game-defect') {
                problems.push(
                    `/results/errors/${String(i)}: a passing record holds an error classified ${JSON.stringify(error['classification'])}`,
                );
            }
        });
    }
    return problems;
}

/**
 * An index record's figures that disagree with each other or with the repository: its totals
 * and its layers, `passed` and the failures, the mods and the corpus it names, and the rules
 * table it was made on.
 */
function indexProblems(record: Record<string, unknown>, expected: Expected): string[] {
    const results = record['results'];
    if (!isObject(results)) {
        return [];
    }
    const problems: string[] = [];
    const failures = Array.isArray(results['failures']) ? results['failures'] : [];
    if (results['passed'] !== (failures.length === 0)) {
        problems.push(
            `/results/passed: ${JSON.stringify(results['passed'])} with ${String(failures.length)} failures`,
        );
    }
    const rules = isObject(results['rules']) ? results['rules']['sha256'] : undefined;
    if (rules !== expected.rulesSha256) {
        problems.push(
            `/results/rules/sha256: made on rules table ${JSON.stringify(rules)}, but the committed spec/override-rules.json is ${expected.rulesSha256 ?? 'missing or failing its check'}; re-run the suite`,
        );
    }
    const base = isObject(results['base_game']) ? results['base_game'] : {};
    const layers = Array.isArray(base['layers']) ? base['layers'].filter(isObject) : [];
    for (const key of ['files', 'definitions', 'uses', 'uses_of_defined_names'] as const) {
        const sum = layers.reduce((n, l) => n + (typeof l[key] === 'number' ? l[key] : 0), 0);
        if (base[key] !== sum) {
            problems.push(
                `/results/base_game/${key}: ${JSON.stringify(base[key])} is not the layers' total (${String(sum)})`,
            );
        }
    }
    const folders = Array.isArray(base['folders']) ? base['folders'] : [];
    if (base['folders_indexed'] !== folders.length) {
        problems.push(
            `/results/base_game/folders_indexed: ${JSON.stringify(base['folders_indexed'])} with ${String(folders.length)} folders listed`,
        );
    }
    const cache = isObject(base['cache']) ? base['cache'] : {};
    if (results['passed'] === true && cache['reload_answers_as_fresh'] !== true) {
        problems.push(
            '/results/base_game/cache: a passing record whose reloaded index does not answer as the fresh one',
        );
    }
    const corpus = record['corpus'];
    const slugs = isObject(corpus) && Array.isArray(corpus['slugs']) ? corpus['slugs'] : [];
    const mods = Array.isArray(results['mods'])
        ? results['mods'].filter(isObject).map((m) => m['slug'])
        : [];
    if (JSON.stringify(mods) !== JSON.stringify(slugs)) {
        problems.push(
            `/results/mods: the mods ${JSON.stringify(mods)} are not the corpus slugs ${JSON.stringify(slugs)}`,
        );
    }
    return problems;
}

/** Every problem with one record. */
export function checkRecord(
    record: unknown,
    validate: ValidateFunction,
    expected: Expected,
): string[] {
    const problems: string[] = [];
    if (!validate(record)) {
        problems.push(...(validate.errors ?? []).map(describeError));
    }
    if (!isObject(record)) {
        return problems;
    }
    const spec = record['spec'];
    if (isObject(spec)) {
        if (spec['sha256'] !== expected.spec.sha256 || spec['version'] !== expected.spec.version) {
            problems.push(
                `/spec: made on spec ${JSON.stringify(spec['version'])} (${JSON.stringify(spec['sha256'])}), but the committed spec is ${expected.spec.version} (${expected.spec.sha256}); re-run the suite`,
            );
        }
    }
    const corpus = record['corpus'];
    if (isObject(corpus) && corpus['manifest_sha256'] !== expected.corpusManifestSha256) {
        problems.push(
            `/corpus/manifest_sha256: made on corpus manifest ${JSON.stringify(corpus['manifest_sha256'])}, but the committed records/corpus/MANIFEST.tsv is ${expected.corpusManifestSha256 ?? 'missing'}; re-run the suite`,
        );
    }
    problems.push(...localPaths(record).map((where) => `holds a local path: ${where}`));
    if (record['suite'] === 'baseline:speed') {
        problems.push(...statisticsProblems(record['results']));
    }
    if (record['suite'] === 'game:parse') {
        problems.push(...parseProblems(record['results']));
    }
    if (record['suite'] === 'game:index') {
        problems.push(...indexProblems(record, expected));
    }
    return problems;
}

/** Every record file under `recordsDir`: `*.json`, except the `*.schema.json` files. */
export function findRecords(recordsDir: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const name of readdirSync(dir).sort()) {
            const full = path.join(dir, name);
            if (statSync(full).isDirectory()) {
                walk(full);
            } else if (name.endsWith('.json') && !name.endsWith('.schema.json')) {
                out.push(full);
            }
        }
    };
    if (existsSync(recordsDir)) {
        walk(recordsDir);
    }
    return out;
}

/** Check every record in the repository at `root`. */
export function checkRecords(root: string): { files: string[]; problems: string[] } {
    const spec = checkSpec(path.join(root, 'spec'));
    if (spec.spec === undefined) {
        return {
            files: [],
            problems: spec.problems.map((p) => `spec: ${p}`),
        };
    }
    const manifest = path.join(root, 'records', 'corpus', 'MANIFEST.tsv');
    const expected: Expected = {
        spec: { version: spec.spec.version, sha256: spec.spec.sha256 },
        corpusManifestSha256: existsSync(manifest) ? sha256OfFile(manifest) : undefined,
        rulesSha256: checkRulesTable(path.join(root, 'spec')).sha256,
    };
    const validate = compileRecordSchema(path.join(root, 'records', 'record.schema.json'));
    const files = findRecords(path.join(root, 'records'));
    const problems: string[] = [];
    for (const file of files) {
        const rel = relativePosix(root, file);
        let record: unknown;
        try {
            record = JSON.parse(readFileSync(file, 'utf8')) as unknown;
        } catch (err) {
            problems.push(`${rel}: not valid JSON: ${(err as Error).message}`);
            continue;
        }
        problems.push(...checkRecord(record, validate, expected).map((p) => `${rel}: ${p}`));
    }
    return { files: files.map((f) => relativePosix(root, f)), problems };
}
