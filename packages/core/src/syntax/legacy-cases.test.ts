/**
 * The 74 parser cases of release 2.3.0, carried over as table fixtures (docs/PLAN.md item
 * 2.9): 55 from `legacy/packages/engine/test/unit/parser.test.ts` and 19 from
 * `legacy/packages/engine/test/unit/syntax-gaps.test.ts`. Each row keeps the 2.3.0 test's
 * name and input and states what it asserted, in terms of the new tree. Where the new
 * parser deliberately reads something differently, the row says so:
 *
 * - `yes` and `no` are names. 2.3.0 turned them into booleans while parsing; the parser is
 *   syntax only, and what a value means is decided from the spec.
 * - Numbers keep their text (`-5`, `0.75`); their type says they are numbers.
 * - A scope chain is split into segments, but its head is not classified by name (2.3.0
 *   knew `scope:`, `var:`, `flag:` and the rest from a list in its code).
 * - A finding with no catalogue message is information, not an error (principle 1 of
 *   docs/MVP.md); 2.3.0 called these two `PYCH-P001` and `PYCH-P002`.
 * - `count $OPERATOR$ $COUNT$` is a pair only in a block that also holds pairs; alone, as in
 *   case 74, it is three values. Both read without findings, which is what the case asserted.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readArithmetic, type Arithmetic } from './arithmetic.js';
import { findingMessage, type FindingId } from './findings.js';
import { tokenize } from './lexer.js';
import { parse, type ParseResult } from './parser.js';
import { committedCatalogue, summary } from './testing.js';
import {
    blockOf,
    blockShape,
    fileConstants,
    type Block,
    type Item,
    type Scalar,
    type ScalarType,
} from './tree.js';

interface Case {
    readonly from: 'parser.test.ts' | 'syntax-gaps.test.ts';
    /** The 2.3.0 test's name. */
    readonly name: string;
    readonly text: string;
    /** Parsed first, to show that a parse leaves nothing behind for the next. */
    readonly before?: { readonly text: string; readonly tree: string };
    readonly tree?: string;
    /** Finding ids in order, or id, line and character of where each starts. */
    readonly findings?: readonly (FindingId | readonly [FindingId, number, number])[];
    /** Each finding's message, with the committed catalogue, for a file `events/x.txt`. */
    readonly messages?: readonly string[];
    /** The type of every scalar, in source order. */
    readonly types?: readonly ScalarType[];
    /** The value of every scalar, in source order. */
    readonly values?: readonly string[];
    /** The shape of every block, in source order. */
    readonly shapes?: readonly ('empty' | 'list' | 'statements')[];
    /** The tag of every tagged value, in source order. */
    readonly tags?: readonly string[];
    /** Where each top-level item that is not a comment starts: line, character. */
    readonly starts?: readonly (readonly [number, number])[];
    readonly bom?: boolean;
    readonly constants?: readonly string[];
    /** The expression of the first `@[ ... ]`. */
    readonly expression?: Arithmetic;
    /** Anything else the 2.3.0 test asserted. */
    readonly extra?: (result: ParseResult) => void;
}

function scalars(items: readonly Item[]): Scalar[] {
    const out: Scalar[] = [];
    const visit = (list: readonly Item[]): void => {
        for (const item of list) {
            if (item.kind === 'scalar') {
                out.push(item);
            } else if (item.kind === 'block') {
                visit(item.items);
            } else if (item.kind === 'pair') {
                if (item.prefix !== null) {
                    out.push(item.prefix);
                }
                out.push(item.key);
                const value = item.value;
                if (value?.kind === 'scalar') {
                    out.push(value);
                } else if (value?.kind === 'tagged') {
                    out.push(value.tag);
                    if (value.body.kind === 'scalar') {
                        out.push(value.body);
                    }
                }
                const block = blockOf(value);
                if (block !== undefined) {
                    visit(block.items);
                }
            }
        }
    };
    visit(items);
    return out.sort((a, b) => a.start - b.start);
}

