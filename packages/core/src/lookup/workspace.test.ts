/**
 * Lookup over a workspace: the stub `fixtures/game/lookup` and the mod
 * `fixtures/mods/lookup-definitions-and-uses`, indexed with the committed spec's folder list
 * and override rules (part D1) on Linux. Every definition with its layer and file, which one is
 * in force or "winner not known", the uses bounded, the names script can call, and a
 * modifier's localization read through the index (absent with no game folder).
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { indexFiles, indexMod, installFolders, listInstall } from '../index/read-game.js';
import { decidingRules } from '../index/rules.js';
import { packageRules, repoPath, specFolders } from '../index/testing.js';
import type { WorkspaceIndex } from '../index/workspace.js';
import { committedSpec } from '../spec/testing.js';
import { diskFileSource, type FileSource } from './localization.js';
import { lookup, type LookupOptions } from './lookup.js';
import type {
    BucketReading,
    DefinitionGroupAnswer,
    LookupResult,
    Reading,
    ReadingKind,
} from './types.js';

interface Workspace {
    readonly index: WorkspaceIndex;
    readonly files: FileSource;
}

let workspace: Workspace | undefined;

/** The stub game and the fixture mod, indexed once. */
function fixture(): Workspace {
    if (workspace === undefined) {
        const rules = packageRules();
        const listing = listInstall(
            installFolders(repoPath('fixtures/game/lookup/game')),
            specFolders(),
            decidingRules(rules, 'linux'),
        );
        const index = indexFiles(listing.files, {
            folders: specFolders(),
            rules,
            platform: 'linux',
        });
        const mod = indexMod(index, repoPath('fixtures/mods/lookup-definitions-and-uses'));
        workspace = { index, files: diskFileSource([listing, mod]) };
    }
    return workspace;
}

function look(name: string, options: Partial<LookupOptions> = {}): LookupResult {
    const { index, files } = fixture();
    return lookup(name, { spec: committedSpec(), index, files, ...options });
}

function only<K extends ReadingKind>(
    result: LookupResult,
    kind: K,
): Extract<Reading, { kind: K }>[] {
    return result.readings.filter((r): r is Extract<Reading, { kind: K }> => r.kind === kind);
}

/** A value of a union narrowed to one status; the test fails when it has another. */
function narrow<T extends { readonly status: string }, S extends T['status']>(
    value: T | undefined,
    status: S,
): Extract<T, { readonly status: S }> {
    assert.ok(value);
    assert.equal(value.status, status);
    return value as Extract<T, { readonly status: S }>;
}

function groups(result: LookupResult): readonly DefinitionGroupAnswer[] {
    return narrow(result.definitions, 'read').groups;
}

function modifierOf(result: LookupResult): BucketReading {
    const found = only(result, 'bucket').find((r) => r.bucket === 'modifiers');
    assert.ok(found);
    return found;
}

test('every definition, with its layer and file, and the one in force by a settled row', () => {
    const r = look('fixture_scripted_trigger');
    const [group, ...rest] = groups(r);
    assert.deepEqual(rest, []);
    assert.ok(group);
    assert.equal(group.database, 'common/scripted_triggers');
    const { index } = fixture();
    const resolution = index.resolve('common/scripted_triggers', 'fixture_scripted_trigger');
    assert.equal(narrow(group.inForce, 'winner').rule, narrow(resolution, 'winner').rule);
    assert.deepEqual(
        group.definitions.map((d) => [d.layer, d.file, d.range.start.line + 1, d.inForce]),
        [
            ['game', 'common/scripted_triggers/00_fixture_triggers.txt', 1, 'no'],
            ['mod', 'common/scripted_triggers/zz_fixture_triggers.txt', 1, 'yes'],
        ],
    );
    // The package says nothing of the name itself: unknown, with the name script can call.
    assert.equal(r.unknown, true);
    assert.deepEqual(
        only(r, 'defined').map((d) => [d.database, d.calledAs]),
        [['common/scripted_triggers', 'triggers']],
    );
    assert.deepEqual(r.suggestions, { status: 'not-needed' });
});

test('defined twice where only a partial row speaks: winner not known, with the reason', () => {
    const [group] = groups(look('fixture_character'));
    assert.ok(group);
    assert.equal(group.database, 'history/characters');
    assert.deepEqual(
        narrow(group.inForce, 'winner-not-known').reasons.map((reason) => reason.kind),
        ['not-settled'],
    );
    assert.deepEqual(
        group.definitions.map((d) => [d.layer, d.inForce]),
        [
            ['game', 'not-known'],
            ['mod', 'not-known'],
        ],
    );
});

