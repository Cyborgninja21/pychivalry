#!/usr/bin/env node
/**
 * `task dev:launch-check`: start every configuration of .vscode/launch.json once, outside
 * VS Code, the way the VS Code debugger would, and report each one (the proof behind
 * Documentation/developer-guide/debugging.md, which names only configurations that exist).
 *
 *   node tools/launch-check.js [--only <text>] [--list]
 *
 * Per configuration:
 *   - its preLaunchTask is run from .vscode/tasks.json (npm and shell tasks, dependsOn in
 *     sequence or in parallel; a background task runs until its problem matcher reports the
 *     end of a build and is stopped after the launch, as VS Code does);
 *   - `node` launches: the program with its arguments; passed = exit code 0;
 *   - `extensionHost` launches with --extensionTestsPath: the tests in the downloaded
 *     VS Code (vscode-extension/.vscode-test); passed = exit code 0;
 *   - other `extensionHost` launches: VS Code with the configuration's arguments and
 *     --inspect-extensions (what the debugger adds); passed = the extension host's inspector
 *     answers and the language server's inspector on 6009 answers and evaluates in the
 *     server process (this is the "Attach to Language Server (Development Host)" attach);
 *   - `attach` configurations on 9229 and 5870: the development build linked by
 *     tools/dev-link.js into a fresh extensions folder of a VS Code started like a main
 *     instance (no development path); 5870 = that VS Code started with
 *     --inspect-extensions=5870, 9229 = the server's inspector opened with SIGUSR1
 *     (process._debugProcess on Windows); passed = a debugger session evaluates in the
 *     extension host or the server.
 *   - compounds: every configuration they name exists and was started.
 * ${file} is a sample test file for the "Current File" configurations; ${input:x} is the
 * input's default; configurations whose inputs name a folder that does not exist (the
 * corpus) are reported as skipped. Corpus records a configuration writes are restored.
 * Run it under `xvfb-run -a` on headless Linux, with ELECTRON_RUN_AS_NODE and VSCODE_*
 * unset when started from a VS Code terminal. Standard library plus the workspace's
 * @vscode/test-electron (to find the downloaded VS Code).
 */
'use strict';

const cp = require('child_process');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXT = path.join(ROOT, 'vscode-extension');
const SERVER_PORT = 6009;
const SAMPLE_FILES = {
    unit: path.join(EXT, 'src', 'test', 'unit', 'server-version.test.ts'),
    engine: path.join(ROOT, 'packages', 'engine', 'test', 'unit', 'spec.test.ts'),
};
const TSC_WATCH_END = /(?:Compilation complete\.|Found \d+ errors?\. Watching for file changes\.)/;

// ── JSON with comments ───────────────────────────────────────────

function readJsonc(file) {
    const text = fs.readFileSync(file, 'utf8');
    let out = '';
    let inString = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inString) {
            out += c;
            if (c === '\\') {
                out += text[++i];
            } else if (c === '"') {
                inString = false;
            }
        } else if (c === '"') {
            inString = true;
            out += c;
        } else if (c === '/' && text[i + 1] === '/') {
            while (i < text.length && text[i] !== '\n') {
                i++;
            }
            out += '\n';
        } else {
            out += c;
        }
    }
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

// ── Variables ────────────────────────────────────────────────────

function makeResolver(inputs, sampleFile) {
    const defaults = Object.fromEntries((inputs ?? []).map((i) => [i.id, i.default ?? '']));
    const file = sampleFile ?? '';
    const vars = {
        workspaceFolder: ROOT,
        file,
        fileBasenameNoExtension: path.basename(file).replace(/\.[^.]+$/, ''),
    };
    const resolve = (value) =>
        value.replace(/\$\{([^}]+)\}/g, (_, name) => {
            if (name.startsWith('input:')) {
                return defaults[name.slice(6)];
            }
            if (name.startsWith('env:')) {
                return process.env[name.slice(4)] ?? '';
            }
            if (name in vars) {
                return vars[name];
            }
            throw new Error(`unsupported variable \${${name}}`);
        });
    const deep = (v) =>
        typeof v === 'string'
            ? resolve(v)
            : Array.isArray(v)
              ? v.map(deep)
              : v && typeof v === 'object'
                ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]))
                : v;
    return deep;
}

function cleanEnv(extra) {
    const env = { ...process.env, ...(extra ?? {}), DONT_PROMPT_WSL_INSTALL: '1' };
    delete env.ELECTRON_RUN_AS_NODE;
    for (const k of Object.keys(env)) {
        if (k.startsWith('VSCODE_')) {
            delete env[k];
        }
    }
    return env;
}

// ── Processes ────────────────────────────────────────────────────

const running = new Set();

