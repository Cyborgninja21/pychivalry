/**
 * The `main` editor suite: the extension from its development folder, on a copy of a fixture
 * mod (docs/PLAN.md, items 7.1 (a) and (b), 7.3, 7.4, 7.6 and 7.8): the agent server reaches
 * both AI harnesses, the language server checks the mod and VS Code shows what it finds, the
 * settings are declared, and the game folder setting reaches the agent server, VS Code's AI and
 * a Claude Code set-up made before it changed.
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import * as vscode from 'vscode';
import type { PychivalryApi } from '../extension.js';
import { EXTENSION_ID, GAME_PATH_SETTING, SET_UP_CLAUDE_CODE, SETTINGS_SECTION } from '../ids.js';
import { SERVER_FILE, SPEC_FOLDER, stableRuntime, type ServerLaunch } from '../launch.js';
import { PROJECT_FILE, serverEntry } from '../setup.js';
import { checkThrough } from './agent.js';
import { asEntry, assertFixtureAnswer, claudeEntryFor, isInside, samePath } from './fixture.js';
import { given, Skip, waitFor, type EditorCase } from './harness.js';

/** The extension, once VS Code has activated it on its own. */
export async function activeExtension(): Promise<vscode.Extension<PychivalryApi>> {
    let ext: vscode.Extension<PychivalryApi> | undefined;
    await waitFor('the extension to activate', () => {
        ext = vscode.extensions.getExtension<PychivalryApi>(EXTENSION_ID);
        return ext?.isActive === true;
    });
    assert.ok(ext !== undefined);
    return ext;
}

/** The case every suite starts with: VS Code is on the virtual display (Linux). */
export function displayCase(): EditorCase {
    return {
        name: 'VS Code runs on the virtual display, never on a desktop',
        run: () => {
            if (process.platform !== 'linux') {
                throw new Skip(`${process.platform} has no virtual display to check`);
            }
            assert.equal(process.env['WAYLAND_DISPLAY'], undefined);
            assert.equal(process.env['DISPLAY'], given('PYCHIVALRY_EXPECTED_DISPLAY'));
            return Promise.resolve();
        },
    };
}

/** Every `.mcp.json` below `dir`. */
function mcpFilesUnder(dir: string): string[] {
    if (!existsSync(dir)) {
        return [];
    }
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((rel) => path.basename(rel) === '.mcp.json')
        .map((rel) => path.join(dir, rel));
}

