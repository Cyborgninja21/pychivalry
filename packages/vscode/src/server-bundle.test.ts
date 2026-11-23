/**
 * The bundled agent server as the extension ships it (`task vscode:bundle`): copied to a
 * storage folder as the extension copies it, started by the command line both harnesses are
 * given, with this Node standing in for VS Code's own executable, and asked `check` on a copy
 * of the editor tests' fixture mod. Runs on Linux and Windows with no editor.
 */

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkThrough } from './editor/agent.js';
import { assertFixtureAnswer, FIXTURE_MOD } from './editor/fixture.js';
import { installServer } from './install.js';
import { serverLaunch } from './launch.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const BUNDLED = path.join(PACKAGE, 'dist', 'bundle', 'server');

test('the bundled server, copied to storage, answers check on a mod in a folder that needs quoting', async (t) => {
    assert.ok(existsSync(BUNDLED), `${BUNDLED} is missing: run task vscode:bundle first`);
    const root = mkdtempSync(path.join(tmpdir(), 'pychivalry-vscode-'));
    t.after(() => {
        rmSync(root, { recursive: true, force: true });
    });
    const storage = path.join(root, 'global storage', 'agent-server');
    assert.equal(installServer(BUNDLED, storage).changed, true);
    const mod = path.join(root, 'mods & more (100%)', 'a mod');
    cpSync(path.join(PACKAGE, '..', '..', 'fixtures', 'mods', FIXTURE_MOD), mod, {
        recursive: true,
    });
    const launch = serverLaunch(process.execPath, storage, mod);
    const home = path.join(root, 'home');
    assertFixtureAnswer(
        await checkThrough({
            ...launch,
            // No real game is looked for or cached: the home and cache folders are the test's.
            env: {
                ...launch.env,
                HOME: home,
                USERPROFILE: home,
                XDG_CACHE_HOME: home,
                LOCALAPPDATA: home,
            },
            cwd: root,
        }),
    );
});
