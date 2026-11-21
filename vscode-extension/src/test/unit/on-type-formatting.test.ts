/**
 * On-type formatting (#80): Enter, `}` and `=` edits, strings and comments left alone, CRLF,
 * tab and space settings, and agreement with the document formatter: a file typed with
 * on-type formatting is what the formatter makes of it, and formatting it again changes no
 * indentation.
 */

import * as assert from 'assert';
import { Position, TextEdit } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from 'pychivalry-engine';
import { FormattingProvider } from '../../server/lsp/formatting';
import {
    OnTypeFormattingProvider,
    OnTypeSettings,
    ON_TYPE_TRIGGERS,
} from '../../server/lsp/on-type-formatting';
import { testUri } from './helpers/uri';

const URI = testUri('/mod/events/typed.txt');
const TABS: OnTypeSettings = { insertSpaces: false, tabSize: 4 };
const SPACES: OnTypeSettings = { insertSpaces: true, tabSize: 2 };

const provider = new OnTypeFormattingProvider();

function doc(text: string): TextDocument {
    return TextDocument.create(URI, 'ck3', 1, text);
}

/** The edits for `ch` typed just before `position`, applied. */
function type(text: string, position: Position, ch: string, settings = TABS): string {
    const document = doc(text);
    const edits = provider.provideOnTypeFormattingEdits(document, position, ch, settings);
    return TextDocument.applyEdits(document, edits);
}

function edits(text: string, position: Position, ch: string, settings = TABS): TextEdit[] {
    return provider.provideOnTypeFormattingEdits(doc(text), position, ch, settings);
}

