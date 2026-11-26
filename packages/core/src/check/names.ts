/**
 * The definitions a check can see, from the workspace index: a name is defined in a directory
 * when the index holds a definition of it there in a file the game reads (or may read; a file
 * whose read status is unknown still defines the name, since nothing says it does not).
 *
 * The checks of item 4.6 ask the index more (`WorkspaceNames`): whether a scope is saved under
 * a name, whether a localization key exists, whether a word is used anywhere, and whether the
 * base game is in the index at all. Without the base game they stay silent: a name the base
 * game saves or defines must not be reported because the base game was not read (docs/MVP.md,
 * "Lessons from 2.3.0").
 */

import {
    localizationDatabase,
    nameTemplatePattern,
    variableKey,
    variableKeyParts,
} from '../index/extract.js';
import { layerKind } from '../index/order.js';
import type { PathCaseRule } from '../index/rules.js';
import type { WorkspaceIndex } from '../index/workspace.js';
import type { DefinedNames } from './context.js';

/** What the event-target and localization checks ask the workspace index. */
export interface WorkspaceNames extends DefinedNames {
    /** True when the index holds the base game: a file of a layer other than the mod. */
    readonly baseGame: boolean;
    /**
     * Whether a scope may be saved as `name`: a save key saves it in a file the game reads or
     * may read, or some file writes the name other than as `scope:name` (an effect the package
     * does not list as a save key may save it there), or a word built with a `$PARAM$` can
     * become it (`save_scope_as = been_to_$SCENE$`). False only when no script can save it.
     */
    isScopeSaved(name: string): boolean;
    /** Whether `key` is a localization key of any language, in a file the game reads or may read. */
    isLocalizationKey(key: string): boolean;
    /**
     * Whether the base game (any layer but the mod) defines `key`, in any language, in any of
     * its files, read or not: a key of the base game's own text.
     */
    isBaseGameLocalizationKey(key: string): boolean;
    /**
     * Whether any file of the index uses the word (a script word or a `$name$`), also as a whole
     * scope chain (`WorkspaceIndex.isUsedAsChain`: a dotted key such as `my_mod.event.t` is
     * written as one), or a text file of the mod the index does not read writes it
     * (`unreadWords`).
     */
    isUsed(word: string): boolean;
    /** Whether the index holds any definition of `name`, in any database: a quick test. */
    hasDefinition(name: string): boolean;
    /** Whether `name` is the name of a definition that is no localization key: a record's. */
    isRecordName(name: string): boolean;
    /**
     * Format 9, the table `variables`: whether a variable of this namespace and kind may be set
     * as `name`: a keyword that gives such a variable its name sets it in a file the game reads
     * or may read; or one sets a name built with a `$PARAM$` that can become it
     * (`flag_$TYPE$`); or one sets a name that is only a `$PARAM$` (`name = $VAR$`) and some
     * file writes `name` other than in a variable statement (a value passed to that parameter
     * may be it). False only when no script can set it.
     */
    isVariableSet(namespace: string, holds: string, name: string): boolean;
    /**
     * Format 9, part D9: the names the text of a localization key reads as a saved scope or
     * value (`WorkspaceIndex.textScopeReads`), each once, sorted.
     */
    textScopeReads(key: string): readonly string[];
    /**
     * The files of the mod and the base game the index does not read (textures and the like),
     * for `graphics/missing-file`: those at a path, without regard to letter case, each with its
     * layer and its path as written (`WorkspaceIndex.unreadFilesAt`).
     */
    unreadFilesAt(path: string): readonly { readonly layer: string; readonly path: string }[];
    /** The layers whose unread files the index was given (`WorkspaceIndex.setUnreadFiles`). */
    readonly unreadLayers: readonly string[];
    /**
     * How the platform the index reads for compares paths that differ only in letter case: the
     * deciding `path-case` row of the rules table (part D1), or null when no row decides.
     */
    readonly pathCase: 'exact' | 'case-insensitive' | null;
}

/**
 * The names as the checks of item 4.6 need them: all of `WorkspaceNames`, with the base game
 * in the index. Undefined otherwise, and those checks then report nothing.
 */
export function withBaseGame(names: Partial<WorkspaceNames>): WorkspaceNames | undefined {
    return names.baseGame === true &&
        names.isDefined !== undefined &&
        names.isScopeSaved !== undefined &&
        names.isLocalizationKey !== undefined &&
        names.isBaseGameLocalizationKey !== undefined &&
        names.isUsed !== undefined &&
        names.hasDefinition !== undefined &&
        names.isRecordName !== undefined &&
        names.isVariableSet !== undefined &&
        names.textScopeReads !== undefined
        ? (names as WorkspaceNames)
        : undefined;
}

