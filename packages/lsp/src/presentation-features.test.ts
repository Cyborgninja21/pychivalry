/**
 * The language server's use of the presentation data (docs/PLAN.md item 8.8), over a real round
 * trip, on the fixture mod `presentation-outline-and-hints` read over an empty game stub (its
 * README says what a correct server answers): document symbols follow the outline rules where
 * a folder has one and keep the plain outline elsewhere; completion offers the snippets where
 * they are valid, to an editor that takes them, and orders fields by the field order; inlay
 * hints show the localized names and the scopes links switch to, bounded, cancellable, and off
 * when the setting says so.
 */

import { parse, type FileNode } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
    CompletionItemKind,
    InsertTextFormat,
    SymbolKind,
    type CompletionList,
    type DocumentSymbol,
    type InlayHint,
} from 'vscode-languageserver-protocol/node';
import { inlayHints, MAX_HINTS, MAX_TEXT, shortText } from './inlay-hints.js';
import { outlineSymbols } from './outline.js';
import { pathAt } from './presented-completion.js';
import { loadPresentation, NO_PRESENTATION } from './presentation.js';
import {
    committedSpec,
    gameStub,
    MODS,
    scratch,
    spawnServer,
    uriOf,
    type TestClient,
} from './testing.js';

const spec = committedSpec();
const MOD = path.join(MODS, 'presentation-outline-and-hints');
const EVENTS = path.join(MOD, 'events', 'presentation_events.txt');
const DECISIONS = path.join(MOD, 'common', 'decisions', 'presentation_decisions.txt');
const EFFECTS = path.join(MOD, 'common', 'scripted_effects', 'presentation_effects.txt');

/** The line and character of the first `needle` in `text`, plus `shift` characters. */
function at(text: string, needle: string, shift = 0): { line: number; character: number } {
    const offset = text.indexOf(needle);
    assert.ok(offset >= 0, needle);
    const before = text.slice(0, offset + shift);
    const line = before.split('\n').length - 1;
    return { line, character: before.length - before.lastIndexOf('\n') - 1 };
}

/** Start a session as an editor that takes snippets and can be asked to refresh hints. */
async function start(client: TestClient, snippets: boolean): Promise<Record<string, unknown>> {
    const result = await client.connection.sendRequest('initialize', {
        processId: null,
        rootUri: uriOf(MOD),
        workspaceFolders: [{ uri: uriOf(MOD), name: path.basename(MOD) }],
        capabilities: {
            workspace: {
                configuration: true,
                didChangeConfiguration: { dynamicRegistration: true },
                workspaceFolders: true,
                inlayHint: { refreshSupport: false },
            },
            window: { workDoneProgress: true },
            textDocument: {
                completion: { completionItem: { snippetSupport: snippets } },
                documentSymbol: { hierarchicalDocumentSymbolSupport: true },
                inlayHint: {},
            },
        },
    });
    await client.connection.sendNotification('initialized', {});
    await client.settled();
    return result as Record<string, unknown>;
}

async function hints(client: TestClient, uri: string, text: string): Promise<InlayHint[]> {
    const lines = text.split('\n');
    return client.connection.sendRequest('textDocument/inlayHint', {
        textDocument: { uri },
        range: {
            start: { line: 0, character: 0 },
            end: { line: lines.length - 1, character: lines.at(-1)?.length ?? 0 },
        },
    });
}

async function completion(
    client: TestClient,
    uri: string,
    position: { line: number; character: number },
): Promise<CompletionList> {
    const list: CompletionList | null = await client.connection.sendRequest(
        'textDocument/completion',
        { textDocument: { uri }, position },
    );
    assert.ok(list !== null);
    return list;
}

const label = (h: InlayHint): string => (typeof h.label === 'string' ? h.label : '');

