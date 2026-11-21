/**
 * Structural validation of a spec package, mirroring the package's own `schema.json`
 * (package_format 4) without a third-party JSON Schema validator.
 *
 * The checks are the ones the engine relies on: every required key is present with the
 * right type, enumerations hold only known values, and cross references the loader
 * builds maps from (bucket names, retired buckets) are consistent. A package that fails
 * is rejected with every problem listed, not just the first.
 */

import {
    BUCKETS,
    Bucket,
    FIELD_KINDS,
    KEYWORD_TEMPLATE_BUCKETS,
    SINCE_VALUES,
    SpecPackage,
} from './types';

export class SpecValidationError extends Error {
    public readonly problems: string[];

    constructor(problems: string[]) {
        super(`Invalid CK3 spec package:\n  ${problems.slice(0, 50).join('\n  ')}`);
        this.name = 'SpecValidationError';
        this.problems = problems;
    }
}

type Json = unknown;

function isObject(v: Json): v is Record<string, Json> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isString(v: Json): v is string {
    return typeof v === 'string';
}

function isStringArray(v: Json): v is string[] {
    return Array.isArray(v) && v.every(isString);
}

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const ERROR_ID = /^[A-Za-z0-9_]{1,60}$/;
const VERSION = /^\d+\.\d+\.\d+\.\d+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const BUCKET_SET: ReadonlySet<string> = new Set(BUCKETS);
const KIND_SET: ReadonlySet<string> = new Set(FIELD_KINDS);
const SINCE_SET: ReadonlySet<string> = new Set(SINCE_VALUES);
const ITERATOR_PREFIXES: ReadonlySet<string> = new Set(['any_', 'every_', 'random_', 'ordered_']);
const KEYWORD_TEMPLATE_BUCKET_SET: ReadonlySet<string> = new Set(KEYWORD_TEMPLATE_BUCKETS);
const KEYWORD_TEMPLATE = /^[a-z_]*%s[a-z_]*$/;
const DIRECTORY_SOURCES: ReadonlySet<string> = new Set([
    'scriptable_systems',
    'exe_loader_path',
    'snapshot',
]);

const TOP_LEVEL_KEYS = [
    'package_format',
    'manifest',
    'buckets',
    'modifier_templates',
    'keyword_templates',
    'iterator_prefixes',
    'multi_bucket',
    'directories',
    'schema',
    'errors',
    'retired',
    'noise_dropped',
    'scope_validity',
    'scope_types',
];

const SCOPE_BUCKETS = ['triggers', 'effects', 'links', 'lists', 'on_actions'] as const;
const SCOPE_NAME = /^[a-z_]+$/;

class Checker {
    public readonly problems: string[] = [];

    public fail(where: string, what: string): void {
        this.problems.push(`${where}: ${what}`);
    }

    public requireKeys(where: string, obj: Record<string, Json>, keys: string[]): void {
        for (const key of keys) {
            if (!(key in obj)) {
                this.fail(where, `missing required key '${key}'`);
            }
        }
    }

    public onlyKeys(where: string, obj: Record<string, Json>, allowed: string[]): void {
        const set = new Set(allowed);
        for (const key of Object.keys(obj)) {
            if (!set.has(key)) {
                this.fail(where, `unexpected key '${key}'`);
            }
        }
    }

    public string(where: string, v: Json, pattern?: RegExp): void {
        if (!isString(v)) {
            this.fail(where, 'expected a string');
        } else if (pattern && !pattern.test(v)) {
            this.fail(where, `'${v}' does not match ${pattern.source}`);
        }
    }

    public oneOf(where: string, v: Json, allowed: ReadonlySet<string>): void {
        if (!isString(v) || !allowed.has(v)) {
            this.fail(where, `'${String(v)}' is not one of ${Array.from(allowed).join(', ')}`);
        }
    }
}

