import * as fs from 'fs';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to the extension test script
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // The path to the test workspace
        const testWorkspacePath = path.resolve(__dirname, '../../test-workspace');

        // A fresh user-data directory per run: the configuration tests write user settings,
        // and the default shared directory (.vscode-test/user-data) carried them from one
        // run into the next, so results varied between runs.
        const userDataDir = path.resolve(__dirname, '../../.vscode-test/user-data-integration');
        fs.rmSync(userDataDir, { recursive: true, force: true });

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
        process.exit(1);
    }
}

main();