describe('On-type formatting', () => {
    it('registers Enter first and } and = after it', () => {
        assert.deepStrictEqual(ON_TYPE_TRIGGERS, { first: '\n', more: ['}', '='] });
    });

    describe('Enter', () => {
        it('indents one level deeper after an opening brace', () => {
            assert.strictEqual(type('a = {\n', { line: 1, character: 0 }, '\n'), 'a = {\n\t');
        });

        it('keeps the level after a statement', () => {
            assert.strictEqual(
                type('a = {\n\tb = c\n', { line: 2, character: 0 }, '\n'),
                'a = {\n\tb = c\n\t'
            );
        });

        it('follows nested blocks and closed ones', () => {
            const text = 'a = {\n\tb = {\n\t\tc = {\n\t\t\td = e\n\t\t}\n';
            assert.strictEqual(type(text, { line: 5, character: 0 }, '\n'), text + '\t\t');
        });

        it('outdents a new line that starts with }', () => {
            assert.strictEqual(
                type('a = {\n\tb = {\n}', { line: 2, character: 0 }, '\n'),
                'a = {\n\tb = {\n\t}'
            );
        });

        it('replaces indentation written another way', () => {
            assert.strictEqual(type('a = {\n    ', { line: 1, character: 4 }, '\n'), 'a = {\n\t');
        });

        it('honours insertSpaces and tabSize', () => {
            assert.strictEqual(
                type('a = {\n\tb = {\n', { line: 2, character: 0 }, '\n', SPACES),
                'a = {\n\tb = {\n    '
            );
            assert.strictEqual(
                type('a = {\n', { line: 1, character: 0 }, '\n', {
                    insertSpaces: true,
                    tabSize: 4,
                }),
                'a = {\n    '
            );
        });

        it('counts value lists and ignores braces in strings and comments', () => {
            const text = 'a = {\n\tlist = { 1 2 3 }\n\tname = "x { y"\n\t# } {\n';
            assert.strictEqual(type(text, { line: 4, character: 0 }, '\n'), text + '\t');
        });

        it('empties a line left with only white space', () => {
            assert.strictEqual(type('a = {\n\t\n', { line: 2, character: 0 }, '\n'), 'a = {\n\n\t');
        });

        it('works on CRLF files', () => {
            assert.strictEqual(
                type('a = {\r\n\tb = {\r\n', { line: 2, character: 0 }, '\n'),
                'a = {\r\n\tb = {\r\n\t\t'
            );
        });

        it('returns no edit when the depth cannot be determined', () => {
            assert.deepStrictEqual(edits('}\n}\n', { line: 2, character: 0 }, '\n'), []);
            assert.deepStrictEqual(edits('a = "open\n', { line: 1, character: 0 }, '\n'), []);
        });
    });

    describe('}', () => {
        it('aligns a closing brace with the line that opened its block', () => {
            assert.strictEqual(
                type('a = {\n\tb = {\n\t\tc = d\n\t\t}', { line: 3, character: 3 }, '}'),
                'a = {\n\tb = {\n\t\tc = d\n\t}'
            );
            assert.strictEqual(
                type('a = {\n\tb = {\n\t}\n\t}', { line: 3, character: 2 }, '}'),
                'a = {\n\tb = {\n\t}\n}'
            );
        });

        it('copies the opener line indentation (spaces stay spaces)', () => {
            assert.strictEqual(
                type('  a = {\n      b = c\n      }', { line: 2, character: 7 }, '}'),
                '  a = {\n      b = c\n  }'
            );
        });

        it('leaves a brace that is not first on its line', () => {
            assert.deepStrictEqual(
                edits('a = {\n\tb = { c }', { line: 1, character: 10 }, '}'),
                []
            );
        });

        it('never edits a brace inside a string or a comment', () => {
            assert.deepStrictEqual(edits('a = {\n\t\t"}', { line: 1, character: 4 }, '}'), []);
            assert.deepStrictEqual(edits('a = {\n#}', { line: 1, character: 2 }, '}'), []);
        });

        it('returns no edit without an opening brace', () => {
            assert.deepStrictEqual(edits('a = b\n\t}', { line: 1, character: 2 }, '}'), []);
        });

        it('works on CRLF files', () => {
            assert.strictEqual(
                type('a = {\r\n\tb = c\r\n\t}', { line: 2, character: 2 }, '}'),
                'a = {\r\n\tb = c\r\n}'
            );
        });
    });

    describe('=', () => {
        it('pads the operator after a key', () => {
            assert.strictEqual(type('key=', { line: 0, character: 4 }, '='), 'key =');
            assert.strictEqual(type('key=value', { line: 0, character: 4 }, '='), 'key = value');
            assert.strictEqual(type('\tkey>=', { line: 0, character: 6 }, '='), '\tkey >=');
            assert.strictEqual(type('key ?=', { line: 0, character: 6 }, '='), 'key ?=');
        });

        it('leaves = in strings, comments, expressions and without a key', () => {
            assert.deepStrictEqual(edits('a = "b=', { line: 0, character: 7 }, '='), []);
            assert.deepStrictEqual(edits('# b=', { line: 0, character: 4 }, '='), []);
            assert.deepStrictEqual(edits('a = @[b=', { line: 0, character: 8 }, '='), []);
            assert.deepStrictEqual(edits('\t=', { line: 0, character: 2 }, '='), []);
        });
    });

    describe('agreement with the document formatter', () => {
        const fixtures: Record<string, string> = {
            event: [
                'namespace = my_mod',
                '',
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\ttitle = my_mod.0001.t',
                '\ttrigger = {',
                '\t\tis_adult = yes',
                '\t\tage >= 16',
                '\t}',
                '\timmediate = {',
                '\t\tadd_gold = 10',
                '\t}',
                '\toption = {',
                '\t\tname = my_mod.0001.a',
                '\t\tadd_prestige = 50',
                '\t}',
                '}',
            ].join('\n'),
            nested: [
                'my_effect = {',
                '\tif = {',
                '\t\tlimit = {',
                '\t\t\tOR = {',
                '\t\t\t\thas_trait = brave',
                '\t\t\t\thas_trait = shy',
                '\t\t\t}',
                '\t\t}',
                '\t\tadd_gold = 5',
                '\t}',
                '\telse = {',
                '\t\tremove_short_term_gold = 5',
                '\t}',
                '}',
            ].join('\n'),
            lists: [
                'my_culture = {',
                '\tcolor = { 0.8 0.2 0.2 }',
                '\tethos = ethos_courtly',
                '\ttraditions = {',
                '\t\ttradition_a',
                '\t\ttradition_b',
                '\t\ttradition_c',
                '\t\ttradition_d',
                '\t\ttradition_e',
                '\t\ttradition_f',
                '\t}',
                '}',
            ].join('\n'),
            comments: [
                '# A scripted trigger',
                'my_trigger = {',
                '\t# checks the liege',
                '\tliege = {',
                '\t\t# and its gold',
                '\t\tgold > 100',
                '\t}',
                '\tname = "a { b } c"',
                '}',
            ].join('\n'),
        };
        const formatter = new FormattingProvider(new CK3Parser());

        async function format(text: string, settings: OnTypeSettings): Promise<string> {
            const document = doc(text);
            const result = await formatter.formatDocument(document, {
                tabSize: settings.tabSize,
                insertSpaces: settings.insertSpaces,
            });
            return TextDocument.applyEdits(document, result);
        }

        /** Type `text` character by character, applying the on-type edits as an editor does. */
        function typeOut(text: string, settings: OnTypeSettings): string {
            let document = doc('');
            let offset = 0;
            for (const ch of text) {
                document = TextDocument.update(
                    document,
                    [
                        {
                            range: {
                                start: document.positionAt(offset),
                                end: document.positionAt(offset),
                            },
                            text: ch,
                        },
                    ],
                    document.version + 1
                );
                offset++;
                if (ch !== '\n' && ch !== '}' && ch !== '=') {
                    continue;
                }
                const position = document.positionAt(offset);
                const result = provider.provideOnTypeFormattingEdits(
                    document,
                    position,
                    ch,
                    settings
                );
                if (result.length === 0) {
                    continue;
                }
                // The cursor keeps its place relative to the text after it.
                const after = document.getText().length - offset;
                document = TextDocument.update(
                    document,
                    [{ text: TextDocument.applyEdits(document, result) }],
                    document.version + 1
                );
                offset = document.getText().length - after;
            }
            return document.getText();
        }

        const indentation = (text: string): string[] =>
            text.split('\n').map((l) => /^\s*/.exec(l)![0]);

        for (const settings of [TABS, SPACES]) {
            const label = settings.insertSpaces ? `${settings.tabSize} spaces` : 'tabs';
            for (const [name, fixture] of Object.entries(fixtures)) {
                it(`${name} (${label})`, async () => {
                    const formatted = await format(fixture, settings);
                    assert.strictEqual(
                        await format(formatted, settings),
                        formatted,
                        'formatter is stable'
                    );
                    const unindented = formatted
                        .split('\n')
                        .map((l) => l.replace(/^\s+/, ''))
                        .join('\n');
                    const typed = typeOut(unindented, settings);
                    assert.strictEqual(typed, formatted, 'typed text is the formatted text');
                    assert.deepStrictEqual(
                        indentation(await format(typed, settings)),
                        indentation(typed),
                        'formatting the typed text changes no indentation'
                    );
                });
            }
        }
    });
});
