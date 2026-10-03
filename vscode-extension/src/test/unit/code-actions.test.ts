/**
 * Quick fixes per diagnostic code (lsp/code-actions.ts): the 2.2 fixes for the most frequent
 * plug-in codes on the real-mod corpus (#85) and the fixes that existed before.
 */

import * as assert from 'assert';
import { CK3Parser } from 'pychivalry-engine';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CodeAction, Diagnostic, Range, TextEdit } from 'vscode-languageserver/node';
import { CodeActionsProvider } from '../../server/lsp/code-actions';

const URI = 'file:///mod/events/fix.txt';

function range(sl: number, sc: number, el: number, ec: number): Range {
    return { start: { line: sl, character: sc }, end: { line: el, character: ec } };
}

async function fixes(text: string, code: string, r: Range): Promise<CodeAction[]> {
    const doc = TextDocument.create(URI, 'ck3', 1, text);
    const diagnostic: Diagnostic = { range: r, message: code, code };
    const provider = new CodeActionsProvider(new CK3Parser());
    const actions = await provider.provideCodeActions(doc, range(0, 0, 0, 0), [diagnostic]);
    return actions.filter((a) => a.diagnostics?.[0] === diagnostic);
}

function apply(text: string, action: CodeAction): string {
    const edits: TextEdit[] = action.edit?.changes?.[URI] ?? [];
    const doc = TextDocument.create(URI, 'ck3', 1, text);
    return TextDocument.applyEdits(doc, edits);
}

describe('Quick fixes (#85)', () => {
    it('CK3303: indentation with spaces becomes tabs', async () => {
        const text = 'a = {\n        b = c\n}\n';
        const [fix] = await fixes(text, 'CK3303', range(1, 0, 1, 8));
        assert.strictEqual(apply(text, fix), 'a = {\n\t\tb = c\n}\n');
    });

    it('CK3301: mixed tabs and spaces become tabs', async () => {
        const text = 'a = {\n\t    b = c\n}\n';
        const [fix] = await fixes(text, 'CK3301', range(1, 0, 1, 5));
        assert.strictEqual(apply(text, fix), 'a = {\n\t\tb = c\n}\n');
    });

    it('CK3304: trailing whitespace is removed', async () => {
        const text = 'a = b  \t\nc = d\n';
        const [fix] = await fixes(text, 'CK3304', range(0, 5, 0, 8));
        assert.strictEqual(fix.title, 'Remove trailing whitespace');
        assert.strictEqual(apply(text, fix), 'a = b\nc = d\n');
    });

    it('CK3306: spaces around the operator', async () => {
        const text = 'a=b\n';
        const [fix] = await fixes(text, 'CK3306', range(0, 0, 0, 3));
        assert.strictEqual(apply(text, fix), 'a = b\n');
    });

    it('CK3314: the empty block is removed, with its line when it stands alone', async () => {
        const text = 'a = {\n\tlimit = { }\n\tb = c\n}\n';
        const [fix] = await fixes(text, 'CK3314', range(1, 1, 1, 12));
        assert.strictEqual(apply(text, fix), 'a = {\n\tb = c\n}\n');
        const inline = 'a = { x = { } b = c }\n';
        const [fix2] = await fixes(inline, 'CK3314', range(0, 6, 0, 13));
        assert.strictEqual(apply(inline, fix2), 'a = {  b = c }\n');
    });

    it('CK3613: ai_chance = { base = 100 } is added to the option', async () => {
        const text = 'e.1 = {\n\toption = {\n\t\tname = e.1.a\n\t}\n}\n';
        const [fix] = await fixes(text, 'CK3613', range(1, 1, 3, 2));
        assert.strictEqual(
            apply(text, fix),
            'e.1 = {\n\toption = {\n\t\tname = e.1.a\n\t\tai_chance = { base = 100 }\n\t}\n}\n'
        );
        const oneLine = 'e.1 = { option = { name = x } }\n';
        const [fix2] = await fixes(oneLine, 'CK3613', range(0, 8, 0, 29));
        assert.strictEqual(
            apply(oneLine, fix2),
            'e.1 = { option = { name = x ai_chance = { base = 100 } } }\n'
        );
    });

    it('CK4100, CK4101 and CK4102: a localization stub for the key, not for the whole field', async () => {
        const text = 'e.1 = {\n\ttitle = e.1.t\n}\n';
        const [fix] = await fixes(text, 'CK4100', range(1, 1, 1, 14));
        assert.strictEqual(fix.command?.command, 'ck3.generateLocalization');
        assert.deepStrictEqual(fix.command?.arguments, ['e.1.t']);
        const literal = 'e.1 = {\n\tdesc = "Some text"\n}\n';
        const [fix2] = await fixes(literal, 'CK4101', range(1, 1, 1, 19));
        assert.deepStrictEqual(fix2.command?.arguments, ['Some text']);
        const tooltip = 'e = {\n\tcustom_tooltip = "Hello there"\n}\n';
        const [fix3] = await fixes(tooltip, 'CK4102', range(1, 1, 1, 31));
        assert.deepStrictEqual(fix3.command?.arguments, ['Hello there']);
    });

    it('LOC-001 (.yml): the unreadable key is renamed to a readable one', async () => {
        const text = 'l_english:\n my-event 1.t:0 "Title"\n 2nd_key: "x"\n';
        const [fix] = await fixes(text, 'LOC-001', range(1, 0, 1, 99));
        assert.strictEqual(
            apply(text, fix),
            'l_english:\n my_event_1.t:0 "Title"\n 2nd_key: "x"\n'
        );
        const [fix2] = await fixes(text, 'LOC-001', range(2, 0, 2, 99));
        assert.strictEqual(
            apply(text, fix2),
            'l_english:\n my-event 1.t:0 "Title"\n _2nd_key: "x"\n'
        );
    });

    it('unknown_effect_X / unknown_trigger_X: create the definition', async () => {
        const text = 'a = { my_missing_effect = yes }\n';
        for (const code of ['unknown_effect_X', 'unknown_trigger_X']) {
            const [fix] = await fixes(text, code, range(0, 6, 0, 23));
            assert.strictEqual(fix.command?.command, 'ck3.createDefinition');
            assert.deepStrictEqual(fix.command?.arguments, ['my_missing_effect']);
        }
    });

    it('PYCH-R001: the retired name is replaced by the spec package replacement', async () => {
        const text = 'm = { faith_creation_piety_cost_mult = 0.1 }\n';
        const [fix] = await fixes(text, 'PYCH-R001', range(0, 6, 0, 36));
        assert.strictEqual(apply(text, fix), 'm = { rite_creation_piety_cost_mult = 0.1 }\n');
    });

    it('codes without a mechanical fix get no code-specific quick fix', async () => {
        const text = 'a = {\n\trandom_courtier = { add_gold = 1 }\n}\n';
        for (const code of ['CK3317', 'CK3316', 'CK3875', 'CK3977']) {
            const titles = (await fixes(text, code, range(1, 1, 1, 37))).map((a) => a.title);
            assert.deepStrictEqual(titles, [], code);
        }
    });
});
