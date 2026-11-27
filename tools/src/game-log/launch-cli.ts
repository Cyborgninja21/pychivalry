/**
 * The two commands that launch the game (docs/game-log-capture.md): `game capture-log`, one
 * capture of item 11.1, and `scored in-game-load`, one result of the authoring run through the
 * in-game load of item 11.8. Only on the analysis machine, only on the owner's word: the guard
 * (`PYCHIVALRY_OWNERS_WORD`) is read before any other variable, path or file. Every folder is a
 * variable with no default, so nothing reaches a folder no one named.
 *
 * | Variable | Meaning |
 * | --- | --- |
 * | `PYCHIVALRY_OWNERS_WORD` | `decision <n>`: the row of docs/decisions.md recording the owner's word for a launch |
 * | `CK3_INSTALL_PATH` | The game's install folder (holding `binaries/` and `launcher/`) |
 * | `CK3_USER_PATH` | The user's game folder (holding `dlc_load.json`, `logs/` and `mod/`) |
 * | `CAPTURE_OUT` | A new folder for the captured logs and the record |
 * | `CAPTURE_MODS` | `game capture-log`: the mod folders to load, comma-separated; empty for the base game alone |
 * | `CAPTURE_OPTIONS` | The launch options, space-separated (`-debug_mode`); none by default |
 * | `SCORED_BASE`, `SCORED_RESULT` | `scored in-game-load`: the result's base mod and the result |
 */

import { homedir } from 'node:os';
import path from 'node:path';
import { capture } from './capture.js';
import { ownersWord, OWNERS_WORD_VARIABLE } from './guard.js';
import { inGameLoad } from './in-game-load.js';
import { CommandError, EXIT } from '../util.js';

type Env = Readonly<Record<string, string | undefined>>;

function required(env: Env, name: string): string {
    const value = env[name];
    if (value === undefined || value.trim() === '') {
        throw new CommandError(`${name} is required: no default is assumed`, EXIT.usage);
    }
    return path.resolve(value);
}

/** The game's executable in an install, as the spec work started it: directly. */
function executable(installDir: string): string {
    return path.join(installDir, 'binaries', process.platform === 'win32' ? 'ck3.exe' : 'ck3');
}

function common(root: string, env: Env) {
    // The guard first: nothing is read before it holds.
    const decisionsFile = path.join(root, 'docs', 'decisions.md');
    ownersWord(env[OWNERS_WORD_VARIABLE], decisionsFile);
    const installDir = required(env, 'CK3_INSTALL_PATH');
    return {
        ownersWord: env[OWNERS_WORD_VARIABLE],
        decisionsFile,
        installDir,
        start: { command: executable(installDir), args: [] },
        options: (env['CAPTURE_OPTIONS'] ?? '').split(/\s+/).filter((o) => o !== ''),
        userDir: required(env, 'CK3_USER_PATH'),
        home: homedir(),
        outDir: required(env, 'CAPTURE_OUT'),
        log: (line: string) => {
            process.stdout.write(`${line}\n`);
        },
    };
}

/** `game capture-log`. */
export async function captureFromEnv(root: string, env: Env): Promise<number> {
    const c = common(root, env);
    const mods = (env['CAPTURE_MODS'] ?? '')
        .split(',')
        .map((m) => m.trim())
        .filter((m) => m !== '')
        .map((m) => path.resolve(m));
    const record = await capture({ ...c, mods });
    process.stdout.write(
        `capture: ${record.ended} after ${String(record.seconds)} s; ${String(record.logs.length)} logs; mod list restored ${record.dlc_load.identical ? 'byte for byte' : 'NOT identical'}\n`,
    );
    // What the scrubber took out of each log kept, for the check before the logs are committed
    // (docs/game-log-capture.md, "Before the logs are committed").
    for (const log of record.logs) {
        const replaced = Object.entries(log.replaced)
            .map(([placeholder, count]) => `${placeholder} ${String(count)}`)
            .join(', ');
        process.stdout.write(
            `  ${log.name}: ${String(log.lines)} lines; replaced: ${replaced === '' ? 'nothing' : replaced}\n`,
        );
    }
    return record.dlc_load.identical && record.descriptors_removed && record.ended !== 'timeout'
        ? EXIT.ok
        : EXIT.failed;
}

/** `scored in-game-load`. */
export async function inGameLoadFromEnv(root: string, env: Env): Promise<number> {
    const c = common(root, env);
    const result = await inGameLoad({
        ...c,
        specDir: path.join(root, 'spec'),
        baseDir: required(env, 'SCORED_BASE'),
        resultDir: required(env, 'SCORED_RESULT'),
    });
    const g = result.grade;
    process.stdout.write(
        `in-game load: ${g.held ? 'held' : 'did not hold'}: ${String(g.added.length)} lines naming the result's ${String(g.files.length)} files added\n`,
    );
    for (const line of g.added) {
        process.stdout.write(
            `  ${line.file}: log line ${String(line.line)}: ${line.messages.join(' or ') || 'no catalogue message'}\n`,
        );
    }
    return g.held ? EXIT.ok : EXIT.failed;
}
