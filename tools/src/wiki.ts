/**
 * The repository wiki, generated from `docs/` (docs/wiki/README.md).
 *
 * `docs/wiki/manifest.json` names the documents that become wiki pages. Building copies each
 * one, rewriting its relative links: a link to another published document becomes a link to
 * that wiki page, and a link to anything else in the repository becomes a link to the file on
 * GitHub. Publishing writes the result into the wiki's own git repository. It replaces the
 * pages it wrote before and leaves every other page alone, unless `WIKI_PRUNE=all` is set.
 */

import { execFileSync } from 'node:child_process';
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CommandError, EXIT, isObject, readJson, writeJson, writeText } from './util.js';

/** The manifest, relative to the repository root. */
export const WIKI_MANIFEST = 'docs/wiki/manifest.json';

/** The file, in a build and in the wiki repository, that lists the files a publish wrote. */
export const WIKI_OWNED_FILE = '.generated.json';

const PAGE_NAME = /^[A-Za-z0-9][A-Za-z0-9-]*$/;
const IMAGE = /\.(png|jpe?g|gif|svg|webp)$/i;

export interface WikiPage {
    /** The wiki page name, which is also its file name without `.md`. */
    readonly page: string;
    /** The document it is made from, relative to the repository root, with forward slashes. */
    readonly source: string;
}

export interface WikiSection {
    readonly heading: string;
    readonly pages: readonly string[];
}

export interface WikiManifest {
    /** `<owner>/<name>` on GitHub. */
    readonly repository: string;
    /** The branch that links to repository files point at. */
    readonly branch: string;
    readonly pages: readonly WikiPage[];
    readonly sidebar: readonly WikiSection[];
}

/** What a repository path is, or undefined when nothing is there. */
export type PathKind = 'file' | 'dir' | undefined;

function kindOf(root: string, repoPath: string): PathKind {
    const file = path.join(root, ...repoPath.split('/'));
    if (!existsSync(file)) {
        return undefined;
    }
    return statSync(file).isDirectory() ? 'dir' : 'file';
}

function stringList(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
        return undefined;
    }
    const items = value as unknown[];
    return items.every((item) => typeof item === 'string') ? items : undefined;
}

/** Read and check the manifest. `manifest` is undefined when it cannot be used at all. */
export function readWikiManifest(root: string): {
    manifest: WikiManifest | undefined;
    problems: string[];
} {
    const file = path.join(root, ...WIKI_MANIFEST.split('/'));
    if (!existsSync(file)) {
        return { manifest: undefined, problems: [`${WIKI_MANIFEST} is missing`] };
    }
    const raw = readJson(file);
    if (!isObject(raw)) {
        return { manifest: undefined, problems: [`${WIKI_MANIFEST} is not an object`] };
    }
    const problems: string[] = [];
    const repository = typeof raw.repository === 'string' ? raw.repository : '';
    if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
        problems.push('"repository" must be "<owner>/<name>"');
    }
    const branch = typeof raw.branch === 'string' ? raw.branch : '';
    if (branch === '') {
        problems.push('"branch" must name a branch');
    }

    const pages: WikiPage[] = [];
    const entries = Array.isArray(raw.pages) ? (raw.pages as unknown[]) : [];
    if (entries.length === 0) {
        problems.push('"pages" must be a list with at least one page');
    }
    for (const entry of entries) {
        if (
            !isObject(entry) ||
            typeof entry.page !== 'string' ||
            typeof entry.source !== 'string'
        ) {
            problems.push('every entry of "pages" needs a "page" and a "source"');
            continue;
        }
        const { page, source } = entry;
        if (!PAGE_NAME.test(page)) {
            problems.push(`page "${page}": a name is letters, digits and hyphens`);
        }
        if (pages.some((other) => other.page === page)) {
            problems.push(`page "${page}" is listed twice`);
        }
        if (pages.some((other) => other.source === source)) {
            problems.push(`source "${source}" is published twice`);
        }
        if (
            !source.endsWith('.md') ||
            source.startsWith('/') ||
            source.includes('\\') ||
            path.posix.normalize(source) !== source ||
            source.startsWith('..')
        ) {
            problems.push(
                `page "${page}": "${source}" is not a Markdown file inside the repository`,
            );
        } else if (kindOf(root, source) !== 'file') {
            problems.push(`page "${page}": "${source}" does not exist`);
        }
        pages.push({ page, source });
    }
    if (entries.length > 0 && !pages.some((entry) => entry.page === 'Home')) {
        problems.push('there is no "Home" page');
    }

    const sidebar: WikiSection[] = [];
    const listed: string[] = [];
    const sections = Array.isArray(raw.sidebar) ? (raw.sidebar as unknown[]) : [];
    for (const section of sections) {
        const names = isObject(section) ? stringList(section.pages) : undefined;
        if (!isObject(section) || typeof section.heading !== 'string' || names === undefined) {
            problems.push('every entry of "sidebar" needs a "heading" and a list of "pages"');
            continue;
        }
        for (const name of names) {
            if (!pages.some((entry) => entry.page === name)) {
                problems.push(`sidebar "${section.heading}": there is no page "${name}"`);
            }
            if (listed.includes(name)) {
                problems.push(`sidebar: page "${name}" is listed twice`);
            }
            listed.push(name);
        }
        sidebar.push({ heading: section.heading, pages: names });
    }
    for (const entry of pages) {
        if (!listed.includes(entry.page)) {
            problems.push(`page "${entry.page}" is not in the sidebar`);
        }
    }
    return { manifest: { repository, branch, pages, sidebar }, problems };
}

