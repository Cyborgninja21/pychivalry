/**
 * What can be shown of the authoring skill's repair loop without a model (docs/PLAN.md item 9.8).
 * For each expert request whose first draft (`fixtures/requests/drafts/`) draws an error or a
 * warning, the steps the write-content skill documents are played by this test, not chosen by a
 * model: the built agent server, started exactly as a trial's configuration starts it, on the
 * draft over a game stub, answers `check` with `min_severity` `warning` (the skill's rule 3) with
 * exactly the errors and warnings `drafts.json` gives, each at a line of a file the draft wrote;
 * after the repair (the request's example written over the draft, the edits a round of repair
 * would make), the same `check` reports none.
 *
 * It shows that a session that falls into the trap is told so by the check the skill has it run,
 * and that the repair the request needs reaches a clean check. Whether a model makes that repair,
 * and in how many rounds, only a real run shows. No model, key, network or display.
 */

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { tempDir } from '../testing.js';
import { committedDrafts, DRAFTS_DIR, emptyGame, exampleDir, root } from './authoring-testing.js';
import { filesIn } from './graders.js';
import { baseDir, committedRequests } from './requests.js';
import { mcpConfig, scoredOptions, SERVER_NAME } from './run.js';
import { converse, OPENING, type ServerEntry } from '../agent-server-testing.js';

interface CheckOutput {
    readonly totals: { readonly by_severity: Record<string, number> };
    readonly findings: readonly {
        readonly file: string;
        readonly line: number;
        readonly code: string;
        readonly severity: string;
    }[];
}

/** One `check` of the whole mod at warning and above, from a server started afresh. */
async function checkOnce(entry: ServerEntry): Promise<CheckOutput> {
    const replies = await converse(entry, [
        ...OPENING,
        {
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: { name: 'check', arguments: { min_severity: 'warning', limit: 100 } },
        },
    ]);
    const call = replies.find((r) => r.id === 2);
    assert.equal(call?.error, undefined);
    assert.notEqual(call?.result?.['isError'], true);
    return call?.result?.['structuredContent'] as CheckOutput;
}

test(
    "a first draft's errors and warnings are what the skill's check shows, and its repair checks clean",
    { timeout: 600_000 },
    async (t) => {
        const list = committedRequests(root);
        const options = scoredOptions(root, { SCORED_SESSION_LIMIT: '1' });
        assert.ok(
            existsSync(options.server),
            `the agent server is built: ${options.server} (task build)`,
        );
        const drafts = committedDrafts().drafts.filter((d) => d.checker.length > 0);
        assert.equal(drafts.length, 8);
        for (const draft of drafts) {
            const request = list.requests.find((r) => r.id === draft.request);
            assert.ok(request !== undefined, draft.request);
            const dir = tempDir(t);
            const mod = path.join(dir, 'mod');
            cpSync(baseDir(root, request.base), mod, { recursive: true });
            const draftDir = path.join(root, DRAFTS_DIR, draft.request);
            cpSync(draftDir, mod, { recursive: true });
            const cacheDir = path.join(dir, 'cache');
            mkdirSync(cacheDir);
            // The empty game the request tests read, with the texture the decisions show.
            const gameDir = emptyGame(t);
            const config = mcpConfig(options, mod, gameDir, cacheDir) as {
                mcpServers: Record<string, ServerEntry>;
            };
            const entry = config.mcpServers[SERVER_NAME];
            assert.ok(entry !== undefined);

            // The check after writing the draft: the trap, as the session would see it.
            const before = await checkOnce(entry);
            assert.deepEqual(
                before.findings.map((f) => `${f.severity} ${f.code}`).sort(),
                [...draft.checker].sort(),
                draft.request,
            );
            const written = new Set(filesIn(draftDir));
            for (const f of before.findings) {
                assert.ok(written.has(f.file), `${draft.request}: ${f.file} is a file it wrote`);
                assert.ok(f.line >= 1, `${draft.request}: lines count from 1`);
            }

            // The repair: every file the draft wrote is one the example writes, so writing the
            // example over it replaces each; then the same check again.
            const repaired = new Set(filesIn(exampleDir(draft.request)));
            for (const file of written) {
                assert.ok(repaired.has(file), `${draft.request}: the repair writes ${file}`);
            }
            cpSync(exampleDir(draft.request), mod, { recursive: true });
            const after = await checkOnce(entry);
            assert.deepEqual(after.findings, [], draft.request);
            assert.equal(after.totals.by_severity['error'] ?? 0, 0, draft.request);
            assert.equal(after.totals.by_severity['warning'] ?? 0, 0, draft.request);
        }
    },
);
