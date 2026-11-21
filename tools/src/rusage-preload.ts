/**
 * Preloaded with `node --import` into a process whose peak memory a baseline measures: at
 * exit it writes `process.resourceUsage()` as JSON to the file `PYCH_RUSAGE_OUT` names.
 * Used for release 2.3.0's vanilla-acceptance script, which reports its times but not its
 * memory.
 */

import { writeFileSync } from 'node:fs';

const out = process.env['PYCH_RUSAGE_OUT'];
if (out !== undefined && out !== '') {
    process.on('exit', () => {
        writeFileSync(out, JSON.stringify(process.resourceUsage()));
    });
}
