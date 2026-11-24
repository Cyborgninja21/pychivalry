/**
 * The formatter's round trip (docs/PLAN.md item 8.3), part of `task game:parse`: every script
 * file the parse suite reads is formatted with the rules every surface uses
 * (docs/formatting.md), and
 *
 * - **the tree is unchanged**: the output parsed gives the input's tree, compared without
 *   offsets (`compareFormatted`: the same items in the same order and nesting, of the same
 *   kinds; scalars with the same type, text, value, closing and chain segments; pairs with the
 *   same name before the key, key, operator and value; blocks closed alike; comments with the
 *   same text but for the spaces and tabs at their end), with the same tokens and the same parse
 *   findings by kind and values;
 * - **a second format changes nothing**, byte for byte;
 * - **no comment is lost or moved**: counted before and after, and each with the same tokens
 *   around it and alone on its line exactly when it was.
 *
 * A file with a parse error is left as it is, and listed. Since the base game is not written in
 * the format, the suite also says how much the formatter changes: files and lines changed, and
 * by rule (the `style/` hints, `format/style.ts`), the lines wider than 120 columns before and
 * after, and how many files the 120-column rule changes on its own (formatted with and without
 * it). The base game's localization files are formatted the same way, their reading compared.
 */

import path from 'node:path';
import {
    blockOf,
    blockShape,
    compareFormatted,
    FORMAT_RULES,
    formatText,
    layoutScript,
    lineColumns,
    styleOf,
    type Block,
    type FormatKind,
    type Item,
    type StyleCode,
    parse,
} from '@pychivalry/core';

/** Blocks of one kind: written on one line or over several, and laid out on one or several. */
export interface BlockLayout {
    kind: 'one-simple-pair' | 'plain-values' | 'empty' | 'other';
    written_one_line_kept: number;
    written_one_line_broken: number;
    written_several_joined: number;
    written_several_kept: number;
}

/** One rule's share of what the formatter changes. */
export interface RuleCount {
    code: StyleCode;
    files: number;
    places: number;
    lines: number;
}

export interface RoundTripResults {
    rules: string;
    files: number;
    formatted: number;
    left: { file: string; id: string; line: number }[];
    changed: number;
    trees_equal: number;
    tokens_equal: number;
    second_format_unchanged: number;
    comments_before: number;
    comments_after: number;
    comments_moved: number;
    lines_before: number;
    lines_after: number;
    lines_changed: number;
    blocks_written_on_one_line_broken: number;
    blocks: BlockLayout[];
    by_rule: RuleCount[];
    width: {
        columns: number;
        tab_columns: number;
        lines_over_before: number;
        files_with_lines_over_before: number;
        lines_over_without_width_rule: number;
        lines_over_after: number;
        files_changed_by_width_alone: number;
    };
    format_ms: number;
    largest_file: { file: string; bytes: number; format_ms: number } | null;
    failures: string[];
}

/** The lines of a text, without their line breaks. */
function linesOf(text: string): string[] {
    return text.replace(/^\uFEFF/, '').split(/\r\n|\r|\n/);
}

/** How many lines of `text` (without its mark) the edits touch. */
function linesTouched(body: string, edits: readonly { start: number; end: number }[]): number {
    const starts = lineStartsOf(body);
    const touched = new Set<number>();
    for (const edit of edits) {
        const from = lineAt(starts, edit.start);
        const to = lineAt(starts, Math.max(edit.start, edit.end - 1));
        for (let n = from; n <= to; n++) {
            touched.add(n);
        }
    }
    return touched.size;
}

/** A round trip being counted, file by file. */
export class RoundTrip {
    private readonly results: RoundTripResults;
    private readonly ruleFiles = new Map<
        StyleCode,
        { files: number; places: number; lines: number }
    >();

