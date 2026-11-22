/**
 * The spec reader (docs/PLAN.md item 4.2): the committed package read, checked and typed, its
 * companions opened on demand, its hand-kept tables trusted by a written rule, and the name
 * lookups the checks use. Every CK3 name the core knows comes through here.
 */

export { DataTypes, dataTypesOf, type DataTypeEntry } from './data-types.js';
export {
    BUCKET_NAMES,
    type BucketName,
    type CatalogueEntry,
    type CompanionRecord,
    type Directory,
    type DirectorySchema,
    type KeywordEntry,
    type KeywordTemplate,
    type LinkForm,
    type ModifierTemplateMark,
    type RetiredEntry,
    type SchemaField,
    type ScopeRecord,
    type ScopeValidity,
    type SpecData,
    type Table,
    type TableContradiction,
    type TableEntry,
    type TableEvidence,
    type Takes,
    type TakesReading,
} from './package.js';
export {
    openSpec,
    packageFileIn,
    readChecksumFile,
    readCompanion,
    readSpec,
    sha256Hex,
    Spec,
    SPEC_FORMAT,
    SpecError,
    type Companion,
    type CompanionKey,
} from './reader.js';
export {
    Tables,
    tablesOf,
    type Child,
    type ContainerRule,
    type IteratorParam,
    type TrustDecision,
} from './tables.js';
export {
    templatePattern,
    Vocabulary,
    vocabularyOf,
    type ModifierTemplateMatch,
    type TemplateFill,
} from './vocabulary.js';
