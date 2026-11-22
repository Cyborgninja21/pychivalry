/**
 * The index on its fixtures (docs/PLAN.md step 3, "Done when" 1 and 2; MVP.md, row "Workspace
 * index"). `fixtures/mods/index-definitions-and-uses`: every definition and every use of a
 * defined name is found, and none is invented. `fixtures/mods/override-rules*` over the stub
 * `fixtures/game/override-rules`: every name answers as the stand-in rules table says, on both
 * platforms; where the table has no row, every definition is listed and no winner is given; and
 * a row added to the table changes the answer with no change to the code.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { indexMod } from './read-game.js';
import { PLATFORMS, withRule, type Platform, type Rule, type RulesTable } from './rules.js';
import { fixtureIndex, repoPath, specFolders, standInRules, TEST_ROW } from './testing.js';
import { WorkspaceIndex, type Definition, type Resolution } from './workspace.js';

interface Where {
    layer: string;
    file: string;
    line: number;
}

interface Case {
    rule: number;
    what: string;
    database: string;
    container: string | null;
    name: string;
    status: Resolution['status'];
    combine?: string;
    winner: Where | null;
    definitions: (Where & { read: Definition['read'] })[];
}

interface Expected {
    game: string;
    platforms: Platform[];
    cases: Case[];
}

function readExpected(mod: string): Expected {
    return JSON.parse(
        readFileSync(repoPath(`fixtures/mods/${mod}/expected.json`), 'utf8'),
    ) as Expected;
}

function where(d: Definition): Where {
    return { layer: d.layer, file: d.file, line: d.range.start.line + 1 };
}

/** The answer for a name, in the shape of a case. */
function answer(
    index: WorkspaceIndex,
    c: Pick<Case, 'database' | 'container' | 'name'>,
): Omit<Case, 'rule' | 'what'> {
    const r = index.resolve(c.database, c.name, c.container);
    const winner = r.status === 'single' || r.status === 'winner' ? where(r.winner) : null;
    return {
        database: c.database,
        container: c.container,
        name: c.name,
        status: r.status,
        ...(r.status === 'winner' && r.combine !== 'whole' ? { combine: r.combine } : {}),
        winner,
        definitions: r.definitions.map((d) => ({ ...where(d), read: d.read })),
    };
}

/** Every name of every database the index holds, as `database|container|name`. */
function everyName(index: WorkspaceIndex): string[] {
    const out = new Set<string>();
    for (const name of index.definedNamesAll()) {
        for (const d of index.definitions(name)) {
            out.add(`${d.database}|${d.container ?? ''}|${d.name}`);
        }
    }
    return [...out].sort();
}

for (const mod of ['override-rules', 'override-rules-replace-path', 'override-rules-folder-case']) {
    const expected = readExpected(mod);
    for (const platform of expected.platforms) {
        test(`${mod}: every case answers as the stand-in table says, on ${platform}`, () => {
            const index = fixtureIndex('override-rules', mod, { platform });
            for (const c of expected.cases) {
                const { rule, what, ...want } = c;
                assert.deepEqual(answer(index, c), want, `rule ${String(rule)}: ${what}`);
            }
        });
    }
}

test('override-rules: the cases name every definition of the stub and the mod, and no other', () => {
    const index = fixtureIndex('override-rules', 'override-rules');
    const listed = readExpected('override-rules').cases.map(
        (c) => `${c.database}|${c.container ?? ''}|${c.name}`,
    );
    assert.deepEqual(everyName(index), [...new Set(listed)].sort());
    assert.equal(new Set(listed).size, listed.length, 'each name is one case');
});

