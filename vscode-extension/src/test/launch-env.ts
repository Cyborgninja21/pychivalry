/**
 * The environment of a VS Code that a test runner starts (runTest.ts, vsix/runVsix.ts). A
 * terminal, task or agent started from inside VS Code inherits ELECTRON_RUN_AS_NODE and the
 * VSCODE_* variables of that VS Code: with ELECTRON_RUN_AS_NODE the downloaded VS Code starts
 * as plain Node and fails with "Cannot find module <workspace folder>", and the VSCODE_*
 * variables point at the launching instance (its IPC socket, pid, working directory and
 * compile cache). tools/launch-check.js applies the same rule (cleanEnv).
 */

/**
 * Those variables, each mapped to undefined. Merged over process.env (the extensionTestsEnv
 * of runTests, or a spawn environment), an undefined value removes the variable from the
 * launched process.
 */
export function launchingInstanceVariables(): Record<string, undefined> {
    const unset: Record<string, undefined> = {};
    for (const name of Object.keys(process.env)) {
        if (name === 'ELECTRON_RUN_AS_NODE' || name.startsWith('VSCODE_')) {
            unset[name] = undefined;
        }
    }
    return unset;
}