function checkManifest(c: Checker, m: Json): void {
    if (!isObject(m)) {
        c.fail('manifest', 'expected an object');
        return;
    }
    c.requireKeys('manifest', m, ['game', 'version', 'exe', 'tooling', 'generated', 'sources']);
    c.onlyKeys('manifest', m, [
        'game',
        'version',
        'exe',
        'tooling',
        'generated',
        'sources',
        'source_sha256',
        'doc_join',
    ]);
    if (m.game !== 'ck3') {
        c.fail('manifest.game', "expected 'ck3'");
    }
    c.string('manifest.version', m.version, VERSION);
    c.string('manifest.generated', m.generated, DATE);
    if (!isStringArray(m.sources) || m.sources.length === 0) {
        c.fail('manifest.sources', 'expected a non-empty array of strings');
    }
    const exe = m.exe;
    if (!isObject(exe)) {
        c.fail('manifest.exe', 'expected an object');
    } else {
        c.requireKeys('manifest.exe', exe, ['version', 'exe', 'bytes', 'sha256']);
        c.string('manifest.exe.sha256', exe.sha256, /^[0-9A-F]{64}$/);
        if (typeof exe.bytes !== 'number' || exe.bytes < 1) {
            c.fail('manifest.exe.bytes', 'expected a positive integer');
        }
    }
    if (!isObject(m.tooling)) {
        c.fail('manifest.tooling', 'expected an object');
    } else {
        c.requireKeys('manifest.tooling', m.tooling, [
            'ghidra',
            'ghidra_cli',
            'profile',
            'profile_sha256',
        ]);
    }
}

function checkBuckets(c: Checker, b: Json): void {
    if (!isObject(b)) {
        c.fail('buckets', 'expected an object');
        return;
    }
    c.requireKeys('buckets', b, [...BUCKETS]);
    c.onlyKeys('buckets', b, [...BUCKETS]);
    for (const bucket of BUCKETS) {
        const entries = b[bucket];
        if (!isObject(entries)) {
            c.fail(`buckets.${bucket}`, 'expected an object');
            continue;
        }
        for (const [name, entry] of Object.entries(entries)) {
            const where = `buckets.${bucket}.${name}`;
            if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
                c.fail(where, 'name is not an identifier');
            }
            if (!isObject(entry) || !isString(entry.doc)) {
                c.fail(where, "expected { doc: string, provenance?: 'table' }");
                continue;
            }
            c.onlyKeys(where, entry, ['doc', 'provenance']);
            if ('provenance' in entry && entry.provenance !== 'table') {
                c.fail(where, "provenance must be 'table'");
            }
        }
    }
}

function checkField(c: Checker, where: string, f: Json): void {
    if (!isObject(f)) {
        c.fail(where, 'expected an object');
        return;
    }
    c.requireKeys(where, f, ['kind', 'provenance', 'usage', 'required', 'since']);
    c.onlyKeys(where, f, [
        'kind',
        'holds',
        'provenance',
        'usage',
        'required',
        'required_evidence',
        'since',
        'description',
        'wiki_kind',
        'hook',
        'note',
        'scope',
        'scope_evidence',
        'fields',
    ]);
    c.oneOf(`${where}.kind`, f.kind, KIND_SET);
    c.oneOf(`${where}.provenance`, f.provenance, new Set(['engine', 'vanilla', 'corpus']));
    if ('scope' in f && (!isStringArray(f.scope) || f.scope.length === 0)) {
        c.fail(`${where}.scope`, 'expected a non-empty array of scope types');
    }
    if ('scope_evidence' in f && !isString(f.scope_evidence)) {
        c.fail(`${where}.scope_evidence`, 'expected a string');
    }
    c.oneOf(`${where}.since`, f.since, SINCE_SET);
    if (typeof f.usage !== 'number' || f.usage < 0) {
        c.fail(`${where}.usage`, 'expected a non-negative integer');
    }
    if (typeof f.required !== 'boolean') {
        c.fail(`${where}.required`, 'expected a boolean');
    }
    if ('holds' in f && f.holds !== 'modifiers') {
        c.fail(`${where}.holds`, "expected 'modifiers'");
    }
    if ('fields' in f) {
        if (!isObject(f.fields)) {
            c.fail(`${where}.fields`, 'expected an object');
        } else {
            for (const [name, sub] of Object.entries(f.fields)) {
                checkField(c, `${where}.fields.${name}`, sub);
            }
        }
    }
}

