/**
 * What a file defines and uses (docs/PLAN.md items 3.3 and 3.4), on shapes the fixtures do not
 * all show: which words of a scalar are uses, which top-level pairs are definitions, and how
 * the rules table's containers and priority fields shape what is recorded.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from '../syntax/parser.js';
import type { Pair, Scalar } from '../syntax/tree.js';
import { DEF, DEF_STRIDE, extractScript, formOf, NONE, scalarWords } from './extract.js';
import { StringTable } from './strings.js';

/** The words a value written as `text` uses, with their offsets in `x = <text>`. */
function words(text: string): [string, number][] {
    const source = `x = ${text}`;
    const pair = parse(source).file.items[0] as Pair;
    const out: [string, number][] = [];
    scalarWords(pair.value as Scalar, (word, start) => out.push([word, start - 4]));
    return out;
}

test('the words of a scalar that are uses', () => {
    assert.deepEqual(words('brave'), [['brave', 0]]);
    assert.deepEqual(words('@cost'), [['@cost', 0]]);
    assert.deepEqual(words('1002'), [['1002', 0]]);
    assert.deepEqual(words('0.5'), []);
    assert.deepEqual(words('-3'), []);
    assert.deepEqual(words('867.1.1'), []);
    assert.deepEqual(words('$PARAM$'), []);
    assert.deepEqual(words('my_$PARAM$_name'), []);
    assert.deepEqual(words('event.0001'), [['event.0001', 0]]);
    assert.deepEqual(words('root.liege'), [
        ['root', 0],
        ['liege', 5],
    ]);
    assert.deepEqual(words('trait:brave'), [['brave', 6]]);
    assert.deepEqual(words('scope:actor.liege'), [
        ['actor', 6],
        ['liege', 12],
    ]);
    assert.deepEqual(words('define:NGame|START_DATE'), [
        ['NGame', 7],
        ['START_DATE', 13],
    ]);
    assert.deepEqual(words('value:my_value|A|1.5|'), [
        ['my_value', 6],
        ['A', 15],
    ]);
    assert.deepEqual(words('title:$TITLE$'), []);
    assert.deepEqual(words('"brave"'), [['brave', 1]]);
    assert.deepEqual(words('"trait:brave"'), [['brave', 7]]);
    assert.deepEqual(words('"two words"'), []);
    assert.deepEqual(words('""'), []);
    assert.deepEqual(words('"esc\\"aped"'), [], 'text with escapes is no single word');
    assert.deepEqual(words('@[ a + 1 ]'), []);
});

function extract(
    text: string,
    options: {
        database?: string | null;
        containers?: Set<string> | 'all' | null;
        priority?: { field: string; fallback: number } | null;
    } = {},
) {
    const strings = new StringTable();
    const result = extractScript(parse(text).file, {
        strings,
        database: options.database === undefined ? 'common/x' : options.database,
        containers: options.containers ?? null,
        priority: options.priority ?? null,
    });
    const defs: {
        name: string;
        database: string;
        form: string;
        container: string | null;
        extra: number;
    }[] = [];
    for (let i = 0; i < result.defs.length; i += DEF_STRIDE) {
        const at = (f: number): number => result.defs[i + f] ?? -1;
        defs.push({
            name: strings.get(at(DEF.name)),
            database: strings.get(at(DEF.database)),
            form: formOf(at(DEF.form)),
            container: at(DEF.container) < 0 ? null : strings.get(at(DEF.container)),
            extra: at(DEF.extra),
        });
    }
    const uses: string[] = [];
    for (let i = 0; i < result.uses.length; i += 2) {
        uses.push(strings.get(result.uses[i] ?? -1));
    }
    return { defs, uses };
}

test('a top-level pair is a definition when its key is a name, a number or a constant, with =', () => {
    const { defs, uses } = extract(
        'a = { b = c }\n1001 = { }\n@k = 3\nprefix p = { }\nd = 5\ne > 5\nscope:x = { }\n867.1.1 = { }\n"q" = { }\n$P$ = { }\n',
    );
    assert.deepEqual(
        defs.map((d) => `${d.form}:${d.database}:${d.name}`),
        [
            'record:common/x:a',
            'record:common/x:1001',
            'constant:constants:@k',
            'prefixed:inline:prefix:p',
            'value:common/x:d',
        ],
    );
    // The other pairs are read for their uses; a definition's own key is not a use.
    assert.deepEqual(uses.sort(), ['3', '5', '5', 'b', 'c', 'e', 'q', 'x']);
});

test('a recovered name { } without its = is still a definition', () => {
    assert.deepEqual(
        extract('a { }\n').defs.map((d) => d.name),
        ['a'],
    );
});

test('in a folder the spec does not list, nothing is a definition and every word is read for uses', () => {
    const { defs, uses } = extract('a = { b = c }\n@k = 1\n', { database: null });
    assert.deepEqual(defs, []);
    assert.deepEqual(uses, ['a', 'b', 'c', '@k', '1']);
});

test('a container key: the container is recorded, and its entries are the definitions', () => {
    const { defs, uses } = extract('NGame = { START = 1 inner = { x = y } bare }\nother = { }\n', {
        containers: new Set(['NGame']),
    });
    assert.deepEqual(
        defs.map((d) => `${d.form}:${d.container ?? ''}:${d.name}`),
        ['container::NGame', 'entry:NGame:START', 'entry:NGame:inner', 'record::other'],
    );
    assert.deepEqual(uses, ['1', 'x', 'y', 'bare']);
    // With every top-level key a container, a value at the top is still a value.
    assert.deepEqual(
        extract('NGame = { A = 1 }\nloose = 2\n', { containers: 'all' }).defs.map((d) => d.form),
        ['container', 'entry', 'value'],
    );
});

test('a priority field named by the rules is read from the record, or its default', () => {
    const priority = { field: 'id_override_priority', fallback: 0 };
    const { defs } = extract(
        'a = { id_override_priority = 3 }\nb = { }\nc = { id_override_priority = x }\nd = 1\n',
        {
            priority,
        },
    );
    assert.deepEqual(
        defs.map((d) => [d.name, d.extra]),
        [
            ['a', 3],
            ['b', 0],
            ['c', 0],
            ['d', NONE],
        ],
    );
    assert.deepEqual(
        extract('a = { id_override_priority = 3 }\n').defs.map((d) => d.extra),
        [NONE],
    );
});
