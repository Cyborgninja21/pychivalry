/**
 * A script file read from its bytes: decoded (docs/encoding.md), then parsed. This is how a
 * file on disk is read; text an editor already holds goes straight to `parse`.
 */

import { decodeScript, type DecodeOptions, type FallbackEncoding } from './decode.js';
import type { InvalidStretch } from './findings.js';
import { parse, type ParseOptions, type ParseResult } from './parser.js';

export type ReadOptions = DecodeOptions & ParseOptions;

export interface ScriptFile extends ParseResult {
    /** How the bytes were decoded. */
    readonly encoding: 'utf-8' | FallbackEncoding;
    /** True when the bytes are valid UTF-8. */
    readonly validUtf8: boolean;
    /**
     * Each stretch of the bytes that is not valid UTF-8, as the decoder read it; empty for a
     * valid file. The warning `style/not-utf8` and its fix read them.
     */
    readonly invalid: readonly InvalidStretch[];
}

/** Decode a script file's bytes and parse the text. */
export function readScript(bytes: Uint8Array, options: ReadOptions = {}): ScriptFile {
    const decoded = decodeScript(bytes, options);
    const parsed = parse(decoded.text, options);
    return {
        ...parsed,
        bom: decoded.bom || parsed.bom,
        encoding: decoded.encoding,
        validUtf8: decoded.validUtf8,
        invalid: decoded.invalid,
    };
}
