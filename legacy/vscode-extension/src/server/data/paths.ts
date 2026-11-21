/**
 * Where the optional game-content data lives: `data/` next to the bundled server
 * (dist/data/), or the repository's data/ when running from out/ (tests, development).
 */

import * as fs from 'fs';
import * as path from 'path';

/** Directories looked in for data/, most specific first. */
export function dataDirCandidates(): string[] {
    return [
        path.join(__dirname, 'data'),
        path.join(__dirname, '..', 'data'),
        path.join(__dirname, '..', '..', '..', 'data'),
        path.join(__dirname, '..', '..', '..', '..', 'data'),
        path.join(process.cwd(), 'data'),
    ];
}

/** Entries that mark a directory as the extension's data/ (any one of them). */
const MARKERS = ['mods', 'traits', 'concepts', 'icons', 'animations.yaml'];

/** The first candidate holding the extension's data (see MARKERS), or undefined. */
export function findDataDir(preferred?: string): string | undefined {
    for (const dir of preferred ? [preferred, ...dataDirCandidates()] : dataDirCandidates()) {
        try {
            const entries = fs.readdirSync(dir);
            if (MARKERS.some((m) => entries.includes(m))) {
                return dir;
            }
        } catch {
            // not there
        }
    }
    return undefined;
}
