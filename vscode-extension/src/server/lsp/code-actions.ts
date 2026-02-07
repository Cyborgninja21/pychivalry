/**
 * Enhanced Code Actions Provider - Quick fixes, refactorings, and code generation
 * 
 * Features:
 * - Quick fixes for common validation errors
 * - Refactoring actions (extract, inline, rename)
 * - Code generation (templates, localization stubs)
 * - Auto-fix for style issues
 * - Source-level actions (organize, cleanup)
 */

/* eslint-disable @typescript-eslint/no-unused-vars */

import {
    CodeAction,
    CodeActionKind,
    Command,
    Diagnostic,
    Position,
    Range,
    WorkspaceEdit,
} from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CK3Parser, ASTNode } from '../core/parser';
import { SchemaLoader } from '../schema/loader';
import { DocumentIndexer } from '../core/indexer';

/**
 * Code action builder with fluent API
 */
class CodeActionBuilder {
    private action: Partial<CodeAction>;

    constructor(title: string) {
        this.action = { title };
    }

    withKind(kind: CodeActionKind): this {
        this.action.kind = kind;
        return this;
    }

    withDiagnostic(diagnostic: Diagnostic): this {
        this.action.diagnostics = [diagnostic];
        return this;
    }

    withEdit(edit: WorkspaceEdit): this {
        this.action.edit = edit;
        return this;
    }

    withCommand(command: Command): this {
        this.action.command = command;
        return this;
    }

    isPreferred(): this {
        this.action.isPreferred = true;
        return this;
    }

    build(): CodeAction {
        return this.action as CodeAction;
    }
}

/**
 * Quick fix generator function type
 */
type QuickFixGenerator = (
    document: TextDocument,
    diagnostic: Diagnostic,
    context: CodeActionContext
) => CodeAction[];

/**
 * Code action context
 */
interface CodeActionContext {
    parser: CK3Parser;
    schemaLoader: SchemaLoader;
    indexer: DocumentIndexer;
    ast: ASTNode | null;
}

/**
 * Templates for code generation
 */
const TEMPLATES = {
    event: `namespace.\${1:event_id} = {
\ttype = \${2|character_event,letter_event,duel_event|}
\ttitle = namespace.\${1:event_id}.t
\tdesc = namespace.\${1:event_id}.desc
\t
\ttheme = \${3:default}
\t
\timmediate = {
\t\t\${4:# Effects here}
\t}
\t
\toption = {
\t\tname = namespace.\${1:event_id}.a
\t\t\${5:# Effects here}
\t}
}`,
    
    decision: `\${1:decision_id} = {
\tpicture = "\${2:gfx/interface/illustrations/decisions/decision_icon.dds}"
\t
\tis_shown = {
\t\t\${3:# Triggers here}
\t}
\t
\tis_valid = {
\t\t\${4:# Triggers here}
\t}
\t
\teffect = {
\t\t\${5:# Effects here}
\t}
}`,
    
    option: `option = {
\tname = \${1:option_key}
\t\${2:# Effects here}
}`,
    
    scriptedEffect: `\${1:effect_name} = {
\t\${2:# Effects here}
}`,
    
    scriptedTrigger: `\${1:trigger_name} = {
\t\${2:# Triggers here}
}`,
    
    limitBlock: `limit = {
\t\${1:# Conditions here}
}
\${0}`,
    
    ifBlock: `if = {
\tlimit = {
\t\t\${1:# Conditions here}
\t}
\t\${2:# Effects here}
}`,
};

/**
 * Enhanced Code Actions Provider
 */
export class CodeActionsProvider {
    private quickFixRegistry: Map<string, QuickFixGenerator>;
    private schemaLoader: SchemaLoader;
    private indexer: DocumentIndexer;

    constructor(
        private parser: CK3Parser,
        schemaLoader?: SchemaLoader,
        indexer?: DocumentIndexer
    ) {
        this.schemaLoader = schemaLoader || new SchemaLoader();
        this.indexer = indexer || new DocumentIndexer();
        this.quickFixRegistry = this.buildQuickFixRegistry();
    }

