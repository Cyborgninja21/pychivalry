/**
 * Providers migrated onto pychivalry-engine (Phase 4): they read the engine's parser,
 * index and spec package and nothing else for CK3 knowledge.
 */

import * as assert from 'assert';
import { DocumentSymbol, Location } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, defaultSpec, Indexer, LocalizationIndex } from 'pychivalry-engine';
import { DocumentSymbolProvider } from '../../server/lsp/symbols';
import { DefinitionProvider } from '../../server/lsp/navigation';
import { RenameProvider } from '../../server/lsp/rename';
import { DocumentLinksProvider } from '../../server/lsp/document-links';
import { SignatureHelpProvider } from '../../server/lsp/signature-help';
import { InlayHintsProvider } from '../../server/lsp/inlay-hints';
import { SemanticTokensProvider } from '../../server/lsp/semantic-tokens';
import { docParameters } from '../../server/lsp/keyword-docs';
import { KEYWORD_SNIPPETS, RECORD_TEMPLATES } from '../../server/lsp/snippets';
import * as path from 'path';
import { Workspace } from 'pychivalry-engine';

const EFFECTS_URI = 'file:///mod/common/scripted_effects/my_effects.txt';
const EVENT_URI = 'file:///mod/events/my_events.txt';

const EFFECTS = 'my_effect = {\n    add_gold = 10\n}\n';
const EVENTS = [
    'namespace = my_events',
    'my_events.0001 = {',
    '    type = character_event',
    '    immediate = {',
    '        my_effect = yes',
    '        add_gold = 5',
    '    }',
    '    trigger = {',
    '        is_adult = yes',
    '    }',
    '}',
    '',
].join('\n');

function setup(): { parser: CK3Parser; index: Indexer; event: TextDocument } {
    const parser = new CK3Parser({ spec: defaultSpec() });
    const index = new Indexer();
    index.indexSync(EFFECTS_URI, parser.parse(EFFECTS).ast);
    index.indexSync(EVENT_URI, parser.parse(EVENTS).ast);
    return { parser, index, event: TextDocument.create(EVENT_URI, 'ck3', 1, EVENTS) };
}

function names(symbols: DocumentSymbol[]): string[] {
    const out: string[] = [];
    const walk = (list: DocumentSymbol[]): void => {
        for (const s of list) {
            out.push(s.name);
            walk(s.children ?? []);
        }
    };
    walk(symbols);
    return out;
}

describe('Providers on the engine (4.1)', () => {
    it('symbols: outline classifies effects and triggers by the engine buckets', async () => {
        const { parser, index, event } = setup();
        const provider = new DocumentSymbolProvider(parser, index, defaultSpec());
        const outline = names(await provider.buildDocumentOutline(event));
        assert.ok(outline.includes('my_events.0001'), outline.join(', '));
        assert.ok(defaultSpec().has('add_gold', 'effects'));
        assert.ok(defaultSpec().has('is_adult', 'triggers'));
    });

    it('navigation: go to definition of a scripted effect resolves through the engine index', async () => {
        const { parser, index, event } = setup();
        const provider = new DefinitionProvider(
            parser,
            index,
            new LocalizationIndex(),
            defaultSpec()
        );
        const result = await provider.navigateToDefinition(event, { line: 4, character: 10 });
        assert.ok(result && result.length > 0, 'no definition found');
        const first = result[0] as Location & { targetUri?: string };
        assert.strictEqual(first.targetUri ?? first.uri, EFFECTS_URI);
    });

    it('rename: a scripted effect is renamable at its call site', async () => {
        const { parser, index, event } = setup();
        const provider = new RenameProvider(parser, index);
        const prepared = await provider.prepareRename(event, { line: 4, character: 10 });
        assert.ok(prepared, 'prepareRename returned nothing');
    });

    it('document links: run over an engine parse without throwing', async () => {
        const { parser, index, event } = setup();
        const provider = new DocumentLinksProvider(parser, index);
        const links = await provider.provideDocumentLinks(event);
        assert.ok(Array.isArray(links));
    });
});

describe('Providers on the engine (4.2)', () => {
    it('docParameters reads the key = lines of the engine usage example', () => {
        const spec = defaultSpec();
        assert.deepStrictEqual(docParameters(spec.doc('add_opinion', 'effects'), 'add_opinion'), [
            'modifier',
            'days',
            'months',
            'years',
            'target',
        ]);
        assert.ok(
            docParameters(spec.doc('trigger_event', 'effects'), 'trigger_event').includes('id')
        );
        assert.deepStrictEqual(docParameters(spec.doc('add_gold', 'effects'), 'add_gold'), []);
    });

    it('signature help: the signature comes from the engine doc', async () => {
        const provider = new SignatureHelpProvider(defaultSpec());
        const text = 'x = {\n\ttrigger_event = {\n\t\tid = a.1\n\t\t\n\t}\n}';
        const doc = TextDocument.create('file:///mod/events/e.txt', 'ck3', 1, text);
        const help = await provider.provideSignatureHelp(doc, { line: 3, character: 2 });
        assert.ok(help, 'no signature');
        assert.ok(help.signatures[0].label.startsWith('trigger_event = { id'));
        assert.strictEqual(help.activeParameter, 1);
    });

    it('inlay hints: a scope:x reference names where x is saved (no scope type)', async () => {
        const workspace = new Workspace(path.resolve('/mod'));
        const parser = new CK3Parser({ spec: workspace.spec });
        const saver = 'a.1 = {\n\timmediate = {\n\t\tsave_scope_as = my_target\n\t}\n}';
        workspace.index.indexSync('file:///mod/events/a.txt', parser.parse(saver).ast);
        const text = 'a.2 = {\n\timmediate = {\n\t\tscope:my_target = { add_gold = 1 }\n\t}\n}';
        const doc = TextDocument.create('file:///mod/events/b.txt', 'ck3', 1, text);
        const hints = await new InlayHintsProvider(parser, workspace).provideInlayHints(doc, {
            start: { line: 0, character: 0 },
            end: { line: 10, character: 0 },
        });
        const labels = hints.map((h) => (typeof h.label === 'string' ? h.label : ''));
        assert.ok(
            labels.some((l) => l.includes('a.txt:3')),
            labels.join(', ')
        );
        assert.ok(!labels.some((l) => l.includes('character')), 'no guessed scope types');
    });

    it('semantic tokens: classify against the spec buckets', async () => {
        const workspace = new Workspace(path.resolve('/mod'));
        const parser = new CK3Parser({ spec: workspace.spec });
        const doc = TextDocument.create('file:///mod/events/e.txt', 'ck3', 1, EVENTS);
        const tokens = await new SemanticTokensProvider(parser, workspace).generateSemanticTokens(
            doc
        );
        assert.ok(tokens.data.length > 0);
    });

    it('snippets: the hand-written tables are small', () => {
        assert.strictEqual(KEYWORD_SNIPPETS.size, 17);
        assert.strictEqual(
            Array.from(RECORD_TEMPLATES.values()).reduce((n, list) => n + list.length, 0),
            3
        );
    });
});
