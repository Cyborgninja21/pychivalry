/**
 * The client's workspace-diagnostics store (client/workspace-health.ts): URI keys, the
 * per-file counts and run state from ck3/workspaceDiagnostics, and the first full pass.
 */

import * as assert from 'assert';
import { HealthChange, uriKey, WorkspaceHealth } from '../../client/workspace-health';

describe('WorkspaceHealth', () => {
    it('keys a Windows drive letter the way VS Code spells it', () => {
        assert.strictEqual(uriKey('file:///C:/mod/events/a.txt'), 'file:///c%3A/mod/events/a.txt');
        assert.strictEqual(
            uriKey('file:///c%3A/mod/events/a.txt'),
            'file:///c%3A/mod/events/a.txt'
        );
        assert.strictEqual(uriKey('file:///d%3a/x.txt'), 'file:///d%3A/x.txt');
        assert.strictEqual(uriKey('file:///home/me/mod/a.txt'), 'file:///home/me/mod/a.txt');
    });

    it('stores per-file counts, drops clean files and sums a summary', () => {
        const health = new WorkspaceHealth();
        const changes: HealthChange[] = [];
        health.onDidChange((c) => changes.push(c));
        health.apply({ uri: 'file:///C:/m/a.txt', errors: 2, warnings: 1, information: 0 });
        health.apply({ uri: 'file:///m/b.txt', errors: 0, warnings: 3, information: 4 });
        health.apply({ uri: 'file:///m/c.txt', errors: 0, warnings: 0, information: 5 });
        assert.deepStrictEqual(health.countsOf('file:///c%3A/m/a.txt'), {
            errors: 2,
            warnings: 1,
            information: 0,
        });
        const summary = health.summary();
        assert.deepStrictEqual(
            [summary.errors, summary.warnings, summary.information, summary.filesAffected],
            [2, 4, 9, 2]
        );
        health.apply({ uri: 'file:///m/b.txt', errors: 0, warnings: 0, information: 0 });
        assert.strictEqual(health.countsOf('file:///m/b.txt'), undefined);
        assert.deepStrictEqual(changes[changes.length - 1], {
            kind: 'files',
            keys: ['file:///m/b.txt'],
        });
        // Anything else is ignored.
        health.apply({ something: 'else' });
        health.apply(undefined);
        assert.strictEqual(changes.length, 4);
    });

    it('tracks the run state and resolves the first full pass once', async () => {
        let clock = 1000;
        const health = new WorkspaceHealth(uriKey, () => clock);
        const first = health.whenFirstFullResult();
        health.apply({ state: 'running', done: 0, total: 10, limited: false });
        assert.strictEqual(health.summary().state, 'running');
        assert.strictEqual(health.summary().total, 10);
        clock = 2000;
        health.apply({
            state: 'idle',
            done: 10,
            total: 10,
            limited: false,
            firstFullResultMs: 1234,
            maxRssKb: 99,
        });
        const event = await first;
        assert.strictEqual(event.firstFullResultMs, 1234);
        assert.strictEqual(health.summary().lastFullPassAt, 2000);
        // A cancelled pass does not count as a full pass.
        clock = 3000;
        health.apply({ state: 'idle', done: 4, total: 10, limited: false, cancelled: true });
        assert.strictEqual(health.summary().lastFullPassAt, 2000);
    });

    it('reset() forgets files and waits for the next server first pass', async () => {
        const health = new WorkspaceHealth();
        health.apply({ uri: 'file:///m/a.txt', errors: 1, warnings: 0, information: 0 });
        health.apply({ state: 'idle', done: 1, total: 1, limited: false, firstFullResultMs: 5 });
        health.reset();
        assert.deepStrictEqual(health.keys(), []);
        assert.strictEqual(health.summary().state, 'unknown');
        let resolved = false;
        const next = health.whenFirstFullResult().then((e) => {
            resolved = true;
            return e;
        });
        await Promise.resolve();
        assert.strictEqual(resolved, false);
        health.apply({ state: 'idle', done: 1, total: 1, limited: false, firstFullResultMs: 7 });
        assert.strictEqual((await next).firstFullResultMs, 7);
    });
});
