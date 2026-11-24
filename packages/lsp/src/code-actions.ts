/**
 * Quick fixes (docs/PLAN.md item 8.7): the code actions of a file's diagnostics, each made from
 * the fix data the core gives the finding (`WorkspaceFinding.fix`), so the editor offers what
 * the command line and the agent server report. Nothing is decided here.
 *
 * - **One action per alternative** of a diagnostic's fix, of the kind `quickfix`; a safe fix's
 *   one alternative is the preferred action (what the editor's "auto fix" applies).
 * - **Fix all of a kind:** where a file has more than one safe fix of a code, one more action
 *   applies all of them that do not overlap ("Fix every safe names/unknown-trigger in the
 *   file"). The `source.fixAll` action applies every safe fix of the file.
 * - **A diagnostic is matched** to the server's own finding by its code and range: a diagnostic
 *   the editor holds from before an edit the server has not checked yet matches nothing and
 *   gets no action.
 * - **The byte-order mark** is the file's encoding in VS Code, which the extension makes UTF-8
 *   with the mark for CK3 files, not text: a fix's insertion of the mark (U+FEFF at the start of
 *   the file, a `style/` fix) is left out of its workspace edit, and a fix that is nothing else
 *   is not offered. Saving the file writes the mark.
 * - **Edits in other files and new files:** an alternative that edits another file of the mod
 *   (a localization stub) edits it by its URI; one that creates a file is offered only to an
 *   editor that can create files in a workspace edit (`workspace.workspaceEdit.
 *   resourceOperations` with `create`), and then as document changes.
 */

import {
    overlapsAny,
    type FixAlternative,
    type FixEdit,
    type WorkspaceFinding,
} from '@pychivalry/core';
import {
    CodeActionKind,
    type CodeAction,
    type CodeActionParams,
    type Diagnostic,
    type TextEdit,
    type WorkspaceEdit,
} from 'vscode-languageserver/node';
import { toDiagnostic } from './diagnostics.js';

/** What the code actions of a file are made from. */
export interface CodeActionInput {
    readonly params: CodeActionParams;
    /** The file's findings as the server last checked them. */
    readonly findings: readonly WorkspaceFinding[];
    /** The URI of a file of the mod, by its path inside the mod. */
    readonly uriOf: (file: string) => string;
    /** True when the editor can create a file in a workspace edit. */
    readonly createFiles: boolean;
}

/** The kind of the action that applies every safe fix of a file. */
export const FIX_ALL_KIND = CodeActionKind.SourceFixAll;

function sameRange(d: Diagnostic, f: WorkspaceFinding): boolean {
    return (
        d.range.start.line === f.range.start.line &&
        d.range.start.character === f.range.start.character &&
        d.range.end.line === f.range.end.line &&
        d.range.end.character === f.range.end.character
    );
}

/** A workspace edit of alternatives' edits: plain changes, or document changes to create files. */
export function workspaceEdit(
    edits: readonly FixEdit[],
    uriOf: (file: string) => string,
): WorkspaceEdit {
    const created = [...new Set(edits.filter((e) => e.create === true).map((e) => e.file))];
    const byFile = new Map<string, TextEdit[]>();
    for (const edit of edits) {
        byFile.set(edit.file, [
            ...(byFile.get(edit.file) ?? []),
            { range: edit.range, newText: edit.new_text },
        ]);
    }
    if (created.length === 0) {
        return {
            changes: Object.fromEntries([...byFile].map(([file, list]) => [uriOf(file), list])),
        };
    }
    return {
        documentChanges: [
            ...created.map((file) => ({
                kind: 'create' as const,
                uri: uriOf(file),
                options: { overwrite: false, ignoreIfExists: false },
            })),
            ...[...byFile].map(([file, list]) => ({
                textDocument: { uri: uriOf(file), version: null },
                edits: list,
            })),
        ],
    };
}

