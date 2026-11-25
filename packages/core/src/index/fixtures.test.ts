/**
 * The index on its fixtures (docs/PLAN.md step 3, "Done when" 1 and 2; MVP.md, row "Workspace
 * index"). `fixtures/mods/index-definitions-and-uses`: every definition and every use of a
 * defined name is found, and none is invented. `fixtures/mods/override-rules*` over the stub
 * `fixtures/game/override-rules`: every name answers as the spec package's rules table (part
 * D1) says, on each platform; where no row decides, every definition is listed and no winner
 * is given; and a row taken out of the table, or put back, changes the answer with no change
 * to the code. Format 8's rows are among them: the scope of a nested name, the gene containers,
 * the coat of arms alias line (with the object a name shares), the stores of province terrain,
 * and a localization file without a byte-order mark, which adds no keys.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { indexMod } from './read-game.js';
import { PLATFORMS, readRulesTable, type Platform, type RulesTable } from './rules.js';
import { fixtureIndex, packageRules, repoPath, specFolders } from './testing.js';
import { WorkspaceIndex, type Definition, type Resolution } from './workspace.js';

interface Where {
    layer: string;
    file: string;
    line: number;
}

interface Case {
    rule: number;
    what: string;
    /** The platforms the case holds on; absent, every platform of the file. */
    platforms?: Platform[];
    database: string;
    container: string | null;
    name: string;
    status: Resolution['status'];
    combine?: string;
    winner: Where | null;
    definitions: (Where & { read: Definition['read'] })[];
    /** An alias replay's object (`Resolution.shared`): the target, the block that fills it, its names. */
    shared?: { target: string | null; filled_by: Where; names: string[] };
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
): Omit<Case, 'rule' | 'what' | 'platforms'> {
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
        ...(r.status === 'winner' && r.shared !== undefined
            ? {
                  shared: {
                      target: r.shared.target,
                      filled_by: where(r.shared.filledBy),
                      names: [...r.shared.names],
                  },
              }
            : {}),
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

const MODS = ['override-rules', 'override-rules-replace-path', 'override-rules-folder-case'];

function casesOn(expected: Expected, platform: Platform): Case[] {
    return expected.cases.filter(
        (c) => c.platforms === undefined || c.platforms.includes(platform),
    );
}

for (const mod of MODS) {
    const expected = readExpected(mod);
    for (const platform of expected.platforms) {
        test(`${mod}: every case answers as the package's rules table says, on ${platform}`, () => {
            const index = fixtureIndex('override-rules', mod, { platform });
            for (const c of casesOn(expected, platform)) {
                const want = Object.fromEntries(
                    Object.entries(c).filter(([k]) => !['rule', 'what', 'platforms'].includes(k)),
                );
                assert.deepEqual(answer(index, c), want, `rule ${String(c.rule)}: ${c.what}`);
            }
        });
    }
}

for (const platform of PLATFORMS) {
    test(`override-rules: the cases name every definition of the stub and the mod, and no other, on ${platform}`, () => {
        const index = fixtureIndex('override-rules', 'override-rules', { platform });
        const listed = casesOn(readExpected('override-rules'), platform).map(
            (c) => `${c.database}|${c.container ?? ''}|${c.name}`,
        );
        assert.deepEqual(everyName(index), [...new Set(listed)].sort());
        assert.equal(new Set(listed).size, listed.length, 'each name is one case');
    });
}

test('override-rules: every rule of docs/overrides.md has a case', () => {
    const rules = new Set<number>();
    for (const mod of MODS) {
        for (const c of readExpected(mod).cases) {
            rules.add(c.rule);
        }
    }
    assert.deepEqual(
        [...rules].sort((a, b) => a - b),
        [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    );
});

test('override-rules: an unknown answer lists every definition and names no winner', () => {
    for (const mod of MODS) {
        for (const c of readExpected(mod).cases.filter((x) => x.status === 'unknown')) {
            assert.equal(c.winner, null, `${mod}: ${c.name}`);
            assert.ok(c.definitions.length >= 1, `${mod}: ${c.name}`);
        }
    }
});

/** The table without some of its rows: the answer they gave goes back to "not known". */
function withoutRows(ids: readonly string[]): RulesTable {
    const table = packageRules();
    return readRulesTable({ ...table, rules: table.rules.filter((r) => !ids.includes(r.id)) });
}

interface RowCase {
    what: string;
    mod: string;
    rows: string[];
    platform?: Platform;
    name: Pick<Case, 'database' | 'container' | 'name'>;
}

const ROWS: RowCase[] = [
    {
        what: 'rule 3: game/ replacing jomini/ settles the shared define',
        mod: 'override-rules',
        rows: ['game-file-replaces-jomini-and-clausewitz'],
        name: { database: 'common/defines', container: 'NFixtureShared', name: 'FIXTURE_FADE' },
    },
    {
        what: 'rules 4 and 5: the file order and later-wins settle a script value defined in two files',
        mod: 'override-rules',
        rows: ['file-read-order'],
        name: { database: 'common/script_values', container: null, name: 'fixture_value' },
    },
    {
        what: 'rule 7: the replace folder settles the replaced key',
        mod: 'override-rules',
        rows: ['localization-replace-folder-wins'],
        name: { database: 'localization:l_english', container: null, name: 'fixture_loc_replaced' },
    },
    {
        what: 'rule 8: the replace-path row hides the game decision',
        mod: 'override-rules-replace-path',
        rows: ['replace-path-hides-lower-layers-in-listings'],
        name: { database: 'common/decisions', container: null, name: 'fixture_shared_decision' },
    },
    {
        what: 'rule 9: on Windows paths compare without case, and the mod file replaces the game file',
        mod: 'override-rules',
        rows: ['path-case-windows'],
        platform: 'windows',
        name: { database: 'common/script_values', container: null, name: 'fixture_age' },
    },
    {
        what: 'rule 10: a mod file replaces a DLC file at its path',
        mod: 'override-rules',
        rows: ['mod-file-replaces-lower-layers'],
        name: { database: 'music', container: null, name: 'fixture_dlc_category' },
    },
    {
        what: 'rule 5: the alias row settles two alias lines of one coat of arms',
        mod: 'override-rules',
        rows: ['coat-of-arms-alias'],
        name: {
            database: 'common/coat_of_arms/coat_of_arms',
            container: null,
            name: 'fixture_alias_twice',
        },
    },
    {
        what: 'rule 6: the special_genes containers row makes its blocks add up',
        mod: 'override-rules',
        rows: ['special-genes-container'],
        name: { database: 'common/genes', container: null, name: 'special_genes' },
    },
    {
        what: "rule 6: the gene row's type_mismatch keeps the earlier gene",
        mod: 'override-rules',
        rows: ['gene-database-later-wins'],
        name: { database: 'common/genes', container: 'genes', name: 'fixture_gene_refused' },
    },
    {
        what: 'rule 6: the province terrain row keeps the terrain line and the winter block apart',
        mod: 'override-rules',
        rows: ['province-terrain-statements'],
        name: { database: 'common/province_terrain', container: 'province_terrain', name: '2' },
    },
    {
        what: 'format 9: the province terrain row compares a province id as an integer (003 is 3)',
        mod: 'override-rules',
        rows: ['province-terrain-statements'],
        name: { database: 'common/province_terrain', container: 'province_terrain', name: '3' },
    },
    {
        what: "format 9: the gene row's on_replace drops a replaced gene's templates",
        mod: 'override-rules',
        rows: ['gene-database-later-wins'],
        name: {
            database: 'common/genes#gene_template',
            container: 'genes/fixture_gene_replaced',
            name: 'fixture_template_dropped',
        },
    },
];

for (const r of ROWS) {
    test(`a row taken out of the table, or put back, changes the answer, no code changed: ${r.what}`, () => {
        const platform = r.platform ?? 'linux';
        const before = answer(
            fixtureIndex('override-rules', r.mod, { rules: withoutRows(r.rows), platform }),
            r.name,
        );
        const after = fixtureIndex('override-rules', r.mod, { platform });
        const got = answer(after, r.name);
        const c = casesOn(readExpected(r.mod), platform).find(
            (x) =>
                x.database === r.name.database &&
                x.name === r.name.name &&
                x.container === r.name.container,
        );
        assert.ok(c !== undefined && c.status !== 'unknown', 'the fixture states an answer');
        assert.equal(got.status, c.status);
        assert.deepEqual(got.winner, c.winner);
        // Without the row the answer is another: not known, or another definition's.
        assert.notDeepEqual([before.status, before.winner], [got.status, got.winner]);
    });
}

test('msg-localization-missing-bom: a localization file without a byte-order mark adds no keys, on each platform', () => {
    for (const platform of PLATFORMS) {
        const index = fixtureIndex('override-rules', 'override-rules', { platform });
        const file = index.getFile('mod', 'localization/english/fixture_no_bom_l_english.yml');
        assert.equal(file?.noDefinitions, 'msg-localization-missing-bom', platform);
        assert.equal(file.definitions, 0);
        assert.deepEqual(index.definitions('fixture_loc_no_bom_only'), [], platform);
        // Without the row, the file's keys are read as any other's.
        const without = fixtureIndex('override-rules', 'override-rules', {
            platform,
            rules: withoutRows(['msg-localization-missing-bom']),
        });
        assert.equal(without.definitions('fixture_loc_no_bom_only').length, 1);
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
        rules: packageRules(),
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
        rules: packageRules(),
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
