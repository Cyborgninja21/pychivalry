/**
 * What a trial's output stream says: Claude Code's command-line mode with `--output-format
 * stream-json --verbose` writes one JSON object per line (docs/PLAN.md item 6.8). The scored run
 * reads from it the session's start (`system`, subtype `init`: the harness version, the model,
 * the tools offered and the agent servers with their status), every tool call (`tool_use` blocks
 * of `assistant` messages), every tool error (`tool_result` blocks of `user` messages with
 * `is_error`), and the end (`result`: its subtype, such as `success` or
 * `error_max_budget_usd`, the cost, the turns, the time, the permission denials).
 *
 * Nothing else is kept: not the text, not the tools' inputs or results (they hold the trial
 * folder's absolute paths), not the session id nor anything about the login. A line that is not
 * a JSON object is counted, not read.
 */

import { isObject } from '../util.js';

/** The session's start, as far as the scored run reads it. */
export interface StreamInit {
    readonly version: string | null;
    readonly model: string | null;
    readonly permissionMode: string | null;
    readonly tools: readonly string[];
    readonly mcpServers: readonly { readonly name: string; readonly status: string }[];
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
    readonly costUsd: number | null;
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
    return {
        version: text(event['claude_code_version']),
        model: text(event['model']),
        permissionMode: text(event['permissionMode']),
        tools,
        mcpServers: servers,
    };
}

function resultOf(event: Record<string, unknown>): StreamResult {
    const denials = Array.isArray(event['permission_denials'])
        ? event['permission_denials'].filter(isObject).map((d) => text(d['tool_name']) ?? 'unknown')
        : [];
    return {
        subtype: text(event['subtype']) ?? 'unknown',
        isError: event['is_error'] === true,
        costUsd: count(event['total_cost_usd']),
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
