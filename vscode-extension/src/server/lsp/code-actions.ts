/**
 * Code Actions Provider - Provides quick fixes and refactorings
 */

import {
    CodeAction,
    CodeActionKind,
    Command,
    Diagnostic,
    Range,
    TextEdit,
    WorkspaceEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser } from '../core/parser';

/**
 * Code Actions Provider
 */
export class CodeActionsProvider {
    constructor(private parser: CK3Parser) {}

    /**
     * Provide code actions for diagnostics or selection
     */
    public async provideCodeActions(
        document: TextDocument,
        range: Range,
        diagnostics: Diagnostic[]
    ): Promise<CodeAction[]> {
        const actions: CodeAction[] = [];

        // Quick fixes for diagnostics
        for (const diagnostic of diagnostics) {
            const quickFixes = this.getQuickFixesForDiagnostic(document, diagnostic);
            actions.push(...quickFixes);
        }

        // Refactorings for selection
        const refactorings = this.getRefactoringsForRange(document, range);
        actions.push(...refactorings);

        return actions;
    }

    /**
     * Get quick fixes for a diagnostic
     */
    private getQuickFixesForDiagnostic(
        document: TextDocument,
        diagnostic: Diagnostic
    ): CodeAction[] {
        const actions: CodeAction[] = [];

        // Example: If it's a missing value, suggest adding one
        if (diagnostic.message.includes('Expected') || diagnostic.message.includes('missing')) {
            const fix: CodeAction = {
                title: 'Add missing value',
                kind: CodeActionKind.QuickFix,
                diagnostics: [diagnostic],
                edit: {
                    changes: {
                        [document.uri]: [{
                            range: diagnostic.range,
                            newText: ' = yes',
                        }],
                    },
                },
            };
            actions.push(fix);
        }

        return actions;
    }

    /**
     * Get refactorings for a range
     */
    private getRefactoringsForRange(
        document: TextDocument,
        range: Range
    ): CodeAction[] {
        const actions: CodeAction[] = [];

        // Example: Extract to scripted effect
        const extractAction: CodeAction = {
            title: 'Extract to scripted effect',
            kind: CodeActionKind.Refactor,
            edit: {
                changes: {
                    [document.uri]: [],
                },
            },
        };
        // actions.push(extractAction); // Commented out until fully implemented

        return actions;
    }
}
