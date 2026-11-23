/**
 * The agent server (docs/PLAN.md item 6.1): an MCP server on the TypeScript library's 2.x line,
 * with the six tools of item 6.2 registered, each declared read-only with the shapes of what it
 * takes and returns. It names itself and its version, and its written instructions say what it
 * is for, which tool to start with, and the schema version of the tools' shapes.
 *
 * The three tools the plan fills in later are not registered until they do something:
 * `format` (step 8), `call_graph` (step 10) and `analyze_log` (step 11). Each is added then as
 * one more `Tool` in `TOOLS`, with its own shapes and tests; the schema version moves with it.
 */

import { fromJsonSchema, McpServer, type CallToolResult } from '@modelcontextprotocol/server';
import { bad, BadInput, ok } from './result.js';
import { argumentValidator, jsonSchema } from './schema.js';
import type { Session } from './session.js';
import { listed, type ListedTool } from './tool.js';
import { checkTool } from './tools/check.js';
import {
    findDefinitionTool,
    findReferencesTool,
    listDefinitionsTool,
} from './tools/definitions.js';
import { explainTool } from './tools/explain.js';
import { lookupTool } from './tools/lookup.js';
import { SCHEMA_VERSION, SERVER_NAME, VERSION } from './version.js';

/** Every tool, in the order a client lists them. */
export const TOOLS: readonly ListedTool[] = [
    listed(checkTool),
    listed(lookupTool),
    listed(findDefinitionTool),
    listed(findReferencesTool),
    listed(listDefinitionsTool),
    listed(explainTool),
];

/** The server's written instructions: what it is for and how to start. */
export function instructions(session: Session): string {
    const game =
        session.game.dir === null
            ? 'It runs without the base game, so names the game defines are not judged.'
            : 'It reads the installed base game as well, through an index cached on disk.';
    return [
        `pychivalry checks a Crusader Kings 3 mod the way the game itself reads it, and answers questions about CK3 script. This server works on one mod, the folder ${session.modDir}, for game ${session.spec.version}. ${game}`,
        "Start with check: it returns the totals by severity and by code, then the errors (ask for warnings and advice with min_severity), a page at a time. An error or a warning rests on the game's own evidence; information and hints are advice.",
        'explain_code says what a code means and its evidence; lookup says what a name is, where it is valid and where it is defined; find_definition, find_references and list_definitions find definitions and uses in the mod and the base game.',
        `The tool names here are the bare ones. A client may list them under a prefix of its own: Claude Code, for one, lists check as mcp__${SERVER_NAME}__check. Call each tool by the name your client lists.`,
        "The server only reads. Fix a finding by editing the mod's files yourself, then check again: every call reads the files as they are now. Lines and columns count from 1. Every result is kept small: follow next_cursor for more.",
        `Server version ${VERSION}, tool schema version ${String(SCHEMA_VERSION)}.`,
    ].join('\n\n');
}

/** A tool's answer as a result: bad input as a result marked as an error, never thrown. */
function answer(tool: ListedTool, args: Record<string, unknown>, session: Session): CallToolResult {
    try {
        return ok(tool.call(args, session));
    } catch (err) {
        if (err instanceof BadInput) {
            return bad(err.message);
        }
        throw err;
    }
}

/** The server, its tools registered over the session. */
export function createServer(session: Session): McpServer {
    const server = new McpServer(
        {
            name: SERVER_NAME,
            title: 'pychivalry',
            version: VERSION,
            description: `Crusader Kings 3 mod checks and lookup; tool schema version ${String(SCHEMA_VERSION)}`,
        },
        { instructions: instructions(session) },
    );
    for (const tool of TOOLS) {
        server.registerTool(
            tool.name,
            {
                title: tool.title,
                description: tool.description,
                inputSchema: fromJsonSchema<Record<string, unknown>>(
                    jsonSchema(tool.input),
                    argumentValidator,
                ),
                outputSchema: fromJsonSchema<Record<string, unknown>>(jsonSchema(tool.output)),
                annotations: {
                    title: tool.title,
                    readOnlyHint: true,
                    destructiveHint: false,
                    idempotentHint: true,
                    openWorldHint: false,
                },
                _meta: { 'pychivalry/schema-version': SCHEMA_VERSION },
            },
            (args) => answer(tool, args, session),
        );
    }
    return server;
}
