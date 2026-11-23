/**
 * The editor tests' runner (`task vscode:test`; docs/PLAN.md, items 7.1, 7.2 and 7.8). A test
 * script, never shipped. It downloads the pinned VS Code once into `.vscode-test/` and starts it
 * three times, each with throwaway user-data, extensions, home, cache and Claude Code
 * configuration folders, none of them the user's:
 *
 * 1. `main`: the extension from `packages/vscode/`, on a copy of a fixture mod;
 * 2. `update-1`: the extension installed as version 1 in an extensions folder;
 * 3. `update-2`: after version 2 is installed and version 1 removed, with Claude Code's entry,
 *    unchanged since `update-1`, first started here with no VS Code running.
 *
 * On Linux it runs only on a virtual display: started under `xvfb-run -a`, it checks that the
 * display it was given belongs to a running Xvfb before it starts anything, removes Wayland and
 * the desktop session bus from VS Code's environment and starts it with `--ozone-platform=x11`,
 * so no window can open on a desktop. It also removes the variables of a VS Code or a Claude
 * Code session it is itself started from, so it runs from a terminal inside VS Code too.
 *
 * Claude Code: `PYCHIVALRY_TEST_CLAUDE` names a real `claude` to use (its own configuration
 * commands only, against the throwaway configuration folder); without it, the stand-in
 * (`claude-stand-in.ts`) is used. `PYCHIVALRY_VSCODE_VERSION` runs another VS Code than the
 * pinned one, to measure the floor.
 */

import { downloadAndUnzipVSCode, runTests, runVSCodeCommand } from '@vscode/test-electron';
import {
    cpSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runClaude } from '../claude.js';
import { EXTENSION_ID } from '../ids.js';
import { MANIFEST_FILE, parseManifest } from '../install.js';
import { checkThrough } from './agent.js';
import { readOrNull, virtualDisplay } from './display.js';
import { asEntry, assertFixtureAnswer, claudeEntryFor, FIXTURE_MOD } from './fixture.js';
import { writeVsix } from './vsix.js';

/** The VS Code the editor tests run in: the release installed where they were written. */
export const VSCODE_VERSION = '1.147.0';

