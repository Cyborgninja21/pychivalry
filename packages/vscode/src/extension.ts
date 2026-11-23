/**
 * The extension's entry point, the file that speaks to VS Code with `language.ts` (docs/PLAN.md,
 * step 7). It holds no checking, parsing or lookup logic (docs/MVP.md, "Architecture"):
 *
 * - it starts the language server for the mod's script and localization files (`language.ts`,
 *   item 7.3), which reads the settings `pychivalry.*` itself (items 7.4 and 7.6);
 * - it copies the bundled agent server and command line into its global storage folder
 *   (`install.ts`), and puts the command line on the integrated terminal's path as `pychivalry`
 *   (`terminal.ts`, item 7.7);
 * - it registers the agent server with VS Code's own AI, one local server per workspace folder,
 *   each bound to its folder as the mod and given the game folder the setting
 *   `pychivalry.gamePath` names (`contributes.mcpServerDefinitionProviders`, `vscode.lm.
 *   registerMcpServerDefinitionProvider`, item 7.1);
 * - it offers the command "pychivalry: Set up for Claude Code" (`setup.ts`, item 7.8), remembers
 *   the command line each set-up gave Claude Code, and offers to set it up again when that
 *   command line changes (the game folder setting changed).
 *
 * The object `activate` returns is the extension's API: the same command line, the same set-up
 * and the language server's own answers, which the editor tests call.
 */

