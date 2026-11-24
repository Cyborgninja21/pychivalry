/**
 * The `update-1` and `update-2` editor suites (docs/PLAN.md, item 7.1 (c)): the extension as a
 * user has it, installed in an extensions folder under a folder named after its version. The
 * runner starts VS Code with the first version, then installs a second version in its own
 * folder, removes the first, starts the server from Claude Code's entry with no VS Code running,
 * and starts VS Code again. The skills "Set up for Claude Code" copied into Claude Code's skills
 * folder (item 9.3) are the first version's, then, once the second activates, the second's,
 * whose skills the runner made differ.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import type { PychivalryApi } from '../extension.js';
import { EXTENSION_ID, SET_UP_CLAUDE_CODE } from '../ids.js';
import { MANIFEST_FILE, parseManifest } from '../install.js';
import { serverEntry } from '../setup.js';
import { readSkills, SKILL_FILE } from '../skills.js';
import { checkThrough } from './agent.js';
import {
    asEntry,
    assertFixtureAnswer,
    assertSkillsCopied,
    claudeEntryFor,
    isInside,
    SKILL_NOTE,
} from './fixture.js';
import { given, type EditorCase } from './harness.js';
import { activeExtension } from './main.js';

export function updateCases(step: 1 | 2): readonly EditorCase[] {
    const mod = given('PYCHIVALRY_TEST_MOD');
    const claudeConfig = given('CLAUDE_CONFIG_DIR');
    const extensionsDir = given('PYCHIVALRY_TEST_EXTENSIONS');
    const version = given(step === 1 ? 'PYCHIVALRY_TEST_V1' : 'PYCHIVALRY_TEST_V2');
    let ext: vscode.Extension<PychivalryApi> | undefined;
    const theExt = (): vscode.Extension<PychivalryApi> => {
        assert.ok(ext !== undefined, 'the extension did not activate');
        return ext;
    };

    const cases: EditorCase[] = [
        {
            name: `the installed version ${version} activates from its own versioned folder`,
            run: async () => {
                ext = await activeExtension();
                assert.equal(ext.id, EXTENSION_ID);
                assert.equal((ext.packageJSON as { version: string }).version, version);
                assert.equal(
                    path.relative(extensionsDir, ext.extensionPath),
                    `${EXTENSION_ID}-${version}`,
                );
                if (step === 2) {
                    assert.ok(
                        !existsSync(
                            path.join(
                                extensionsDir,
                                `${EXTENSION_ID}-${given('PYCHIVALRY_TEST_V1')}`,
                            ),
                        ),
                        'the first version is still installed',
                    );
                }
            },
        },
        {
            name: `7.1 (c): the stored copy of the server is version ${version}`,
            run: async () => {
                const installed = await theExt().exports.agentServer;
                assert.equal(installed.version, version);
                assert.equal(installed.changed, true, 'the copy was not written by this version');
                const manifest = parseManifest(
                    readFileSync(path.join(installed.dir, MANIFEST_FILE), 'utf8'),
                );
                assert.equal(manifest.version, version);
                assert.ok(!isInside(installed.dir, theExt().extensionPath), installed.dir);
            },
        },
    ];
    if (step === 1) {
        cases.push({
            name: '"Set up for Claude Code" writes the entry the update must keep working',
            run: async () => {
                const outcome = await vscode.commands.executeCommand<{ kind?: string } | undefined>(
                    SET_UP_CLAUDE_CODE,
                    vscode.Uri.file(mod),
                );
                assert.equal(outcome?.kind, 'claude', JSON.stringify(outcome));
                const entry = claudeEntryFor(claudeConfig, mod);
                assert.deepEqual(entry, serverEntry(await theExt().exports.launchFor(mod)));
                assertFixtureAnswer(await checkThrough(asEntry(entry)));
                // 9.3: the skills, version 1's, in Claude Code's skills folder.
                const { bundled, claudeDir } = theExt().exports.skills;
                assert.equal(claudeDir(), path.join(claudeConfig, 'skills'));
                assertSkillsCopied(claudeDir(), bundled);
            },
        });
    } else {
        cases.push({
            name: "7.1 (c): after the update, Claude Code's unchanged entry is the new version's command line and answers check",
            run: async () => {
                const entry = claudeEntryFor(claudeConfig, mod);
                assert.deepEqual(entry, serverEntry(await theExt().exports.launchFor(mod)));
                const [definition] = await theExt().exports.definitions();
                assert.ok(definition !== undefined);
                assert.deepEqual(
                    [definition.command, definition.args],
                    [entry['command'], entry['args']],
                );
                assertFixtureAnswer(await checkThrough(asEntry(entry)));
            },
        });
        cases.push({
            name: "9.3: after the update, the skills copied for Claude Code are brought up to the new version's",
            run: async () => {
                const refreshed = await theExt().exports.skillsRefreshed;
                const { bundled, claudeDir } = theExt().exports.skills;
                assert.deepEqual(
                    refreshed.map((r) => [r.dir, [...r.written].sort(), r.refused]),
                    [[claudeDir(), readSkills(bundled).map((s) => s.name), []]],
                );
                assertSkillsCopied(claudeDir(), bundled);
                for (const skill of readSkills(claudeDir())) {
                    const text = skill.files.find((f) => f.path === SKILL_FILE)?.bytes.toString();
                    assert.ok(
                        text?.endsWith(SKILL_NOTE(version)),
                        `${skill.name} is version ${version}'s`,
                    );
                }
            },
        });
    }
    return cases;
}
