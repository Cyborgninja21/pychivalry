/**
 * Diagnostics (docs/PLAN.md item 7.4): on every fixture mod, each file's diagnostics are the
 * one runner's findings for it (the same-answers row of docs/MVP.md's table, for the editor);
 * a finding's code, severity, message, range and evidence as a diagnostic; and an open file
 * edited, checked again from the editor's text, and closed.
 */

import { checkWorkspace, type WorkspaceFinding } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver-protocol/node';
import { CHECK_PAGE, checkPageOf, DIAGNOSTIC_SOURCE, toDiagnostic } from './diagnostics.js';
import {
    committedSpec,
    GAMES,
    gameStub,
    modCopy,
    MODS,
    REPO_ROOT,
    scratch,
    spawnServer,
    uriOf,
    write,
    type TestClient,
} from './testing.js';

const spec = committedSpec();

/** The game stub a fixture mod is read over, where its checks need one (as the core's tests read it). */
const STUBS: readonly { readonly mods: (name: string) => boolean; readonly game: string }[] = [
    {
        mods: (m) =>
            /^(scope-undefined-event-target|localization-missing-key|localization-unused-key)-/.test(
                m,
            ),
        game: 'event-targets-and-localization',
    },
    { mods: (m) => m === 'lookup-definitions-and-uses', game: 'lookup' },
    { mods: (m) => m.startsWith('override-rules'), game: 'override-rules' },
];

/** What a diagnostic shows a person: where, how severe, which code, what it says. */
function shown(d: Diagnostic): unknown {
    return {
        range: d.range,
        severity: d.severity,
        code: d.code,
        source: d.source,
        message: d.message,
        href: d.codeDescription?.href,
        data: d.data as unknown,
    };
}

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** A diagnostic's message as text. */
const messageOf = (d: Diagnostic): string =>
    typeof d.message === 'string' ? d.message : d.message.value;

/** Every file of the runner's run on a mod, with its findings. */
function byFile(mod: string, game: string, unusedKeys: boolean): Map<string, WorkspaceFinding[]> {
    const run = checkWorkspace({ spec, modDir: mod, gameDir: game, cacheDir: null, unusedKeys });
    const out = new Map<string, WorkspaceFinding[]>(run.files.map((f) => [f, []]));
    for (const f of run.findings) {
        out.get(f.file)?.push(f);
    }
    return out;
}

/** Compare the server's diagnostics and findings for every file of a mod with the runner's. */
async function sameAsRunner(
    client: TestClient,
    mod: string,
    game: string,
    unusedKeys: boolean,
): Promise<number> {
    let files = 0;
    for (const [file, findings] of byFile(mod, game, unusedKeys)) {
        const uri = uriOf(path.join(mod, ...file.split('/')));
        const got = client.diagnostics.get(uri);
        assert.ok(got !== undefined, `${path.basename(mod)}: ${file} has no diagnostics`);
        assert.deepEqual(
            json(got.diagnostics.map(shown)),
            json(findings.map(toDiagnostic).map(shown)),
            `${path.basename(mod)}: ${file}`,
        );
        const answer = await client.findings(uri);
        assert.equal(answer.file, file);
        assert.deepEqual(json(answer.findings), json(findings), `${path.basename(mod)}: ${file}`);
        files++;
    }
    return files;
}

test("on every fixture mod, each file's diagnostics are the one runner's findings for it", async (t) => {
    const empty = gameStub(path.join(scratch(t), 'install'));
    const mods = readdirSync(MODS)
        .filter((m) => statSync(path.join(MODS, m)).isDirectory())
        .sort();
    assert.ok(mods.length > 100);
    const groups = new Map<string, string[]>();
    for (const m of mods) {
        const stub = STUBS.find((s) => s.mods(m));
        const game = stub === undefined ? empty : path.join(GAMES, stub.game, 'game');
        groups.set(game, [...(groups.get(game) ?? []), path.join(MODS, m)]);
    }
    groups.set(path.join(GAMES, 'planted-defects', 'game'), [
        path.join(REPO_ROOT, 'fixtures', 'defects', 'mod'),
    ]);
    let files = 0;
    for (const [game, list] of groups) {
        // `localization/unused-key` is off by default; the group of its pair turns it on.
        const unusedKeys = list.some((m) => path.basename(m).startsWith('localization-unused-key'));
        const { client } = spawnServer(t, { gamePath: game, localization: { unusedKeys } });
        let previous: string | null = null;
        for (const mod of list) {
            const after = client.done.length;
            if (previous === null) {
                await client.start([mod]);
            } else {
                await client.folders([mod], [previous]);
            }
            await client.settled(after);
            files += await sameAsRunner(client, mod, game, unusedKeys);
            // Nothing of the mod before is left in the editor.
            if (previous !== null) {
                const old = uriOf(previous);
                for (const [uri, d] of client.diagnostics) {
                    if (uri.startsWith(`${old}/`)) {
                        assert.deepEqual(
                            d.diagnostics,
                            [],
                            `${uri} kept diagnostics of a closed mod`,
                        );
                    }
                }
            }
            previous = mod;
        }
    }
    assert.ok(files > 150, `${String(files)} files compared`);
});

