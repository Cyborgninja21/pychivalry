/**
 * The capture and the in-game load (docs/PLAN.md items 11.1 and 11.8), prepared and never run on
 * the game: every test here starts a stand-in (`stand-in-game.ts`), in a temporary user folder,
 * under a temporary decisions page. The guard refuses without the owner's word recorded for a
 * launch, before anything is touched; a capture puts the mod list back byte for byte with its
 * time and removes its descriptors, whatever happened, and writes a record with no absolute path;
 * the in-game load grades a result by the lines its log adds that name its files.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    statSync,
    utimesSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { openSpec } from '@pychivalry/core';
import { capture, descriptorName, scrubbed } from './capture.js';
import { LAUNCH_WORDS, LaunchRefused, ownersWord } from './guard.js';
import { contentFiles, inGameLoad, inGameLoadGrade } from './in-game-load.js';
import { repoRoot } from '../util.js';

const STAND_IN = fileURLToPath(new URL('./stand-in-game.js', import.meta.url));
const SPEC = path.join(repoRoot(), 'spec');

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-capture-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** A user folder, an install, a decisions page with a launch decision, and two mods. */
function setUp(t: TestContext) {
    const root = scratch(t);
    const user = path.join(root, 'user');
    mkdirSync(path.join(user, 'logs'), { recursive: true });
    const list = '{"disabled_dlcs":[],"enabled_mods":["mod/someone_else.mod"]}';
    writeFileSync(path.join(user, 'dlc_load.json'), list);
    const then = new Date('2026-01-02T03:04:05Z');
    utimesSync(path.join(user, 'dlc_load.json'), then, then);
    const install = path.join(root, 'install');
    mkdirSync(path.join(install, 'launcher'), { recursive: true });
    writeFileSync(
        path.join(install, 'launcher', 'launcher-settings.json'),
        '{"rawVersion":"1.21.0.3"}',
    );
    const decisions = path.join(root, 'decisions.md');
    writeFileSync(
        decisions,
        [
            "| 1 | 2026-01-01 | Step 11 | On the owner's word, step 11 starts without launching the game. |",
            `| 2 | 2026-01-02 | Game launch | On the owner's word, ${LAUNCH_WORDS}: the captures of item 11.1. |`,
            `| 3 | 2026-01-02 | Game launches | The guard asks for ${LAUNCH_WORDS}. |`,
            `| 4 | 2026-01-02 | Game launch | The guard asks for ${LAUNCH_WORDS}. |`,
            '',
        ].join('\n'),
    );
    const mod = (name: string, text: string): string => {
        const dir = path.join(root, 'mods', name);
        mkdirSync(path.join(dir, 'events'), { recursive: true });
        writeFileSync(path.join(dir, 'descriptor.mod'), `name="${name}"\n`);
        writeFileSync(path.join(dir, 'events', 'a.txt'), text);
        return dir;
    };
    const base = mod('base', 'namespace = a\n');
    const result = path.join(root, 'mods', 'result');
    mkdirSync(path.join(result, 'events'), { recursive: true });
    writeFileSync(path.join(result, 'descriptor.mod'), 'name="result"\n');
    writeFileSync(path.join(result, 'events', 'a.txt'), 'namespace = a\n');
    writeFileSync(
        path.join(result, 'events', 'b.txt'),
        'a.1 = { trigger = { stand_in_defect = yes } }\n',
    );
    return {
        root,
        user,
        install,
        decisions,
        base,
        result,
        list,
        then,
        start: { command: process.execPath, args: [STAND_IN, user] },
    };
}

test("the guard: no launch without a decision recording the owner's word for one", (t) => {
    const s = setUp(t);
    assert.throws(() => ownersWord(undefined, s.decisions), LaunchRefused);
    assert.throws(() => ownersWord('', s.decisions), /set PYCHIVALRY_OWNERS_WORD/);
    assert.throws(() => ownersWord('yes', s.decisions), /must be "decision <n>"/);
    assert.throws(() => ownersWord('decision 9', s.decisions), /has no decision 9/);
    assert.throws(
        () => ownersWord('decision 1', s.decisions),
        /does not record the owner's word for a launch/,
    );
    assert.equal(ownersWord('decision 2', s.decisions).decision, 2);
    // A row that only quotes the words, of another area or not the owner's word, lets nothing run.
    assert.throws(() => ownersWord('decision 3', s.decisions), /does not record/);
    assert.throws(() => ownersWord('decision 4', s.decisions), /does not record/);
    // The repository's own page: decision 194 is the word to start step 11 without a launch,
    // decision 199 the guard's own description; neither lets a launch run.
    for (const n of [194, 199]) {
        assert.throws(
            () =>
                ownersWord(`decision ${String(n)}`, path.join(repoRoot(), 'docs', 'decisions.md')),
            /does not record/,
        );
    }
});

