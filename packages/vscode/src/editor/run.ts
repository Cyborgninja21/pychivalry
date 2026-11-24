/**
 * The editor tests' runner (`task vscode:test`; docs/PLAN.md, step 7). A test script, never
 * shipped. It downloads the pinned VS Code once into `.vscode-test/` and starts it once for each
 * suite, each time with throwaway user-data, extensions, home, cache and Claude Code
 * configuration folders, none of them the user's:
 *
 * 1. `main`: the extension from `packages/vscode/`, on a copy of a fixture mod;
 * 2. `smoke`: the packaged `.vsix` (`task vscode:package`), installed by VS Code's own installer
 *    into a clean extensions folder, on a copy of the planted-defect mod with the setting
 *    `pychivalry.gamePath` naming its game stub (items 7.9 and 7.11);
 * 3. `update-1`: the extension installed as version 1 in an extensions folder;
 * 4. `update-2`: after version 2 is installed and version 1 removed, with Claude Code's entry,
 *    unchanged since `update-1`, first started here with no VS Code running.
 *
 * `PYCHIVALRY_EDITOR_SUITES` (comma-separated: `main`, `smoke`, `update`) runs only those.
 *
 * `PYCHIVALRY_EDITOR_MODE=corpus` (`task vscode:corpus`, local only) instead opens the packaged
 * extension on each mod of the corpus (`CK3_CORPUS`, `CK3_CORPUS_SLUGS`) with the game
 * (`CK3_GAME_PATH`), `PYCHIVALRY_CORPUS_RUNS` times each (6 by default, one mod after the other
 * in turn, as release 2.3.0's editor baseline was run), with one index cache for the whole
 * series; it records the time to the first full result and the language server's peak memory,
 * runs the same-answers test on the first run of each mod, prints the medians and writes them to
 * `PYCHIVALRY_CORPUS_REPORT` when that is set.
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
    readdirSync,
    readFileSync,
    rmSync,
    symlinkSync,
    writeFileSync,
} from 'node:fs';
import { loadavg, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runClaude } from '../claude.js';
import { EXTENSION_ID } from '../ids.js';
import { MANIFEST_FILE, parseManifest } from '../install.js';
import { checkThrough } from './agent.js';
import { readOrNull, virtualDisplay } from './display.js';
import { asEntry, assertFixtureAnswer, claudeEntryFor, FIXTURE_MOD } from './fixture.js';
import { VSCODE_VERSION } from './version.js';
import { writeVsix } from './vsix.js';

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

function place(root: string, name: string, extensions?: string): Place {
    const at = (sub: string): string => {
        const dir = path.join(root, name, sub);
        mkdirSync(dir, { recursive: true });
        return dir;
    };
    return {
        root: path.join(root, name),
        userData: at('user-data'),
        extensions: extensions ?? at('extensions'),
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
        // A batch file reads `%` as the start of a variable: doubled, it stays a `%`.
        const q = (p: string): string => `"${p.replace(/%/g, '%%')}"`;
        const line = real === undefined ? `${q(process.execPath)} ${q(standIn)}` : q(real);
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
        '﻿l_english:\n fixture.0001.t:0 "A fixture"\n fixture.0001.a:0 "Fine"\n',
        'utf8',
    );
    return mod;
}

/** The file of the planted copy written with `\n` line breaks (`plantedCopy`). */
const LF_FILE = 'events/harvest_faith_events.txt';

/**
 * The planted-defect mod, copied into a folder whose name holds a space. The mod is in
 * pychivalry's format, so one file of the copy is written with `\n` line breaks: the
 * same-formatting test then proves that Format Document turns a document's `\n` to `\r\n`, which
 * an edit's text cannot do in VS Code.
 */
function plantedCopy(root: string): string {
    const mod = path.join(root, 'smoke mods', 'harvest festival');
    cpSync(path.join(REPO, 'fixtures', 'defects', 'mod'), mod, { recursive: true });
    const lf = path.join(mod, ...LF_FILE.split('/'));
    writeFileSync(lf, readFileSync(lf, 'utf8').replaceAll('\r\n', '\n'), 'utf8');
    return mod;
}

