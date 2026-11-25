/**
 * One name's answer as `lookup` gives it (`lookup.ts`): the core's lookup (docs/PLAN.md item
 * 4.8) written compactly, so that every name asked is answered whole in one result.
 *
 * The core's answer of a name holds every reading the spec package has of it with the evidence
 * of each part; `effect`, a field of more than a hundred folders, is 127,000 characters of it,
 * and the first `lookup` of the expert requests' development run asked for up to 20 names. What
 * an agent writes script from is each reading's own facts: what it is (its kind, its bucket, or
 * the folder and path of a field), the game's own description, its scopes, what it takes, its
 * version, its removal and replacement, and, for a field, its kind, value type and the values the
 * base game writes. Those are written here, every one of them, in the order of the core's
 * readings; the evidence behind each (the spec package's sources, counts and quotes) is left to
 * the command line's `lookup --json`, which prints the core's answer whole.
 *
 * Then, after the readings, where the name is defined (each definition group's rule and at most
 * `PLACES_SHOWN` of its places, the one in force first, its count whole: `find_definition` lists
 * all) and how it is used (the count by layer and the first `USES_SHOWN` places: `find_references`
 * lists all, a page at a time, one name a call). Every place is written by `placeOf`.
 *
 * A name that is a field of many folders: without `folder`, a field of more than
 * `FIELDS_IN_FULL` folders is written in brief (its folder, path, kind of field and value type),
 * and `lookup` with `folder` gives it in full in that folder. A name whose answer is still larger
 * than `NAME_ROOM` is written smaller, a step at a time (`answerOf`), so that every name fits a
 * result alone: its fields as a list of folders, then its definitions and uses as counts only.
 */

import type {
    DefinitionGroupAnswer,
    DefinitionsAnswer,
    FieldReading,
    LocalizationAnswer,
    LookupResult,
    Reading,
    ReadingBase,
    ReferenceAnswer,
    ScopesAnswer,
    SuggestionsAnswer,
    UsesAnswer,
} from '@pychivalry/core';
import { languageOf } from '@pychivalry/core';
import { MOD_LAYER, placeOf } from '../places.js';
import { RESULT_BUDGET, sizeOf } from '../result.js';

/** The uses each name lists; `find_references` lists all. */
export const USES_SHOWN = 3;

/** The places each definition group lists; `find_definition` lists all. */
export const PLACES_SHOWN = 3;

/** Without `folder`, a name's field readings are given in full when it is a field of at most this many folders. */
export const FIELDS_IN_FULL = 3;

/** The most characters one name's answer may take: room is left for the list of names not answered. */
export const NAME_ROOM = RESULT_BUDGET - 4_000;

/** How much of a name's answer is written: each step smaller than the one before. */
export type Detail = 'full' | 'field-folders' | 'counts';

const DETAILS: readonly Detail[] = ['full', 'field-folders', 'counts'];

type Out = Record<string, unknown>;

function unique(values: readonly string[]): string[] {
    return [...new Set(values)];
}

/** A description's texts, each once, and none another holds whole. */
function descriptionOf(r: ReadingBase): Out {
    if (r.description.status !== 'known') {
        return {};
    }
    const texts = unique(r.description.texts.map((t) => t.text));
    return {
        description: texts.filter((t) => !texts.some((other) => other !== t && other.includes(t))),
    };
}

