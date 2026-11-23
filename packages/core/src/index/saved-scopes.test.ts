/**
 * What the index records for `scope/undefined-event-target` (docs/checks.md, item 4.6): the
 * saves of a scope under a name, the reads of a saved scope, and the words a `$PARAM$` builds;
 * each kept by the cache as the index holds it.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { CACHE_FORMAT, loadIndex, saveIndex, type CacheKey } from './cache.js';
import { isNameTemplate, nameTemplatePattern } from './extract.js';
import { fixtureIndex, packageRules, specFolders } from './testing.js';
import { WorkspaceIndex } from './workspace.js';

const TEXT = `fixture_effect = {
	save_scope_as = fixture_a
	SAVE_TEMPORARY_SCOPE_AS = fixture_b
	save_scope_as = $NAME$
	save_scope_as = fixture_built_$NAME$
	scope:fixture_a = { add_gold = 1 }
	add_gold = Scope:fixture_c.gold
	scope:$NAME$ = { add_gold = 1 }
	title:k_fixture = { add_gold = 1 }
}
`;

function index(): WorkspaceIndex {
    const made = new WorkspaceIndex({
        folders: specFolders(),
        rules: packageRules(),
        platform: 'linux',
    });
    made.addFile('mod', 'common/scripted_effects/fixture.txt', TEXT);
    return made;
}

test('a pair whose key saves a scope records a save of its name, in any case of the key', () => {
    const made = index();
    assert.deepEqual(
        made.savedScopes('fixture_a').map((s) => [s.file, s.range.start.line + 1]),
        [['common/scripted_effects/fixture.txt', 2]],
    );
    assert.equal(made.savedScopes('fixture_b').length, 1);
    assert.deepEqual(made.savedScopes('$NAME$'), []);
});

test('the head of a chain written with the saved-scope link records a read', () => {
    const made = index();
    assert.equal(made.scopeReads('fixture_a').length, 1);
    assert.equal(made.scopeReads('fixture_c').length, 1);
    // `title:` is a global link that takes data, but no saved-scope link.
    assert.deepEqual(made.scopeReads('k_fixture'), []);
    // fixture_a is written as a save too; fixture_c only as a read.
    assert.equal(made.isUsedBesideScopeReads('fixture_a'), true);
    assert.equal(made.isUsedBesideScopeReads('fixture_c'), false);
});

test('a word built with a `$PARAM$` beside literal text is a template', () => {
    const made = index();
    assert.deepEqual(made.nameTemplates(), ['fixture_built_$NAME$']);
    assert.ok(isNameTemplate('a_$X$_b'));
    assert.ok(!isNameTemplate('$X$'));
    assert.ok(!isNameTemplate('plain'));
    const pattern = nameTemplatePattern('been_to_$SCENE$.x');
    assert.ok(pattern.test('been_to_healer.x'));
    assert.ok(!pattern.test('been_to_.x'));
    assert.ok(!pattern.test('been_to_healerx'));
});

test('removing a file drops its saves, reads and templates', () => {
    const made = index();
    made.removeFile('mod', 'common/scripted_effects/fixture.txt');
    assert.deepEqual(made.savedScopes('fixture_a'), []);
    assert.deepEqual(made.scopeReads('fixture_c'), []);
    assert.deepEqual(made.nameTemplates(), []);
});

test('the cache keeps the saves, the reads and the templates', () => {
    const scratch = mkdtempSync(path.join(tmpdir(), 'pychivalry-saves-'));
    try {
        const fresh = fixtureIndex(
            'event-targets-and-localization',
            'scope-undefined-event-target-bad',
        );
        const key: CacheKey = {
            format: CACHE_FORMAT,
            spec_sha256: 'a'.repeat(64),
            rules_sha256: 'b'.repeat(64),
            platform: 'linux',
            game_build: '1.21.0.3',
            manifest_sha256: 'c'.repeat(64),
            fallback_encoding: null,
        };
        const file = path.join(scratch, 'index.idx');
        saveIndex(fresh, file, key);
        const loaded = loadIndex(file, key, {
            folders: specFolders(),
            rules: packageRules(),
            platform: 'linux',
        });
        assert.ok('index' in loaded);
        const reloaded = loaded.index;
        assert.equal(reloaded.digest(), fresh.digest());
        for (const name of ['fixture_base_saved', 'fixture_target_saved_here']) {
            assert.deepEqual(reloaded.savedScopes(name), fresh.savedScopes(name));
            assert.ok(fresh.savedScopes(name).length > 0);
        }
        assert.deepEqual(
            reloaded.scopeReads('fixture_target_never_saved'),
            fresh.scopeReads('fixture_target_never_saved'),
        );
        assert.deepEqual(reloaded.nameTemplates(), fresh.nameTemplates());
        assert.ok(fresh.nameTemplates().length > 0);
    } finally {
        rmSync(scratch, { recursive: true, force: true });
    }
});
