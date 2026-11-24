/**
 * `style/not-utf8` (the family `style`, pychivalry's own best-practice rules): a file that is not
 * valid UTF-8, as a warning with a fix that converts it, on the owner's word of 2026-11-23.
 *
 * How it stands beside `encoding/not-utf8` (docs/encoding.md): the parser's note stays as it
 * was signed off, information, and says how the file was read; this is the one actionable
 * finding, at the same place (the file's first invalid byte), and says what to do. A file is
 * therefore never told twice to do something: the note describes the reading, this asks for
 * the conversion, and the conversion takes both away.
 *
 * It reads the stretches the decoder recorded on its note (`invalid`), so it needs the file's
 * bytes: for text an editor holds that is not what the file holds, there are none to judge.
 * Its fix (`fix/encoding.ts`) writes the file as UTF-8 with the byte-order mark, each invalid
 * stretch read as Windows-1252.
 */

import type { InvalidStretch } from '../syntax/findings.js';
import type { LineIndex } from '../syntax/position.js';
import type { AdviceResult } from './advice.js';
import type { CheckFinding } from './finding.js';
import { finding, type CheckContext } from './report.js';
import type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';

export const CODE = 'style/not-utf8';

/** The most distinct letters a finding lists in its data. */
const MAX_LETTERS = 20;

/** The finding for a file's invalid stretches, or none when it has none. */
export function notUtf8Finding(
    invalid: readonly InvalidStretch[],
    context: CheckContext & { readonly lines: LineIndex },
): CheckFinding | null {
    const first = invalid[0];
    if (first === undefined) {
        return null;
    }
    const bytes = invalid.reduce((n, s) => n + s.windows1252.length, 0);
    // One character a byte, each in the Basic Multilingual Plane (Windows-1252).
    const letters = [...new Set(invalid.flatMap((s) => Array.from(s.windows1252)))];
    return finding(
        CODE,
        first,
        [String(bytes)],
        {
            invalid_bytes: String(bytes),
            stretches: String(invalid.length),
            windows_1252: letters.slice(0, MAX_LETTERS),
        },
        context,
    );
}

function run(input: BestPracticeInput): AdviceResult {
    const found = notUtf8Finding(input.invalid, input.context);
    return { judged: 1, findings: found === null ? [] : [found] };
}

export const check: BestPracticeCheck = { code: CODE, run };