function checkSchema(c: Checker, s: Json, directoryPaths: ReadonlySet<string>): void {
    if (!isObject(s)) {
        c.fail('schema', 'expected an object');
        return;
    }
    for (const [dir, entry] of Object.entries(s)) {
        const where = `schema.${dir}`;
        if (!directoryPaths.has(dir)) {
            c.fail(where, 'key is not a path in directories');
        }
        if (!isObject(entry)) {
            c.fail(where, 'expected an object');
            continue;
        }
        c.requireKeys(where, entry, ['content_type', 'fields', 'vanilla']);
        c.onlyKeys(where, entry, [
            'content_type',
            'root_scope',
            'record_body',
            'vanilla',
            'wiki_seed',
            'fields',
            'unconfirmed',
        ]);
        c.string(`${where}.content_type`, entry.content_type);
        if ('record_body' in entry) {
            c.oneOf(
                `${where}.record_body`,
                entry.record_body,
                new Set(['trigger_block', 'effect_block', 'modifier_block'])
            );
        }
        if (!isObject(entry.fields)) {
            c.fail(`${where}.fields`, 'expected an object');
        } else {
            for (const [name, f] of Object.entries(entry.fields)) {
                checkField(c, `${where}.fields.${name}`, f);
            }
        }
        if ('unconfirmed' in entry) {
            if (!isObject(entry.unconfirmed)) {
                c.fail(`${where}.unconfirmed`, 'expected an object');
            } else {
                for (const [name, u] of Object.entries(entry.unconfirmed)) {
                    if (!isObject(u) || u.provenance !== 'wiki' || u.usage !== 0) {
                        c.fail(
                            `${where}.unconfirmed.${name}`,
                            "expected provenance 'wiki', usage 0"
                        );
                    }
                }
            }
        }
    }
}

