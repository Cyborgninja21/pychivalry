/**
 * CK3 Explorer (#83): the server's structure builder (lsp/mod-structure.ts: grouping,
 * counts, ordering, locations, empty categories) and the client's tree mapping
 * (client/mod-explorer-model.ts).
 */

import * as assert from 'assert';
import * as path from 'path';
import { CK3Parser, Indexer, LocalizationIndex, pathToUri } from 'pychivalry-engine';
import {
    CATEGORIES,
    compareNames,
    ModStructure,
    ModStructureNode,
} from '../../server/lsp/mod-structure';
import { Debouncer, REVEAL_COMMAND, treeItemSpec } from '../../client/mod-explorer-model';
import { testUri } from './helpers/uri';

const FILES: Record<string, string> = {
    '/mod/events/my_events.txt': [
        'namespace = my_ev',
        '',
        'my_ev.10 = {',
        '\ttype = letter_event',
        '}',
        'my_ev.2 = {',
        '\ttype = character_event',
        '}',
        'my_ev.1 = {',
        '}',
    ].join('\n'),
    '/mod/events/other.txt': 'namespace = alpha\nalpha.0001 = {\n\ttype = activity_event\n}\n',
    '/mod/common/decisions/my_decisions.txt':
        'decision_b = {\n\tai_check_interval = 0\n}\ndecision_a = {\n}\n',
    '/mod/common/decisions/more_decisions.txt': 'decision_a = {\n}\n',
    '/mod/common/scripted_effects/effects.txt': '@cost = 5\nmy_effect = {\n\tadd_gold = 1\n}\n',
    '/mod/common/scripted_triggers/triggers.txt': 'my_trigger = {\n\tis_adult = yes\n}\n',
    '/mod/common/script_values/values.txt': 'my_value = 5\n',
    '/mod/common/on_action/my_on_actions.txt': 'on_birth = {\n\tevents = { my_ev.1 }\n}\n',
};

function setup(): { structure: ModStructure; uri: (p: string) => string } {
    const parser = new CK3Parser();
    const index = new Indexer();
    for (const [file, text] of Object.entries(FILES)) {
        index.indexSync(testUri(file), parser.parse(text).ast);
    }
    const localization = new LocalizationIndex();
    const loc = (p: string) => path.resolve(p);
    localization.indexText(
        loc('/mod/localization/english/b_l_english.yml'),
        'l_english:\n a:0 "1"\n b:0 "2"\n c:0 "3"\n'
    );
    localization.indexText(
        loc('/mod/localization/english/a_l_english.yml'),
        'l_english:\n d:0 "4"\n'
    );
    localization.indexText(
        loc('/mod/localization/french/a_l_french.yml'),
        'l_french:\n a:0 "un"\n'
    );
    return { structure: new ModStructure(index, localization), uri: testUri };
}

function labels(nodes: ModStructureNode[]): string[] {
    return nodes.map((n) => n.label);
}

