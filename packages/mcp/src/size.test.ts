/**
 * Result size (docs/PLAN.md item 6.3): every tool's result stays under about 10,000 tokens.
 *
 * A result is measured as the client receives it, its JSON whole: the text and the structured
 * output, which hold the same JSON. It must be at most `MAX_RESULT_CHARACTERS`, which is 10,000
 * tokens at three characters a token, JSON's usual rate (prose runs nearer four). Claude Code
 * cuts a tool's result off at 25,000 tokens.
 *
 * Two runs measure every tool, each with the calls that give its longest results: a mod written
 * here with thousands of findings, definitions and uses, in CI; and the largest test mod, rice,
 * about 140,000 findings with unused keys on, over the real base game, as a local game-file
 * test that runs only where `CK3_GAME_PATH` and `CK3_CORPUS` are set. That one loads the base
 * game's index from the user's own cache folder, as the command line saves it; its check
 * totals must equal the rice record of `task game:mods`.
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import {
    connect,
    gameStub,
    MAX_RESULT_CHARACTERS,
    REPO_ROOT,
    resultSize,
    scratch,
    write,
    type Connection,
    type ToolResult,
} from './testing.js';

type Call = readonly [string, Record<string, unknown>];

/** Every page of a paged call, following its cursor, up to `pages` pages. */
async function pagesOf(s: Connection, [tool, args]: Call, pages: number): Promise<ToolResult[]> {
    const out: ToolResult[] = [];
    let cursor: unknown = undefined;
    do {
        const result = await s.call(tool, cursor === undefined ? args : { ...args, cursor });
        out.push(result);
        cursor =
            result.isError === true ? null : (result.structuredContent?.['next_cursor'] ?? null);
    } while (cursor !== null && out.length < pages);
    return out;
}

/** Each call's results measured: every page under the limit; the largest of each tool reported. */
async function measure(
    t: TestContext,
    s: Connection,
    calls: readonly Call[],
    pages = 3,
): Promise<Map<string, number>> {
    const largest = new Map<string, number>();
    for (const call of calls) {
        for (const result of await pagesOf(s, call, pages)) {
            const size = resultSize(result);
            assert.ok(
                size <= MAX_RESULT_CHARACTERS,
                `${call[0]} ${JSON.stringify(call[1])}: ${String(size)} characters`,
            );
            largest.set(call[0], Math.max(largest.get(call[0]) ?? 0, size));
        }
    }
    for (const [tool, size] of largest) {
        t.diagnostic(
            `${tool}: largest result ${String(size)} characters, about ${String(Math.ceil(size / 3))} tokens at three characters a token`,
        );
    }
    return largest;
}

const TOOLS = [
    'check',
    'lookup',
    'find_definition',
    'find_references',
    'list_definitions',
    'source',
    'explain_code',
    'format',
];

/** A mod with thousands of findings, definitions and uses, and long names. */
function bigMod(dir: string): string {
    const mod = path.join(dir, 'big');
    write(path.join(mod, 'descriptor.mod'), 'name = "Big"\n');
    for (let i = 0; i < 40; i++) {
        const triggers: string[] = [];
        for (let j = 0; j < 100; j++) {
            triggers.push(
                `big_trigger_${String(i)}_${String(j)} = {\n\tmade_up_trigger_with_a_rather_long_name_${String(i)}_${String(j)} = yes\n}`,
            );
        }
        write(
            path.join(mod, 'common', 'scripted_triggers', `big_${String(i)}.txt`),
            `${triggers.join('\n')}\n`,
        );
    }
    // One name defined in 100 files: more definitions than fit in one result. (The core's
    // check slows sharply past that: 300 files take it seven seconds.)
    for (let i = 0; i < 100; i++) {
        write(
            path.join(mod, 'common', 'scripted_triggers', `many_${String(i).padStart(3, '0')}.txt`),
            'shared_trigger = { always = yes }\n',
        );
    }
    const events = ['namespace = big', 'big.1 = {', '\ttype = character_event', '\ttrigger = {'];
    for (let i = 0; i < 3000; i++) {
        events.push('\t\tshared_trigger = yes');
    }
    events.push('\t}', '}');
    write(path.join(mod, 'events', 'big_events.txt'), `${events.join('\n')}\n`);
    const keys = ['﻿l_english:'];
    for (let i = 0; i < 3000; i++) {
        keys.push(` big_unused_localization_key_${String(i)}:0 "Some text for key ${String(i)}"`);
    }
    write(path.join(mod, 'localization', 'english', 'big_l_english.yml'), `${keys.join('\n')}\n`);
    return mod;
}

function calls(
    names: readonly string[],
    defined: string,
    used: string,
    kind: string,
    formatFile: string,
): Call[] {
    return [
        ['check', {}],
        ['check', { min_severity: 'hint', limit: 200 }],
        ['check', { min_severity: 'hint', limit: 200, unused_keys: true }],
        ['check', { min_severity: 'hint', limit: 200, codes: ['*'], unused_keys: true }],
        ['check', { codes: ['no/such-code'] }],
        ['lookup', { names }],
        // One name's evidence (tool schema version 5): a field of many folders, the name most
        // defined, and the first name asked.
        ['lookup', { names: ['effect'], evidence: true }],
        ['lookup', { names: [defined], evidence: true }],
        ['lookup', { names: names.slice(0, 1), evidence: true }],
        ['find_definition', { name: defined }],
        ['find_references', { name: used, limit: 200 }],
        ['list_definitions', { kind, limit: 200 }],
        ['list_definitions', { kind: 'localization:l_english', limit: 200 }],
        ['list_definitions', { kind: 'no_such_kind' }],
        ['source', { layer: 'mod', file: formatFile, line: 1, context: 20 }],
        ['source', { layer: 'mod', file: formatFile, line: 1, end_line: 1_000 }],
        ['explain_code', { codes: ['*'] }],
        ['format', { file: formatFile }],
    ];
}

