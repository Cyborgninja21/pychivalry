/**
 * Paths and folders (docs/PLAN.md item 3.10; MVP.md, "Lessons from 2.3.0"): a file is
 * classified by its path inside the mod, matching whole folder names; files are found without
 * regard to letter case; addresses on disk are built with the platform's own functions.
 *
 * The first cases are release 2.3.0's own for its issue #90, carried over as data
 * (`legacy/packages/engine/test/unit/indexer.test.ts`, "file kind from the mod-relative
 * path"): a loose match on the folder name once produced 1,750 false errors.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { FolderTable, foldersFromSpec } from './folders.js';
import {
    diskPath,
    extensionOf,
    fileNameOf,
    foldCase,
    isWithin,
    parentOf,
    PathTable,
    relativePath,
    segmentsOf,
} from './paths.js';
import { indexMod, listMod } from './read-game.js';
import { specFolders, packageRules } from './testing.js';
import { WorkspaceIndex } from './workspace.js';

test('2.3.0 issue #90: a file is classified by its folders, matched whole', () => {
    const folders = specFolders();
    const folderOf = (rel: string): string | undefined => folders.classify(rel)?.folder.path;
    assert.equal(folderOf('common/scripted_effects/a.txt'), 'common/scripted_effects');
    assert.equal(folderOf('events/a.txt'), 'events');
    assert.equal(folderOf('more_events/a.txt'), undefined);
    assert.equal(folderOf('common/decision_group_types/a.txt'), 'common/decision_group_types');
    assert.equal(folderOf('common/decisions/a.txt'), 'common/decisions');
    assert.equal(folderOf('common/traits_old/a.txt'), undefined);
    // A subfolder belongs to the deepest listed folder above it.
    assert.equal(folderOf('common/decisions/dlc_decisions/a.txt'), 'common/decisions');
    assert.equal(folderOf('common/culture/cultures/a.txt'), 'common/culture/cultures');
    assert.equal(folderOf('common/culture/a.txt'), undefined);
});

test('2.3.0 issue #90: a mod kept in a folder named like a game folder classifies by its own folders', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'pychivalry-paths-'));
    try {
        for (const root of [
            path.join(scratch, 'viet-events'),
            path.join(scratch, 'events', 'mymod'),
        ]) {
            mkdirSync(path.join(root, 'common', 'scripted_effects'), { recursive: true });
            mkdirSync(path.join(root, 'events'), { recursive: true });
            writeFileSync(
                path.join(root, 'common', 'scripted_effects', 'a.txt'),
                'my_effect = { add_gold = 1 }\n',
            );
            writeFileSync(
                path.join(root, 'events', 'a.txt'),
                'namespace = e\ne.1 = { type = character_event }\n',
            );
            const index = new WorkspaceIndex({
                folders: specFolders(),
                rules: packageRules(),
                platform: 'linux',
            });
            indexMod(index, root);
            assert.deepEqual(
                index.definitions('my_effect').map((d) => d.database),
                ['common/scripted_effects'],
                root,
            );
            assert.deepEqual(
                index.definitions('e.1').map((d) => d.database),
                ['events'],
                root,
            );
        }
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

test('a folder spelled in other letter case is found, and the index knows the case differs', () => {
    const folders = specFolders();
    assert.deepEqual(folders.classify('Common/Traits/x.txt'), {
        folder: folders.get('common/traits'),
        exactCase: false,
    });
    assert.equal(folders.classify('common/traits/X.TXT')?.exactCase, true);
    assert.equal(folders.get('COMMON/TRAITS'), undefined, 'get takes the spec spelling');
});

test('files are found without regard to letter case, each with the path as written', () => {
    const table = new PathTable<string>();
    table.add('common/traits/00_traits.txt', 'game');
    table.add('Common/Traits/00_Traits.txt', 'mod');
    assert.deepEqual(
        table.find('COMMON/TRAITS/00_TRAITS.TXT').map((e) => [e.path, e.value]),
        [
            ['common/traits/00_traits.txt', 'game'],
            ['Common/Traits/00_Traits.txt', 'mod'],
        ],
    );
    assert.ok(table.remove('Common/Traits/00_Traits.txt', 'mod'));
    assert.equal(table.find('common/traits/00_traits.txt').length, 1);
    assert.ok(!table.remove('nothing.txt', 'x'));
});

test('the index finds a file in any layer without regard to letter case', () => {
    const index = new WorkspaceIndex({
        folders: specFolders(),
        rules: packageRules(),
        platform: 'linux',
    });
    index.addFile('game', 'common/traits/00_traits.txt', 'brave = { }\n');
    index.addFile('mod', 'Common/Traits/00_Traits.txt', 'shy = { }\n');
    assert.deepEqual(
        index.findFiles('COMMON\\traits\\00_TRAITS.txt').map((f) => `${f.layer}:${f.path}`),
        ['game:common/traits/00_traits.txt', 'mod:Common/Traits/00_Traits.txt'],
    );
    assert.equal(
        index.getFile('mod', 'common/traits/00_traits.txt'),
        undefined,
        'getFile is exact',
    );
});

test('whole folder names, with and without case', () => {
    assert.ok(isWithin('common/traits/x.txt', 'common/traits'));
    assert.ok(!isWithin('common/traits_old/x.txt', 'common/traits'));
    assert.ok(!isWithin('Common/Traits/x.txt', 'common/traits'));
    assert.ok(isWithin('Common/Traits/x.txt', 'common/traits', true));
    assert.equal(foldCase('Common/TRAITS'), 'common/traits');
    assert.deepEqual(segmentsOf('/common//traits/x.txt'), ['common', 'traits', 'x.txt']);
    assert.equal(parentOf('common/traits/x.txt'), 'common/traits');
    assert.equal(parentOf('x.txt'), '');
    assert.equal(fileNameOf('common/traits/x.txt'), 'x.txt');
    assert.equal(extensionOf('common/traits/X.TXT'), '.txt');
    assert.equal(extensionOf('common/.hidden'), '');
});

test('addresses on disk are built with the platform functions, and relative paths use /', () => {
    const base = path.join(tmpdir(), 'mod');
    assert.equal(
        diskPath(base, 'common/traits/x.txt'),
        path.join(base, 'common', 'traits', 'x.txt'),
    );
    assert.equal(
        relativePath(base, path.join(base, 'common', 'traits', 'x.txt')),
        'common/traits/x.txt',
    );
    // On Windows the address holds backslashes; the relative path never does.
    if (process.platform === 'win32') {
        assert.ok(diskPath(base, 'common/x.txt').includes('\\'));
    }
});

test('a mod file in a folder the spec does not list is counted under its own folder, not read', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'pychivalry-undescribed-'));
    try {
        mkdirSync(path.join(scratch, 'common', 'new_kind', 'deep'), { recursive: true });
        mkdirSync(path.join(scratch, 'notes'), { recursive: true });
        writeFileSync(path.join(scratch, 'common', 'new_kind', 'deep', 'a.txt'), 'x = { }\n');
        writeFileSync(path.join(scratch, 'notes', 'readme.txt'), 'x = { }\n');
        writeFileSync(path.join(scratch, 'thumbnail.png'), '');
        const listing = listMod(scratch, specFolders());
        assert.deepEqual(listing.files, []);
        assert.deepEqual(Object.fromEntries(listing.notDescribed), {
            'common/new_kind': 1,
            notes: 1,
        });
        assert.deepEqual(Object.fromEntries(listing.notRead), { '.png': 1 });
        assert.equal(listing.descriptor, false);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});

test('the folder list is read from a spec package, with its record schemas', () => {
    const folders = foldersFromSpec({
        directories: [
            { path: 'common/traits', content_type: 'trait' },
            { path: 'gfx/x/', content_type: 'x' },
            { path: '', content_type: 'nothing' },
            { content_type: 'no path' },
        ],
        schema: {
            'common/traits': { fields: { a: {}, b: {} }, vanilla: { files: 1, records: 306 } },
        },
    });
    assert.deepEqual(folders, [
        {
            path: 'common/traits',
            contentType: 'trait',
            schema: true,
            schemaFields: 2,
            specRecords: 306,
            specFiles: 1,
            notDefinitions: [],
            nested: [],
            fileNamed: false,
            files: null,
        },
        {
            path: 'gfx/x',
            contentType: 'x',
            schema: false,
            schemaFields: 0,
            specRecords: null,
            specFiles: null,
            notDefinitions: [],
            nested: [],
            fileNamed: false,
            files: null,
        },
    ]);
    assert.deepEqual(foldersFromSpec(null), []);
    const table = new FolderTable(folders);
    assert.equal(table.undescribedFolder('common/new/a.txt'), 'common/new');
    assert.equal(table.undescribedFolder('top.txt'), '(top level)');
    assert.equal(table.undescribedFolder('gfx/x2/y/a.txt'), 'gfx/x2');
});

test('the committed spec lists the folders the base game holds records in', () => {
    const folders = specFolders();
    assert.equal(folders.folders.length, 239);
    assert.ok(folders.get('events') !== undefined);
    assert.ok(folders.get('localization') !== undefined);
    assert.equal(folders.folders.filter((f) => f.schema).length, 198);
});
