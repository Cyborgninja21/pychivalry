/**
 * A base game lent and forked (docs/shared-index.md): a fork answers exactly as an index that
 * loaded the base game itself, on every fixture mod and the planted-defect mod; the base game is
 * frozen; forks do not see each other; a base game of another spec package, game folder,
 * platform or fallback encoding, or one whose files changed, is refused; and work in steps gives
 * the same result run straight through or in slices.
 */

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import {
    checkWorkspace,
    checkWorkspaceSteps,
    openWorkspace,
    type WorkspaceCheck,
} from '../check/workspace.js';
import { LayeredMap } from '../index/layered.js';
import { currentPlatform } from '../index/rules.js';
import { StringTable } from '../index/strings.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { drain, drainInSlices } from '../steps.js';
import { BaseRefused, baseMismatch, shareBase, type SharedBase } from './base.js';

const spec = committedSpec();
const GAME = path.join(REPO_ROOT, 'fixtures', 'game', 'planted-defects', 'game');
const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');
const PLANTED = path.join(REPO_ROOT, 'fixtures', 'defects', 'mod');

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-share-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** A base game opened (no cache) and lent. */
function lent(gameDir = GAME): SharedBase {
    const workspace = openWorkspace({ spec, gameDir, cacheDir: null, modDir: null });
    assert.ok(workspace.game !== null);
    return shareBase(workspace.game, {
        specSha256: spec.sha256,
        gameDir,
        platform: currentPlatform(),
        fallbackEncoding: undefined,
    });
}

/** What a run reports, every field a surface shows. */
function answers(run: WorkspaceCheck): string[] {
    return run.findings.map((f) =>
        JSON.stringify([
            f.layer,
            f.file,
            f.start,
            f.end,
            f.code,
            f.severity,
            f.message,
            f.data,
            f.evidence,
        ]),
    );
}

test('a fork answers as a base game loaded alone, on every fixture mod and the planted-defect mod', () => {
    const base = lent();
    const mods = [
        ...readdirSync(MODS, { withFileTypes: true })
            .filter((e) => e.isDirectory())
            .map((e) => path.join(MODS, e.name)),
        PLANTED,
    ];
    assert.ok(mods.length > 50, `${String(mods.length)} mods`);
    let findings = 0;
    for (const modDir of mods) {
        const alone = checkWorkspace({ spec, modDir, gameDir: GAME, cacheDir: null });
        const shared = checkWorkspace({ spec, modDir, gameDir: GAME, cacheDir: null, base });
        assert.deepEqual(answers(shared), answers(alone), path.basename(modDir));
        assert.deepEqual(shared.files, alone.files, path.basename(modDir));
        assert.equal(shared.index.digest(), alone.index.digest(), path.basename(modDir));
        assert.ok(shared.game !== null && alone.game !== null);
        assert.equal(shared.game.shared, true);
        assert.equal(alone.game.shared, false);
        assert.equal(shared.game.ms.build, 0, 'nothing was read for the fork');
        findings += alone.findings.length;
    }
    assert.ok(findings > 100, `${String(findings)} findings compared`);
    assert.ok(base.game.index.isFrozen);
});

test('the base game lent changes no more, and two forks of it do not see each other', (t) => {
    const base = lent();
    assert.throws(
        () => base.game.index.setFile('mod', 'common/x.txt', 'a = b\n'),
        /changes no more/,
    );
    const a = base.game.index.fork();
    const b = base.game.index.fork();
    a.setFile('mod', 'common/scripted_triggers/only_in_a.txt', 'only_in_a = { always = yes }\n');
    assert.equal(a.hasDefinition('only_in_a'), true);
    assert.equal(b.hasDefinition('only_in_a'), false);
    // A mod checked in one fork leaves the next fork's answers those of a base game alone.
    const dir = scratch(t);
    const modDir = path.join(dir, 'mod');
    cpSync(path.join(MODS, 'names-unknown-trigger-bad'), modDir, { recursive: true });
    const first = checkWorkspace({ spec, modDir: PLANTED, gameDir: GAME, cacheDir: null, base });
    const after = checkWorkspace({ spec, modDir, gameDir: GAME, cacheDir: null, base });
    const alone = checkWorkspace({ spec, modDir, gameDir: GAME, cacheDir: null });
    assert.ok(first.findings.length > 0);
    assert.deepEqual(answers(after), answers(alone));
});