    /**
     * Provide code actions for diagnostics or selection
     */
    public async provideCodeActions(
        document: TextDocument,
        range: Range,
        diagnostics: Diagnostic[]
    ): Promise<CodeAction[]> {
        const actions: CodeAction[] = [];
        const parsed = this.parser.parse(document.getText());
        const context: CodeActionContext = {
            parser: this.parser,
            schemaLoader: this.schemaLoader,
            indexer: this.indexer,
            ast: parsed.ast,
        };

        // Quick fixes for diagnostics
        for (const diagnostic of diagnostics) {
            const quickFixes = this.getQuickFixesForDiagnostic(document, diagnostic, context);
            actions.push(...quickFixes);
        }

        // Refactorings for selection
        const refactorings = this.getRefactoringsForRange(document, range, context);
        actions.push(...refactorings);

        // Code generation actions
        const generators = this.getCodeGenerators(document, range, context);
        actions.push(...generators);

        // Source actions
        const sourceActions = this.getSourceActions(document, range, context);
        actions.push(...sourceActions);

        return actions;
    }

    /**
     * Build quick fix registry mapping diagnostic codes to generators
     */
    private buildQuickFixRegistry(): Map<string, QuickFixGenerator> {
        return new Map([
            ['PARSE-001', this.fixMissingEquals.bind(this)],
            ['PARSE-002', this.fixMissingBrace.bind(this)],
            ['SCOPE-003', this.fixInvalidScope.bind(this)],
            ['SCOPE-004', this.fixUndefinedReference.bind(this)],
            ['SCOPE-005', this.fixTypeMismatch.bind(this)],
            ['SCHEMA-001', this.fixMissingRequiredField.bind(this)],
            ['SCHEMA-002', this.fixCardinalityViolation.bind(this)],
            ['LOC-001', this.fixMissingLocalization.bind(this)],
            ['CONV-001', this.fixIndentation.bind(this)],
            ['CONV-002', this.fixSpacing.bind(this)],
        ]);
    }

    /**
     * Get quick fixes for a diagnostic
     */
    private getQuickFixesForDiagnostic(
        document: TextDocument,
        diagnostic: Diagnostic,
        context: CodeActionContext
    ): CodeAction[] {
        const actions: CodeAction[] = [];
        const code = typeof diagnostic.code === 'string' ? diagnostic.code : '';

        // Try specific quick fix generator
        const generator = this.quickFixRegistry.get(code);
        if (generator) {
            actions.push(...generator(document, diagnostic, context));
        }

        // Generic fixes based on message patterns
        actions.push(...this.getGenericQuickFixes(document, diagnostic, context));

        return actions;
    }

    /**
     * Generic quick fixes based on message patterns
     */
    private getGenericQuickFixes(
        document: TextDocument,
        diagnostic: Diagnostic,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _context: CodeActionContext
    ): CodeAction[] {
        const actions: CodeAction[] = [];
        const message = diagnostic.message.toLowerCase();

        if (message.includes('missing') && message.includes('=')) {
            actions.push(
                new CodeActionBuilder('Add equals sign')
                    .withKind(CodeActionKind.QuickFix)
                    .withDiagnostic(diagnostic)
                    .withEdit({
                        changes: {
                            [document.uri]: [
                                { range: diagnostic.range, newText: ' = yes' },
                            ],
                        },
                    })
                    .isPreferred()
                    .build()
            );
        }

        if (message.includes('expected') && message.includes('value')) {
            actions.push(
                new CodeActionBuilder('Add default value')
                    .withKind(CodeActionKind.QuickFix)
                    .withDiagnostic(diagnostic)
                    .withEdit({
                        changes: {
                            [document.uri]: [
                                { range: diagnostic.range, newText: 'yes' },
                            ],
                        },
                    })
                    .build()
            );
        }

        return actions;
    }

