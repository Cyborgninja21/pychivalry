/**
 * Helpers for the tests: the committed spec package, read once per test process. Not part of
 * the package's public surface.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openSpec, type Spec } from './reader.js';

/** The repository root: compiled tests live in `packages/core/dist/<folder>/`. */
export const REPO_ROOT = path.resolve(fileURLToPath(new URL('../../../../', import.meta.url)));

/** The committed spec package, `spec/ck3-spec-<version>.json.gz`, read and checked once. */
export function committedSpec(): Spec {
    return openSpec(path.join(REPO_ROOT, 'spec'));
}
