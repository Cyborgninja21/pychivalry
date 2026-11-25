/**
 * The agent server's tools and their answers, apart from the protocol library's server
 * (`server.ts`), so that a program that answers for the agent server (docs/shared-index.md)
 * runs the same tools over the same kind of session without the library: the answer to a call
 * is the same object wherever it is made.
 */

import type { Steps } from '@pychivalry/core';
import { bad, BadInput, ok, type CallToolResult } from './result.js';
import type { Session } from './session.js';
import { listed, type ListedTool } from './tool.js';
import { checkTool } from './tools/check.js';
import {
    findDefinitionTool,
    findReferencesTool,
    listDefinitionsTool,
} from './tools/definitions.js';
import { explainTool } from './tools/explain.js';
import { applyFormatTool, formatTool } from './tools/format.js';
import { lookupTool } from './tools/lookup.js';
import { sourceTool } from './tools/source.js';

/** Every tool, in the order a client lists them. */
export const TOOLS: readonly ListedTool[] = [
    listed(checkTool),
    listed(lookupTool),
    listed(findDefinitionTool),
    listed(findReferencesTool),
    listed(listDefinitionsTool),
    listed(sourceTool),
    listed(explainTool),
    listed(formatTool),
    listed(applyFormatTool),
];

/** A tool's answer as a result: bad input as a result marked as an error, never thrown. */
export function answer(
    tool: ListedTool,
    args: Record<string, unknown>,
    session: Session,
): CallToolResult {
    try {
        return ok(tool.call(args, session));
    } catch (err) {
        if (err instanceof BadInput) {
            return bad(err.message);
        }
        throw err;
    }
}

/** `answer` in steps (`Steps`): the tool's own steps, pausing after each file it reads. */
export function* answerSteps(
    tool: ListedTool,
    args: Record<string, unknown>,
    session: Session,
): Steps<CallToolResult> {
    try {
        return ok(yield* tool.callSteps(args, session));
    } catch (err) {
        if (err instanceof BadInput) {
            return bad(err.message);
        }
        throw err;
    }
}