export function mainCases(): readonly EditorCase[] {
    const mod = given('PYCHIVALRY_TEST_MOD');
    const claudeConfig = given('CLAUDE_CONFIG_DIR');
    let api: PychivalryApi | undefined;
    let launch: ServerLaunch | undefined;
    const theApi = (): PychivalryApi => {
        assert.ok(api !== undefined, 'the extension did not activate');
        return api;
    };

    return [
        displayCase(),
        {
            name: 'the extension activates on its own on a folder holding a mod descriptor',
            run: async () => {
                api = (await activeExtension()).exports;
                const folders = vscode.workspace.workspaceFolders ?? [];
                assert.equal(folders.length, 1);
                assert.ok(samePath(folders[0]?.uri.fsPath ?? '', mod), folders[0]?.uri.fsPath);
                // Where the editor's own runtime is: the command line every harness is given.
                console.log(`  VS Code runs servers with ${process.execPath}`);
            },
        },
        {
            name: 'a script file opens as ck3 and a localization file as ck3-localization',
            run: async () => {
                const script = await vscode.workspace.openTextDocument(
                    path.join(mod, 'events', 'fixture_events.txt'),
                );
                assert.equal(script.languageId, 'ck3');
                const loc = await vscode.workspace.openTextDocument(
                    path.join(mod, 'localization', 'english', 'fixture_l_english.yml'),
                );
                assert.equal(loc.languageId, 'ck3-localization');
            },
        },
        {
            name: '7.3: the language server checks the mod, and VS Code shows its finding',
            run: async () => {
                const language = theApi().language;
                // The background pass leaves out the files open in the editor, which are checked
                // as they open: the case above opened both of this mod's files, so the pass may
                // have had none left to check.
                const full = await language.firstFullResult;
                assert.ok(full.done.complete && !full.done.limited, JSON.stringify(full.done));
                const events = vscode.Uri.file(path.join(mod, 'events', 'fixture_events.txt'));
                let shown: vscode.Diagnostic[] = [];
                await waitFor('the diagnostics', () => {
                    shown = vscode.languages.getDiagnostics(events);
                    return shown.some((d) => d.severity === vscode.DiagnosticSeverity.Error);
                });
                const errors = shown.filter((d) => d.severity === vscode.DiagnosticSeverity.Error);
                assert.deepEqual(
                    errors.map((d) => [
                        d.source,
                        typeof d.code === 'object' ? d.code.value : d.code,
                        d.range.start.line,
                        d.message,
                    ]),
                    [
                        [
                            'pychivalry',
                            'syntax/missing-closing-brace',
                            2,
                            'Expected } after arguments',
                        ],
                    ],
                );
                // What VS Code shows is what the server's findings request gives for the file.
                const found = await language.findings(events);
                assert.equal(found.file, 'events/fixture_events.txt');
                const severity = ['error', 'warning', 'information', 'hint'];
                assert.deepEqual(
                    found.findings.map((f) => [f.code, f.severity, f.range.start.line, f.message]),
                    shown.map((d) => [
                        typeof d.code === 'object' ? d.code.value : d.code,
                        severity[d.severity],
                        d.range.start.line,
                        d.message,
                    ]),
                );
            },
        },
        {
            name: "7.4, 7.6: the four settings are declared with the language server's defaults",
            run: () => {
                const config = vscode.workspace.getConfiguration(SETTINGS_SECTION);
                const defaults = Object.fromEntries(
                    [
                        'gamePath',
                        'background.fileLimit',
                        'localization.unusedKeys',
                        'encoding.fallback',
                    ].map((key) => [key, config.inspect(key)?.defaultValue]),
                );
                assert.deepEqual(defaults, {
                    gamePath: '',
                    'background.fileLimit': 3000,
                    'localization.unusedKeys': false,
                    'encoding.fallback': 'none',
                });
                return Promise.resolve();
            },
        },
        {
            name: '7.1 (c): the server is copied to global storage, not run from the extension folder',
            run: async () => {
                const installed = await theApi().agentServer;
                const ext = vscode.extensions.getExtension(EXTENSION_ID);
                assert.ok(ext !== undefined);
                assert.ok(existsSync(path.join(installed.dir, SERVER_FILE)));
                assert.ok(existsSync(path.join(installed.dir, SPEC_FOLDER)));
                assert.ok(
                    !isInside(installed.dir, ext.extensionPath),
                    `${installed.dir} is inside ${ext.extensionPath}`,
                );
                assert.ok(installed.dir.includes('globalStorage'), installed.dir);
                assert.ok(installed.dir.includes(EXTENSION_ID), installed.dir);
                assert.ok(!installed.dir.includes(installed.version), installed.dir);
            },
        },
        {
            name: '7.1 (a): the provider gives VS Code one local server, bound to the mod',
            run: async () => {
                const definitions = await theApi().definitions();
                assert.equal(definitions.length, 1);
                const [d] = definitions;
                assert.ok(d !== undefined);
                const installed = await theApi().agentServer;
                assert.equal(d.label, 'pychivalry');
                assert.equal(d.command, stableRuntime(process.execPath, existsSync));
                assert.deepEqual(d.args, [
                    path.join(installed.dir, SERVER_FILE),
                    '--mod',
                    mod,
                    '--spec',
                    path.join(installed.dir, SPEC_FOLDER),
                ]);
                assert.deepEqual(d.env, { ELECTRON_RUN_AS_NODE: '1' });
                assert.ok(samePath(d.cwd?.fsPath ?? '', mod), d.cwd?.fsPath);
                assert.equal(d.version, installed.version);
                launch = await theApi().launchFor(mod);
                assert.deepEqual(
                    { command: launch.command, args: launch.args, env: launch.env },
                    { command: d.command, args: d.args, env: d.env },
                );
            },
        },
        {
            name: '7.1 (a): VS Code hands the definition to its default AI harness, the Copilot harness',
            run: async () => {
                // VS Code forwards the definitions it may to the Copilot harness as a plugin it
                // writes into the user-data folder ("VS Code Standalone Customizations"), whose
                // .mcp.json holds each server. This reads VS Code's own folder layout (1.147),
                // not an API: a VS Code that changes it fails here, and the floor is re-measured.
                assert.ok(launch !== undefined);
                const plugins = path.join(given('PYCHIVALRY_TEST_USER_DATA'), 'agentPlugins');
                const expected = serverEntry(launch);
                let seen: unknown[] = [];
                const forwarded = (): boolean => {
                    seen = mcpFilesUnder(plugins).map((f) => {
                        // VS Code may be writing the file as it is read: read again next time.
                        try {
                            const data = JSON.parse(readFileSync(f, 'utf8')) as {
                                mcpServers?: Record<string, unknown>;
                            };
                            return data.mcpServers?.['pychivalry'];
                        } catch {
                            return undefined;
                        }
                    });
                    return seen.some((e) => {
                        if (typeof e !== 'object' || e === null) {
                            return false;
                        }
                        const { cwd, ...rest } = e as Record<string, unknown>;
                        return (
                            isDeepStrictEqual(rest, expected) &&
                            typeof cwd === 'string' &&
                            samePath(cwd, mod)
                        );
                    });
                };
                await waitFor('the forwarded definition', forwarded, 60_000).catch(
                    (err: unknown) => {
                        throw new Error(
                            `${String(err)}; pychivalry entries under ${plugins}: ${JSON.stringify(seen)}`,
                        );
                    },
                );
            },
        },
        {
            name: "7.1 (a): the definition's command line starts a server that answers check",
            run: async () => {
                const [d] = await theApi().definitions();
                assert.ok(d !== undefined);
                assertFixtureAnswer(
                    await checkThrough({
                        command: d.command,
                        args: d.args,
                        env: d.env,
                        ...(d.cwd === undefined ? {} : { cwd: d.cwd.fsPath }),
                    }),
                );
            },
        },
        {
            name: '7.1 (b), 7.8: "Set up for Claude Code" adds the server with Claude Code\'s command',
            run: async () => {
                const outcome = await vscode.commands.executeCommand(
                    SET_UP_CLAUDE_CODE,
                    vscode.Uri.file(mod),
                );
                assert.equal(
                    (outcome as { kind?: string } | undefined)?.kind,
                    'claude',
                    JSON.stringify(outcome),
                );
                assert.ok(launch !== undefined);
                const entry = claudeEntryFor(claudeConfig, mod);
                assert.deepEqual(entry, serverEntry(launch));
                assertFixtureAnswer(await checkThrough(asEntry(entry)));
            },
        },
        {
            name: '7.8: without the claude command it asks first, and writes .mcp.json only on yes',
            run: async () => {
                const file = path.join(mod, PROJECT_FILE);
                rmSync(file, { force: true });
                const asked: string[] = [];
                const no = await theApi().setUpClaudeCode(
                    mod,
                    {
                        confirmProjectFile: (folder) => {
                            asked.push(folder);
                            return Promise.resolve(false);
                        },
                    },
                    () => null,
                );
                assert.equal(no.kind, 'declined');
                assert.deepEqual(asked, [mod]);
                assert.ok(!existsSync(file), `${PROJECT_FILE} written without a yes`);

                writeFileSync(
                    file,
                    JSON.stringify({ mcpServers: { other: { command: 'other' } } }),
                );
                const yes = await theApi().setUpClaudeCode(
                    mod,
                    { confirmProjectFile: () => Promise.resolve(true) },
                    () => null,
                );
                assert.deepEqual(yes, { kind: 'project-file', file });
                const written = JSON.parse(readFileSync(file, 'utf8')) as {
                    mcpServers: Record<string, Record<string, unknown>>;
                };
                assert.deepEqual(written.mcpServers['other'], { command: 'other' });
                const entry = written.mcpServers['pychivalry'];
                assert.ok(entry !== undefined && launch !== undefined);
                assert.deepEqual(entry, serverEntry(launch));
                assertFixtureAnswer(await checkThrough(asEntry(entry)));
                rmSync(file, { force: true });
            },
        },
        {
            name: "7.6: the game folder setting reaches the agent server, VS Code's AI and a Claude Code set-up made before it",
            run: async () => {
                const game = given('PYCHIVALRY_TEST_GAME');
                // The set-ups above were made with no game folder set.
                assert.deepEqual(await theApi().claudeCodeOutOfDate(), []);
                await vscode.workspace
                    .getConfiguration(SETTINGS_SECTION)
                    .update(GAME_PATH_SETTING, game, vscode.ConfigurationTarget.Global);
                try {
                    const now = await theApi().launchFor(mod);
                    assert.deepEqual(now.args.slice(-2), ['--vanilla', game]);
                    const [d] = await theApi().definitions();
                    assert.deepEqual(d?.args, now.args);
                    // VS Code asked the provider again and hands its AI the new command line.
                    const plugins = path.join(given('PYCHIVALRY_TEST_USER_DATA'), 'agentPlugins');
                    await waitFor(
                        'the forwarded definition with the game folder',
                        () =>
                            mcpFilesUnder(plugins).some((f) => {
                                try {
                                    const data = JSON.parse(readFileSync(f, 'utf8')) as {
                                        mcpServers?: Record<string, { args?: unknown }>;
                                    };
                                    return isDeepStrictEqual(
                                        data.mcpServers?.['pychivalry']?.args,
                                        now.args,
                                    );
                                } catch {
                                    return false;
                                }
                            }),
                        60_000,
                    );
                    // Claude Code keeps what it was given: the set-up is out of date, and made
                    // again it gives Claude Code the new command line.
                    const stale = await theApi().claudeCodeOutOfDate();
                    assert.equal(stale.length, 1, JSON.stringify(stale));
                    assert.ok(samePath(stale[0]?.folder ?? '', mod), stale[0]?.folder);
                    const outcome = await vscode.commands.executeCommand<{ kind?: string }>(
                        SET_UP_CLAUDE_CODE,
                        vscode.Uri.file(mod),
                    );
                    assert.equal(outcome.kind, 'claude', JSON.stringify(outcome));
                    const entry = claudeEntryFor(claudeConfig, mod);
                    assert.deepEqual(entry, serverEntry(now));
                    assert.deepEqual(await theApi().claudeCodeOutOfDate(), []);
                    assertFixtureAnswer(await checkThrough(asEntry(entry)));
                } finally {
                    await vscode.workspace
                        .getConfiguration(SETTINGS_SECTION)
                        .update(GAME_PATH_SETTING, undefined, vscode.ConfigurationTarget.Global);
                }
            },
        },
    ];
}