test("a finding's code, severity, message, range and evidence become the diagnostic's", () => {
    const finding: WorkspaceFinding = {
        file: 'events/a.txt',
        layer: 'mod',
        code: 'names/unknown-trigger',
        severity: 'error',
        range: { start: { line: 2, character: 4 }, end: { line: 2, character: 9 } },
        start: 20,
        end: 25,
        message: "Unknown trigger 'fixx'",
        evidence: { kind: 'catalogue', id: 'unknown_trigger_X', text: "Unknown trigger '%s'" },
        data: { name: 'fixx' },
        fix: null,
    };
    const d = toDiagnostic(finding);
    assert.deepEqual(d.range, finding.range);
    assert.equal(d.severity, DiagnosticSeverity.Error);
    assert.equal(d.code, 'names/unknown-trigger');
    assert.equal(d.source, DIAGNOSTIC_SOURCE);
    assert.equal(d.message, finding.message);
    assert.equal(d.codeDescription?.href, `${CHECK_PAGE}#names`);
    assert.deepEqual(d.data, { evidence: finding.evidence, data: finding.data });
    for (const [severity, expected] of [
        ['warning', DiagnosticSeverity.Warning],
        ['information', DiagnosticSeverity.Information],
        ['hint', DiagnosticSeverity.Hint],
    ] as const) {
        assert.equal(toDiagnostic({ ...finding, severity }).severity, expected);
    }
});

