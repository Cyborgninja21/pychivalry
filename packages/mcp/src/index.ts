import { packageName as corePackageName } from '@pychivalry/core';

/**
 * pychivalry's agent server (MCP): a thin shell that translates between `@pychivalry/core` and
 * the Model Context Protocol, with no CK3 knowledge of its own (docs/MVP.md, "Architecture").
 * Its tools are in `tools/`, the server that registers them in `server.ts`, and its entry
 * point, which serves them over standard input and output, in `main.ts` (docs/PLAN.md step 6).
 */

/** This package's name, as in its package.json. */
export const packageName = '@pychivalry/mcp';

/** The core package this shell is built on. */
export const builtOn = corePackageName;

export { defaultSpecDir, sessionOptions, USAGE, UsageError, type Surroundings } from './args.js';
export { createServer, instructions, TOOLS } from './server.js';
export { Session, type GameChoice, type ModPath, type SessionOptions } from './session.js';
export { RESULT_BUDGET } from './result.js';
export { SCHEMA_VERSION, SERVER_NAME, VERSION } from './version.js';
export type { ListedTool, Tool } from './tool.js';
