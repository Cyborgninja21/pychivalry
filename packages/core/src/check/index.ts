/**
 * The engine checks (docs/PLAN.md step 4). One file per check, each a row of docs/checks.md
 * with its code, severity and evidence; `checkFile` runs them all on one parsed file.
 */

import type { FolderTable } from '../index/folders.js';
import type { LocalizationFile } from '../index/localization.js';
import type { WorkspaceIndex } from '../index/workspace.js';
import type { Spec } from '../spec/reader.js';
import type { FallbackEncoding } from '../syntax/decode.js';
import type { InvalidStretch, MessageCatalogue } from '../syntax/findings.js';
import type { ParseResult } from '../syntax/parser.js';
import { adviceFindings } from './advice-checks.js';
import { readContext, type DefinedNames, type FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { definitionFindings } from './definitions.js';
import { missingKeys } from './localization-missing-key.js';
import { unbalancedBrackets } from './localization-unbalanced-brackets.js';
import { unusedKeys } from './localization-unused-key.js';
import { bareValuesInRecords } from './fields-bare-value-in-record.js';
import { missingRequiredFields } from './fields-missing-required-field.js';
import { unknownFields } from './fields-unknown-field.js';
import { wrongKindsOfValue } from './fields-wrong-kind-of-value.js';
import { unknownKeys } from './references-unknown-key.js';
import { nonCharacterShownEvents } from './structure-event-non-character-shown.js';
import { undeclaredNamespaces } from './structure-event-undeclared-namespace.js';
import { rangesMinAboveMax } from './structure-range-min-above-max.js';
import { triggeredDescOtherFields } from './structure-triggered-desc-other-field.js';
import { modifiersOutsideUseArea } from './names-modifier-outside-use-area.js';
import { unknownEffects } from './names-unknown-effect.js';
import { unknownLinks } from './names-unknown-link.js';
import { unknownModifiers } from './names-unknown-modifier.js';
import { unknownOnActions } from './names-unknown-on-action.js';
import { unknownTriggers } from './names-unknown-trigger.js';
import type { WorkspaceNames } from './names.js';
import { addToScopeMeasure, type ScopeMeasure } from './measure.js';
import { keywordUses, readScopes } from './scope.js';
import { undefinedEventTargets } from './scope-undefined-event-target.js';
import { judgedSteps, linksOnWrongScope } from './scope-link-on-wrong-scope.js';
import { wrongScopeEffects } from './scope-wrong-scope-for-effect.js';
import { wrongScopeTriggers } from './scope-wrong-scope-for-trigger.js';
import { bestPracticeFindings } from './best-practice-checks.js';
import { localizationKeyFindings } from './style-localization-key-characters.js';
import { notUtf8Finding } from './style-not-utf8.js';

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
    isAdvice,
    type AdviceCode,
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
export {
    headsOf,
    keywordUses,
    readScopes,
    type KeywordUse,
    type LinkStep,
    type Scope,
    type ScopeFrame,
    type ScopeReading,
    type UnjudgedWhy,
    type UnknownWhy,
} from './scope.js';
export { judgedSteps } from './scope-link-on-wrong-scope.js';
export { linksBetween, MAX_LINKS, type LinksBetween } from './scope-links.js';
export { fieldValueData, MAX_VALUES } from './field-values.js';
export { whatIsValid } from './valid.js';
export { addToScopeMeasure, newScopeMeasure, type ScopeMeasure } from './measure.js';
export { ADVICE_CHECKS, adviceFindings, runAdvice } from './advice-checks.js';
export {
    runBestPractice,
    BEST_PRACTICE_CHECKS,
    bestPracticeFindings,
} from './best-practice-checks.js';
export type { BestPracticeCheck, BestPracticeInput } from './best-practice.js';
export {
    bodyFieldOrder,
    FIELD_ORDERS,
    INFO_ORDER_FOLDERS,
    JUDGED_FOLDERS,
    type FieldOrder,
} from './field-order.js';
export { fieldsReadByName, judgedFields } from './style-unusual-field-order.js';
export { MAX_DEPTH } from './style-deep-nesting.js';
export { keyProblem, localizationKeyFindings } from './style-localization-key-characters.js';
export type { BestPracticeCode } from './best-practice-kinds.js';
export type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';
export {
    codeMatches,
    codesMatching,
    familyOf,
    inventoryRows,
    SLOT_NAMES,
    type Code,
    type InventoryEvidence,
    type InventoryRow,
} from './inventory.js';
export {
    capFindings,
    checkNames,
    checkSourceFile,
    checkWorkspace,
    checkWorkspaceSteps,
    type CappedFile,
    type CheckedFile,
    type CheckSource,
    type NotUtf8Reading,
    type FileCheckInput,
    GAME_NOT_LOADED,
    MAX_FINDINGS_PER_FILE,
    localizationFindings,
    openSources,
    openWorkspace,
    openWorkspaceSteps,
    scriptFindings,
    type LocalizationInput,
    type ScriptInput,
    type Workspace,
    type WorkspaceCheck,
    type WorkspaceCheckOptions,
    type WorkspaceFinding,
    type WorkspaceOptions,
    workspaceSources,
} from './workspace.js';

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
    /**
     * The workspace index that holds the file, and the file's layer in it, for the checks of
     * definitions (`definitions/*`); without it they report nothing.
     */
    readonly index?: { readonly workspace: WorkspaceIndex; readonly layer: string } | undefined;
    /**
     * Where to count what the scope checks judged (`measure.ts`), for the game-file suites;
     * nothing is counted without it.
     */
    readonly measure?: ScopeMeasure | undefined;
    /**
     * The stretches of the file that are not valid UTF-8, as the decoder read them
     * (`style/not-utf8`); none when the file is valid UTF-8 or its bytes are not known.
     */
    readonly invalid?: readonly InvalidStretch[] | undefined;
    /** How the decoder read them: as UTF-8 (by default), or with the fallback named. */
    readonly encoding?: 'utf-8' | FallbackEncoding | undefined;
}

