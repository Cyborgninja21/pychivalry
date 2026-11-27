import { packageName as corePackageName } from '@pychivalry/core';

/**
 * pychivalry's language server: a thin shell that translates between `@pychivalry/core` and the
 * language-server protocol, with no CK3 knowledge of its own (docs/MVP.md, "Architecture").
 * The server is `server.ts`; its entry point, which the extension starts as a Node module over
 * IPC (`--node-ipc`) or a test over standard input and output (`--stdio`), is `main.ts`.
 */

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/lsp';

/** The core package this shell is built on. */
export const builtOn = corePackageName;

export { defaultSpecDir, serverArguments, specFrom, USAGE, UsageError } from './args.js';
export { CHECK_PAGE, checkPageOf, DIAGNOSTIC_SOURCE, toDiagnostic } from './diagnostics.js';
export { chooseGame, gameNotices, type GameChoice, type Notice } from './game.js';
export { Lender, SHARING_REQUEST, type SharingStatus } from './lend.js';
export {
    LOG_DIAGNOSTICS_LIMIT,
    LOG_FOLDERS_REQUEST,
    LOG_REQUEST,
    logAnswer,
    type LogAnswer,
    type LogDiagnostic,
    type LogFolderAnswer,
    type LogParams,
} from './log.js';
export { DEFAULT_SETTINGS, readSettings, SETTINGS_SECTION, type Settings } from './settings.js';
export {
    BACKGROUND_DONE,
    FINDINGS_REQUEST,
    LanguageServer,
    startServer,
    type BackgroundDone,
    type FindingsParams,
    type FindingsResult,
    type ServerOptions,
} from './server.js';
export { SERVER_NAME, VERSION } from './version.js';
