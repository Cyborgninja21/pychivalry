/**
 * The content requests of the scored authoring test (docs/PLAN.md item 9.4):
 * `fixtures/requests/requests.json`, read and checked here. Each request is given, word for
 * word, to a test session in a fresh copy of its base mod (`fixtures/requests/bases/<base>/`);
 * what the session leaves is graded by the checker, by the request's expectations in code
 * (`expectations.ts`) and by a judge on its judged dimensions (`judge.ts`).
 *
 * The format (`requests_format` 1), every field required unless said otherwise:
 *
 * - `about`: what the file is, in words.
 * - `dimensions[]`: the closed set of judged dimensions, `id` and `what` it judges. Agreement
 *   with hand grading is measured per dimension (`calibration.ts`), so the set is shared by
 *   every request.
 * - `requests[]`:
 *   - `id`: stable, lower-case words joined by hyphens; a record names a request by it.
 *   - `content_type`: `event`, `decision`, `scripted_effect` or `scripted_trigger`.
 *   - `difficulty`: `easy`, `medium` or `hard`.
 *   - `base`: the folder under `fixtures/requests/bases/` the trial's mod starts as.
 *   - `request`: the text the session is given. Every name it writes between backticks is one
 *     the request relies on, one the result must define or write, or a folder the result
 *     writes into (`requests.test.ts` holds this).
 *   - `relies_on[]`: each name of the game or of the base mod the request names, one of
 *     `{ bucket, name }` (a name of a bucket of the spec package: `effects`, `triggers`,
 *     `links`, `lists`, `on_actions`, `modifiers`), `{ iterator }` (an iterator: a prefix of
 *     the package's `iterator_prefixes` before a name of its `lists`), `{ field, folder,
 *     value? }` (a field the package's schema gives that folder's records, and a value the
 *     base game writes in it), or `{ base, database, name }` (a definition of the base mod).
 *     `reliedOnProblems` proves each exists, and the run refuses to start when one does not.
 *   - `expect[]`: what a correct result must contain, checked in code (`expectations.ts`); each
 *     has a `kind`:
 *     - `file` (`folder`, `new?`): the mod has a file the index reads in that spec folder
 *       (`localization` for every language), one the base did not have when `new` is true;
 *     - `top-level` (`folder`, `key`, `value`): a file of that folder holds `key = value` at its
 *       top level;
 *     - `defines` (`database`, `name`): the mod defines the name in that database;
 *     - `field` (`database`, `name`, `field`, `value?`, `count?`): the mod's definition holds
 *       the field directly in its block, with that value, or that many times;
 *     - `uses` (`database`, `name`, `uses`): the name `uses` is written inside the definition;
 *     - `resolves` (`database`, `name`, `uses`, `to`): it is, and the mod or the base game
 *       defines it in the database `to`;
 *     - `localization` (`key`): the mod's English localization defines the key;
 *     - `unchanged` (`file`): a file of the base mod is still there, byte for byte.
 *   - `judged[]`: the dimensions the judge answers for this request (`dimension`, one of
 *     `dimensions`, at most once), each with the `question` it is asked.
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
    BUCKET_NAMES,
    openWorkspace,
    vocabularyOf,
    type BucketName,
    type Spec,
} from '@pychivalry/core';
import { CommandError, EXIT, isObject } from '../util.js';

export const REQUESTS_DIR = 'fixtures/requests';
export const REQUESTS_FILE = 'fixtures/requests/requests.json';
export const BASES_DIR = 'fixtures/requests/bases';

export const CONTENT_TYPES = ['event', 'decision', 'scripted_effect', 'scripted_trigger'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];
export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type ReliedOn =
    | { readonly bucket: BucketName; readonly name: string }
    | { readonly iterator: string }
    | { readonly field: string; readonly folder: string; readonly value?: string }
    | { readonly base: string; readonly database: string; readonly name: string };

export type Expectation =
    | { readonly kind: 'file'; readonly folder: string; readonly new?: boolean }
    | {
          readonly kind: 'top-level';
          readonly folder: string;
          readonly key: string;
          readonly value: string;
      }
    | { readonly kind: 'defines'; readonly database: string; readonly name: string }
    | {
          readonly kind: 'field';
          readonly database: string;
          readonly name: string;
          readonly field: string;
          readonly value?: string;
          readonly count?: number;
      }
    | {
          readonly kind: 'uses';
          readonly database: string;
          readonly name: string;
          readonly uses: string;
      }
    | {
          readonly kind: 'resolves';
          readonly database: string;
          readonly name: string;
          readonly uses: string;
          readonly to: string;
      }
    | { readonly kind: 'localization'; readonly key: string }
    | { readonly kind: 'unchanged'; readonly file: string };

export const EXPECTATION_KINDS = [
    'file',
    'top-level',
    'defines',
    'field',
    'uses',
    'resolves',
    'localization',
    'unchanged',
] as const;

export interface JudgedQuestion {
    readonly dimension: string;
    readonly question: string;
}

export interface ContentRequest {
    readonly id: string;
    readonly content_type: ContentType;
    readonly difficulty: Difficulty;
    readonly base: string;
    readonly request: string;
    readonly relies_on: readonly ReliedOn[];
    readonly expect: readonly Expectation[];
    readonly judged: readonly JudgedQuestion[];
}

export interface Dimension {
    readonly id: string;
    readonly what: string;
}

export interface RequestList {
    readonly requests_format: 1;
    readonly about: string;
    readonly dimensions: readonly Dimension[];
    readonly requests: readonly ContentRequest[];
}

/** The language the `localization` expectation reads: the index's database of English keys. */
export const ENGLISH = 'localization:l_english';

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function text(value: unknown): value is string {
    return typeof value === 'string' && value !== '';
}