test('outline, snippets, field order and inline hints on the presentation fixture', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const { client } = spawnServer(t, { gamePath: game });
    const init = await start(client, true);
    const caps = init['capabilities'] as Record<string, unknown>;
    assert.equal(caps['inlayHintProvider'], true);
    const events = readFileSync(EVENTS, 'utf8');
    const eventsUri = await client.open(EVENTS, events);
    const decisions = readFileSync(DECISIONS, 'utf8');
    const decisionsUri = await client.open(DECISIONS, decisions);

    await t.test('the outline follows the folder rule: an event and its blocks', async () => {
        const symbols = (await client.symbols(eventsUri)) ?? [];
        assert.deepEqual(
            symbols.map((s) => s.name),
            [
                'namespace',
                'presentation_local_trigger',
                'presentation_fixture.1',
                'presentation_fixture.2',
            ],
        );
        // The namespace and the local scripted trigger keep the plain outline.
        assert.equal(symbols[0]?.kind, SymbolKind.Property);
        assert.notEqual(symbols[1]?.kind, SymbolKind.Event);
        assert.deepEqual(
            symbols.slice(2).map((s) => [s.kind, s.detail]),
            [
                [SymbolKind.Event, 'character_event'],
                [SymbolKind.Event, 'events'],
            ],
        );
        const children = symbols[2]?.children ?? [];
        assert.deepEqual(
            children.map((c) => [c.name, c.kind]),
            [
                ['immediate', SymbolKind.Function],
                ['presentation_fixture.1.a', SymbolKind.EnumMember],
                ['presentation_fixture.1.b', SymbolKind.EnumMember],
            ],
        );
        const option = children[1];
        assert.deepEqual(option?.selectionRange, {
            start: at(events, 'option'),
            end: at(events, 'option', 'option'.length),
        });
    });

    await t.test(
        'a decision by its rule; a folder without a rule keeps the plain outline',
        async () => {
            const symbols = (await client.symbols(decisionsUri)) ?? [];
            assert.equal(symbols[0]?.kind, SymbolKind.Function);
            // No title: the plain detail, the database it defines.
            assert.equal(symbols[0].detail, 'common/decisions');
            assert.deepEqual(
                (symbols[0].children ?? []).map((c) => [c.name, c.kind]),
                [
                    ['is_shown', SymbolKind.Object],
                    ['effect', SymbolKind.Function],
                    ['ai_will_do', SymbolKind.Object],
                ],
            );
            const effects = readFileSync(EFFECTS, 'utf8');
            const uri = await client.open(EFFECTS, effects);
            const plain = (await client.symbols(uri)) ?? [];
            assert.deepEqual(
                plain.map((s) => [s.name, s.kind, s.detail, s.children]),
                [['presentation_effect', SymbolKind.Object, 'common/scripted_effects', undefined]],
            );
            await client.close(uri);
        },
    );

    await t.test('the top level of a file offers its folder snippets, as snippets', async () => {
        const end = events.split('\n').length - 1;
        const list = await completion(client, eventsUri, { line: end, character: 0 });
        const snippets = list.items.filter((i) => i.kind === CompletionItemKind.Snippet);
        assert.deepEqual(
            snippets.map((s) => s.label),
            ['namespace', 'event', 'hidden event'],
        );
        const event = snippets[1];
        assert.equal(event?.insertTextFormat, InsertTextFormat.Snippet);
        assert.ok(event.textEdit !== undefined && 'newText' in event.textEdit);
        assert.match(event.textEdit.newText, /^\$\{1:my_namespace\}\.\$\{2:1\} = \{\n\ttype = /);
        // Not inside a block, a comment or quoted text.
        const inside = await completion(client, eventsUri, at(events, 'add_gold'));
        assert.ok(!inside.items.some((i) => i.label === 'event'));
    });

    await t.test(
        'in a record body, fields come in the field order, the next preselected',
        async () => {
            // On the blank line made before `effect`: written so far are picture and is_shown.
            const changed = decisions.replace('\teffect = {', '\t\n\teffect = {');
            await client.change(decisionsUri, [{ text: changed }]);
            const list = await completion(client, decisionsUri, at(changed, '\t\n\teffect', 1));
            const fields = list.items
                .filter((i) => i.kind === CompletionItemKind.Field && i.sortText?.startsWith('0'))
                .sort((a, b) => (a.sortText ?? '').localeCompare(b.sortText ?? ''))
                .map((i) => i.label);
            assert.deepEqual(fields.slice(0, 5), [
                'picture',
                'cooldown',
                'ai_check_interval',
                'is_shown',
                'is_valid',
            ]);
            const preselected = list.items.filter((i) => i.preselect === true).map((i) => i.label);
            assert.deepEqual(preselected, ['is_valid'], 'the first of the order after is_shown');
            // The folder's field snippets for the fields offered here, after their field.
            const snippets = list.items.filter((i) => i.kind === CompletionItemKind.Snippet);
            assert.deepEqual(snippets.map((s) => s.label).sort(), [
                'ai_check_interval',
                'ai_will_do',
                'cost',
                'effect',
                'is_shown',
                'is_valid',
            ]);
            const isValid = snippets.find((s) => s.label === 'is_valid');
            const field = list.items.find(
                (i) => i.label === 'is_valid' && i.kind === CompletionItemKind.Field,
            );
            assert.ok((field?.sortText ?? '') < (isValid?.sortText ?? ''));
            // Everything else after the ordered fields.
            const other = list.items.find(
                (i) => i.kind !== CompletionItemKind.Field && i.kind !== CompletionItemKind.Snippet,
            );
            assert.ok(other === undefined || (other.sortText ?? '') > '1');
            await client.change(decisionsUri, [{ text: decisions }]);
        },
    );

    await t.test('inlay hints: localized names and the scopes links switch to', async () => {
        const found = (await hints(client, eventsUri, events)).map((h) => [
            h.position.line,
            label(h),
        ]);
        assert.deepEqual(found, [
            [at(events, 'presentation_fixture.1 =').line, 'The Fixture Begins'],
            [at(events, 'liege').line, ': character'],
            [at(events, 'every_vassal').line, ': character'],
            [at(events, 'name = presentation_fixture.1.a').line - 1, 'Agree'],
            [at(events, 'name = presentation_fixture.1.b').line - 1, 'Refuse, at length'],
        ]);
        const first = (await hints(client, eventsUri, events))[0];
        assert.deepEqual(
            first?.position,
            at(events, 'presentation_fixture.1', 'presentation_fixture.1'.length),
        );
        assert.equal(first.tooltip, 'presentation_fixture.1.t');
        const decision = await hints(client, decisionsUri, decisions);
        assert.deepEqual(decision.map(label), ['Take the Fixture Decision']);
        assert.equal(decision[0]?.tooltip, 'presentation_decision');
    });

    await t.test('the setting turns the inline hints off, and on again', async () => {
        await client.configure({ gamePath: game, inlayHints: { enabled: false } });
        let off: InlayHint[] = [];
        for (let i = 0; i < 50; i++) {
            off = await hints(client, eventsUri, events);
            if (off.length === 0) {
                break;
            }
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.deepEqual(off, []);
        await client.configure({ gamePath: game, inlayHints: { enabled: true } });
        let on: InlayHint[] = [];
        for (let i = 0; i < 50 && on.length === 0; i++) {
            on = await hints(client, eventsUri, events);
            await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.equal(on.length, 5);
    });
});

test('an editor that takes no snippets is offered none', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const { client } = spawnServer(t, { gamePath: game });
    await start(client, false);
    const events = readFileSync(EVENTS, 'utf8');
    const uri = await client.open(EVENTS, events);
    const end = events.split('\n').length - 1;
    const list = await completion(client, uri, { line: end, character: 0 });
    assert.deepEqual(
        list.items.filter((i) => i.kind === CompletionItemKind.Snippet),
        [],
    );
    const decisions = readFileSync(DECISIONS, 'utf8');
    const decisionsUri = await client.open(DECISIONS, decisions);
    const inBody = await completion(client, decisionsUri, at(decisions, 'effect'));
    assert.deepEqual(
        inBody.items.filter((i) => i.kind === CompletionItemKind.Snippet),
        [],
    );
    // The field order still applies.
    assert.ok(inBody.items.some((i) => i.label === 'effect' && i.sortText?.startsWith('0')));
});

// ─── Bounds and cancellation, without a server ─────────────────────────────

function hintInput(
    tree: FileNode,
    text: string,
    extra: object = {},
): Parameters<typeof inlayHints>[0] {
    const lines = parse(text).lines;
    return {
        spec,
        // Not read: these hints do not include the scope a link switches to.
        folders: undefined as never,
        file: 'events/many.txt',
        folder: 'events',
        tree,
        start: 0,
        end: text.length,
        positionAt: (offset) => lines.rangeOf(offset, offset).start,
        presentation: { ...loadPresentation(), every: { hints: [], language: 'l_english' } },
        names: undefined as never,
        text: () => 'A title',
        ...extra,
    };
}

test('inlay hints are bounded, and stop when the editor cancels', async () => {
    const records = Array.from(
        { length: MAX_HINTS + 200 },
        (_, i) => `many.${String(i)} = {\n\ttitle = many.${String(i)}.t\n}\n`,
    ).join('');
    const tree = parse(records).file;
    const all = await inlayHints(hintInput(tree, records));
    assert.equal(all.length, MAX_HINTS);
    // Only the span asked for.
    const second = records.indexOf('many.1 =');
    const one = await inlayHints(
        hintInput(tree, records, { start: second, end: second + 'many.1 = {'.length }),
    );
    assert.deepEqual(one.map(label), ['A title']);
    // A request the editor cancels returns nothing.
    const cancelled = await inlayHints(
        hintInput(tree, records, {
            token: {
                isCancellationRequested: true,
                onCancellationRequested: () => ({ dispose: () => undefined }),
            },
        }),
    );
    assert.deepEqual(cancelled, []);
    assert.equal(shortText('x'.repeat(MAX_TEXT + 10)).length, MAX_TEXT);
    assert.equal(shortText('one\\ntwo   three'), 'one two three');
});

test('with no presentation data, the outline is the plain one', () => {
    const tree = parse('a.1 = {\n\toption = { }\n}\n').file;
    const plain: DocumentSymbol[] = [
        {
            name: 'a.1',
            kind: SymbolKind.Object,
            range: { start: { line: 0, character: 0 }, end: { line: 2, character: 1 } },
            selectionRange: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } },
        },
    ];
    const rangeOf = (): DocumentSymbol['range'] => plain[0]?.range ?? ({} as never);
    assert.equal(
        outlineSymbols(plain, { tree, rangeOf, folder: 'events', presentation: NO_PRESENTATION }),
        plain,
    );
    assert.equal(
        outlineSymbols(plain, { tree, rangeOf, folder: null, presentation: loadPresentation() }),
        plain,
    );
});

test('completion reads the path of keys to its place; a bare block ends it', () => {
    const text = 'a.1 = {\n\toption = {\n\t\tx\n\t}\n\t{ y }\n}\n';
    const tree = parse(text).file;
    const keys = pathAt(tree, text.indexOf('x')).pairs.map((p) => p.key.text);
    assert.deepEqual(keys, ['a.1', 'option']);
    assert.deepEqual(pathAt(tree, text.indexOf('y')).bare, true);
    assert.deepEqual(pathAt(tree, text.length).pairs, []);
});
