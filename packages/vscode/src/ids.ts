/**
 * The names the manifest and the code share, with no VS Code import so the manifest test reads
 * them too: the extension's id, its agent-server provider and its command.
 */

/** The extension, as VS Code names it: `<publisher>.<name>`. */
export const EXTENSION_ID = 'cyborgninja21.pychivalry';

/** The agent-server provider, as `contributes.mcpServerDefinitionProviders` states it. */
export const PROVIDER_ID = 'pychivalry.agentServer';

/** The command "pychivalry: Set up for Claude Code". */
export const SET_UP_CLAUDE_CODE = 'pychivalry.setUpClaudeCode';
