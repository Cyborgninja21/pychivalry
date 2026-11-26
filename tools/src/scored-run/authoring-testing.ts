/**
 * What the authoring test's tests share: the requests' example results and the expert requests'
 * first drafts, the checker over an empty base game, a skills folder standing in for `skills/`,
 * and streams in the shape Claude Code 2.1.330 writes for an authoring session and for a judge's
 * session, for the stand-in (`fake-claude.ts`) to play back. Not a test file itself, so that
 * importing it runs no test.
 */

import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { TestContext } from 'node:test';
import { checkWorkspace, openSpec, type WorkspaceCheck } from '@pychivalry/core';
import { fixtureGame, tempDir, writeTree } from '../testing.js';
import { repoRoot } from '../util.js';
import { AUTHORING_TOOLS } from './authoring.js';
import type { JudgeAnswer } from './judge.js';
import { baseDir, REQUESTS_DIR, type ContentRequest } from './requests.js';
import { PINNED_MODEL, SERVER_TOOLS } from './run.js';

export const root = repoRoot();
export const spec = openSpec(path.join(root, 'spec'));

/** A request's example result: what a correct session could leave, for the tests only. */
export function exampleDir(id: string): string {
    return path.join(root, ...REQUESTS_DIR.split('/'), 'examples', id);
}

/** The expert requests' first drafts: each a result with the mistake its request invites. */
export const DRAFTS_DIR = 'fixtures/requests/drafts';

/** One first draft, and what fails it on the code-checked side (`drafts/drafts.json`). */
export interface Draft {
    /** The request's id, and the draft's folder under `DRAFTS_DIR`. */
    readonly request: string;
    /** The mistake, in words. */
    readonly mistake: string;
    /** Every error and warning the checker reports on it, as `<severity> <code>`. */
    readonly checker: readonly string[];
    /** Every expectation it does not meet, as `<expectation>: <problem>`. */
    readonly unmet: readonly string[];
}

/** The committed drafts and what fails each, read from `drafts/drafts.json`. */
export function committedDrafts(): { readonly about: string; readonly drafts: readonly Draft[] } {
    const value = JSON.parse(
        readFileSync(path.join(root, ...DRAFTS_DIR.split('/'), 'drafts.json'), 'utf8'),
    ) as { drafts_format?: unknown; about?: unknown; drafts?: unknown };
    const texts = (x: unknown): boolean =>
        Array.isArray(x) && x.every((y) => typeof y === 'string');
    if (
        value.drafts_format !== 1 ||
        typeof value.about !== 'string' ||
        !Array.isArray(value.drafts) ||
        !value.drafts.every(
            (d: Record<string, unknown>) =>
                typeof d['request'] === 'string' &&
                typeof d['mistake'] === 'string' &&
                texts(d['checker']) &&
                texts(d['unmet']) &&
                Object.keys(d).length === 4,
        )
    ) {
        throw new Error(`${DRAFTS_DIR}/drafts.json is not a list of drafts`);
    }
    return { about: value.about, drafts: value.drafts as Draft[] };
}

/** A trial's mod as a correct session leaves it: the base, with the example written over it. */
export function exampleResult(t: TestContext, request: ContentRequest): string {
    const mod = path.join(tempDir(t), 'mod');
    cpSync(baseDir(root, request.base), mod, { recursive: true });
    cpSync(exampleDir(request.id), mod, { recursive: true });
    return mod;
}

/**
 * A game stub in a temporary folder: a launcher's settings and an almost empty `game`, with the one
 * texture the content requests' decisions show (`picture`), a file of the real base game too, so
 * that `graphics/missing-file` finds it as it does over the installed game.
 */
export function emptyGame(t: TestContext): string {
    const root = tempDir(t);
    const game = fixtureGame(root);
    writeTree(root, {
        'game/gfx/interface/illustrations/decisions/decision_misc.dds': new Uint8Array([
            0, 1, 2, 3,
        ]),
    });
    return game;
}

/** The checker on a mod over an empty base game, as grade one runs it (with its defaults). */
export function checkOver(t: TestContext, mod: string): WorkspaceCheck {
    return checkWorkspace({ spec, gameDir: emptyGame(t), cacheDir: null, modDir: mod });
}

/** The name the stand-in skills folder's one skill gives itself. */
export const SKILL_NAME = 'pychivalry-write-content';

/** A skills folder standing in for `skills/`: one skill, and a folder that is not one. */
export function skillsFolder(t: TestContext): string {
    const dir = path.join(tempDir(t), 'skills');
    writeTree(dir, {
        'write-content/SKILL.md': `---\nname: ${SKILL_NAME}\ndescription: Write new content for a Crusader Kings III mod.\n---\n\nLook names up, write, check, repair.\n`,
        'notes/README.md': 'Not a skill: no SKILL.md.\n',
    });
    return dir;
}

const ids = { session_id: '<session id>', uuid: '<uuid>' };

