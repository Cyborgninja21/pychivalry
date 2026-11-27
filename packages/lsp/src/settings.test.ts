/**
 * The settings, the server's arguments, and an open file's text as the editor changes it.
 */

import { catalogueFromSpec, parse } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { serverArguments, UsageError } from './args.js';
import { OpenDocument } from './documents.js';
import { DEFAULT_SETTINGS, readSettings, settingsChange } from './settings.js';
import { committedSpec } from './testing.js';

test('the settings are read nested or dotted, a value of the wrong type taking the default', () => {
    assert.deepEqual(readSettings(undefined), DEFAULT_SETTINGS);
    assert.deepEqual(DEFAULT_SETTINGS, {
        gamePath: '',
        fileLimit: 3000,
        unusedKeys: true,
        fallbackEncoding: null,
        inlayHints: true,
    });
    assert.deepEqual(
        readSettings({
            gamePath: ' /games/ck3/game ',
            background: { fileLimit: 12.7 },
            localization: { unusedKeys: false },
            encoding: { fallback: 'windows-1252' },
            inlayHints: { enabled: false },
        }),
        {
            gamePath: '/games/ck3/game',
            fileLimit: 12,
            unusedKeys: false,
            fallbackEncoding: 'windows-1252',
            inlayHints: false,
        },
    );
    assert.deepEqual(
        readSettings({ 'background.fileLimit': 0, 'localization.unusedKeys': false }),
        {
            ...DEFAULT_SETTINGS,
            fileLimit: 0,
            unusedKeys: false,
        },
    );
    assert.deepEqual(
        readSettings({
            gamePath: 3,
            background: { fileLimit: -1 },
            encoding: { fallback: 'latin-1' },
            inlayHints: { enabled: 'no' },
        }),
        DEFAULT_SETTINGS,
    );
});

test('what a change of settings asks of the server', () => {
    const base = DEFAULT_SETTINGS;
    assert.deepEqual(settingsChange(base, { ...base, gamePath: '/g' }), {
        reopen: true,
        recheck: false,
        more: false,
    });
    assert.deepEqual(
        settingsChange(base, { ...base, fallbackEncoding: 'windows-1252' }).reopen,
        true,
    );
    assert.deepEqual(settingsChange(base, { ...base, unusedKeys: false }), {
        reopen: false,
        recheck: true,
        more: false,
    });
    assert.deepEqual(settingsChange(base, { ...base, fileLimit: 5000 }).more, true);
    assert.deepEqual(settingsChange(base, { ...base, fileLimit: 10 }).more, false);
});

test('the server takes one transport, the spec and the client process id', () => {
    assert.deepEqual(serverArguments(['--node-ipc', '--clientProcessId=42']), {
        transport: 'ipc',
        spec: null,
    });
    assert.deepEqual(serverArguments(['--stdio', '--spec', 'spec/', '--clientProcessId', '7']), {
        transport: 'stdio',
        spec: 'spec/',
    });
    for (const argv of [
        [],
        ['--socket=1'],
        ['--pipe=x'],
        ['--stdio', '--stdio'],
        ['--stdio', '--spec'],
    ]) {
        assert.throws(() => serverArguments(argv), UsageError, argv.join(' '));
    }
});

test('an open script file is re-parsed incrementally, to the tree a full parse gives', () => {
    const catalogue = catalogueFromSpec(committedSpec().data);
    const text = 'a = {\n\tb = {\n\t\tc = yes\n\t}\n}\nd = { e = 1 }\n';
    const doc = new OpenDocument('file:///m/events/a.txt', 'events/a.txt', 1, text, catalogue);
    assert.equal(doc.kind, 'script');
    doc.script();
    doc.change(2, [
        { range: { start: { line: 2, character: 6 }, end: { line: 2, character: 9 } }, text: 'no' },
        {
            range: { start: { line: 5, character: 10 }, end: { line: 5, character: 11 } },
            text: '23',
        },
        {
            range: { start: { line: 1, character: 7 }, end: { line: 1, character: 7 } },
            text: '\n\t\tx = y',
        },
    ]);
    const expected = 'a = {\n\tb = {\n\t\tx = y\n\t\tc = no\n\t}\n}\nd = { e = 23 }\n';
    assert.equal(doc.text, expected);
    assert.equal(doc.version, 2);
    assert.equal(doc.parses.incremental, 3);
    assert.equal(doc.parses.whole, 1);
    const full = parse(expected, { catalogue });
    assert.deepEqual(doc.script().file, full.file);
    assert.deepEqual(doc.script().findings, full.findings);
    // A change that breaks a brace still gives the full parse's tree and findings.
    doc.change(3, [
        { range: { start: { line: 3, character: 8 }, end: { line: 3, character: 8 } }, text: ' {' },
    ]);
    const broken = parse(doc.text, { catalogue });
    assert.deepEqual(doc.script().file, broken.file);
    assert.deepEqual(doc.script().findings, broken.findings);
    // The whole text replaced: parsed again.
    doc.change(4, [{ text: 'z = 1\n' }]);
    assert.equal(doc.text, 'z = 1\n');
    assert.deepEqual(doc.script().file, parse('z = 1\n').file);
    assert.equal(doc.parses.whole, 2);
    // A file outside the mod, or of another kind, is no script.
    // A GUI file is read since build step 10, by the GUI parser, as a whole.
    assert.equal(new OpenDocument('file:///x.gui', 'gui/x.gui', 1, '', catalogue).kind, 'gui');
    assert.equal(new OpenDocument('file:///x.dds', 'gfx/x.dds', 1, '', catalogue).kind, null);
    assert.equal(new OpenDocument('file:///x.txt', null, 1, '', catalogue).kind, null);
});
