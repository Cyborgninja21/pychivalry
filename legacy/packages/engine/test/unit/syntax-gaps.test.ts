/**
 * The grammar gaps of review issue S3, closed in the engine parser, and the parse errors
 * the parser emits with the spec package's catalogue texts.
 */

import * as assert from 'assert';

import { CK3Parser, NodeType, ParsedDocument } from '../../src/syntax/parser';
import { parseExpression } from '../../src/syntax/expression';
import { TokenType, Lexer } from '../../src/syntax/lexer';

function parse(text: string): ParsedDocument {
    return new CK3Parser({ file: 'events/x.txt' }).parse(text);
}

describe('Grammar gaps (review S3)', () => {
    it('(a) bare-value lists in a block are one LIST (ValueList) node', () => {
        const r = parse('traits = { brave diligent }\ndates = { 1066.1.1 1100.1.1 }');
        assert.strictEqual(r.errors.length, 0);
        const [traits, dates] = r.ast.children ?? [];
        assert.strictEqual(traits.type, NodeType.LIST);
        assert.deepStrictEqual(
            traits.children?.map((c) => c.value),
            ['brave', 'diligent']
        );
        assert.strictEqual(dates.type, NodeType.LIST);
        assert.deepStrictEqual(
            dates.children?.map((c) => c.valueKind),
            ['date', 'date']
        );
    });

    it('(a) color values rgb { } and hsv { } are value lists tagged with their prefix', () => {
        const r = parse('color = rgb { 255 0 0 }\ncolor2 = hsv { 0.1 0.2 0.3 }');
        assert.strictEqual(r.errors.length, 0);
        const [rgb, hsv] = r.ast.children ?? [];
        assert.strictEqual(rgb.type, NodeType.LIST);
        assert.strictEqual(rgb.value, 'rgb');
        assert.strictEqual(rgb.valueKind, 'color');
        assert.strictEqual(rgb.children?.length, 3);
        assert.strictEqual(hsv.value, 'hsv');
    });

    it('(a) lists mix values and anonymous blocks; statements mix with values', () => {
        const r = parse(
            'names = { dynn_a { "dynnp_al-" "dynn_b" } "dynn_c" }\n' +
                'events = { delay = { days = 1 } my_event.0001 }'
        );
        assert.strictEqual(r.errors.length, 0);
        assert.strictEqual(r.ast.children?.[0].children?.length, 3);
        assert.strictEqual(r.ast.children?.[1].type, NodeType.BLOCK);
    });

    it('(b) date literals Y.M.D are DATE tokens, not numbers', () => {
        const tokens = new Lexer().tokenize('1066.9.15 = { } x = 1.5').tokens;
        assert.strictEqual(tokens[0].type, TokenType.DATE);
        const r = parse('1066.9.15 = { birth = yes }\nx = 1.5');
        assert.strictEqual(r.ast.children?.[0].keyKind, 'date');
        assert.strictEqual(r.ast.children?.[1].value, 1.5);
    });

    it('(c) @name = value definitions and @name references', () => {
        const r = parse('@base_cost = 100\nmy_thing = {\n\tcost = @base_cost\n}');
        assert.strictEqual(r.errors.length, 0);
        assert.ok(r.constants?.has('@base_cost'));
        const cost = r.ast.children?.[1].children?.[0];
        assert.strictEqual(cost?.value, '@base_cost');
        assert.strictEqual(cost?.valueKind, 'constant');
    });

    it('(d) @[ ... ] with identifiers, + - * /, parentheses and unary minus', () => {
        const r = parse('x = @[ -(base_cost + 5) * 2 / divisor - 1 ]');
        assert.strictEqual(r.errors.length, 0);
        const node = r.ast.children?.[0];
        assert.strictEqual(node?.valueKind, 'expression');
        assert.deepStrictEqual(node?.expression, {
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
                            left: { type: 'identifier', name: 'base_cost' },
                            right: { type: 'number', value: 5 },
                        },
                    },
                    right: { type: 'number', value: 2 },
                },
                right: { type: 'identifier', name: 'divisor' },
            },
            right: { type: 'number', value: 1 },
        });
        assert.throws(() => parseExpression('1 +'));
    });

    it('(d) a malformed @[ ] is a parse error (PYCH-P002)', () => {
        const r = parse('x = @[ 1 + * 2 ]');
        assert.deepStrictEqual(
            r.errors.map((e) => e.code),
            ['PYCH-P002']
        );
    });

    it('(e) a UTF-8 BOM is skipped and recorded, positions unchanged', () => {
        const r = parse('﻿namespace = x');
        assert.strictEqual(r.bom, true);
        assert.strictEqual(r.errors.length, 0);
        assert.deepStrictEqual(r.ast.children?.[0].range.start, { line: 0, character: 0 });
        assert.strictEqual(parse('a = b').bom, false);
    });

    it('(f) scope:x.liege and root.primary_title.holder are one ScopeChain token', () => {
        const tokens = new Lexer().tokenize(
            'scope:x.liege root.primary_title.holder my.0001'
        ).tokens;
        assert.strictEqual(tokens[0].type, TokenType.SCOPE_CHAIN);
        assert.deepStrictEqual(tokens[0].chain, {
            kind: 'scope',
            head: 'scope:x',
            prefix: 'scope',
            name: 'x',
            segments: ['scope:x', 'liege'],
        });
        assert.deepStrictEqual(tokens[1].chain?.segments, ['root', 'primary_title', 'holder']);
        assert.strictEqual(tokens[1].chain?.kind, 'plain');
        assert.strictEqual(tokens[2].type, TokenType.IDENTIFIER); // an event id, not a chain
        for (const head of ['var', 'local_var', 'flag', 'value', 'event_target']) {
            const t = new Lexer().tokenize(`${head}:thing`).tokens[0];
            assert.strictEqual(t.chain?.kind, head);
        }
    });

    it('(g) ?= only after a scope chain or identifier', () => {
        assert.strictEqual(parse('scope:x ?= { is_alive = yes }').errors.length, 0);
        assert.strictEqual(parse('liege ?= { is_alive = yes }').errors.length, 0);
        const bad = parse('1066.1.1 ?= { }');
        assert.deepStrictEqual(
            bad.errors.map((e) => e.code),
            ['unexpected_token_X_found_at_X_expected']
        );
        assert.strictEqual(
            bad.errors[0].message,
            "Unexpected token '?=' found at 'events/x.txt:1', '=' expected"
        );
    });

    it('(h) comparison operators on identifiers and chains', () => {
        const r = parse('a = { age >= 16 scope:x.gold > root.gold opinion != 0 }');
        assert.strictEqual(r.errors.length, 0);
        const ops = r.ast.children?.[0].children?.map((c) => [c.type, c.operator]);
        assert.deepStrictEqual(ops, [
            [NodeType.COMPARISON, '>='],
            [NodeType.COMPARISON, '>'],
            [NodeType.COMPARISON, '!='],
        ]);
        assert.ok(r.ast.children?.[0].children?.[1].keyChain);
        assert.ok(r.ast.children?.[0].children?.[1].valueChain);
    });

    it('accepts `scripted_trigger name = { }` file-local definitions', () => {
        const r = parse('scripted_trigger my_check = { is_alive = yes }');
        assert.strictEqual(r.errors.length, 0);
        assert.strictEqual(r.ast.children?.[0].key, 'my_check');
        assert.strictEqual(r.ast.children?.[0].keyPrefix, 'scripted_trigger');
    });

    it('accepts `$OPERATOR$` as an operator and operators as argument values', () => {
        const r = parse('a = { count $OPERATOR$ $COUNT$ }\nb = { OPERATOR = <= }');
        assert.strictEqual(r.errors.length, 0);
    });
});

