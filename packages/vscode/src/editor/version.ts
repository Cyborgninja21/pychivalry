/**
 * The VS Code the editor tests run in: the release installed where they were written. Its own
 * file, with nothing else in it, so a unit test reads it without starting the runner; public
 * CI's cache of the downloaded VS Code is keyed by it (`.github/workflows/ci.yml`, a test holds
 * the two together).
 */
export const VSCODE_VERSION = '1.147.0';
