/**
 * The background check (docs/PLAN.md item 7.4; docs/MVP.md, "Lessons from 2.3.0"): it honours
 * the file limit, reports its progress, keeps the server answering between files, and stops
 * and starts again when files change, ending with every file's findings the runner's.
 */

import { checkWorkspace } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { toDiagnostic } from './diagnostics.js';
import { committedSpec, gameStub, scratch, serverInProcess, uriOf, write } from './testing.js';

const spec = committedSpec();

/** A mod of `count` event files, each with an unknown trigger on its own line. */
function bigMod(t: TestContext, count: number): string {
    const dir = path.join(scratch(t), 'big-mod');
    write(path.join(dir, 'descriptor.mod'), 'name = "Big"\n');
    for (let i = 0; i < count; i++) {
        const n = String(i).padStart(4, '0');
        const body = Array.from(
            { length: 40 },
            (_, k) =>
                `big_${n}.${String(k + 1)} = {\n\ttype = character_event\n\ttrigger = {\n\t\tno_such_trigger_${n}_${String(k)} = yes\n\t}\n}\n`,
        ).join('');
        write(path.join(dir, 'events', `big_${n}.txt`), `namespace = big_${n}\n${body}`);
    }
    return dir;
}

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

test('the background checks at most the file limit, in order, and says so once', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const mod = bigMod(t, 12);
    const { client } = serverInProcess(t, { gamePath: game, background: { fileLimit: 5 } });
    await client.start([mod]);
    const done = await client.settled();
    assert.equal(done.checked, 5);
    assert.equal(done.limited, true);
    const published = [...client.diagnostics.keys()].sort();
    assert.deepEqual(
        published,
        Array.from({ length: 5 }, (_, i) =>
            uriOf(path.join(mod, 'events', `big_${String(i).padStart(4, '0')}.txt`)),
        ).sort(),
    );
    const notes = client.messages.filter((m) =>
        m.message.includes('pychivalry.background.fileLimit'),
    );
    assert.equal(notes.length, 1);
    assert.match(notes[0]?.message ?? '', /first 5 of the mod's 12 files/);
    // A file past the limit is checked when it is opened.
    const tenth = path.join(mod, 'events', 'big_0010.txt');
    const uri = await client.open(tenth, readFileSync(tenth, 'utf8'));
    const diagnostics = await client.diagnosticsOf(uri);
    assert.ok(diagnostics.some((d) => d.code === 'names/unknown-trigger'));
    // Raising the limit checks the rest.
    const before = client.done.length;
    await client.configure({ gamePath: game, background: { fileLimit: 100 } });
    const more = await client.settled(before);
    assert.equal(more.limited, false);
    assert.equal(client.diagnostics.size, 12);
});

test('a limit of 0 checks nothing in the background, and an open file still', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const mod = bigMod(t, 3);
    const { client } = serverInProcess(t, { gamePath: game, background: { fileLimit: 0 } });
    await client.start([mod]);
    const done = await client.settled();
    assert.equal(done.checked, 0);
    assert.equal(client.diagnostics.size, 0);
    const file = path.join(mod, 'events', 'big_0001.txt');
    const uri = await client.open(file, readFileSync(file, 'utf8'));
    assert.ok((await client.diagnosticsOf(uri)).some((d) => d.code === 'names/unknown-trigger'));
});

test('the background reports progress and keeps answering requests between files', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const mod = bigMod(t, 150);
    const { client } = serverInProcess(t, { gamePath: game });
    await client.start([mod]);
    await client.until(
        () =>
            client.progress.some(
                (p) => (p as { kind?: string }).kind === 'begin' && client.diagnostics.size > 0,
            ),
        'the background to begin',
    );
    // A request asked while the pass runs is answered before the pass ends.
    const file = path.join(mod, 'events', 'big_0149.txt');
    const uri = await client.open(file, 'big_0149.1 = { type = character_event }\n');
    const symbols = await client.symbols(uri);
    assert.equal(symbols?.length, 1);
    const finished = client.done.some((d) => d.complete);
    assert.equal(finished, false, 'the pass was still running when the request was answered');
    const done = await client.settled();
    assert.equal(done.complete, true);
    const kinds = client.progress.map((p) => (p as { kind: string }).kind);
    assert.ok(kinds.includes('begin') && kinds.includes('report') && kinds.includes('end'));
});

test('a change to the files cancels the pass under way and starts another over what is left', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const mod = bigMod(t, 150);
    const { client } = serverInProcess(t, { gamePath: game });
    await client.start([mod]);
    await client.until(() => client.diagnostics.size >= 3, 'the background to begin');
    // Fix the unknown triggers of the last file on disk while the pass runs.
    const last = path.join(mod, 'events', 'big_0149.txt');
    write(last, 'namespace = big_0149\n');
    await client.filesChanged([{ uri: uriOf(last), type: 2 }]);
    const done = await client.settled();
    assert.ok(
        client.done.some((d) => d.cancelled),
        'a pass was cancelled',
    );
    assert.equal(done.cancelled, false);
    const run = checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null });
    for (const file of run.files) {
        const uri = uriOf(path.join(mod, ...file.split('/')));
        assert.deepEqual(
            json(client.diagnostics.get(uri)?.diagnostics),
            json(run.findings.filter((f) => f.file === file).map(toDiagnostic)),
            file,
        );
    }
    assert.deepEqual(client.diagnostics.get(uriOf(last))?.diagnostics, []);
});

test('a file deleted on disk loses its diagnostics', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const mod = bigMod(t, 3);
    const { client } = serverInProcess(t, { gamePath: game });
    await client.start([mod]);
    await client.settled();
    const gone = path.join(mod, 'events', 'big_0001.txt');
    assert.ok((client.diagnostics.get(uriOf(gone))?.diagnostics.length ?? 0) > 0);
    rmSync(gone);
    await client.filesChanged([{ uri: uriOf(gone), type: 3 }]);
    await client.until(
        () => client.diagnostics.get(uriOf(gone))?.diagnostics.length === 0,
        'the deleted file to lose its diagnostics',
    );
});

test('a file open when the server starts has its diagnostics before the whole mod is checked', async (t) => {
    const game = gameStub(path.join(scratch(t), 'install'));
    const mod = bigMod(t, 150);
    const { client } = serverInProcess(t, { gamePath: game });
    const last = path.join(mod, 'events', 'big_0149.txt');
    await client.start([mod]);
    const uri = await client.open(last, readFileSync(last, 'utf8'));
    await client.until(() => client.diagnostics.get(uri)?.version === 1, 'the open file checked');
    assert.equal(
        client.done.some((d) => d.complete),
        false,
        'its diagnostics came before the first full result',
    );
    assert.ok(
        (client.diagnostics.get(uri)?.diagnostics ?? []).some(
            (d) => d.code === 'names/unknown-trigger',
        ),
    );
    await client.settled();
});
