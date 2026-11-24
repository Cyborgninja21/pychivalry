/**
 * Quick fixes over a real round trip (docs/PLAN.md item 8.7; docs/MVP.md, "Tests per feature",
 * row "Quick fixes"): the code actions of a file's diagnostics are its findings' fix data, the
 * same the `pychivalry/findings` request gives; a safe fix is the preferred action; a file with
 * several safe fixes of a code gets "fix every safe ... in the file", and `source.fixAll` gets
 * them all; a fix that edits another file edits it by its URI; one that creates a file is offered
 * only to an editor that can create files; a diagnostic the server no longer holds gets none.
 */

import assert from 'node:assert/strict';
import { cpSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import type { WorkspaceFinding } from '@pychivalry/core';
import type {
    CodeAction,
    CreateFile,
    Diagnostic,
    TextDocumentEdit,
    TextEdit,
} from 'vscode-languageserver-protocol/node';
import {
    GAMES,
    REPO_ROOT,
    scratch,
    spawnServer,
    uriOf,
    write,
    type TestClient,
} from './testing.js';

const GAME = path.join(GAMES, 'planted-defects', 'game');

async function actions(
    client: TestClient,
    uri: string,
    diagnostics: readonly Diagnostic[],
    only?: string[],
): Promise<CodeAction[]> {
    return client.connection.sendRequest('textDocument/codeAction', {
        textDocument: { uri },
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
        context: { diagnostics, ...(only === undefined ? {} : { only }) },
    });
}

/** Start a session as `TestClient.start` does, with an editor that can create files. */
async function startCreating(client: TestClient, folder: string): Promise<void> {
    await client.connection.sendRequest('initialize', {
        processId: null,
        rootUri: uriOf(folder),
        workspaceFolders: [{ uri: uriOf(folder), name: path.basename(folder) }],
        capabilities: {
            workspace: {
                configuration: true,
                workspaceFolders: true,
                workspaceEdit: { documentChanges: true, resourceOperations: ['create'] },
            },
            window: { workDoneProgress: true },
            textDocument: { publishDiagnostics: { versionSupport: true } },
        },
    });
    await client.connection.sendNotification('initialized', {});
}

test("the quick fixes of the planted-defect mod are its findings' fix data", async (t) => {
    const mod = path.join(scratch(t), 'mod');
    cpSync(path.join(REPO_ROOT, 'fixtures', 'defects', 'mod'), mod, { recursive: true });
    const { client } = spawnServer(t, { gamePath: GAME });
    await client.start([mod]);
    await client.settled();
    const file = path.join(mod, 'events', 'harvest_events.txt');
    const uri = await client.open(file, readFileSync(file, 'utf8'));
    const diagnostics = await client.diagnosticsOf(uri, (d) => d.length > 0);
    const { findings } = await client.findings(uri);
    const got = await actions(client, uri, diagnostics);
    // Every alternative of every finding's fix is an action, and nothing else is but the "fix
    // every safe" actions; the insertion of the byte-order mark, which is the file's encoding in
    // the editor, is left out of an action, and an action of nothing else is not offered.
    const mark = (e: { new_text: string }): boolean => e.new_text === '\uFEFF';
    const expected = findings.flatMap((f: WorkspaceFinding) =>
        (f.fix?.alternatives ?? [])
            .map((a) => ({ ...a, edits: a.edits.filter((e) => !mark(e)) }))
            .filter((a) => a.edits.length > 0)
            .map((a) => ({
                title: a.title,
                preferred: f.fix?.safety === 'safe',
                changes: Object.fromEntries(
                    [...new Set(a.edits.map((e) => e.file))].map((name) => [
                        uriOf(path.join(mod, ...name.split('/'))),
                        a.edits
                            .filter((e) => e.file === name)
                            .map((e) => ({ range: e.range, newText: e.new_text })),
                    ]),
                ),
            })),
    );
    assert.ok(expected.length > 0);
    assert.deepEqual(
        got
            .filter((a) => !a.title.startsWith('Fix every safe '))
            .map((a) => ({
                title: a.title,
                preferred: a.isPreferred === true,
                changes: a.edit?.changes,
            })),
        expected,
    );
    assert.ok(got.every((a) => a.kind === 'quickfix'));
    const imprisoned = got.find((a) => a.title === "Replace 'is_imprisonned' with 'is_imprisoned'");
    assert.ok(imprisoned?.isPreferred === true, 'a safe fix is the preferred action');
    assert.equal(imprisoned.diagnostics?.[0]?.code, 'names/unknown-trigger');

    // A localization stub edits the localization file, by its URI.
    const court = path.join(mod, 'events', 'harvest_court_events.txt');
    const courtUri = await client.open(court, readFileSync(court, 'utf8'));
    const courtDiagnostics = await client.diagnosticsOf(courtUri, (d) => d.length > 0);
    const stub = (await actions(client, courtUri, courtDiagnostics)).find((a) =>
        a.title.startsWith("Add a localization stub for 'harvest.0013.desc'"),
    );
    const locUri = uriOf(path.join(mod, 'localization', 'english', 'harvest_l_english.yml'));
    assert.deepEqual(Object.keys(stub?.edit?.changes ?? {}), [locUri]);
    assert.equal(stub?.isPreferred, false, 'a suggestion is not preferred');

    // A diagnostic the server does not hold (another range) gets no action.
    const first = diagnostics[0];
    assert.ok(first !== undefined);
    const moved = {
        ...first,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    };
    assert.deepEqual(await actions(client, uri, [moved]), []);
});

test('several safe fixes of a code in a file: fix every one of them, and source.fixAll', async (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    const events = path.join(mod, 'events', 'fixture_events.txt');
    write(path.join(mod, 'descriptor.mod'), 'name = "Fixes"\n');
    write(
        events,
        'namespace = fixture\n\nfixture.0001 = {\n\thidden = yes\n\ttrigger = {\n\t\tis_imprisonned = no\n\t\tis_adulte = yes\n\t}\n\timmediate = {\n\t\tif = {\n\t\t\tlimit { is_adult = yes }\n\t\t\tadd_gold = 1\n\t\t}\n\t}\n}\n',
    );
    const { client } = spawnServer(t, { gamePath: GAME });
    await client.start([mod]);
    await client.settled();
    const uri = await client.open(events, readFileSync(events, 'utf8'));
    const diagnostics = await client.diagnosticsOf(uri, (d) => d.length >= 3);
    const triggers = diagnostics.filter((d) => d.code === 'names/unknown-trigger');
    assert.equal(triggers.length, 2);
    const got = await actions(client, uri, triggers);
    const all = got.filter(
        (a) => a.title === 'Fix every safe names/unknown-trigger in the file (2)',
    );
    assert.equal(all.length, 1, 'once, however many diagnostics of the code are asked about');
    assert.deepEqual((all[0]?.edit?.changes?.[uri] ?? []).map((e) => e.newText).sort(), [
        'is_adult',
        'is_imprisoned',
    ]);
    const fixAll = await actions(client, uri, [], ['source.fixAll']);
    assert.equal(fixAll.length, 1);
    assert.equal(fixAll[0]?.kind, 'source.fixAll');
    assert.deepEqual((fixAll[0].edit?.changes?.[uri] ?? []).map((e) => e.newText).sort(), [
        '= ',
        'is_adult',
        'is_imprisoned',
    ]);
    assert.deepEqual(await actions(client, uri, [], ['refactor']), [], 'nothing else is offered');
});

test('a stub in a new localization file only for an editor that can create files', async (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'mod');
    const events = path.join(mod, 'events', 'fixture_events.txt');
    write(path.join(mod, 'descriptor.mod'), 'name = "Stub"\n');
    write(
        events,
        'namespace = fixture\n\nfixture.0001 = {\n\ttype = character_event\n\ttitle = fixture.0001.t\n\tdesc = fixture.0001.desc\n\toption = {\n\t\tname = fixture.0001.a\n\t}\n}\n',
    );
    const loc = 'localization/english/fixture_events_l_english.yml';
    for (const creating of [false, true]) {
        const { client } = spawnServer(t, { gamePath: GAME });
        if (creating) {
            await startCreating(client, mod);
        } else {
            await client.start([mod]);
        }
        await client.settled();
        const uri = await client.open(events, readFileSync(events, 'utf8'));
        const diagnostics = await client.diagnosticsOf(uri, (d) =>
            d.some((x) => x.code === 'localization/missing-key'),
        );
        const stubs = (await actions(client, uri, diagnostics)).filter((a) =>
            a.title.startsWith('Add a localization stub'),
        );
        if (!creating) {
            assert.deepEqual(stubs, [], 'no file is created for an editor that cannot');
            continue;
        }
        assert.equal(stubs.length, 3);
        const changes = stubs[0]?.edit?.documentChanges ?? [];
        const create = changes[0] as CreateFile;
        const text = changes[1] as TextDocumentEdit;
        assert.equal(create.kind, 'create');
        assert.equal(create.uri, uriOf(path.join(mod, ...loc.split('/'))));
        assert.equal(text.textDocument.uri, create.uri);
        assert.match(
            (text.edits[0] as TextEdit | undefined)?.newText ?? '',
            /^\ufeffl_english:\n fixture\.0001\.\w+:0 "fixture\.0001\.\w+"\n$/,
        );
    }
});
