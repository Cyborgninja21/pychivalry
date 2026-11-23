/**
 * The game folder (docs/PLAN.md item 7.6): the setting `pychivalry.gamePath` when it is set,
 * otherwise the game found in any Steam library on Linux or Windows (the core's `find-game`).
 * Without a game the server stays silent about the names the game defines, as the command
 * line does (docs/MVP.md, "Lessons from 2.3.0"), and says so once. A game whose build is not
 * the spec package's is said once too.
 */

import { isGameFolder, readGameBuild } from '@pychivalry/core';
import path from 'node:path';

/** How the game folder was chosen, and what went wrong. */
export interface GameChoice {
    /** The game's `game` folder, or null to run without the base game. */
    readonly dir: string | null;
    /** `setting` when `pychivalry.gamePath` named it, `steam` when found in a Steam library. */
    readonly source: 'setting' | 'steam' | null;
    /**
     * Why there is none: `not-found` (no setting, and no Steam library holds the game),
     * `not-a-game` (the setting names a folder that is no game folder).
     */
    readonly problem: 'not-found' | 'not-a-game' | null;
}

/** The game folder, from the setting or the Steam libraries (`findGame`). */
export function chooseGame(setting: string, findGame: () => string | null): GameChoice {
    if (setting !== '') {
        const dir = path.resolve(setting);
        return isGameFolder(dir)
            ? { dir, source: 'setting', problem: null }
            : { dir: null, source: null, problem: 'not-a-game' };
    }
    const found = findGame();
    return found === null
        ? { dir: null, source: null, problem: 'not-found' }
        : { dir: found, source: 'steam', problem: null };
}

/** A message for the person, said at most once a session. */
export interface Notice {
    /** What makes two notices the same one. */
    readonly key: string;
    readonly severity: 'error' | 'warning' | 'information';
    readonly text: string;
}

/** What to tell the person about the game chosen and its build. */
export function gameNotices(choice: GameChoice, setting: string, specVersion: string): Notice[] {
    if (choice.problem === 'not-found') {
        return [
            {
                key: 'game:not-found',
                severity: 'warning',
                text: "pychivalry did not find Crusader Kings III in any Steam library. Set pychivalry.gamePath to the game's game folder (the one holding common/). Until then, names the game defines are not judged.",
            },
        ];
    }
    if (choice.problem === 'not-a-game') {
        const dir = path.resolve(setting);
        const inner = path.join(dir, 'game');
        return [
            {
                key: `game:not-a-game:${dir}`,
                severity: 'error',
                text: isGameFolder(inner)
                    ? `pychivalry.gamePath names the game's install folder, ${dir}; its game folder is ${inner}. Until it is set, names the game defines are not judged.`
                    : `pychivalry.gamePath names ${dir}, which is not the game's game folder (it has no common/ folder). Until it is set, names the game defines are not judged.`,
            },
        ];
    }
    if (choice.dir === null) {
        return [];
    }
    const build = readGameBuild(choice.dir);
    if (build !== null && build !== specVersion) {
        return [
            {
                key: `game:build:${build}:${specVersion}`,
                severity: 'warning',
                text: `The game is build ${build}; pychivalry's spec package is for ${specVersion}. Names that changed between the two may be judged wrongly.`,
            },
        ];
    }
    return [];
}
