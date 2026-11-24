/**
 * Whether a test session was what a scored run asked for: it ended as a session may, and its
 * start event shows it offered only what the run allows. Every scored session checks its own
 * confinement this way (tools/scored-run/README.md, "The harness held"): the agent-use trials
 * (`run.ts`), the authoring trials (`authoring.ts`) and the judge's sessions (`judge.ts`), each
 * with its own `Confinement`. A session whose check finds a problem says nothing about
 * pychivalry.
 */

import path from 'node:path';
import type { StreamSummary } from './stream.js';

/** What ended a session, as a record states it (`stoppedBy` in run.ts). */
export type Stopped = 'finished' | 'session-limit' | 'turns' | 'error' | 'timeout' | 'no-result';

/** What a session may be offered. */
export interface Confinement {
    /** The built-in tools it may be offered. */
    readonly builtIn: readonly string[];
    /**
     * The one agent server it is given, by name, with the tools that server offers once it is
     * connected; null when it is given none.
     */
    readonly server: { readonly name: string; readonly tools: readonly string[] } | null;
    /**
     * The skills that must be offered, by name, and whether others may be offered beside them
     * (Claude Code's own, which it offers whenever any skill is: `authoring.ts`).
     */
    readonly skills: { readonly required: readonly string[]; readonly othersAllowed: boolean };
}

/** How a session that ended on an error ended: its subtype, why its loop ended, the status. */
export function errorEnd(summary: StreamSummary): string {
    const result = summary.result;
    if (result === null) {
        return 'an error';
    }
    return [
        result.subtype,
        result.terminalReason,
        result.apiErrorStatus === null ? null : `status ${String(result.apiErrorStatus)}`,
    ]
        .filter((part) => part !== null)
        .join(', ');
}

/** The problems of a session: what makes it say nothing about pychivalry. */
export function sessionProblems(
    summary: StreamSummary,
    stopped: Stopped,
    exitCode: number | null,
    timeoutMinutes: number,
    confinement: Confinement,
): string[] {
    const problems: string[] = [];
    if (stopped === 'timeout') {
        problems.push(
            `the session was stopped after the time limit of ${String(timeoutMinutes)} minutes`,
        );
    } else if (stopped === 'no-result') {
        problems.push(`the stream has no result; Claude Code exited with ${String(exitCode)}`);
    } else if (stopped === 'error') {
        problems.push(`the session ended on an error (${errorEnd(summary)})`);
    }
    const init = summary.init;
    if (init === null) {
        problems.push('the stream has no init event: the confinement was not seen');
        return problems;
    }
    const server = confinement.server;
    const outside = init.tools.filter(
        (t) =>
            !confinement.builtIn.includes(t) &&
            (server === null || !t.startsWith(`mcp__${server.name}__`)),
    );
    if (outside.length > 0) {
        problems.push(`tools outside the confinement were offered: ${outside.join(', ')}`);
    }
    const required = confinement.skills.required;
    const missing = required.filter((s) => !init.skills.includes(s));
    if (missing.length > 0) {
        problems.push(`the pychivalry skills were not offered: ${missing.join(', ')}`);
    }
    if (!confinement.skills.othersAllowed) {
        const others = init.skills.filter((s) => !required.includes(s));
        if (others.length > 0) {
            problems.push(`skills were offered: ${others.join(', ')}`);
        }
    }
    // Claude Code's own plugins come with the program, as its built-in agents do; any other
    // plugin is the person's set-up.
    const plugins = init.plugins.filter((p) => !p.builtIn).map((p) => p.name);
    if (plugins.length > 0) {
        problems.push(`plugins were loaded: ${plugins.join(', ')}`);
    }
    if (server === null) {
        const servers = init.mcpServers.map((s) => s.name);
        if (servers.length > 0) {
            problems.push(`agent servers were offered: ${servers.join(', ')}`);
        }
        return problems;
    }
    const others = init.mcpServers.filter((s) => s.name !== server.name).map((s) => s.name);
    if (others.length > 0) {
        problems.push(`other agent servers were offered: ${others.join(', ')}`);
    }
    const ours = init.mcpServers.find((s) => s.name === server.name);
    if (ours === undefined) {
        problems.push('the agent server is not in the session');
    } else if (ours.status === 'failed') {
        problems.push('the agent server failed to start');
    } else if (ours.status === 'connected') {
        // A server still starting when the session began (Claude Code before 2.1.221) has
        // offered no tools yet; one that is connected offers all of them.
        const absent = server.tools.filter(
            (t) => !init.tools.includes(`mcp__${server.name}__${t}`),
        );
        if (absent.length > 0) {
            problems.push(`the agent server's tools were not offered: ${absent.join(', ')}`);
        }
    }
    return problems;
}

/**
 * The calls of a session's built-in tools that name a file outside every one of `folders`
 * (relative names are read from the first, the session's working folder): a session confined to
 * its mod reads and writes only there, and in the folder of the skills it was given. The files
 * themselves are for the person running the test, never recorded.
 */
export function callsOutside(
    summary: StreamSummary,
    folders: readonly string[],
    builtIn: readonly string[],
): { readonly tool: string; readonly file: string }[] {
    const roots = folders.map((f) => path.resolve(f));
    const inside = (full: string): boolean =>
        roots.some((root) => {
            const rel = path.relative(root, full);
            return !(rel === '..' || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel));
        });
    const out: { tool: string; file: string }[] = [];
    for (const call of summary.toolCalls) {
        if (!builtIn.includes(call.name)) {
            continue;
        }
        for (const file of call.paths) {
            if (!inside(path.resolve(roots[0] ?? '.', file))) {
                out.push({ tool: call.name, file });
            }
        }
    }
    return out;
}
