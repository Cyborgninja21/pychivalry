/**
 * Optional, user-extracted trait data (data/traits/*.yaml, written by
 * tools/extract-traits.ts from a CK3 install). Traits are game content, not engine
 * vocabulary: the spec package has no trait list, so the unknown-trait plug-in (CK3800)
 * runs only when this data is present.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { dataDirCandidates } from './paths';

/**
 * Trait names from data/traits/*.yaml (a mapping `name: {...}` per file, or a list of
 * `{ id }` entries), or undefined when no trait file is present.
 */
export function loadExtractedTraits(dataDir?: string): Set<string> | undefined {
    const dirs = dataDir ? [dataDir] : dataDirCandidates();
    for (const dir of dirs) {
        const traitsDir = path.join(dir, 'traits');
        let files: string[];
        try {
            files = fs.readdirSync(traitsDir).filter((f) => f.endsWith('.yaml'));
        } catch {
            continue;
        }
        const names = new Set<string>();
        for (const file of files) {
            const data: unknown = yaml.load(fs.readFileSync(path.join(traitsDir, file), 'utf8'));
            if (Array.isArray(data)) {
                for (const entry of data) {
                    if (entry && typeof entry === 'object' && 'id' in entry) {
                        names.add(String((entry as { id: unknown }).id));
                    }
                }
            } else if (data && typeof data === 'object') {
                for (const name of Object.keys(data)) {
                    names.add(name);
                }
            }
        }
        if (names.size > 0) {
            return names;
        }
    }
    return undefined;
}
