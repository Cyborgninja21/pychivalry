/**
 * Hover, go to definition, find references, document symbols and completion (docs/PLAN.md item
 * 7.5), over a real round trip, on the fixture mod `lookup-definitions-and-uses` read over the
 * game stub `lookup` (their READMEs say what a correct lookup answers): the hover text is the
 * spec's description; a definition whose winner the override rules name is one target, one
 * whose winner is not known is every definition; completion offers what is valid at the place
 * and nothing that is not.
 */

import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import {
    SymbolKind,
    type DocumentSymbol,
    type MarkupContent,
} from 'vscode-languageserver-protocol/node';
import { escapeMarkdown } from './hover.js';
import { committedSpec, GAMES, MODS, readDocument, spawnServer, uriOf } from './testing.js';

const spec = committedSpec();
const MOD = path.join(MODS, 'lookup-definitions-and-uses');
const GAME = path.join(GAMES, 'lookup', 'game');
const EVENTS = path.join(MOD, 'events', 'fixture_lookup_mod_events.txt');
const CHARACTERS = path.join(MOD, 'history', 'characters', 'zz_fixture_characters.txt');
const LOC = path.join(MOD, 'localization', 'english', 'fixture_lookup_l_english.yml');

/** The line and character of the first `needle` in `text`, plus `shift` characters. */
function at(text: string, needle: string, shift = 0): { line: number; character: number } {
    const offset = text.indexOf(needle);
    assert.ok(offset >= 0, needle);
    const before = text.slice(0, offset + shift);
    const line = before.split('\n').length - 1;
    return { line, character: before.length - before.lastIndexOf('\n') - 1 };
}

const names = (symbols: readonly DocumentSymbol[]): string[] => symbols.map((s) => s.name);

