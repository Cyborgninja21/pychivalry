/**
 * The extension's bundles (`task vscode:bundle`), written with esbuild into `dist/bundle/`:
 *
 * - `extension.cjs`: the extension, one CommonJS file, `vscode` left to the editor;
 * - `server/pychivalry-mcp.mjs`: the agent server (`@pychivalry/mcp` with the core and the MCP
 *   library), one ES module file, which VS Code's own executable runs as Node;
 * - `server/spec/`: the committed spec package and its companions, beside it as data files;
 * - `server/manifest.json`: every file of `server/` with its SHA-256 and size, which the
 *   extension compares to decide whether its stored copy is current (`install.ts`);
 *
 * and, beside it and never shipped, `dist/test-bundle/suite.cjs`: the editor tests, which run
 * inside a real VS Code (`task vscode:test`).
 *
 * A build script, never shipped: it runs after `tsc -b`, from the compiled agent server.
 */

import { build, type BuildOptions } from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { manifestOf, MANIFEST_FILE } from './install.js';
import { SERVER_FILE, SPEC_FOLDER } from './launch.js';

/** The extension's package folder: this file is `packages/vscode/dist/bundle.js`. */
const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');
const OUT = path.join(PACKAGE, 'dist', 'bundle');
const SERVER = path.join(OUT, 'server');

/** The spec package's files: the package and its companions, each with its checksum file. */
const SPEC_FILE = /^ck3-spec-[0-9.]+(?:\.[a-z_]+)?\.(?:json\.gz|sha256)$/;

/** The runtime of the oldest VS Code the extension supports, and newer. */
const TARGET = 'node22';

const shared: BuildOptions = {
    bundle: true,
    platform: 'node',
    target: TARGET,
    logLevel: 'warning',
    legalComments: 'inline',
};

function version(): string {
    const manifest = JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as {
        version?: unknown;
    };
    if (typeof manifest.version !== 'string') {
        throw new Error('packages/vscode/package.json has no version');
    }
    return manifest.version;
}

async function main(): Promise<void> {
    rmSync(OUT, { recursive: true, force: true });
    await build({
        ...shared,
        entryPoints: [path.join(PACKAGE, 'dist', 'extension.js')],
        outfile: path.join(OUT, 'extension.cjs'),
        format: 'cjs',
        external: ['vscode'],
    });
    await build({
        ...shared,
        entryPoints: [path.join(REPO, 'packages', 'mcp', 'dist', 'main.js')],
        outfile: path.join(SERVER, SERVER_FILE),
        format: 'esm',
        // A CommonJS module inside an ES module bundle still calls require() for Node's own.
        banner: {
            js: "import { createRequire as __pychivalryRequire } from 'node:module'; const require = __pychivalryRequire(import.meta.url);",
        },
    });
    await build({
        ...shared,
        entryPoints: [path.join(PACKAGE, 'dist', 'editor', 'suite.js')],
        outfile: path.join(PACKAGE, 'dist', 'test-bundle', 'suite.cjs'),
        format: 'cjs',
        external: ['vscode'],
    });
    const specDir = path.join(SERVER, SPEC_FOLDER);
    mkdirSync(specDir, { recursive: true });
    const specFiles = readdirSync(path.join(REPO, 'spec')).filter((f) => SPEC_FILE.test(f));
    for (const file of specFiles) {
        copyFileSync(path.join(REPO, 'spec', file), path.join(specDir, file));
    }
    const manifest = manifestOf(SERVER, version(), [
        SERVER_FILE,
        ...specFiles.map((f) => `${SPEC_FOLDER}/${f}`),
    ]);
    writeFileSync(path.join(SERVER, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`);
    const size = manifest.files.reduce((n, f) => n + f.size, 0);
    process.stdout.write(
        `vscode:bundle: dist/bundle/extension.cjs, server/ (${String(manifest.files.length)} files, ${String(Math.round(size / 1024))} KiB)\n`,
    );
}

main().catch((err: unknown) => {
    process.stderr.write(`vscode:bundle: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
});
