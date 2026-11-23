/**
 * `check`: every finding pychivalry reports on the mod, or on one of its files or folders,
 * from the core's one runner (`checkWorkspace`, the code path of the command line's `check`),
 * so the agent server reports the same findings as every other surface (docs/MVP.md,
 * definition of done 4). Totals by severity and by code come first, always, over every finding
 * in the path; then the findings that meet the minimum severity and the codes, a page at a
 * time; then a cursor for the next page.
 *
 * Each finding carries its fix as the core gives it (`fix`, docs/PLAN.md item 8.6): safe or a
 * suggestion, its alternatives and their edits, with every place written as a span counted from
 * 1, as the tools write places. The server applies nothing (it writes nothing): an agent applies
 * a fix with its own edit tool. A fix's size is bounded in the core (at most five alternatives,
 * each edit only the text it changes), and a page holds as many findings as fit the result's
 * budget, fixes and all, so fixes never push a result over it.
 */

import { checkWorkspace, type Severity, type WorkspaceFinding } from '@pychivalry/core';
import { spanOf, withSpans } from '../places.js';
import { DEFAULT_LIMIT, MAX_LIMIT, page, questionKey, readCursor, valueList } from '../result.js';
import type { Schema } from '../schema.js';
import type { Session } from '../session.js';
import {
    NEXT_CURSOR,
    NOTES,
    pagedInput,
    SPAN_PROPERTIES,
    SPAN_REQUIRED,
    type Tool,
} from '../tool.js';
import { codesOf } from './codes.js';

/** The severities, most severe first. */
export const SEVERITIES: readonly Severity[] = ['error', 'warning', 'information', 'hint'];

export interface CheckArgs {
    readonly path?: string;
    readonly min_severity?: Severity;
    readonly codes?: readonly string[];
    readonly limit?: number;
    readonly cursor?: string;
    readonly unused_keys?: boolean;
}

/** A finding as `check` returns it. */
export function findingOutput(f: WorkspaceFinding): Record<string, unknown> {
    return {
        file: f.file,
        ...spanOf(f.range),
        severity: f.severity,
        code: f.code,
        message: f.message,
        data: f.data,
        fix: f.fix === null ? null : withSpans(f.fix),
    };
}

/** The counts of findings by severity (every severity named) and by code (sorted). */
export function totalsOf(findings: readonly WorkspaceFinding[]): Record<string, unknown> {
    const bySeverity: Record<Severity, number> = { error: 0, warning: 0, information: 0, hint: 0 };
    const byCode = new Map<string, number>();
    for (const f of findings) {
        bySeverity[f.severity]++;
        byCode.set(f.code, (byCode.get(f.code) ?? 0) + 1);
    }
    return {
        by_severity: bySeverity,
        by_code: Object.fromEntries([...byCode].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
    };
}

const COUNT: Schema = { type: 'integer', minimum: 0 };

const EDIT: Schema = {
    type: 'object',
    properties: {
        file: {
            type: 'string',
            description:
                "The file the edit changes, its path inside the mod, with /; it may be another file than the finding's",
        },
        ...SPAN_PROPERTIES,
        new_text: {
            type: 'string',
            description: 'The text that replaces the span; the span is empty for an insertion',
        },
        create: {
            type: 'boolean',
            description:
                'True when the file does not exist yet: the edit creates it with new_text whole (U+FEFF first is the byte-order mark the game needs)',
        },
    },
    required: ['file', ...SPAN_REQUIRED, 'new_text'],
};

const FIX: Schema = {
    type: ['object', 'null'],
    properties: {
        safety: {
            type: 'string',
            enum: ['safe', 'suggestion'],
            description:
                'safe: the only outcome that can be right; apply it as it is. suggestion: choose one alternative, or none',
        },
        basis: {
            type: 'string',
            description:
                'What the fix rests on: retired, nearest-name, scope-links, parser, required-field, localization-files, game-message, observed-values, range or declared-names',
        },
        alternatives: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    edits: { type: 'array', items: EDIT },
                },
                required: ['title', 'edits'],
            },
            description: 'At most five; exactly one when the fix is safe',
        },
        alternatives_total: {
            ...COUNT,
            description: 'How many alternatives there are in all, when more than are listed',
        },
    },
    required: ['safety', 'basis', 'alternatives'],
    description:
        "The finding's mechanical fix, or null when it has none. The server applies nothing: apply the edits with your own edit tool, every edit of the alternative, each against the file as it was",
};

const FINDING: Schema = {
    type: 'object',
    properties: {
        file: { type: 'string', description: "The file's path inside the mod, with /" },
        ...SPAN_PROPERTIES,
        severity: { type: 'string', enum: SEVERITIES },
        code: { type: 'string', description: 'The code; explain_code says what it means' },
        message: { type: 'string', description: "The game's own message, or pychivalry's advice" },
        data: {
            type: 'object',
            additionalProperties: { type: ['string', 'array'], items: { type: 'string' } },
            description: 'The names and values the finding is about',
        },
        fix: FIX,
    },
    required: ['file', ...SPAN_REQUIRED, 'severity', 'code', 'message', 'data', 'fix'],
};

