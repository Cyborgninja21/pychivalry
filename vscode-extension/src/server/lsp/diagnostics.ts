/**
 * Diagnostics Provider — the engine pipeline (pychivalry-engine `diagnose`) mapped to LSP.
 *
 * A script file is diagnosed by the engine: parse → registry → schema → scope checks with
 * the spec package's catalogue ids and texts, then the extension's plug-ins (plugins.ts),
 * which receive the same parsed tree, spec and index. A localization file is not CK3
 * script: it is indexed from the editor text and checked by the localization validator.
 */

import * as path from 'path';
import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import {
    diagnose,
    Diagnostic as EngineDiagnostic,
    isLocalizationFile,
    LocalizationIndex,
    pathToUri,
    Plugin,
    Severity,
    uriToPath,
    Workspace,
} from 'pychivalry-engine';

const SEVERITY: Record<Severity, DiagnosticSeverity> = {
    error: DiagnosticSeverity.Error,
    warning: DiagnosticSeverity.Warning,
    information: DiagnosticSeverity.Information,
    hint: DiagnosticSeverity.Hint,
};

/** Engine parse errors that mark an unbalanced brace on their line. */
const BRACE_PARSE_ERRORS = new Set([
    'expected_after_arguments',
    'unexpected_token_expected_key',
    'expected_between_block_name_and_body',
]);

/** The style plug-in's brace checks, superseded by an engine parse error on the same line. */
const STYLE_BRACE_CODES = new Set(['CK3330', 'CK3331']);

const MAX_DIAGNOSTICS = 1000;

/** An engine diagnostic as an LSP diagnostic (source ck3-engine or ck3-plugin). */
export function toLsp(d: EngineDiagnostic): Diagnostic {
    return {
        range: d.range,
        severity: SEVERITY[d.severity],
        code: d.code,
        message: d.message,
        source: d.source === 'engine' ? 'ck3-engine' : 'ck3-plugin',
    };
}

/**
 * Diagnostics Provider
 */
export class DiagnosticsProvider {
    constructor(
        private workspace: Workspace,
        private plugins: readonly Plugin[] = [],
        private localization?: LocalizationIndex,
        private localizationValidator?: (
            index: LocalizationIndex,
            uri: string,
            text?: string
        ) => Diagnostic[]
    ) {}

    /**
     * Provide diagnostics for a document
     */
    public async provideDiagnostics(document: TextDocument): Promise<Diagnostic[]> {
        return this.diagnoseText(document.uri, document.getText());
    }

    /**
     * Diagnose a file's text, synchronously (the background validator diagnoses unopened
     * files through here, so they get exactly what an open file gets).
     */
    public diagnoseText(uri: string, text: string): Diagnostic[] {
        const file = uriToPath(uri);
        // Any .yml is localization (CK3 loads only *_l_<language>.yml, but the editor may
        // open others); it is never parsed as CK3 script.
        if (isLocalizationFile(path.basename(file)) || file.toLowerCase().endsWith('.yml')) {
            return this.localizationDiagnostics(text, file);
        }

        const results = diagnose(this.workspace, file, {
            text,
            uri,
            plugins: this.plugins,
        });

        // Where the engine reports an unbalanced brace, the style plug-in's own brace
        // checks on that line are dropped (the parse error has the game's text).
        const braceLines = new Set(
            results.filter((d) => BRACE_PARSE_ERRORS.has(d.code)).map((d) => d.range.start.line)
        );
        const kept = results.filter(
            (d) => !(STYLE_BRACE_CODES.has(d.code) && braceLines.has(d.range.start.line))
        );
        return kept.slice(0, MAX_DIAGNOSTICS).map(toLsp);
    }

    private localizationDiagnostics(text: string, file: string): Diagnostic[] {
        if (!this.localization || !this.localizationValidator) {
            return [];
        }
        this.localization.indexText(file, text);
        return this.localizationValidator(this.localization, pathToUri(file), text);
    }
}
