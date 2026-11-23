/**
 * The installable extension (`task vscode:package`; docs/PLAN.md, item 7.10): one `.vsix` file
 * with the three bundles and the spec package, `dist/pychivalry-<version>.vsix`. A build script,
 * never shipped: it runs after `task vscode:bundle`.
 *
 * The file is written by VS Code's own packaging tool, `vsce` (`@vscode/vsce`, a pinned
 * development dependency), from a staging folder that holds exactly what ships: the manifest
 * (`package.json`), the extension's `README.md`, the repository's `LICENSE` and `dist/bundle/`.
 * `vsce package` writes a local file and needs no publishing token; none is given, and nothing
 * is published. It runs with `--no-dependencies`: every dependency is inside the bundles.
 *
 * It then lists what the file holds, refuses it when anything is there that must not ship (a
 * file of `legacy/`, a source or test file, a fixture, a source map, a dependency folder), and
 * prints its size and its contents.
 */

import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { unwanted, zipEntries } from './zip-listing.js';

/** The extension's package folder: this file is `packages/vscode/dist/package.js`. */
const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');
const STAGE = path.join(PACKAGE, 'dist', 'package');

function version(): string {
    const manifest = JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as {
        version?: unknown;
    };
    if (typeof manifest.version !== 'string') {
        throw new Error('packages/vscode/package.json has no version');
    }
    return manifest.version;
}

function kib(bytes: number): string {
    return `${(bytes / 1024).toFixed(1)} KiB`;
}

function main(): void {
    const bundle = path.join(PACKAGE, 'dist', 'bundle');
    if (!statSync(path.join(bundle, 'extension.cjs'), { throwIfNoEntry: false })?.isFile()) {
        throw new Error('dist/bundle/extension.cjs is missing: run task vscode:bundle first');
    }
    rmSync(STAGE, { recursive: true, force: true });
    mkdirSync(STAGE, { recursive: true });
    cpSync(path.join(PACKAGE, 'package.json'), path.join(STAGE, 'package.json'));
    cpSync(path.join(PACKAGE, 'README.md'), path.join(STAGE, 'README.md'));
    cpSync(path.join(REPO, 'LICENSE'), path.join(STAGE, 'LICENSE'));
    cpSync(bundle, path.join(STAGE, 'dist', 'bundle'), { recursive: true });

    const out = path.join(PACKAGE, 'dist', `pychivalry-${version()}.vsix`);
    rmSync(out, { force: true });
    const vsce = path.join(
        path.dirname(createRequire(import.meta.url).resolve('@vscode/vsce/package.json')),
        'vsce',
    );
    const env = { ...process.env };
    for (const key of Object.keys(env)) {
        // vsce reads a publishing token from the environment; packaging needs none.
        if (key.toUpperCase() === 'VSCE_PAT') {
            Reflect.deleteProperty(env, key);
        }
    }
    const run = spawnSync(process.execPath, [vsce, 'package', '--no-dependencies', '--out', out], {
        cwd: STAGE,
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (run.status !== 0) {
        throw new Error(
            `vsce package failed (exit ${String(run.status)}):\n${run.stdout}${run.stderr}`,
        );
    }
    const entries = zipEntries(readFileSync(out));
    const bad = unwanted(entries);
    if (bad.length > 0) {
        throw new Error(`the .vsix holds what must not ship:\n${bad.join('\n')}`);
    }
    const size = statSync(out).size;
    const lines = [
        `vscode:package: ${path.relative(REPO, out).split(path.sep).join('/')}, ${kib(size)} (${(size / 1e6).toFixed(2)} MB), ${String(entries.length)} entries:`,
        ...entries.map((e) => `  ${e.name}  ${kib(e.size)} (${kib(e.stored)} stored)`),
    ];
    process.stdout.write(`${lines.join('\n')}\n`);
}

try {
    main();
} catch (err) {
    process.stderr.write(`vscode:package: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
}