/** The planted-defect mod's game stub: its `game` folder. */
const PLANTED_GAME = path.join(REPO, 'fixtures', 'game', 'planted-defects', 'game');

/** VS Code's user settings for a run: `settings.json` in its user-data folder. */
function writeSettings(at: Place, settings: Record<string, unknown>): void {
    const dir = path.join(at.userData, 'User');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'settings.json'), `${JSON.stringify(settings, null, 4)}\n`);
}

/** The extension's version, as in its manifest. */
function extensionVersion(): string {
    return (
        JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as { version: string }
    ).version;
}

/** The `.vsix` `task vscode:package` wrote for this version. */
function packagedVsix(): string {
    const file = path.join(PACKAGE, 'dist', `pychivalry-${extensionVersion()}.vsix`);
    if (!existsSync(file)) {
        throw new Error(`${file} is missing: run task vscode:package first`);
    }
    return file;
}

/** The median of a list of numbers. */
function median(values: readonly number[]): number {
    const s = [...values].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
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

/** What every suite's start needs. */
interface Starter {
    readonly vscodeExecutablePath: string;
    readonly version: string;
    readonly claudeDir: string;
}

/** A harness extension: the development folder of a run whose extension is installed. */
function harnessExtension(root: string): string {
    const harness = path.join(root, 'harness');
    mkdirSync(harness, { recursive: true });
    writeFileSync(
        path.join(harness, 'package.json'),
        `${JSON.stringify({ name: 'harness', publisher: 'pychivalry-test', version: '0.0.0', engines: { vscode: '*' } })}\n`,
    );
    return harness;
}

/** Start VS Code on `mod` with the suite `suite` in `at`, its extension from `developmentPath`. */
async function start(
    how: Starter,
    suite: string,
    at: Place,
    developmentPath: string,
    mod: string,
    extra: Record<string, string>,
): Promise<void> {
    process.stdout.write(`vscode:test: suite ${suite}\n`);
    const pathVar = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') ?? 'PATH';
    const linuxArgs = process.platform === 'linux' ? ['--ozone-platform=x11', '--disable-gpu'] : [];
    await runTests({
        vscodeExecutablePath: how.vscodeExecutablePath,
        extensionDevelopmentPath: developmentPath,
        extensionTestsPath: path.join(PACKAGE, 'dist', 'test-bundle', 'suite.cjs'),
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
            [pathVar]: `${how.claudeDir}${path.delimiter}${process.env[pathVar] ?? ''}`,
            ...extra,
        }),
    });
}

/** VS Code's own installer puts `vsix` into `at`'s extensions folder, as a user's install does. */
async function install(how: Starter, vsix: string, at: Place): Promise<void> {
    const out = await runVSCodeCommand(
        [
            '--install-extension',
            vsix,
            '--force',
            `--extensions-dir=${at.extensions}`,
            `--user-data-dir=${at.userData}`,
        ],
        {
            version: how.version,
            cachePath: path.join(REPO, '.vscode-test'),
            spawn: {
                env: Object.fromEntries(
                    Object.entries({
                        ...process.env,
                        ...testEnv({ HOME: at.home, DONT_PROMPT_WSL_INSTALL: '1' }),
                    }).filter((e): e is [string, string] => e[1] !== undefined),
                ),
            },
        },
    );
    process.stdout.write(out.stdout);
}

