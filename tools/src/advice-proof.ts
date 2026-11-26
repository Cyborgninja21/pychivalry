/**
 * The re-proof of item 4.7's advice checks on the base game (docs/PLAN.md item 4.7;
 * docs/decisions.md, rows 46 and 53): every script file the game reads, run through each
 * advice check with the base game's own index, counting the units each check judged (the
 * records, blocks or values its rule applies to) and the findings it raised there.
 *
 * A row holds when it applies to at least 10 and fires on none (row 46); otherwise it
 * `fires`, or has `too-few` to judge. The run reads the game only, never the corpus, and needs
 * no network. It writes nothing: `advice proof` prints its counts, and the findings of a row
 * that fires with the file and line of each.
 *
 * The best-practice rules of the family `style` (the owner's principle of 2026-11-23) are
 * counted the same way, on the base game's script files and, for `style/not-utf8` and
 * `style/localization-key-characters`, its localization files too (by language), but judged
 * otherwise: the zero-exceptions rule is for advice that
 * claims something about the game, and a style rule claims a best practice, so the base game
 * breaking it does not retire it. A style row `follows` when the base game breaks it at most
 * as often as it follows it (at most half the units it applies to), and is `broken` otherwise:
 * such a rule ships only on the owner's word. Each style row gives its counts by folder, and
 * lists its findings only when there are few. It also counts its findings by the fix each is
 * offered (the fix's basis, or `none`), and by what their data says the place means
 * (`data.means`, where a finding says), so that a change to what a rule offers is measured on
 * the base game by this command, not by a script of its own; and, for each fix offered, its
 * findings by the block their data names (`data.block`), most first, so that what a fix would
 * change can be looked over by the kind of block it changes.
 */

import { readFileSync } from 'node:fs';
import {
    ADVICE_CHECKS,
    catalogueFromSpec,
    checkLocalizationFile,
    checkMessage,
    currentPlatform,
    decidingRules,
    definedNamesOf,
    fixFileFindings,
    folderTableFromSpec,
    indexFiles,
    installFolders,
    listInstall,
    localizationKeyFindings,
    readLocalization,
    readScript,
    rulesFromSpec,
    runAdvice,
    runBestPractice,
    BEST_PRACTICE_CHECKS,
    type CheckFinding,
    type FixFileInput,
    type Platform,
    type Spec,
} from '@pychivalry/core';

/** The fewest units a rule must apply to (docs/decisions.md, row 46). */
export const MIN_APPLIES = 10;

/** The most findings a style row lists, file and line each; past it only its counts. */
export const MAX_STYLE_LISTED = 100;

/** The best-practice rule of localization files' keys, counted beside the script rules. */
const LOCALIZATION_KEY_CODE = 'style/localization-key-characters';

export type Verdict = 'holds' | 'fires' | 'too-few' | 'follows' | 'broken';

/** A finding of a row that fires: where, and its message. */
export interface ProofFinding {
    readonly file: string;
    readonly line: number;
    readonly message: string;
}

/** A row's counts in one folder of the base game. */
export interface FolderCount {
    readonly folder: string;
    readonly applies: number;
    readonly fires: number;
}

/** How many of a style row's findings share a name: a fix's basis, or what they mean. */
export interface NamedCount {
    readonly name: string;
    readonly fires: number;
}

/** The name under which a style row counts its findings that are offered no fix. */
export const NO_FIX = 'none';

/** The findings offered one fix, by the block their data names. */
export interface FixedBlocks {
    /** The fix's basis. */
    readonly fix: string;
    /** By block name, most first, then in code-point order. */
    readonly blocks: readonly NamedCount[];
}

/** One advice row, or one best-practice rule, on the base game. */
export interface ProofRow {
    readonly code: string;
    /** `advice` for item 4.7's rows, `style` for the best-practice rules. */
    readonly kind: 'advice' | 'style';
    readonly applies: number;
    readonly fires: number;
    readonly verdict: Verdict;
    /** Every finding of an advice row that fires; a style row's when it has few. */
    readonly findings: readonly ProofFinding[];
    /** A style row's counts by folder, in code-point order; empty for an advice row. */
    readonly byFolder: readonly FolderCount[];
    /**
     * A style row's findings by the fix each is offered: the fix's basis, or `none`, in
     * code-point order; empty for an advice row.
     */
    readonly byFix: readonly NamedCount[];
    /**
     * A style row's findings by what their data says the place means (`data.means`), in
     * code-point order, those that say nothing left out; empty for an advice row.
     */
    readonly byMeaning: readonly NamedCount[];
    /**
     * A style row's findings offered a fix, for each fix's basis in code-point order, by the
     * block their data names (`data.block`), those that name none left out; empty for an advice
     * row and for a row whose findings name no block.
     */
    readonly byFixedBlock: readonly FixedBlocks[];
}

