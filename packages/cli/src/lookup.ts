/**
 * `lookup <name>...`: everything the core's lookup (item 4.8) answers about each name, as
 * text for a person or as one JSON object per name, the core's `LookupResult` as it is
 * (docs/PLAN.md item 5.5): every reading the spec package has, with its description, scopes,
 * what it takes, its version and its removal; where the base game and the mod given with
 * `--mod` define and use it, and which definition is in force; and, for a name nothing knows,
 * the names close to it.
 *
 * The base game is found as `check` finds it (`--vanilla`, `--no-vanilla`, or Steam's
 * libraries) and loaded from the same on-disk cache. Without a game and a mod there is no
 * workspace: the readings of the package alone.
 *
 * Exit codes: 0 when the package or the workspace knows every name, 1 when one is known to
 * neither, 2 on bad usage.
 */

import {
    defaultCacheDir,
    diskFileSource,
    lookup,
    openWorkspace,
    type DefinitionsAnswer,
    type LocalizationAnswer,
    type LookupResult,
    type Reading,
    type ScopesAnswer,
    type SourceListing,
    type UsesAnswer,
} from '@pychivalry/core';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { InputError, oneValue, type OptionSpec, type Parsed } from './args.js';
import { EXIT, type Command } from './command.js';
import {
    JSON_OPTION,
    NO_VANILLA_OPTION,
    readGameOption,
    readSpecOption,
    SPEC_OPTION,
    VANILLA_OPTION,
} from './inputs.js';
import type { Io } from './io.js';

const MOD_OPTION: OptionSpec = {
    name: '--mod',
    value: '<mod>',
    help: 'a mod folder, indexed over the base game, so that its definitions and uses are found too',
};
const LANGUAGE_OPTION: OptionSpec = {
    name: '--language',
    value: '<language>',
    help: "only this language's localization, as its files' header names it (l_english); every language by default",
};

/** Where a place is: `<layer> <file>:<line>:<column>`, both counted from 1. */
function place(p: {
    readonly layer: string;
    readonly file: string;
    readonly range: { readonly start: { readonly line: number; readonly character: number } };
}): string {
    return `${p.layer} ${p.file}:${String(p.range.start.line + 1)}:${String(p.range.start.character + 1)}`;
}

/** What a reading is, in one line. */
function heading(r: Reading): string {
    switch (r.kind) {
        case 'bucket':
            return r.alsoIn.length === 0
                ? r.bucket
                : `${r.bucket} (also in ${r.alsoIn.join(', ')})`;
        case 'documented-on-action':
            return "on-action the game's own documentation lists, not in the on_actions bucket";
        case 'keyword-template':
            return `${r.bucket}: the template ${r.template}, with ${r.key} a key of ${r.database}${r.keyDefined === null ? '' : r.keyDefined ? ' (defined)' : ' (not defined)'}`;
        case 'iterator':
            return `iterator: ${r.prefix} over the list ${r.base}${r.list.from === 'lists' ? '' : `, defined in ${r.list.database}`}${r.formKind === null ? '' : `; documented as ${r.formKind}`}`;
        case 'iterator-departure':
            return `iterator departure (${r.row.status}): ${typeof r.row['id'] === 'string' ? r.row['id'] : JSON.stringify(r.row)}`;
        case 'modifier-template':
            return `modifier template${r.proof === 'marked-only' ? ', marked only (neither proved nor refuted)' : ''}: ${r.templates.join(', ')}`;
        case 'field':
            return `field of ${r.directory}: ${r.path.join(' > ')} (${r.fieldKind})${r.required.required ? ', required' : ''}`;
        case 'keyword-parameter':
            return `parameter of ${r.bucket} ${r.keyword}: names a key of ${r.reference.refersTo.join(', ')} (${r.reference.status})`;
        case 'keyword-role':
            return `keyword role: ${r.roles.join(', ')} (${r.status})`;
        case 'declaration':
            return `declaration in ${r.directory ?? 'every folder'}: declares ${r.declares} (${r.status})`;
        case 'table-entry':
            return `entry of the table ${r.table}${r.meaning === null ? '' : `: ${r.meaning}`}`;
        case 'defined':
            return `defined in ${r.database}${r.calledAs === null ? '' : `, called as one of the ${r.calledAs}`}`;
        case 'scope-type':
            return `scope type${r.namedAs.length > 0 ? `, named ${r.namedAs.join(', ')}` : ''}`;
        case 'retired':
            return `removed from ${r.bucket} in ${r.entry.removed_in}`;
        case 'dropped':
            return `dropped from ${r.bucket}: ${r.reason}`;
    }
}