test('a refused capture touches nothing: no mod list written, no descriptor, no folder', async (t) => {
    const s = setUp(t);
    const out = path.join(s.root, 'out');
    await assert.rejects(
        capture({
            ownersWord: 'decision 1',
            decisionsFile: s.decisions,
            installDir: s.install,
            start: s.start,
            options: [],
            userDir: s.user,
            mods: [s.result],
            outDir: out,
        }),
        LaunchRefused,
    );
    assert.equal(readFileSync(path.join(s.user, 'dlc_load.json'), 'utf8'), s.list);
    assert.deepEqual(readdirSync(s.user).sort(), ['dlc_load.json', 'logs']);
    assert.ok(!readdirSync(s.root).includes('out'));
});

test('a capture: the mod list set, the game started, quiet logs awaited, stopped, the list put back', async (t) => {
    const s = setUp(t);
    const out = path.join(s.root, 'out');
    const record = await capture({
        ownersWord: 'decision 2',
        decisionsFile: s.decisions,
        installDir: s.install,
        start: s.start,
        options: ['-debug_mode'],
        userDir: s.user,
        mods: [s.result],
        outDir: out,
        quietSeconds: 1,
        pollMs: 100,
    });
    assert.equal(record.ended, 'quiet');
    assert.equal(record.game.build, '1.21.0.3');
    assert.deepEqual(record.options, ['-debug_mode']);
    assert.deepEqual(record.mods, [{ name: 'result', descriptor: `mod/${descriptorName(0)}` }]);
    assert.deepEqual(record.owners_word, { decision: 2 });
    assert.deepEqual(record.dlc_load.restored && record.dlc_load.identical, true);
    assert.equal(record.descriptors_removed, true);
    assert.deepEqual(
        record.logs.map((l) => [l.name, l.lines]),
        [
            ['debug.log', 1],
            ['error.log', 1],
        ],
    );
    assert.match(
        readFileSync(path.join(out, 'logs', 'error.log'), 'utf8'),
        /in file: "events\/b\.txt"/,
    );
    // The mod list back, byte for byte and with its time; no descriptor left.
    assert.equal(readFileSync(path.join(s.user, 'dlc_load.json'), 'utf8'), s.list);
    assert.equal(statSync(path.join(s.user, 'dlc_load.json')).mtime.getTime(), s.then.getTime());
    assert.deepEqual(readdirSync(path.join(s.user, 'mod')), []);
    // The record and the logs kept name no folder of this machine.
    const text = readFileSync(path.join(out, 'capture.json'), 'utf8');
    assert.ok(!text.includes(s.root), 'no absolute path in the record');
    const debug = readFileSync(path.join(out, 'logs', 'debug.log'), 'utf8');
    assert.ok(!debug.includes(s.root), debug);
    assert.match(debug, /reading <user dir>[\\/]dlc_load\.json/);
});

test('a game that ends by itself ends the wait; a descriptor of the same name already there is refused', async (t) => {
    const s = setUp(t);
    const record = await capture({
        ownersWord: 'decision 2',
        decisionsFile: s.decisions,
        installDir: s.install,
        start: s.start,
        options: ['--exit'],
        userDir: s.user,
        mods: [s.base],
        outDir: path.join(s.root, 'out'),
        quietSeconds: 30,
        pollMs: 100,
    });
    assert.equal(record.ended, 'exited');
    assert.equal(record.exit_code, 0);
    mkdirSync(path.join(s.user, 'mod'), { recursive: true });
    writeFileSync(path.join(s.user, 'mod', descriptorName(0)), 'theirs');
    await assert.rejects(
        capture({
            ownersWord: 'decision 2',
            decisionsFile: s.decisions,
            installDir: s.install,
            start: s.start,
            options: [],
            userDir: s.user,
            mods: [s.base],
            outDir: path.join(s.root, 'out-2'),
        }),
        /already holds/,
    );
    assert.equal(readFileSync(path.join(s.user, 'mod', descriptorName(0)), 'utf8'), 'theirs');
});