function blocks(items: readonly Item[]): Block[] {
    const out: Block[] = [];
    const visit = (list: readonly Item[]): void => {
        for (const item of list) {
            const block =
                item.kind === 'block'
                    ? item
                    : item.kind === 'pair'
                      ? blockOf(item.value)
                      : undefined;
            if (block !== undefined) {
                out.push(block);
                visit(block.items);
            }
        }
    };
    visit(items);
    return out.sort((a, b) => a.start - b.start);
}

function tags(items: readonly Item[]): string[] {
    const out: { start: number; tag: string }[] = [];
    const visit = (list: readonly Item[]): void => {
        for (const item of list) {
            if (item.kind === 'pair' && item.value?.kind === 'tagged') {
                out.push({ start: item.value.start, tag: item.value.tag.text });
            }
            const block =
                item.kind === 'block'
                    ? item
                    : item.kind === 'pair'
                      ? blockOf(item.value)
                      : undefined;
            if (block !== undefined) {
                visit(block.items);
            }
        }
    };
    visit(items);
    return out.sort((a, b) => a.start - b.start).map((t) => t.tag);
}

function firstExpression(items: readonly Item[]): Arithmetic | undefined {
    return scalars(items).find((s) => s.type === 'arithmetic')?.expression;
}

const event = [
    'namespace = my_mod',
    '',
    'my_mod.0001 = {',
    '\ttype = character_event',
    '\ttitle = my_mod.0001.t',
    '\tdesc = my_mod.0001.desc',
    '\ttheme = intrigue',
    '',
    '\ttrigger = {',
    '\t\tis_alive = yes',
    '\t\tage >= 16',
    '\t}',
    '',
    '\toption = {',
    '\t\tname = my_mod.0001.a',
    '\t\tadd_gold = 100',
    '\t}',
    '}',
].join('\n');