const PACKAGE = fileURLToPath(new URL('../../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');

/**
 * VS Code's environment: this process's, without the variables of a VS Code, a desktop session
 * or a Claude Code session it was started from (each set to undefined, which removes it), with
 * `set` over it.
 */
function testEnv(set: Record<string, string>): Record<string, string | undefined> {
    const env: Record<string, string | undefined> = {};
    for (const key of Object.keys(process.env)) {
        const upper = key.toUpperCase();
        if (
            upper.startsWith('VSCODE_') ||
            upper.startsWith('CLAUDE_CODE_') ||
            upper.startsWith('MCP_') ||
            [
                'ELECTRON_RUN_AS_NODE',
                'CLAUDECODE',
                'AI_AGENT',
                'WAYLAND_DISPLAY',
                'DBUS_SESSION_BUS_ADDRESS',
            ].includes(upper)
        ) {
            env[key] = undefined;
        }
    }
    if (process.platform === 'linux') {
        Object.assign(env, {
            XDG_SESSION_TYPE: 'x11',
            GDK_BACKEND: 'x11',
            ELECTRON_OZONE_PLATFORM_HINT: 'x11',
        });
    }
    return { ...env, ...set };
}

/** A place for one run: every folder VS Code, the server and Claude Code write to. */
interface Place {
    readonly root: string;
    readonly userData: string;
    readonly extensions: string;
    readonly home: string;
    readonly claudeConfig: string;
    readonly cache: string;
}

function place(root: string, name: string): Place {
    const at = (sub: string): string => {
        const dir = path.join(root, name, sub);
        mkdirSync(dir, { recursive: true });
        return dir;
    };
    return {
        root: path.join(root, name),
        userData: at('user-data'),
        extensions: at('extensions'),
        home: at('home'),
        claudeConfig: at('claude-config'),
        cache: at('cache'),
    };
}

/**
 * A folder holding `claude`: the real one `PYCHIVALRY_TEST_CLAUDE` names, or the stand-in. On
 * Windows it is a `claude.cmd` that hands on `%*`, as an npm install's does.
 */
function claudeOnPath(root: string): { readonly dir: string; readonly what: string } {
    const dir = path.join(root, 'bin');
    mkdirSync(dir, { recursive: true });
    const real = process.env['PYCHIVALRY_TEST_CLAUDE'];
    const standIn = fileURLToPath(new URL('./claude-stand-in.js', import.meta.url));
    if (process.platform === 'win32') {
        const line = real === undefined ? `"${process.execPath}" "${standIn}"` : `"${real}"`;
        writeFileSync(path.join(dir, 'claude.cmd'), `@echo off\r\n${line} %*\r\n`);
    } else if (real === undefined) {
        writeFileSync(
            path.join(dir, 'claude'),
            `#!/bin/sh\nexec "${process.execPath}" "${standIn}" "$@"\n`,
            {
                mode: 0o755,
            },
        );
    } else {
        symlinkSync(real, path.join(dir, 'claude'));
    }
    return { dir, what: real === undefined ? 'the stand-in' : `Claude Code at ${real}` };
}

/** A copy of the fixture mod in a folder whose name needs quoting on every system. */
function modCopy(root: string): string {
    const mod = path.join(root, 'mods & more (100%)', 'a mod');
    cpSync(path.join(REPO, 'fixtures', 'mods', FIXTURE_MOD), mod, { recursive: true });
    const loc = path.join(mod, 'localization', 'english');
    mkdirSync(loc, { recursive: true });
    writeFileSync(
        path.join(loc, 'fixture_l_english.yml'),
        '﻿l_english:\n fixture.0001.t:0 "A fixture"\n',
        'utf8',
    );
    return mod;
}

/**
 * The built extension as an installable file of version `version`: its manifest and its
 * bundles, the server's manifest stating the same version, as a release of that version would.
 */
function vsixOf(root: string, version: string): string {
    const stage = path.join(root, 'stage', version);
    mkdirSync(stage, { recursive: true });
    const manifest = JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as Record<
        string,
        unknown
    >;
    writeFileSync(
        path.join(stage, 'package.json'),
        `${JSON.stringify({ ...manifest, version }, null, 4)}\n`,
    );
    cpSync(path.join(PACKAGE, 'dist', 'bundle'), path.join(stage, 'dist', 'bundle'), {
        recursive: true,
    });
    const server = path.join(stage, 'dist', 'bundle', 'server', MANIFEST_FILE);
    const bundle = parseManifest(readFileSync(server, 'utf8'));
    writeFileSync(server, `${JSON.stringify({ ...bundle, version }, null, 2)}\n`);
    const file = path.join(root, 'stage', `pychivalry-${version}.vsix`);
    writeVsix(file, stage);
    return file;
}

async function main(): Promise<void> {
    if (process.platform === 'linux') {
        const shown = virtualDisplay(process.env, readOrNull);
        if ('refused' in shown) {
            throw new Error(`refusing to start VS Code: ${shown.refused}`);
        }
        process.stdout.write(`vscode:test: virtual display ${shown.display} (Xvfb)\n`);
    }
    for (const file of ['bundle/extension.cjs', 'test-bundle/suite.cjs']) {
        if (!existsSync(path.join(PACKAGE, 'dist', ...file.split('/')))) {
            throw new Error(`dist/${file} is missing: run task vscode:bundle first`);
        }
    }
    const version = process.env['PYCHIVALRY_VSCODE_VERSION'] ?? VSCODE_VERSION;
    const vscodeExecutablePath = await downloadAndUnzipVSCode({
        version,
        cachePath: path.join(REPO, '.vscode-test'),
    });
    process.stdout.write(`vscode:test: VS Code ${version}\n`);

    const root = mkdtempSync(path.join(tmpdir(), 'pychivalry-editor-'));
    try {
        const claude = claudeOnPath(root);
        process.stdout.write(`vscode:test: claude is ${claude.what}\n`);
        const mod = modCopy(root);
        const suiteFile = path.join(PACKAGE, 'dist', 'test-bundle', 'suite.cjs');
        const linuxArgs =
            process.platform === 'linux' ? ['--ozone-platform=x11', '--disable-gpu'] : [];

        const start = async (
            suite: string,
            at: Place,
            developmentPath: string,
            extra: Record<string, string>,
        ): Promise<void> => {
            process.stdout.write(`vscode:test: suite ${suite}\n`);
            const pathVar =
                Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
            await runTests({
                vscodeExecutablePath,
                extensionDevelopmentPath: developmentPath,
                extensionTestsPath: suiteFile,
                launchArgs: [
                    mod,
                    `--user-data-dir=${at.userData}`,
                    `--extensions-dir=${at.extensions}`,
                    '--disable-telemetry',
                    ...linuxArgs,
                ],
                extensionTestsEnv: testEnv({
                    PYCHIVALRY_EDITOR_SUITE: suite,
                    PYCHIVALRY_TEST_MOD: mod,
                    PYCHIVALRY_TEST_USER_DATA: at.userData,
                    PYCHIVALRY_EXPECTED_DISPLAY: process.env['DISPLAY'] ?? '',
                    HOME: at.home,
                    CLAUDE_CONFIG_DIR: at.claudeConfig,
                    XDG_CACHE_HOME: at.cache,
                    LOCALAPPDATA: at.cache,
                    DISABLE_TELEMETRY: '1',
                    DISABLE_ERROR_REPORTING: '1',
                    DISABLE_AUTOUPDATER: '1',
                    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
                    [pathVar]: `${claude.dir}${path.delimiter}${process.env[pathVar] ?? ''}`,
                    ...extra,
                }),
            });
        };

        const main = place(root, 'main');
        await start('main', main, PACKAGE, {});
        if (process.env['PYCHIVALRY_TEST_CLAUDE'] !== undefined) {
            // Claude Code itself reads the entry the set-up wrote and starts the server from it:
            // `claude mcp get` health-checks a server by connecting to it.
            const win = process.platform === 'win32';
            const got = await runClaude(
                { file: path.join(claude.dir, win ? 'claude.cmd' : 'claude'), viaCmd: win },
                ['mcp', 'get', 'pychivalry'],
                mod,
                {
                    ...process.env,
                    ...Object.fromEntries(
                        Object.entries(
                            testEnv({
                                HOME: main.home,
                                CLAUDE_CONFIG_DIR: main.claudeConfig,
                                XDG_CACHE_HOME: main.cache,
                                LOCALAPPDATA: main.cache,
                                DISABLE_TELEMETRY: '1',
                                DISABLE_ERROR_REPORTING: '1',
                                DISABLE_AUTOUPDATER: '1',
                                CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
                            }),
                        ).filter((e) => e[1] !== undefined),
                    ),
                },
            );
            process.stdout.write(
                `vscode:test: claude mcp get pychivalry:\n${got.stdout}${got.stderr}`,
            );
            if (got.code !== 0 || !/Connected/.test(got.stdout) || /Failed/.test(got.stdout)) {
                throw new Error('Claude Code could not connect to the server it was given');
            }
            process.stdout.write(
                'ok - Claude Code connects to the server from the entry the set-up wrote\n',
            );
        }
        if (process.env['PYCHIVALRY_EDITOR_SUITES'] === 'main') {
            return;
        }

        // Item 7.1 (c): the extension as a user installs it, then an update.
        const update = place(root, 'update');
        const harness = path.join(root, 'harness');
        mkdirSync(harness, { recursive: true });
        writeFileSync(
            path.join(harness, 'package.json'),
            `${JSON.stringify({ name: 'harness', publisher: 'pychivalry-test', version: '0.0.0', engines: { vscode: '*' } })}\n`,
        );
        const v1 = (
            JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as {
                version: string;
            }
        ).version;
        const v2 = v1.replace(/(\d+)$/, (n) => String(Number(n) + 1));
        const versions = {
            PYCHIVALRY_TEST_EXTENSIONS: update.extensions,
            PYCHIVALRY_TEST_V1: v1,
            PYCHIVALRY_TEST_V2: v2,
        };
        // VS Code's own installer puts each version in place, as an update does.
        const install = async (vsix: string): Promise<void> => {
            const out = await runVSCodeCommand(
                [
                    '--install-extension',
                    vsix,
                    '--force',
                    `--extensions-dir=${update.extensions}`,
                    `--user-data-dir=${update.userData}`,
                ],
                {
                    version,
                    cachePath: path.join(REPO, '.vscode-test'),
                    spawn: {
                        env: Object.fromEntries(
                            Object.entries({
                                ...process.env,
                                ...testEnv({ HOME: update.home, DONT_PROMPT_WSL_INSTALL: '1' }),
                            }).filter((e): e is [string, string] => e[1] !== undefined),
                        ),
                    },
                },
            );
            process.stdout.write(out.stdout);
        };
        await install(vsixOf(root, v1));
        await start('update-1', update, harness, versions);

        await install(vsixOf(root, v2));
        const first = path.join(update.extensions, `${EXTENSION_ID}-${v1}`);
        process.stdout.write(
            `vscode:test: after installing ${v2}, VS Code ${existsSync(first) ? 'left' : 'removed'} the ${v1} folder\n`,
        );
        rmSync(first, { recursive: true, force: true });
        const entry = claudeEntryFor(update.claudeConfig, mod);
        assertFixtureAnswer(
            await checkThrough({
                ...asEntry(entry),
                env: {
                    ...asEntry(entry).env,
                    HOME: update.home,
                    XDG_CACHE_HOME: update.cache,
                    LOCALAPPDATA: update.cache,
                },
            }),
        );
        process.stdout.write(
            `ok - between versions: Claude Code's entry answers check with version ${v1} removed and no VS Code running\n`,
        );
        await start('update-2', update, harness, versions);
    } finally {
        if (process.env['PYCHIVALRY_KEEP_SCRATCH'] === '1') {
            process.stdout.write(`vscode:test: kept ${root}\n`);
        } else {
            rmSync(root, { recursive: true, force: true });
            // VS Code's agent host can outlive its window by a moment and write into the home
            // folder it was given: removed again once it has gone.
            await new Promise((resolve) => setTimeout(resolve, 5000));
            rmSync(root, { recursive: true, force: true });
        }
    }
}

main().catch((err: unknown) => {
    process.stderr.write(
        `vscode:test: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
    );
    process.exitCode = 1;
});