function only(value: Record<string, unknown>, keys: readonly string[]): boolean {
    return Object.keys(value).every((k) => keys.includes(k));
}

function reliedOnShape(value: unknown): boolean {
    if (!isObject(value)) {
        return false;
    }
    if ('bucket' in value) {
        return (
            only(value, ['bucket', 'name']) &&
            (BUCKET_NAMES as readonly unknown[]).includes(value['bucket']) &&
            text(value['name'])
        );
    }
    if ('iterator' in value) {
        return only(value, ['iterator']) && text(value['iterator']);
    }
    if ('field' in value) {
        return (
            only(value, ['field', 'folder', 'value']) &&
            text(value['field']) &&
            text(value['folder']) &&
            (value['value'] === undefined || text(value['value']))
        );
    }
    if ('base' in value) {
        return (
            only(value, ['base', 'database', 'name']) &&
            text(value['base']) &&
            text(value['database']) &&
            text(value['name'])
        );
    }
    return false;
}

/** The fields each kind of expectation has, beside `kind`, and which of them are optional. */
const EXPECTATION_FIELDS: Readonly<
    Record<(typeof EXPECTATION_KINDS)[number], { required: string[]; optional: string[] }>
> = {
    file: { required: ['folder'], optional: ['new'] },
    'top-level': { required: ['folder', 'key', 'value'], optional: [] },
    defines: { required: ['database', 'name'], optional: [] },
    field: { required: ['database', 'name', 'field'], optional: ['value', 'count'] },
    uses: { required: ['database', 'name', 'uses'], optional: [] },
    resolves: { required: ['database', 'name', 'uses', 'to'], optional: [] },
    localization: { required: ['key'], optional: [] },
    unchanged: { required: ['file'], optional: [] },
};

function expectationShape(value: unknown): boolean {
    if (!isObject(value)) {
        return false;
    }
    const kind = value['kind'];
    if (!(EXPECTATION_KINDS as readonly unknown[]).includes(kind)) {
        return false;
    }
    const fields = EXPECTATION_FIELDS[kind as (typeof EXPECTATION_KINDS)[number]];
    if (!only(value, ['kind', ...fields.required, ...fields.optional])) {
        return false;
    }
    if (!fields.required.every((k) => text(value[k]))) {
        return false;
    }
    if (value['new'] !== undefined && typeof value['new'] !== 'boolean') {
        return false;
    }
    if (value['value'] !== undefined && !text(value['value'])) {
        return false;
    }
    const count = value['count'];
    if (count !== undefined && !(Number.isInteger(count) && (count as number) >= 0)) {
        return false;
    }
    return !(value['value'] !== undefined && count !== undefined);
}

