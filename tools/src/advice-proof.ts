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
 * lists its findings only when there are few.
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
        }
    >(
        [...BEST_PRACTICE_CHECKS.map((c) => c.code), LOCALIZATION_KEY_CODE].map((code) => [
            code,
            { applies: 0, fires: 0, findings: [], byFolder: new Map() },
        ]),
    );
    const countStyle = (
        code: string,
        file: string,
        judged: number,
        found: readonly CheckFinding[],
    ): void => {
        const count = styles.get(code);
        if (count === undefined) {
            return;
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
            countStyle(LOCALIZATION_KEY_CODE, file.path, keys.judged, keys.findings);
            const found = checkLocalizationFile({
                spec,
                folders,
                file: file.path,
                parsed: loc,
                names,
                catalogue,
                unusedKeys: false,
            }).filter((f) => f.code === 'style/not-utf8');
            countStyle('style/not-utf8', file.path, 1, found);
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
            countStyle(code, file.path, result.judged, result.findings);
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
        });
    }
    return { files, rows };
}

/** A share as a percentage with two decimals. */
function percent(part: number, whole: number): string {
    return whole === 0 ? '0.00%' : `${((100 * part) / whole).toFixed(2)}%`;
}

/** The proof as text: one line per row, then each finding of a row that fires. */
export function proofText(proof: Proof): string {
    const lines = [`advice proof: ${String(proof.files)} script files read`];
    for (const row of proof.rows) {
        const rate = row.kind === 'style' ? ` (${percent(row.fires, row.applies)})` : '';
        lines.push(
            `${row.code}: applies to ${String(row.applies)}, fires on ${String(row.fires)}${rate}: ${row.verdict}`,
        );
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