/** True for the insertion of the byte-order mark at the start of a file. */
function markInsertion(edit: FixEdit): boolean {
    const r = edit.range;
    return (
        edit.new_text === '\uFEFF' &&
        r.start.line === 0 &&
        r.start.character === 0 &&
        r.end.line === 0 &&
        r.end.character === 0
    );
}

/** An alternative as the editor applies it: without the mark's insertion. */
function inEditor(alternative: FixAlternative): FixAlternative {
    return alternative.edits.some(markInsertion)
        ? { ...alternative, edits: alternative.edits.filter((e) => !markInsertion(e)) }
        : alternative;
}

function usable(alternative: FixAlternative, createFiles: boolean): boolean {
    return (
        alternative.edits.length > 0 &&
        (createFiles || alternative.edits.every((e) => e.create !== true))
    );
}

/**
 * The safe alternatives of `findings` that overlap none taken before them, in file order, but a
 * file's `style/not-formatted` first: formatting the whole file is every formatting fix at once.
 */
function safeTogether(findings: readonly WorkspaceFinding[], createFiles: boolean): FixEdit[] {
    const taken: FixEdit[] = [];
    const ordered = [
        ...findings.filter((f) => f.code === 'style/not-formatted'),
        ...findings.filter((f) => f.code !== 'style/not-formatted'),
    ];
    for (const f of ordered) {
        const first = f.fix?.safety === 'safe' ? f.fix.alternatives[0] : undefined;
        const alternative = first === undefined ? undefined : inEditor(first);
        if (
            alternative !== undefined &&
            usable(alternative, createFiles) &&
            !overlapsAny(alternative, taken)
        ) {
            taken.push(...alternative.edits);
        }
    }
    return taken;
}

/** The code actions of a request: quick fixes of its diagnostics, and fix all where asked. */
export function codeActions(input: CodeActionInput): CodeAction[] {
    const { params, findings, uriOf, createFiles } = input;
    const only = params.context.only;
    const wants = (kind: string): boolean =>
        only === undefined || only.some((k) => kind === k || kind.startsWith(`${k}.`));
    const out: CodeAction[] = [];
    const allOfCode = new Set<string>();
    if (wants(CodeActionKind.QuickFix)) {
        for (const diagnostic of params.context.diagnostics) {
            const finding = findings.find(
                (f) => f.code === diagnostic.code && sameRange(diagnostic, f) && f.fix !== null,
            );
            const fix = finding?.fix;
            if (finding === undefined || fix === null || fix === undefined) {
                continue;
            }
            const shown = toDiagnostic(finding);
            for (const alternative of fix.alternatives.map(inEditor)) {
                if (!usable(alternative, createFiles)) {
                    continue;
                }
                out.push({
                    title: alternative.title,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: [shown],
                    isPreferred: fix.safety === 'safe',
                    edit: workspaceEdit(alternative.edits, uriOf),
                });
            }
            const sameCode = findings.filter((f) => f.code === finding.code);
            const safeOfCode = sameCode.filter((f) => f.fix?.safety === 'safe');
            if (fix.safety === 'safe' && safeOfCode.length > 1 && !allOfCode.has(finding.code)) {
                allOfCode.add(finding.code);
                out.push({
                    title: `Fix every safe ${finding.code} in the file (${String(safeOfCode.length)})`,
                    kind: CodeActionKind.QuickFix,
                    diagnostics: safeOfCode.map(toDiagnostic),
                    edit: workspaceEdit(safeTogether(safeOfCode, createFiles), uriOf),
                });
            }
        }
    }
    if (only !== undefined && wants(FIX_ALL_KIND)) {
        const edits = safeTogether(findings, createFiles);
        if (edits.length > 0) {
            out.push({
                title: 'Fix every safe pychivalry finding in the file',
                kind: FIX_ALL_KIND,
                edit: workspaceEdit(edits, uriOf),
            });
        }
    }
    return out;
}
