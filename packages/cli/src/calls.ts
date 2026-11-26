/**
 * `calls <name>...`: the call graph of each name (docs/PLAN.md items 10.6 and 10.7): where it is
 * defined, what calls it and what it calls, as text for a person or as one JSON object per name,
 * the core's `CallAnswer` as it is. The core reads it from the spec package and the workspace
 * index (`CallGraph`, docs/call-graph.md): an event triggering an event, a scripted effect or
 * trigger called by name, an on-action firing an event or another on-action, a decision firing
 * an event, and every other link the package marks as a call.
 *
 * The base game is found as `lookup` finds it (`--vanilla`, `--no-vanilla`, or Steam's libraries)
 * and loaded from the same on-disk cache; `--mod` indexes a mod over it. `--callers` gives only
 * what calls each name, `--callees` only what it calls.
 *
 * Exit codes: 0 when every name is defined or called somewhere; 1 when one is neither; 2 on bad
 * usage.
 */

import {
    CallGraph,
    defaultCacheDir,
    diskFileSource,
    drain,
    linkKind,
    openWorkspaceSteps,
    type CallAnswer,
    type CallLink,
    type SourceListing,
    type Steps,
} from '@pychivalry/core';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { InputError, oneValue, UsageError, type OptionSpec, type Parsed } from './args.js';
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
    help: 'a mod folder, indexed over the base game, so that its calls are read too',
};
const CALLERS_OPTION: OptionSpec = {
    name: '--callers',
    help: 'only what calls each name',
};
const CALLEES_OPTION: OptionSpec = {
    name: '--callees',
    help: 'only what each name calls',
};

/** Where a place is: `<layer> <file>:<line>:<column>`, both counted from 1. */
function place(p: {
    readonly layer: string;
    readonly file: string;
    readonly range: { readonly start: { readonly line: number; readonly character: number } };
}): string {
    return `${p.layer} ${p.file}:${String(p.range.start.line + 1)}:${String(p.range.start.character + 1)}`;
}

/** What makes a link a call, in a few words. */
function basisText(link: CallLink): string {
    return link.basis.kind === 'callable'
        ? 'called by name'
        : `${link.basis.row}, ${link.basis.status}`;
}

/** A call graph's answer for one name, as text. */
export function callsText(
    answer: CallAnswer,
    which: { callers: boolean; callees: boolean },
): string {
    const lines = [answer.name];
    if (answer.definitions.length === 0) {
        lines.push('  defined nowhere in the mod or the base game as script');
    }
    for (const d of answer.definitions) {
        lines.push(`  defined in ${d.database}: ${place(d)}`);
    }
    if (which.callers) {
        lines.push(`  called by ${String(answer.callers.length)}`);
        for (const l of answer.callers) {
            lines.push(
                `    ${l.from.database} ${l.from.name} (${linkKind(l)}), ${l.via}: ${place(l.at)}; ${basisText(l)}`,
            );
        }
    }
    if (which.callees) {
        lines.push(`  calls ${String(answer.callees.length)}`);
        for (const l of answer.callees) {
            const defined = l.to.defined ? '' : ', defined nowhere';
            lines.push(
                `    ${l.to.database} ${l.to.name}${defined} (${linkKind(l)}), ${l.via}: ${place(l.at)}; ${basisText(l)}`,
            );
        }
    }
    return lines.join('\n');
}

function isDirectory(dir: string): boolean {
    return existsSync(dir) && statSync(dir).isDirectory();
}

export const callsCommand: Command = {
    name: 'calls',
    args: '<name>...',
    summary:
        'The call graph of a name: where it is defined, what calls it and what it calls, in the mod and the base game',
    options: [
        CALLERS_OPTION,
        CALLEES_OPTION,
        VANILLA_OPTION,
        NO_VANILLA_OPTION,
        MOD_OPTION,
        SPEC_OPTION,
        JSON_OPTION,
    ],
    positionals: { min: 1, max: null },
    run: (parsed: Parsed, io: Io): number => drain(callsSteps(parsed, io)),
    steps: callsSteps,
};

/** `calls`, in steps: a pause after each file of the mod indexed. */
function* callsSteps(parsed: Parsed, io: Io): Steps<number> {
    const onlyCallers = parsed.flags.has('--callers');
    const onlyCallees = parsed.flags.has('--callees');
    if (onlyCallers && onlyCallees) {
        throw new UsageError(
            '--callers and --callees cannot both be given: leave both out for both',
        );
    }
    const which = { callers: !onlyCallees, callees: !onlyCallers };
    const given = oneValue(parsed, '--mod');
    const modDir = given === undefined ? null : path.resolve(io.cwd, given);
    if (modDir !== null && !isDirectory(modDir)) {
        throw new InputError(`--mod: not a folder: ${modDir}`);
    }
    const spec = readSpecOption(parsed, io);
    const game = readGameOption(parsed, io, spec);
    if (game.dir === null && modDir === null) {
        throw new InputError(
            game.notFound
                ? 'the game was not found in any Steam library: give its game folder with --vanilla <game>, or a mod with --mod <mod>'
                : 'nothing to read: give a mod with --mod <mod>, or leave out --no-vanilla',
        );
    }
    const workspace = yield* openWorkspaceSteps({
        spec,
        modDir,
        gameDir: game.dir,
        cacheDir: defaultCacheDir(io.env, io.platform, io.home),
        base: io.base,
    });
    const listings: SourceListing[] = [];
    if (workspace.game !== null) {
        listings.push(workspace.game.listing);
    }
    if (workspace.mod !== null) {
        listings.push(workspace.mod);
    }
    const graph = new CallGraph({ spec, index: workspace.index, files: diskFileSource(listings) });
    const json = parsed.flags.has('--json');
    const out: string[] = [];
    let unknown = 0;
    for (const name of parsed.positionals) {
        const full = graph.answer(name);
        if (full.definitions.length === 0 && full.callers.length === 0) {
            unknown++;
        }
        const answer: CallAnswer = {
            ...full,
            callers: which.callers ? full.callers : [],
            callees: which.callees ? full.callees : [],
        };
        out.push(json ? JSON.stringify(answer) : callsText(answer, which));
    }
    io.stdout(`${out.join(json ? '\n' : '\n\n')}\n`);
    if (!json && game.notFound) {
        io.stderr(
            'pychivalry: the game was not found in any Steam library and --vanilla was not given: only the mod was read\n',
        );
    }
    return unknown > 0 ? EXIT.found : EXIT.ok;
}