const BIG_NAMES = [
    'trait',
    'character',
    'root',
    'monthly_prestige',
    'add_trait',
    'is_adult',
    'opinion',
    'culture',
    'faith',
    'title',
    'shared_trigger',
    'big_trigger_0_0',
    'any_vassal',
    'every_vassal',
    'scope',
    'prestige',
    'gold',
    'age',
    'health',
    'religion',
];

test('every tool on a mod of thousands of findings stays under the limit', async (t) => {
    const dir = scratch(t);
    const mod = bigMod(dir);
    // A base game of one file: the unused-key check needs a base game to speak at all.
    const game = gameStub(path.join(dir, 'install'), {
        'localization/english/base_l_english.yml': '\ufeffl_english:\n base_key:0 "Base"\n',
    });
    const s = await connect(t, ['--mod', mod, '--vanilla', game], path.join(dir, 'cache'));
    const largest = await measure(
        t,
        s,
        calls(
            BIG_NAMES,
            'shared_trigger',
            'shared_trigger',
            'common/scripted_triggers',
            'common/scripted_triggers/big_0.txt',
        ),
    );
    assert.deepEqual([...largest.keys()].sort(), [...TOOLS].sort(), 'every tool measured');
    const checked = await s.output('check', { min_severity: 'hint', unused_keys: true });
    const bySeverity = (checked['totals'] as { by_severity: Record<string, number> }).by_severity;
    assert.ok((bySeverity['error'] ?? 0) >= 4000, 'thousands of errors');
    assert.ok((bySeverity['hint'] ?? 0) >= 1000, 'and of hints');
});

/** The largest file of a mod's `common/scripted_effects/`, by its path inside the mod. */
function largestEffectsFile(mod: string): string {
    const dir = path.join(mod, 'common', 'scripted_effects');
    const files = readdirSync(dir).filter((f) => f.endsWith('.txt'));
    files.sort((a, b) => statSync(path.join(dir, b)).size - statSync(path.join(dir, a)).size);
    return `common/scripted_effects/${files[0] ?? ''}`;
}

interface ModRecord {
    readonly slug: string;
    readonly by_severity: Record<string, number>;
    readonly by_code: readonly { readonly code: string; readonly count: number }[];
}

test('every tool on rice, the largest test mod, over the real game, stays under the limit (local: CK3_GAME_PATH, CK3_CORPUS)', async (t) => {
    const gameDir = process.env['CK3_GAME_PATH'];
    const corpus = process.env['CK3_CORPUS'];
    const mod = corpus === undefined ? '' : path.join(corpus, 'rice');
    if (gameDir === undefined || corpus === undefined || !existsSync(mod)) {
        t.skip(
            'needs the game and the test mods: CK3_GAME_PATH and CK3_CORPUS (a local game-file test)',
        );
        return;
    }
    const s = await connect(t, ['--mod', mod, '--vanilla', gameDir], null);
    // Names of rice's own: the first of its scripted effects, and the first trait it defines.
    const effects = await s.output('list_definitions', {
        kind: 'common/scripted_effects',
        limit: 1,
    });
    const effect = (effects['definitions'] as { name: string }[])[0]?.name ?? 'add_trait';
    const largest = await measure(
        t,
        s,
        calls(
            [...BIG_NAMES.slice(0, 19), effect],
            effect,
            'is_ai',
            'common/scripted_effects',
            largestEffectsFile(mod),
        ),
    );
    assert.deepEqual([...largest.keys()].sort(), [...TOOLS].sort(), 'every tool measured');
    // The same findings as the real-mod suite's record: totals by severity and by code.
    const record = (
        JSON.parse(readFileSync(path.join(REPO_ROOT, 'records', 'game', 'mods.json'), 'utf8')) as {
            results: { mods: ModRecord[] };
        }
    ).results.mods.find((m) => m.slug === 'rice');
    assert.ok(record !== undefined);
    const checked = await s.output('check', {});
    const totals = checked['totals'] as {
        by_severity: Record<string, number>;
        by_code: Record<string, number>;
    };
    assert.deepEqual(totals.by_severity, record.by_severity);
    const byCode: Record<string, number> = {};
    for (const row of record.by_code) {
        byCode[row.code] = (byCode[row.code] ?? 0) + row.count;
    }
    assert.deepEqual(
        totals.by_code,
        Object.fromEntries(Object.entries(byCode).sort(([a], [b]) => (a < b ? -1 : 1))),
    );
    const all = await s.output('check', { min_severity: 'hint', unused_keys: true, limit: 1 });
    const hints =
        (all['totals'] as { by_severity: Record<string, number> }).by_severity['hint'] ?? 0;
    t.diagnostic(
        `rice: ${String(all['matched'])} findings with unused keys on, ${String(hints)} of them hints`,
    );
    assert.ok(hints > 100_000, 'unused keys on: the largest check there is');
});
