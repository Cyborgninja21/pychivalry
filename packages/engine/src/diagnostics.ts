/**
 * The diagnostics pipeline: parse → registry → schema → scope → plug-ins.
 *
 * Every engine diagnostic carries the spec package's catalogue id and text (or a listed
 * package-local PYCH- id). Plug-ins receive the parsed file and the shared spec and index
 * and return their own diagnostics, which are marked `source: 'plugin'`. None are
 * registered in this phase; Phase 4 decides which per-system validators become plug-ins.
 */

import * as path from 'path';

import { Indexer } from './index/indexer';
import { pathToUri, Workspace } from './index/workspace';
import { Spec } from './spec/spec';
import { ASTNode, ParseError } from './syntax/ast';
import { checkRegistry } from './check/registry';
import { checkSchema } from './check/schema';
import { checkScope } from './check/scope';
import { CheckInput, Diagnostic } from './check/types';

export type { Diagnostic, Severity } from './check/types';

export interface PluginContext {
    spec: Spec;
    index: Indexer;
    ast: ASTNode;
    /** Mod-relative path of the file. */
    file: string;
}

export type Plugin = (ctx: PluginContext) => Diagnostic[];

export interface DiagnoseOptions {
    /** File content (read from disk when omitted). */
    text?: string;
    /** Plug-ins to run after the engine checks (none by default). */
    plugins?: readonly Plugin[];
}

/** Plug-ins registered for every diagnose() call. Empty in this phase. */
const registeredPlugins: Plugin[] = [];

export function registerPlugin(plugin: Plugin): void {
    registeredPlugins.push(plugin);
}

export function registeredPluginCount(): number {
    return registeredPlugins.length;
}

function parseErrorToDiagnostic(file: string, error: ParseError): Diagnostic {
    return {
        file,
        range: error.range,
        severity: error.severity,
        code: error.code,
        message: error.message,
        source: 'engine',
    };
}

function byPosition(a: Diagnostic, b: Diagnostic): number {
    return (
        a.range.start.line - b.range.start.line ||
        a.range.start.character - b.range.start.character ||
        (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)
    );
}

/**
 * Diagnose one file of the workspace. The file is (re)indexed with the given text first,
 * so the index reflects what is being checked.
 */
export function diagnose(
    workspace: Workspace,
    file: string,
    options: DiagnoseOptions = {}
): Diagnostic[] {
    const absolute = path.resolve(file);
    const rel = workspace.relativePath(absolute);
    const parsed = workspace.parse(absolute, options.text);
    workspace.index.indexSync(pathToUri(absolute), parsed.ast);

    const input: CheckInput = {
        spec: workspace.spec,
        workspace,
        file: rel,
        uri: pathToUri(absolute),
        ast: parsed.ast,
    };
    const diagnostics: Diagnostic[] = parsed.errors.map((e) => parseErrorToDiagnostic(rel, e));
    diagnostics.push(...checkRegistry(input), ...checkSchema(input), ...checkScope(input));

    const plugins = [...registeredPlugins, ...(options.plugins ?? [])];
    for (const plugin of plugins) {
        const context: PluginContext = {
            spec: workspace.spec,
            index: workspace.index,
            ast: parsed.ast,
            file: rel,
        };
        for (const d of plugin(context)) {
            diagnostics.push({ ...d, source: 'plugin' });
        }
    }
    return diagnostics.sort(byPosition);
}

/** Diagnose every script file of the workspace (loads the index first). */
export function diagnoseWorkspace(
    workspace: Workspace,
    options: Omit<DiagnoseOptions, 'text'> = {}
): Map<string, Diagnostic[]> {
    workspace.load();
    const out = new Map<string, Diagnostic[]>();
    for (const file of workspace.scriptFiles()) {
        out.set(workspace.relativePath(file), diagnose(workspace, file, options));
    }
    return out;
}