/** The scopes, as the package says them, without its reasons for saying nothing. */
function scopesOf(s: ScopesAnswer): Out {
    switch (s.status) {
        case 'supported':
            return s.targets.length === 0
                ? { scopes: s.scopes }
                : { scopes: s.scopes, targets: s.targets };
        case 'no-requirement':
            return s.targets.length === 0
                ? { scopes_note: 'no scope requirement declared' }
                : { scopes_note: 'no scope requirement declared', targets: s.targets };
        case 'not-documented':
            return { scopes_note: "the game's own documentation gives no scopes" };
        case 'use-areas':
            return { use_areas: s.areas };
        case 'by-template-tag':
            return {
                use_areas_by_form: s.tags.map((t) => ({ form: t.form, use_areas: t.useAreas })),
            };
        case 'link-forms':
            return {
                link_forms: s.forms.map((f) => {
                    const form: Out = { from: f.scopes, to: f.targets };
                    if (f.description !== '') {
                        form['description'] = f.description;
                    }
                    if (f.globalLink) {
                        form['global'] = true;
                    }
                    if (f.requiresData) {
                        form['requires_data'] = true;
                    }
                    if (f.wildCard) {
                        form['wild_card'] = true;
                    }
                    return form;
                }),
            };
        case 'field': {
            const out: Out = {};
            if (s.measured !== null) {
                out['scopes'] = s.measured.scopes;
            }
            const info = (s.info ?? []).map((i) => i.scope).filter((x): x is string => x !== null);
            if (info.length > 0) {
                out['info_scopes'] = unique(info);
            }
            if (s.recordRoot !== null) {
                out['root_scope'] = s.recordRoot;
            }
            return out;
        }
        case 'not-applicable':
            return {};
    }
}

/** The parts every reading has: description, scopes, what it takes, version, removal. */
function baseOf(r: ReadingBase): Out {
    const out: Out = { ...descriptionOf(r), ...scopesOf(r.scopes) };
    if (r.takes.status === 'known') {
        out['takes'] = r.takes.forms;
    }
    if (r.since.status === 'known') {
        out['since'] = r.since.since;
    }
    if (r.retired.length > 0) {
        out['removed'] = r.retired.map((e) => ({
            from: e.bucket,
            removed_in: e.removed_in,
            replacement: e.replacement,
            ...(e.note === '' ? {} : { note: e.note }),
        }));
    }
    if (r.derivedOnly === true) {
        out['undocumented'] = true;
    }
    return out;
}

function namesOf(rows: readonly ReferenceAnswer[]): string[] {
    return unique(rows.flatMap((r) => r.refersTo));
}

function localizationOf(l: LocalizationAnswer): Out {
    if (l.status !== 'read' || l.keys.length === 0) {
        return {};
    }
    return {
        localization: l.keys.map((k) => ({
            key: k.key,
            texts: k.texts.map((t) => ({
                language: t.language,
                text: t.text,
                in_force: t.inForce,
            })),
        })),
    };
}

/**
 * A field reading in brief: what it is, without its description, values or notes. Its path is
 * written only when it is not the name alone (a field nested in a block of the record).
 */
function fieldInBrief(r: FieldReading): Out {
    const out: Out = { kind: 'field', folder: r.directory };
    if (r.path.length !== 1) {
        out['path'] = r.path;
    }
    out['field_kind'] = r.fieldKind;
    if (r.valueType.status === 'measured') {
        out['value_type'] = r.valueType.type;
    }
    return out;
}