/** The shape problems of a parsed request list; empty when it is one. */
export function requestsShapeProblems(value: unknown): string[] {
    if (!isObject(value)) {
        return ['the request list is not a JSON object'];
    }
    const problems: string[] = [];
    if (!only(value, ['requests_format', 'about', 'dimensions', 'requests'])) {
        problems.push('the request list has a field it does not know');
    }
    if (value['requests_format'] !== 1) {
        problems.push('requests_format is not 1');
    }
    if (!text(value['about'])) {
        problems.push('about is not a text');
    }
    const dimensions = value['dimensions'];
    const ids = new Set<string>();
    if (!Array.isArray(dimensions) || dimensions.length === 0) {
        problems.push('dimensions is not a list');
    } else {
        dimensions.forEach((d: unknown, i) => {
            if (
                !isObject(d) ||
                !only(d, ['id', 'what']) ||
                !text(d['id']) ||
                !ID.test(d['id']) ||
                !text(d['what'])
            ) {
                problems.push(`dimensions[${String(i)}]: needs an id and what it judges`);
            } else if (ids.has(d['id'])) {
                problems.push(`dimensions[${String(i)}]: ${d['id']} is listed twice`);
            } else {
                ids.add(d['id']);
            }
        });
    }
    const requests = value['requests'];
    if (!Array.isArray(requests) || requests.length === 0) {
        problems.push('requests is not a list');
        return problems;
    }
    const seen = new Set<string>();
    requests.forEach((r: unknown, i) => {
        const where = `requests[${String(i)}]`;
        if (!isObject(r)) {
            problems.push(`${where}: not an object`);
            return;
        }
        if (
            !only(r, [
                'id',
                'content_type',
                'difficulty',
                'base',
                'request',
                'relies_on',
                'expect',
                'judged',
            ])
        ) {
            problems.push(`${where}: a field it does not know`);
        }
        const id = r['id'];
        if (!text(id) || !ID.test(id)) {
            problems.push(`${where}: id is not lower-case words joined by hyphens`);
        } else if (seen.has(id)) {
            problems.push(`${where}: the id ${id} is used twice`);
        } else {
            seen.add(id);
        }
        if (!(CONTENT_TYPES as readonly unknown[]).includes(r['content_type'])) {
            problems.push(`${where}: content_type is not one of ${CONTENT_TYPES.join(', ')}`);
        }
        if (!(DIFFICULTIES as readonly unknown[]).includes(r['difficulty'])) {
            problems.push(`${where}: difficulty is not one of ${DIFFICULTIES.join(', ')}`);
        }
        for (const key of ['base', 'request'] as const) {
            if (!text(r[key])) {
                problems.push(`${where}: ${key} is not a text`);
            }
        }
        const relies = r['relies_on'];
        if (!Array.isArray(relies)) {
            problems.push(`${where}: relies_on is not a list`);
        } else {
            relies.forEach((x: unknown, j) => {
                if (!reliedOnShape(x)) {
                    problems.push(
                        `${where}.relies_on[${String(j)}]: not a bucket, iterator, field or base name`,
                    );
                }
            });
        }
        const expect = r['expect'];
        if (!Array.isArray(expect) || expect.length === 0) {
            problems.push(`${where}: expect is not a list`);
        } else {
            expect.forEach((x: unknown, j) => {
                if (!expectationShape(x)) {
                    problems.push(`${where}.expect[${String(j)}]: not an expectation`);
                }
            });
        }
        const judged = r['judged'];
        if (!Array.isArray(judged) || judged.length === 0) {
            problems.push(`${where}: judged is not a list`);
        } else {
            const asked = new Set<string>();
            judged.forEach((q: unknown, j) => {
                const at = `${where}.judged[${String(j)}]`;
                if (
                    !isObject(q) ||
                    !only(q, ['dimension', 'question']) ||
                    !text(q['dimension']) ||
                    !text(q['question'])
                ) {
                    problems.push(`${at}: needs a dimension and a question`);
                    return;
                }
                if (!ids.has(q['dimension'])) {
                    problems.push(`${at}: ${q['dimension']} is not one of the dimensions`);
                }
                if (asked.has(q['dimension'])) {
                    problems.push(`${at}: ${q['dimension']} is asked twice`);
                }
                asked.add(q['dimension']);
            });
        }
    });
    return problems;
}

/** Parse a request list's text, or throw a usage error naming every shape problem. */
export function parseRequests(textOf: string, where: string): RequestList {
    let value: unknown;
    try {
        value = JSON.parse(textOf) as unknown;
    } catch (err) {
        throw new CommandError(`${where} is not JSON: ${(err as Error).message}`, EXIT.usage);
    }
    const problems = requestsShapeProblems(value);
    if (problems.length > 0) {
        throw new CommandError(
            `${where} is not a request list:\n  ${problems.join('\n  ')}`,
            EXIT.usage,
        );
    }
    return value as RequestList;
}