test('hover, definitions, references, symbols and completion on the lookup fixture', async (t) => {
    const { client } = spawnServer(t, { gamePath: GAME });
    await client.start([MOD]);
    await client.settled();
    const events = readDocument(EVENTS);
    const eventsUri = await client.open(EVENTS, events);

    await t.test("hover on a keyword is the spec's description, with its source", async () => {
        const file = path.join(MOD, 'common', 'scripted_triggers', 'zz_fixture_triggers.txt');
        const text = readDocument(file);
        const uri = await client.open(file, text);
        const pos = at(text, 'always', 2);
        const hover = await client.hover(uri, pos.line, pos.character);
        assert.ok(hover !== null);
        const value = (hover.contents as MarkupContent).value;
        const doc = spec.data.buckets.triggers['always']?.doc ?? '';
        assert.ok(doc !== '', 'the spec describes it');
        assert.ok(value.includes(escapeMarkdown(doc)), `${value}\n---\n${doc}`);
        assert.match(value, /\*\*`always`\*\*/);
        assert.match(value, /From the game's own text/);
        assert.deepEqual(hover.range, { start: at(text, 'always'), end: at(text, 'always', 6) });
        await client.close(uri);
    });

    await t.test(
        'hover on a scripted trigger says where it is defined and which is in force',
        async () => {
            const pos = at(events, 'fixture_scripted_trigger', 3);
            const hover = await client.hover(eventsUri, pos.line, pos.character);
            assert.ok(hover !== null);
            const value = (hover.contents as MarkupContent).value;
            assert.match(value, /common\/scripted\\_triggers: 2 definitions; the one in force/);
            assert.match(
                value,
                /`mod common\/scripted_triggers\/zz_fixture_triggers\.txt:1` \(in force\)/,
            );
            assert.match(value, /`game common\/scripted_triggers\/00_fixture_triggers\.txt:\d+`/);
        },
    );

    await t.test('a name nothing knows has no hover', async () => {
        const uri = await client.open(
            path.join(MOD, 'events', 'unknown_words.txt'),
            'zzz_nothing_knows_this = {}\n',
        );
        assert.equal(await client.hover(uri, 0, 3), null);
        await client.close(uri);
    });

    await t.test(
        'definition: the winner where the rules name one, every definition where not',
        async () => {
            const pos = at(events, 'fixture_scripted_trigger');
            const one = await client.definition(eventsUri, pos.line, pos.character + 2);
            assert.deepEqual(
                one?.map((l) => l.uri),
                [uriOf(path.join(MOD, 'common', 'scripted_triggers', 'zz_fixture_triggers.txt'))],
            );
            const characters = readDocument(CHARACTERS);
            const uri = await client.open(CHARACTERS, characters);
            const both = await client.definition(uri, 0, 3);
            assert.deepEqual(
                new Set(both?.map((l) => l.uri)),
                new Set([
                    uriOf(path.join(GAME, 'history', 'characters', '00_fixture_characters.txt')),
                    uriOf(CHARACTERS),
                ]),
                'winner not known: both definitions',
            );
            await client.close(uri);
        },
    );

    await t.test(
        'references: every use in the mod and the base game, definitions when asked',
        async () => {
            const pos = at(events, 'fixture_scripted_trigger');
            const uses = await client.references(eventsUri, pos.line, pos.character + 1);
            assert.equal(uses?.length, 5);
            assert.equal(uses.filter((l) => l.uri === eventsUri).length, 2);
            assert.equal(
                uses.filter(
                    (l) => l.uri === uriOf(path.join(GAME, 'events', 'fixture_lookup_events.txt')),
                ).length,
                3,
            );
            const all = await client.references(eventsUri, pos.line, pos.character + 1, true);
            assert.equal(all?.length, 7);
        },
    );

    await t.test(
        'document symbols: the top-level keys, with what the index read them as',
        async () => {
            const symbols = (await client.symbols(eventsUri)) ?? [];
            assert.deepEqual(names(symbols), ['namespace', 'fixture_lookup_mod.1']);
            const event = symbols[1];
            // The events outline rule of the presentation data (item 8.8): an event, its type.
            assert.equal(event?.kind, SymbolKind.Event);
            assert.equal(event.detail, 'character_event');
            assert.deepEqual(event.selectionRange, {
                start: { line: 2, character: 0 },
                end: { line: 2, character: 'fixture_lookup_mod.1'.length },
            });
            const loc = readDocument(LOC);
            const locUri = await client.open(LOC, loc, 'ck3-localization');
            const locSymbols = (await client.symbols(locUri)) ?? [];
            assert.equal(locSymbols.length, 1);
            assert.equal(locSymbols[0]?.kind, SymbolKind.Namespace);
            assert.equal(locSymbols[0].name, 'l_english');
            assert.ok((locSymbols[0].children ?? []).length > 0);
            await client.close(locUri);
        },
    );

    await t.test(
        'completion offers what is valid at the place, and nothing that is not',
        async () => {
            const buckets = spec.data.buckets;
            const triggerOnly = Object.keys(buckets.triggers).filter(
                (n) => !(n in buckets.effects) && !(n in buckets.links),
            );
            const effectOnly = Object.keys(buckets.effects).filter(
                (n) => !(n in buckets.triggers) && !(n in buckets.links),
            );
            // In the event's trigger block.
            const trig = at(events, 'fixture_scripted_trigger = yes');
            const inTrigger = await client.completion(eventsUri, trig.line, trig.character);
            assert.ok(inTrigger !== null);
            const offered = new Set(inTrigger.items.map((i) => i.label));
            assert.ok(
                offered.has('fixture_scripted_trigger'),
                'a scripted trigger the mod defines',
            );
            assert.ok(offered.has('NOT') || offered.has('OR'), 'a structural key');
            assert.ok(
                triggerOnly.some((n) => offered.has(n)),
                'a trigger',
            );
            assert.deepEqual(
                effectOnly.filter((n) => offered.has(n)),
                [],
                'no effect in a trigger block',
            );
            // In the immediate block (effects).
            const eff = at(events, 'every_fixture_list');
            const inEffect = await client.completion(eventsUri, eff.line, eff.character);
            const effects = new Set(inEffect?.items.map((i) => i.label));
            assert.ok(
                effectOnly.some((n) => effects.has(n)),
                'an effect',
            );
            assert.deepEqual(
                triggerOnly.filter((n) => effects.has(n)),
                [],
                'no trigger in an effect block',
            );
            // The value of the event's type: what the base game writes there.
            const type = at(events, 'character_event');
            const values = await client.completion(eventsUri, type.line, type.character);
            const typeField = spec.data.schema['events']?.fields['type'];
            assert.deepEqual(
                values?.items.map((i) => i.label).sort(),
                (typeField?.values ?? []).map((v) => v.value).sort(),
            );
            // Each item replaces the word written at the place.
            const item = values.items[0];
            assert.ok(item?.textEdit !== undefined && 'range' in item.textEdit);
            assert.deepEqual(item.textEdit.range, {
                start: type,
                end: { line: type.line, character: type.character + 'character_event'.length },
            });
        },
    );
});