/** One reading, written compactly: every fact the core's reading states, without its evidence. */
export function readingOf(r: Reading): Out {
    switch (r.kind) {
        case 'bucket': {
            const out: Out = { kind: r.kind, bucket: r.bucket, ...baseOf(r) };
            const values = namesOf(r.valueNames);
            if (values.length > 0) {
                out['value_names'] = values;
            }
            if (r.parameters.length > 0) {
                out['parameters'] = r.parameters.map((p) => ({
                    parameter: p.path,
                    names: p.refersTo,
                }));
            }
            if (r.iterators !== null && r.iterators.length > 0) {
                out['iterators'] = r.iterators.map((i) => i.name);
            }
            if (r.fromCode !== null) {
                out['from_code'] = r.fromCode;
            }
            if (r.modifier !== null) {
                Object.assign(out, localizationOf(r.modifier.localization));
            }
            return out;
        }
        case 'documented-on-action':
            return { kind: r.kind, ...baseOf(r), from_code: r.fromCode };
        case 'keyword-template':
            return {
                kind: r.kind,
                bucket: r.bucket,
                template: r.template,
                database: r.database,
                key: r.key,
                key_defined: r.keyDefined,
                ...baseOf(r),
            };
        case 'iterator': {
            const out: Out = { kind: r.kind, prefix: r.prefix, list: r.base };
            if (r.list.from === 'defined') {
                out['list_defined_in'] = r.list.database;
            }
            Object.assign(out, baseOf(r));
            if (r.prefixKind !== null) {
                out['prefix_kind'] = r.prefixKind.kind;
            }
            if (r.formKind !== null) {
                out['documented_as'] = r.formKind;
            }
            return out;
        }
        case 'iterator-departure':
            return {
                kind: r.kind,
                row: typeof r.row['id'] === 'string' ? r.row['id'] : r.row.status,
                ...baseOf(r),
            };
        case 'modifier-template':
            return {
                kind: r.kind,
                proof: r.proof,
                templates: r.templates,
                ...baseOf(r),
                ...localizationOf(r.localization),
            };
        case 'field': {
            const out: Out = fieldInBrief(r);
            if (r.required.required) {
                out['required'] = true;
            }
            if (r.unconfirmed) {
                out['unconfirmed'] = true;
            }
            // A field's scopes are those measured or given by its folder's .info file; the
            // package's "no scope recorded" says nothing a field reading needs.
            const base = baseOf(r);
            if (r.scopes.status === 'not-documented') {
                delete base['scopes_note'];
            }
            Object.assign(out, base);
            if (r.values.status === 'observed') {
                out['values'] = r.values.values.map((v) => v.value);
            }
            if (r.localizationKey.status === 'yes') {
                out['localization_key'] = true;
            }
            if (r.holds !== null) {
                out['holds'] = r.holds;
            }
            const refers = namesOf(r.refersTo);
            if (refers.length > 0) {
                out['refers_to'] = refers;
            }
            if (r.useAreas !== null) {
                out['use_areas'] = r.useAreas.useAreas;
            }
            if (r.note !== null) {
                out['note'] = r.note;
            }
            return out;
        }
        case 'keyword-parameter':
            return {
                kind: r.kind,
                bucket: r.bucket,
                keyword: r.keyword,
                refers_to: r.reference.refersTo,
                ...baseOf(r),
            };
        case 'keyword-role':
            return {
                kind: r.kind,
                roles: r.roles,
                where: r.where,
                status: r.status,
                ...baseOf(r),
                ...(r.note === null ? {} : { note: r.note }),
            };
        case 'declaration':
            return {
                kind: r.kind,
                folder: r.directory,
                key: r.key,
                declares: r.declares,
                scope: r.scope,
                form: r.form,
                status: r.status,
                ...baseOf(r),
            };
        case 'table-entry':
            return {
                kind: r.kind,
                table: r.table,
                meaning: r.meaning,
                ...(r.trust === null ? {} : { trust: r.trust.use }),
                ...baseOf(r),
            };
        case 'defined':
            return { kind: r.kind, database: r.database, called_as: r.calledAs, ...baseOf(r) };
        case 'scope-type':
            return { kind: r.kind, named_as: r.namedAs, ...baseOf(r) };
        case 'retired':
            return { kind: r.kind, bucket: r.bucket, ...baseOf(r) };
        case 'dropped':
            return { kind: r.kind, bucket: r.bucket, reason: r.reason, ...baseOf(r) };
    }
}

/** A definition group's places: the one in force first, then the mod's, then the rest. */
function orderedPlaces(
    group: DefinitionGroupAnswer,
): DefinitionGroupAnswer['definitions'][number][] {
    const rank = (d: DefinitionGroupAnswer['definitions'][number]): number =>
        d.inForce === 'yes' ? 0 : d.layer === MOD_LAYER ? 1 : 2;
    return [...group.definitions].sort((a, b) => rank(a) - rank(b));
}

/**
 * The definition groups of a name: with `language`, the localization of other languages is left
 * out and counted, as the localization text of other languages is.
 */
