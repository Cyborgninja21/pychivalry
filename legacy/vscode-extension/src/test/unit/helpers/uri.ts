/**
 * File URIs for unit tests that are valid on every platform.
 *
 * A literal like `file:///mod/events/a.txt` has no drive letter, so on Windows
 * `fileURLToPath` (used by the engine's uriToPath) rejects it. testUri resolves the
 * POSIX-style path against the current drive first; on Linux and macOS the result is
 * the same literal.
 */

import * as path from 'path';
import { pathToUri } from 'pychivalry-engine';

export function testUri(posixPath: string): string {
    return pathToUri(path.resolve(posixPath));
}
