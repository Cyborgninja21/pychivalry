/**
 * What a server that keeps one index between requests needs of it (docs/PLAN.md step 6):
 * `syncMod` brings a mod indexed earlier up to date with its folder, so the index answers as a
 * fresh one would; `nameAt` finds the name written at a place; `databases` and `definitionsOf`
 * list what is defined, kind by kind.
 */

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { indexMod, syncMod } from './read-game.js';
import { repoPath, stubIndex } from './testing.js';

function scratchMod(t: TestContext, mod: string): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-sync-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    const copy = path.join(dir, mod);
    cpSync(repoPath(`fixtures/mods/${mod}`), copy, { recursive: true });
    return copy;
}

function write(file: string, text: string): void {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, text);
}

/** The digest of the stub `lookup` with the mod freshly indexed into it. */
function fresh(mod: string): string {
    const index = stubIndex('lookup');
    indexMod(index, mod);
    return index.digest();
}

test('syncMod: after edits, additions, removals and a new descriptor, the index answers as a fresh one', (t) => {
    const mod = scratchMod(t, 'lookup-definitions-and-uses');
    const index = stubIndex('lookup');
    let synced = syncMod(index, mod, null);
    assert.equal(synced.changed, true, 'the first sync reads every file');
    assert.equal(index.digest(), fresh(mod));
    // Nothing changed on disk: nothing is read again once the files are older than the
    // listing by more than a coarse clock's tick.
    const again = syncMod(index, mod, { ...synced, listedAt: synced.listedAt + 10_000 });
    assert.equal(again.changed, false);
    assert.equal(index.digest(), fresh(mod));
    // A file edited to the same size within the same clock tick is read again all the same.
    const triggers = path.join(mod, 'common', 'scripted_triggers', 'zz_fixture_triggers.txt');
    write(triggers, 'fixture_scripted_trigger = {\n\talways = on\n}\n');
    synced = syncMod(index, mod, synced);
    assert.equal(index.digest(), fresh(mod), 'an edit');
    write(
        path.join(mod, 'common', 'scripted_triggers', 'zz_added.txt'),
        'fixture_added = { always = yes }\n',
    );
    unlinkSync(path.join(mod, 'history', 'characters', 'zz_fixture_characters.txt'));
    write(path.join(mod, 'descriptor.mod'), 'name = "x"\nreplace_path = "events"\n');
    synced = syncMod(index, mod, synced);
    assert.equal(synced.changed, true);
    assert.deepEqual(index.getReplacePaths(), ['events']);
    assert.equal(index.digest(), fresh(mod), 'an addition, a removal and a new descriptor');
    assert.ok(index.hasDefinition('fixture_added'));
    assert.equal(index.getFile('mod', 'history/characters/zz_fixture_characters.txt'), undefined);
});

test('nameAt: the definition or use written at a place, its end included', () => {
    const index = stubIndex('lookup');
    indexMod(index, repoPath('fixtures/mods/lookup-definitions-and-uses'));
    const file = 'events/fixture_lookup_mod_events.txt';
    // Line 6 (from 0: 5) is `\t\tfixture_scripted_trigger = yes`.
    const use = index.nameAt('mod', file, { line: 5, character: 2 });
    assert.deepEqual(use, {
        name: 'fixture_scripted_trigger',
        kind: 'use',
        range: { start: { line: 5, character: 2 }, end: { line: 5, character: 26 } },
    });
    assert.equal(
        index.nameAt('mod', file, { line: 5, character: 26 })?.name,
        'fixture_scripted_trigger',
    );
    assert.equal(index.nameAt('mod', file, { line: 5, character: 0 }), undefined, 'the tabs');
    assert.equal(index.nameAt('mod', file, { line: 99, character: 0 }), undefined, 'past the end');
    assert.equal(
        index.nameAt('mod', 'events/no_such_file.txt', { line: 0, character: 0 }),
        undefined,
    );
    const definition = index.nameAt('mod', 'common/scripted_triggers/zz_fixture_triggers.txt', {
        line: 0,
        character: 5,
    });
    assert.equal(definition?.kind, 'definition');
    assert.equal(definition.name, 'fixture_scripted_trigger');
});

test('databases and definitionsOf: every kind with its count, and its definitions in order', () => {
    const index = stubIndex('lookup');
    indexMod(index, repoPath('fixtures/mods/lookup-definitions-and-uses'));
    const databases = index.databases();
    assert.equal(databases.get('common/scripted_triggers'), 2);
    assert.deepEqual([...databases.keys()], [...databases.keys()].sort(), 'sorted by name');
    let total = 0;
    for (const [database, count] of databases) {
        const definitions = index.definitionsOf(database);
        assert.equal(definitions.length, count, database);
        assert.ok(definitions.every((d) => d.database === database));
        total += count;
    }
    assert.equal(total, index.totals().definitions);
    assert.deepEqual(
        index.definitionsOf('common/scripted_triggers').map((d) => [d.layer, d.name]),
        [
            ['game', 'fixture_scripted_trigger'],
            ['mod', 'fixture_scripted_trigger'],
        ],
    );
    assert.deepEqual(index.definitionsOf('no/such/database'), []);
});