    constructor(private readonly kind: FormatKind) {
        this.results = {
            rules: `docs/formatting.md: ${JSON.stringify(FORMAT_RULES)}`,
            files: 0,
            formatted: 0,
            left: [],
            changed: 0,
            trees_equal: 0,
            tokens_equal: 0,
            second_format_unchanged: 0,
            comments_before: 0,
            comments_after: 0,
            comments_moved: 0,
            lines_before: 0,
            lines_after: 0,
            lines_changed: 0,
            blocks_written_on_one_line_broken: 0,
            blocks: (['one-simple-pair', 'plain-values', 'empty', 'other'] as const).map(
                (kind) => ({
                    kind,
                    written_one_line_kept: 0,
                    written_one_line_broken: 0,
                    written_several_joined: 0,
                    written_several_kept: 0,
                }),
            ),
            by_rule: [],
            width: {
                columns: FORMAT_RULES.width,
                tab_columns: 4,
                lines_over_before: 0,
                files_with_lines_over_before: 0,
                lines_over_without_width_rule: 0,
                lines_over_after: 0,
                files_changed_by_width_alone: 0,
            },
            format_ms: 0,
            largest_file: null,
            failures: [],
        };
    }

    /** Format one file's text (with its mark, if any) and count what the round trip proves. */
    add(file: string, text: string): void {
        const r = this.results;
        r.files++;
        const started = performance.now();
        const result = formatText(text, this.kind);
        const ms = performance.now() - started;
        r.format_ms += ms;
        if (r.largest_file === null || text.length > r.largest_file.bytes) {
            r.largest_file = { file, bytes: Buffer.byteLength(text), format_ms: Math.round(ms) };
        }
        if (result.left !== null) {
            r.left.push({ file, id: result.left.id, line: result.left.line + 1 });
            if (result.text !== text) {
                r.failures.push(`${file}: left as it is, but its text changed`);
            }
            return;
        }
        r.formatted++;
        const comparison = compareFormatted(text, result.text, this.kind);
        if (comparison.sameTree) {
            r.trees_equal++;
        } else {
            r.failures.push(`${file}: the tree changed: ${comparison.difference ?? ''}`);
        }
        if (comparison.sameTokens) {
            r.tokens_equal++;
        } else if (comparison.sameTree) {
            r.failures.push(`${file}: the tokens changed: ${comparison.difference ?? ''}`);
        }
        r.comments_before += comparison.commentsBefore;
        r.comments_after += comparison.commentsAfter;
        r.comments_moved += comparison.commentsMoved;
        if (
            comparison.commentsAfter !== comparison.commentsBefore ||
            comparison.commentsMoved > 0
        ) {
            r.failures.push(
                `${file}: comments ${String(comparison.commentsBefore)} before, ${String(comparison.commentsAfter)} after, ${String(comparison.commentsMoved)} moved`,
            );
        }
        const again = formatText(result.text, this.kind);
        if (again.text === result.text) {
            r.second_format_unchanged++;
        } else {
            r.failures.push(`${file}: a second format changes it`);
        }
        const before = linesOf(text);
        const after = linesOf(result.text);
        r.lines_before += before.length;
        r.lines_after += after.length;
        const bom = text.startsWith('\uFEFF');
        const body = bom ? text.slice(1) : text;
        if (result.changed) {
            r.changed++;
            r.lines_changed += linesTouched(
                body,
                result.edits
                    .filter((e) => !(e.start === 0 && e.end === (bom ? 1 : 0)))
                    .map((e) => ({ start: e.start - (bom ? 1 : 0), end: e.end - (bom ? 1 : 0) })),
            );
        }
        r.blocks_written_on_one_line_broken += result.split;
        if (this.kind === 'script') {
            this.countBlocks(text);
        }
        // The width: lines over it before and after, and what the rule changes on its own.
        const over = (lines: readonly string[]): number =>
            lines.filter(
                (l) => l.length > FORMAT_RULES.width / 4 && lineColumns(l) > FORMAT_RULES.width,
            ).length;
        const overBefore = over(before);
        r.width.lines_over_before += overBefore;
        r.width.files_with_lines_over_before += overBefore > 0 ? 1 : 0;
        r.width.lines_over_after += over(after);
        if (this.kind === 'script') {
            const unlimited = formatText(text, this.kind, {
                rules: { ...FORMAT_RULES, width: Number.POSITIVE_INFINITY },
            });
            r.width.lines_over_without_width_rule += over(linesOf(unlimited.text));
            if (unlimited.text !== result.text) {
                r.width.files_changed_by_width_alone++;
            }
        }
        // By rule: the style hints of the file.
        const starts = lineStartsOf(body);
        const seen = new Set<StyleCode>();
        const lines = new Map<StyleCode, Set<number>>();
        for (const place of styleOf(this.kind, body, bom)) {
            if (place.code === 'style/not-formatted') {
                continue;
            }
            const row = this.ruleFiles.get(place.code) ?? { files: 0, places: 0, lines: 0 };
            this.ruleFiles.set(place.code, row);
            row.places++;
            if (!seen.has(place.code)) {
                seen.add(place.code);
                row.files++;
            }
            const set = lines.get(place.code) ?? new Set<number>();
            lines.set(place.code, set);
            for (const edit of place.edits) {
                const from = lineAt(starts, edit.start);
                const to = lineAt(starts, Math.max(edit.start, edit.end - 1));
                for (let n = from; n <= to; n++) {
                    set.add(n);
                }
            }
        }
        for (const [code, set] of lines) {
            const row = this.ruleFiles.get(code);
            if (row !== undefined) {
                row.lines += set.size;
            }
        }
    }