function assistant(content: unknown): unknown {
    return {
        type: 'assistant',
        message: { model: PINNED_MODEL, role: 'assistant', type: 'message', content: [content] },
        parent_tool_use_id: null,
        ...ids,
    };
}

function toolResult(id: string, content: string, isError: boolean): unknown {
    return {
        type: 'user',
        message: {
            role: 'user',
            content: [
                {
                    tool_use_id: id,
                    type: 'tool_result',
                    content,
                    ...(isError ? { is_error: true } : {}),
                },
            ],
        },
        ...ids,
    };
}

function end(subtype: string, result: string): unknown {
    return {
        type: 'result',
        subtype,
        is_error: subtype !== 'success',
        terminal_reason: subtype === 'success' ? 'completed' : null,
        api_error_status: null,
        num_turns: 4,
        duration_ms: 2345,
        permission_denials: [],
        result,
        ...ids,
    };
}

function init(options: {
    readonly tools: readonly string[];
    readonly servers: readonly { name: string; status: string }[];
    readonly skills: readonly string[];
}): unknown {
    return {
        type: 'system',
        subtype: 'init',
        cwd: '/somewhere/private',
        ...ids,
        tools: options.tools,
        mcp_servers: options.servers,
        model: PINNED_MODEL,
        permissionMode: 'dontAsk',
        claude_code_version: '2.1.330',
        skills: options.skills,
        plugins: [
            { name: 'cc-plugin-telemetry', path: 'builtin', source: 'cc-plugin-telemetry@builtin' },
        ],
    };
}

function lines(events: readonly unknown[]): string {
    return `${events.map((e) => JSON.stringify(e)).join('\n')}\n`;
}

/**
 * An authoring session's stream: offered the authoring tools, the server's tools, the stand-in
 * skill and one skill of Claude Code's own; a `Skill` call, a `check`, a `Write` of each of
 * `files` and a `Read` of `read` (the first of `files` unless given; inside the trial's folder
 * unless a test says otherwise), which fails as a file that does not exist, and its end.
 */
export function authoringStream(
    options: {
        readonly tools?: readonly string[];
        readonly skills?: readonly string[];
        readonly files?: readonly string[];
        readonly read?: string;
        readonly subtype?: string;
    } = {},
): string {
    const files = options.files ?? ['events/authoring_events.txt'];
    return lines([
        init({
            tools: options.tools ?? [
                ...AUTHORING_TOOLS,
                ...SERVER_TOOLS.map((n) => `mcp__pychivalry__${n}`),
            ],
            servers: [{ name: 'pychivalry', status: 'connected' }],
            skills: options.skills ?? [SKILL_NAME, 'simplify'],
        }),
        assistant({ type: 'tool_use', id: 'c1', name: 'Skill', input: { skill: SKILL_NAME } }),
        toolResult('c1', 'Loaded.', false),
        assistant({ type: 'tool_use', id: 'c2', name: 'mcp__pychivalry__check', input: {} }),
        toolResult('c2', '{"totals":{}}', false),
        ...files.flatMap((file, i) => [
            assistant({
                type: 'tool_use',
                id: `w${String(i)}`,
                name: 'Write',
                input: { file_path: file, content: 'x' },
            }),
            toolResult(`w${String(i)}`, 'Written.', false),
        ]),
        assistant({
            type: 'tool_use',
            id: 'r1',
            name: 'Read',
            input: { file_path: options.read ?? files[0] ?? 'x' },
        }),
        toolResult('r1', 'File does not exist: /somewhere/private/x', true),
        assistant({ type: 'text', text: 'Done.' }),
        end(options.subtype ?? 'success', 'Done.'),
    ]);
}

/**
 * A judge's session's stream: offered nothing, ending with `answer` as its last words. In an
 * answer, `{{request}}` is the request's id, which the stand-in fills in from its prompt.
 */
export function judgeStream(
    answer: string,
    options: { readonly tools?: readonly string[] } = {},
): string {
    return lines([
        init({ tools: options.tools ?? [], servers: [], skills: [] }),
        assistant({ type: 'text', text: answer }),
        end('success', answer),
    ]);
}

/** A judge's answer to every question of a request, each `answer`. */
export function judgeAnswer(
    request: ContentRequest,
    answer: JudgeAnswer | readonly JudgeAnswer[],
): string {
    const answers = request.judged.map(
        (q, i): [string, { answer: JudgeAnswer; reason: string }] => [
            q.dimension,
            {
                answer: typeof answer === 'string' ? answer : (answer[i] ?? 'yes'),
                reason: 'Because the files say so.',
            },
        ],
    );
    return JSON.stringify({ request: '{{request}}', answers: Object.fromEntries(answers) });
}

/** Write a text into a temporary file and give its path. */
export function textFile(t: TestContext, name: string, text: string): string {
    const file = path.join(tempDir(t), name);
    writeFileSync(file, text);
    return file;
}
