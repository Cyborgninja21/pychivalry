/**
 * One file checked as the runner checks it (`checkSourceFile`, over `checkNames`): from its
 * bytes, it is exactly the runner's findings for the file; from the text an editor holds,
 * parsed (a script file) or read (a localization file), it is the same when the text is the
 * file's. What a language server checks while a file is open.
 */

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { readLocalization } from '../index/localization.js';
import { fileKindOf } from '../index/workspace.js';
import { committedSpec, REPO_ROOT } from '../spec/testing.js';
import { catalogueFromSpec } from '../syntax/findings.js';
import { decodeScript } from '../syntax/decode.js';
import { parse } from '../syntax/parser.js';
import { checkNames, checkSourceFile, checkWorkspace, openWorkspace } from './workspace.js';

const spec = committedSpec();
const MODS = path.join(REPO_ROOT, 'fixtures', 'mods');

const json = (value: unknown): unknown => JSON.parse(JSON.stringify(value));

/** An empty game install in a temporary folder, removed when the test ends: its game folder. */
function gameStub(t: TestContext): string {
    const root = mkdtempSync(path.join(tmpdir(), 'pychivalry-source-file-'));
    t.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    mkdirSync(path.join(root, 'launcher'), { recursive: true });
    writeFileSync(
        path.join(root, 'launcher', 'launcher-settings.json'),
        `${JSON.stringify({ gameId: 'ck3', rawVersion: '1.21.0.3', dlcPath: '../game' })}\n`,
    );
    mkdirSync(path.join(root, 'game', 'common'), { recursive: true });
    return path.join(root, 'game');
}

test('from bytes, from parsed text or from read text, a file has the runner’s findings', (t) => {
    const game = gameStub(t);
    const catalogue = catalogueFromSpec(spec.data);
    let compared = 0;
    for (const mod of readdirSync(MODS, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort()) {
        const modDir = path.join(MODS, mod);
        const run = checkWorkspace({ spec, modDir, gameDir: game, cacheDir: null });
        const workspace = openWorkspace({ spec, gameDir: game, cacheDir: null, modDir });
        const names = checkNames(workspace, modDir);
        for (const file of workspace.mod?.files ?? []) {
            if (fileKindOf(file.path) === undefined) {
                continue;
            }
            const expected = json(run.findings.filter((f) => f.file === file.path));
            const bytes = readFileSync(file.disk);
            const common = { spec, file: file.path, layer: 'mod', names, index: workspace.index };
            const fromBytes = checkSourceFile({ ...common, source: { bytes } });
            assert.deepEqual(json(fromBytes.kept), expected, `${mod}: ${file.path} from bytes`);
            const decoded = decodeScript(bytes, { catalogue });
            const fromText = checkSourceFile({
                ...common,
                source:
                    fileKindOf(file.path) === 'localization'
                        ? { localization: readLocalization(bytes) }
                        : {
                              script: parse(decoded.text, { catalogue }),
                              notes: decoded.findings,
                              // The file's mark, which text without it does not show.
                              bom: decoded.bom,
                          },
            });
            assert.deepEqual(json(fromText.kept), expected, `${mod}: ${file.path} from text`);
            compared++;
        }
    }
    assert.ok(compared > 150);
});

test('a source of the wrong kind for the file is refused', (t) => {
    const game = gameStub(t);
    const workspace = openWorkspace({ spec, gameDir: game, cacheDir: null, modDir: null });
    const common = {
        spec,
        layer: 'mod',
        names: checkNames(workspace, null),
        index: workspace.index,
    };
    assert.throws(() =>
        checkSourceFile({
            ...common,
            file: 'events/a.txt',
            source: { localization: readLocalization(new Uint8Array()) },
        }),
    );
    assert.throws(() =>
        checkSourceFile({
            ...common,
            file: 'localization/english/a_l_english.yml',
            source: { script: parse('') },
        }),
    );
});