/** A map of counts as rows, in code-point order of their names. */
function namedCounts(counts: ReadonlyMap<string, number>): NamedCount[] {
    return [...counts]
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([name, fires]) => ({ name, fires }));
}

/** A map of counts as rows, most first, then in code-point order of their names. */
function mostFirst(counts: ReadonlyMap<string, number>): NamedCount[] {
    return namedCounts(counts).sort((a, b) => b.fires - a.fires);
}

function bump(counts: Map<string, number>, name: string): void {
    counts.set(name, (counts.get(name) ?? 0) + 1);
}

export interface Proof {
    /** Script files read (the game reads them, or may). */
    readonly files: number;
    readonly rows: readonly ProofRow[];
}

/** The verdict on a count: at least `MIN_APPLIES` and no finding. */
export function verdictOf(applies: number, fires: number): Verdict {
    if (fires > 0) {
        return 'fires';
    }
    return applies < MIN_APPLIES ? 'too-few' : 'holds';
}

/** The verdict on a style rule's count: the base game follows it at least as often as it breaks it. */
export function styleVerdictOf(applies: number, fires: number): Verdict {
    return fires * 2 <= applies ? 'follows' : 'broken';
}

/** Run every advice check on the game at `gameDir`, with its own index. */
export function adviceProof(
    spec: Spec,
    gameDir: string,
    platform: Platform | undefined = currentPlatform(),
): Proof {
    const folders = folderTableFromSpec(spec.data);
    const rules = rulesFromSpec(spec);
    const catalogue = catalogueFromSpec(spec.data);
    const listing = listInstall(
        installFolders(gameDir),
        folders,
        platform === undefined ? [] : decidingRules(rules, platform),
    );
    const index = indexFiles(listing.files, { folders, rules, platform });
    const names = definedNamesOf(index);
    const counts = new Map<string, { applies: number; findings: ProofFinding[] }>(
        ADVICE_CHECKS.map((c) => [c.code, { applies: 0, findings: [] }]),
    );
    const styles = new Map<
        string,
        {
            applies: number;
            fires: number;
            findings: ProofFinding[];
            byFolder: Map<string, FolderCount>;
            byFix: Map<string, number>;
            byMeaning: Map<string, number>;
            byFixedBlock: Map<string, Map<string, number>>;
        }
    >(
        [...BEST_PRACTICE_CHECKS.map((c) => c.code), LOCALIZATION_KEY_CODE].map((code) => [
            code,
            {
                applies: 0,
                fires: 0,
                findings: [],
                byFolder: new Map(),
                byFix: new Map(),
                byMeaning: new Map(),
                byFixedBlock: new Map(),
            },
        ]),
    );
    const countStyle = (
        code: string,
        file: string,
        judged: number,
        found: readonly CheckFinding[],
        source: Pick<FixFileInput, 'source' | 'invalid'>,
    ): void => {
        const count = styles.get(code);
        if (count === undefined) {
            return;
        }
        // The fix each finding is offered, as the core makes it (no safe fix checked by applying
        // it: only its basis is counted).
        const fixes = fixFileFindings(found, { spec, folders, file, names, ...source }, undefined);
        for (const [i, f] of found.entries()) {
            const basis = fixes[i]?.basis ?? NO_FIX;
            bump(count.byFix, basis);
            const means = f.data['means'];
            if (typeof means === 'string') {
                bump(count.byMeaning, means);
            }
            const block = f.data['block'];
            if (basis !== NO_FIX && typeof block === 'string') {
                const blocks = count.byFixedBlock.get(basis) ?? new Map<string, number>();
                bump(blocks, block);
                count.byFixedBlock.set(basis, blocks);
            }
        }
        // A localization file is counted by its language's folder (`localization/english`).
        const folder = file.endsWith('.yml')
            ? file.split('/').slice(0, 2).join('/')
            : (folders.classify(file)?.folder.path ?? '(none)');
        const was = count.byFolder.get(folder) ?? { folder, applies: 0, fires: 0 };
        count.byFolder.set(folder, {
            folder,
            applies: was.applies + judged,
            fires: was.fires + found.length,
        });
        count.applies += judged;
        count.fires += found.length;
        for (const f of found) {
            if (count.findings.length < MAX_STYLE_LISTED) {
                count.findings.push({
                    file,
                    line: f.range.start.line + 1,
                    message: checkMessage(f, { file }),
                });
            }
        }
    };
    let files = 0;
    for (const file of listing.files) {
        if (index.fileStatus(file.layer, file.path)?.read === 'no') {
            continue;
        }
        if (file.path.endsWith('.yml')) {
            // A localization file: whether it is UTF-8, and the characters of its keys.
            const loc = readLocalization(readFileSync(file.disk));
            const keys = localizationKeyFindings(loc, { lines: loc.lines, catalogue });
            const source = { source: { localization: loc } };
            countStyle(LOCALIZATION_KEY_CODE, file.path, keys.judged, keys.findings, source);
            const found = checkLocalizationFile({
                spec,
                folders,
                file: file.path,
                parsed: loc,
                names,
                catalogue,
                unusedKeys: false,
            }).filter((f) => f.code === 'style/not-utf8');
            countStyle('style/not-utf8', file.path, 1, found, source);
            continue;
        }
        if (!file.path.endsWith('.txt')) {
            continue;
        }
        files++;
        const parsed = readScript(readFileSync(file.disk), { catalogue });
        const input = {
            spec,
            folders,
            file: file.path,
            tree: parsed.file,
            names,
            context: { lines: parsed.lines, catalogue },
        };
        const results = runAdvice(input);
        for (const [code, result] of results) {
            const count = counts.get(code);
            if (count === undefined) {
                continue;
            }
            count.applies += result.judged;
            for (const f of result.findings) {
                count.findings.push({
                    file: file.path,
                    line: f.range.start.line + 1,
                    message: checkMessage(f, { file: file.path }),
                });
            }
        }
        for (const [code, result] of runBestPractice({
            ...input,
            invalid: parsed.invalid,
            encoding: parsed.encoding,
        })) {
            countStyle(code, file.path, result.judged, result.findings, {
                source: { script: parsed },
                invalid: parsed.invalid,
            });
        }
    }
    const rows: ProofRow[] = [...counts].map(([code, c]) => ({
        code,
        kind: 'advice',
        applies: c.applies,
        fires: c.findings.length,
        verdict: verdictOf(c.applies, c.findings.length),
        findings: c.findings,
        byFolder: [],
        byFix: [],
        byMeaning: [],
        byFixedBlock: [],
    }));
    for (const [code, c] of styles) {
        rows.push({
            code,
            kind: 'style',
            applies: c.applies,
            fires: c.fires,
            verdict: styleVerdictOf(c.applies, c.fires),
            findings: c.fires <= MAX_STYLE_LISTED ? c.findings : [],
            byFolder: [...c.byFolder.values()]
                .filter((f) => f.applies > 0)
                .sort((a, b) => (a.folder < b.folder ? -1 : a.folder > b.folder ? 1 : 0)),
            byFix: namedCounts(c.byFix),
            byMeaning: namedCounts(c.byMeaning),
            byFixedBlock: [...c.byFixedBlock]
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([fix, blocks]) => ({ fix, blocks: mostFirst(blocks) })),
        });
    }
    return { files, rows };
}

