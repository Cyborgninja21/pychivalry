/**
 * The engine checks (docs/PLAN.md step 4). One file per check, each a row of docs/checks.md
 * with its code, severity and evidence; `checkFile` runs them all on one parsed file.
 */

import type { FolderTable } from '../index/folders.js';
import type { LocalizationFile } from '../index/localization.js';
import type { Spec } from '../spec/reader.js';
import type { MessageCatalogue } from '../syntax/findings.js';
import type { ParseResult } from '../syntax/parser.js';
import { readContext, type DefinedNames, type FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { missingKeys } from './localization-missing-key.js';
import { unbalancedBrackets } from './localization-unbalanced-brackets.js';
import { unusedKeys } from './localization-unused-key.js';
import { modifiersOutsideUseArea } from './names-modifier-outside-use-area.js';
import { unknownEffects } from './names-unknown-effect.js';
import { unknownLinks } from './names-unknown-link.js';
import { unknownModifiers } from './names-unknown-modifier.js';
import { unknownOnActions } from './names-unknown-on-action.js';
import { unknownTriggers } from './names-unknown-trigger.js';
import type { WorkspaceNames } from './names.js';
import { undefinedEventTargets } from './scope-undefined-event-target.js';

export {
    fieldFor,
    readContext,
    type BlockKind,
    type ChainSite,
    type ChainVerdict,
    type Context,
    type DefinedNames,
    type FileReading,
    type JudgedKey,
    type JudgedModifier,
    type KeyReading,
    modifierAreaRow,
    type ModifierBlockSite,
    type ModifierReading,
    type ReadInput,
} from './context.js';
export { useAreasOf } from './names-modifier-outside-use-area.js';
export { onActionPlaces } from './names-unknown-on-action.js';
export {
    CHECK_KINDS,
    checkMessage,
    evidenceOf,
    type CheckCode,
    type CheckFinding,
    type CheckKind,
    type FindingData,
} from './finding.js';
export {
    definedNamesOf,
    isLocalizationDatabase,
    withBaseGame,
    type NamesOptions,
    type WorkspaceNames,
} from './names.js';
export { judgedLocFields, implicitRowUse, type LocField } from './localization-missing-key.js';
export { extraBracket } from './localization-unbalanced-brackets.js';
export { implicitPatterns } from './localization-unused-key.js';
export { savedScopeRead } from './scope-undefined-event-target.js';

export interface CheckInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside its mod or game folder, with `/`. */
    readonly file: string;
    readonly parsed: ParseResult;
    /**
     * The definitions the checks see (`definedNamesOf`). The checks of item 4.6 also need what
     * `WorkspaceNames` adds, with the base game in the index; without it they report nothing.
     */
    readonly names: DefinedNames & Partial<WorkspaceNames>;
    /** The spec's error catalogue, so findings carry the game's message text. */
    readonly catalogue?: MessageCatalogue | undefined;
}

/** Every finding of the engine checks on one file, in the order of where each starts. */
export function checkFile(input: CheckInput): CheckFinding[] {
    const reading: FileReading = readContext({
        spec: input.spec,
        folders: input.folders,
        file: input.file,
        tree: input.parsed.file,
        names: input.names,
    });
    const context = { lines: input.parsed.lines, catalogue: input.catalogue };
    return [
        ...unknownTriggers(reading, context),
        ...unknownEffects(reading, context),
        ...unknownLinks(reading, context),
        ...unknownModifiers(reading, context),
        ...unknownOnActions(reading, context, {
            spec: input.spec,
            tree: input.parsed.file,
            names: input.names,
        }),
        ...modifiersOutsideUseArea(reading, context, input.spec),
        ...undefinedEventTargets(input.folders, input.parsed.file, input.names, context),
        ...missingKeys(
            {
                spec: input.spec,
                folders: input.folders,
                file: input.file,
                tree: input.parsed.file,
                names: input.names,
            },
            context,
        ),
    ].sort(byPlace);
}

/** Findings in the order of where each starts, then ends, then by code. */
function byPlace(a: CheckFinding, b: CheckFinding): number {
    return a.start - b.start || a.end - b.end || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
}

export interface LocalizationCheckInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside its mod or game folder, with `/`. */
    readonly file: string;
    /** The file as the index reads it (`readLocalization`). */
    readonly parsed: LocalizationFile;
    readonly names: DefinedNames & Partial<WorkspaceNames>;
    readonly catalogue?: MessageCatalogue | undefined;
}

/** Every finding of the engine checks on one localization file, in the order of where each starts. */
export function checkLocalizationFile(input: LocalizationCheckInput): CheckFinding[] {
    const context = { lines: input.parsed.lines, catalogue: input.catalogue };
    return [
        ...unbalancedBrackets(input.file, input.parsed, context),
        ...unusedKeys(
            { spec: input.spec, folders: input.folders, loc: input.parsed, names: input.names },
            context,
        ),
    ].sort(byPlace);
}
