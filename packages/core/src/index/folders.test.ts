/**
 * The folder list read from the spec package (folders.ts): the committed package is format 5
 * for game 1.21.0.3, and its folder list and record schemas are read with the keys format 5
 * keeps from format 4.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FolderTable, foldersFromSpec } from './folders.js';
import { committedSpecPackage, specFolders } from './testing.js';

test('a folder new in game 1.21 is described by the committed format 5 package, with its schema and the base game counts', () => {
    const spec = committedSpecPackage() as { package_format: number };
    assert.equal(spec.package_format, 5);
    const districts = specFolders().get('common/districts');
    assert.deepEqual(districts, {
        path: 'common/districts',
        contentType: 'district',
        schema: true,
        schemaFields: 14,
        specRecords: 352,
        specFiles: 11,
    });
    const textures = specFolders().get('gfx/map/textures');
    assert.equal(textures?.schema, false);
    assert.equal(textures.specRecords, null);
});

test('the format 5 shape is read and the keys format 5 adds are ignored', () => {
    const folders = foldersFromSpec({
        package_format: 5,
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
        },
    ]);
    assert.equal(new FolderTable(folders).classify('common/a/x/y.txt')?.folder.path, 'common/a');
});
