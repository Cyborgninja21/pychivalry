/**
 * The one reading behind both surfaces' `source` (`readSource`, `source-text.ts`): what the
 * command line lists with nothing indexed (`openSources`) and what the agent server reads in its
 * workspace (`workspaceSources`) give the same layers and the same lines for every place, over
 * the planted-defect mod and its game stub, its file not valid UTF-8 and its localization among
 * them; the refusals say their argument and their kind; the lines shown keep to the room the
 * limits give them, escaped characters counted.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import {
    readSource,
    SOURCE_MAX_LINE_CHARACTERS,
    SOURCE_MAX_LINES,
    SOURCE_TEXT_ROOM,
    sourceLayers,
    SourceRefused,
    type SourcePlace,
    type SourceSet,
} from '../index/source-text.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { openSources, openWorkspace, workspaceSources } from './workspace.js';

const GAME = path.join(REPO_ROOT, 'fixtures', 'game', 'planted-defects', 'game');
const MOD = path.join(REPO_ROOT, 'fixtures', 'defects', 'mod');

function scratch(t: TestContext): string {
    const dir = mkdtempSync(path.join(tmpdir(), 'pychivalry-sources-'));
    t.after(() => {
        rmSync(dir, { recursive: true, force: true });
    });
    return dir;
}

/** Every listed file's layer and path, sorted. */
function filesOf(set: SourceSet): string[] {
    return set.listings.flatMap((l) => l.files.map((f) => `${f.layer} ${f.path}`)).sort();
}

test('the listed set and the workspace give the same layers, files and lines for every place', () => {
    const spec = committedSpec();
    const listed = openSources({ spec, gameDir: GAME, modDir: MOD });
    const workspace = workspaceSources(
        openWorkspace({ spec, gameDir: GAME, modDir: MOD, cacheDir: null }),
        GAME,
    );
    assert.deepEqual(sourceLayers(listed), sourceLayers(workspace));
    assert.deepEqual(sourceLayers(listed)[0], 'mod', 'the mod first');
    assert.deepEqual(filesOf(listed), filesOf(workspace));
    const places: SourcePlace[] = [];
    for (const file of filesOf(listed)) {
        const [layer = '', rel = ''] = file.split(' ');
        for (const line of [1, 3, 8, 30]) {
            places.push({ layer, file: rel, line });
            places.push({ layer, file: rel, line, endLine: line + 2, context: 0 });
        }
    }
    let shown = 0;
    let notUtf8 = 0;
    for (const place of places) {
        const answer = (set: SourceSet): unknown => {
            try {
                return readSource(set, place);
            } catch (err) {
                assert.ok(err instanceof SourceRefused);
                return { refused: err.message, argument: err.argument, kind: err.kind };
            }
        };
        const a = answer(listed);
        assert.deepEqual(a, answer(workspace), JSON.stringify(place));
        if (typeof a === 'object' && a !== null && 'lines' in a) {
            shown++;
            if ((a as unknown as { encoding: string }).encoding !== 'utf-8') {
                notUtf8++;
            }
        }
    }
    assert.ok(shown > 40, `${String(shown)} places shown`);
    assert.ok(notUtf8 > 0, 'the planted file that is not UTF-8 among them');
});

test('each refusal names its argument and its kind: form, or a place not read', () => {
    const spec = committedSpec();
    const set = openSources({ spec, gameDir: GAME, modDir: MOD });
    const effects = 'common/scripted_effects/00_feast_effects.txt';
    const cases: [SourcePlace, string, string, RegExp][] = [
        [{ layer: 'game', file: effects, line: 0 }, 'line', 'form', /not a line number/],
        [{ layer: 'game', file: effects, line: 1.5 }, 'line', 'form', /not a line number/],
        [
            { layer: 'game', file: effects, line: 3, endLine: 2 },
            'end_line',
            'form',
            /is before line 3/,
        ],
        [{ layer: 'game', file: effects, line: 1, context: 21 }, 'context', 'form', /from 0 to 20/],
        [{ layer: 'game', file: '/etc/hostname', line: 1 }, 'file', 'form', /absolute path/],
        [{ layer: 'nowhere', file: '../x.txt', line: 1 }, 'file', 'form', /no empty, \. or \.\./],
        [
            { layer: 'nowhere', file: effects, line: 1 },
            'layer',
            'place',
            /the layers are mod, game/,
        ],
        [
            { layer: 'game', file: 'common/x.txt', line: 1 },
            'file',
            'place',
            /has no file common\/x\.txt/,
        ],
        [{ layer: 'game', file: effects, line: 99 }, 'line', 'place', /past the end/],
    ];
    for (const [place, argument, kind, message] of cases) {
        assert.throws(
            () => readSource(set, place),
            (err) =>
                err instanceof SourceRefused &&
                err.argument === argument &&
                err.kind === kind &&
                message.test(err.message),
            JSON.stringify(place),
        );
    }
    const modOnly = openSources({ spec, gameDir: null, modDir: MOD });
    assert.throws(
        () => readSource(modOnly, { layer: 'game', file: effects, line: 1 }),
        /game is not a layer read here: the base game is not read, so the only layer is mod/,
    );
    const gameOnly = openSources({ spec, gameDir: GAME, modDir: null });
    assert.deepEqual(sourceLayers(gameOnly), ['game']);
    assert.throws(
        () => readSource(gameOnly, { layer: 'mod', file: 'events/harvest_events.txt', line: 1 }),
        /mod is not a layer read here: no mod is read; the layers are game/,
    );
    const nothing = openSources({ spec, gameDir: null, modDir: null });
    assert.throws(
        () => readSource(nothing, { layer: 'game', file: effects, line: 1 }),
        /neither the base game nor a mod is read/,
    );
});

test('the lines shown keep to their room, escaped characters counted, and say what was left out', (t) => {
    const spec = committedSpec();
    const mod = scratch(t);
    const loc = path.join(mod, 'localization', 'english');
    mkdirSync(loc, { recursive: true });
    // Lines of quotes: each is escaped in JSON, twice its length.
    const quoted = ` key:0 "${'"'.repeat(SOURCE_MAX_LINE_CHARACTERS - 12)}"`;
    writeFileSync(
        path.join(loc, 'quotes_l_english.yml'),
        `\ufeffl_english:\n${Array.from({ length: 50 }, () => quoted).join('\n')}\n`,
    );
    const set = openSources({ spec, gameDir: null, modDir: mod });
    const answer = readSource(set, {
        layer: 'mod',
        file: 'localization/english/quotes_l_english.yml',
        line: 20,
        context: 20,
    });
    assert.ok(JSON.stringify(answer.lines).length <= SOURCE_TEXT_ROOM);
    assert.ok(answer.lines.length < SOURCE_MAX_LINES, 'some lines left out');
    assert.equal(answer.from, 1);
    assert.equal(answer.to, answer.from + answer.lines.length - 1);
    assert.match(
        answer.notes.at(-1) ?? '',
        new RegExp(
            `lines ${String(answer.to + 1)} to 40 are left out to keep the result small; ask again with line ${String(answer.to + 1)}`,
        ),
    );
    // The same file in plain text: every line fits.
    writeFileSync(
        path.join(loc, 'quotes_l_english.yml'),
        `\ufeffl_english:\n${Array.from({ length: 50 }, () => ' key:0 "plain"').join('\n')}\n`,
    );
    const plain = readSource(set, {
        layer: 'mod',
        file: 'localization/english/quotes_l_english.yml',
        line: 20,
        context: 20,
    });
    assert.equal(plain.lines.length, SOURCE_MAX_LINES);
    assert.deepEqual(plain.notes, []);
});