    /**
     * Get refactorings for a range
     */
    private getRefactoringsForRange(
        document: TextDocument,
        range: Range,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        context: CodeActionContext
    ): CodeAction[] {
        const actions: CodeAction[] = [];
        const selectedText = document.getText(range);

        // Only show refactorings if text is selected
        if (!selectedText.trim()) {
            return actions;
        }

        // Extract to scripted effect
        if (this.isEffectBlock(selectedText)) {
            actions.push(this.createExtractScriptedEffectAction(document, range));
        }

        // Extract to scripted trigger
        if (this.isTriggerBlock(selectedText)) {
            actions.push(this.createExtractScriptedTriggerAction(document, range));
        }

        // Wrap in conditional
        actions.push(this.createWrapInLimitAction(document, range));
        actions.push(this.createWrapInIfAction(document, range));

        return actions;
    }

    /**
     * Get code generators
     */
    private getCodeGenerators(
        document: TextDocument,
        range: Range,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _context: CodeActionContext
    ): CodeAction[] {
        const actions: CodeAction[] = [];

        // Template generators (show at cursor position)
        if (this.isEmptyLineOrBlock(document, range.start)) {
            actions.push(
                this.createTemplateAction('Generate Event Template', TEMPLATES.event, document, range),
                this.createTemplateAction('Generate Decision Template', TEMPLATES.decision, document, range),
                this.createTemplateAction('Add Event Option', TEMPLATES.option, document, range)
            );
        }

        // Generate localization stubs for document
        const locKeys = this.extractLocalizationKeys(document.getText());
        if (locKeys.length > 0) {
            actions.push(this.createGenerateLocalizationAction(document, locKeys));
        }

        return actions;
    }

    /**
     * Get source-level actions
     */
    private getSourceActions(
        document: TextDocument,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _range: Range,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        _context: CodeActionContext
    ): CodeAction[] {
        const actions: CodeAction[] = [];

        // Fix all auto-fixable issues
        actions.push(
            new CodeActionBuilder('Fix all auto-fixable issues')
                .withKind(CodeActionKind.SourceFixAll)
                .withEdit({ changes: { [document.uri]: [] } })
                .build()
        );

        // Format document
        actions.push(
            new CodeActionBuilder('Format document')
                .withKind(CodeActionKind.Source)
                .withCommand({
                    title: 'Format Document',
                    command: 'editor.action.formatDocument',
                })
                .build()
        );

        return actions;
    }

    // ============================================================================
    // Quick Fix Implementations
    // All quick fix functions match QuickFixGenerator signature but may not use all parameters
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    // ============================================================================

    private fixMissingEquals(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        return [
            new CodeActionBuilder('Add equals sign')
                .withKind(CodeActionKind.QuickFix)
                .withDiagnostic(diag)
                .withEdit({ changes: { [doc.uri]: [{ range: diag.range, newText: ' = ' }] } })
                .isPreferred()
                .build(),
        ];
    }

    private fixMissingBrace(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const text = doc.getText(diag.range);
        const missing = text.includes('{') ? '}' : '{';
        
        return [
            new CodeActionBuilder(`Add missing '${missing}'`)
                .withKind(CodeActionKind.QuickFix)
                .withDiagnostic(diag)
                .withEdit({ 
                    changes: { 
                        [doc.uri]: [{ 
                            range: { start: diag.range.end, end: diag.range.end }, 
                            newText: missing 
                        }] 
                    } 
                })
                .isPreferred()
                .build(),
        ];
    }

    private fixInvalidScope(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const actions: CodeAction[] = [];
        const validScopes = ['character', 'province', 'title', 'faith', 'culture'];
        
        for (const scope of validScopes) {
            actions.push(
                new CodeActionBuilder(`Change to '${scope}' scope`)
                    .withKind(CodeActionKind.QuickFix)
                    .withDiagnostic(diag)
                    .withEdit({ changes: { [doc.uri]: [{ range: diag.range, newText: scope }] } })
                    .build()
            );
        }
        
        return actions;
    }

