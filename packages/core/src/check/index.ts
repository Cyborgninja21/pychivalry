/**
 * The engine checks (docs/PLAN.md step 4). One file per check, each a row of docs/checks.md
 * with its code, severity and evidence; `checkFile` runs them all on one parsed file.
 */

import type { FolderTable } from '../index/folders.js';
import type { Spec } from '../spec/reader.js';
import type { MessageCatalogue } from '../syntax/findings.js';
import type { ParseResult } from '../syntax/parser.js';
import { adviceFindings } from './advice-checks.js';
import { readContext, type DefinedNames, type FileReading } from './context.js';
import type { CheckFinding } from './finding.js';
import { modifiersOutsideUseArea } from './names-modifier-outside-use-area.js';
import { unknownEffects } from './names-unknown-effect.js';
import { unknownLinks } from './names-unknown-link.js';
import { unknownModifiers } from './names-unknown-modifier.js';
import { unknownOnActions } from './names-unknown-on-action.js';
import { unknownTriggers } from './names-unknown-trigger.js';

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
export { definedNamesOf } from './names.js';
export { ADVICE_CHECKS, adviceFindings, runAdvice } from './advice-checks.js';
export type { AdviceCheck, AdviceInput, AdviceResult } from './advice.js';

export interface CheckInput {
    readonly spec: Spec;
    readonly folders: FolderTable;
    /** The file's path inside its mod or game folder, with `/`. */
    readonly file: string;
    readonly parsed: ParseResult;
    readonly names: DefinedNames;
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
        ...adviceFindings({
            spec: input.spec,
            folders: input.folders,
            file: input.file,
            tree: input.parsed.file,
            names: input.names,
            context,
        }),
    ].sort(
        (a, b) =>
            a.start - b.start || a.end - b.end || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0),
    );
}
