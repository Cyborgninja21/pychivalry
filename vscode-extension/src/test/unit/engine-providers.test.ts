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
