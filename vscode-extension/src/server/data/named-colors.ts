/**
 * The texts of the named-colour files (`common/named_colors/*.txt`) of the base game and the
 * workspace's mods, for the colour provider's NamedColorTable (`color1 = white` swatches).
 */

import { promises as fsp } from 'fs';
import * as path from 'path';

/**
 * `<root>/common/named_colors/*.txt` of every root, in `roots` order and by file name within
 * a root (pass the base game first: later definitions override earlier ones). Missing
 * folders are skipped.
 */
export async function readNamedColorTexts(roots: string[]): Promise<string[]> {
    const texts: string[] = [];
    for (const root of roots) {
        const dir = path.join(root, 'common', 'named_colors');
        let names: string[];
        try {
            names = (await fsp.readdir(dir)).filter((n) => /\.txt$/i.test(n));
        } catch {
            continue;
        }
        for (const name of names.sort()) {
            texts.push(await fsp.readFile(path.join(dir, name), 'utf-8'));
        }
    }
    return texts;
}
