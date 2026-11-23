/**
 * What a trial's output stream says: Claude Code's command-line mode with `--output-format
 * stream-json --verbose` writes one JSON object per line (docs/PLAN.md item 6.8). The scored run
 * reads from it the session's start (`system`, subtype `init`: the harness version, the model,
 * the tools offered, the agent servers with their status, the skills and the plugins), every
 * tool call (`tool_use` blocks of `assistant` messages), every tool error (`tool_result` blocks
 * of `user` messages with `is_error`), and the end (`result`: its subtype, such as `success`,
 * whether it is an error, why the session's loop ended (`terminal_reason`), the turns, the time,
 * the permission denials).
 *
 * A session can end on an error with the subtype `success`: Claude Code 2.1.220 refused the
 * pinned model before any request (an `assistant` message of the model `<synthetic>`) and ended
 * with `subtype: "success"`, `is_error: true`, `terminal_reason: "api_error"` and
 * `api_error_status: 400`, seen in item 6.11's first test session. The end is read with all of
 * them, never the subtype alone.
 *
 * Nothing else is kept: not the text, not the tools' inputs or results (they hold the trial
 * folder's absolute paths), not the session id, nor any figure Claude Code reports about the
 * session's use of the developer's Claude plan, nor how Claude Code is signed in. A line that is
 * not a JSON object is counted, not read.
 */

import { isObject } from '../util.js';

/** The session's start, as far as the scored run reads it. */
export interface StreamInit {
    readonly version: string | null;
    readonly model: string | null;
    readonly permissionMode: string | null;
    readonly tools: readonly string[];
    readonly mcpServers: readonly { readonly name: string; readonly status: string }[];
    /** The skills the session could use, by name; empty when the stream lists none. */
    readonly skills: readonly string[];
    /**
     * The plugins loaded: each by its source (`<name>@<marketplace>`) or, without one, its name,
     * and whether it is built into Claude Code (source `<name>@builtin`, or path `builtin`), as
     * Claude Code 2.1.330 lists two of its own in every session. A plugin's path is not read.
     */
    readonly plugins: readonly { readonly name: string; readonly builtIn: boolean }[];
}

export interface StreamToolCall {
    readonly id: string;
    readonly name: string;
}

export interface StreamToolError {
    /** The tool called, or `unknown` when no call in the stream has the result's id. */
    readonly name: string;
    /** The error's text, as the tool gave it. */
    readonly message: string;
}

/** The session's end. */
export interface StreamResult {
    readonly subtype: string;
    readonly isError: boolean;
    /** Why the session's loop ended, as Claude Code names it (`completed`, `api_error`, ...). */
    readonly terminalReason: string | null;
    /** The status of the request that failed, when an error ended the session. */
    readonly apiErrorStatus: number | null;
    /**
     * The session's last words when it ended on an error, for the run's own output only: a
     * record never holds them.
     */
    readonly errorText: string | null;
    readonly turns: number | null;
    readonly durationMs: number | null;
    /** The tool names of the calls the permission mode denied. */
    readonly permissionDenials: readonly string[];
}

export interface StreamSummary {
    readonly init: StreamInit | null;
    readonly toolCalls: readonly StreamToolCall[];
    readonly toolErrors: readonly StreamToolError[];
    readonly result: StreamResult | null;
    /** Lines that were not a JSON object. */
    readonly unreadLines: number;
}

function text(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
}

function count(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function blocksOf(event: Record<string, unknown>): Record<string, unknown>[] {
    const message = event['message'];
    const content = isObject(message) ? message['content'] : undefined;
    return Array.isArray(content) ? content.filter(isObject) : [];
}

/** The text of a tool result's content: a string, or the text blocks of a list. */
function resultText(content: unknown): string {
    if (typeof content === 'string') {
        return content;
    }
    if (Array.isArray(content)) {
        return content
            .filter(isObject)
            .map((b) => text(b['text']) ?? '')
            .filter((t) => t !== '')
            .join('\n');
    }
    return '';
}

function initOf(event: Record<string, unknown>): StreamInit {
    const tools = Array.isArray(event['tools'])
        ? event['tools'].filter((t): t is string => typeof t === 'string')
        : [];
    const servers = Array.isArray(event['mcp_servers'])
        ? event['mcp_servers'].filter(isObject).map((s) => ({
              name: text(s['name']) ?? '',
              status: text(s['status']) ?? '',
          }))
        : [];
    const names = (value: unknown): string[] =>
        Array.isArray(value)
            ? value
                  .map((v) => (typeof v === 'string' ? v : isObject(v) ? text(v['name']) : null))
                  .filter((v): v is string => v !== null)
            : [];
    const plugins = Array.isArray(event['plugins'])
        ? event['plugins']
              .map((p) => {
                  if (typeof p === 'string') {
                      return { name: p, builtIn: false };
                  }
                  if (!isObject(p)) {
                      return null;
                  }
                  const source = text(p['source']);
                  const name = source ?? text(p['name']);
                  return name === null
                      ? null
                      : {
                            name,
                            builtIn:
                                (source?.endsWith('@builtin') ?? false) || p['path'] === 'builtin',
                        };
              })
              .filter((p): p is { name: string; builtIn: boolean } => p !== null)
        : [];
    return {
        version: text(event['claude_code_version']),
        model: text(event['model']),
        permissionMode: text(event['permissionMode']),
        tools,
        mcpServers: servers,
        skills: names(event['skills']),
        plugins,
    };
}

function resultOf(event: Record<string, unknown>): StreamResult {
    const denials = Array.isArray(event['permission_denials'])
        ? event['permission_denials'].filter(isObject).map((d) => text(d['tool_name']) ?? 'unknown')
        : [];
    const isError = event['is_error'] === true;
    return {
        subtype: text(event['subtype']) ?? 'unknown',
        isError,
        terminalReason: text(event['terminal_reason']),
        apiErrorStatus: count(event['api_error_status']),
        errorText: isError ? text(event['result']) : null,
        turns: count(event['num_turns']),
        durationMs: count(event['duration_ms']),
        permissionDenials: denials,
    };
}

/** Read a stream's text, one JSON object per line. */
export function readStream(stream: string): StreamSummary {
    let init: StreamInit | null = null;
    let result: StreamResult | null = null;
    let unreadLines = 0;
    const toolCalls: StreamToolCall[] = [];
    const toolErrors: StreamToolError[] = [];
    const names = new Map<string, string>();
    for (const line of stream.split(/\r?\n/)) {
        if (line.trim() === '') {
            continue;
        }
        let event: unknown;
        try {
            event = JSON.parse(line) as unknown;
        } catch {
            unreadLines++;
            continue;
        }
        if (!isObject(event)) {
            unreadLines++;
            continue;
        }
        const type = event['type'];
        if (type === 'system' && event['subtype'] === 'init') {
            init = initOf(event);
        } else if (type === 'assistant') {
            for (const block of blocksOf(event)) {
                if (block['type'] === 'tool_use') {
                    const id = text(block['id']) ?? '';
                    const name = text(block['name']) ?? 'unknown';
                    names.set(id, name);
                    toolCalls.push({ id, name });
                }
            }
        } else if (type === 'user') {
            for (const block of blocksOf(event)) {
                if (block['type'] === 'tool_result' && block['is_error'] === true) {
                    toolErrors.push({
                        name: names.get(text(block['tool_use_id']) ?? '') ?? 'unknown',
                        message: resultText(block['content']),
                    });
                }
            }
        } else if (type === 'result') {
            result = resultOf(event);
        }
    }
    return { init, toolCalls, toolErrors, result, unreadLines };
}
