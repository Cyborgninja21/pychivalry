import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chainSegments, classifyWord, OPERATORS, tokenize, unquote, type Token } from './lexer.js';
import { parse } from './parser.js';

/** Each token as `kind` or `kind:type`, with its text. */
function lex(text: string): [string, string][] {
    return tokenize(text)
        .filter((t) => t.kind !== 'eof')
        .map((t: Token) => [
            t.kind === 'word' ? `word:${t.type}` : t.kind,
            text.slice(t.start, t.end),
        ]);
}

test('the eight operators, each one token', () => {
    for (const op of OPERATORS) {
        assert.deepEqual(lex(`a ${op} b`), [
            ['word:name', 'a'],
            ['operator', op],
            ['word:name', 'b'],
        ]);
        assert.deepEqual(
            lex(`a${op}b`).map(([, text]) => text),
            ['a', op, 'b'],
            'without spaces',
        );
    }
});

test("'!' and '?' end a word only before '='; elsewhere they are part of it", () => {
    assert.deepEqual(lex('a!b c? d?=e'), [
        ['word:name', 'a!b'],
        ['word:name', 'c?'],
        ['word:name', 'd'],
        ['operator', '?='],
        ['word:name', 'e'],
    ]);
});

test('?= is accepted only after a name, a scope chain or a $PARAM$', () => {
    for (const ok of ['x ?= { }', 'scope:x.liege ?= { }', '$TARGET$ ?= { }']) {
        assert.deepEqual(parse(ok).findings, [], ok);
    }
    for (const bad of ['1066.1.1 ?= { }', '5 ?= { }', '"text" ?= { }', '@c ?= { }']) {
        assert.deepEqual(
            parse(bad).findings.map((f) => f.id),
            ['syntax/null-safe-operator-after-value'],
            bad,
        );
    }
});

test('quoted text may span lines; \\" and \\\\ are its only escapes', () => {
    const text = 'a = "one\ntwo \\"q\\" \\\\ \\n"';
    assert.deepEqual(
        lex(text).map(([kind]) => kind),
        ['word:name', 'operator', 'string'],
    );
    const [, , string] = tokenize(text);
    assert.ok(string?.kind === 'string' && string.terminated);
    assert.equal(unquote(text.slice(string.start, string.end), true), 'one\ntwo "q" \\ \\n');
});

test('quoted text without its closing quote runs to the end of the file', () => {
    const [string, eof] = tokenize('"open\nb = c');
    assert.ok(string?.kind === 'string');
    assert.equal(string.terminated, false);
    assert.equal(string.end, 11);
    assert.equal(eof?.kind, 'eof');
    assert.equal(unquote('"open', false), 'open');
    assert.equal(unquote('"ends with \\"', false), 'ends with "');
});

test('a comment runs from # to the end of the line, without the line break, and is kept', () => {
    assert.deepEqual(lex('a = b # note\r\nc = d #end'), [
        ['word:name', 'a'],
        ['operator', '='],
        ['word:name', 'b'],
        ['comment', '# note'],
        ['word:name', 'c'],
        ['operator', '='],
        ['word:name', 'd'],
        ['comment', '#end'],
    ]);
    assert.deepEqual(
        lex('"a # b"').map(([kind]) => kind),
        ['string'],
        'no comment inside text',
    );
});

test('numbers and dates', () => {
    const words: [string, string][] = [
        ['100', 'number'],
        ['-5', 'number'],
        ['+200', 'number'],
        ['0.75', 'number'],
        ['.5', 'number'],
        ['1066.1', 'number'],
        ['1066.9.15', 'date'],
        ['-17.1.1', 'date'],
        ['1.2.3.4', 'name'],
        ['5x', 'name'],
    ];
    for (const [word, type] of words) {
        assert.equal(classifyWord(word), type, word);
    }
});

test('@name constants, and @[ ... ] inline arithmetic as one token', () => {
    assert.deepEqual(lex('cost = @base_cost'), [
        ['word:name', 'cost'],
        ['operator', '='],
        ['word:constant', '@base_cost'],
    ]);
    assert.deepEqual(lex('x = @[ a + 2 * (b - 1) ] y'), [
        ['word:name', 'x'],
        ['operator', '='],
        ['arithmetic', '@[ a + 2 * (b - 1) ]'],
        ['word:name', 'y'],
    ]);
    assert.deepEqual(
        lex('x = @[ a[1] ] y').map(([, text]) => text),
        ['x', '=', '@[ a[1] ]', 'y'],
    );
    const open = tokenize('x = @[ a + 1\ny = 2');
    assert.ok(open[2]?.kind === 'arithmetic');
    assert.equal(open[2].terminated, false, 'an unclosed @[ stops at the end of its line');
    assert.deepEqual(
        lex('x = @[ a + 1\ny = 2')
            .slice(3)
            .map(([, text]) => text),
        ['y', '=', '2'],
    );
    assert.equal(classifyWord('@'), 'name');
});

test('a scope chain is one token; a dot inside |...| does not split it', () => {
    assert.deepEqual(chainSegments('scope:x.liege'), ['scope:x', 'liege']);
    assert.deepEqual(chainSegments('root.primary_title.holder'), [
        'root',
        'primary_title',
        'holder',
    ]);
    assert.deepEqual(chainSegments('value:sv|A|1.5|'), ['value:sv|A|1.5|']);
    assert.deepEqual(chainSegments('value:sv|A|1.5|.x'), ['value:sv|A|1.5|', 'x']);
    assert.deepEqual(chainSegments('a:x|1.5|.b:y|2.5|'), ['a:x|1.5|', 'b:y|2.5|']);
    assert.deepEqual(chainSegments('title:k_france'), ['title:k_france']);
    assert.deepEqual(chainSegments('$TARGET$.liege'), ['$TARGET$', 'liege']);
    assert.equal(classifyWord('scope:x.liege'), 'chain');
    assert.equal(classifyWord('flag:$NAME$'), 'chain');
});

test('namespace.0001 and its localization keys stay names', () => {
    for (const word of ['namespace.0001', 'my_mod.0001.t', 'a..b', '.x', 'plain']) {
        assert.equal(classifyWord(word), 'name', word);
    }
    assert.equal(chainSegments('namespace.0001'), undefined);
});

test('$PARAM$ macro parameters, including in the operator position', () => {
    assert.equal(classifyWord('$COUNT$'), 'parameter');
    assert.equal(classifyWord('$A$_suffix'), 'name');
    assert.deepEqual(
        lex('count $OPERATOR$ $COUNT$').map(([kind]) => kind),
        ['word:name', 'word:parameter', 'word:parameter'],
    );
    const pair = parse('x = { type = a count $OPERATOR$ $COUNT$ }').file.items[0];
    const inner =
        pair?.kind === 'pair' && pair.value?.kind === 'block' ? pair.value.items[1] : undefined;
    assert.ok(inner?.kind === 'pair');
    assert.deepEqual(
        [inner.key.text, inner.operator?.text, inner.operator?.parameter],
        ['count', '$OPERATOR$', true],
    );
});

test('braces are tokens wherever they stand; newlines are only whitespace', () => {
    assert.deepEqual(
        lex('a={b}\n\n  }').map(([, text]) => text),
        ['a', '=', '{', 'b', '}', '}'],
    );
    assert.deepEqual(
        lex('a\n=\nb').map(([kind]) => kind),
        ['word:name', 'operator', 'word:name'],
    );
});

test('a span of the text can be split on its own', () => {
    const tokens = tokenize('skip = 1 keep = 2', 9, 17);
    assert.deepEqual(
        tokens.map((t) => t.start),
        [9, 14, 16, 17],
    );
});