describe('Mod structure (server)', () => {
    it('lists the categories in order with counts and hides the empty ones', () => {
        const { structure } = setup();
        const top = structure.build();
        assert.deepStrictEqual(
            top.map((n) => [n.label, n.count]),
            [
                ['Events', 4],
                ['Decisions', 3],
                ['Scripted Effects', 1],
                ['Scripted Triggers', 1],
                ['Script Values', 1],
                ['On-Actions', 1],
                ['Localization', 5],
            ]
        );
        // Character Interactions has nothing in this mod.
        assert.ok(CATEGORIES.some((c) => c.label === 'Character Interactions'));
        assert.ok(top.every((n) => n.kind === 'category' && n.children?.category === n.id));
    });

    it('groups events by namespace, in natural order, each with its type and location', () => {
        const { structure, uri } = setup();
        const namespaces = structure.build({ category: 'events' });
        assert.deepStrictEqual(
            namespaces.map((n) => [n.label, n.count, n.kind]),
            [
                ['alpha', 1, 'group'],
                ['my_ev', 3, 'group'],
            ]
        );
        const events = structure.build(namespaces[1].children);
        assert.deepStrictEqual(
            events.map((n) => [n.label, n.detail]),
            [
                ['my_ev.1', 'character_event'],
                ['my_ev.2', 'character_event'],
                ['my_ev.10', 'letter_event'],
            ]
        );
        assert.deepStrictEqual(events[2].location, {
            uri: uri('/mod/events/my_events.txt'),
            range: { start: { line: 2, character: 0 }, end: { line: 4, character: 0 } },
        });
        assert.ok(events.every((n) => n.kind === 'item' && n.children === undefined));
        assert.strictEqual(new Set(events.map((n) => n.id)).size, events.length);
    });

    it('lists flat categories by name, a duplicate once per file, constants left out', () => {
        const { structure, uri } = setup();
        const decisions = structure.build({ category: 'decisions' });
        assert.deepStrictEqual(
            decisions.map((n) => [n.label, n.detail]),
            [
                ['decision_a', 'more_decisions.txt'],
                ['decision_a', 'my_decisions.txt'],
                ['decision_b', 'my_decisions.txt'],
            ]
        );
        assert.deepStrictEqual(decisions[2].location?.range.start, { line: 0, character: 0 });
        assert.strictEqual(
            decisions[2].location?.uri,
            uri('/mod/common/decisions/my_decisions.txt')
        );
        assert.deepStrictEqual(labels(structure.build({ category: 'scripted_effects' })), [
            'my_effect',
        ]);
        assert.deepStrictEqual(labels(structure.build({ category: 'on_actions' })), ['on_birth']);
        assert.deepStrictEqual(structure.build({ category: 'character_interactions' }), []);
        assert.deepStrictEqual(structure.build({ category: 'no_such_category' }), []);
    });

    it('counts localization keys per language and lists the files', () => {
        const { structure } = setup();
        const languages = structure.build({ category: 'localization' });
        assert.deepStrictEqual(
            languages.map((n) => [n.label, n.count]),
            [
                ['english', 4],
                ['french', 1],
            ]
        );
        const english = structure.build(languages[0].children);
        assert.deepStrictEqual(
            english.map((n) => [n.label, n.count]),
            [
                ['a_l_english.yml', 1],
                ['b_l_english.yml', 3],
            ]
        );
        assert.strictEqual(
            english[1].location?.uri,
            pathToUri(path.resolve('/mod/localization/english/b_l_english.yml'))
        );
    });

    it('an empty index has no categories', () => {
        const structure = new ModStructure(new Indexer(), new LocalizationIndex());
        assert.deepStrictEqual(structure.build(), []);
    });

    it('compares names naturally', () => {
        assert.deepStrictEqual(['a.10', 'a.2', 'a.1', 'b', 'a'].sort(compareNames), [
            'a',
            'a.1',
            'a.2',
            'a.10',
            'b',
        ]);
    });
});

describe('CK3 Explorer tree mapping (client)', () => {
    it('a category shows its count and expands', () => {
        const spec = treeItemSpec({
            id: 'events',
            label: 'Events',
            kind: 'category',
            category: 'events',
            count: 12,
            children: { category: 'events' },
        });
        assert.deepStrictEqual(spec, {
            label: 'Events',
            description: '12',
            tooltip: 'Events: 12 events',
            collapsible: true,
            icon: 'symbol-event',
            contextValue: 'ck3.category',
        });
    });

    it('a group shows its count with a group icon', () => {
        const spec = treeItemSpec({
            id: 'localization/english',
            label: 'english',
            kind: 'group',
            category: 'localization',
            count: 1,
            children: { category: 'localization', group: 'english' },
        });
        assert.strictEqual(spec.description, '1');
        assert.strictEqual(spec.tooltip, 'english: 1 key');
        assert.strictEqual(spec.icon, 'symbol-string');
        assert.strictEqual(spec.collapsible, true);
    });

    it('an item shows its detail and reveals its definition', () => {
        const range = { start: { line: 2, character: 0 }, end: { line: 4, character: 0 } };
        const spec = treeItemSpec({
            id: 'events/my_ev/my_ev.10@file:///mod/events/my_events.txt',
            label: 'my_ev.10',
            kind: 'item',
            category: 'events',
            detail: 'letter_event',
            location: { uri: 'file:///mod/events/my_events.txt', range },
        });
        assert.deepStrictEqual(spec, {
            label: 'my_ev.10',
            description: 'letter_event',
            tooltip: 'my_ev.10 (letter_event)',
            collapsible: false,
            icon: 'symbol-event',
            contextValue: 'ck3.item',
            reveal: {
                command: REVEAL_COMMAND,
                arguments: ['file:///mod/events/my_events.txt', range],
            },
        });
    });

    it('a localization file shows its key count', () => {
        const spec = treeItemSpec({
            id: 'localization/english/x',
            label: 'b_l_english.yml',
            kind: 'item',
            category: 'localization',
            count: 3,
            location: {
                uri: 'file:///mod/localization/english/b_l_english.yml',
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            },
        });
        assert.strictEqual(spec.description, '3 keys');
        assert.strictEqual(spec.icon, 'globe');
    });

    it('coalesces a burst of refreshes into one', async () => {
        let runs = 0;
        const debouncer = new Debouncer(() => runs++, 20);
        for (let i = 0; i < 5; i++) {
            debouncer.schedule();
        }
        assert.strictEqual(debouncer.pending, true);
        await new Promise((resolve) => setTimeout(resolve, 60));
        assert.strictEqual(runs, 1);
        debouncer.schedule();
        debouncer.dispose();
        await new Promise((resolve) => setTimeout(resolve, 40));
        assert.strictEqual(runs, 1);
    });
});