    private fixUndefinedReference(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const refName = doc.getText(diag.range);
        
        return [
            new CodeActionBuilder(`Create definition for '${refName}'`)
                .withKind(CodeActionKind.QuickFix)
                .withDiagnostic(diag)
                .withCommand({
                    title: 'Create Definition',
                    command: 'ck3.createDefinition',
                    arguments: [refName],
                })
                .build(),
        ];
    }

    private fixTypeMismatch(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const value = doc.getText(diag.range);
        const actions: CodeAction[] = [];
        
        // Try converting to boolean
        if (value.match(/^(true|false|yes|no)$/i)) {
            actions.push(
                new CodeActionBuilder('Convert to boolean')
                    .withKind(CodeActionKind.QuickFix)
                    .withDiagnostic(diag)
                    .withEdit({ changes: { [doc.uri]: [{ range: diag.range, newText: 'yes' }] } })
                    .build()
            );
        }
        
        return actions;
    }

    private fixMissingRequiredField(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const match = diag.message.match(/Missing required field: (\w+)/);
        if (!match) {
            return [];
        }
        
        const fieldName = match[1];
        const defaultValue = this.getDefaultValueForField(fieldName);
        
        return [
            new CodeActionBuilder(`Add required field '${fieldName}'`)
                .withKind(CodeActionKind.QuickFix)
                .withDiagnostic(diag)
                .withEdit({
                    changes: {
                        [doc.uri]: [{
                            range: { start: diag.range.end, end: diag.range.end },
                            newText: `\n\t${fieldName} = ${defaultValue}`,
                        }],
                    },
                })
                .isPreferred()
                .build(),
        ];
    }

    private fixCardinalityViolation(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        if (diag.message.includes('duplicate')) {
            return [
                new CodeActionBuilder('Remove duplicate')
                    .withKind(CodeActionKind.QuickFix)
                    .withDiagnostic(diag)
                    .withEdit({ changes: { [doc.uri]: [{ range: diag.range, newText: '' }] } })
                    .build(),
            ];
        }
        return [];
    }

    private fixMissingLocalization(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const key = doc.getText(diag.range);
        
        return [
            new CodeActionBuilder(`Generate localization stub for '${key}'`)
                .withKind(CodeActionKind.QuickFix)
                .withDiagnostic(diag)
                .withCommand({
                    title: 'Generate Localization',
                    command: 'ck3.generateLocalization',
                    arguments: [key],
                })
                .build(),
        ];
    }

    private fixIndentation(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const line = doc.getText({ 
            start: { line: diag.range.start.line, character: 0 },
            end: { line: diag.range.start.line, character: 100 }
        });
        const fixed = line.replace(/^ +/, (spaces) => '\t'.repeat(Math.floor(spaces.length / 4)));
        
        return [
            new CodeActionBuilder('Fix indentation (use tabs)')
                .withKind(CodeActionKind.QuickFix)
                .withDiagnostic(diag)
                .withEdit({
                    changes: {
                        [doc.uri]: [{
                            range: {
                                start: { line: diag.range.start.line, character: 0 },
                                end: { line: diag.range.start.line, character: line.length }
                            },
                            newText: fixed,
                        }],
                    },
                })
                .build(),
        ];
    }

    private fixSpacing(doc: TextDocument, diag: Diagnostic, _ctx: CodeActionContext): CodeAction[] {
        const text = doc.getText(diag.range);
        const fixed = text.replace(/\s*=\s*/, ' = ').replace(/\s*{\s*/, ' { ').replace(/\s*}\s*/, ' }');
        
        return [
            new CodeActionBuilder('Fix spacing')
                .withKind(CodeActionKind.QuickFix)
                .withDiagnostic(diag)
                .withEdit({ changes: { [doc.uri]: [{ range: diag.range, newText: fixed }] } })
                .build(),
        ];
    }

    // ============================================================================
    // Helper Methods
    // ============================================================================

