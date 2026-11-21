/**
 * A script file read from its bytes: decoded (docs/encoding.md), then parsed. This is how a
 * file on disk is read; text an editor already holds goes straight to `parse`.
 */

import { decodeScript, type DecodeOptions, type FallbackEncoding } from './decode.js';
import type { Finding } from './findings.js';
import { parse, type ParseOptions, type ParseResult } from './parser.js';

export type ReadOptions = DecodeOptions & ParseOptions;

export interface ScriptFile extends ParseResult {
    /** How the bytes were decoded. */
    readonly encoding: 'utf-8' | FallbackEncoding;
    /** True when the bytes are valid UTF-8. */
    readonly validUtf8: boolean;
    /** The decoding note and every parse finding, in the order of where each starts. */
    readonly allFindings: readonly Finding[];
}

/** Decode a script file's bytes and parse the text. */
export function readScript(bytes: Uint8Array, options: ReadOptions = {}): ScriptFile {
    const decoded = decodeScript(bytes, options);
    const parsed = parse(decoded.text, options);
    const allFindings = [...decoded.findings, ...parsed.findings].sort(
        (a, b) => a.start - b.start || a.end - b.end,
    );
    return {
        ...parsed,
        bom: decoded.bom || parsed.bom,
        encoding: decoded.encoding,
        validUtf8: decoded.validUtf8,
        allFindings,
    };
}