function start(command, args, options, onLine) {
    const child = cp.spawn(command, args, {
        ...options,
        detached: process.platform !== 'win32',
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    running.add(child);
    let buffer = '';
    const feed = (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
            log.push(line);
            if (onLine) {
                onLine(line);
            }
        }
    };
    child.stdout.on('data', feed);
    child.stderr.on('data', feed);
    child.on('exit', () => running.delete(child));
    return child;
}

function stop(child) {
    if (!child || child.exitCode !== null) {
        return;
    }
    try {
        if (process.platform === 'win32') {
            cp.spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f']);
        } else {
            process.kill(-child.pid, 'SIGTERM');
        }
    } catch {
        // already gone
    }
}

function exited(child, ms) {
    return new Promise((resolve) => {
        if (child.exitCode !== null) {
            resolve(child.exitCode);
            return;
        }
        const timer = setTimeout(() => {
            stop(child);
            resolve('timeout');
        }, ms);
        child.on('exit', (code) => {
            clearTimeout(timer);
            resolve(code);
        });
    });
}

const log = [];

// ── Tasks (.vscode/tasks.json) ───────────────────────────────────

function taskByLabel(tasks, label) {
    const task = tasks.find((t) => t.label === label);
    if (!task) {
        throw new Error(`task "${label}" is not in .vscode/tasks.json`);
    }
    return task;
}

function endPatternOf(task) {
    const m = task.problemMatcher;
    if (m && m.background && m.background.endsPattern) {
        return new RegExp(m.background.endsPattern);
    }
    if (m && m.base === '$tsc-watch') {
        return TSC_WATCH_END;
    }
    throw new Error(`background task "${task.label}" has no end pattern`);
}

/** Runs a task; returns the background processes it left running. */
async function runTask(tasks, label, resolve) {
    const task = resolve(taskByLabel(tasks, label));
    const left = [];
    if (task.dependsOn) {
        const deps = Array.isArray(task.dependsOn) ? task.dependsOn : [task.dependsOn];
        if (task.dependsOrder === 'sequence') {
            for (const d of deps) {
                left.push(...(await runTask(tasks, d, resolve)));
            }
        } else {
            for (const r of await Promise.all(deps.map((d) => runTask(tasks, d, resolve)))) {
                left.push(...r);
            }
        }
    }
    let command;
    let cwd = ROOT;
    if (task.type === 'npm') {
        command = `npm run ${task.script}`;
        cwd = path.join(ROOT, task.path ?? '');
    } else if (task.type === 'shell') {
        command = task.command;
        cwd = (task.options && task.options.cwd) || ROOT;
    } else if (!task.type && task.dependsOn) {
        return left;
    } else {
        throw new Error(`task "${label}": type ${task.type} not supported`);
    }
    process.stdout.write(`    task "${label}": ${command}\n`);
    if (task.isBackground) {
        const end = endPatternOf(task);
        let ready;
        const done = new Promise((r) => (ready = r));
        const child = start(command, [], { cwd, shell: true, env: cleanEnv() }, (line) => {
            if (end.test(line)) {
                ready(true);
            }
        });
        child.on('exit', () => ready(false));
        const ok = await Promise.race([done, new Promise((r) => setTimeout(() => r(false), 600_000))]);
        if (!ok) {
            stop(child);
            throw new Error(`background task "${label}" did not report a finished build`);
        }
        left.push(child);
        return left;
    }
    const child = start(command, [], { cwd, shell: true, env: cleanEnv() });
    const code = await exited(child, 900_000);
    if (code !== 0) {
        throw new Error(`task "${label}" exited with ${code}`);
    }
    return left;
}

// ── Inspector ────────────────────────────────────────────────────

function getJson(port) {
    return new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port, path: '/json/list', timeout: 2000 }, (res) => {
            let body = '';
            res.on('data', (d) => (body += d));
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch {
                    resolve(undefined);
                }
            });
        });
        req.on('error', () => resolve(undefined));
        req.on('timeout', () => {
            req.destroy();
            resolve(undefined);
        });
    });
}

async function waitTargets(port, ms) {
    const until = Date.now() + ms;
    while (Date.now() < until) {
        const targets = await getJson(port);
        if (Array.isArray(targets) && targets.length > 0) {
            return targets;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    return undefined;
}

/** Attach like a debugger: open the target's WebSocket and evaluate `expression` in it. */
function evaluate(target, expression) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(target.webSocketDebuggerUrl);
        const timer = setTimeout(() => {
            ws.close();
            reject(new Error('inspector did not answer'));
        }, 10_000);
        ws.onopen = () =>
            ws.send(
                JSON.stringify({
                    id: 1,
                    method: 'Runtime.evaluate',
                    params: { expression, returnByValue: true },
                })
            );
        ws.onmessage = (event) => {
            const msg = JSON.parse(String(event.data));
            if (msg.id === 1) {
                clearTimeout(timer);
                ws.close();
                resolve(msg.result && msg.result.result ? msg.result.result.value : undefined);
            }
        };
        ws.onerror = () => {
            clearTimeout(timer);
            reject(new Error('inspector WebSocket failed'));
        };
    });
}

