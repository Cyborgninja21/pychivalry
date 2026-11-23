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
 */

import { readFileSync } from 'node:fs';
import {
    ADVICE_CHECKS,
    catalogueFromSpec,
    checkMessage,
    currentPlatform,
    decidingRules,
    definedNamesOf,
    folderTableFromSpec,
    indexFiles,
    installFolders,
    listInstall,
    readScript,
    rulesFromSpec,
    runAdvice,
    type Platform,
    type Spec,
} from '@pychivalry/core';

/** The fewest units a rule must apply to (docs/decisions.md, row 46). */
export const MIN_APPLIES = 10;

export type Verdict = 'holds' | 'fires' | 'too-few';

/** A finding of a row that fires: where, and its message. */
export interface ProofFinding {
    readonly file: string;
    readonly line: number;
    readonly message: string;
}

/** One advice row on the base game. */
export interface ProofRow {
    readonly code: string;
    readonly applies: number;
    readonly fires: number;
    readonly verdict: Verdict;
    readonly findings: readonly ProofFinding[];
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
    let files = 0;
    for (const file of listing.files) {
        if (!file.path.endsWith('.txt') || index.fileStatus(file.layer, file.path)?.read === 'no') {
            continue;
        }
        files++;
        const parsed = readScript(readFileSync(file.disk), { catalogue });
        const results = runAdvice({
            spec,
            folders,
            file: file.path,
            tree: parsed.file,
            names,
            context: { lines: parsed.lines, catalogue },
        });
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
    }
    const rows = [...counts].map(([code, c]) => ({
        code,
        applies: c.applies,
        fires: c.findings.length,
        verdict: verdictOf(c.applies, c.findings.length),
        findings: c.findings,
    }));
    return { files, rows };
}

/** The proof as text: one line per row, then each finding of a row that fires. */
export function proofText(proof: Proof): string {
    const lines = [`advice proof: ${String(proof.files)} script files read`];
    for (const row of proof.rows) {
        lines.push(
            `${row.code}: applies to ${String(row.applies)}, fires on ${String(row.fires)}: ${row.verdict}`,
        );
        for (const f of row.findings) {
            lines.push(`  ${f.file}:${String(f.line)}: ${f.message}`);
        }
    }
    return `${lines.join('\n')}\n`;
}
