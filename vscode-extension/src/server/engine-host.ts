/**
 * Where the extension gets its CK3 knowledge: the pychivalry-engine spec package.
 *
 * The webpack bundle copies the engine's dist/data/ (the gzipped spec package and its
 * checksum) to dist/data/engine/; the unit tests run from out/ and resolve the workspace
 * package instead. Whichever is found becomes the engine's process default so that every
 * engine fallback (parser messages, Workspace) uses the same package.
 */

import * as fs from 'fs';
import * as path from 'path';
import { defaultSpec, loadSpec, setDefaultSpec, Spec } from 'pychivalry-engine';

let loaded: Spec | undefined;

/** The spec package shipped with the extension, loaded once. */
export function bundledSpec(): Spec {
    if (!loaded) {
        const bundled = path.join(__dirname, 'data', 'engine', 'ck3-spec.json.gz');
        loaded = fs.existsSync(bundled) ? loadSpec(bundled) : defaultSpec();
        setDefaultSpec(loaded);
    }
    return loaded;
}