async function attach(port, expect, ms = 120_000) {
    const targets = await waitTargets(port, ms);
    if (!targets) {
        throw new Error(`no inspector on port ${port}`);
    }
    const value = await evaluate(targets[0], "process.argv.join(' ')");
    if (typeof value !== 'string' || !expect.test(value)) {
        throw new Error(`port ${port}: evaluated in an unexpected process: ${value}`);
    }
    return value;
}

// ── VS Code ──────────────────────────────────────────────────────

async function vscodeExecutable() {
    const { downloadAndUnzipVSCode } = require(
        path.join(ROOT, 'node_modules', '@vscode', 'test-electron')
    );
    return downloadAndUnzipVSCode({ cachePath: path.join(EXT, '.vscode-test') });
}

function profileArgs(tmp) {
    return [
        `--user-data-dir=${path.join(tmp, 'user-data')}`,
        `--extensions-dir=${path.join(tmp, 'extensions')}`,
        '--disable-workspace-trust',
        '--skip-welcome',
        '--skip-release-notes',
    ];
}

function findServerPid(marker, ms) {
    const until = Date.now() + ms;
    return new Promise((resolve) => {
        const look = () => {
            const ps = cp.spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8' });
            const line = (ps.stdout || '')
                .split('\n')
                .find((l) => l.includes(marker) && l.includes('server-main.js'));
            if (line) {
                resolve(Number(line.trim().split(/\s+/)[0]));
            } else if (Date.now() > until) {
                resolve(undefined);
            } else {
                setTimeout(look, 500);
            }
        };
        look();
    });
}

// ── Checks ───────────────────────────────────────────────────────

async function checkNode(config, resolve) {
    const c = resolve(config);
    const child = start(process.execPath, [c.program, ...(c.args ?? [])], {
        cwd: c.cwd ?? ROOT,
        env: cleanEnv(c.env),
    });
    const code = await exited(child, 1_800_000);
    if (code !== 0) {
        throw new Error(`exited with ${code}`);
    }
    return 'exit 0';
}