test('a fork numbers names and orders its tables as one index would', () => {
    const table = StringTable.from(['a', 'b']);
    const fork = table.fork();
    assert.equal(fork.intern('c'), 2);
    assert.equal(fork.intern('a'), 0);
    assert.equal(fork.find('c'), 2);
    assert.equal(table.find('c'), -1);
    assert.deepEqual(fork.all(), ['a', 'b', 'c']);
    assert.throws(() => table.intern('d'), /adds no string/);
    assert.equal(table.intern('b'), 1, 'a string it holds is still found');

    // The same changes on one Map and on a base and a fork iterate in the same order.
    let seed = 7;
    const random = (n: number): number => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed % n;
    };
    for (let round = 0; round < 50; round++) {
        const plain = new Map<number, number[]>();
        const layered = new LayeredMap<number, number[]>();
        const change = (map: LayeredMap<number, number[]>): void => {
            const key = random(20);
            const op = random(3);
            if (op === 0) {
                plain.set(key, [round, key]);
                map.set(key, [round, key]);
            } else if (op === 1) {
                plain.delete(key);
                map.delete(key);
            } else {
                const list = plain.get(key);
                list?.push(round);
                map.mutable(key, (l) => [...l])?.push(round);
            }
        };
        for (let i = 0; i < 30; i++) {
            change(layered);
        }
        const before = JSON.stringify([...layered]);
        const forked = layered.fork();
        for (let i = 0; i < 30; i++) {
            change(forked);
        }
        assert.deepEqual([...forked], [...plain], `round ${String(round)}`);
        assert.deepEqual([...forked.keys()], [...plain.keys()]);
        for (let key = 0; key < 20; key++) {
            assert.equal(forked.has(key), plain.has(key));
        }
        assert.equal(JSON.stringify([...layered]), before, 'the base is unchanged');
        assert.throws(() => layered.set(1, []), /changes no more/);
    }
});

test('a base game of another spec package, game folder, platform or encoding is refused', (t) => {
    const base = lent();
    const same = {
        specSha256: spec.sha256,
        gameDir: GAME,
        platform: currentPlatform(),
        fallbackEncoding: undefined,
    };
    assert.equal(baseMismatch(base, same), null);
    assert.equal(
        baseMismatch(base, { ...same, specSha256: '0'.repeat(64) }),
        'another spec package',
    );
    assert.equal(baseMismatch(base, { ...same, gameDir: tmpdir() }), 'another game folder');
    assert.equal(baseMismatch(base, { ...same, platform: undefined }), 'another platform');
    assert.equal(
        baseMismatch(base, { ...same, fallbackEncoding: 'windows-1252' }),
        'another fallback encoding',
    );
    assert.equal(
        baseMismatch(base, { ...same, gameDir: GAME.toUpperCase() }, 'win32'),
        null,
        'a Windows folder in other letter case is the same folder',
    );
    // A game whose files changed since it was read is not the base game lent.
    const dir = scratch(t);
    const game = path.join(dir, 'install', 'game');
    cpSync(path.dirname(GAME), path.join(dir, 'install'), { recursive: true });
    const copied = lent(game);
    mkdirSync(path.join(game, 'common', 'scripted_triggers'), { recursive: true });
    writeFileSync(
        path.join(game, 'common', 'scripted_triggers', 'added_later.txt'),
        'added_later = { always = yes }\n',
    );
    assert.throws(
        () =>
            checkWorkspace({ spec, modDir: PLANTED, gameDir: game, cacheDir: null, base: copied }),
        (err: unknown) => err instanceof BaseRefused && /changed/.test(err.message),
    );
    assert.throws(
        () => checkWorkspace({ spec, modDir: PLANTED, gameDir: dir, cacheDir: null, base }),
        BaseRefused,
    );
});

test('work in steps gives the same result straight through and in slices', async () => {
    const base = lent();
    const straight = drain(
        checkWorkspaceSteps({ spec, modDir: PLANTED, gameDir: GAME, cacheDir: null, base }),
    );
    let turns = 0;
    const timer = setInterval(() => {
        turns++;
    }, 0);
    const sliced = await drainInSlices(
        checkWorkspaceSteps({ spec, modDir: PLANTED, gameDir: GAME, cacheDir: null, base }),
        0,
    );
    clearInterval(timer);
    assert.deepEqual(answers(sliced), answers(straight));
    assert.ok(turns > 0, 'the event loop had its turns between slices');
});
