/**
 * The shipped-VSIX smoke suite (#39): the extension as a user gets it, not the development
 * path. `task test:vsix` packages the extension first; this runner then
 *
 *   1. downloads (or reuses) a VS Code under .vscode-test/,
 *   2. installs the VSIX with `code --install-extension` into a fresh, empty extensions
 *      folder and user-data folder,
 *   3. starts that VS Code on `example mod/` with the smoke tests (src/test/vsix/smoke.test.ts),
 *      whose Extension Development Host is an empty harness extension, so the CK3 extension
 *      is the installed copy and nothing loads from vscode-extension/.
 *
 * `--linked` (task test:dev-link) runs the same tests against the development build linked
 * into the fresh extensions folder by tools/dev-link.js (task dev:link), which is how the
 * extension loads in the main VS Code instance (#35).
 *
 *   node out/test/vsix/runVsix.js [--linked] [--vsix <file>]
 *
 * CK3_VSIX names the VSIX (default: ck3-language-support-<package.json version>.vsix).
 * On headless Linux run it under `xvfb-run -a`; from a VS Code terminal unset
 * ELECTRON_RUN_AS_NODE and the VSCODE_* variables first (see the corpus README).
 */

import * as cp from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests, runVSCodeCommand } from '@vscode/test-electron';

const EXTENSION_ROOT = path.resolve(__dirname, '../../../');
const REPO_ROOT = path.resolve(EXTENSION_ROOT, '..');

function readVersion(): string {
    const pkg: unknown = JSON.parse(
        fs.readFileSync(path.join(EXTENSION_ROOT, 'package.json'), 'utf8')
    );
    const version = typeof pkg === 'object' && pkg !== null ? Reflect.get(pkg, 'version') : '';
    if (typeof version !== 'string' || version === '') {
        throw new Error('vscode-extension/package.json has no version');
    }
    return version;
}

function argValue(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
    const linked = process.argv.includes('--linked');
    const version = readVersion();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-smoke-'));
    const extensionsDir = path.join(tmp, 'extensions');
    const userDataDir = path.join(tmp, 'user-data');
    fs.mkdirSync(extensionsDir);
    fs.mkdirSync(userDataDir);
    const spawnEnv = { ...process.env, DONT_PROMPT_WSL_INSTALL: '1' };
    try {
        if (linked) {
            // A folder VS Code has used holds an extensions.json, and VS Code then lists only
            // what it names: start from that case, so the test proves dev-link registers.
            fs.writeFileSync(path.join(extensionsDir, 'extensions.json'), '[]');
            const result = cp.spawnSync(
                process.execPath,
                [path.join(REPO_ROOT, 'tools', 'dev-link.js'), 'link', '--dir', extensionsDir],
                { encoding: 'utf8' }
            );
            process.stdout.write(result.stdout ?? '');
            if (result.status !== 0) {
                throw new Error(`dev-link failed: ${result.stderr}`);
            }
        } else {
            const vsix = path.resolve(
                argValue('--vsix') ??
                    process.env.CK3_VSIX ??
                    path.join(EXTENSION_ROOT, `ck3-language-support-${version}.vsix`)
            );
            if (!fs.existsSync(vsix)) {
                throw new Error(`${vsix} does not exist: run \`npm run package\` first`);
            }
            const size = fs.statSync(vsix).size;
            process.stdout.write(`Installing ${path.basename(vsix)} (${size} bytes)\n`);
            const out = await runVSCodeCommand(
                [
                    '--install-extension',
                    vsix,
                    '--extensions-dir',
                    extensionsDir,
                    '--user-data-dir',
                    userDataDir,
                ],
                { spawn: { env: spawnEnv } }
            );
            process.stdout.write(out.stdout);
        }
        const installed = fs.readdirSync(extensionsDir);
        process.stdout.write(`Extensions folder: ${installed.join(', ')}\n`);

        await runTests({
            // An empty harness extension: the host needs a development path, and the CK3
            // extension must come from the extensions folder, not from vscode-extension/.
            extensionDevelopmentPath: path.join(EXTENSION_ROOT, 'src', 'test', 'vsix', 'harness'),
            extensionTestsPath: path.resolve(__dirname, './index'),
            extensionTestsEnv: {
                CK3_SMOKE_MODE: linked ? 'linked' : 'vsix',
                CK3_SMOKE_EXTENSIONS_DIR: extensionsDir,
                CK3_SMOKE_DEV_PATH: EXTENSION_ROOT,
                CK3_SMOKE_VERSION: version,
            },
            launchArgs: [
                path.join(REPO_ROOT, 'example mod'),
                `--extensions-dir=${extensionsDir}`,
                `--user-data-dir=${userDataDir}`,
                '--disable-workspace-trust',
            ],
        });
    } finally {
        if (linked) {
            cp.spawnSync(process.execPath, [
                path.join(REPO_ROOT, 'tools', 'dev-link.js'),
                'unlink',
                '--dir',
                extensionsDir,
            ]);
        }
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

main().catch((err) => {
    console.error('VSIX smoke suite failed:', err);
    process.exitCode = 1;
});
