/**
 * Lookup (docs/PLAN.md item 4.8): for any name, its readings in the spec package, and where a
 * workspace defines and uses it. The answer is data; the command line, the agent server and the
 * editor's hover render it.
 */

export { DEFAULT_USES_LIMIT, lookup, type LookupOptions } from './lookup.js';
export {
    completionsAt,
    DEFAULT_COMPLETION_LIMIT,
    type CompletionAnswer,
    type CompletionCandidate,
    type CompletionInput,
    type CompletionKind,
    type CompletionPlace,
} from './complete.js';
export {
    diskFileSource,
    inForceOf,
    languageOf,
    LocalizationReader,
    type FileSource,
} from './localization.js';
export {
    boundedDistance,
    DEFAULT_SUGGESTION_BUDGET,
    DEFAULT_SUGGESTION_LIMIT,
    defaultMaxDistance,
    suggest,
    type Candidate,
    type SuggestOptions,
    type SuggestResult,
} from './suggest.js';
export type {
    BucketReading,
    DataTypesAnswer,
    DeclarationReading,
    DefinedReading,
    DefinitionAnswer,
    DefinitionGroupAnswer,
    DefinitionsAnswer,
    DescriptionAnswer,
    DescriptionSource,
    DescriptionText,
    DocumentedOnActionReading,
    DroppedReading,
    FieldReading,
    InForceAnswer,
    SharedAnswer,
    IteratorDepartureReading,
    IteratorFormAnswer,
    IteratorReading,
    KeywordParameterReading,
    KeywordRoleReading,
    KeywordTemplateReading,
    LinkFormAnswer,
    LocalizationAnswer,
    LocalizationKeyAnswer,
    LocalizationTextAnswer,
    LookupResult,
    ModifierTemplateReading,
    Reading,
    ReadingBase,
    ReadingKind,
    ReferenceAnswer,
    RetiredReading,
    ScopesAnswer,
    ScopeTypeReading,
    SinceAnswer,
    Suggestion,
    SuggestionsAnswer,
    TableEntryReading,
    TakesAnswer,
    TemplateMarkAnswer,
    TemplateTagAnswer,
    UseAnswer,
    UsesAnswer,
} from './types.js';
