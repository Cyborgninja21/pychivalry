/**
 * What a program that answers for agent servers needs (docs/shared-index.md), apart from the
 * protocol library's server, so that it does not carry the library: the sessions it keeps and
 * the agent server's version.
 */

export { McpHost, SESSION_IDLE_MS, type McpLender, type McpRequest } from './share.js';
export { VERSION } from './version.js';
