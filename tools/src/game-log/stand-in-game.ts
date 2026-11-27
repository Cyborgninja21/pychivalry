/**
 * A stand-in for the game, for the capture's tests only: never the game, and nothing like it but
 * what the capture watches. Started as `node stand-in-game.js <user dir> [--exit] [options]`, it
 * reads `dlc_load.json` and the descriptors it names, writes `logs/error.log` (a line for each
 * file of an enabled mod that holds the word `stand_in_defect`, written from the catalogue's
 * `Error: "%s" in file: "%s" near line: %d` with the message `Unknown trigger '%s'`) and
 * `logs/debug.log`, then waits to be stopped, or, with `--exit`, ends by itself.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function filesUnder(dir: string, rel = ''): string[] {
    return readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
        const r = rel === '' ? e.name : `${rel}/${e.name}`;
        return e.isDirectory() ? filesUnder(dir, r) : [r];
    });
}

function main(): void {
    const [userDir, ...rest] = process.argv.slice(2);
    if (userDir === undefined) {
        process.exit(2);
    }
    const list = JSON.parse(readFileSync(path.join(userDir, 'dlc_load.json'), 'utf8')) as {
        enabled_mods?: string[];
    };
    const errors: string[] = [];
    for (const descriptor of list.enabled_mods ?? []) {
        const text = readFileSync(path.join(userDir, descriptor), 'utf8');
        const dir = /^path="([^"]*)"/m.exec(text)?.[1];
        if (dir === undefined || !statSync(dir).isDirectory()) {
            continue;
        }
        for (const file of filesUnder(dir)) {
            if (readFileSync(path.join(dir, file), 'utf8').includes('stand_in_defect')) {
                errors.push(
                    `Error: "Unknown trigger 'stand_in_defect'" in file: "${file}" near line: 1`,
                );
            }
        }
    }
    const logs = path.join(userDir, 'logs');
    mkdirSync(logs, { recursive: true });
    writeFileSync(path.join(logs, 'error.log'), errors.map((e) => `${e}\n`).join(''));
    writeFileSync(
        path.join(logs, 'debug.log'),
        `stand-in started with ${rest.join(' ')}, reading ${path.join(userDir, 'dlc_load.json')}\n`,
    );
    if (rest.includes('--exit')) {
        return;
    }
    setInterval(() => undefined, 1000);
}

main();