test('each code links to the section of the check page that lists its family', () => {
    const page = readFileSync(path.join(REPO_ROOT, 'docs', 'guide', 'checks.md'), 'utf8');
    const sections = new Set([...page.matchAll(/^## (\S+)$/gm)].map((m) => m[1]));
    for (const match of page.matchAll(/^\| `([a-z-]+\/[a-z0-9-]+)` \|/gm)) {
        const code = match[1] ?? '';
        const anchor = checkPageOf(code).slice(CHECK_PAGE.length + 1);
        assert.ok(sections.has(anchor), `${code}: no section ${anchor}`);
    }
});

/** A server on a copy of a fixture mod over an empty game, started and settled. */
async function session(
    t: TestContext,
    mod: string,
): Promise<{ client: TestClient; dir: string; game: string }> {
    const game = gameStub(path.join(scratch(t), 'install'));
    const dir = modCopy(t, mod);
    const { client } = spawnServer(t, { gamePath: game });
    await client.start([dir]);
    await client.settled();
    return { client, dir, game };
}

/** The runner's findings for one file of a mod as it is on disk. */
function runnerFindings(dir: string, game: string, file: string): WorkspaceFinding[] {
    return [...(byFile(dir, game, false).get(file) ?? [])];
}

test('an edited open file is checked again from the editor text, as the runner checks it once saved', async (t) => {
    const { client, dir, game } = await session(t, 'names-unknown-trigger-bad');
    const file = readdirSync(path.join(dir, 'events'))[0] ?? '';
    const rel = `events/${file}`;
    const disk = path.join(dir, 'events', file);
    // The text as an editor holds it: without the byte-order mark, which is the file's encoding.
    const saved = readFileSync(disk, 'utf8');
    const mark = saved.startsWith('\uFEFF') ? '\uFEFF' : '';
    const text = saved.slice(mark.length);
    const uri = await client.open(disk, text);
    const before = await client.diagnosticsOf(uri);
    assert.ok(before.some((d) => d.code === 'names/unknown-trigger'));
    // Type a new line with an unknown trigger inside the first trigger block, a letter at a
    // time, then break a brace: every change is incremental.
    const at = text.indexOf('trigger = {') + 'trigger = {'.length;
    const line = text.slice(0, at).split('\n').length - 1;
    const character = at - text.lastIndexOf('\n', at - 1) - 1;
    let edited = text;
    const typed = '\n\t\tno_such_trigger_typed = yes';
    for (let i = 0; i < typed.length; i++) {
        const lines = edited.slice(0, at + i).split('\n');
        const l = lines.length - 1;
        const c = (lines.at(-1) ?? '').length;
        await client.change(uri, [
            {
                range: { start: { line: l, character: c }, end: { line: l, character: c } },
                text: typed.charAt(i),
            },
        ]);
        edited = edited.slice(0, at + i) + typed.charAt(i) + edited.slice(at + i);
    }
    assert.ok(line >= 0 && character >= 0);
    const version = await client.change(uri, [
        {
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
            text: '# a comment\n',
        },
    ]);
    edited = `# a comment\n${edited}`;
    await client.until(
        () => client.diagnostics.get(uri)?.version === version,
        'the diagnostics of the last change',
    );
    write(disk, `${mark}${edited}`);
    const expected = runnerFindings(dir, game, rel);
    assert.ok(expected.some((f) => f.message.includes('no_such_trigger_typed')));
    assert.deepEqual(json((await client.findings(uri)).findings), json(expected));
    assert.deepEqual(
        json(client.diagnostics.get(uri)?.diagnostics.map(shown)),
        json(expected.map(toDiagnostic).map(shown)),
    );
});

test('closing a file keeps its diagnostics, and the index goes back to the file on disk', async (t) => {
    const { client, dir } = await session(t, 'names-unknown-trigger-bad');
    const file = readdirSync(path.join(dir, 'events'))[0] ?? '';
    const disk = path.join(dir, 'events', file);
    // The text as an editor holds it: without the byte-order mark.
    const text = readFileSync(disk, 'utf8').replace(/^\uFEFF/, '');
    const uri = await client.open(disk, text);
    await client.until(() => client.diagnostics.get(uri)?.version === 1, 'the open file checked');
    const kept = client.diagnostics.get(uri)?.diagnostics ?? [];
    assert.ok(kept.length > 0);
    const published = client.published.get(uri) ?? 0;
    await client.close(uri);
    // Give the server time to do whatever closing does.
    await client.findings(uri);
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(client.published.get(uri), published, 'closing published nothing');
    assert.deepEqual(client.diagnostics.get(uri)?.diagnostics, kept);
    // An unsaved edit that removes every finding, then closed: the file on disk is what counts.
    const uri2 = await client.open(disk, text);
    const version = await client.change(uri2, [{ text: '' }]);
    await client.until(() => client.diagnostics.get(uri2)?.version === version, 'the edit');
    assert.deepEqual(client.diagnostics.get(uri2)?.diagnostics, []);
    const done = client.done.length;
    await client.close(uri2);
    await client.settled(done);
    assert.deepEqual(
        json(client.diagnostics.get(uri)?.diagnostics.map(shown)),
        json(kept.map(shown)),
    );
});

test('an unsaved definition in one file changes the findings of another, closed one', async (t) => {
    const { client, dir, game } = await session(t, 'names-unknown-trigger-bad');
    const events = readdirSync(path.join(dir, 'events'))[0] ?? '';
    const eventsUri = uriOf(path.join(dir, 'events', events));
    const before = client.diagnostics.get(eventsUri)?.diagnostics ?? [];
    const unknown = before.find((d) => d.code === 'names/unknown-trigger');
    assert.ok(unknown !== undefined);
    const name = /'([^']+)'/.exec(messageOf(unknown))?.[1] ?? '';
    assert.ok(name !== '');
    const triggers = path.join(dir, 'common', 'scripted_triggers', 'lsp_test_triggers.txt');
    write(triggers, '');
    const done = client.done.length;
    await client.filesChanged([{ uri: uriOf(triggers), type: 1 }]);
    await client.settled(done);
    const uri = await client.open(triggers, '');
    await client.diagnosticsOf(uri);
    await client.change(uri, [{ text: `${name} = {\n\talways = yes\n}\n` }]);
    await client.until(
        () =>
            !(client.diagnostics.get(eventsUri)?.diagnostics ?? []).some((d) =>
                messageOf(d).includes(`'${name}'`),
            ),
        'the other file to be checked again',
    );
    write(triggers, `${name} = {\n\talways = yes\n}\n`);
    const expected = byFile(dir, game, false).get(`events/${events}`) ?? [];
    assert.deepEqual(
        json(client.diagnostics.get(eventsUri)?.diagnostics.map(shown)),
        json(expected.map(toDiagnostic).map(shown)),
    );
    assert.ok(existsSync(triggers));
});