const CASES: readonly Case[] = [
    // ── parser.test.ts: parse() ──
    {
        from: 'parser.test.ts',
        name: 'should return a ROOT node for empty input',
        text: '',
        tree: '',
        findings: [],
    },
    {
        from: 'parser.test.ts',
        name: 'should return a ROOT node for whitespace-only input',
        text: '   \t\n  \n',
        tree: '',
        findings: [],
    },
    // ── simple assignments ──
    {
        from: 'parser.test.ts',
        name: 'should parse key = string_value',
        text: 'name = my_event',
        tree: 'name = my_event',
        findings: [],
        types: ['name', 'name'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key = number_value',
        text: 'weight = 100',
        tree: 'weight = 100',
        types: ['name', 'number'],
        values: ['weight', '100'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key = negative_number',
        text: 'modifier = -5',
        types: ['name', 'number'],
        values: ['modifier', '-5'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key = float_value',
        text: 'factor = 0.75',
        types: ['name', 'number'],
        values: ['factor', '0.75'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key = yes as boolean true',
        text: 'is_triggered_only = yes',
        tree: 'is_triggered_only = yes',
        types: ['name', 'name'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key = no as boolean false',
        text: 'hidden = no',
        tree: 'hidden = no',
        types: ['name', 'name'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key = "quoted string"',
        text: 'title = "My Event Title"',
        tree: 'title = "My Event Title"',
        types: ['name', 'string'],
        values: ['title', 'My Event Title'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key with dots (scope chains)',
        text: 'root.liege.primary_title = some_value',
        tree: 'root.liege.primary_title = some_value',
        types: ['chain', 'name'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse multiple assignments',
        text: 'name = test\ntype = character_event\nhidden = yes',
        tree: 'name = test type = character_event hidden = yes',
    },
    // ── comparisons ──
    {
        from: 'parser.test.ts',
        name: 'should parse key > value',
        text: 'age > 16',
        tree: 'age > 16',
        types: ['name', 'number'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key < value',
        text: 'gold < 100',
        tree: 'gold < 100',
        types: ['name', 'number'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key >= value',
        text: 'prestige >= 500',
        tree: 'prestige >= 500',
        types: ['name', 'number'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse key <= value',
        text: 'piety <= 200',
        tree: 'piety <= 200',
        types: ['name', 'number'],
    },
    // ── blocks ──
    {
        from: 'parser.test.ts',
        name: 'should parse empty block',
        text: 'trigger = { }',
        tree: 'trigger = { }',
        shapes: ['empty'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse block with assignments',
        text: 'effect = {\n\tadd_gold = 100\n\tadd_prestige = 50\n}',
        tree: 'effect = { add_gold = 100 add_prestige = 50 }',
        shapes: ['statements'],
        values: ['effect', 'add_gold', '100', 'add_prestige', '50'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse nested blocks',
        text: 'my_event = {\n\ttrigger = {\n\t\tis_alive = yes\n\t}\n}',
        tree: 'my_event = { trigger = { is_alive = yes } }',
    },
    {
        from: 'parser.test.ts',
        name: 'should parse deeply nested blocks',
        text: 'a = {\n\tb = {\n\t\tc = {\n\t\t\td = yes\n\t\t}\n\t}\n}',
        tree: 'a = { b = { c = { d = yes } } }',
    },
    // ── lists ──
    {
        from: 'parser.test.ts',
        name: 'should parse value lists',
        text: 'colors = { red green blue }',
        tree: 'colors = { red green blue }',
        shapes: ['list'],
        values: ['colors', 'red', 'green', 'blue'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse number lists',
        text: 'weights = { 10 20 30 }',
        shapes: ['list'],
        types: ['name', 'number', 'number', 'number'],
    },
    // ── comments ──
    {
        from: 'parser.test.ts',
        name: 'should parse single-line comments',
        text: '# This is a comment',
        tree: '(# This is a comment)',
    },
    {
        from: 'parser.test.ts',
        name: 'should parse comments mixed with code',
        text: '# A comment\nname = test\n# Another comment',
        tree: '(# A comment) name = test (# Another comment)',
    },
    {
        from: 'parser.test.ts',
        name: 'should parse comments inside blocks',
        text: 'effect = {\n\t# inline comment\n\tadd_gold = 100\n}',
        tree: 'effect = { (# inline comment) add_gold = 100 }',
    },
    // ── quoted strings ──
    {
        from: 'parser.test.ts',
        name: 'should handle escaped quotes inside strings',
        text: 'desc = "He said \\"hello\\""',
        values: ['desc', 'He said "hello"'],
    },
    {
        from: 'parser.test.ts',
        name: 'should handle empty quoted strings',
        text: 'name = ""',
        values: ['name', ''],
    },
    // ── identifier characters ──
    {
        from: 'parser.test.ts',
        name: 'should parse identifiers with underscores',
        text: 'my_special_event = yes',
        values: ['my_special_event', 'yes'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse identifiers starting with @',
        text: '@local_var = 10',
        types: ['constant', 'number'],
        values: ['@local_var', '10'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse identifiers with colons',
        text: 'scope:my_scope = yes',
        types: ['chain', 'name'],
        values: ['scope:my_scope', 'yes'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse identifiers with dots (scope chains)',
        text: 'root.primary_title = some_val',
        types: ['chain', 'name'],
        values: ['root.primary_title', 'some_val'],
    },
    // ── CK3-realistic scripts ──
    {
        from: 'parser.test.ts',
        name: 'should parse a typical event definition',
        text: event,
        findings: [],
        tree: 'namespace = my_mod my_mod.0001 = { type = character_event title = my_mod.0001.t desc = my_mod.0001.desc theme = intrigue trigger = { is_alive = yes age >= 16 } option = { name = my_mod.0001.a add_gold = 100 } }',
    },
    {
        from: 'parser.test.ts',
        name: 'should parse a decision definition',
        text: [
            'my_decision = {',
            '\tis_shown = {',
            '\t\tis_ruler = yes',
            '\t}',
            '\teffect = {',
            '\t\tadd_prestige = 200',
            '\t}',
            '}',
        ].join('\n'),
        findings: [],
        tree: 'my_decision = { is_shown = { is_ruler = yes } effect = { add_prestige = 200 } }',
    },
    // ── error handling ──
    {
        from: 'parser.test.ts',
        name: 'should report error for missing closing brace',
        text: 'block = {\n\tkey = value\n',
        findings: [['syntax/missing-closing-brace', 0, 8]],
        tree: 'block = { key = value',
    },
    {
        from: 'parser.test.ts',
        name: 'should report error for missing operator',
        text: 'key value',
        findings: [['syntax/missing-operator', 0, 4]],
        tree: 'key value',
    },
    {
        from: 'parser.test.ts',
        name: 'should still produce an AST even with errors',
        text: 'good = yes\nbad\nok = no',
        findings: [['syntax/missing-operator', 2, 0]],
        tree: 'good = yes bad ok = no',
    },
    // ── range tracking ──
    {
        from: 'parser.test.ts',
        name: 'should track line and character positions',
        text: 'name = test',
        starts: [[0, 0]],
    },
    {
        from: 'parser.test.ts',
        name: 'should track correct line for multi-line input',
        text: 'first = a\nsecond = b\nthird = c',
        starts: [
            [0, 0],
            [1, 0],
            [2, 0],
        ],
    },
    // ── parser reuse ──
    {
        from: 'parser.test.ts',
        name: 'should be reusable across multiple parse calls',
        before: { text: 'a = 1', tree: 'a = 1' },
        text: 'b = 2',
        tree: 'b = 2',
        findings: [],
    },
    {
        from: 'parser.test.ts',
        name: 'should not carry over errors from previous parses',
        before: { text: 'bad', tree: 'bad' },
        text: 'good = yes',
        findings: [],
    },
    // ── double equals operator (==) ──
    {
        from: 'parser.test.ts',
        name: 'should parse key == numeric value as COMPARISON',
        text: 'prestige == 1000',
        tree: 'prestige == 1000',
        types: ['name', 'number'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse == with identifier value',
        text: 'culture == norse',
        tree: 'culture == norse',
    },
    {
        from: 'parser.test.ts',
        name: 'should produce no errors for == operator',
        text: 'age == 16',
        findings: [],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse == inside a block',
        text: 'trigger = {\n\tprestige == 500\n}',
        findings: [],
        tree: 'trigger = { prestige == 500 }',
    },
    // ── not equals operator (!=) ──
    {
        from: 'parser.test.ts',
        name: 'should parse key != value as COMPARISON',
        text: 'culture != norse',
        tree: 'culture != norse',
    },
    {
        from: 'parser.test.ts',
        name: 'should parse != with numeric value',
        text: 'gold != 0',
        tree: 'gold != 0',
        types: ['name', 'number'],
    },
    {
        from: 'parser.test.ts',
        name: 'should produce no errors for != operator',
        text: 'trait != brave',
        findings: [],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse != inside a block',
        text: 'trigger = {\n\tfaith != catholic\n}',
        findings: [],
        tree: 'trigger = { faith != catholic }',
    },
    // ── numeric keys (random_list weights) ──
    {
        from: 'parser.test.ts',
        name: 'should parse number = { block } inside a block',
        text: 'random_list = {\n\t50 = {\n\t\tadd_gold = 100\n\t}\n}',
        findings: [],
        tree: 'random_list = { 50 = { add_gold = 100 } }',
        types: ['name', 'number', 'name', 'number'],
    },
    {
        from: 'parser.test.ts',
        name: 'should parse number = simple_value as ASSIGNMENT',
        text: 'random_list = {\n\t50 = some_effect\n}',
        findings: [],
        tree: 'random_list = { 50 = some_effect }',
    },
    {
        from: 'parser.test.ts',
        name: 'should parse multiple numeric keys',
        text: 'random_list = {\n\t50 = { a = 1 }\n\t30 = { b = 2 }\n\t20 = { c = 3 }\n}',
        findings: [],
        tree: 'random_list = { 50 = { a = 1 } 30 = { b = 2 } 20 = { c = 3 } }',
    },
    // ── backslash escape in strings ──
    {
        from: 'parser.test.ts',
        name: 'should handle \\\\ escape sequence',
        text: 'path = "C:\\\\Users\\\\test"',
        values: ['path', 'C:\\Users\\test'],
    },
    {
        from: 'parser.test.ts',
        name: 'should handle mixed \\\\ and \\" escapes',
        text: 'desc = "He said \\"hello\\\\"',
        values: ['desc', 'He said "hello\\'],
    },
    {
        from: 'parser.test.ts',
        name: 'should preserve unknown escape sequences literally',
        text: 'text = "line\\nbreak"',
        values: ['text', 'line\\nbreak'],
    },
    // ── mixed operators in realistic CK3 script ──
    {
        from: 'parser.test.ts',
        name: 'should parse a trigger block with ==, !=, >=, > operators',
        text: [
            'trigger = {',
            '\tculture == norse',
            '\tfaith != catholic',
            '\tage >= 16',
            '\tgold > 100',
            '}',
        ].join('\n'),
        findings: [],
        tree: 'trigger = { culture == norse faith != catholic age >= 16 gold > 100 }',
    },
    {
        from: 'parser.test.ts',
        name: 'should parse a full random_list with weighted blocks',
        text: [
            'random_list = {',
            '\t10 = {',
            '\t\tadd_trait = brave',
            '\t}',
            '\t10 = {',
            '\t\tadd_trait = craven',
            '\t}',
            '}',
        ].join('\n'),
        findings: [],
        tree: 'random_list = { 10 = { add_trait = brave } 10 = { add_trait = craven } }',
    },

    // ── syntax-gaps.test.ts: grammar gaps (review S3) ──
    {
        from: 'syntax-gaps.test.ts',
        name: '(a) bare-value lists in a block are one LIST (ValueList) node',
        text: 'traits = { brave diligent }\ndates = { 1066.1.1 1100.1.1 }',
        findings: [],
        shapes: ['list', 'list'],
        types: ['name', 'name', 'name', 'name', 'date', 'date'],
        values: ['traits', 'brave', 'diligent', 'dates', '1066.1.1', '1100.1.1'],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(a) color values rgb { } and hsv { } are value lists tagged with their prefix',
        text: 'color = rgb { 255 0 0 }\ncolor2 = hsv { 0.1 0.2 0.3 }',
        findings: [],
        tree: 'color = rgb { 255 0 0 } color2 = hsv { 0.1 0.2 0.3 }',
        shapes: ['list', 'list'],
        tags: ['rgb', 'hsv'],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(a) lists mix values and anonymous blocks; statements mix with values',
        text: 'names = { dynn_a { "dynnp_al-" "dynn_b" } "dynn_c" }\nevents = { delay = { days = 1 } my_event.0001 }',
        findings: [],
        tree: 'names = { dynn_a { "dynnp_al-" "dynn_b" } "dynn_c" } events = { delay = { days = 1 } my_event.0001 }',
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(b) date literals Y.M.D are DATE tokens, not numbers',
        text: '1066.9.15 = { birth = yes }\nx = 1.5',
        types: ['date', 'name', 'name', 'name', 'number'],
        values: ['1066.9.15', 'birth', 'yes', 'x', '1.5'],
        extra: () => {
            const [first] = tokenize('1066.9.15 = { } x = 1.5');
            assert.equal(first?.kind === 'word' ? first.type : first?.kind, 'date');
        },
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(c) @name = value definitions and @name references',
        text: '@base_cost = 100\nmy_thing = {\n\tcost = @base_cost\n}',
        findings: [],
        constants: ['@base_cost'],
        types: ['constant', 'number', 'name', 'name', 'constant'],
        values: ['@base_cost', '100', 'my_thing', 'cost', '@base_cost'],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(d) @[ ... ] with identifiers, + - * /, parentheses and unary minus',
        text: 'x = @[ -(base_cost + 5) * 2 / divisor - 1 ]',
        findings: [],
        types: ['name', 'arithmetic'],
        expression: {
            type: 'binary',
            op: '-',
            left: {
                type: 'binary',
                op: '/',
                left: {
                    type: 'binary',
                    op: '*',
                    left: {
                        type: 'unary',
                        op: '-',
                        operand: {
                            type: 'binary',
                            op: '+',
                            left: { type: 'name', name: 'base_cost' },
                            right: { type: 'number', value: 5 },
                        },
                    },
                    right: { type: 'number', value: 2 },
                },
                right: { type: 'name', name: 'divisor' },
            },
            right: { type: 'number', value: 1 },
        },
        extra: () => {
            assert.equal(readArithmetic('1 +').ok, false);
        },
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(d) a malformed @[ ] is a parse error (PYCH-P002)',
        text: 'x = @[ 1 + * 2 ]',
        findings: ['syntax/malformed-arithmetic'],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(e) a UTF-8 BOM is skipped and recorded, positions unchanged',
        text: '\uFEFFnamespace = x',
        bom: true,
        findings: [],
        starts: [[0, 0]],
        extra: () => {
            assert.equal(parse('a = b').bom, false);
        },
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(f) scope:x.liege and root.primary_title.holder are one ScopeChain token',
        text: 'scope:x.liege root.primary_title.holder my.0001',
        extra: (result) => {
            const words = tokenize(result.text).filter((t) => t.kind === 'word');
            assert.deepEqual(
                words.map((t) => t.type),
                ['chain', 'chain', 'name'],
            );
            assert.deepEqual(
                scalars(result.file.items).map((s) => s.segments ?? null),
                [['scope:x', 'liege'], ['root', 'primary_title', 'holder'], null],
            );
            for (const head of ['var', 'local_var', 'flag', 'value', 'event_target']) {
                const one = scalars(parse(`x = ${head}:thing`).file.items)[1];
                assert.equal(one?.type, 'chain');
                assert.deepEqual(one.segments, [`${head}:thing`]);
            }
        },
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(g) ?= only after a scope chain or identifier',
        text: '1066.1.1 ?= { }',
        findings: ['syntax/null-safe-operator-after-value'],
        messages: ["Unexpected token '?=' found at 'events/x.txt:1', '=' expected"],
        extra: () => {
            assert.deepEqual(parse('scope:x ?= { is_alive = yes }').findings, []);
            assert.deepEqual(parse('liege ?= { is_alive = yes }').findings, []);
        },
    },
    {
        from: 'syntax-gaps.test.ts',
        name: '(h) comparison operators on identifiers and chains',
        text: 'a = { age >= 16 scope:x.gold > root.gold opinion != 0 }',
        findings: [],
        tree: 'a = { age >= 16 scope:x.gold > root.gold opinion != 0 }',
        types: ['name', 'name', 'number', 'chain', 'chain', 'name', 'number'],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: 'accepts `scripted_trigger name = { }` file-local definitions',
        text: 'scripted_trigger my_check = { is_alive = yes }',
        findings: [],
        tree: '<scripted_trigger> my_check = { is_alive = yes }',
    },
    {
        from: 'syntax-gaps.test.ts',
        name: 'accepts `$OPERATOR$` as an operator and operators as argument values',
        text: 'a = { count $OPERATOR$ $COUNT$ }\nb = { OPERATOR = <= }',
        findings: [],
        tree: 'a = { count $OPERATOR$ $COUNT$ } b = { OPERATOR = <= }',
    },
    // ── syntax-gaps.test.ts: parse errors use the catalogue texts ──
    {
        from: 'syntax-gaps.test.ts',
        name: "missing '=' before a block: expected_between_block_name_and_body",
        text: 'a = {\n\tb = 1\n\tc { d = 2 }\n}',
        findings: [['syntax/missing-equals-before-block', 2, 3]],
        messages: ["Expected '=' between block name and body"],
        tree: 'a = { b = 1 c <none> { d = 2 } }',
    },
    {
        from: 'syntax-gaps.test.ts',
        name: "missing '}' at the end of the file: expected_after_arguments",
        text: 'a = {\n\tb = 1\n',
        findings: [['syntax/missing-closing-brace', 0, 4]],
        messages: ['Expected } after arguments'],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: "missing value after '=': expected_between_equals_and_arguments",
        text: 'a = {\n\tb =\n}',
        findings: [['syntax/missing-value', 2, 0]],
        messages: ["Expected '{' between equals and arguments"],
        tree: 'a = { b = <none> }',
    },
    {
        from: 'syntax-gaps.test.ts',
        name: "a stray '}' at top level: unexpected_token_expected_key",
        text: 'a = { }\n}',
        findings: [['syntax/unexpected-closing-brace', 1, 0]],
        messages: ["Unexpected token, expected 'key = {'"],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: "a key without '=' at top level: unexpected_token_X_found_at_X_expected",
        text: 'title re_broken.0001.t',
        findings: [['syntax/missing-operator', 0, 6]],
        messages: ["Unexpected token 're_broken.0001.t' found at 'events/x.txt:1', '=' expected"],
    },
    {
        from: 'syntax-gaps.test.ts',
        name: 'an unterminated string: PYCH-P001 at the opening quote',
        text: 'a = "unclosed\nb = c',
        findings: [['syntax/unterminated-string', 0, 4]],
        messages: ["Unterminated string starting at 'events/x.txt:1'"],
    },
];

test('the table holds the 74 cases of release 2.3.0', () => {
    assert.equal(CASES.filter((c) => c.from === 'parser.test.ts').length, 55);
    assert.equal(CASES.filter((c) => c.from === 'syntax-gaps.test.ts').length, 19);
    assert.equal(new Set(CASES.map((c) => `${c.from} ${c.name}`)).size, 74);
});

for (const c of CASES) {
    test(`2.3.0 ${c.from}: ${c.name}`, () => {
        const before = c.before === undefined ? undefined : parse(c.before.text);
        const result = parse(c.text, { catalogue: committedCatalogue() });
        if (before !== undefined && c.before !== undefined) {
            assert.equal(
                summary(before.file.items),
                c.before.tree,
                'the earlier parse is unchanged',
            );
        }
        if (c.tree !== undefined) {
            assert.equal(summary(result.file.items), c.tree);
        }
        if (c.findings !== undefined) {
            assert.deepEqual(
                result.findings.map((f, n) =>
                    typeof c.findings?.[n] === 'string'
                        ? f.id
                        : [f.id, f.range.start.line, f.range.start.character],
                ),
                c.findings,
            );
        }
        if (c.messages !== undefined) {
            assert.deepEqual(
                result.findings.map((f) => findingMessage(f, { file: 'events/x.txt' })),
                c.messages,
            );
        }
        if (c.types !== undefined) {
            assert.deepEqual(
                scalars(result.file.items).map((s) => s.type),
                c.types,
            );
        }
        if (c.values !== undefined) {
            assert.deepEqual(
                scalars(result.file.items).map((s) => s.value),
                c.values,
            );
        }
        if (c.shapes !== undefined) {
            assert.deepEqual(blocks(result.file.items).map(blockShape), c.shapes);
        }
        if (c.tags !== undefined) {
            assert.deepEqual(tags(result.file.items), c.tags);
        }
        if (c.starts !== undefined) {
            assert.deepEqual(
                result.file.items
                    .filter((item) => item.kind !== 'comment')
                    .map((item) => {
                        const p = result.lines.positionAt(item.start);
                        return [p.line, p.character];
                    }),
                c.starts,
            );
        }
        if (c.bom !== undefined) {
            assert.equal(result.bom, c.bom);
        }
        if (c.constants !== undefined) {
            assert.deepEqual([...fileConstants(result.file).keys()], c.constants);
        }
        if (c.expression !== undefined) {
            assert.deepEqual(firstExpression(result.file.items), c.expression);
        }
        c.extra?.(result);
    });
}