function scopesText(s: ScopesAnswer): string[] {
    switch (s.status) {
        case 'supported':
            return [
                `scopes: ${s.scopes.join(', ')}${s.targets.length > 0 ? `; targets: ${s.targets.join(', ')}` : ''}`,
            ];
        case 'no-requirement':
            return ['scopes: no requirement declared'];
        case 'not-documented':
            return ['scopes: not documented'];
        case 'use-areas':
            return [`use areas: ${s.areas.join(', ')}`];
        case 'by-template-tag':
            return s.tags.map(
                (t) =>
                    `use areas of ${t.form}: ${t.useAreas === null ? 'none given' : t.useAreas.join(', ')}`,
            );
        case 'link-forms':
            return s.forms.map(
                (f) =>
                    `link from ${f.scopes.join(', ') || 'any scope'} to ${f.targets.join(', ') || 'no scope given'}`,
            );
        case 'field': {
            const out: string[] = [];
            if (s.measured !== null) {
                out.push(`scopes measured: ${s.measured.scopes.join(', ')}`);
            }
            if (s.info !== null) {
                out.push(
                    `scopes the .info files give: ${s.info.map((i) => i.scope ?? 'no named scope').join(', ')}`,
                );
            }
            if (s.recordRoot !== null) {
                out.push(`the record's root scope: ${s.recordRoot}`);
            }
            return out;
        }
        case 'not-applicable':
            return [];
    }
}

function localizationText(l: LocalizationAnswer): string[] {
    if (l.status !== 'read') {
        return [];
    }
    return l.keys.flatMap((k) => [
        `localization key ${k.key}${k.texts.length === 0 ? ': no text' : ''}`,
        ...k.texts.map(
            (t) =>
                `  ${t.language}: ${t.text === null ? '(not read)' : JSON.stringify(t.text)}, ${place(t)}${t.inForce === 'yes' ? ', in force' : t.inForce === 'not-known' ? ', in force not known' : ''}`,
        ),
    ]);
}

function readingText(r: Reading): string[] {
    const lines = [heading(r)];
    const detail: string[] = [];
    if (r.description.status === 'known') {
        for (const t of r.description.texts) {
            detail.push(`${JSON.stringify(t.text)} (${t.sources.join(', ')})`);
        }
    }
    detail.push(...scopesText(r.scopes));
    if (r.takes.status === 'known') {
        detail.push(`takes: ${r.takes.forms.join(', ')}`);
    }
    if (r.since.status === 'known') {
        detail.push(`since ${r.since.since}`);
    }
    for (const removed of r.retired) {
        const by =
            removed.replacement === null || removed.replacement.length === 0
                ? ''
                : `; replaced by ${removed.replacement.join(', ')}`;
        detail.push(`removed in ${removed.removed_in}${by}`);
    }
    if (r.derivedOnly === true) {
        detail.push("derived only: the game's own output does not document it");
    }
    if (r.kind === 'bucket' && r.modifier !== null) {
        detail.push(...localizationText(r.modifier.localization));
    }
    if (r.kind === 'modifier-template') {
        detail.push(...localizationText(r.localization));
    }
    if (r.kind === 'retired' && r.entry.note !== '') {
        detail.push(r.entry.note);
    }
    return [...lines, ...detail.map((d) => `  ${d}`)];
}

function definitionsText(d: DefinitionsAnswer): string[] {
    if (d.status !== 'read') {
        return [];
    }
    return d.groups.flatMap((g) => {
        const force =
            g.inForce.status === 'winner-not-known'
                ? 'winner not known'
                : g.inForce.status === 'single'
                  ? 'one definition'
                  : 'rule' in g.inForce
                    ? `${g.inForce.status} (${g.inForce.rule})`
                    : g.inForce.status;
        const shared =
            g.inForce.status === 'winner' && g.inForce.shared !== undefined
                ? [
                      `  shared with ${g.inForce.shared.names.join(', ')}${g.inForce.shared.target === null ? '' : `, an alias of ${g.inForce.shared.target}`}; filled by ${place(g.inForce.shared.filledBy)}`,
                  ]
                : [];
        return [
            `defined in ${g.database}${g.container === null ? '' : ` (${g.container})`}: ${force}`,
            ...shared,
            ...g.definitions.map(
                (def) =>
                    `  ${place(def)}${def.inForce === 'yes' ? ', in force' : def.inForce === 'not-known' ? ', in force not known' : ', not in force'}`,
            ),
        ];
    });
}

