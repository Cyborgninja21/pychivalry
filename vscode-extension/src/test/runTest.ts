import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    // A fresh user-data directory per run: the configuration tests write user settings,
    // and the default shared directory (.vscode-test/user-data) carried them from one
    // run into the next, so results varied between runs. It lives under the OS temp
    // directory because VS Code puts its IPC socket there, and a socket path under the
    // checkout exceeds the 104-byte limit on macOS (listen EINVAL).
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-vsc-'));
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // The path to the test workspace
        const testWorkspacePath = path.resolve(__dirname, '../../test-workspace');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                testWorkspacePath,
                '--disable-extensions', // Disable other extensions for clean testing
                `--user-data-dir=${userDataDir}`,
            ],
        });
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exitCode = 1;
    } finally {
        fs.rmSync(userDataDir, { recursive: true, force: true });
    }
}

main();
