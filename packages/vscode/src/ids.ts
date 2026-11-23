/**
 * The names the manifest and the code share, with no VS Code import so the manifest test reads
 * them too: the extension's id, its agent-server provider, its command, its two languages, its
 * settings, and the language server's own requests the extension listens to.
 */

/** The extension, as VS Code names it: `<publisher>.<name>`. */
export const EXTENSION_ID = 'cyborgninja21.pychivalry';

/** The agent-server provider, as `contributes.mcpServerDefinitionProviders` states it. */
export const PROVIDER_ID = 'pychivalry.agentServer';

/** The command "pychivalry: Set up for Claude Code". */
export const SET_UP_CLAUDE_CODE = 'pychivalry.setUpClaudeCode';

/** The language of script files and of localization files (`contributes.languages`). */
export const LANGUAGES = ['ck3', 'ck3-localization'] as const;

/** The section of the settings, the language server's own (`@pychivalry/lsp`, `settings.ts`). */
export const SETTINGS_SECTION = 'pychivalry';

/** The setting that names the game's `game` folder, inside the section. */
export const GAME_PATH_SETTING = 'gamePath';

/** The language server's request for a file's findings (`@pychivalry/lsp`, `server.ts`). */
export const FINDINGS_REQUEST = 'pychivalry/findings';

/** The language server's notice that a background pass ended (`@pychivalry/lsp`, `server.ts`). */
export const BACKGROUND_DONE = 'pychivalry/backgroundDone';