function usesText(u: UsesAnswer): string[] {
    if (u.status !== 'read') {
        return [];
    }
    const layers = Object.entries(u.byLayer)
        .map(([layer, n]) => `${layer} ${String(n)}`)
        .join(', ');
    const more = u.count > u.first.length ? `; the first ${String(u.first.length)}` : '';
    return [
        `uses: ${String(u.count)}${layers === '' ? '' : ` (${layers})`}${more}`,
        ...u.first.map((use) => `  ${place(use)}`),
    ];
}

/** Whether nothing knows the name: no reading of the package and no definition. */
export function isUnknown(result: LookupResult): boolean {
    const defined = result.definitions.status === 'read' && result.definitions.groups.length > 0;
    return result.unknown && !defined;
}

/** A lookup's answer as text. */
export function lookupText(result: LookupResult): string {
    const lines = [result.name];
    for (const r of result.readings) {
        lines.push(...readingText(r).map((l) => `  ${l}`));
    }
    if (result.unknown) {
        lines.push('  unknown: the spec package has no reading of this name');
    }
    lines.push(...definitionsText(result.definitions).map((l) => `  ${l}`));
    lines.push(...usesText(result.uses).map((l) => `  ${l}`));
    if (result.definitions.status !== 'read') {
        lines.push('  definitions and uses: no game folder and no mod were given');
    }
    if (result.suggestions.status === 'computed' && result.suggestions.suggestions.length > 0) {
        const names = result.suggestions.suggestions.map((s) => `${s.name} (${s.from})`);
        lines.push(`  did you mean: ${names.join(', ')}`);
    }
    return lines.join('\n');
}

function isDirectory(dir: string): boolean {
    return existsSync(dir) && statSync(dir).isDirectory();
}

export const lookupCommand: Command = {
    name: 'lookup',
    args: '<name>...',
    summary:
        'What a name is: its readings in the spec package, and where the game and a mod define and use it',
    options: [
        VANILLA_OPTION,
        NO_VANILLA_OPTION,
        MOD_OPTION,
        SPEC_OPTION,
        JSON_OPTION,
        LANGUAGE_OPTION,
    ],
    positionals: { min: 1, max: null },
    run(parsed: Parsed, io: Io): number {
        const given = oneValue(parsed, '--mod');
        const modDir = given === undefined ? null : path.resolve(io.cwd, given);
        if (modDir !== null && !isDirectory(modDir)) {
            throw new InputError(`--mod: not a folder: ${modDir}`);
        }
        const spec = readSpecOption(parsed, io);
        const game = readGameOption(parsed, io, spec);
        const workspace =
            game.dir === null && modDir === null
                ? null
                : openWorkspace({
                      spec,
                      modDir,
                      gameDir: game.dir,
                      cacheDir: defaultCacheDir(io.env, io.platform, io.home),
                  });
        const listings: SourceListing[] = [];
        if (workspace?.game !== null && workspace?.game !== undefined) {
            listings.push(workspace.game.listing);
        }
        if (workspace?.mod !== null && workspace?.mod !== undefined) {
            listings.push(workspace.mod);
        }
        const json = parsed.flags.has('--json');
        const out: string[] = [];
        let unknown = 0;
        for (const name of parsed.positionals) {
            const result = lookup(name, {
                spec,
                index: workspace?.index ?? null,
                files: game.dir === null ? null : diskFileSource(listings),
                language: oneValue(parsed, '--language') ?? null,
            });
            if (isUnknown(result)) {
                unknown++;
            }
            out.push(json ? JSON.stringify(result) : lookupText(result));
        }
        io.stdout(`${out.join(json ? '\n' : '\n\n')}\n`);
        if (!json && game.notFound) {
            io.stderr(
                'pychivalry: the game was not found in any Steam library and --vanilla was not given: only the spec package and the mod were read\n',
            );
        }
        return unknown > 0 ? EXIT.found : EXIT.ok;
    },
};
