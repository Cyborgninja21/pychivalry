/**
 * Test helpers: diagnose in-memory text at a virtual mod-relative path.
 */

import * as path from 'path';

import { diagnose, Diagnostic } from '../../src/diagnostics';
import { Workspace } from '../../src/index/workspace';
import { packageRoot } from '../../src/spec/spec';

export const VIRTUAL_ROOT = path.resolve('/virtual-ck3-mod');

/** Repository root (two levels above packages/engine). */
export function repoRoot(): string {
    return path.resolve(packageRoot(), '..', '..');
}

export function newWorkspace(): Workspace {
    return new Workspace(VIRTUAL_ROOT);
}

/** Diagnose `text` as if it were `rel` inside a mod; other files can be indexed first. */
export function check(
    text: string,
    rel = 'events/test.txt',
    others: Record<string, string> = {}
): Diagnostic[] {
    const ws = newWorkspace();
    for (const [file, content] of Object.entries(others)) {
        ws.indexFile(path.join(VIRTUAL_ROOT, file), content);
    }
    return diagnose(ws, path.join(VIRTUAL_ROOT, rel), { text });
}

export function codes(diagnostics: Diagnostic[]): string[] {
    return diagnostics.map((d) => d.code);
}

/** Wrap trigger/effect lines in a minimal event. */
export function event(trigger: string[], immediate: string[] = []): string {
    return [
        'namespace = t',
        't.1 = {',
        '\ttype = character_event',
        '\ttitle = t.1.t',
        '\tdesc = t.1.d',
        '\ttrigger = {',
        ...trigger.map((l) => `\t\t${l}`),
        '\t}',
        '\timmediate = {',
        ...immediate.map((l) => `\t\t${l}`),
        '\t}',
        '\toption = {',
        '\t\tname = t.1.a',
        '\t}',
        '}',
    ].join('\n');
}
