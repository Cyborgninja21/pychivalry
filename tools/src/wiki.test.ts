import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test, type TestContext } from 'node:test';
import { tempDir, writeTree } from './testing.js';
import { repoRoot } from './util.js';
import {
    buildWiki,
    publishWiki,
    readWikiManifest,
    rewriteLinks,
    WIKI_OWNED_FILE,
    type WikiManifest,
} from './wiki.js';

const MANIFEST: WikiManifest = {
    repository: 'owner/name',
    branch: 'main',
    pages: [
        { page: 'Home', source: 'docs/wiki/Home.md' },
        { page: 'Install', source: 'docs/guide/install.md' },
    ],
    sidebar: [{ heading: 'Start', pages: ['Home', 'Install'] }],
};

/** A small repository with a manifest and two documents. */
function fixtureRepo(t: TestContext, manifest: unknown = MANIFEST): string {
    const root = tempDir(t);
    writeTree(root, {
        'docs/wiki/manifest.json': JSON.stringify(manifest),
        'docs/wiki/Home.md': '# Welcome\n\nSee [install](../guide/install.md#steps).\n',
        'docs/guide/install.md':
            '# Installing\n\nBack [home](../wiki/Home.md). [Plan](../PLAN.md).\n',
        'docs/PLAN.md': '# Plan\n',
    });
    return root;
}

function kinds(
    paths: Record<string, 'file' | 'dir'>,
): (repoPath: string) => 'file' | 'dir' | undefined {
    return (repoPath) => paths[repoPath];
}

test('the committed wiki manifest builds without problems', (t) => {
    const out = path.join(tempDir(t), 'wiki');
    const { files, problems } = buildWiki(repoRoot(), out);
    assert.deepEqual(problems, []);
    assert.ok(files.includes('Home.md'));
    assert.ok(files.includes('_Sidebar.md'));
});

test('links are rewritten to wiki pages and to files on GitHub', () => {
    const markdown = [
        '[page](../guide/install.md#steps) [file](../PLAN.md) [folder](../../fixtures/)',
        '[web](https://example.org/a.md) [here](#top) ![shot](shot.png "A title")',
        '`[code](../PLAN.md)`',
        '```',
        '[fenced](../PLAN.md)',
        '```',
    ].join('\n');
    const { text, problems } = rewriteLinks(
        markdown,
        'docs/wiki/Home.md',
        MANIFEST,
        kinds({ 'docs/PLAN.md': 'file', fixtures: 'dir', 'docs/wiki/shot.png': 'file' }),
    );
    assert.deepEqual(problems, []);
    assert.deepEqual(text.split('\n'), [
        '[page](Install#steps) [file](https://github.com/owner/name/blob/main/docs/PLAN.md) [folder](https://github.com/owner/name/tree/main/fixtures)',
        '[web](https://example.org/a.md) [here](#top) ![shot](https://github.com/owner/name/raw/main/docs/wiki/shot.png "A title")',
        '`[code](../PLAN.md)`',
        '```',
        '[fenced](../PLAN.md)',
        '```',
    ]);
});

test('a link to nothing and a link out of the repository are problems', () => {
    const { problems } = rewriteLinks(
        '[gone](gone.md) [out](../../../elsewhere.md)',
        'docs/wiki/Home.md',
        MANIFEST,
        kinds({}),
    );
    assert.equal(problems.length, 2);
    assert.match(problems[0] ?? '', /points at nothing/);
    assert.match(problems[1] ?? '', /outside the repository/);
});

test('a manifest with a repeated page, a missing source or an unlisted page is refused', (t) => {
    const root = fixtureRepo(t, {
        ...MANIFEST,
        pages: [
            ...MANIFEST.pages,
            { page: 'Home', source: 'docs/PLAN.md' },
            { page: 'Gone', source: 'docs/gone.md' },
        ],
    });
    const { problems } = readWikiManifest(root);
    assert.ok(problems.some((p) => p.includes('"Home" is listed twice')));
    assert.ok(problems.some((p) => p.includes('"docs/gone.md" does not exist')));
    assert.ok(problems.some((p) => p.includes('"Gone" is not in the sidebar')));
    assert.deepEqual(buildWiki(root, path.join(root, 'out')).files, []);
});