test('uses are bounded: the whole count, per layer, and the first N', () => {
    const r = look('fixture_scripted_trigger', { usesLimit: 2 });
    const uses = narrow(r.uses, 'read');
    assert.equal(uses.count, 5);
    assert.deepEqual(uses.byLayer, { game: 3, mod: 2 });
    assert.equal(uses.limit, 2);
    assert.deepEqual(
        uses.first.map((u) => [u.layer, u.file, u.range.start.line + 1]),
        [
            ['game', 'events/fixture_lookup_events.txt', 6],
            ['game', 'events/fixture_lookup_events.txt', 7],
        ],
    );
    assert.equal(narrow(look('fixture_scripted_trigger').uses, 'read').first.length, 5);
});

test("a modifier's localization: the D5 key of its format record, each copy's text and the one in force", () => {
    const r = look('monthly_prestige');
    const localization = narrow(modifierOf(r).modifier?.localization, 'read');
    const [key, ...others] = localization.keys;
    assert.deepEqual(others, []);
    assert.ok(key);
    assert.equal(key.key, 'monthly_prestige');
    assert.equal(key.row.directory, 'common/modifier_definition_formats');
    assert.equal(key.row.pattern, '<name>');
    assert.equal(key.row.status, 'measured-only');
    assert.deepEqual(
        key.records.map((d) => [d.layer, d.file, d.range.start.line + 1]),
        [['game', 'common/modifier_definition_formats/00_fixture_definitions.txt', 1]],
    );
    assert.deepEqual(
        key.texts.map((t) => [t.language, t.layer, t.text]),
        [
            ['l_english', 'game', 'Fixture prestige each month'],
            ['l_english', 'mod', "The mod's prestige each month"],
            ['l_french', 'game', 'Prestige de la fixture'],
        ],
    );
    // The copy in force is the one the index resolves, and only one per language.
    const { index } = fixture();
    const resolution = index.resolve('localization:l_english', 'monthly_prestige');
    const winner = narrow(resolution, 'winner').winner;
    const english = key.texts.filter((t) => t.language === 'l_english');
    assert.deepEqual(
        english.filter((t) => t.inForce === 'yes').map((t) => [t.layer, t.file]),
        [[winner.layer, winner.file]],
    );
    assert.equal(english.filter((t) => t.inForce === 'no').length, 1);
    // One language when asked for.
    const french = narrow(
        modifierOf(look('monthly_prestige', { language: 'l_french' })).modifier?.localization,
        'read',
    );
    assert.deepEqual(
        french.keys.flatMap((k) => k.texts.map((t) => t.text)),
        ['Prestige de la fixture'],
    );
});

test('a modifier whose D5 key has no text, and one with no format record, each say so', () => {
    const none = narrow(
        modifierOf(look('monthly_prestige_gain_mult')).modifier?.localization,
        'read',
    );
    assert.deepEqual(
        none.keys.map((k) => [k.key, k.texts.length]),
        [['monthly_prestige_gain_mult', 0]],
    );
    assert.equal(none.why, null);
    const unrecorded = narrow(
        modifierOf(look('accolade_glory_gain_mult')).modifier?.localization,
        'read',
    );
    assert.deepEqual(unrecorded.keys, []);
    assert.ok((unrecorded.why ?? '').includes('D5'));
});

test('no game folder: the localization is absent, and so it is with no file source', () => {
    const { index } = fixture();
    const noFiles = lookup('monthly_prestige', { spec: committedSpec(), index });
    assert.equal(modifierOf(noFiles).modifier?.localization.status, 'no-game-folder');
    const noIndex = lookup('monthly_prestige', { spec: committedSpec(), files: fixture().files });
    assert.equal(modifierOf(noIndex).modifier?.localization.status, 'no-game-folder');
    assert.equal(noIndex.definitions.status, 'no-workspace');
});