    private isEffectBlock(text: string): boolean {
        const effects = ['add_gold', 'add_prestige', 'add_piety', 'trigger_event', 'set_variable'];
        return effects.some(effect => text.includes(effect));
    }

    private isTriggerBlock(text: string): boolean {
        const triggers = ['has_trait', 'is_alive', 'age', 'gold', 'prestige'];
        return triggers.some(trigger => text.includes(trigger));
    }

    private isEmptyLineOrBlock(document: TextDocument, position: Position): boolean {
        const line = document.getText({
            start: { line: position.line, character: 0 },
            end: { line: position.line, character: 1000 }
        });
        return line.trim().length === 0;
    }

    private extractLocalizationKeys(text: string): string[] {
        const keyPattern = /\b(\w+\.(?:\w+\.)*[a-z])\b/g;
        const keys: string[] = [];
        let match;
        
        while ((match = keyPattern.exec(text)) !== null) {
            keys.push(match[1]);
        }
        
        return [...new Set(keys)];
    }

    private getDefaultValueForField(fieldName: string): string {
        const defaults: Record<string, string> = {
            type: 'character_event',
            title: 'event.title',
            desc: 'event.desc',
            isShown: '{ always = yes }',
            isValid: '{ always = yes }',
            effect: '{ }',
        };
        return defaults[fieldName] || 'yes';
    }

    private createExtractScriptedEffectAction(document: TextDocument, range: Range): CodeAction {
        return new CodeActionBuilder('Extract to scripted effect')
            .withKind(CodeActionKind.RefactorExtract)
            .withCommand({
                title: 'Extract Scripted Effect',
                command: 'ck3.extractScriptedEffect',
                arguments: [document.uri, range],
            })
            .build();
    }

    private createExtractScriptedTriggerAction(document: TextDocument, range: Range): CodeAction {
        return new CodeActionBuilder('Extract to scripted trigger')
            .withKind(CodeActionKind.RefactorExtract)
            .withCommand({
                title: 'Extract Scripted Trigger',
                command: 'ck3.extractScriptedTrigger',
                arguments: [document.uri, range],
            })
            .build();
    }

    private createWrapInLimitAction(document: TextDocument, range: Range): CodeAction {
        const selectedText = document.getText(range);
        const indented = selectedText.split('\n').map(line => '\t' + line).join('\n');
        
        return new CodeActionBuilder('Wrap in limit block')
            .withKind(CodeActionKind.Refactor)
            .withEdit({
                changes: {
                    [document.uri]: [{
                        range,
                        newText: `limit = {\n${indented}\n}`,
                    }],
                },
            })
            .build();
    }

    private createWrapInIfAction(document: TextDocument, range: Range): CodeAction {
        const selectedText = document.getText(range);
        const indented = selectedText.split('\n').map(line => '\t' + line).join('\n');
        
        return new CodeActionBuilder('Wrap in if block')
            .withKind(CodeActionKind.Refactor)
            .withEdit({
                changes: {
                    [document.uri]: [{
                        range,
                        newText: `if = {\n\tlimit = {\n\t\t# Conditions\n\t}\n${indented}\n}`,
                    }],
                },
            })
            .build();
    }

    private createTemplateAction(title: string, template: string, document: TextDocument, range: Range): CodeAction {
        return new CodeActionBuilder(title)
            .withKind(CodeActionKind.Source)
            .withEdit({
                changes: {
                    [document.uri]: [{
                        range: { start: range.start, end: range.start },
                        newText: template + '\n',
                    }],
                },
            })
            .build();
    }

    private createGenerateLocalizationAction(document: TextDocument, keys: string[]): CodeAction {
        return new CodeActionBuilder(`Generate ${keys.length} localization stubs`)
            .withKind(CodeActionKind.Source)
            .withCommand({
                title: 'Generate Localization Stubs',
                command: 'ck3.generateAllLocalizations',
                arguments: [document.uri, keys],
            })
            .build();
    }
}