/** A share as a percentage with two decimals. */
function percent(part: number, whole: number): string {
    return whole === 0 ? '0.00%' : `${((100 * part) / whole).toFixed(2)}%`;
}

/** Named counts on one line: `parser 20, none 3`. */
function countsLine(counts: readonly NamedCount[]): string {
    return counts.map((c) => `${c.name} ${String(c.fires)}`).join(', ');
}

/**
 * The proof as text: one line per row; a style row's findings by the fix offered, by what they
 * mean and, for each fix, by block, and its counts by folder; then each finding of a row that
 * fires.
 */
export function proofText(proof: Proof): string {
    const lines = [`advice proof: ${String(proof.files)} script files read`];
    for (const row of proof.rows) {
        const rate = row.kind === 'style' ? ` (${percent(row.fires, row.applies)})` : '';
        lines.push(
            `${row.code}: applies to ${String(row.applies)}, fires on ${String(row.fires)}${rate}: ${row.verdict}`,
        );
        if (row.byFix.length > 0) {
            lines.push(`  fixes offered: ${countsLine(row.byFix)}`);
        }
        if (row.byMeaning.length > 0) {
            lines.push(`  what they mean: ${countsLine(row.byMeaning)}`);
        }
        for (const fixed of row.byFixedBlock) {
            lines.push(`  ${fixed.fix} offered, by block: ${countsLine(fixed.blocks)}`);
        }
        for (const f of row.byFolder) {
            if (f.fires > 0 || row.code === 'style/unusual-field-order') {
                lines.push(
                    `  ${f.folder}: applies to ${String(f.applies)}, fires on ${String(f.fires)} (${percent(f.fires, f.applies)})`,
                );
            }
        }
        for (const f of row.findings) {
            lines.push(`  ${f.file}:${String(f.line)}: ${f.message}`);
        }
    }
    return `${lines.join('\n')}\n`;
}