test('override-rules: every rule of docs/overrides.md has a case, settled or open', () => {
    const rules = new Set(readExpected('override-rules').cases.map((c) => c.rule));
    for (const mod of ['override-rules-replace-path', 'override-rules-folder-case']) {
        for (const c of readExpected(mod).cases) {
            rules.add(c.rule);
        }
    }
    assert.deepEqual(
        [...rules].sort((a, b) => a - b),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
});

test('override-rules: an open rule lists every definition and names no winner', () => {
    const settled = new Set(standInRules().rules.map((r) => r.overrides_rule));
    for (const mod of [
        'override-rules',
        'override-rules-replace-path',
        'override-rules-folder-case',
    ]) {
        for (const c of readExpected(mod).cases.filter((x) => x.status === 'unknown')) {
            assert.equal(c.winner, null, `${mod}: ${c.name}`);
            assert.ok(c.definitions.length >= 1, `${mod}: ${c.name}`);
        }
    }
    // The table carries only the rules docs/overrides.md marks settled.
    assert.deepEqual(
        [...settled].sort((a, b) => a - b),
        [1, 2, 6, 10],
    );
});

/** Rows written for the test only: no statement of how the game works. */
function row(fields: Record<string, unknown>): Rule {
    return { ...TEST_ROW, ...fields } as unknown as Rule;
}

const LATER_WINS: Rule[] = [
    row({
        id: 'test-files-in-path-order',
        overrides_rule: 4,
        title: 'test',
        kind: 'file-order',
        compare: 'bytes',
        subfolders: 'by-path',
        layers: 'together',
        layer_order: ['clausewitz', 'jomini', 'game', 'dlc', 'mod'],
    }),
    row({
        id: 'test-script-values-later-wins',
        overrides_rule: 5,
        title: 'test',
        kind: 'key-resolution',
        databases: ['common/script_values'],
        resolve: 'later-wins',
        combine: 'whole',
    }),
];

function tableWith(rows: readonly Rule[]): RulesTable {
    return rows.reduce((table, r) => withRule(table, r), standInRules());
}

interface Hypothesis {
    what: string;
    mod: string;
    rows: Rule[];
    name: Pick<Case, 'database' | 'container' | 'name'>;
    status: Resolution['status'];
    winner: Where | null;
}

const HYPOTHESES: Hypothesis[] = [
    {
        what: 'rule 3: a row saying game/ replaces jomini/ settles the shared define',
        mod: 'override-rules',
        rows: [
            row({
                id: 'test-game-over-jomini',
                overrides_rule: 3,
                title: 'test',
                kind: 'file-replace',
                layer: 'game',
                over: ['jomini'],
            }),
        ],
        name: { database: 'common/defines', container: 'NFixtureShared', name: 'FIXTURE_FADE' },
        status: 'single',
        winner: { layer: 'game', file: 'common/defines/jomini/fixture_shared.txt', line: 2 },
    },
    {
        what: 'rules 4 and 5: a file order and later-wins settle a script value defined in two files',
        mod: 'override-rules',
        rows: LATER_WINS,
        name: { database: 'common/script_values', container: null, name: 'fixture_value' },
        status: 'winner',
        winner: { layer: 'mod', file: 'common/script_values/zz_fixture_values.txt', line: 1 },
    },
    {
        what: 'rule 11: the same rows settle a key defined twice in one file',
        mod: 'override-rules',
        rows: LATER_WINS,
        name: { database: 'common/script_values', container: null, name: 'fixture_twice' },
        status: 'winner',
        winner: { layer: 'game', file: 'common/script_values/00_fixture_values.txt', line: 3 },
    },
    {
        what: 'rule 7: a row saying the replace folder wins settles the replaced key',
        mod: 'override-rules',
        rows: [
            row({
                id: 'test-replace-folder-wins',
                overrides_rule: 7,
                title: 'test',
                kind: 'folder-wins',
                databases: ['localization'],
                segment: 'replace',
            }),
        ],
        name: { database: 'localization:l_english', container: null, name: 'fixture_loc_replaced' },
        status: 'winner',
        winner: {
            layer: 'mod',
            file: 'localization/english/replace/fixture_replace_l_english.yml',
            line: 2,
        },
    },
    {
        what: 'rule 8: a row saying replace_path hides game files, not subfolders, hides the game decision',
        mod: 'override-rules-replace-path',
        rows: [
            row({
                id: 'test-replace-path',
                overrides_rule: 8,
                title: 'test',
                kind: 'replace-path',
                hides: ['game'],
                subfolders: false,
            }),
        ],
        name: { database: 'common/decisions', container: null, name: 'fixture_shared_decision' },
        status: 'single',
        winner: { layer: 'mod', file: 'common/decisions/fixture_mod_decisions.txt', line: 1 },
    },
    {
        what: 'rule 8: the same row leaves a subfolder of the path read',
        mod: 'override-rules-replace-path',
        rows: [
            row({
                id: 'test-replace-path',
                overrides_rule: 8,
                title: 'test',
                kind: 'replace-path',
                hides: ['game'],
                subfolders: false,
            }),
        ],
        name: { database: 'common/decisions', container: null, name: 'fixture_sub_decision' },
        status: 'single',
        winner: {
            layer: 'game',
            file: 'common/decisions/fixture_sub/fixture_sub_decisions.txt',
            line: 1,
        },
    },
    {
        what: 'rule 9: a row saying paths compare without case makes the mod file replace the game file',
        mod: 'override-rules',
        rows: [
            row({
                id: 'test-case-insensitive',
                overrides_rule: 9,
                title: 'test',
                kind: 'path-case',
                compare: 'case-insensitive',
            }),
        ],
        name: { database: 'common/script_values', container: null, name: 'fixture_age' },
        status: 'not-read',
        winner: null,
    },
    {
        what: 'rule 9: a row saying paths compare exactly means a folder in upper case is not read',
        mod: 'override-rules-folder-case',
        rows: [
            row({
                id: 'test-case-exact',
                overrides_rule: 9,
                title: 'test',
                kind: 'path-case',
                compare: 'exact',
            }),
        ],
        name: { database: 'common/script_values', container: null, name: 'fixture_upper_folder' },
        status: 'not-read',
        winner: null,
    },
    {
        what: 'rule 10: a row saying a mod file replaces a DLC file settles the music category',
        mod: 'override-rules',
        rows: [
            row({
                id: 'test-mod-over-dlc',
                overrides_rule: 10,
                title: 'test',
                kind: 'file-replace',
                layer: 'mod',
                over: ['dlc'],
            }),
        ],
        name: { database: 'music', container: null, name: 'fixture_mod_category' },
        status: 'single',
        winner: {
            layer: 'mod',
            file: 'music/music_player_categories/fixture_dlc_categories.txt',
            line: 1,
        },
    },
];

for (const h of HYPOTHESES) {
    test(`adding a row changes the answer, no code changed: ${h.what}`, () => {
        const before = fixtureIndex('override-rules', h.mod);
        assert.equal(
            before.resolve(h.name.database, h.name.name, h.name.container).status,
            'unknown',
        );
        const after = fixtureIndex('override-rules', h.mod, { rules: tableWith(h.rows) });
        const got = answer(after, h.name);
        assert.equal(got.status, h.status);
        assert.deepEqual(got.winner, h.winner);
    });
}

test('a row that holds on one platform only changes the answer on that platform alone', () => {
    const rows = [
        row({
            id: 'test-windows-only',
            overrides_rule: 9,
            title: 'test',
            kind: 'path-case',
            compare: 'case-insensitive',
            platforms: ['windows'],
        }),
    ];
    const rules = tableWith(rows);
    const name = { database: 'common/script_values', container: null, name: 'fixture_age' };
    for (const platform of PLATFORMS) {
        const index = fixtureIndex('override-rules', 'override-rules', { rules, platform });
        assert.equal(
            answer(index, name).status,
            platform === 'windows' ? 'not-read' : 'unknown',
            platform,
        );
    }
});

test('without a platform no row holds: the settled cases have no winner either', () => {
    const index = fixtureIndex('override-rules', 'override-rules', { platform: undefined });
    const r = index.resolve('events', 'fixture.1');
    assert.equal(r.status, 'unknown');
    // And a DLC's files are no layer of their own: the pack row does not hold.
    assert.deepEqual(index.definitions('fixture_dlc_track'), []);
});

interface DefinitionsExpected {
    definitions: {
        name: string;
        database: string;
        form: string;
        container: string | null;
        prefix: string | null;
        file: string;
        line: number;
        column: number;
        version?: number | null;
    }[];
    uses: Record<string, { file: string; line: number; column: number }[]>;
}

test('index-definitions-and-uses: every definition is found and none is invented', () => {
    const expected = JSON.parse(
        readFileSync(repoPath('fixtures/mods/index-definitions-and-uses/expected.json'), 'utf8'),
    ) as DefinitionsExpected;
    const index = new WorkspaceIndex({
        folders: specFolders(),
        rules: standInRules(),
        platform: 'linux',
    });
    indexMod(index, repoPath('fixtures/mods/index-definitions-and-uses'));
    const found = [...index.definedNamesAll()]
        .flatMap((name) => index.definitions(name))
        .map((d) => ({
            name: d.name,
            database: d.database,
            form: d.form,
            container: d.container,
            prefix: d.prefix,
            file: d.file,
            line: d.range.start.line + 1,
            column: d.range.start.character + 1,
            ...(d.form === 'key' ? { version: d.version } : {}),
        }));
    const key = (d: { file: string; line: number; column: number; database: string }): string =>
        `${d.file}:${String(d.line).padStart(4, '0')}:${String(d.column).padStart(4, '0')}:${d.database}`;
    const sort = <T extends { file: string; line: number; column: number; database: string }>(
        list: T[],
    ): T[] => [...list].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
    assert.deepEqual(sort(found), sort(expected.definitions));
});

test('index-definitions-and-uses: every use of a defined name is found and none is invented', () => {
    const expected = JSON.parse(
        readFileSync(repoPath('fixtures/mods/index-definitions-and-uses/expected.json'), 'utf8'),
    ) as DefinitionsExpected;
    const index = new WorkspaceIndex({
        folders: specFolders(),
        rules: standInRules(),
        platform: 'linux',
    });
    indexMod(index, repoPath('fixtures/mods/index-definitions-and-uses'));
    const defined = [...new Set(expected.definitions.map((d) => d.name))].sort();
    assert.deepEqual(Object.keys(expected.uses).sort(), defined);
    for (const name of defined) {
        const uses = index.references(name).map((u) => ({
            file: u.file,
            line: u.range.start.line + 1,
            column: u.range.start.character + 1,
        }));
        assert.deepEqual(uses, expected.uses[name], name);
    }
    // The two files in folders the spec does not list are not read at all.
    assert.equal(index.findFiles('events_old/fixture_old_events.txt').length, 0);
    assert.equal(
        index.findFiles('common/fixture_not_a_folder/fixture_not_described.txt').length,
        0,
    );
});