describe('Parse errors use the catalogue texts', () => {
    it("missing '=' before a block: expected_between_block_name_and_body", () => {
        const r = parse('a = {\n\tb = 1\n\tc { d = 2 }\n}');
        assert.deepStrictEqual(
            r.errors.map((e) => [e.code, e.message, e.range.start.line]),
            [
                [
                    'expected_between_block_name_and_body',
                    "Expected '=' between block name and body",
                    2,
                ],
            ]
        );
    });

    it("missing '}' at the end of the file: expected_after_arguments", () => {
        const r = parse('a = {\n\tb = 1\n');
        assert.deepStrictEqual(
            r.errors.map((e) => [e.code, e.message, e.range.start.line, e.range.start.character]),
            [['expected_after_arguments', 'Expected } after arguments', 0, 4]]
        );
    });

    it("missing value after '=': expected_between_equals_and_arguments", () => {
        const r = parse('a = {\n\tb =\n}');
        assert.deepStrictEqual(
            r.errors.map((e) => [e.code, e.message]),
            [['expected_between_equals_and_arguments', "Expected '{' between equals and arguments"]]
        );
    });

    it("a stray '}' at top level: unexpected_token_expected_key", () => {
        const r = parse('a = { }\n}');
        assert.deepStrictEqual(
            r.errors.map((e) => [e.code, e.message, e.range.start.line]),
            [['unexpected_token_expected_key', "Unexpected token, expected 'key = {'", 1]]
        );
    });

    it("a key without '=' at top level: unexpected_token_X_found_at_X_expected", () => {
        const r = parse('title re_broken.0001.t');
        assert.deepStrictEqual(
            r.errors.map((e) => e.message),
            ["Unexpected token 're_broken.0001.t' found at 'events/x.txt:1', '=' expected"]
        );
    });

    it('an unterminated string: PYCH-P001 at the opening quote', () => {
        const r = parse('a = "unclosed\nb = c');
        assert.deepStrictEqual(
            r.errors.map((e) => [e.code, e.message, e.range.start.line, e.range.start.character]),
            [['PYCH-P001', "Unterminated string starting at 'events/x.txt:1'", 0, 4]]
        );
    });
});
