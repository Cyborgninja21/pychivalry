/**
 * The record check (`task records:check`, docs/PLAN.md item 1.9): every record under
 * `records/` is valid against `records/record.schema.json`, was made on the committed spec
 * (a record made on another spec fails, so a spec change forces the suites to be re-run),
 * names the committed corpus manifest if it read the corpus, holds no local path, and states
 * statistics that agree with its own values; a parse record's totals agree with its folders;
 * an index record's totals agree with its layers, and it was made on the committed rules table
 * (the spec package's part D1).
 *
 * A scored run's record (`scored:agent-use`, docs/PLAN.md item 6.10; `scored:authoring` and
 * the judge's calibration, `scored:calibration`, items 9.5 and 9.6) is checked against the
 * schema and with itself, not against the committed spec: it states the spec it was made on,
 * and re-making it means new test sessions of Claude Code, which only the owner starts.
 *
 * A baseline of release 2.3.0 cannot be made on the format 8 package, which 2.3.0 cannot
 * read. It is tied instead to the committed format 4 copy of the same game version
 * (`spec/legacy/`): its spec is that copy, byte for byte, and the game it read is the build
 * that copy and the package were derived for.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import { checkRulesTable } from './rules-table.js';
import { AUTHORING_SUITE, authoringProblems } from './scored-run/authoring-record.js';
import { CALIBRATION_SUITE, calibrationProblems } from './scored-run/calibration.js';
import { SCORED_SUITE, scoredProblems } from './scored-run/scored-record.js';
import { checkLegacySpec, checkSpec } from './spec.js';
import { summarize } from './stats.js';
import { isObject, relativePosix, sha256OfFile } from './util.js';

/** What every record must agree with: the committed spec and corpus manifest. */
export interface Expected {
    spec: { version: string; sha256: string };
    /**
     * The committed format 4 copy (`spec/legacy/`), which a 2.3.0 baseline must name as its
     * spec; undefined when it is missing or fails its check.
     */
    legacySpec?: { version: string; sha256: string; package_format: number } | undefined;
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
 * The GUI part of a parse record (build step 10) whose figures disagree with each other: the
 * totals and the folders, the findings and the folders' counts, `passed` and its failures, each
 * failure among the record's own (written `gui: <failure>`), and in a passing part every finding
 * classified a defect of the game's own files.
 */
function guiProblems(gui: unknown, recordFailures: readonly unknown[]): string[] {
    if (!isObject(gui)) {
        return [];
    }
    const problems: string[] = [];
    const folders = Array.isArray(gui['folders']) ? gui['folders'].filter(isObject) : [];
    const findings = Array.isArray(gui['findings']) ? gui['findings'].filter(isObject) : [];
    const failures = Array.isArray(gui['failures']) ? gui['failures'] : [];
    const sum = (key: string): number =>
        folders.reduce((n, f) => n + (typeof f[key] === 'number' ? f[key] : 0), 0);
    for (const key of ['files', 'trees'] as const) {
        if (gui[key] !== sum(key)) {
            problems.push(
                `/results/gui/${key}: ${JSON.stringify(gui[key])} is not the folders' total (${String(sum(key))})`,
            );
        }
    }
    if (sum('findings') !== findings.length) {
        problems.push(
            `/results/gui/findings: ${String(findings.length)} listed, but the folders count ${String(sum('findings'))}`,
        );
    }
    if (gui['passed'] !== (failures.length === 0)) {
        problems.push(
            `/results/gui/passed: ${JSON.stringify(gui['passed'])} with ${String(failures.length)} failures`,
        );
    }
    failures.forEach((failure, i) => {
        if (!recordFailures.includes(`gui: ${String(failure)}`)) {
            problems.push(`/results/gui/failures/${String(i)}: not among the record's failures`);
        }
    });
    if (gui['passed'] === true) {
        findings.forEach((finding, i) => {
            if (finding['classification'] !== 'game-defect') {
                problems.push(
                    `/results/gui/findings/${String(i)}: a passing GUI suite holds a finding classified ${JSON.stringify(finding['classification'])}`,
                );
            }
        });
    }
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
    problems.push(...roundTripProblems(results['round_trip'], 'round_trip', results['passed']));
    problems.push(
        ...roundTripProblems(
            results['round_trip_localization'],
            'round_trip_localization',
            results['passed'],
        ),
    );
    problems.push(...guiProblems(results['gui'], failures));
    return problems;
}

/**
 * A round trip's figures that disagree with each other: what was formatted and what was left
 * make the files; a passing record has every tree, token list and second format the same, and
 * every comment kept in its place.
 */
function roundTripProblems(value: unknown, key: string, passed: unknown): string[] {
    if (!isObject(value)) {
        return [];
    }
    const problems: string[] = [];
    const n = (k: string): number => (typeof value[k] === 'number' ? value[k] : -1);
    const left = Array.isArray(value['left']) ? value['left'].length : 0;
    if (n('formatted') + left !== n('files')) {
        problems.push(
            `/results/${key}: ${String(n('formatted'))} formatted and ${String(left)} left are not its ${String(n('files'))} files`,
        );
    }
    if (passed === true) {
        for (const k of ['trees_equal', 'tokens_equal', 'second_format_unchanged']) {
            if (n(k) !== n('formatted')) {
                problems.push(
                    `/results/${key}/${k}: ${String(n(k))} of ${String(n('formatted'))} in a passing record`,
                );
            }
        }
        if (n('comments_after') !== n('comments_before') || n('comments_moved') !== 0) {
            problems.push(`/results/${key}: comments lost or moved in a passing record`);
        }
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
            `/results/rules/sha256: made on rules table ${JSON.stringify(rules)}, but the committed spec package's override rules (part D1) are ${expected.rulesSha256 ?? 'missing or failing their check'}; re-run the suite`,
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

/** The suites of the 2.3.0 baselines, made on the format 4 copy rather than the package. */
export const BASELINE_SUITES: readonly string[] = ['baseline:speed', 'baseline:results'];

const SEVERITY_KEYS = ['error', 'warning', 'information', 'hint'] as const;

/**
 * Counts by code that disagree with the totals by severity, and an error count that
 * disagrees with the error list or the error total, at `where`.
 */
function findingCountProblems(results: Record<string, unknown>, where: string): string[] {
    const problems: string[] = [];
    const bySeverity = isObject(results['by_severity']) ? results['by_severity'] : {};
    const byCode = Array.isArray(results['by_code']) ? results['by_code'].filter(isObject) : [];
    for (const severity of SEVERITY_KEYS) {
        const sum = byCode
            .filter((c) => c['severity'] === severity)
            .reduce((n, c) => n + (typeof c['count'] === 'number' ? c['count'] : 0), 0);
        if (bySeverity[severity] !== sum) {
            problems.push(
                `${where}/by_severity/${severity}: ${JSON.stringify(bySeverity[severity])} is not the total of by_code (${String(sum)})`,
            );
        }
    }
    const errors = Array.isArray(results['error_list']) ? results['error_list'].length : 0;
    if (results['errors'] !== errors) {
        problems.push(
            `${where}/errors: ${JSON.stringify(results['errors'])} with ${String(errors)} listed`,
        );
    }
    if (bySeverity['error'] !== errors) {
        problems.push(
            `${where}/error_list: ${String(errors)} listed, but by_severity counts ${JSON.stringify(bySeverity['error'])} errors`,
        );
    }
    return problems;
}

/**
 * A check suite's figures that disagree with each other: the totals by severity and by code,
 * the error and warning counts and their lists, the dropped findings and their codes, `passed`
 * and the failures; and a passing record holding a finding that is unclassified or a
 * pychivalry fault. `where` is the JSON pointer of the results checked (one mod's, for the
 * real-mod suite).
 */
function checkFindingProblems(results: Record<string, unknown>, where: string): string[] {
    const problems: string[] = [];
    const bySeverity = isObject(results['by_severity']) ? results['by_severity'] : {};
    const byCode = Array.isArray(results['by_code']) ? results['by_code'].filter(isObject) : [];
    for (const severity of SEVERITY_KEYS) {
        const sum = byCode
            .filter((c) => c['severity'] === severity)
            .reduce((n, c) => n + (typeof c['count'] === 'number' ? c['count'] : 0), 0);
        if (bySeverity[severity] !== sum) {
            problems.push(
                `${where}/by_severity/${severity}: ${JSON.stringify(bySeverity[severity])} is not the total of by_code (${String(sum)})`,
            );
        }
    }
    for (const [count, list, severity] of [
        ['errors', 'error_list', 'error'],
        ['warnings', 'warning_list', 'warning'],
    ] as const) {
        const listed = Array.isArray(results[list]) ? results[list].length : 0;
        // The `style/` family is counted by code and never listed (docs/formatting.md).
        const style = byCode
            .filter((c) => c['severity'] === severity && String(c['code']).startsWith('style/'))
            .reduce((n, c) => n + (typeof c['count'] === 'number' ? c['count'] : 0), 0);
        const counted =
            typeof bySeverity[severity] === 'number' ? bySeverity[severity] - style : -1;
        if (results[count] !== listed || counted !== listed) {
            problems.push(
                `${where}/${list}: ${String(listed)} listed, but ${count} is ${JSON.stringify(results[count])} and by_severity counts ${JSON.stringify(bySeverity[severity])}`,
            );
        }
    }
    const capped = isObject(results['capped']) ? results['capped'] : {};
    const droppedByCode = Array.isArray(capped['dropped_by_code'])
        ? capped['dropped_by_code'].filter(isObject)
        : [];
    const dropped = droppedByCode.reduce(
        (n, c) => n + (typeof c['count'] === 'number' ? c['count'] : 0),
        0,
    );
    if (capped['dropped'] !== dropped) {
        problems.push(
            `${where}/capped/dropped: ${JSON.stringify(capped['dropped'])} is not the total of dropped_by_code (${String(dropped)})`,
        );
    }
    return problems;
}

/** Whether a classified finding may stand in a passing record. */
function passes(finding: Record<string, unknown>): boolean {
    return (
        finding['classification'] !== 'unclassified' &&
        finding['classification'] !== 'pychivalry-fault'
    );
}

/** A base-game check record's figures that disagree with each other (`checkFindingProblems`). */
function checkSuiteProblems(results: unknown): string[] {
    if (!isObject(results)) {
        return [];
    }
    const problems = checkFindingProblems(results, '/results');
    const failures = Array.isArray(results['failures']) ? results['failures'] : [];
    if (results['passed'] !== (failures.length === 0)) {
        problems.push(
            `/results/passed: ${JSON.stringify(results['passed'])} with ${String(failures.length)} failures`,
        );
    }
    const files = Array.isArray(results['files_by_layer'])
        ? results['files_by_layer'].filter(isObject)
        : [];
    const sum = files.reduce((n, f) => n + (typeof f['files'] === 'number' ? f['files'] : 0), 0);
    if (results['files'] !== sum) {
        problems.push(
            `/results/files: ${JSON.stringify(results['files'])} is not the layers' total (${String(sum)})`,
        );
    }
    if (results['passed'] === true) {
        for (const list of ['error_list', 'warning_list'] as const) {
            const listed = Array.isArray(results[list]) ? results[list].filter(isObject) : [];
            listed.forEach((f, i) => {
                if (!passes(f)) {
                    problems.push(
                        `/results/${list}/${String(i)}: a passing record holds a finding classified ${JSON.stringify(f['classification'])}`,
                    );
                }
            });
        }
    }
    return problems;
}

/** A real-mod check record's figures that disagree with each other or with its corpus. */
function modsSuiteProblems(record: Record<string, unknown>): string[] {
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
    const mods = Array.isArray(results['mods']) ? results['mods'].filter(isObject) : [];
    mods.forEach((mod, i) => {
        const where = `/results/mods/${String(i)}`;
        problems.push(...checkFindingProblems(mod, where));
        if (results['passed'] === true) {
            const listed = Array.isArray(mod['error_list'])
                ? mod['error_list'].filter(isObject)
                : [];
            listed.forEach((f, n) => {
                if (!passes(f)) {
                    problems.push(
                        `${where}/error_list/${String(n)}: a passing record holds an error classified ${JSON.stringify(f['classification'])}`,
                    );
                }
            });
        }
    });
    const corpus = record['corpus'];
    const slugs = isObject(corpus) && Array.isArray(corpus['slugs']) ? corpus['slugs'] : [];
    const named = mods.map((m) => m['slug']);
    if (JSON.stringify(named) !== JSON.stringify(slugs)) {
        problems.push(
            `/results/mods: the mods ${JSON.stringify(named)} are not the corpus slugs ${JSON.stringify(slugs)}`,
        );
    }
    return problems;
}

/** A results baseline's figures that disagree with each other or with the corpus it names. */
function baselineResultsProblems(record: Record<string, unknown>): string[] {
    const results = record['results'];
    if (!isObject(results)) {
        return [];
    }
    const problems: string[] = [];
    const base = results['base_game'];
    if (isObject(base)) {
        const parse = isObject(base['parse']) ? base['parse'] : {};
        const folders = Array.isArray(parse['by_folder'])
            ? parse['by_folder'].filter(isObject)
            : [];
        const sum = folders.reduce(
            (n, f) => n + (typeof f['files'] === 'number' ? f['files'] : 0),
            0,
        );
        if (parse['files'] !== sum) {
            problems.push(
                `/results/base_game/parse/files: ${JSON.stringify(parse['files'])} is not the folders' total (${String(sum)})`,
            );
        }
        const listed = Array.isArray(parse['error_list']) ? parse['error_list'].length : 0;
        if (parse['errors'] !== listed) {
            problems.push(
                `/results/base_game/parse/errors: ${JSON.stringify(parse['errors'])} with ${String(listed)} listed`,
            );
        }
        if (isObject(base['check'])) {
            problems.push(...findingCountProblems(base['check'], '/results/base_game/check'));
        }
    }
    if (Array.isArray(results['mods'])) {
        const mods = results['mods'].filter(isObject);
        mods.forEach((mod, i) => {
            problems.push(...findingCountProblems(mod, `/results/mods/${String(i)}`));
        });
        const corpus = record['corpus'];
        const slugs = isObject(corpus) && Array.isArray(corpus['slugs']) ? corpus['slugs'] : [];
        const named = mods.map((m) => m['slug']);
        if (JSON.stringify(named) !== JSON.stringify(slugs)) {
            problems.push(
                `/results/mods: the mods ${JSON.stringify(named)} are not the corpus slugs ${JSON.stringify(slugs)}`,
            );
        }
    }
    return problems;
}

/**
 * A 2.3.0 baseline not tied to the committed format 4 copy: another spec than that copy, or
 * another game build than the one it (and the package) were derived for.
 */
function baselineSpecProblems(record: Record<string, unknown>, expected: Expected): string[] {
    const legacy = expected.legacySpec;
    if (legacy === undefined) {
        return [
            '/spec: a 2.3.0 baseline is checked against the committed format 4 copy spec/legacy/, which is missing or fails its check',
        ];
    }
    const problems: string[] = [];
    const spec = isObject(record['spec']) ? record['spec'] : {};
    if (
        spec['sha256'] !== legacy.sha256 ||
        spec['version'] !== legacy.version ||
        spec['package_format'] !== legacy.package_format
    ) {
        problems.push(
            `/spec: a 2.3.0 baseline made on spec ${JSON.stringify(spec['version'])} format ${JSON.stringify(spec['package_format'])} (${JSON.stringify(spec['sha256'])}), but the committed format 4 copy is ${legacy.version} format ${String(legacy.package_format)} (${legacy.sha256}); re-run the baseline`,
        );
    }
    const game = isObject(record['game']) ? record['game'] : {};
    if (game['build'] !== legacy.version) {
        problems.push(
            `/game/build: a 2.3.0 baseline made on game ${JSON.stringify(game['build'])}, but the committed spec is for game ${legacy.version}; re-run the baseline`,
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
    const valid = validate(record);
    if (!valid) {
        problems.push(...(validate.errors ?? []).map(describeError));
    }
    if (!isObject(record)) {
        return problems;
    }
    const spec = record['spec'];
    if (BASELINE_SUITES.includes(String(record['suite']))) {
        problems.push(...baselineSpecProblems(record, expected));
    } else if (record['suite'] === SCORED_SUITE) {
        // A scored run states the spec it used; a later spec does not fail it, because running
        // it again means new test sessions, started only on the owner's word
        // (scored-run/scored-record.ts).
        problems.push(...scoredProblems(record['results']));
    } else if (record['suite'] === AUTHORING_SUITE || record['suite'] === CALIBRATION_SUITE) {
        // The same for the authoring run and the judge's calibration; their figures are read
        // as the schema shapes them, so only a record valid against it is checked further.
        if (valid) {
            problems.push(
                ...(record['suite'] === AUTHORING_SUITE
                    ? authoringProblems(record['results'])
                    : calibrationProblems(record['results'])),
            );
        }
    } else if (isObject(spec)) {
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
    if (record['suite'] === 'baseline:results') {
        problems.push(...baselineResultsProblems(record));
    }
    if (record['suite'] === 'game:check') {
        problems.push(...checkSuiteProblems(record['results']));
    }
    if (record['suite'] === 'game:mods') {
        problems.push(...modsSuiteProblems(record));
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
    const legacy = checkLegacySpec(path.join(root, 'spec')).legacy;
    const expected: Expected = {
        spec: { version: spec.spec.version, sha256: spec.spec.sha256 },
        legacySpec:
            legacy === undefined
                ? undefined
                : {
                      version: legacy.version,
                      sha256: legacy.sha256,
                      package_format: legacy.package_format,
                  },
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