function definitionsOf(d: DefinitionsAnswer, places: boolean, language: string | null): Out {
    if (d.status !== 'read') {
        return {};
    }
    const other = (g: DefinitionGroupAnswer): boolean => {
        const lang = languageOf(g.database);
        return language !== null && lang !== null && lang !== '' && lang !== language;
    };
    const kept = d.groups.filter((g) => !other(g));
    const count = kept.reduce((n, g) => n + g.definitions.length, 0);
    const otherLanguages = d.groups.filter(other).reduce((n, g) => n + g.definitions.length, 0);
    return {
        definitions: {
            count,
            ...(otherLanguages > 0 ? { other_languages: otherLanguages } : {}),
            groups: kept.map((g) => {
                const group: Out = {
                    database: g.database,
                    container: g.container,
                    in_force:
                        'rule' in g.inForce
                            ? { status: g.inForce.status, rule: g.inForce.rule }
                            : { status: g.inForce.status },
                    count: g.definitions.length,
                };
                if (places) {
                    group['first'] = orderedPlaces(g)
                        .slice(0, PLACES_SHOWN)
                        .map((def) => ({
                            ...placeOf(def.layer, def.file, def.range),
                            in_force: def.inForce,
                        }));
                }
                return group;
            }),
        },
    };
}

function usesOf(u: UsesAnswer, places: boolean): Out {
    if (u.status !== 'read') {
        return {};
    }
    const out: Out = { count: u.count, by_layer: u.byLayer };
    if (places) {
        out['first'] = u.first
            .slice(0, USES_SHOWN)
            .map((use) => placeOf(use.layer, use.file, use.range));
    }
    return { uses: out };
}

function suggestionsOf(s: SuggestionsAnswer): Out {
    return s.status === 'computed' && s.suggestions.length > 0
        ? { did_you_mean: s.suggestions.map((x) => x.name) }
        : {};
}

/**
 * The readings of a name as `detail` and `folder` say: every reading in the core's order, the
 * fields of other folders than `folder` left out (counted), the fields in brief or as a list of
 * folders when the name is a field of many.
 */
function readingsOf(readings: readonly Reading[], folder: string | null, detail: Detail): Out {
    const fields = readings.filter((r): r is FieldReading => r.kind === 'field');
    const kept =
        folder === null
            ? readings
            : readings.filter((r) => r.kind !== 'field' || r.directory === folder);
    const elsewhere = folder === null ? 0 : fields.filter((r) => r.directory !== folder).length;
    const keptFields = kept.filter((r) => r.kind === 'field').length;
    const fieldsInFull = folder !== null || keptFields <= FIELDS_IN_FULL;
    const out: Out = {};
    if (detail === 'full') {
        out['readings'] = kept.map((r) =>
            r.kind === 'field' && !fieldsInFull ? fieldInBrief(r) : readingOf(r),
        );
        if (!fieldsInFull) {
            out['fields_in_brief'] = true;
        }
    } else {
        out['readings'] = kept.filter((r) => r.kind !== 'field').map(readingOf);
        const listed = kept.filter((r): r is FieldReading => r.kind === 'field');
        if (listed.length > 0) {
            out['field_of'] = unique(listed.map((r) => r.directory));
        }
    }
    if (elsewhere > 0) {
        out['fields_elsewhere'] = elsewhere;
    }
    return out;
}

/** A name's answer at one level of detail. */
function answerAt(
    result: LookupResult,
    folder: string | null,
    language: string | null,
    detail: Detail,
): Out {
    const places = detail !== 'counts';
    return {
        name: result.name,
        unknown: result.unknown,
        ...readingsOf(result.readings, folder, detail),
        ...definitionsOf(result.definitions, places, language),
        ...usesOf(result.uses, places),
        ...suggestionsOf(result.suggestions),
    };
}

/**
 * A name's answer: in full (`detail` "full") when it fits `room`, else at the first smaller
 * level that does; the last level is the smallest, and every name of the spec package fits at it
 * (a test holds it).
 */
export function answerOf(
    result: LookupResult,
    folder: string | null,
    language: string | null,
    room = NAME_ROOM,
): { readonly answer: Out; readonly detail: Detail } {
    for (const detail of DETAILS) {
        const answer = answerAt(result, folder, language, detail);
        if (detail === 'full' && sizeOf(answer) <= room) {
            return { answer, detail };
        }
        if (detail !== 'full') {
            const marked = { ...answer, detail };
            if (sizeOf(marked) <= room || detail === 'counts') {
                return { answer: marked, detail };
            }
        }
    }
    throw new Error('unreachable: the last level is always returned');
}