/** The suites `task vscode:test` runs. */
async function tests(how: Starter, root: string): Promise<void> {
    const wanted = new Set(
        (process.env['PYCHIVALRY_EDITOR_SUITES'] ?? 'main,smoke,update')
            .split(',')
            .map((w) => w.trim()),
    );
    const harness = harnessExtension(root);
    // Each suite runs whatever the one before it did, and the run fails at the end naming each
    // suite that failed, so one failure does not hide another system's.
    const failed: string[] = [];
    const suite = async (name: string, run: () => Promise<void>): Promise<void> => {
        if (!wanted.has(name)) {
            return;
        }
        try {
            await run();
        } catch (err) {
            failed.push(name);
            process.stderr.write(
                `vscode:test: suite ${name} failed: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}\n`,
            );
        }
    };

    await suite('main', async () => {
        const mod = modCopy(root);
        const main = place(root, 'main');
        await start(how, 'main', main, PACKAGE, mod, { PYCHIVALRY_TEST_GAME: PLANTED_GAME });
        if (process.env['PYCHIVALRY_TEST_CLAUDE'] !== undefined) {
            // Claude Code itself reads the entry the set-up wrote and starts the server from it:
            // `claude mcp get` health-checks a server by connecting to it.
            const win = process.platform === 'win32';
            const got = await runClaude(
                { file: path.join(how.claudeDir, win ? 'claude.cmd' : 'claude'), viaCmd: win },
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
    });

    await suite('smoke', async () => {
        // Items 7.9 and 7.11: the packaged file, installed into a clean VS Code.
        const vsix = packagedVsix();
        const smoke = place(root, 'smoke');
        await install(how, vsix, smoke);
        writeSettings(smoke, { 'pychivalry.gamePath': PLANTED_GAME });
        await start(how, 'smoke', smoke, harness, plantedCopy(root), {
            PYCHIVALRY_TEST_GAME: PLANTED_GAME,
            PYCHIVALRY_TEST_WORK: path.join(root, 'smoke-work'),
            PYCHIVALRY_TEST_EXTENSIONS: smoke.extensions,
            PYCHIVALRY_TEST_VERSION: extensionVersion(),
        });
    });

    await suite('update', async () => {
        // Item 7.1 (c): the extension as a user installs it, then an update.
        const mod = existsSync(path.join(root, 'mods & more (100%)', 'a mod'))
            ? path.join(root, 'mods & more (100%)', 'a mod')
            : modCopy(root);
        const update = place(root, 'update');
        const v1 = extensionVersion();
        const v2 = v1.replace(/(\d+)$/, (n) => String(Number(n) + 1));
        const versions = {
            PYCHIVALRY_TEST_EXTENSIONS: update.extensions,
            PYCHIVALRY_TEST_V1: v1,
            PYCHIVALRY_TEST_V2: v2,
        };
        await install(how, vsixOf(root, v1), update);
        await start(how, 'update-1', update, harness, mod, versions);

        await install(how, vsixOf(root, v2), update);
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
        await start(how, 'update-2', update, harness, mod, versions);
    });

    if (failed.length > 0) {
        throw new Error(`the editor suites ${failed.join(', ')} failed`);
    }
}

/** One run of the corpus suite: what it wrote. */
interface CorpusRun {
    readonly time_to_first_full_result_ms: number;
    readonly server_peak_rss_kib: number;
    readonly files_checked: number;
    readonly files_total: number;
    readonly limited: boolean;
    readonly vscode: string;
    readonly same_answers?: Record<string, unknown>;
    readonly load_average_1m: number;
}

/** `task vscode:corpus`: the packaged extension on each real mod, timed, and compared. */
async function corpus(how: Starter, root: string): Promise<void> {
    const game = process.env['CK3_GAME_PATH'];
    const corpusDir = process.env['CK3_CORPUS'];
    if (game === undefined || game === '' || corpusDir === undefined || corpusDir === '') {
        throw new Error('vscode:corpus needs CK3_GAME_PATH and CK3_CORPUS');
    }
    const slugs = (process.env['CK3_CORPUS_SLUGS'] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');
    const mods =
        slugs.length > 0
            ? slugs
            : readdirSync(corpusDir, { withFileTypes: true })
                  .filter((e) => e.isDirectory())
                  .map((e) => e.name)
                  .sort();
    const runs = Number(process.env['PYCHIVALRY_CORPUS_RUNS'] ?? '6');
    if (!Number.isInteger(runs) || runs < 1) {
        throw new Error('PYCHIVALRY_CORPUS_RUNS must be a whole number of at least 1');
    }
    const harness = harnessExtension(root);
    const installed = place(root, 'corpus-install');
    await install(how, packagedVsix(), installed);
    // One index cache for the whole series: the first run builds it, the later ones load it.
    const cache = path.join(root, 'corpus-cache');
    mkdirSync(cache, { recursive: true });
    const results = new Map<string, CorpusRun[]>(mods.map((m) => [m, []]));
    for (let run = 1; run <= runs; run++) {
        for (const slug of mods) {
            const at = place(root, `corpus-${String(run)}-${slug}`, installed.extensions);
            writeSettings(at, { 'pychivalry.gamePath': game });
            const out = path.join(at.root, 'result.json');
            const load = loadavg()[0] ?? 0;
            await start(how, 'corpus', at, harness, path.join(corpusDir, slug), {
                PYCHIVALRY_TEST_GAME: game,
                PYCHIVALRY_TEST_WORK: path.join(at.root, 'work'),
                PYCHIVALRY_CORPUS_OUT: out,
                PYCHIVALRY_CORPUS_COMPARE: run === 1 ? '1' : '0',
                XDG_CACHE_HOME: cache,
                LOCALAPPDATA: cache,
            });
            const result = {
                ...(JSON.parse(readFileSync(out, 'utf8')) as Omit<CorpusRun, 'load_average_1m'>),
                load_average_1m: load,
            };
            results.get(slug)?.push(result);
            process.stdout.write(
                `vscode:corpus: run ${String(run)}/${String(runs)} ${slug}: ${String(result.time_to_first_full_result_ms)} ms, ${String(result.server_peak_rss_kib)} KiB${result.same_answers === undefined ? '' : `, same answers ${JSON.stringify(result.same_answers)}`}\n`,
            );
            for (const sub of [
                at.userData,
                at.home,
                at.claudeConfig,
                at.cache,
                path.join(at.root, 'work'),
            ]) {
                rmSync(sub, { recursive: true, force: true });
            }
        }
    }
    const report = mods.map((slug) => {
        const list = results.get(slug) ?? [];
        const [first, ...later] = list;
        const ms = later.map((r) => r.time_to_first_full_result_ms);
        const kib = later.map((r) => r.server_peak_rss_kib);
        return {
            mod: slug,
            files_checked: first?.files_checked,
            first: {
                time_to_first_full_result_ms: first?.time_to_first_full_result_ms,
                server_peak_rss_kib: first?.server_peak_rss_kib,
            },
            later: {
                runs: later.length,
                time_to_first_full_result_ms:
                    ms.length === 0
                        ? null
                        : {
                              median: median(ms),
                              min: Math.min(...ms),
                              max: Math.max(...ms),
                              values: ms,
                          },
                server_peak_rss_kib:
                    kib.length === 0
                        ? null
                        : {
                              median: median(kib),
                              min: Math.min(...kib),
                              max: Math.max(...kib),
                              values: kib,
                          },
            },
            same_answers: first?.same_answers ?? null,
            vscode: first?.vscode,
            load_average_1m: list.map((r) => r.load_average_1m),
        };
    });
    const text = `${JSON.stringify({ runs, mods: report }, null, 2)}\n`;
    process.stdout.write(`vscode:corpus: report\n${text}`);
    const file = process.env['PYCHIVALRY_CORPUS_REPORT'];
    if (file !== undefined && file !== '') {
        writeFileSync(file, text);
    }
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
    const downloadStarted = Date.now();
    const vscodeExecutablePath = await downloadAndUnzipVSCode({
        version,
        cachePath: path.join(REPO, '.vscode-test'),
    });
    process.stdout.write(
        `vscode:test: VS Code ${version} ready in ${String(Date.now() - downloadStarted)} ms, started as ${path.basename(vscodeExecutablePath)} in a folder holding ${readdirSync(path.dirname(vscodeExecutablePath)).join(', ')}\n`,
    );

    const root = mkdtempSync(path.join(tmpdir(), 'pychivalry-editor-'));
    try {
        const claude = claudeOnPath(root);
        process.stdout.write(`vscode:test: claude is ${claude.what}\n`);
        const how: Starter = { vscodeExecutablePath, version, claudeDir: claude.dir };
        if (process.env['PYCHIVALRY_EDITOR_MODE'] === 'corpus') {
            await corpus(how, root);
        } else {
            await tests(how, root);
        }
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
