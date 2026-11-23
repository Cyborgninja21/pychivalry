/**
 * The bundled command line's entry point (docs/PLAN.md, item 7.7): pychivalry's command line,
 * `@pychivalry/cli`, unchanged, with the spec package the extension ships beside it as its
 * default (`spec/`, beside this file in the server folder), where the command line run from the
 * repository reads the repository's `spec/`. `bundle.ts` bundles it into
 * `dist/bundle/server/pychivalry-cli.mjs`, which the terminal's `pychivalry` runs on VS Code's
 * own runtime (`terminal.ts`).
 */

import { processIo, run } from '@pychivalry/cli';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SPEC_FOLDER } from './launch.js';

const here = path.dirname(fileURLToPath(import.meta.url));
process.exitCode = run(process.argv.slice(2), {
    ...processIo(),
    specDir: path.join(here, SPEC_FOLDER),
});
