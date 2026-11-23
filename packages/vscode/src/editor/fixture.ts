/**
 * What the editor tests and their runner both check, with no VS Code import: the answer the
 * test mod gives, and the server entry Claude Code holds for a folder. Test code only.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import type { CheckAnswer, Entry } from './agent.js';

/** The fixture mod the editor tests open: one error, whatever game the server finds. */
export const FIXTURE_MOD = 'parse-missing-closing-brace';

/** The fixture's answer: its one parse error, the same whichever entry started the server. */
export function assertFixtureAnswer(answer: CheckAnswer): void {
    assert.ok(answer.tools.includes('check'), `tools: ${answer.tools.join(', ')}`);
    assert.match(answer.server, /^pychivalry /);
    const findings = answer.output['findings'] as { code: string; file: string }[] | undefined;
    assert.ok(Array.isArray(findings), JSON.stringify(answer.output));
    assert.deepEqual(
        findings.map((f) => [f.code, f.file]),
        [['syntax/missing-closing-brace', 'events/fixture_events.txt']],
        JSON.stringify(answer.output),
    );
}

/** Whether two paths name the same file: on Windows without regard to letter case. */
export function samePath(a: string, b: string): boolean {
    const [x, y] = [path.resolve(a), path.resolve(b)];
    return process.platform === 'win32' ? x.toLowerCase() === y.toLowerCase() : x === y;
}

/** Whether `inner` is `outer` or inside it. */
export function isInside(inner: string, outer: string): boolean {
    const rel = path.relative(outer, inner);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** The server entry Claude Code holds for `folder` in its configuration folder `config`. */
export function claudeEntryFor(config: string, folder: string): Record<string, unknown> {
    const data = JSON.parse(readFileSync(path.join(config, '.claude.json'), 'utf8')) as {
        projects?: Record<string, { mcpServers?: Record<string, Record<string, unknown>> }>;
    };
    const want = realpathSync(folder);
    const key = Object.keys(data.projects ?? {}).find(
        (k) => existsSync(k) && realpathSync(k) === want,
    );
    assert.ok(key !== undefined, `no project for ${folder} in ${JSON.stringify(data.projects)}`);
    const entry = data.projects?.[key]?.mcpServers?.['pychivalry'];
    assert.ok(entry !== undefined, `no pychivalry server for ${key}`);
    return entry;
}

/** A configuration entry as the agent client starts it. */
export function asEntry(entry: Record<string, unknown>): Entry {
    assert.equal(typeof entry['command'], 'string');
    assert.ok(Array.isArray(entry['args']));
    return {
        command: entry['command'] as string,
        args: entry['args'] as string[],
        env: (entry['env'] ?? {}) as Record<string, string>,
    };
}