import { accessSync, constants, existsSync, realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { findClaude, runClaude, type ClaudeCommand } from './claude.js';
import { GAME_PATH_SETTING, PROVIDER_ID, SET_UP_CLAUDE_CODE, SETTINGS_SECTION } from './ids.js';
import { installServer, type InstallResult } from './install.js';
import { startLanguageServer, type LanguageServer } from './language.js';
import {
    CLI_FILE,
    folderPath,
    gameFromSetting,
    LSP_FILE,
    LSP_FOLDER,
    SERVER_NAME,
    serverLaunch,
    SPEC_FOLDER,
    stableRuntime,
    type ServerLaunch,
} from './launch.js';
import {
    outOfDate,
    PROJECT_FILE,
    readSetUps,
    recordOf,
    SET_UPS_KEY,
    setUpClaudeCode,
    withSetUp,
    type SetupOutcome,
    type SetUpRecord,
    type SetupUi,
} from './setup.js';
import { BIN_FOLDER, writeLauncher } from './terminal.js';

/** The bundled server folder, in the extension's folder: the agent server, the command line, the spec. */
const BUNDLED_SERVER = path.join('dist', 'bundle', 'server');

/** The bundled language server, in the extension's folder. */
const BUNDLED_LSP = path.join('dist', 'bundle', LSP_FOLDER, LSP_FILE);

/** The copy's folder, in the extension's global storage folder. */
const STORED_SERVER = 'agent-server';

/** What the extension offers other code, the editor tests among it. */
export interface PychivalryApi {
    /** `Date.now()` when the extension was activated. */
    readonly activatedAt: number;
    /** The server's copy in global storage, once it is in place. */
    readonly agentServer: Promise<InstallResult>;
    /** The server's command line for a mod folder, with the game folder the setting names. */
    readonly launchFor: (modDir: string) => Promise<ServerLaunch>;
    /** The definitions the provider gives VS Code now. */
    readonly definitions: () => Promise<vscode.McpStdioServerDefinition[]>;
    /** "Set up for Claude Code" for `folder`, its question answered by `ui`. */
    readonly setUpClaudeCode: (
        folder: string,
        ui: SetupUi,
        find?: () => ClaudeCommand | null,
    ) => Promise<SetupOutcome>;
    /** The set-ups whose command line is no longer the one the extension would give. */
    readonly claudeCodeOutOfDate: () => Promise<SetUpRecord[]>;
    /** The language server. */
    readonly language: LanguageServer;
    /** The launcher of the command line, once written; its folder is on the terminal's path. */
    readonly commandLine: Promise<string>;
}

function isExecutable(file: string): boolean {
    try {
        if (!statSync(file).isFile()) {
            return false;
        }
        if (process.platform !== 'win32') {
            accessSync(file, constants.X_OK);
        }
        return true;
    } catch {
        return false;
    }
}

function findClaudeHere(): ClaudeCommand | null {
    return findClaude({
        env: process.env,
        platform: process.platform,
        home: homedir(),
        isExecutable,
    });
}

/** Whether two paths name one folder: resolved on disk, and on Windows in any letter case. */
function sameFolder(a: string, b: string): boolean {
    const real = (p: string): string => {
        try {
            return realpathSync.native(p);
        } catch {
            return path.resolve(p);
        }
    };
    const [x, y] = [real(a), real(b)];
    return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** The workspace folders on disk: each is a mod the server can be bound to. */
function modFolders(): readonly vscode.WorkspaceFolder[] {
    return (vscode.workspace.workspaceFolders ?? []).filter((f) => f.uri.scheme === 'file');
}

const askInVsCode: SetupUi = {
    confirmProjectFile: async (folder) => {
        const write = `Write ${PROJECT_FILE}`;
        const answer = await vscode.window.showWarningMessage(
            `Claude Code's command, claude, was not found. Write the pychivalry server into a project configuration file, ${PROJECT_FILE}, in ${folder} instead?`,
            {
                modal: true,
                detail: `Claude Code reads ${PROJECT_FILE} from a project's folder and asks you once to approve its servers. The file names paths on this computer, so keep it out of anything you share or commit.`,
            },
            write,
        );
        return answer === write;
    },
};

function report(outcome: SetupOutcome, log: vscode.LogOutputChannel): void {
    switch (outcome.kind) {
        case 'claude':
            log.info(`Set up for Claude Code in ${outcome.folder} with ${outcome.claude}`);
            void vscode.window.showInformationMessage(
                `pychivalry is set up for Claude Code in ${outcome.folder}. Start Claude Code in that folder to use it.`,
            );
            return;
        case 'project-file':
            log.info(`Wrote ${outcome.file}`);
            void vscode.window.showInformationMessage(
                `pychivalry is written into ${outcome.file}. Claude Code asks you to approve it the first time it starts in that folder.`,
            );
            return;
        case 'declined':
            log.info(`Set up for Claude Code in ${outcome.folder}: nothing written`);
            return;
        case 'failed':
            log.error(outcome.message);
            void vscode.window.showErrorMessage(`pychivalry: ${outcome.message}`);
            return;
    }
}

/** The language server this activation started, stopped by `deactivate`. */
let running: LanguageServer | undefined;

/** Stop the language server: VS Code waits for the promise when the extension is deactivated. */
export async function deactivate(): Promise<void> {
    const server = running;
    running = undefined;
    await server?.client.dispose();
}

/** The game folder the setting names, for the agent server; null to let it search. */
function gameSetting(): string | null {
    return gameFromSetting(
        vscode.workspace.getConfiguration(SETTINGS_SECTION).get<unknown>(GAME_PATH_SETTING),
    );
}

export function activate(context: vscode.ExtensionContext): PychivalryApi {
    const activatedAt = Date.now();
    const log = vscode.window.createOutputChannel('pychivalry', { log: true });
    const changed = new vscode.EventEmitter<void>();
    context.subscriptions.push(log, changed);

    const language = startLanguageServer(
        context.asAbsolutePath(BUNDLED_LSP),
        context.asAbsolutePath(path.join(BUNDLED_SERVER, SPEC_FOLDER)),
        log,
    );
    running = language;

    const agentServer = Promise.resolve().then(() =>
        installServer(
            context.asAbsolutePath(BUNDLED_SERVER),
            path.join(context.globalStorageUri.fsPath, STORED_SERVER),
        ),
    );
    agentServer.then(
        (r) => {
            log.info(
                `Agent server ${r.version} ${r.changed ? 'copied to' : 'already in'} ${r.dir}`,
            );
        },
        (err: unknown) => {
            log.error(`The agent server could not be copied: ${String(err)}`);
        },
    );

    const runtime = stableRuntime(process.execPath, existsSync);

    // The command line, on the integrated terminal's path (item 7.7).
    const binDir = path.join(context.globalStorageUri.fsPath, BIN_FOLDER);
    context.environmentVariableCollection.description =
        "Puts pychivalry's command line on the terminal's path as `pychivalry`.";
    context.environmentVariableCollection.prepend('PATH', `${binDir}${path.delimiter}`);
    const commandLine = agentServer.then((installed) => {
        const launcher = writeLauncher(binDir, runtime, path.join(installed.dir, CLI_FILE));
        log.info(`Command line ${launcher.written ? 'written to' : 'already in'} ${launcher.file}`);
        return launcher.file;
    });
    commandLine.catch((err: unknown) => {
        log.error(`The command line could not be put on the terminal's path: ${String(err)}`);
    });

    const launchFor = async (modDir: string): Promise<ServerLaunch> =>
        serverLaunch(runtime, (await agentServer).dir, modDir, path, gameSetting());

    const definitions = async (): Promise<vscode.McpStdioServerDefinition[]> => {
        const folders = modFolders();
        const { version } = await agentServer;
        return Promise.all(
            folders.map(async (folder) => {
                const launch = await launchFor(folderPath(folder.uri.fsPath, process.platform));
                const label = folders.length === 1 ? SERVER_NAME : `${SERVER_NAME}: ${folder.name}`;
                const definition = new vscode.McpStdioServerDefinition(
                    label,
                    launch.command,
                    [...launch.args],
                    { ...launch.env },
                    version,
                );
                definition.cwd = folder.uri;
                return definition;
            }),
        );
    };

    const setUp = async (
        folder: string,
        ui: SetupUi,
        find: () => ClaudeCommand | null = findClaudeHere,
    ): Promise<SetupOutcome> => {
        const launch = await launchFor(folder);
        const outcome = await setUpClaudeCode({
            folder,
            launch,
            findClaude: find,
            runClaude: (claude, args, cwd) => runClaude(claude, args, cwd, process.env),
            ui,
        });
        const record = recordOf(outcome, folder, launch);
        if (record !== null) {
            const records = readSetUps(context.globalState.get<unknown>(SET_UPS_KEY));
            await context.globalState.update(SET_UPS_KEY, withSetUp(records, record));
        }
        return outcome;
    };

    // Claude Code keeps the command line it was given; when the extension would now give
    // another (the game folder setting changed), it offers to set the folder up again, once
    // for each command line.
    const claudeCodeOutOfDate = async (): Promise<SetUpRecord[]> => {
        const open = modFolders().map((f) => f.uri.fsPath);
        const records = readSetUps(context.globalState.get<unknown>(SET_UPS_KEY)).filter((r) =>
            open.some((o) => sameFolder(o, r.folder)),
        );
        const now = new Map<string, ServerLaunch>();
        for (const r of records) {
            now.set(r.folder, await launchFor(r.folder));
        }
        return outOfDate(records, (folder) => now.get(folder) ?? null);
    };
    const offered = new Set<string>();
    const offerUpdates = async (): Promise<void> => {
        for (const record of await claudeCodeOutOfDate()) {
            const key = JSON.stringify([record.folder, await launchFor(record.folder)]);
            if (offered.has(key)) {
                continue;
            }
            offered.add(key);
            const again = 'Set up again';
            const answer = await vscode.window.showInformationMessage(
                `Claude Code still starts pychivalry for ${record.folder} with the command line it was given when it was set up, before the game folder setting changed. Set it up again with the new one?`,
                again,
            );
            if (answer === again) {
                report(await setUp(record.folder, askInVsCode), log);
            }
        }
    };

    context.subscriptions.push(
        vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
            onDidChangeMcpServerDefinitions: changed.event,
            provideMcpServerDefinitions: definitions,
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            changed.fire();
        }),
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration(`${SETTINGS_SECTION}.${GAME_PATH_SETTING}`)) {
                // VS Code asks the provider again, and its AI gets the new command line.
                changed.fire();
                void offerUpdates();
            }
        }),
        vscode.commands.registerCommand(
            SET_UP_CLAUDE_CODE,
            async (target?: vscode.Uri): Promise<SetupOutcome | undefined> => {
                let folder = target?.scheme === 'file' ? target.fsPath : undefined;
                if (folder === undefined) {
                    const folders = modFolders();
                    const picked =
                        folders.length === 1
                            ? folders[0]
                            : await vscode.window.showWorkspaceFolderPick({
                                  placeHolder: 'The mod folder to set up for Claude Code',
                              });
                    folder = picked?.uri.fsPath;
                }
                if (folder === undefined) {
                    void vscode.window.showErrorMessage(
                        'pychivalry: open a mod folder first, then set it up for Claude Code.',
                    );
                    return undefined;
                }
                const outcome = await setUp(folderPath(folder, process.platform), askInVsCode);
                report(outcome, log);
                return outcome;
            },
        ),
    );

    void agentServer.then(offerUpdates, () => undefined);

    return {
        activatedAt,
        agentServer,
        launchFor,
        definitions,
        setUpClaudeCode: setUp,
        claudeCodeOutOfDate,
        language,
        commandLine,
    };
}