test('a build writes the pages, the sidebar, the footer and the list of what it wrote', (t) => {
    const root = fixtureRepo(t);
    const out = path.join(root, 'out');
    const { files, problems } = buildWiki(root, out);
    assert.deepEqual(problems, []);
    assert.deepEqual(files, ['Home.md', 'Install.md', '_Footer.md', '_Sidebar.md']);
    assert.match(readFileSync(path.join(out, 'Home.md'), 'utf8'), /\[install\]\(Install#steps\)/);
    assert.match(
        readFileSync(path.join(out, '_Sidebar.md'), 'utf8'),
        /\*\*Start\*\*\n\n- \[\[Welcome\|Home\]\]\n- \[\[Installing\|Install\]\]/,
    );
    assert.deepEqual(JSON.parse(readFileSync(path.join(out, WIKI_OWNED_FILE), 'utf8')), { files });
    // A second build replaces the first; a folder that is not a build is refused.
    assert.deepEqual(buildWiki(root, out).problems, []);
    assert.equal(buildWiki(root, path.join(root, 'docs')).problems.length, 1);
});

test('publishing replaces its own pages and leaves the others, unless told to prune', (t) => {
    const env: NodeJS.ProcessEnv = {
        ...process.env,
        GIT_AUTHOR_NAME: 'Test',
        GIT_AUTHOR_EMAIL: 'test@example.invalid',
        GIT_COMMITTER_NAME: 'Test',
        GIT_COMMITTER_EMAIL: 'test@example.invalid',
        GIT_CONFIG_GLOBAL: path.join(tmpdir(), 'pychivalry-no-such-gitconfig'),
        GIT_CONFIG_NOSYSTEM: '1',
    };
    const git = (cwd: string, ...args: string[]): string =>
        execFileSync('git', args, { cwd, env, encoding: 'utf8' });

    // A wiki that already holds a hand-written page.
    const remote = path.join(tempDir(t), 'wiki.git');
    mkdirSync(remote);
    git(remote, 'init', '--quiet', '--bare');
    const seed = tempDir(t);
    git(seed, 'clone', '--quiet', remote, 'seed');
    writeTree(path.join(seed, 'seed'), { 'Old.md': '# Old\n' });
    git(path.join(seed, 'seed'), 'add', 'Old.md');
    git(path.join(seed, 'seed'), 'commit', '--quiet', '-m', 'Old page');
    git(path.join(seed, 'seed'), 'push', '--quiet', 'origin', 'HEAD');

    const published = (): string[] => {
        const look = tempDir(t);
        git(look, 'clone', '--quiet', remote, 'look');
        return readdirSync(path.join(look, 'look'))
            .filter((name) => name !== '.git')
            .sort();
    };
    const options = { ...env, WIKI_REMOTE: remote };

    const root = fixtureRepo(t);
    assert.match(publishWiki(root, { ...options, WIKI_DRY_RUN: 'true' }), /dry run/);
    assert.deepEqual(published(), ['Old.md']);

    assert.match(publishWiki(root, options), /published/);
    assert.deepEqual(published(), [
        WIKI_OWNED_FILE,
        'Home.md',
        'Install.md',
        'Old.md',
        '_Footer.md',
        '_Sidebar.md',
    ]);
    assert.match(publishWiki(root, options), /already up to date/);

    // A page dropped from the manifest goes; the hand-written page stays.
    const smaller = fixtureRepo(t, {
        ...MANIFEST,
        pages: [MANIFEST.pages[0]],
        sidebar: [{ heading: 'Start', pages: ['Home'] }],
    });
    writeTree(smaller, { 'docs/wiki/Home.md': '# Welcome\n' });
    publishWiki(smaller, options);
    assert.deepEqual(published(), [
        WIKI_OWNED_FILE,
        'Home.md',
        'Old.md',
        '_Footer.md',
        '_Sidebar.md',
    ]);

    publishWiki(smaller, { ...options, WIKI_PRUNE: 'all' });
    assert.deepEqual(published(), [WIKI_OWNED_FILE, 'Home.md', '_Footer.md', '_Sidebar.md']);
    assert.ok(!existsSync(path.join(smaller, 'out')));
});
