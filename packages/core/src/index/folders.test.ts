/**
 * The folder list read from the spec package (folders.ts): the committed package is format 9
 * for game 1.21.0.3; its folder list and record schemas are read with the keys format 9 keeps
 * from format 4, parts D2 and D3 say what a folder's files define beyond their top-level keys,
 * and since format 9 each folder says which of its files are script.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FolderTable, folderFilesOf, foldersFromSpec, keyMatcher } from './folders.js';
import { committedSpecPackage, specFolders } from './testing.js';

test('a folder new in game 1.21 is described by the committed format 9 package, with its schema and the base game counts', () => {
    const spec = committedSpecPackage() as { package_format: number };
    assert.equal(spec.package_format, 9);
    const districts = specFolders().get('common/districts');
    assert.deepEqual(
        { ...districts, files: undefined },
        {
            path: 'common/districts',
            contentType: 'district',
            schema: true,
            schemaFields: 14,
            specRecords: 352,
            specFiles: 11,
            notDefinitions: [],
            nested: [],
            fileNamed: false,
            files: undefined,
        },
    );
    assert.deepEqual(districts?.files?.extensions, ['.txt']);
    const textures = specFolders().get('gfx/map/textures');
    assert.equal(textures?.schema, false);
    assert.equal(textures.specRecords, null);
});

test('the format 9 shape is read and the keys the reader does not use are ignored', () => {
    const folders = foldersFromSpec({
        package_format: 9,
        directories: [
            {
                path: 'common/a',
                content_type: 'a',
                level: 2,
                since: '1.21.0.3',
                source: 'exe_loader_path',
                present_in_vanilla: true,
            },
            { path: 'common/b' },
        ],
        schema: {
            'common/a': {
                content_type: 'a',
                vanilla: { files: 2, records: 5 },
                fields: {
                    x: { kind: 'value', value_type: 'integer', record_usage: 5, loc_key: true },
                },
            },
        },
    });
    assert.deepEqual(folders, [
        {
            path: 'common/a',
            contentType: 'a',
            schema: true,
            schemaFields: 1,
            specRecords: 5,
            specFiles: 2,
            notDefinitions: [],
            nested: [],
            fileNamed: false,
            files: null,
        },
    ]);
    assert.equal(new FolderTable(folders).classify('common/a/x/y.txt')?.folder.path, 'common/a');
});

test('format 9: which files of a folder are script; GUIDs.txt and naming.txt are not', () => {
    const folders = specFolders();
    assert.deepEqual(folders.scriptStatus('sound/map/ambience/fixture.txt'), { script: true });
    const guids = folders.scriptStatus('sound/GUIDs.txt');
    assert.ok(guids !== undefined && !guids.script);
    assert.deepEqual(
        [guids.why, guids.folder, guids.rule?.written, guids.rule?.status],
        ['not-script', 'sound', 'GUIDs.txt', 'confirmed'],
    );
    // In any letter case: the package says the file is no script.
    assert.equal(folders.scriptStatus('sound/guids.txt')?.script, false);
    const naming = folders.scriptStatus('gfx/models/buildings/naming.txt');
    assert.ok(naming !== undefined && !naming.script);
    assert.equal(naming.rule?.status, 'measured-only');
    // A folder whose reader takes no `.txt` (localization: `.yml`, read as localization text).
    assert.equal(folders.scriptStatus('localization/english/stray.txt')?.script, false);
    // A file no listed folder holds: not the folder table's question.
    assert.equal(folders.scriptStatus('fixture_no_folder/x.txt'), undefined);
    // A pattern of names, and a folder whose extensions are not settled (read as before).
    const files = folderFilesOf({
        status: 'measured-only',
        holds_script: null,
        script: { extensions: null, recursive: null },
        not_script: [{ pattern: '*.info', status: 'measured-only', what: 'documentation' }],
    });
    assert.ok(files !== null);
    const table = new FolderTable([
        {
            path: 'common/a',
            contentType: 'a',
            schema: false,
            schemaFields: 0,
            specRecords: null,
            specFiles: null,
            notDefinitions: [],
            nested: [],
            fileNamed: false,
            files,
        },
    ]);
    assert.equal(table.scriptStatus('common/a/_a.INFO')?.script, false);
    assert.equal(table.scriptStatus('common/a/x.txt')?.script, true);
});

test('part D2: `namespace` in an event file declares no name; a constant holds for its file', () => {
    const events = specFolders().get('events');
    assert.deepEqual(events?.notDefinitions, [
        { key: 'namespace', match: 'exact', form: 'value', declares: 'namespace' },
    ]);
    assert.equal(specFolders().constantScope, 'file');
    // A row resting on the measurement alone is not read: the court scene settings stay names.
    assert.deepEqual(specFolders().get('gfx/court_scene/scene_settings')?.notDefinitions, []);
});

test('part D3: a landed title nested at any depth, and history/cultures named by its file', () => {
    const titles = specFolders().get('common/landed_titles')?.nested ?? [];
    assert.equal(titles.length, 1);
    const title = titles[0];
    assert.equal(title?.type, 'key-pattern');
    assert.equal(title.database, 'common/landed_titles', 'a nested title is a landed title');
    assert.ok(title.pattern?.test('c_paris'));
    assert.equal(specFolders().get('history/cultures')?.fileNamed, true);
    assert.equal(specFolders().get('history/situations')?.fileNamed, false, 'name_from: none');
    // A nested kind other than the folder's own records is a database of its own.
    const traits = specFolders().get('common/traits')?.nested ?? [];
    assert.deepEqual([...new Set(traits.map((r) => r.database))], ['common/traits#trait_track']);
    // Format 8: every gene row is confirmed now, the age presets and decal atlases among them.
    const genes = specFolders().get('common/genes')?.nested ?? [];
    assert.deepEqual(
        genes.map((r) => [r.kind, r.database]),
        [
            ['gene', 'common/genes'],
            ['gene', 'common/genes'],
            ['gene', 'common/genes'],
            ['gene_template', 'common/genes#gene_template'],
            ['gene_template', 'common/genes#gene_template'],
            ['gene_age_preset', 'common/genes#gene_age_preset'],
            ['gene_decal_atlas', 'common/genes#gene_decal_atlas'],
        ],
    );
});

test('part D3, format 8: the scope of a nested name is read as data; an unsettled scope decides nothing', () => {
    const scopes = (folder: string): unknown[] =>
        (specFolders().get(folder)?.nested ?? []).map((r) => [r.kind, r.scope]);
    // A landed title is known by its name alone.
    assert.deepEqual(scopes('common/landed_titles'), [
        ['landed_title', { kind: 'global', qualifier: null }],
    ]);
    // A track by its trait (the record); an option by its category, two levels below the record.
    assert.deepEqual(scopes('common/traits'), [
        ['trait_track', { kind: 'parent', depth: 1 }],
        ['trait_track', { kind: 'parent', depth: 1 }],
    ]);
    const activities = scopes('common/activities/activity_types');
    assert.deepEqual(activities[1], ['activity_option', { kind: 'parent', depth: 3 }]);
    // Unknown, and resting on the measurement alone: not settled.
    assert.deepEqual(activities[4], [
        'activity_locale_slot',
        { kind: 'not-settled', status: 'unknown' },
    ]);
    assert.deepEqual(activities[5], [
        'activity_window_character',
        { kind: 'not-settled', status: 'measured-only' },
    ]);
    // A gene is global with a second part of its key: its portrait group.
    assert.deepEqual(scopes('common/genes')[2], [
        'gene',
        { kind: 'global', qualifier: 'portrait_group' },
    ]);
});

test('a key matcher reads the word itself, a whole-key pattern, or a prefix', () => {
    assert.ok(keyMatcher('namespace', 'exact')('namespace'));
    assert.ok(!keyMatcher('namespace', 'exact')('namespaces'));
    assert.ok(keyMatcher('N[A-Za-z0-9_]*', 'pattern')('NGame'));
    assert.ok(!keyMatcher('N[A-Za-z0-9_]*', 'pattern')('xNGame'));
    assert.ok(keyMatcher('@', 'prefix')('@x'));
});