function checkKeywordTemplates(c: Checker, k: Json, directoryPaths: ReadonlySet<string>): void {
    if (!Array.isArray(k) || k.length === 0) {
        c.fail('keyword_templates', 'expected a non-empty array');
        return;
    }
    const seen = new Set<string>();
    k.forEach((t: Json, i: number) => {
        const where = `keyword_templates[${i}]`;
        if (!isObject(t)) {
            c.fail(where, 'expected an object');
            return;
        }
        c.requireKeys(where, t, ['template', 'bucket', 'keys', 'doc']);
        c.onlyKeys(where, t, ['template', 'bucket', 'keys', 'doc']);
        c.string(`${where}.template`, t.template, KEYWORD_TEMPLATE);
        c.oneOf(`${where}.bucket`, t.bucket, KEYWORD_TEMPLATE_BUCKET_SET);
        c.string(`${where}.keys`, t.keys, /^common\//);
        c.string(`${where}.doc`, t.doc);
        if (isString(t.keys) && !directoryPaths.has(t.keys)) {
            c.fail(`${where}.keys`, `'${t.keys}' is not a path in directories`);
        }
        if (isString(t.template) && isString(t.keys) && isString(t.bucket)) {
            // (template, keys) is the identity; one bucket per pair.
            const id = `${t.template} ${t.keys} ${t.bucket}`;
            if (seen.has(id)) {
                c.fail(where, `duplicate template '${t.template}' for '${t.keys}'`);
            }
            seen.add(id);
        }
    });
}

/**
 * Validate parsed JSON as a spec package. Throws SpecValidationError listing every
 * problem; returns the data typed as SpecPackage when it passes.
 */
export function validateSpecPackage(data: unknown): SpecPackage {
    const c = new Checker();
    if (!isObject(data)) {
        throw new SpecValidationError(['root: expected an object']);
    }
    c.requireKeys('root', data, TOP_LEVEL_KEYS);
    c.onlyKeys('root', data, TOP_LEVEL_KEYS);
    if (data.package_format !== 4) {
        c.fail('package_format', 'expected 4');
    }
    checkManifest(c, data.manifest);
    checkBuckets(c, data.buckets);

    const templates = data.modifier_templates;
    if (!isStringArray(templates) || templates.length === 0) {
        c.fail('modifier_templates', 'expected a non-empty array of strings');
    } else {
        templates.forEach((t, i) => {
            if (!t.includes('%s')) {
                c.fail(`modifier_templates[${i}]`, "template has no '%s'");
            }
        });
    }

    const prefixes = data.iterator_prefixes;
    if (!isStringArray(prefixes)) {
        c.fail('iterator_prefixes', 'expected an array of strings');
    } else {
        prefixes.forEach((p, i) => c.oneOf(`iterator_prefixes[${i}]`, p, ITERATOR_PREFIXES));
    }

    if (!isObject(data.multi_bucket)) {
        c.fail('multi_bucket', 'expected an object');
    } else {
        for (const [name, list] of Object.entries(data.multi_bucket)) {
            if (!IDENT.test(name)) {
                c.fail(`multi_bucket.${name}`, 'name is not an identifier');
            }
            if (!isStringArray(list) || list.length < 2) {
                c.fail(`multi_bucket.${name}`, 'expected at least two bucket names');
            } else {
                list.forEach((b) => c.oneOf(`multi_bucket.${name}`, b, BUCKET_SET));
            }
        }
    }

    const directoryPaths = new Set<string>();
    if (!Array.isArray(data.directories) || data.directories.length === 0) {
        c.fail('directories', 'expected a non-empty array');
    } else {
        data.directories.forEach((d: Json, i: number) => {
            const where = `directories[${i}]`;
            if (!isObject(d)) {
                c.fail(where, 'expected an object');
                return;
            }
            c.requireKeys(where, d, [
                'path',
                'content_type',
                'level',
                'since',
                'source',
                'present_in_vanilla',
            ]);
            c.onlyKeys(where, d, [
                'path',
                'content_type',
                'level',
                'since',
                'source',
                'present_in_vanilla',
                'default_scope',
            ]);
            c.string(`${where}.path`, d.path, /^.+$/);
            c.string(`${where}.content_type`, d.content_type);
            c.oneOf(`${where}.since`, d.since, SINCE_SET);
            c.oneOf(`${where}.source`, d.source, DIRECTORY_SOURCES);
            if (d.level !== null && typeof d.level !== 'number') {
                c.fail(`${where}.level`, 'expected an integer or null');
            }
            if (typeof d.present_in_vanilla !== 'boolean') {
                c.fail(`${where}.present_in_vanilla`, 'expected a boolean');
            }
            if (isString(d.path)) {
                directoryPaths.add(d.path);
            }
        });
    }

    checkSchema(c, data.schema, directoryPaths);
    checkKeywordTemplates(c, data.keyword_templates, directoryPaths);

    if (!Array.isArray(data.errors) || data.errors.length === 0) {
        c.fail('errors', 'expected a non-empty array');
    } else {
        const seen = new Set<string>();
        data.errors.forEach((e: Json, i: number) => {
            const where = `errors[${i}]`;
            if (!isObject(e)) {
                c.fail(where, 'expected an object');
                return;
            }
            c.requireKeys(where, e, ['id', 'category', 'text', 'since', 'note']);
            c.onlyKeys(where, e, ['id', 'category', 'text', 'since', 'note']);
            c.string(`${where}.id`, e.id, ERROR_ID);
            c.string(`${where}.category`, e.category);
            c.string(`${where}.text`, e.text);
            c.string(`${where}.note`, e.note);
            c.oneOf(`${where}.since`, e.since, SINCE_SET);
            if (isString(e.id)) {
                if (seen.has(e.id)) {
                    c.fail(where, `duplicate id '${e.id}'`);
                }
                seen.add(e.id);
            }
        });
    }

    if (!Array.isArray(data.retired)) {
        c.fail('retired', 'expected an array');
    } else {
        data.retired.forEach((r: Json, i: number) => {
            const where = `retired[${i}]`;
            if (!isObject(r)) {
                c.fail(where, 'expected an object');
                return;
            }
            c.requireKeys(where, r, ['name', 'bucket', 'removed_in', 'replacement', 'note']);
            c.string(`${where}.name`, r.name, IDENT);
            c.oneOf(`${where}.bucket`, r.bucket, BUCKET_SET);
            const rep = r.replacement;
            if (rep !== null && !isString(rep) && !isStringArray(rep)) {
                c.fail(`${where}.replacement`, 'expected a string, an array of strings or null');
            }
        });
    }

    if (!Array.isArray(data.noise_dropped)) {
        c.fail('noise_dropped', 'expected an array');
    } else {
        data.noise_dropped.forEach((n: Json, i: number) => {
            if (!isObject(n) || !isString(n.name) || !isString(n.reason)) {
                c.fail(`noise_dropped[${i}]`, 'expected { name, bucket, reason }');
            } else {
                c.oneOf(`noise_dropped[${i}].bucket`, n.bucket, BUCKET_SET);
            }
        });
    }

    checkScopeValidity(c, data.scope_validity);
    checkScopeTypes(c, data.scope_types);

    if (c.problems.length > 0) {
        throw new SpecValidationError(c.problems);
    }
    // Every key and type the engine reads was checked above.
    return data as unknown as SpecPackage;
}

function checkScopeList(c: Checker, where: string, v: Json): void {
    if (!isStringArray(v)) {
        c.fail(where, 'expected an array of scope type names');
    } else {
        v.forEach((s, i) => c.string(`${where}[${i}]`, s, SCOPE_NAME));
    }
}

function checkScopeRecord(c: Checker, where: string, r: Json, extra: string[]): void {
    if (!isObject(r)) {
        c.fail(where, 'expected an object');
        return;
    }
    c.requireKeys(where, r, ['supported_scopes', 'supported_targets', 'description']);
    checkScopeList(c, `${where}.supported_scopes`, r.supported_scopes);
    checkScopeList(c, `${where}.supported_targets`, r.supported_targets);
    c.string(`${where}.description`, r.description);
    for (const key of extra) {
        if (key in r && typeof r[key] !== 'boolean') {
            c.fail(`${where}.${key}`, 'expected a boolean');
        }
    }
}

/** scope_validity: per bucket and name, the game's documented scopes (format 3). */
function checkScopeValidity(c: Checker, sv: Json): void {
    if (!isObject(sv)) {
        c.fail('scope_validity', 'expected an object');
        return;
    }
    c.requireKeys('scope_validity', sv, [...SCOPE_BUCKETS]);
    c.onlyKeys('scope_validity', sv, [...SCOPE_BUCKETS]);
    for (const bucket of SCOPE_BUCKETS) {
        const records = sv[bucket];
        if (!isObject(records)) {
            c.fail(`scope_validity.${bucket}`, 'expected an object');
            continue;
        }
        for (const [name, r] of Object.entries(records)) {
            const where = `scope_validity.${bucket}.${name}`;
            if (bucket !== 'links') {
                checkScopeRecord(c, where, r, ['from_code', 'forms_agree']);
                continue;
            }
            if (!isObject(r) || !Array.isArray(r.forms) || r.forms.length === 0) {
                c.fail(where, 'expected { forms: [...] }');
                continue;
            }
            r.forms.forEach((f: Json, i: number) =>
                checkScopeRecord(c, `${where}.forms[${i}]`, f, [
                    'requires_data',
                    'global_link',
                    'wild_card',
                ])
            );
        }
    }
}

/** scope_types: every scope type the game names, with what produces and iterates it. */
function checkScopeTypes(c: Checker, st: Json): void {
    if (!isObject(st) || Object.keys(st).length === 0) {
        c.fail('scope_types', 'expected a non-empty object');
        return;
    }
    for (const [name, entry] of Object.entries(st)) {
        const where = `scope_types.${name}`;
        c.string(`${where} (name)`, name, SCOPE_NAME);
        if (!isObject(entry)) {
            c.fail(where, 'expected an object');
            continue;
        }
        for (const key of ['links', 'lists', 'on_actions']) {
            if (!isStringArray(entry[key])) {
                c.fail(`${where}.${key}`, 'expected an array of strings');
            }
        }
    }
}

export function isBucket(name: string): name is Bucket {
    return BUCKET_SET.has(name);
}