    /** Each block of a script's text by its kind, as written and as laid out. */
    private countBlocks(text: string): void {
        const layout = layoutScript(text);
        const body = layout.body;
        const stack: (readonly Item[])[] = [];
        const parsed = layoutParse(text);
        stack.push(parsed);
        const simple = (item: Item): boolean =>
            item.kind === 'pair' &&
            item.prefix === null &&
            item.value !== null &&
            (item.value.kind === 'scalar' || item.value.kind === 'operator');
        const count = (block: Block): void => {
            const items = block.items.filter((i) => i.kind !== 'comment');
            const shape = blockShape(block);
            const kind =
                shape === 'empty'
                    ? 'empty'
                    : shape === 'list'
                      ? 'plain-values'
                      : items.length === 1 && items[0] !== undefined && simple(items[0])
                        ? 'one-simple-pair'
                        : 'other';
            const row = this.results.blocks.find((b) => b.kind === kind);
            if (row === undefined) {
                return;
            }
            const written = !/[\r\n]/.test(body.slice(block.start, block.end));
            const flat = layout.flatBlocks.has(block.start);
            if (written) {
                row[flat ? 'written_one_line_kept' : 'written_one_line_broken']++;
            } else {
                row[flat ? 'written_several_joined' : 'written_several_kept']++;
            }
            stack.push(block.items);
        };
        for (let items = stack.pop(); items !== undefined; items = stack.pop()) {
            for (const item of items) {
                if (item.kind === 'block') {
                    count(item);
                } else if (item.kind === 'pair') {
                    const block = blockOf(item.value);
                    if (block !== undefined) {
                        count(block);
                    }
                }
            }
        }
    }

    /** The results, the times rounded. */
    done(): RoundTripResults {
        const order: StyleCode[] = [
            'style/indentation',
            'style/spacing',
            'style/comment-spacing',
            'style/trailing-whitespace',
            'style/blank-lines',
            'style/block-layout',
            'style/line-endings',
            'style/byte-order-mark',
        ];
        return {
            ...this.results,
            by_rule: order
                .filter((code) => this.ruleFiles.has(code))
                .map((code) => ({
                    code,
                    ...(this.ruleFiles.get(code) ?? { files: 0, places: 0, lines: 0 }),
                })),
            format_ms: Math.round(this.results.format_ms),
        };
    }
}

/** The items of a script text's tree. */
function layoutParse(text: string): readonly Item[] {
    return parse(text).file.items;
}

/** Where each line of a text starts. */
function lineStartsOf(text: string): number[] {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        if (c === 10 || (c === 13 && text.charCodeAt(i + 1) !== 10)) {
            starts.push(i + 1);
        }
    }
    return starts;
}

/** The line (from 0) that holds an offset. */
function lineAt(starts: readonly number[], offset: number): number {
    let low = 0;
    let high = starts.length - 1;
    while (low < high) {
        const mid = (low + high + 1) >> 1;
        if ((starts[mid] ?? 0) <= offset) {
            low = mid;
        } else {
            high = mid - 1;
        }
    }
    return low;
}

/** A file's path written with `/`. */
export function slashed(file: string): string {
    return file.split(path.sep).join('/');
}
