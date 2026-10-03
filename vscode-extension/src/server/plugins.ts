/**
 * The extension's diagnostic plug-ins, registered with the engine in one place.
 *
 * The engine (pychivalry-engine) runs parse → registry → schema → scope checks driven by
 * the spec package. The validators below encode behaviour the package does not describe
 * (the Phase 4 kill list kept them); each is wrapped as an engine Plugin, receives the
 * parsed file with the shared spec and index, and returns engine Diagnostics (the engine
 * marks them `source: 'plugin'`).
 *
 * Localization files are not CK3 script and never reach the engine pipeline; their
 * validator runs from the same list (localizationDiagnostics) on the localization index.
 */

import { Diagnostic as LspDiagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import {
    Diagnostic,
    LocalizationIndex,
    Plugin,
    PluginContext,
    Severity,
    SymbolType,
} from 'pychivalry-engine';
import {
    validateDocumentScopeTiming,
    DEFAULT_SCOPE_TIMING_CONFIG,
} from './ck3/validation/scope-timing';
import { validateScriptValues, DEFAULT_SCRIPT_VALUES_CONFIG } from './ck3/validation/script-values';
import { validateVariables } from './ck3/validation/variables';
import {
    validateScriptedBlocks,
    validateScriptedParameters,
} from './ck3/validation/scripted-blocks';
import { validateStyle, DEFAULT_STYLE_CONFIG } from './ck3/validation/style-checks';
import {
    validateParadoxConventions,
    DEFAULT_PARADOX_CONFIG,
} from './ck3/validation/paradox-checks';
import { validateEventFromNode, validateNamespaceDeclaration } from './ck3/validation/events';
import { validateTraits } from './ck3/validation/traits';
import { validateIterators, DEFAULT_ITERATOR_CONFIG } from './ck3/validation/iterators';
import { validateSwitch } from './ck3/validation/switch-validation';
import { GraphicsResolver, validateGraphics } from './ck3/validation/graphics';
import {
    validateConditionalBlocks,
    validateConventions,
    validateLocalizationReferences,
} from './ck3/validation/conventions';
import {
    SuggestionBudget,
    validateLocalizationContent,
    validateLocalizationKeys,
    DEFAULT_LOC_VALIDATION_CONFIG,
} from './ck3/localization/validator';

/** What the plug-ins need from the host beyond the engine's plug-in context. */
export interface PluginEnvironment {
    /** Localization keys of the workspace (CK4100 and the localization validator). */
    localization?: LocalizationIndex;
    /** Trait names from the optional extracted data (CK3800 runs only when present). */
    extractedTraits?: () => ReadonlySet<string> | undefined;
    /**
     * Where graphics paths are looked up (GFX001): the workspace mod roots, then the base
     * game's `game/` and `game/dlc/*` when known. Undefined, or returning undefined, when the
     * check is switched off (ck3LanguageServer.graphics.enabled).
     */
    graphics?: () => GraphicsResolver | undefined;
}

const SEVERITY: Record<number, Severity> = {
    [DiagnosticSeverity.Error]: 'error',
    [DiagnosticSeverity.Warning]: 'warning',
    [DiagnosticSeverity.Information]: 'information',
    [DiagnosticSeverity.Hint]: 'hint',
};

/** An LSP diagnostic of a wrapped validator as an engine diagnostic of `file`. */
function toEngine(file: string, d: LspDiagnostic): Diagnostic {
    return {
        file,
        range: d.range,
        severity: SEVERITY[d.severity ?? DiagnosticSeverity.Error] ?? 'error',
        code: d.code === undefined ? 'PLUGIN' : String(d.code),
        message: d.message,
        source: 'plugin',
    };
}

/** Wrap a validator returning LSP diagnostics as an engine plug-in. */
function wrap(run: (ctx: PluginContext) => LspDiagnostic[]): Plugin {
    return (ctx) => run(ctx).map((d) => toEngine(ctx.file, d));
}

/** A named plug-in, so the list documents itself. */
export interface NamedPlugin {
    name: string;
    run: Plugin;
}

/**
 * Every surviving validator, in the order the old coordinator ran them.
 */
export function extensionPlugins(env: PluginEnvironment = {}): NamedPlugin[] {
    return [
        {
            name: 'scope-timing',
            run: wrap(({ ast }) => validateDocumentScopeTiming(ast, DEFAULT_SCOPE_TIMING_CONFIG)),
        },
        {
            name: 'style-checks',
            run: wrap(({ ast, text }) => validateStyle(ast, text, DEFAULT_STYLE_CONFIG)),
        },
        {
            name: 'conventions',
            run: wrap(({ ast }) => [
                ...validateConventions(ast),
                ...validateConditionalBlocks(ast),
            ]),
        },
        {
            name: 'localization-references',
            run: wrap(({ ast }) => validateLocalizationReferences(ast, env.localization)),
        },
        {
            name: 'events',
            run: wrap(({ ast, uri }) => {
                const out: LspDiagnostic[] = [];
                let hasEvents = false;
                for (const child of ast.children ?? []) {
                    if (child.key && /^[a-z_]+\.\d+$/.test(child.key) && child.children) {
                        hasEvents = true;
                        for (const err of validateEventFromNode(child).errors) {
                            out.push({
                                severity: DiagnosticSeverity.Warning,
                                range: child.range,
                                message: err.message,
                                code: err.code,
                                source: 'ck3-event',
                            });
                        }
                    }
                }
                if (hasEvents) {
                    for (const err of validateNamespaceDeclaration(ast, uri)) {
                        out.push({
                            severity: DiagnosticSeverity.Warning,
                            range: err.range ?? {
                                start: { line: 0, character: 0 },
                                end: { line: 0, character: 0 },
                            },
                            message: err.message,
                            code: err.code,
                            source: 'ck3-event',
                        });
                    }
                }
                return out;
            }),
        },
        {
            name: 'paradox-checks',
            run: wrap(({ ast }) => validateParadoxConventions(ast, DEFAULT_PARADOX_CONFIG)),
        },
        {
            name: 'variables',
            run: wrap(({ ast }) =>
                validateVariables(ast, {
                    enabled: true,
                    checkUnused: true,
                    checkUndeclared: true,
                    checkScope: true,
                    checkTypes: true,
                })
            ),
        },
        {
            name: 'traits',
            run: wrap(({ ast, index }) => {
                const extracted = env.extractedTraits?.();
                if (!extracted) {
                    return [];
                }
                const knownTraits = new Set(extracted);
                for (const symbol of index.findSymbolsByType(SymbolType.TRAIT)) {
                    knownTraits.add(symbol.name);
                }
                return validateTraits(ast, {
                    enabled: true,
                    checkExistence: true,
                    checkCompatibility: false,
                    checkOpposites: false,
                    knownTraits,
                });
            }),
        },
        {
            name: 'scripted-blocks',
            run: wrap(({ ast, index, uri }) => [
                ...validateScriptedBlocks(ast, {
                    enabled: true,
                    checkEffects: true,
                    checkTriggers: true,
                    knownScriptedEffects: new Set(
                        index.findSymbolsByType(SymbolType.SCRIPTED_EFFECT).map((s) => s.name)
                    ),
                    knownScriptedTriggers: new Set(
                        index.findSymbolsByType(SymbolType.SCRIPTED_TRIGGER).map((s) => s.name)
                    ),
                }),
                ...validateScriptedParameters(
                    ast,
                    { enabled: true, checkEffects: true, checkTriggers: true },
                    uri
                ),
            ]),
        },
        {
            name: 'script-values',
            run: wrap(({ ast }) => validateScriptValues(ast, DEFAULT_SCRIPT_VALUES_CONFIG)),
        },
        {
            name: 'iterators',
            run: wrap(({ ast }) => validateIterators(ast, DEFAULT_ITERATOR_CONFIG)),
        },
        {
            name: 'switch',
            run: wrap(({ ast, spec, index }) =>
                validateSwitch(ast, {
                    enabled: true,
                    isTrigger: (name) =>
                        spec.has(name, 'triggers') ||
                        index.hasSymbol(name, SymbolType.SCRIPTED_TRIGGER),
                })
            ),
        },
        {
            name: 'graphics',
            run: wrap(({ ast }) => {
                const resolver = env.graphics?.();
                return resolver ? validateGraphics(ast, resolver) : [];
            }),
        },
    ];
}

/** The plug-in functions to hand to the engine's diagnose(). */
export function enginePlugins(env: PluginEnvironment = {}): Plugin[] {
    return extensionPlugins(env).map((p) => p.run);
}

/**
 * The localization validator (LOC-002..LOC-007) over the entries the localization index
 * holds for one file, plus LOC-001 (key format) over the file text when it is given; a
 * localization file is not CK3 script and does not go through the engine pipeline.
 */
export function localizationDiagnostics(
    index: LocalizationIndex,
    fileUri: string,
    text?: string
): LspDiagnostic[] {
    const out: LspDiagnostic[] = text !== undefined ? validateLocalizationKeys(text) : [];
    // One suggestion budget per file: a file never spends seconds on "Did you mean".
    const budget = new SuggestionBudget();
    for (const entry of index.entriesOf(fileUri)) {
        out.push(...validateLocalizationContent(entry, DEFAULT_LOC_VALIDATION_CONFIG, budget));
    }
    return out;
}