test('a file source may hand over the text an editor holds; a file it cannot read has no text', () => {
    const { files } = fixture();
    // The editor's copy of the mod's file, with the text it holds; every other file from disk.
    const held = '﻿l_english:\r\n monthly_prestige:0 "As the editor holds it"\r\n';
    const editor: FileSource = (layer, path) =>
        layer === 'mod' && path === 'localization/english/fixture_lookup_l_english.yml'
            ? held
            : files(layer, path);
    const read = narrow(
        modifierOf(look('monthly_prestige', { files: editor, language: 'l_english' })).modifier
            ?.localization,
        'read',
    );
    assert.deepEqual(
        read.keys.flatMap((k) => k.texts.map((t) => [t.layer, t.text])),
        [
            ['game', 'Fixture prestige each month'],
            ['mod', 'As the editor holds it'],
        ],
    );
    const none: FileSource = () => undefined;
    const unread = narrow(
        modifierOf(look('monthly_prestige', { files: none })).modifier?.localization,
        'read',
    );
    assert.ok(unread.keys.every((k) => k.texts.every((t) => t.text === null)));
    assert.equal(unread.keys[0]?.texts.length, 3);
});

test('a keyword template whose key the workspace defines, and one whose key it does not', () => {
    const fills = only(look('add_fixture_lifestyle_xp'), 'keyword-template');
    assert.deepEqual(
        fills.map((f) => [f.bucket, f.template, f.key, f.keyDefined]),
        [
            ['triggers', '%s_xp', 'add_fixture_lifestyle', false],
            ['effects', 'add_%s_xp', 'fixture_lifestyle', true],
        ],
    );
});

test('an iterator over a list the workspace defines', () => {
    const [iterator] = only(look('every_fixture_list'), 'iterator');
    assert.ok(iterator);
    assert.deepEqual(iterator.list, { from: 'defined', database: 'common/scripted_lists' });
    assert.equal(iterator.derivedOnly, null);
    assert.equal(iterator.formKind, null);
    assert.equal(iterator.prefixKind?.kind, 'effect');
});

test('did you mean draws on the names the workspace defines', () => {
    const r = look('fixture_scripted_trigge');
    assert.equal(r.unknown, true);
    const suggestions = narrow(r.suggestions, 'computed');
    assert.deepEqual(
        suggestions.suggestions.map((s) => [s.name, s.distance, s.from]),
        [['fixture_scripted_trigger', 1, 'workspace']],
    );
    assert.equal(suggestions.complete, true);
});

test('a localization key is a definition like any other', () => {
    const r = look('monthly_prestige');
    assert.deepEqual(
        groups(r).map((g) => [g.database, g.inForce.status, g.definitions.length]),
        [
            ['common/modifier_definition_formats', 'single', 1],
            ['localization:l_english', 'winner', 2],
            ['localization:l_french', 'single', 1],
        ],
    );
});

/** The stub `fixtures/game/override-rules` alone, indexed once: its coats of arms and alias lines. */
let aliases: WorkspaceIndex | undefined;

function aliasIndex(): WorkspaceIndex {
    if (aliases === undefined) {
        const rules = packageRules();
        const listing = listInstall(
            installFolders(repoPath('fixtures/game/override-rules/game')),
            specFolders(),
            decidingRules(rules, 'linux'),
        );
        aliases = indexFiles(listing.files, { folders: specFolders(), rules, platform: 'linux' });
    }
    return aliases;
}

test("a name an alias row decides shows the object it shares (the index's Resolution.shared)", () => {
    const r = lookup('fixture_alias_twice', { spec: committedSpec(), index: aliasIndex() });
    const [group] = groups(r);
    assert.ok(group !== undefined);
    const inForce = group.inForce;
    assert.ok(inForce.status === 'winner', inForce.status);
    assert.ok(inForce.shared !== undefined);
    // The later alias line points the key to fixture_coa_b; the block of
    // fixture_alias_then_block, read after its own alias line to fixture_coa_b, fills the
    // object the three names share.
    assert.equal(inForce.shared.target, 'fixture_coa_b');
    assert.deepEqual([...inForce.shared.names].sort(), [
        'fixture_alias_then_block',
        'fixture_alias_twice',
        'fixture_coa_b',
    ]);
    assert.equal(
        inForce.shared.filledBy.file,
        'common/coat_of_arms/coat_of_arms/00_fixture_coat_of_arms.txt',
    );
    assert.equal(inForce.shared.filledBy.range.start.line, 19);
});

test('a name whose alias lines all point to a target not read yet is defined and not in force', () => {
    const r = lookup('fixture_alias_missing', { spec: committedSpec(), index: aliasIndex() });
    const [group] = groups(r);
    assert.ok(group !== undefined);
    assert.deepEqual(group.inForce, { status: 'not-in-force', rule: 'coat-of-arms-alias' });
    assert.deepEqual(
        group.definitions.map((d) => d.inForce),
        ['no'],
    );
});