function githubUrl(
    manifest: WikiManifest,
    kind: 'blob' | 'tree' | 'raw',
    repoPath: string,
): string {
    const encoded = repoPath.split('/').map(encodeURIComponent).join('/');
    const tail = encoded === '' ? '' : `/${encoded}`;
    return `https://github.com/${manifest.repository}/${kind}/${encodeURIComponent(manifest.branch)}${tail}`;
}

/**
 * Rewrite the relative links of a document for the wiki. Links in code spans and fenced code
 * are left alone. A link whose target does not exist is reported, and left as it is.
 */
export function rewriteLinks(
    markdown: string,
    source: string,
    manifest: WikiManifest,
    kind: (repoPath: string) => PathKind,
): { text: string; problems: string[] } {
    const problems: string[] = [];
    const pageOf = new Map(manifest.pages.map((entry) => [entry.source, entry.page]));

    const resolve = (target: string): string => {
        if (/^([a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) {
            return target;
        }
        const hash = target.indexOf('#');
        const fragment = hash === -1 ? '' : target.slice(hash);
        let relative = hash === -1 ? target : target.slice(0, hash);
        try {
            relative = decodeURIComponent(relative);
        } catch {
            problems.push(`${source}: link "${target}" is not valid`);
            return target;
        }
        const joined = path.posix.normalize(path.posix.join(path.posix.dirname(source), relative));
        const repoPath = joined === '.' ? '' : joined.replace(/\/$/, '');
        if (relative.startsWith('/') || repoPath.startsWith('..')) {
            problems.push(`${source}: link "${target}" points outside the repository`);
            return target;
        }
        const page = pageOf.get(repoPath);
        if (page !== undefined) {
            return `${page}${fragment}`;
        }
        const found = repoPath === '' ? 'dir' : kind(repoPath);
        if (found === undefined) {
            problems.push(`${source}: link "${target}" points at nothing`);
            return target;
        }
        if (found === 'dir') {
            return `${githubUrl(manifest, 'tree', repoPath)}${fragment}`;
        }
        return `${githubUrl(manifest, IMAGE.test(repoPath) ? 'raw' : 'blob', repoPath)}${fragment}`;
    };

    let inFence = false;
    const lines = markdown.split('\n').map((line) => {
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            return line;
        }
        if (inFence) {
            return line;
        }
        return line
            .split(/(`[^`]*`)/)
            .map((part, index) =>
                index % 2 === 1
                    ? part
                    : part.replace(
                          /\[([^\]]*)\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/g,
                          (_all, text: string, target: string, title: string) =>
                              `[${text}](${resolve(target)}${title})`,
                      ),
            )
            .join('');
    });
    return { text: lines.join('\n'), problems };
}

function titleOf(markdown: string, fallback: string): string {
    const heading = /^# +(.+?)\s*$/m.exec(markdown);
    return heading?.[1] ?? fallback;
}

/**
 * Build the wiki into `outDir`, replacing an earlier build there. Returns the names of the
 * files written; when there are problems nothing is written.
 */
export function buildWiki(root: string, outDir: string): { files: string[]; problems: string[] } {
    const { manifest, problems } = readWikiManifest(root);
    if (manifest === undefined || problems.length > 0) {
        return { files: [], problems };
    }
    if (
        existsSync(outDir) &&
        readdirSync(outDir).length > 0 &&
        !existsSync(path.join(outDir, WIKI_OWNED_FILE))
    ) {
        return { files: [], problems: [`${outDir} is not empty and is not an earlier wiki build`] };
    }

    const rendered = new Map<string, string>();
    const titles = new Map<string, string>();
    for (const entry of manifest.pages) {
        const markdown = readFileSync(path.join(root, ...entry.source.split('/')), 'utf8');
        const { text, problems: found } = rewriteLinks(markdown, entry.source, manifest, (p) =>
            kindOf(root, p),
        );
        problems.push(...found);
        titles.set(entry.page, titleOf(markdown, entry.page));
        rendered.set(
            `${entry.page}.md`,
            `<!-- Generated from ${entry.source}. Edit that file; this page is overwritten. -->\n\n${text}`,
        );
    }
    if (problems.length > 0) {
        return { files: [], problems };
    }

    const sidebar = manifest.sidebar
        .map((section) => {
            const links = section.pages.map((name) => `- [[${titles.get(name) ?? name}|${name}]]`);
            return `**${section.heading}**\n\n${links.join('\n')}\n`;
        })
        .join('\n');
    rendered.set('_Sidebar.md', sidebar);
    rendered.set(
        '_Footer.md',
        `Generated from [docs/](${githubUrl(manifest, 'tree', 'docs')}) in the repository. ` +
            'Edit the documents there; a change made on the wiki is overwritten.\n',
    );

    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });
    const files = [...rendered.keys()].sort();
    for (const [name, text] of rendered) {
        writeText(path.join(outDir, name), text);
    }
    writeJson(path.join(outDir, WIKI_OWNED_FILE), { files });
    return { files, problems: [] };
}

function git(cwd: string, env: NodeJS.ProcessEnv, args: readonly string[]): string {
    return execFileSync('git', args, { cwd, env, encoding: 'utf8' });
}

/**
 * Publish the wiki (task wiki:publish). Reads `WIKI_REMOTE` (default: the wiki of the
 * manifest's repository), `WIKI_PRUNE` (`all` also removes every file this tool did not write)
 * and `WIKI_DRY_RUN` (`true` reports the changes and pushes nothing). Returns a summary.
 */
export function publishWiki(root: string, env: NodeJS.ProcessEnv): string {
    const { manifest, problems } = readWikiManifest(root);
    if (manifest === undefined || problems.length > 0) {
        throw new CommandError(`wiki: ${problems.join('\n  ')}`, EXIT.failed);
    }
    const prune = env.WIKI_PRUNE ?? '';
    if (prune !== '' && prune !== 'all') {
        throw new CommandError('wiki: WIKI_PRUNE is either unset or "all"', EXIT.usage);
    }
    const remote =
        env.WIKI_REMOTE !== undefined && env.WIKI_REMOTE !== ''
            ? env.WIKI_REMOTE
            : `https://github.com/${manifest.repository}.wiki.git`;
    const work = mkdtempSync(path.join(tmpdir(), 'pychivalry-wiki-'));
    try {
        const build = path.join(work, 'build');
        const built = buildWiki(root, build);
        if (built.problems.length > 0) {
            throw new CommandError(`wiki: ${built.problems.join('\n  ')}`, EXIT.failed);
        }
        const clone = path.join(work, 'wiki');
        git(work, env, ['clone', '--quiet', remote, clone]);

        const ownedFile = path.join(clone, WIKI_OWNED_FILE);
        const owned = existsSync(ownedFile) ? readJson(ownedFile) : undefined;
        const before = (isObject(owned) ? stringList(owned.files) : undefined) ?? [];
        const tracked = git(clone, env, ['ls-files', '-z']).split('\0').filter(Boolean);
        const stale = (prune === 'all' ? tracked : before).filter(
            (name) => !built.files.includes(name) && name !== WIKI_OWNED_FILE,
        );
        for (const name of stale) {
            rmSync(path.join(clone, ...name.split('/')), { force: true });
        }
        for (const name of [...built.files, WIKI_OWNED_FILE]) {
            copyFileSync(path.join(build, name), path.join(clone, name));
        }

        git(clone, env, ['add', '--all']);
        const changes = git(clone, env, ['status', '--porcelain']).trimEnd();
        if (changes === '') {
            return 'wiki: already up to date, nothing published\n';
        }
        if (env.WIKI_DRY_RUN === 'true') {
            return `wiki: dry run, nothing published. It would change:\n${changes}\n`;
        }
        let commit: string;
        try {
            commit = git(root, env, ['rev-parse', '--short', 'HEAD']).trim();
        } catch {
            commit = 'a working copy';
        }
        git(clone, env, [
            'commit',
            '--quiet',
            '-m',
            `Publish from ${manifest.repository} ${commit}`,
        ]);
        git(clone, env, ['push', '--quiet', 'origin', 'HEAD']);
        return `wiki: published to ${remote}:\n${changes}\n`;
    } finally {
        rmSync(work, { recursive: true, force: true });
    }
}