export const checkTool: Tool<CheckArgs> = {
    name: 'check',
    title: 'Check the mod',
    description: [
        "Check the mod, or one of its files or folders, the way the game reads it: every error and warning has the game's own evidence; information and hints are advice.",
        'Returns the totals by severity and by code first, always, over every finding in the path; then the findings at or above min_severity (default error), in file order, at most limit of them; then next_cursor for the next page.',
        'A finding with a mechanical fix carries it: safe (apply it as it is) or a suggestion (alternatives to choose from); the server writes nothing, so apply its edits with your own edit tool.',
        'Reads the files as they are now: check again after an edit. explain_code says what a code means.',
    ].join(' '),
    input: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description:
                    "A file or folder of the mod, relative to the mod's folder (events/my_events.txt, common/scripted_effects); the whole mod when left out",
            },
            min_severity: {
                type: 'string',
                enum: SEVERITIES,
                default: 'error',
                description:
                    'The least severe findings to list: error lists errors only, hint lists everything. The totals count every severity',
            },
            codes: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                minItems: 1,
                description:
                    'List only findings of these codes: a code (names/unknown-trigger), a family (names/*) or *',
            },
            ...pagedInput('findings', DEFAULT_LIMIT, MAX_LIMIT),
            unused_keys: {
                type: 'boolean',
                default: false,
                description:
                    'Also run localization/unused-key, which is off by default: a hint for each localization key nothing uses',
            },
        },
        additionalProperties: false,
    },
    output: {
        type: 'object',
        properties: {
            files_checked: { ...COUNT, description: 'The script and localization files checked' },
            totals: {
                type: 'object',
                properties: {
                    by_severity: {
                        type: 'object',
                        properties: Object.fromEntries(SEVERITIES.map((s) => [s, COUNT])),
                        required: [...SEVERITIES],
                    },
                    by_code: { type: 'object', additionalProperties: COUNT },
                },
                required: ['by_severity', 'by_code'],
                description: 'Every finding in the path, whatever min_severity and codes keep',
            },
            matched: { ...COUNT, description: 'The findings min_severity and codes keep' },
            findings: { type: 'array', items: FINDING },
            next_cursor: NEXT_CURSOR,
            capped: {
                type: 'object',
                properties: {
                    max_per_file: COUNT,
                    files: { ...COUNT, description: 'Files that had more findings than that' },
                    dropped: { ...COUNT, description: 'Their findings left out, the least severe' },
                },
                required: ['max_per_file', 'files', 'dropped'],
            },
            game: {
                type: ['object', 'null'],
                properties: {
                    build: { type: ['string', 'null'] },
                    from_cache: {
                        type: 'boolean',
                        description: "True when the base game's index was loaded from the cache",
                    },
                },
                required: ['build', 'from_cache'],
                description: 'The base game read, or null without one',
            },
            notes: NOTES,
        },
        required: [
            'files_checked',
            'totals',
            'matched',
            'findings',
            'next_cursor',
            'capped',
            'game',
            'notes',
        ],
    },
    run(args: CheckArgs, session: Session): Record<string, unknown> {
        const minSeverity = args.min_severity ?? 'error';
        const codes = args.codes === undefined ? null : codesOf(args.codes, 'codes');
        const target = args.path === undefined ? null : session.modPath(args.path, 'path');
        const unusedKeys = args.unused_keys ?? false;
        const key = questionKey('check', {
            path: target?.relative ?? '',
            min_severity: minSeverity,
            codes: codes === null ? null : [...codes].sort(),
            unused_keys: unusedKeys,
        });
        const offset = readCursor(args.cursor, key);
        const workspace = session.workspace();
        const only =
            target === null || target.relative === ''
                ? undefined
                : target.kind === 'file'
                  ? (file: string) => file === target.relative
                  : (file: string) => file.startsWith(`${target.relative}/`);
        // The next page of the same check, on an unchanged mod, does not check again.
        const run = session.remember(
            'check',
            JSON.stringify([target?.relative ?? '', unusedKeys]),
            () =>
                checkWorkspace({
                    spec: session.spec,
                    modDir: session.modDir,
                    gameDir: session.game.dir,
                    cacheDir: session.cacheDir,
                    workspace,
                    unusedKeys,
                    only,
                }),
        );
        const rank = SEVERITIES.indexOf(minSeverity);
        const matched = run.findings.filter(
            (f) => SEVERITIES.indexOf(f.severity) <= rank && (codes === null || codes.has(f.code)),
        );
        const notes = session.notes();
        if (run.files.length === 0 && target !== null) {
            notes.push(
                `${args.path ?? ''} holds no file the game reads as script or localization: nothing was checked`,
            );
        }
        const notChecked = [...run.notChecked].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
        if (notChecked.length > 0 && target === null) {
            const total = notChecked.reduce((n, [, count]) => n + count, 0);
            notes.push(
                `${String(total)} files in folders the game does not read as script were not checked: ${valueList(
                    notChecked.map(([folder, count]) => `${folder} (${String(count)})`),
                    600,
                )}`,
            );
        }
        const game = run.game;
        const base = {
            files_checked: run.files.length,
            totals: totalsOf(run.findings),
            matched: matched.length,
        };
        const tail = {
            capped: {
                max_per_file: run.maxFindingsPerFile,
                files: run.capped.length,
                dropped: run.capped.reduce((n, c) => n + c.dropped, 0),
            },
            game: game === null ? null : { build: run.gameBuild, from_cache: game.fromCache },
            notes,
        };
        return page(matched, offset, args.limit ?? DEFAULT_LIMIT, key, (taken, nextCursor) => ({
            ...base,
            findings: taken.map(findingOutput),
            next_cursor: nextCursor,
            ...tail,
        }));
    },
};
