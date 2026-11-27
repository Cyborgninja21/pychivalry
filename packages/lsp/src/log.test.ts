/**
 * The game's log against the mod's files in the language server (docs/PLAN.md item 11.7): the
 * hand-made log over the planted-defect mod and its game stub gives a diagnostic at every place
 * in the mod the core's report ties a message to, with the log's line and the game's own text;
 * the base game's places are counted, not shown; a log that cannot be read says why; the log
 * folders are those of a stand-in home, each with its error log. No real log folder is read.
 */

import assert from 'node:assert/strict';
import { analyzeLog, fillPlaceholders, openWorkspace } from '@pychivalry/core';
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { LOG_FOLDERS_REQUEST, LOG_REQUEST, type LogAnswer, type LogFolderAnswer } from './log.js';
import { committedSpec, GAMES, scratch, serverInProcess, uriOf } from './testing.js';

const spec = committedSpec();
const REPO = path.resolve(GAMES, '..', '..');
const MOD = path.join(REPO, 'fixtures', 'defects', 'mod');
const GAME = path.join(GAMES, 'planted-defects', 'game');
const LOG = path.join(REPO, 'fixtures', 'logs', 'hand-made', 'planted-defects.log');

test("pychivalry/log: a diagnostic at every place in the mod the log's messages tie to", async (t) => {
    const root = scratch(t);
    const mod = path.join(root, 'mod');
    cpSync(MOD, mod, { recursive: true });
    const { client } = serverInProcess(t, { gamePath: GAME }, { findGame: () => null });
    await client.start([mod]);
    await client.settled();
    const answer: LogAnswer = await client.connection.sendRequest(LOG_REQUEST, { log: LOG });
    assert.equal(answer.error, null);
    assert.equal(answer.log, LOG);
    const workspace = openWorkspace({ spec, modDir: mod, gameDir: GAME, cacheDir: null });
    const report = analyzeLog({ spec, index: workspace.index, log: readFileSync(LOG) });
    assert.deepEqual(answer.totals, report.totals);
    const expected = report.messages.flatMap((m) =>
        m.occurrences.flatMap((o) =>
            o.ties
                .filter((tie) => tie.layer === 'mod')
                .map((tie) => ({
                    uri: uriOf(path.join(mod, ...tie.file.split('/'))),
                    line: o.line,
                    code: m.key,
                    range: tie.range,
                    text: fillPlaceholders(m.text.trim(), o.values),
                })),
        ),
    );
    assert.deepEqual(
        answer.diagnostics.map((d) => ({ uri: d.uri, line: d.line, code: d.code, range: d.range })),
        expected.map((e) => ({ uri: e.uri, line: e.line, code: e.code, range: e.range })),
    );
    for (const [i, d] of answer.diagnostics.entries()) {
        assert.ok(
            d.message.startsWith(
                `planted-defects.log line ${String(d.line)}: ${expected[i]?.text ?? ''} (`,
            ),
            d.message,
        );
    }
    const trigger = answer.diagnostics.find((d) => d.code === 'unknown_trigger_X');
    assert.equal(
        trigger?.message,
        "planted-defects.log line 1: Unknown trigger 'is_imprisonned' (where the mod writes is_imprisonned)",
    );
    const fileOnly = answer.diagnostics.find((d) => d.code === 'unknown_modifier_type_X_at_X');
    assert.match(fileOnly?.message ?? '', /\(the file it names; the line is not known\)$/);
    // The base game's places are counted, not shown.
    assert.equal(answer.inGame, 2);
    assert.equal(answer.notShown, 0);
    const missing: LogAnswer = await client.connection.sendRequest(LOG_REQUEST, {
        log: path.join(root, 'none.log'),
    });
    assert.match(missing.error ?? '', /^no such log: /);
    const bad: LogAnswer = await client.connection.sendRequest(LOG_REQUEST, {
        log: LOG,
        prefix: '(',
    });
    assert.match(bad.error ?? '', /the line prefix: not a regular expression/);
});

test("pychivalry/logFolders: the game's log folders of the home folder it is given, each with its error log", async (t) => {
    const root = scratch(t);
    const home = path.join(root, 'home');
    // The folder each system's game writes its logs in, under the stand-in home.
    const windows = process.platform === 'win32';
    const linux = process.platform !== 'win32' && process.platform !== 'darwin';
    const base = linux ? path.join(home, '.local', 'share') : path.join(home, 'Documents');
    const logs = path.join(base, 'Paradox Interactive', 'Crusader Kings III', 'logs');
    const kind = windows ? 'windows' : linux ? 'linux' : 'macos';
    mkdirSync(logs, { recursive: true });
    const { client } = serverInProcess(
        t,
        { gamePath: GAME },
        {
            findGame: () => null,
            logSearch: { env: {}, platform: process.platform, home, documents: () => null },
        },
    );
    await client.start([MOD]);
    await client.settled();
    let folders: LogFolderAnswer[] = await client.connection.sendRequest(LOG_FOLDERS_REQUEST);
    assert.deepEqual(
        folders.map((f) => [f.dir, f.kind, f.errorLog]),
        [[logs, kind, null]],
    );
    writeFileSync(path.join(logs, 'error.log'), '');
    folders = await client.connection.sendRequest(LOG_FOLDERS_REQUEST);
    assert.equal(folders[0]?.errorLog, path.join(logs, 'error.log'));
});
