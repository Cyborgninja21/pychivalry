import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

/** The real-mod corpus (post-2.0 Phase 1): the mods the editor-path record covers. */
const CORPUS_SLUGS = [
    'balance-of-power-ui',
    'divine-intervention',
    'elf-destiny',
    'rice',
    'viet-events',
];

/**
 * A fresh user-data directory per run: the configuration tests write user settings,
 * and the default shared directory (.vscode-test/user-data) carried them from one run
 * into the next, so results varied between runs. It lives under the OS temp directory
 * because VS Code puts its IPC socket there, and a socket path under the checkout
 * exceeds the 104-byte limit on macOS (listen EINVAL).
 */
function userDataDir(settings?: Record<string, unknown>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-vsc-'));
    if (settings) {
        fs.mkdirSync(path.join(dir, 'User'), { recursive: true });
        fs.writeFileSync(
            path.join(dir, 'User', 'settings.json'),
            JSON.stringify(settings, null, 4)
        );
    }
    return dir;
}

/**
 * The real-mod corpus suite (src/test/corpus): with CK3_CORPUS pointing at the corpus
 * folder (one sub-folder per mod slug), each mod present is opened as the workspace of
 * its own Extension Development Host, with ck3LanguageServer.gamePath = CK3_GAME_PATH
 * (Steam detection when unset), and its editor-path record is written next to the
 * engine-path one. Skipped, not failed, when CK3_CORPUS is unset or the folder is absent.
 */
async function runCorpus(extensionDevelopmentPath: string): Promise<void> {
    const corpus = process.env.CK3_CORPUS;
    if (!corpus) {
        console.log('Real-mod corpus suite skipped (CK3_CORPUS is not set)');
        return;
    }
    if (!fs.existsSync(corpus)) {
        console.log(`Real-mod corpus suite skipped (${corpus} does not exist)`);
        return;
    }
    const out = path.resolve(
        extensionDevelopmentPath,
        '..',
        'packages',
        'engine',
        'test',
        'corpus',
        'real-mods'
    );
    const wanted = process.env.CK3_CORPUS_SLUGS
        ? process.env.CK3_CORPUS_SLUGS.split(',')
        : CORPUS_SLUGS;
    for (const slug of wanted) {
        const modDir = path.join(corpus, slug);
        if (!fs.existsSync(modDir)) {
            console.log(`Real-mod corpus: ${slug} skipped (not in ${corpus})`);
            continue;
        }
        const dataDir = userDataDir({
            'ck3LanguageServer.gamePath': process.env.CK3_GAME_PATH ?? '',
            // The largest mod (RICE, 1,313 script + 777 localization files) is above the
            // default ceiling of 2000; the acceptance run validates every file.
            'ck3LanguageServer.backgroundValidation.fileLimit': 100000,
        });
        try {
            console.log(`Real-mod corpus: ${slug}`);
            await runTests({
                extensionDevelopmentPath,
                extensionTestsPath: path.resolve(__dirname, './corpus/index'),
                extensionTestsEnv: { CK3_CORPUS_SLUG: slug, CK3_CORPUS_OUT: out },
                launchArgs: [
                    modDir,
                    '--disable-extensions',
                    '--disable-workspace-trust',
                    `--user-data-dir=${dataDir}`,
                ],
            });
        } finally {
            fs.rmSync(dataDir, { recursive: true, force: true });
        }
    }
}

async function main() {
    const dataDir = userDataDir();
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    try {
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
                `--user-data-dir=${dataDir}`,
            ],
        });
        await runCorpus(extensionDevelopmentPath);
    } catch (err) {
        console.error('Failed to run tests:', err);
        process.exitCode = 1;
    } finally {
        fs.rmSync(dataDir, { recursive: true, force: true });
    }
}

main();
