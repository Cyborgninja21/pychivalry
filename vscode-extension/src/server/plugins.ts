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
    Indexer,
    LocalizationIndex,
    Plugin,
    PluginContext,
    Severity,
    SymbolType,
    uriToPath,
    Workspace,
} from 'pychivalry-engine';
import { BaseGameData, workspaceTraitNames } from './data/base-game';
import {
    validateDocumentScopeTiming,
    DEFAULT_SCOPE_TIMING_CONFIG,
} from './ck3/validation/scope-timing';
import { validateScriptValues, DEFAULT_SCRIPT_VALUES_CONFIG } from './ck3/validation/script-values';
import { validateVariables } from './ck3/validation/variables';
import { validateScriptedParameters } from './ck3/validation/scripted-blocks';
import { validateStyle, DEFAULT_STYLE_CONFIG } from './ck3/validation/style-checks';
import {
    validateParadoxConventions,
    DEFAULT_PARADOX_CONFIG,
} from './ck3/validation/paradox-checks';
import { validateEventFromNode, validateNamespaceDeclaration } from './ck3/validation/events';
import { eventsOf, isEventFile } from './ck3/validation/event-helpers';
import { validateTraits } from './ck3/validation/traits';
import { validateIterators, DEFAULT_ITERATOR_CONFIG } from './ck3/validation/iterators';
import { validateSwitch } from './ck3/validation/switch-validation';
import { GraphicsResolver, validateGraphics } from './ck3/validation/graphics';
import {
    validateConditionalBlocks,
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
    /**
     * Trait names from the optional extracted data and the discovered mods, added to the base
     * game's trait database for CK3800 (which runs only when the base game's traits are known).
     */
    extractedTraits?: () => ReadonlySet<string> | undefined;
    /**
     * Where graphics paths are looked up (GFX001): the workspace mod roots, then the base
     * game's `game/` and `game/dlc/*` when known. Undefined, or returning undefined, when the
     * check is switched off (ck3LanguageServer.graphics.enabled).
     */
    graphics?: () => GraphicsResolver | undefined;
    /**
     * The workspace (its relative paths and the base game's index): the plug-ins that judge
     * names across the workspace (variables, themes, switch headers) read it.
     */
    workspace?: Workspace;
    /**
     * What the base game defines (localization keys, event themes and backgrounds, traits),
     * once loaded; undefined while no base game is known, and then the checks that need it
     * (CK4100, CK3430, CK3800, CK3701, CK3702, SWITCH-003) report nothing.
     */
    baseGame?: () => BaseGameData | undefined;
}

/** Top-level keys the workspace defines under a mod-relative directory (`common/traits`). */
export function workspaceKeysIn(
    workspace: Workspace | undefined,
    index: Indexer,
    dir: string
): Set<string> {
    const keys = new Set<string>();
    const prefix = dir.endsWith('/') ? dir : `${dir}/`;
    for (const uri of index.getIndexedUris()) {
        let rel: string;
        try {
            rel = (workspace ? workspace.relativePath(uriToPath(uri)) : uriToPath(uri)).replace(
                /\\/g,
                '/'
            );
        } catch {
            continue;
        }
        if (!rel.toLowerCase().startsWith(prefix)) {
            continue;
        }
        for (const symbol of index.getDocumentSymbols(uri)) {
            if (
                symbol.type !== SymbolType.SCOPE &&
                symbol.type !== SymbolType.VARIABLE &&
                symbol.type !== SymbolType.NAMESPACE
            ) {
                keys.add(symbol.name);
            }
        }
    }
    return keys;
}