test("the in-game load grade: a result's log may add no line naming its files", (t) => {
    const s = setUp(t);
    const spec = openSpec(SPEC);
    assert.deepEqual(contentFiles(s.base, s.result), ['events/b.txt']);
    const without = Buffer.from(
        'Error: "Unknown trigger \'x\'" in file: "events/a.txt" near line: 1\n',
    );
    const added = Buffer.concat([
        without,
        Buffer.from(
            'Error: "Unknown trigger \'stand_in_defect\'" in file: "events\\B.txt" near line: 1\r\n',
        ),
    ]);
    const failed = inGameLoadGrade(spec, without, added, ['events/b.txt']);
    assert.equal(failed.held, false);
    assert.deepEqual(failed.counts, [{ file: 'events/b.txt', without: 0, with: 1, added: 1 }]);
    assert.deepEqual(failed.added[0]?.messages, ['error_X_in_file_X_near_line_X']);
    assert.equal(failed.added[0].line, 2);
    // A file named as often without the content adds nothing.
    assert.equal(inGameLoadGrade(spec, without, without, ['events/a.txt']).held, true);
});

test('the in-game load end to end on the stand-in: two captures, the grade', async (t) => {
    const s = setUp(t);
    const options = {
        ownersWord: 'decision 2',
        decisionsFile: s.decisions,
        specDir: SPEC,
        installDir: s.install,
        start: s.start,
        options: [],
        userDir: s.user,
        baseDir: s.base,
        quietSeconds: 1,
        pollMs: 100,
    };
    const bad = await inGameLoad({
        ...options,
        resultDir: s.result,
        outDir: path.join(s.root, 'bad'),
    });
    assert.equal(bad.grade.held, false);
    assert.deepEqual(bad.grade.files, ['events/b.txt']);
    writeFileSync(path.join(s.result, 'events', 'b.txt'), 'a.1 = { }\n');
    const good = await inGameLoad({
        ...options,
        resultDir: s.result,
        outDir: path.join(s.root, 'good'),
    });
    assert.equal(good.grade.held, true);
    await assert.rejects(
        inGameLoad({
            ...options,
            ownersWord: undefined,
            resultDir: s.result,
            outDir: path.join(s.root, 'no'),
        }),
        LaunchRefused,
    );
    assert.equal(readFileSync(path.join(s.user, 'dlc_load.json'), 'utf8'), s.list);
});

test("the tools refuse both launch commands without the owner's word, before reading anything else", (t) => {
    const s = setUp(t);
    const cli = fileURLToPath(new URL('../cli.js', import.meta.url));
    for (const [group, command] of [
        ['game', 'capture-log'],
        ['scored', 'in-game-load'],
    ] as const) {
        for (const word of [undefined, 'decision 194']) {
            const env: Record<string, string | undefined> = {
                ...process.env,
                PYCHIVALRY_OWNERS_WORD: undefined,
                CK3_INSTALL_PATH: s.install,
                CK3_USER_PATH: s.user,
                CAPTURE_OUT: path.join(s.root, 'out'),
            };
            if (word !== undefined) {
                env['PYCHIVALRY_OWNERS_WORD'] = word;
            }
            const r = spawnSync(process.execPath, [cli, group, command], { encoding: 'utf8', env });
            assert.equal(r.status, 2, r.stderr);
            assert.match(
                r.stderr,
                word === undefined ? /no launch without the owner's word/ : /does not record/,
            );
        }
    }
    assert.equal(readFileSync(path.join(s.user, 'dlc_load.json'), 'utf8'), s.list);
    assert.ok(!readdirSync(s.root).includes('out'));
});

test('a log kept names no folder of this machine: each written as its placeholder, any separator, any case', () => {
    const out = scrubbed(
        Buffer.from(
            'C:\\Users\\Someone\\Documents\\x.txt and c:/users/someone/mods/a/events/b.txt\n',
        ),
        [
            ['C:\\Users\\Someone\\Documents', '<user dir>'],
            ['C:\\Users\\Someone\\mods\\a', '<mod 0>'],
            ['C:\\Users\\Someone', '<home>'],
        ],
    ).toString('latin1');
    assert.equal(out, '<user dir>\\x.txt and <mod 0>/events/b.txt\n');
});
