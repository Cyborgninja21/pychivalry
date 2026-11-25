/**
 * Which record a continued authoring run may add its trials to (`continuation.ts`): the same
 * build, or an earlier commit with nothing changed since that a trial is made or graded with. No
 * model, key, network or display; one test makes a git repository of its own.
 */

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import type { ToolInfo } from '../record.js';
import { tempDir, writeTree } from '../testing.js';
import { CommandError } from '../util.js';
import { root } from './authoring-testing.js';
import {
    codeChanged,
    continuedAcross,
    mayChangeBetween,
    repositoryGit,
    RUN_FILES,
    type GitView,
} from './continuation.js';

const OLD = '1'.repeat(40);
const NEW = '2'.repeat(40);

function build(commit: string, dirty = false): ToolInfo {
    return { name: 'pychivalry', version: '0.0.0', commit, dirty };
}

/** A git that knows two commits, `OLD` before `NEW`, with `changed` between them. */
function view(changed: readonly string[], ancestor = true): GitView {
    return {
        isAncestor: (older, newer) => ancestor && older === OLD && newer === NEW,
        changed: (older, newer) => (older === OLD && newer === NEW ? [...changed] : []),
    };
}

function refused(f: () => unknown, pattern: RegExp): void {
    assert.throws(f, (e: unknown) => {
        assert.ok(e instanceof CommandError, String(e));
        assert.equal(e.exitCode, 2);
        assert.match(e.message, pattern);
        return true;
    });
}

test('what may change between a record and the run continuing it: documents, records, tests and the run itself', () => {
    for (const file of [
        'docs/decisions.md',
        'CHANGELOG.md',
        'tools/scored-run/README.md',
        'records/README.md',
        'records/record.schema.json',
        '.github/workflows/ci.yml',
        'packages/mcp/src/navigation.test.ts',
        'tools/src/scored-run/authoring.ts',
        'tools/src/scored-run/stop-rule.ts',
        'tools/src/scored-run/authoring-targets.ts',
    ]) {
        assert.equal(mayChangeBetween(file), true, file);
    }
    // What a session is given or a result is graded with, and anything not named.
    for (const file of [
        'packages/mcp/src/tools/lookup.ts',
        'packages/core/src/check/names.ts',
        'spec/pychivalry-spec.json.gz',
        'fixtures/requests/requests.json',
        'fixtures/requests/bases/granary/common/scripted_effects/granary_effects.txt',
        'tools/src/scored-run/run.ts',
        'tools/src/scored-run/judge.ts',
        'tools/src/scored-run/expectations.ts',
        'tools/src/scored-run/confinement.ts',
        'tools/src/scored-run/stream.ts',
        'tools/src/scored-run/a-new-grader.ts',
        'tools/scored-run/judge.schema.json',
        'package-lock.json',
        'tools/package.json',
    ]) {
        assert.equal(mayChangeBetween(file), false, file);
    }
});

test('every file of the run the rule names exists', () => {
    for (const file of RUN_FILES) {
        assert.ok(existsSync(path.join(root, ...file.split('/'))), file);
    }
});

test('the same build continues its record, as before', () => {
    assert.deepEqual(continuedAcross(build(NEW), build(NEW), view([])), {
        from: null,
        changed: [],
    });
    // A record of a checkout with uncommitted changes is continued only by the same checkout.
    assert.deepEqual(continuedAcross(build(NEW, true), build(NEW, true), view([])), {
        from: null,
        changed: [],
    });
});

test('a later commit continues the record when only the run itself, documents and tests changed', () => {
    const changed = [
        'docs/decisions.md',
        'tools/src/scored-run/authoring.ts',
        'tools/src/scored-run/stop-rule.ts',
        'tools/src/scored-run/stop-rule.test.ts',
    ];
    assert.deepEqual(continuedAcross(build(OLD), build(NEW), view(changed)), {
        from: OLD,
        changed,
    });
    assert.deepEqual(codeChanged(changed), [
        'tools/src/scored-run/authoring.ts',
        'tools/src/scored-run/stop-rule.ts',
    ]);
});

test('a later commit that changed what a trial is made or graded with is refused, naming the files', () => {
    refused(
        () =>
            continuedAcross(
                build(OLD),
                build(NEW),
                view([
                    'docs/x.md',
                    'packages/mcp/src/tools/lookup.ts',
                    'tools/src/scored-run/judge.ts',
                ]),
            ),
        /since then files changed that a trial is made or graded with: packages\/mcp\/src\/tools\/lookup\.ts, tools\/src\/scored-run\/judge\.ts\. Its trials and this run's cannot share one record/,
    );
    refused(
        () => continuedAcross(build(OLD), build(NEW), view([], false)),
        /is not an ancestor of this checkout's/,
    );
    refused(
        () => continuedAcross(build(NEW), build(OLD), view([])),
        /is not an ancestor of this checkout's/,
    );
    refused(
        () => continuedAcross(build(OLD), build(NEW, true), view([])),
        /neither had an uncommitted change, and this checkout has one/,
    );
    refused(
        () => continuedAcross(build(OLD, true), build(NEW), view([])),
        /the record says its checkout had one/,
    );
    refused(
        () => continuedAcross({ ...build(OLD), version: '0.3.0' }, build(NEW), view([])),
        /made by another build of pychivalry/,
    );
    refused(() => continuedAcross(null, build(NEW), view([])), /another build/);
});

test("the repository's git: which commit came first, and the files that changed", (t) => {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.invalid',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.invalid',
        GIT_CONFIG_GLOBAL: path.join(tmpdir(), 'pychivalry-no-such-gitconfig'),
        GIT_CONFIG_NOSYSTEM: '1',
    };
    const repo = tempDir(t);
    const git = (...args: string[]): string =>
        execFileSync('git', args, { cwd: repo, env, encoding: 'utf8' }).trim();
    git('init', '--quiet');
    writeTree(repo, { 'docs/a.md': 'a\n', 'tools/src/old.ts': 'x\n' });
    git('add', '.');
    git('commit', '--quiet', '-m', 'first');
    const first = git('rev-parse', 'HEAD');
    writeTree(repo, { 'docs/a.md': 'b\n', 'packages/a b.ts': 'y\n' });
    git('mv', 'tools/src/old.ts', 'tools/src/new.ts');
    git('add', '.');
    git('commit', '--quiet', '-m', 'second');
    const second = git('rev-parse', 'HEAD');
    const view = repositoryGit(repo);
    assert.equal(view.isAncestor(first, second), true);
    assert.equal(view.isAncestor(second, first), false);
    assert.equal(view.isAncestor('0'.repeat(40), second), false);
    // A file moved is both of its names; a name with a space is given as it is.
    assert.deepEqual(view.changed(first, second).sort(), [
        'docs/a.md',
        'packages/a b.ts',
        'tools/src/new.ts',
        'tools/src/old.ts',
    ]);
    assert.deepEqual(view.changed(second, second), []);
});