async function checkHost(config, resolve, exe) {
    const c = resolve(config);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-launch-'));
    try {
        const testRun = c.args.some((a) => a.startsWith('--extensionTestsPath'));
        // The configuration's own --user-data-dir (the corpus profile) wins over the scratch one.
        const own = c.args.some((a) => a.startsWith('--user-data-dir'));
        const args = [...c.args, ...profileArgs(tmp).filter((a) => !(own && a.startsWith('--user-data-dir')))];
        if (testRun) {
            const child = start(exe, args, { env: cleanEnv(c.env) });
            const code = await exited(child, 1_800_000);
            if (code !== 0) {
                throw new Error(`tests exited with ${code}`);
            }
            return 'tests passed (exit 0)';
        }
        const hostPort = 5871;
        const child = start(exe, [...args, `--inspect-extensions=${hostPort}`], {
            env: cleanEnv(c.env),
        });
        try {
            await attach(hostPort, /extensionHost|bootstrap-fork|--type=extensionHost/i);
            const server = await attach(SERVER_PORT, /server-main\.js/);
            return `extension host inspector answered; language server attached on ${SERVER_PORT} (${path.basename(server.split(' ')[1] ?? '')})`;
        } finally {
            stop(child);
            await exited(child, 15_000);
        }
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

/** The main-instance scenarios of the 9229 and 5870 attach configurations. */
async function checkMainInstance(port, exe) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-launch-'));
    const extensions = path.join(tmp, 'extensions');
    fs.mkdirSync(extensions, { recursive: true });
    fs.writeFileSync(path.join(extensions, 'extensions.json'), '[]');
    const link = cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'dev-link.js'), 'link', '--dir', extensions], {
        encoding: 'utf8',
    });
    if (link.status !== 0) {
        throw new Error(`dev-link: ${link.stderr}`);
    }
    const args = [path.join(ROOT, 'example mod'), ...profileArgs(tmp)];
    if (port === 5870) {
        args.push('--inspect-extensions=5870');
    }
    const child = start(exe, args, { env: cleanEnv() });
    try {
        if (port === 5870) {
            await attach(5870, /extensionHost|bootstrap-fork|--type=extensionHost/i);
            return 'linked build in a main instance: extension host attached on 5870';
        }
        const pid = await findServerPid('cyborgninja21.ck3-language-support-dev', 120_000);
        if (!pid) {
            throw new Error('the linked language server did not start');
        }
        if (process.platform === 'win32') {
            cp.spawnSync(process.execPath, ['-e', `process._debugProcess(${pid})`]);
        } else {
            process.kill(pid, 'SIGUSR1');
        }
        await attach(9229, /server-main\.js/, 30_000);
        return `linked build in a main instance: server pid ${pid} opened its inspector on SIGUSR1, attached on 9229`;
    } finally {
        stop(child);
        await exited(child, 15_000);
        cp.spawnSync(process.execPath, [path.join(ROOT, 'tools', 'dev-link.js'), 'unlink', '--dir', extensions]);
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

function corpusRecords(config, resolve) {
    const c = resolve(config);
    const env = c.env ?? {};
    const slug = env.CK3_CORPUS_SLUG ?? (c.args ?? []).slice(-1)[0];
    const file = path.join(ROOT, 'packages', 'engine', 'test', 'corpus', 'real-mods', `${slug}.counts.json`);
    return fs.existsSync(file) ? { file, bytes: fs.readFileSync(file) } : undefined;
}

function missingInputFolder(config, launch) {
    const text = JSON.stringify(config);
    for (const input of launch.inputs ?? []) {
        if (text.includes(`\${input:${input.id}}`) && input.type === 'promptString' && !fs.existsSync(input.default)) {
            return input.default;
        }
    }
    return undefined;
}

async function main() {
    const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : undefined;
    const launch = readJsonc(path.join(ROOT, '.vscode', 'launch.json'));
    const tasks = readJsonc(path.join(ROOT, '.vscode', 'tasks.json')).tasks;
    const configs = launch.configurations;
    if (process.argv.includes('--list')) {
        configs.forEach((c) => process.stdout.write(`${c.type}/${c.request}\t${c.name}\n`));
        return 0;
    }
    const exe = await vscodeExecutable();
    const results = new Map();
    for (const config of configs) {
        if (only && !config.name.includes(only)) {
            continue;
        }
        process.stdout.write(`\n▶ ${config.name}\n`);
        const sample = /Current File/.test(config.name)
            ? /Engine/.test(config.name)
                ? SAMPLE_FILES.engine
                : SAMPLE_FILES.unit
            : undefined;
        const resolve = makeResolver(launch.inputs, sample);
        const missing = missingInputFolder(config, launch);
        if (missing) {
            results.set(config.name, { status: 'skipped', detail: `${missing} does not exist` });
            continue;
        }
        const record = /Corpus/.test(config.name) ? corpusRecords(config, resolve) : undefined;
        let background = [];
        try {
            if (config.preLaunchTask) {
                background = await runTask(tasks, config.preLaunchTask, resolve);
            }
            let detail;
            if (config.request === 'attach') {
                detail =
                    config.port === SERVER_PORT
                        ? 'checked by every Extension Development Host launch (attach on 6009)'
                        : await checkMainInstance(config.port, exe);
                if (config.port === SERVER_PORT) {
                    const host = configs.find((x) => x.type === 'extensionHost' && results.get(x.name)?.status === 'passed');
                    if (!host) {
                        throw new Error('no Extension Development Host launch passed before it');
                    }
                }
            } else if (config.type === 'node') {
                detail = await checkNode(config, resolve);
            } else if (config.type === 'extensionHost') {
                detail = await checkHost(config, resolve, exe);
            } else {
                throw new Error(`type ${config.type} not supported`);
            }
            results.set(config.name, { status: 'passed', detail });
        } catch (e) {
            results.set(config.name, { status: 'FAILED', detail: e.message });
            process.stdout.write(log.slice(-40).join('\n') + '\n');
        } finally {
            background.forEach(stop);
            await Promise.all(background.map((b) => exited(b, 15_000)));
            if (record) {
                fs.writeFileSync(record.file, record.bytes);
            }
        }
        process.stdout.write(`  ${results.get(config.name).status}: ${results.get(config.name).detail}\n`);
    }
    for (const compound of launch.compounds ?? []) {
        if (only && !compound.name.includes(only)) {
            continue;
        }
        const states = compound.configurations.map((n) => results.get(n)?.status ?? 'not run');
        const ok = states.every((s) => s === 'passed');
        results.set(compound.name, {
            status: ok ? 'passed' : 'FAILED',
            detail: compound.configurations.map((n, i) => `${n}: ${states[i]}`).join('; '),
        });
    }
    process.stdout.write('\nSummary\n');
    for (const [name, r] of results) {
        process.stdout.write(`  ${r.status.padEnd(7)} ${name} — ${r.detail}\n`);
    }
    return [...results.values()].some((r) => r.status === 'FAILED') ? 1 : 0;
}

main()
    .then((code) => {
        running.forEach(stop);
        process.exit(code);
    })
    .catch((e) => {
        process.stderr.write(`${e.stack ?? e}\n`);
        running.forEach(stop);
        process.exit(1);
    });