/** The committed request list. */
export function committedRequests(root: string): RequestList {
    return parseRequests(
        readFileSync(path.join(root, ...REQUESTS_FILE.split('/')), 'utf8'),
        REQUESTS_FILE,
    );
}

/** A base mod's folder. */
export function baseDir(root: string, base: string): string {
    return path.join(root, ...BASES_DIR.split('/'), base);
}

/** The names a request's text writes between backticks, in order, each once. */
export function textNames(request: string): string[] {
    return [...new Set([...request.matchAll(/`([^`]+)`/g)].map((m) => m[1] ?? ''))];
}

/** The name a relied-on entry stands for, as a request's text writes it. */
export function reliedOnName(entry: ReliedOn): string {
    if ('bucket' in entry) {
        return entry.name;
    }
    if ('iterator' in entry) {
        return entry.iterator;
    }
    if ('field' in entry) {
        return entry.value ?? entry.field;
    }
    return entry.name;
}

/**
 * The names a request relies on that the game, as the spec package states it, or its base
 * mod, as the index reads it, does not have: empty when every one exists. A field's value must
 * be one the base game writes in it (the schema's `values`).
 */
export function reliedOnProblems(spec: Spec, root: string, list: RequestList): string[] {
    const vocabulary = vocabularyOf(spec);
    const problems: string[] = [];
    const bases = new Map<string, ReturnType<typeof openWorkspace>>();
    for (const request of list.requests) {
        const say = (what: string): void => {
            problems.push(`${request.id}: ${what}`);
        };
        for (const entry of request.relies_on) {
            if ('bucket' in entry) {
                if (!vocabulary.has(entry.bucket, entry.name)) {
                    say(`${entry.name} is not a name of the spec package's ${entry.bucket}`);
                }
            } else if ('iterator' in entry) {
                const iterator = vocabulary.iteratorOf(entry.iterator);
                if (iterator === undefined || !vocabulary.has('lists', iterator.base)) {
                    say(
                        `${entry.iterator} is not an iterator prefix of the spec package before one of its lists`,
                    );
                }
            } else if ('field' in entry) {
                const field = spec.data.schema[entry.folder]?.fields[entry.field];
                if (field === undefined) {
                    say(
                        `${entry.field} is not a field the spec package's schema gives ${entry.folder}`,
                    );
                } else if (
                    entry.value !== undefined &&
                    !(field.values ?? []).some((v) => v.value === entry.value)
                ) {
                    say(
                        `${entry.value} is not a value the base game writes in ${entry.folder}'s ${entry.field}`,
                    );
                }
            } else {
                const dir = baseDir(root, entry.base);
                if (entry.base !== request.base) {
                    say(
                        `${entry.name} is relied on in the base ${entry.base}, but the request starts from ${request.base}`,
                    );
                    continue;
                }
                if (!existsSync(dir)) {
                    say(`the base ${entry.base} does not exist`);
                    continue;
                }
                let workspace = bases.get(entry.base);
                if (workspace === undefined) {
                    workspace = openWorkspace({ spec, gameDir: null, cacheDir: null, modDir: dir });
                    bases.set(entry.base, workspace);
                }
                const defined = workspace.index
                    .definitions(entry.name, { database: entry.database })
                    .some((d) => d.layer === 'mod');
                if (!defined) {
                    say(
                        `${entry.name} is not defined in ${entry.database} of the base ${entry.base}`,
                    );
                }
            }
        }
    }
    return problems;
}

/** An expectation in words, as a record states it. */
export function describeExpectation(e: Expectation): string {
    switch (e.kind) {
        case 'file':
            return `a ${e.new === true ? 'new ' : ''}file in ${e.folder}`;
        case 'top-level':
            return `${e.key} = ${e.value} at the top of a file in ${e.folder}`;
        case 'defines':
            return `${e.database} defines ${e.name}`;
        case 'field':
            return `${e.name} (${e.database}) has ${e.field}${e.value !== undefined ? ` = ${e.value}` : ''}${e.count !== undefined ? ` ${String(e.count)} time${e.count === 1 ? '' : 's'}` : ''}`;
        case 'uses':
            return `${e.name} (${e.database}) uses ${e.uses}`;
        case 'resolves':
            return `${e.name} (${e.database}) uses ${e.uses}, defined in ${e.to}`;
        case 'localization':
            return `the English localization defines ${e.key}`;
        case 'unchanged':
            return `${e.file} is unchanged`;
    }
}
