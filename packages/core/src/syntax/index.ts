/**
 * The syntax layer of the core (docs/PLAN.md, step 2): decoding, positions, the lexer, the
 * tree, the parser with its error recovery, incremental re-parse, and the findings they
 * report. What it reads is written in docs/encoding.md.
 */

export { readArithmetic, type Arithmetic, type ArithmeticResult } from './arithmetic.js';
export {
    decodeScript,
    decodeWindows1252,
    invalidUtf8,
    readingOf,
    type Decoded,
    type DecodeOptions,
    type FallbackEncoding,
} from './decode.js';
export {
    catalogueFromSpec,
    fillPlaceholders,
    FINDING_KINDS,
    findingMessage,
    placeholderCount,
    readableMessage,
    severityOf,
    type Evidence,
    type Finding,
    type FindingId,
    type FindingKind,
    type GuiFindingId,
    type ScriptFindingId,
    type MessageCatalogue,
    type MessageContext,
    type Severity,
    type Slot,
} from './findings.js';
export {
    chainSegments,
    classifyWord,
    OPERATORS,
    tokenize,
    unquote,
    type OperatorText,
    type Token,
    type WordType,
} from './lexer.js';
export { parse, reparse, type ParseOptions, type ParseResult, type TextEdit } from './parser.js';
export { LineIndex, type Position, type Range } from './position.js';
export { readScript, type ReadOptions, type ScriptFile } from './read.js';
export {
    blockOf,
    blockShape,
    fileConstants,
    significantItems,
    type Block,
    type Comment,
    type FileNode,
    type Item,
    type Node,
    type Operator,
    type Pair,
    type Scalar,
    type ScalarType,
    type Tagged,
    type Value,
} from './tree.js';
