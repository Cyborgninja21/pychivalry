/**
 * A finding of the core as a protocol diagnostic (docs/PLAN.md item 7.4). Nothing is decided
 * here: the code, the severity, the message, the range and the evidence are the finding's own,
 * so the editor shows what the command line prints.
 *
 * - **Range:** the finding's, as it is: the core counts lines and characters from 0, the
 *   character in UTF-16 code units, which is the protocol's default position encoding.
 * - **Severity:** error, warning, information or hint, the finding's own; advice is
 *   information or a hint already (docs/MVP.md, principle 1).
 * - **Code:** the finding's code, linked to its family's section of the check page of the
 *   project's wiki, which lists every code with its evidence.
 * - **Evidence and data:** in the diagnostic's `data`, for a quick fix (build step 8) or an
 *   agent; the message is the game's own text where the evidence is a catalogue message.
 */

import { familyOf, type WorkspaceFinding } from '@pychivalry/core';
import { DiagnosticSeverity, type Diagnostic } from 'vscode-languageserver/node';

/** The name the editor shows as a diagnostic's source. */
export const DIAGNOSTIC_SOURCE = 'pychivalry';

/** The check page of the project's wiki, built from docs/guide/checks.md. */
export const CHECK_PAGE = 'https://github.com/Cyborgninja21/pychivalry/wiki/Checks';

const SEVERITY: Readonly<Record<WorkspaceFinding['severity'], DiagnosticSeverity>> = {
    error: DiagnosticSeverity.Error,
    warning: DiagnosticSeverity.Warning,
    information: DiagnosticSeverity.Information,
    hint: DiagnosticSeverity.Hint,
};

/** What a diagnostic carries in `data`: the finding's evidence and its values. */
export interface DiagnosticData {
    readonly evidence: WorkspaceFinding['evidence'];
    readonly data: WorkspaceFinding['data'];
}

/** Where the check page documents a code: its family's section. */
export function checkPageOf(code: string): string {
    return `${CHECK_PAGE}#${familyOf(code)}`;
}

/** One finding as a diagnostic. */
export function toDiagnostic(finding: WorkspaceFinding): Diagnostic {
    const data: DiagnosticData = { evidence: finding.evidence, data: finding.data };
    return {
        range: {
            start: { line: finding.range.start.line, character: finding.range.start.character },
            end: { line: finding.range.end.line, character: finding.range.end.character },
        },
        severity: SEVERITY[finding.severity],
        code: finding.code,
        codeDescription: { href: checkPageOf(finding.code) },
        source: DIAGNOSTIC_SOURCE,
        message: finding.message,
        data,
    };
}
