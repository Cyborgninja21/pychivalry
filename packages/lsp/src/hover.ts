/**
 * Hover (docs/PLAN.md item 7.5): the core's lookup answer for the name under the cursor,
 * rendered as Markdown. Every part is the package's or the index's own: each reading's
 * description with where it comes from (the executable's own text, the game's documentation
 * output, Paradox's `.info` files, the wiki-era seeds), the scopes it supports, what it takes,
 * and where the mod and the base game define it, with the definition in force where the
 * override rules name one and "which one is in force is not known" where they do not. Where the
 * package says nothing, the hover says nothing of that part; for a name nothing knows there is
 * no hover.
 */

import type {
    DefinitionGroupAnswer,
    DescriptionSource,
    InForceAnswer,
    LookupResult,
    Reading,
    ScopesAnswer,
    TakesAnswer,
} from '@pychivalry/core';

/** How many definitions a hover lists per database before it only counts them. */
export const HOVER_DEFINITIONS = 5;

/** How many readings a hover shows. */
export const HOVER_READINGS = 4;

const SOURCE_TEXT: Readonly<Record<DescriptionSource, string>> = {
    doc: "the game's own text",
    script_docs: "the game's documentation output",
    info: "Paradox's .info files",
    wiki: 'the wiki-era seed files',
};

/** Text shown as written: every Markdown character escaped, line breaks kept. */
export function escapeMarkdown(text: string): string {
    return text
        .replace(/[\\`*_{}[\]()#+\-.!|<>~]/g, '\\$&')
        .split(/\r?\n/)
        .join('  \n');
}

/** What a reading is, in a few words. */
function heading(r: Reading): string {
    switch (r.kind) {
        case 'bucket':
            return r.alsoIn.length === 0 ? r.bucket : `${r.bucket} (also ${r.alsoIn.join(', ')})`;
        case 'documented-on-action':
            return "on-action the game's documentation lists";
        case 'keyword-template':
            return `${r.bucket}, from the template ${r.template} with a key of ${r.database}`;
        case 'iterator':
            return `iterator: ${r.prefix} over the list ${r.base}`;
        case 'iterator-departure':
            return 'iterator departure';
        case 'modifier-template':
            return `modifier, from the template ${r.templates.join(', ')}`;
        case 'field':
            return `field ${r.path.join('.')} of ${r.directory} (${r.fieldKind})`;
        case 'keyword-parameter':
            return `parameter of the ${r.bucket} ${r.keyword}`;
        case 'keyword-role':
            return `structural keyword: ${r.roles.join(', ')}`;
        case 'declaration':
            return `declaration in ${r.directory ?? 'every folder'}`;
        case 'table-entry':
            return `entry of the table ${r.table}`;
        case 'defined':
            return `defined in ${r.database}`;
        case 'scope-type':
            return 'scope type';
        case 'retired':
            return `removed from ${r.bucket}`;
        case 'dropped':
            return `dropped from ${r.bucket}`;
    }
}

function scopesLine(scopes: ScopesAnswer): string | null {
    switch (scopes.status) {
        case 'supported':
            return `Scopes: ${scopes.scopes.join(', ')}${scopes.targets.length === 0 ? '' : `; targets ${scopes.targets.join(', ')}`}`;
        case 'no-requirement':
            return 'Scopes: no requirement declared';
        case 'not-documented':
            return null;
        case 'use-areas':
            return `Use areas: ${scopes.areas.join(', ')}`;
        case 'by-template-tag':
            return `Use areas: ${scopes.tags.map((t) => `${t.tag} (${(t.useAreas ?? []).join(', ')})`).join('; ')}`;
        case 'link-forms':
            return scopes.forms.length === 0
                ? null
                : `Link: ${scopes.forms
                      .map(
                          (f) =>
                              `${f.globalLink ? 'from any scope' : `from ${f.scopes.join(', ')}`} to ${f.targets.join(', ') || 'no type'}`,
                      )
                      .join('; ')}`;
        case 'field':
            return scopes.measured === null
                ? null
                : `Scopes (measured): ${scopes.measured.scopes.join(', ')}`;
        case 'not-applicable':
            return null;
    }
}

function takesLine(takes: TakesAnswer): string | null {
    if (takes.status !== 'known') {
        return null;
    }
    const forms = takes.readings.map((r) => r.form);
    return `Takes: ${[...new Set(forms.length === 0 ? takes.forms : forms)].join(', ')}`;
}

function inForceLine(inForce: InForceAnswer, count: number): string {
    switch (inForce.status) {
        case 'single':
            return 'one definition';
        case 'winner':
            return `${String(count)} definitions; the one in force by the override rules is marked`;
        case 'all':
        case 'statements':
            return `${String(count)} definitions, each one counts`;
        case 'clash':
            return `${String(count)} definitions, which the game calls an error`;
        case 'not-in-force':
            return `${String(count)} definitions, none in force`;
        case 'not-read':
            return `${String(count)} definitions, none in a file the game reads`;
        case 'winner-not-known':
            return `${String(count)} definitions; which one is in force is not known`;
    }
}

function definitionLines(
    group: DefinitionGroupAnswer,
    place: (d: DefinitionGroupAnswer['definitions'][number]) => string,
): string[] {
    const where =
        group.container === null ? group.database : `${group.database} (${group.container})`;
    const lines = [
        `Defined in ${escapeMarkdown(where)}: ${inForceLine(group.inForce, group.definitions.length)}`,
    ];
    const shown = [...group.definitions]
        .sort((a, b) => Number(b.inForce === 'yes') - Number(a.inForce === 'yes'))
        .slice(0, HOVER_DEFINITIONS);
    for (const d of shown) {
        lines.push(
            `- \`${place(d)}\`${d.inForce === 'yes' && group.definitions.length > 1 ? ' (in force)' : ''}`,
        );
    }
    if (group.definitions.length > shown.length) {
        lines.push(`- and ${String(group.definitions.length - shown.length)} more`);
    }
    return lines;
}

/** The hover's Markdown for a lookup answer, or null when it has nothing to say. */
export function renderHover(
    result: LookupResult,
    place: (d: DefinitionGroupAnswer['definitions'][number]) => string,
): string | null {
    const groups = result.definitions.status === 'read' ? result.definitions.groups : [];
    const readings = result.readings.filter((r) => r.kind !== 'defined' || groups.length === 0);
    if (readings.length === 0 && groups.length === 0) {
        return null;
    }
    const parts: string[] = [`**\`${result.name}\`**`];
    for (const r of readings.slice(0, HOVER_READINGS)) {
        const lines = [`*${escapeMarkdown(heading(r))}*`];
        if (r.description.status === 'known') {
            for (const text of r.description.texts) {
                lines.push(escapeMarkdown(text.text));
                lines.push(`*From ${text.sources.map((s) => SOURCE_TEXT[s]).join(', ')}.*`);
            }
        }
        for (const line of [scopesLine(r.scopes), takesLine(r.takes)]) {
            if (line !== null) {
                lines.push(escapeMarkdown(line));
            }
        }
        parts.push(lines.join('\n\n'));
    }
    if (readings.length > HOVER_READINGS) {
        parts.push(
            `*${String(readings.length - HOVER_READINGS)} more readings: pychivalry lookup ${escapeMarkdown(result.name)}*`,
        );
    }
    for (const group of groups) {
        parts.push(definitionLines(group, place).join('\n'));
    }
    return parts.join('\n\n---\n\n');
}
