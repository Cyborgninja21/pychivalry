import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from './parser.js';
import { summary } from './testing.js';
import { blockOf, fileConstants, type Pair } from './tree.js';

/** Forms the parser accepts (docs/PLAN.md item 2.4): each parses with no finding. */
const FORMS: readonly (readonly [string, string, string])[] = [
    ['key = value', 'name = my_event', 'name = my_event'],
    ['key = { ... }', 'effect = { add_gold = 100 }', 'effect = { add_gold = 100 }'],
    ['an empty block', 'trigger = { }', 'trigger = { }'],
    ['blocks without a key in a block', 'x = { { 1 2 } { 3 4 } }', 'x = { { 1 2 } { 3 4 } }'],
    ['a list of bare values', 'traits = { brave diligent }', 'traits = { brave diligent }'],
    ['a list of quoted values', 'names = { "a b" "c" }', 'names = { "a b" "c" }'],
    [
        'a mixed list: values and pairs',
        'on_actions = { delay = { days = 1 } my_on_action another }',
        'on_actions = { delay = { days = 1 } my_on_action another }',
    ],
    [
        'a mixed list: a value, then a pair',
        'x = { wounded_pulse delay = { days = 90 } wounded_pulse }',
        'x = { wounded_pulse delay = { days = 90 } wounded_pulse }',
    ],
    ['a value and a block, in a list', 'x = { name_a { "p" "b" } }', 'x = { name_a { "p" "b" } }'],
    [
        'a numeric key',
        'random_list = { 50 = { add_gold = 1 } }',
        'random_list = { 50 = { add_gold = 1 } }',
    ],
    ['a date key', '1066.9.15 = { birth = yes }', '1066.9.15 = { birth = yes }'],
    ['a negative date key', '-17.1.1 = { holder = 1 }', '-17.1.1 = { holder = 1 }'],
    ['an operator as a value', 'x = { OPERATOR = <= }', 'x = { OPERATOR = <= }'],
    ['a named list', 'color1 = list "normal_colors"', 'color1 = list "normal_colors"'],
    ['rgb { }', 'color = rgb { 255 0 0 }', 'color = rgb { 255 0 0 }'],
    ['hsv { }', 'color = hsv { 0.1 0.2 0.3 }', 'color = hsv { 0.1 0.2 0.3 }'],
    ['hsv360 { }', 'color = hsv360 { 30 50 60 }', 'color = hsv360 { 30 50 60 }'],
    ['RGB { }', 'color = RGB { 1 2 3 }', 'color = RGB { 1 2 3 }'],
    ['HSV { }', 'color = HSV { 0.1 0.2 0.3 }', 'color = HSV { 0.1 0.2 0.3 }'],
    ['HSV360 { }', 'color = HSV360 { 30 50 60 }', 'color = HSV360 { 30 50 60 }'],
    ['hex { }', 'fog_color = hex { 50779b }', 'fog_color = hex { 50779b }'],
    ['another tag', 'position = cylindrical { 1 2 3 }', 'position = cylindrical { 1 2 3 }'],
    [
        'a file-local scripted trigger',
        'scripted_trigger my_check = { is_alive = yes }',
        '<scripted_trigger> my_check = { is_alive = yes }',
    ],
    [
        'a file-local scripted effect',
        'scripted_effect my_effect = { add_gold = 1 }',
        '<scripted_effect> my_effect = { add_gold = 1 }',
    ],
    [
        'a $PARAM$ in the operator position, among pairs',
        'opinion = { target = root value $OPERATOR$ $VALUE$ }',
        'opinion = { target = root value $OPERATOR$ $VALUE$ }',
    ],
    ['?= after a name', 'liege ?= { is_alive = yes }', 'liege ?= { is_alive = yes }'],
    [
        '?= after a chain',
        'scope:x.liege ?= { is_alive = yes }',
        'scope:x.liege ?= { is_alive = yes }',
    ],
    ['?= after a $PARAM$', '$OWNER$ ?= { is_alive = yes }', '$OWNER$ ?= { is_alive = yes }'],
    ['a constant', '@cost = 100\nx = { cost = @cost }', '@cost = 100 x = { cost = @cost }'],
    ['inline arithmetic', 'x = @[ cost * 2 ]', 'x = @[ cost * 2 ]'],
    ['newlines anywhere between key, operator and value', 'a\n=\n{\nb\n=\nc\n}', 'a = { b = c }'],
];

for (const [name, text, tree] of FORMS) {
    test(`form: ${name}`, () => {
        const result = parse(text);
        assert.deepEqual(result.findings, []);
        assert.equal(summary(result.file.items), tree);
    });
}

function pairAt(text: string, path: readonly number[]): Pair {
    let items = parse(text).file.items;
    let pair: Pair | undefined;
    for (const index of path) {
        const item = items[index];
        assert.ok(item?.kind === 'pair', `item ${String(index)} is a pair`);
        pair = item;
        items = blockOf(item.value)?.items ?? [];
    }
    assert.ok(pair !== undefined);
    return pair;
}

