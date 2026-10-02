/**
 * pychivalry-engine: CK3 script → the game's own diagnostics, driven by the engine-derived
 * spec package (pdx-parser-re). Zero runtime dependencies.
 */

export * from './spec';
export * from './syntax/parser';
export { CK3Parser, CachingParser } from './syntax/parser';
export type { ParserOptions } from './syntax/parser';
export { IncrementalParser } from './syntax/incremental-parser';
export type { ContentChange } from './syntax/incremental-parser';
export { parseExpression, ExpressionError } from './syntax/expression';
export { Lexer, TokenType, classifyChain } from './syntax/lexer';
export type { Token } from './syntax/lexer';

export * from './index/indexer';
export * from './index/call-graph';
export {
    Workspace,
    WorkspaceManager,
    parseModDescriptor,
    pathToUri,
    uriToPath,
} from './index/workspace';
export type { ModDescriptor, WorkspaceFolder, WorkspaceOptions } from './index/workspace';
export { LocalizationIndex, isLocalizationFile } from './index/localization';
export { WorkspaceValidator } from './index/scheduler';
export type {
    ValidationProgress,
    ValidationState,
    ValidatorSettings,
    ValidatorStats,
    WorkspaceValidatorOptions,
} from './index/scheduler';
export type { LocalizationEntry } from './index/localization';

export { checkRegistry, blockContexts } from './check/registry';
export { contextAt } from './check/context';
export type { BlockContext, PositionContext } from './check/context';
export { checkSchema } from './check/schema';
export { checkScope, scopeValidity } from './check/scope';
export { STRUCTURAL, ITERATOR_PARAMS, MODIFIER_BLOCK_PARAMS } from './check/structural';
export type { CheckInput } from './check/types';

export { PYCH_MESSAGES, messageText } from './messages';
export { diagnose, diagnoseWorkspace, registerPlugin, registeredPluginCount } from './diagnostics';
export type { Diagnostic, Severity, Plugin, PluginContext, DiagnoseOptions } from './diagnostics';
