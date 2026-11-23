/**
 * What a file writes that another file's findings can depend on (`namesIn`), and the files
 * that write any of some names (`filesNaming`): how a server knows which files to check again
 * after an edit.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { packageRules, specFolders } from './testing.js';
import { WorkspaceIndex } from './workspace.js';

function index(): WorkspaceIndex {
    return new WorkspaceIndex({ folders: specFolders(), rules: packageRules(), platform: 'linux' });
}

test("namesIn lists a file's uses, saves, scope reads and $PARAM$ words, each once and sorted", () => {
    const ix = index();
    ix.setFile(
        'mod',
        'events/a.txt',
        'namespace = a\na.1 = {\n\ttype = character_event\n\timmediate = {\n\t\tsave_scope_as = saved_x\n\t\tscope:read_y = { add_gold = 1 }\n\t\tset_variable = been_$SCENE$\n\t\tadd_gold = 2\n\t}\n}\n',
    );
    const names = ix.namesIn('mod', 'events/a.txt');
    assert.ok(names !== undefined);
    assert.deepEqual(names.saves, ['saved_x']);
    assert.deepEqual(names.reads, ['read_y']);
    assert.deepEqual(names.templates, ['been_$SCENE$']);
    assert.ok(names.uses.includes('add_gold'));
    assert.equal(names.uses.filter((n) => n === 'add_gold').length, 1);
    assert.deepEqual([...names.uses], [...names.uses].sort());
    assert.equal(ix.namesIn('mod', 'events/none.txt'), undefined);
});

test('filesNaming finds the files of a layer that define, use, save or read a name', () => {
    const ix = index();
    ix.setFile('game', 'common/scripted_triggers/g.txt', 'shared_trigger = { always = yes }\n');
    ix.setFile('mod', 'common/scripted_triggers/m.txt', 'shared_trigger = { always = no }\n');
    ix.setFile('mod', 'events/user.txt', 'u.1 = { trigger = { shared_trigger = yes } }\n');
    ix.setFile('mod', 'events/saver.txt', 's.1 = { immediate = { save_scope_as = kept } }\n');
    ix.setFile(
        'mod',
        'events/reader.txt',
        'r.1 = { immediate = { scope:kept = { add_gold = 1 } } }\n',
    );
    ix.setFile('mod', 'events/other.txt', 'o.1 = { immediate = { add_gold = 1 } }\n');
    assert.deepEqual(ix.filesNaming(['shared_trigger'], 'mod'), [
        'common/scripted_triggers/m.txt',
        'events/user.txt',
    ]);
    assert.deepEqual(ix.filesNaming(['shared_trigger'], 'game'), [
        'common/scripted_triggers/g.txt',
    ]);
    assert.deepEqual(ix.filesNaming(['kept'], 'mod'), ['events/reader.txt', 'events/saver.txt']);
    assert.deepEqual(ix.filesNaming(['nothing_writes_this'], 'mod'), []);
    assert.deepEqual(ix.filesNaming([], 'mod'), []);
});