test('a tagged value keeps its tag and its body', () => {
    const color = pairAt('color = rgb { 255 0 0 }', [0]);
    assert.ok(color.value?.kind === 'tagged');
    assert.equal(color.value.tag.text, 'rgb');
    assert.equal(color.value.body.kind, 'block');
    const list = pairAt('c = list "normal_colors"', [0]);
    assert.ok(list.value?.kind === 'tagged' && list.value.body.kind === 'scalar');
    assert.equal(list.value.body.value, 'normal_colors');
});

test('quoted text that is the key of the next pair is not a tag body', () => {
    const result = parse('x = { a = b "key" = c }');
    assert.deepEqual(result.findings, []);
    assert.equal(summary(result.file.items), 'x = { a = b "key" = c }');
    assert.equal(pairAt('x = { a = b "key" = c }', [0, 0]).value?.kind, 'scalar');
});

test("a name before the key counts only at the top level, on the key's line, before a block", () => {
    assert.equal(pairAt('scripted_trigger t = { }', [0]).prefix?.text, 'scripted_trigger');
    // On another line it is a stray word, reported where '=' belongs.
    const apart = parse('scripted_trigger\nt = { }');
    assert.deepEqual(
        apart.findings.map((f) => f.id),
        ['syntax/missing-operator'],
    );
    assert.equal(summary(apart.file.items), 'scripted_trigger t = { }');
    // Before a plain value it is a stray word too.
    assert.deepEqual(
        parse('good = yes bad ok = no').findings.map((f) => f.id),
        ['syntax/missing-operator'],
    );
});

test('a $PARAM$ between two values is an operator only in a block that holds pairs', () => {
    const list = parse('x = { brave $TRAIT$ craven }');
    assert.deepEqual(list.findings, []);
    const items = blockOf(pairAt('x = { brave $TRAIT$ craven }', [0]).value)?.items ?? [];
    assert.deepEqual(
        items.map((item) => item.kind),
        ['scalar', 'scalar', 'scalar'],
    );
    assert.deepEqual(
        blockOf(pairAt('x = { $SKILL_A$ $SKILL_B$ }', [0]).value)?.items.map((item) => item.kind),
        ['scalar', 'scalar'],
    );
    const pair = pairAt('x = { type = a count $OPERATOR$ { y = 1 } }', [0, 1]);
    assert.equal(pair.operator?.parameter, true);
    assert.equal(pair.value?.kind, 'block');
    // At the top level, where a bare value is not allowed, it is always an operator.
    assert.equal(pairAt('value $OPERATOR$ 5', [0]).operator?.text, '$OPERATOR$');
});

test("top-level @name = value definitions are the file's constants", () => {
    const result = parse('@a = 1\n@b = @[ a * 2 ]\nx = { @c = 3 }\n@d > 1');
    assert.deepEqual([...fileConstants(result.file).keys()], ['@a', '@b']);
});

test('comments are kept, each in the block that holds it, in source order', () => {
    const text = '# top\nkey # after key\n= # after operator\n{ # inside\n a = b # end\n}\n# last';
    const result = parse(text);
    assert.deepEqual(result.findings, []);
    assert.equal(
        summary(result.file.items),
        '(# top) key = { (# inside) a = b (# end) } (# after key) (# after operator) (# last)',
    );
    const starts = result.file.items.map((item) => item.start);
    assert.deepEqual(
        starts,
        [...starts].sort((a, b) => a - b),
        'items are in source order',
    );
});

test('every node lies within its parent, and items do not overlap', () => {
    const text =
        'a = { b = rgb { 1 2 3 } c = { d e } # x\n f = list "g" }\nscripted_effect h = { i = j }';
    const result = parse(text);
    const check = (
        items: readonly { kind: string; start: number; end: number }[],
        from: number,
        to: number,
    ): void => {
        let end = from;
        let start = from;
        for (const item of items) {
            assert.ok(item.start >= from && item.end <= to, 'inside its parent');
            assert.ok(item.start >= start, 'in source order');
            if (item.kind !== 'comment') {
                // Only a comment written inside a pair lies within the item before it.
                assert.ok(item.start >= end, 'no overlap');
                end = item.end;
            }
            start = item.start;
        }
    };
    check(result.file.items, 0, text.length);
    for (const item of result.file.items) {
        if (item.kind === 'pair') {
            const block = blockOf(item.value);
            if (block !== undefined) {
                check(block.items, block.start + 1, block.end - 1);
                assert.equal(text.slice(block.start, block.start + 1), '{');
                assert.equal(text.slice(block.end - 1, block.end), '}');
            }
        }
    }
});

test('a deeply nested file parses without overflowing the stack', () => {
    const depth = 200_000;
    const text = `${'a = { '.repeat(depth)}b = c${' }'.repeat(depth)}`;
    const result = parse(text);
    assert.deepEqual(result.findings, []);
    let block = blockOf(pairAt(text, [0]).value);
    let levels = 1;
    while (block?.items[0]?.kind === 'pair' && block.items[0].key.text === 'a') {
        block = blockOf(block.items[0].value);
        levels++;
    }
    assert.equal(levels, depth);
});