/** Whether a database is one of localization keys: `localization` or `localization:<language>`. */
export function isLocalizationDatabase(database: string): boolean {
    return database === localizationDatabase(null) || database.startsWith(localizationDatabase(''));
}

/** What the checks may know beside the index. */
export interface NamesOptions {
    /**
     * The words of the mod's text files the index does not read (its interface files, `.txt`
     * files of folders the spec does not describe): `unreadWords` in the index's reader. A key
     * one of them writes is used.
     */
    readonly unreadWords?: ReadonlySet<string>;
}

/** The index's definitions as the checks ask for them. */
export function definedNamesOf(index: WorkspaceIndex, options: NamesOptions = {}): WorkspaceNames {
    const unread = options.unreadWords;
    const known = new Map<string, boolean>();
    const saved = new Map<string, boolean>();
    let patterns: RegExp[] | undefined;
    const variables = new Map<string, boolean>();
    let variablePatterns:
        Map<string, { readonly patterns: RegExp[]; readonly anyName: boolean }> | undefined;
    const variableTemplatesOf = (
        namespace: string,
        holds: string,
    ): { readonly patterns: RegExp[]; readonly anyName: boolean } | undefined => {
        if (variablePatterns === undefined) {
            variablePatterns = new Map();
            for (const key of index.variableSetTemplates()) {
                const parts = variableKeyParts(key);
                if (parts === undefined) {
                    continue;
                }
                const kind = `${parts.namespace}\u0001${parts.holds}`;
                const known = variablePatterns.get(kind) ?? { patterns: [], anyName: false };
                const literal = parts.name.replace(/\$[^$\s]+\$/g, '') !== '';
                variablePatterns.set(kind, {
                    patterns: literal
                        ? [...known.patterns, nameTemplatePattern(parts.name)]
                        : known.patterns,
                    anyName: known.anyName || !literal,
                });
            }
        }
        return variablePatterns.get(`${namespace}\u0001${holds}`);
    };
    const texts = new Map<string, readonly string[]>();
    const keys = new Map<string, { any: boolean; base: boolean; record: boolean }>();
    const keyOf = (key: string): { any: boolean; base: boolean; record: boolean } => {
        let answer = keys.get(key);
        if (answer === undefined) {
            const all = index.definitions(key);
            const defined = all.filter((d) => isLocalizationDatabase(d.database));
            answer = {
                any: defined.some((d) => d.read !== 'no'),
                base: defined.some((d) => layerKind(d.layer) !== 'mod'),
                record: defined.length < all.length,
            };
            keys.set(key, answer);
        }
        return answer;
    };
    const pathCase = index.rules.find((r): r is PathCaseRule => r.kind === 'path-case');
    return {
        baseGame: index.allFiles().some((f) => layerKind(f.layer) !== 'mod'),
        unreadFilesAt: (path) => index.unreadFilesAt(path),
        unreadLayers: index.unreadFileLayers(),
        pathCase: pathCase === undefined ? null : pathCase.compare,
        isDefined(name: string, database: string): boolean {
            const key = `${database}\u0000${name}`;
            let answer = known.get(key);
            if (answer === undefined) {
                answer = index.definitions(name, { database }).some((d) => d.read !== 'no');
                known.set(key, answer);
            }
            return answer;
        },
        isScopeSaved(name: string): boolean {
            let answer = saved.get(name);
            if (answer === undefined) {
                patterns ??= index.nameTemplates().map(nameTemplatePattern);
                answer =
                    index.savedScopes(name).some((s) => s.read !== 'no') ||
                    index.isUsedBesideScopeReads(name) ||
                    patterns.some((p) => p.test(name));
                saved.set(name, answer);
            }
            return answer;
        },
        isLocalizationKey: (key) => keyOf(key).any,
        isBaseGameLocalizationKey: (key) => keyOf(key).base,
        isUsed: (word) =>
            index.isUsed(word) ||
            (word.includes('.') && index.isUsedAsChain(word)) ||
            unread?.has(word) === true,
        hasDefinition: (name) => index.hasDefinition(name),
        isRecordName: (name) => keyOf(name).record,
        isVariableSet(namespace: string, holds: string, name: string): boolean {
            const key = variableKey(namespace, holds, name);
            let answer = variables.get(key);
            if (answer === undefined) {
                const templates = variableTemplatesOf(namespace, holds);
                answer =
                    index.variableSets(namespace, holds, name).some((s) => s.read !== 'no') ||
                    (templates?.patterns.some((p) => p.test(name)) ?? false) ||
                    (templates?.anyName === true && index.isUsedBesideVariableStatements(name));
                variables.set(key, answer);
            }
            return answer;
        },
        textScopeReads(key: string): readonly string[] {
            let answer = texts.get(key);
            if (answer === undefined) {
                answer = index.textScopeReads(key);
                texts.set(key, answer);
            }
            return answer;
        },
    };
}
