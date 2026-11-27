/**
 * The GUI parser (docs/PLAN.md item 10.2): every form of docs/gui-syntax.md, each written as the
 * base game writes it, and each recovery path, with where its finding is.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findingMessage } from '../syntax/findings.js';
import { parseGui, readGui } from './parser.js';
import { guiSummary } from './testing.js';
import type { GuiNamed, GuiProperty, GuiType } from './tree.js';

function tree(text: string): string {
    const result = parseGui(text);
    assert.deepEqual(
        result.findings.map((f) => f.id),
        [],
        `no finding expected in: ${text}`,
    );
    return guiSummary(result.file.items);
}

function found(text: string): { id: string; line: number; column: number; message: string }[] {
    return parseGui(text).findings.map((f) => ({
        id: f.id,
        line: f.range.start.line + 1,
        column: f.range.start.character + 1,
        message: findingMessage(f),
    }));
}

test('a widget: properties with words, quoted text, numbers, flags and blocks', () => {
    assert.equal(
        tree(
            'window = {\n\tname = "accolade_view"\n\tsize = { 480 770 }\n\tparentanchor = top|right\n\tposition = { -630 170 }\n\tmovable = no\n}',
        ),
        'window = { name = "accolade_view" size = { 480 770 } parentanchor = top|right position = { -630 170 } movable = no }',
    );
});

test('values with units: a percent, a float with f, a bare data binding, a constant, @[ ]', () => {
    assert.equal(
        tree(
            '@w = 8\nwidget = { size = { 100% 50% } glow_texture_downscale = 5.5f visible = [Character.IsValid] spacing = @w width = @[w + 2] }',
        ),
        '@w = 8 widget = { size = { 100% 50% } glow_texture_downscale = 5.5f visible = [Character.IsValid] spacing = @w width = @[w + 2] }',
    );
    const widget = parseGui('a = { b = 100% }').file.items[0] as GuiProperty;
    assert.equal(widget.value?.kind, 'gui-block');
});

test('types blocks and type definitions, the base on the same line or the block on the next', () => {
    assert.equal(
        tree(
            'types AccoladeWindowTypes\n{\n\ttype accolade_banner = icon {\n\t\tsize = { 98 103 }\n\t}\n\ttype accolade_rank_icon = icon\n\t{\n\t}\n}',
        ),
        'types AccoladeWindowTypes { type accolade_banner = icon { size = { 98 103 } } type accolade_rank_icon = icon { } }',
    );
    const types = parseGui('types T { type a = b { x = 1 } }').file.items[0] as GuiNamed;
    assert.equal(types.kind, 'gui-named');
    assert.equal(types.keyword.text, 'types');
    assert.equal(types.name?.text, 'T');
    const type = types.body.items[0] as GuiType;
    assert.equal(type.kind, 'gui-type');
    assert.equal(type.name.text, 'a');
    assert.equal(type.base?.text, 'b');
    assert.equal(type.body?.items.length, 1);
});

test('local_type, which the install writes in its own tool windows', () => {
    assert.equal(
        tree('types T { local_type material_setter_info = flowcontainer { spacing = 4 } }'),
        'types T { local_type material_setter_info = flowcontainer { spacing = 4 } }',
    );
});

test('the keyword of a named block in another letter case: Types', () => {
    const named = parseGui('Types SaveGameTypes { type a = b {} }').file.items[0] as GuiNamed;
    assert.equal(named.kind, 'gui-named');
    assert.equal(named.keyword.text, 'Types');
});

test('templates, quoted or not, local templates and using', () => {
    assert.equal(
        tree(
            'template Window_Background { using = Mask }\ntemplate "Quoted_Name" { alpha = 0.3 }\nlocal_template Local { margin_right = -18 }\nw = { using = Window_Background using = "Quoted_Name" }',
        ),
        'template Window_Background { using = Mask } template "Quoted_Name" { alpha = 0.3 } local_template Local { margin_right = -18 } w = { using = Window_Background using = "Quoted_Name" }',
    );
});

test('block and blockoverride: quoted, single-quoted, bare and written with =', () => {
    assert.equal(
        tree(
            'w = {\n\tblock "header_text" { text = "A" }\n\tblockoverride "header_text"\n\t{\n\t\ttext = "B"\n\t}\n\tblock \'datacontext\' { }\n\tblockoverride onclick { onclick = "[X]" }\n\tblockoverride = "scrollbox_content" { name = "c" }\n\tblock = "b" { }\n}',
        ),
        'w = { block "header_text" { text = "A" } blockoverride "header_text" { text = "B" } block \'datacontext\' { } blockoverride onclick { onclick = "[X]" } blockoverride = "scrollbox_content" { name = "c" } block = "b" { } }',
    );
});

test('layers, and a property named layer', () => {
    assert.equal(
        tree('layer debug { priority = 1 }\nwindow = { layer = middle }'),
        'layer debug { priority = 1 } window = { layer = middle }',
    );
    const window = parseGui('window = { layer = middle }').file.items[0] as GuiProperty;
    const inner = window.value?.kind === 'gui-block' ? window.value.items[0] : undefined;
    assert.equal(inner?.kind, 'gui-property');
});

test('comments are kept, each in the block that holds it', () => {
    assert.equal(
        tree('# top\nw = { # inside\n\tsize = { 1 2 } # after\n}'),
        '(# top) w = { (# inside) size = { 1 2 } (# after) }',
    );
});

test('a list of values is read as written, two values on one line included', () => {
    assert.equal(tree('w = { points = { 1 2 3 4 } }'), 'w = { points = { 1 2 3 4 } }');
});

test('a block still open at the end of the file', () => {
    assert.deepEqual(found('w = {\n\tsize = { 1 2 }\n'), [
        {
            id: 'syntax/gui-missing-closing-brace',
            line: 1,
            column: 5,
            message: "A block is still open at the end of the file: its '}' is missing.",
        },
    ]);
    assert.equal(
        guiSummary(parseGui('w = {\n\tsize = { 1 2 }\n').file.items),
        'w = { size = { 1 2 }',
    );
});

test("a '}' with no block open", () => {
    assert.deepEqual(found('w = { }\n}\n'), [
        {
            id: 'syntax/gui-unexpected-closing-brace',
            line: 2,
            column: 1,
            message: "A '}' at the top level of the file, where no block is open.",
        },
    ]);
});

test('an operator with no key, and an operator other than =', () => {
    // The value after the operator is that statement's, kept and not reported again.
    assert.deepEqual(
        found('w = { = 3 }').map((f) => f.id),
        ['syntax/gui-operator-without-key'],
    );
    assert.deepEqual(
        found('w = { a = 1 = 3 }').map((f) => f.id),
        ['syntax/gui-operator-without-key'],
    );
    assert.equal(guiSummary(parseGui('w = { a = 1 = 3 }').file.items), 'w = { a = 1 3 }');
    assert.deepEqual(found('w = { size > { 1 2 } }'), [
        {
            id: 'syntax/gui-operator-not-equals',
            line: 1,
            column: 12,
            message:
                "The operator '>' where a GUI file writes '=': every statement of a GUI file is 'key = value'.",
        },
    ]);
});

test('a key with no value after its =', () => {
    assert.deepEqual(found('w = { name = }'), [
        {
            id: 'syntax/gui-missing-value',
            line: 1,
            column: 12,
            message: "'name' has no value after its '='.",
        },
    ]);
    assert.equal(guiSummary(parseGui('w = { name = }').file.items), 'w = { name = <none> }');
});

test('a key and its block or value with no = between them, among statements', () => {
    assert.deepEqual(found('w = {\n\tname = "x"\n\tsize { 5 0 }\n\talign right|top\n}'), [
        {
            id: 'syntax/gui-missing-equals',
            line: 3,
            column: 7,
            message:
                "'size' and its value have no '=' between them: a GUI file writes 'key = value' and 'key = { ... }'.",
        },
        {
            id: 'syntax/gui-missing-equals',
            line: 4,
            column: 8,
            message:
                "'align' and its value have no '=' between them: a GUI file writes 'key = value' and 'key = { ... }'.",
        },
    ]);
    assert.equal(
        guiSummary(
            parseGui('w = {\n\tname = "x"\n\tsize { 5 0 }\n\talign right|top\n}').file.items,
        ),
        'w = { name = "x" size <none> { 5 0 } align <none> right|top }',
    );
});

test('a value standing among statements, and a block with no key', () => {
    assert.deepEqual(found('w = {\n\tname = "x"\n\tstray\n\tsize = 1\n\t{ a = 1 }\n}'), [
        {
            id: 'syntax/gui-value-without-key',
            line: 3,
            column: 2,
            message: "The value 'stray' stands among statements with no key in front of it.",
        },
        {
            id: 'syntax/gui-block-without-key',
            line: 5,
            column: 2,
            message: 'A block with no key in front of it, among statements.',
        },
    ]);
    // A value followed by a block, on its line or the next, is a key whose `=` is missing.
    assert.deepEqual(
        found('w = {\n\tname = "x"\n\tstray\n\t{ a = 1 }\n}').map((f) => f.id),
        ['syntax/gui-missing-equals'],
    );
    // At the top level a file holds statements, whatever else it holds.
    assert.deepEqual(
        found('stray').map((f) => f.id),
        ['syntax/gui-value-without-key'],
    );
});

test('a named-block keyword followed by its block with no name', () => {
    assert.deepEqual(found('template { alpha = 1 }'), [
        {
            id: 'syntax/gui-missing-block-name',
            line: 1,
            column: 10,
            message: "'template' is followed by its block with no name between them.",
        },
    ]);
    assert.equal(
        guiSummary(parseGui('template { alpha = 1 }').file.items),
        'template <none> { alpha = 1 }',
    );
});

test('a type definition without its =, its base or its block', () => {
    const cases: [string, string, string][] = [
        ['types T { type a { } }', "'= <base>' is missing", 'types T { type a <none> <none> { } }'],
        ['types T { type a = { } }', 'its base type is missing', 'types T { type a = <none> { } }'],
        ['types T { type a = b }', 'its block is missing', 'types T { type a = b <none> }'],
        [
            'types T { type a = }',
            'its base type and its block are missing',
            'types T { type a = <none> <none> }',
        ],
    ];
    for (const [text, reason, summary] of cases) {
        const result = parseGui(text);
        assert.deepEqual(
            result.findings.map((f) => findingMessage(f)),
            [`A type definition not written 'type <name> = <base> { ... }': ${reason}.`],
            text,
        );
        assert.equal(guiSummary(result.file.items), summary, text);
    }
});

test("a ';' after a statement, against the word or apart from it", () => {
    assert.deepEqual(
        found('w = {\n\tname = "x"\n\tlayoutpolicy_horizontal = expanding;\n\tonclick = "[A]";\n}'),
        [
            {
                id: 'syntax/gui-trailing-semicolon',
                line: 3,
                column: 37,
                message:
                    "A ';' after 'expanding', which GUI syntax does not use: it is read as part of the word, 'expanding;'.",
            },
            {
                id: 'syntax/gui-trailing-semicolon',
                line: 4,
                column: 17,
                message:
                    "A ';' after '\"[A]\"', which GUI syntax does not use: it is read as a value of its own.",
            },
        ],
    );
});

test('quoted text with no closing quote, and @[ ] that is not well formed', () => {
    assert.deepEqual(
        found('w = { text = "open\n}').map((f) => f.id),
        ['syntax/gui-missing-closing-brace', 'syntax/gui-unterminated-string'],
    );
    assert.deepEqual(found('w = { width = @[a + ] }'), [
        {
            id: 'syntax/gui-malformed-arithmetic',
            line: 1,
            column: 15,
            message: "Malformed inline expression '@[a + ]': unexpected end of the expression",
        },
    ]);
});

test('text cut off mid-edit always gives a tree', () => {
    const text = 'types T {\n\ttype a = b {\n\t\tblockoverride "x"\n\t\t{\n\t\t\tname = ';
    for (let end = 0; end <= text.length; end++) {
        const result = parseGui(text.slice(0, end));
        assert.equal(result.file.kind, 'gui-file');
        assert.ok(result.findings.every((f) => f.severity === 'information'));
    }
});

test('the byte-order mark is removed and not counted in positions', () => {
    const result = readGui(Buffer.from('﻿w = {\n\tstray stray2 = 1\n}', 'utf8'));
    assert.equal(result.bom, true);
    assert.equal(result.text.startsWith('w'), true);
    assert.deepEqual(
        result.findings.map((f) => [f.range.start.line, f.range.start.character]),
        [[1, 1]],
    );
});

test('every GUI finding is information and names no catalogue entry', () => {
    const result = parseGui('} = { a { } b c\n"open');
    assert.ok(result.findings.length > 0);
    for (const finding of result.findings) {
        assert.equal(finding.severity, 'information');
        assert.deepEqual(finding.evidence, { kind: 'advice' });
    }
});
