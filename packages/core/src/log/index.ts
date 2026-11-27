/**
 * Game-log analysis (docs/PLAN.md step 11; docs/game-log.md): the catalogue's messages as
 * templates, the matcher, the reader, the ties to the mod's files, the report, what the matcher
 * makes of the catalogue, and where the game writes its logs.
 */

export {
    templateOf,
    messagePattern,
    type Conversion,
    type LogTemplate,
    type NotMatched,
    type TemplatePart,
    type ValueRole,
} from './templates.js';
export {
    LogMatcher,
    logMatcher,
    UNKNOWN_SHAPE,
    type InnerMessage,
    type LineMatch,
    type LogShape,
    type TemplateMatch,
} from './matcher.js';
export { logLines, type LogLine } from './read.js';
export { tiesOf, type LogTie, type TieContext, type Ties } from './tie.js';
export {
    analyzeLog,
    codesOfEntry,
    logShape,
    LogShapeError,
    LONGEST_LINE,
    LONGEST_SHAPE,
    TIES_PER_LINE,
    type AnalyzeOptions,
    type LogInner,
    type LogMessage,
    type LogOccurrence,
    type LogReport,
    type UnmatchedLine,
} from './analyze.js';
export {
    catalogueCoverage,
    sampleLine,
    sampleOutcome,
    STAND_IN_PREFIX,
    type CatalogueCoverage,
    type FamilyRow,
    type SampleOutcome,
} from './coverage.js';
export {
    appIdOfInstall,
    ERROR_LOG,
    logFolders,
    windowsRegistryDocuments,
    type LogFolder,
    type LogFolderBasis,
    type LogFolderSearch,
} from './folders.js';
