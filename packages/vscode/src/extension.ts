/**
 * The extension's entry point, the only file that speaks to VS Code (docs/PLAN.md, items 7.1
 * and 7.8). It holds no checking, parsing or lookup logic (docs/MVP.md, "Architecture"):
 *
 * - it copies the bundled agent server into its global storage folder (`install.ts`);
 * - it registers that server with VS Code's own AI, one local server per workspace folder, each
 *   bound to its folder as the mod (`contributes.mcpServerDefinitionProviders`, `vscode.lm.
 *   registerMcpServerDefinitionProvider`);
 * - it offers the command "pychivalry: Set up for Claude Code" (`setup.ts`).
 *
 * The object `activate` returns is the extension's API: the same command line and the same
 * set-up, which the editor tests call.
 */

import { accessSync, constants, existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';
import { findClaude, runClaude, type ClaudeCommand } from './claude.js';
import { PROVIDER_ID, SET_UP_CLAUDE_CODE } from './ids.js';
import { installServer, type InstallResult } from './install.js';
import { SERVER_NAME, serverLaunch, stableRuntime, type ServerLaunch } from './launch.js';
import { PROJECT_FILE, setUpClaudeCode, type SetupOutcome, type SetupUi } from './setup.js';

/** The bundled server folder, in the extension's folder. */
const BUNDLED_SERVER = path.join('dist', 'bundle', 'server');

/** The copy's folder, in the extension's global storage folder. */
const STORED_SERVER = 'agent-server';

/** What the extension offers other code, the editor tests among it. */
export interface PychivalryApi {
    /** The server's copy in global storage, once it is in place. */
    readonly agentServer: Promise<InstallResult>;
    /** The server's command line for a mod folder. */
    readonly launchFor: (modDir: string) => Promise<ServerLaunch>;
    /** The definitions the provider gives VS Code now. */
    readonly definitions: () => Promise<vscode.McpStdioServerDefinition[]>;
    /** "Set up for Claude Code" for `folder`, its question answered by `ui`. */
    readonly setUpClaudeCode: (
        folder: string,
        ui: SetupUi,
        find?: () => ClaudeCommand | null,
    ) => Promise<SetupOutcome>;
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

export function activate(context: vscode.ExtensionContext): PychivalryApi {
    const log = vscode.window.createOutputChannel('pychivalry', { log: true });
    const changed = new vscode.EventEmitter<void>();
    context.subscriptions.push(log, changed);

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
    const launchFor = async (modDir: string): Promise<ServerLaunch> =>
        serverLaunch(runtime, (await agentServer).dir, modDir);

    const definitions = async (): Promise<vscode.McpStdioServerDefinition[]> => {
        const folders = modFolders();
        const { version } = await agentServer;
        return Promise.all(
            folders.map(async (folder) => {
                const launch = await launchFor(folder.uri.fsPath);
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
    ): Promise<SetupOutcome> =>
        setUpClaudeCode({
            folder,
            launch: await launchFor(folder),
            findClaude: find,
            runClaude: (claude, args, cwd) => runClaude(claude, args, cwd, process.env),
            ui,
        });

    context.subscriptions.push(
        vscode.lm.registerMcpServerDefinitionProvider(PROVIDER_ID, {
            onDidChangeMcpServerDefinitions: changed.event,
            provideMcpServerDefinitions: definitions,
        }),
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            changed.fire();
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
                const outcome = await setUp(folder, askInVsCode);
                report(outcome, log);
                return outcome;
            },
        ),
    );

    return { agentServer, launchFor, definitions, setUpClaudeCode: setUp };
}