/** The base game's data when it is loaded for the workspace's current game directory. */
function baseGameOf(env: PluginEnvironment): BaseGameData | undefined {
    return env.baseGame?.();
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
            run: wrap(({ ast, file }) =>
                validateDocumentScopeTiming(ast, DEFAULT_SCOPE_TIMING_CONFIG, file)
            ),
        },
        {
            name: 'style-checks',
            run: wrap(({ ast, text }) => validateStyle(ast, text, DEFAULT_STYLE_CONFIG)),
        },
        {
            name: 'conventions',
            run: wrap(({ ast }) => validateConditionalBlocks(ast)),
        },
        {
            name: 'localization-references',
            run: wrap(({ ast, file }) =>
                validateLocalizationReferences(ast, {
                    localization: env.localization,
                    baseKeys: baseGameOf(env)?.localizationKeys,
                    file,
                })
            ),
        },
        {
            name: 'events',
            run: wrap(({ ast, uri, file }) => {
                if (!isEventFile(file)) {
                    return [];
                }
                const out: LspDiagnostic[] = [];
                const events = eventsOf(ast);
                for (const event of events) {
                    for (const err of validateEventFromNode(event).errors) {
                        out.push({
                            severity: DiagnosticSeverity.Information,
                            range: err.range ?? event.range,
                            message: err.message,
                            code: err.code,
                            source: 'ck3-event',
                        });
                    }
                }
                if (events.length > 0) {
                    for (const err of validateNamespaceDeclaration(ast, uri)) {
                        out.push({
                            severity: DiagnosticSeverity.Information,
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
            run: wrap(({ ast, file, index, spec }) => {
                const base = baseGameOf(env);
                let isKnownTheme: ((theme: string) => boolean) | undefined;
                if (base?.eventThemes) {
                    const themes = base.eventThemes;
                    let workspaceThemes: Set<string> | undefined;
                    isKnownTheme = (theme) => {
                        if (themes.has(theme)) {
                            return true;
                        }
                        workspaceThemes ??= workspaceKeysIn(
                            env.workspace,
                            index,
                            'common/event_themes'
                        );
                        return workspaceThemes.has(theme);
                    };
                }
                let isKnownBackground: ((name: string) => boolean) | undefined;
                if (base?.eventBackgrounds) {
                    const backgrounds = base.eventBackgrounds;
                    let workspaceBackgrounds: Set<string> | undefined;
                    isKnownBackground = (name) => {
                        if (backgrounds.has(name)) {
                            return true;
                        }
                        workspaceBackgrounds ??= workspaceKeysIn(
                            env.workspace,
                            index,
                            'common/event_backgrounds'
                        );
                        return workspaceBackgrounds.has(name);
                    };
                }
                const themes = base?.eventThemes;
                return validateParadoxConventions(ast, DEFAULT_PARADOX_CONFIG, {
                    file,
                    isKnownTheme,
                    isEffect: (name) => spec.has(name, 'effects'),
                    isKnownBackground,
                    // A theme the workspace redefines may show another background.
                    themeDefaultBackground: themes
                        ? (theme) =>
                              workspaceKeysIn(env.workspace, index, 'common/event_themes').has(
                                  theme
                              )
                                  ? undefined
                                  : themes.get(theme)?.defaultBackground
                        : undefined,
                });
            }),
        },
        {
            name: 'variables',
            run: wrap(({ ast, spec, index }) => {
                const vanilla = env.workspace?.vanillaRoot ? env.workspace.vanillaIndex : undefined;
                return validateVariables(
                    ast,
                    {
                        enabled: true,
                        checkUnused: true,
                        checkUndeclared: true,
                        checkScope: true,
                        checkTypes: true,
                    },
                    {
                        spec,
                        indexes: vanilla ? [index, vanilla] : [index],
                        baseGameKnown: vanilla !== undefined,
                    }
                );
            }),
        },
        {
            name: 'traits',
            run: wrap(({ ast, index, file, spec }) => {
                const baseTraits = baseGameOf(env)?.traits;
                if (!baseTraits) {
                    return [];
                }
                const knownTraits = new Set(baseTraits);
                for (const name of env.extractedTraits?.() ?? []) {
                    knownTraits.add(name);
                }
                for (const symbol of index.findSymbolsByType(SymbolType.TRAIT)) {
                    knownTraits.add(symbol.name);
                }
                // The workspace's trait groups (`group = x`, `group_equivalence = x`).
                for (const name of workspaceTraitNames(env.workspace?.roots() ?? [])) {
                    knownTraits.add(name);
                }
                return validateTraits(ast, {
                    enabled: true,
                    checkExistence: true,
                    checkCompatibility: false,
                    checkOpposites: false,
                    knownTraits,
                    file,
                    isScopeLink: (name) => spec.has(name, 'links'),
                });
            }),
        },
        {
            name: 'scripted-blocks',
            run: wrap(({ ast, uri }) =>
                validateScriptedParameters(
                    ast,
                    { enabled: true, checkEffects: true, checkTriggers: true },
                    uri
                )
            ),
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
            run: wrap(({ ast, spec, index }) => {
                // Without the base game its scripted triggers are unknown: no SWITCH-003.
                const vanilla = env.workspace?.vanillaRoot ? env.workspace.vanillaIndex : undefined;
                return validateSwitch(ast, {
                    enabled: true,
                    isTrigger: vanilla
                        ? (name) =>
                              spec.has(name, 'triggers') ||
                              index.hasSymbol(name, SymbolType.SCRIPTED_TRIGGER) ||
                              vanilla.hasSymbol(name, SymbolType.SCRIPTED_TRIGGER)
                        : undefined,
                });
            }),
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