/** Every finding of the engine checks on one file, in the order of where each starts. */
export function checkFile(input: CheckInput): CheckFinding[] {
    const read = {
        spec: input.spec,
        folders: input.folders,
        file: input.file,
        tree: input.parsed.file,
        names: input.names,
    };
    const reading: FileReading = readContext(read);
    const scopes = readScopes(read, reading);
    const uses = keywordUses(input.spec, reading, scopes);
    if (input.measure !== undefined) {
        addToScopeMeasure(input.measure, uses, judgedSteps(reading, scopes));
    }
    const context = { lines: input.parsed.lines, catalogue: input.catalogue };
    const records = {
        spec: input.spec,
        folders: input.folders,
        file: input.file,
        tree: input.parsed.file,
    };
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
        ...unknownFields(reading, context, records),
        ...bareValuesInRecords(reading, context, records),
        ...missingRequiredFields(reading, context, records),
        ...wrongKindsOfValue(reading, context, { ...records, names: input.names }),
        ...unknownKeys(reading, context, { ...records, names: input.names }),
        ...undeclaredNamespaces(context, records),
        ...rangesMinAboveMax(reading, context, records),
        ...nonCharacterShownEvents(context, records),
        ...triggeredDescOtherFields(context, {
            spec: input.spec,
            directory: reading.directory,
            tree: input.parsed.file,
        }),
        ...definitionFindings(input.spec, input.file, context, input.index),
        ...wrongScopeTriggers(uses, context, input.spec),
        ...wrongScopeEffects(uses, context, input.spec),
        ...linksOnWrongScope(reading, scopes, context, input.spec),
        ...undefinedEventTargets(input.folders, input.parsed.file, input.names, context),
        ...missingKeys({ ...records, names: input.names }, context),
        ...adviceFindings({
            spec: input.spec,
            folders: input.folders,
            file: input.file,
            tree: input.parsed.file,
            names: input.names,
            context,
            reading,
        }),
        ...bestPracticeFindings({
            spec: input.spec,
            folders: input.folders,
            file: input.file,
            tree: input.parsed.file,
            names: input.names,
            context,
            invalid: input.invalid ?? [],
            encoding: input.encoding ?? 'utf-8',
            reading,
        }),
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
    /**
     * Run `localization/unused-key`: on by default since the owner's word of 2026-11-23
     * (replacing docs/decisions.md, decision 76); `false` turns it off.
     */
    readonly unusedKeys?: boolean | undefined;
}

/**
 * Every finding of the engine checks on one localization file, in the order of where each
 * starts; `localization/unused-key` unless turned off (`unusedKeys: false`).
 */
export function checkLocalizationFile(input: LocalizationCheckInput): CheckFinding[] {
    const context = { lines: input.parsed.lines, catalogue: input.catalogue };
    const notUtf8 = notUtf8Finding(input.parsed.invalid, input.parsed.encoding, context);
    return [
        ...(notUtf8 === null ? [] : [notUtf8]),
        ...localizationKeyFindings(input.parsed, context).findings,
        ...unbalancedBrackets(input.file, input.parsed, context),
        ...(input.unusedKeys !== false
            ? unusedKeys(
                  {
                      spec: input.spec,
                      folders: input.folders,
                      loc: input.parsed,
                      names: input.names,
                  },
                  context,
              )
            : []),
    ].sort(byPlace);
}
