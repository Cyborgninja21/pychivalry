/**
 * Real-mod corpus, editor path (post-2.0 Phase 1 step 1.5b). runTest.ts opens one corpus
 * mod as the workspace folder of the Extension Development Host, with
 * ck3LanguageServer.gamePath set; this suite waits for the server's first full background
 * pass, then records what the editor shows, from vscode.languages.getDiagnostics()
 * restricted to the ck3-engine and ck3-plugin sources, under the `editor` key of
 * packages/engine/test/corpus/real-mods/<slug>.counts.json: files, time to first full
 * result (activation to idle), peak server RSS, the count per code, every error.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import type { CK3ExtensionApi } from '../../extension';

const SOURCES = new Set(['ck3-engine', 'ck3-plugin']);
const SEVERITY: Record<number, string> = {
    [vscode.DiagnosticSeverity.Error]: 'error',
    [vscode.DiagnosticSeverity.Warning]: 'warning',
    [vscode.DiagnosticSeverity.Information]: 'information',
    [vscode.DiagnosticSeverity.Hint]: 'hint',
};

interface CodeCount {
    severity: string;
    count: number;
}

/** Peak resident set (VmHWM, kB) of a process from /proc, where there is one. */
function vmHwmKb(pid: number | undefined): number | undefined {
    if (pid === undefined) {
        return undefined;
    }
    try {
        const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
        const match = /^VmHWM:\s+(\d+)\s+kB/m.exec(status);
        return match ? Number(match[1]) : undefined;
    } catch {
        return undefined;
    }
}

function codeOf(d: vscode.Diagnostic): string {
    if (typeof d.code === 'string' || typeof d.code === 'number') {
        return String(d.code);
    }
    return d.code ? String(d.code.value) : '';
}

interface Rule {
    mod: string;
    code: string;
    file?: string;
    line?: number;
    message?: string;
    classification: string;
    issue?: number;
    reason: string;
}

interface ErrorFinding {
    file: string;
    line: number;
    code: string;
    message: string;
    source: string;
}

/** classifications.json, merged as scripts/corpus-acceptance.js does (first rule wins). */
function classify(
    slug: string,
    out: string,
    errors: ErrorFinding[]
): Array<ErrorFinding & Record<string, unknown>> {
    const file = path.join(out, 'classifications.json');
    const rules: Rule[] = fs.existsSync(file)
        ? (JSON.parse(fs.readFileSync(file, 'utf8')).rules as Rule[]).filter(
              (r) => r.mod === slug || r.mod === '*'
          )
        : [];
    return errors.map((e) => {
        const rule = rules.find(
            (r) =>
                r.code === e.code &&
                (r.file === undefined || r.file === e.file) &&
                (r.line === undefined || r.line === e.line) &&
                (r.message === undefined || e.message.includes(r.message))
        );
        if (!rule) {
            return { ...e, classification: 'unclassified' };
        }
        return {
            ...e,
            classification: rule.classification,
            ...(rule.issue !== undefined ? { issue: rule.issue } : {}),
            reason: rule.reason,
        };
    });
}

suite('Real-mod corpus (editor path)', () => {
    const slug = process.env.CK3_CORPUS_SLUG ?? '';
    const out = process.env.CK3_CORPUS_OUT ?? '';

    test(`${slug}: the whole mod validates in the background`, async function () {
        this.timeout(30 * 60 * 1000);
        assert.ok(slug && out, 'CK3_CORPUS_SLUG and CK3_CORPUS_OUT are set by runTest.ts');
        const extension = vscode.extensions.getExtension<CK3ExtensionApi>(
            'cyborgninja21.ck3-language-support'
        );
        assert.ok(extension, 'the extension is installed');
        const api = extension.isActive ? extension.exports : await extension.activate();
        const idle = await api.health.whenFirstFullResult();
        const arrivedAt = api.health.firstFullResultAt ?? Date.now();
        assert.strictEqual(idle.state, 'idle');
        assert.strictEqual(idle.done, idle.total, 'every queued file was validated');
        // Let the last publishes reach the Problems panel.
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder, 'the corpus mod is the workspace folder');
        const root = folder.uri.fsPath;
        const counts: Record<string, CodeCount> = {};
        const bySeverity: Record<string, number> = {
            error: 0,
            warning: 0,
            information: 0,
            hint: 0,
        };
        const errors: ErrorFinding[] = [];
        let filesWithFindings = 0;
        // Files whose script diagnostics hit the provider's per-file cap (1000).
        const filesAtCap: string[] = [];
        for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
            const rel = path.relative(root, uri.fsPath);
            if (rel.startsWith('..') || path.isAbsolute(rel)) {
                continue;
            }
            if (diagnostics.length >= 1000) {
                filesAtCap.push(rel.split(path.sep).join('/'));
            }
            const kept = diagnostics.filter(
                (d) => typeof d.source === 'string' && SOURCES.has(d.source)
            );
            if (kept.length > 0) {
                filesWithFindings++;
            }
            for (const d of kept) {
                const code = codeOf(d);
                const severity = SEVERITY[d.severity];
                const key =
                    counts[code] && counts[code].severity !== severity
                        ? `${code}@${severity}`
                        : code;
                counts[key] = counts[key] ?? { severity, count: 0 };
                counts[key].count++;
                bySeverity[severity]++;
                if (severity === 'error') {
                    errors.push({
                        file: rel.split(path.sep).join('/'),
                        line: d.range.start.line + 1,
                        code,
                        message: d.message,
                        source: String(d.source),
                    });
                }
            }
        }
        errors.sort((a, b) =>
            a.file < b.file
                ? -1
                : a.file > b.file
                  ? 1
                  : a.line - b.line || (a.code < b.code ? -1 : 1)
        );
        const sorted: Record<string, CodeCount> = {};
        for (const key of Object.keys(counts).sort()) {
            sorted[key] = counts[key];
        }
        const config = vscode.workspace.getConfiguration('ck3LanguageServer');
        const record = {
            command: `CK3_CORPUS=<corpus dir> CK3_GAME_PATH=<game dir> xvfb-run -a task test:integration (mod ${slug})`,
            vscodeVersion: vscode.version,
            settings: {
                gamePath: config.get<string>('gamePath') ? '<game dir>' : '',
                backgroundValidation: {
                    enabled: config.get<boolean>('backgroundValidation.enabled'),
                    concurrency: config.get<number>('backgroundValidation.concurrency'),
                    fileLimit: config.get<number>('backgroundValidation.fileLimit'),
                },
            },
            sources: Array.from(SOURCES),
            filesValidated: idle.total,
            filesWithFindings,
            filesAtCap: filesAtCap.sort(),
            timeToFirstFullResultMs: arrivedAt - api.activatedAt,
            serverUptimeAtFirstFullResultMs: idle.firstFullResultMs,
            backgroundPassMs: idle.milliseconds,
            peakServerRssKb: idle.maxRssKb,
            serverVmHwmKb: vmHwmKb(idle.pid),
            longestFile: { milliseconds: idle.longestFileMs, file: idle.longestFile },
            longestScriptFile: {
                milliseconds: idle.longestScriptFileMs,
                file: idle.longestScriptFile,
            },
            longestLocalizationFile: {
                milliseconds: idle.longestLocalizationFileMs,
                file: idle.longestLocalizationFile,
            },
            bySeverity,
            counts: sorted,
            errors: classify(slug, out, errors),
        };
        const file = path.join(out, `${slug}.counts.json`);
        const existing = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
        fs.writeFileSync(file, `${JSON.stringify({ ...existing, editor: record }, null, 4)}\n`);

        // Every error-severity finding is classified (classifications.json, FINDINGS.md).
        assert.deepStrictEqual(
            record.errors.filter((e) => e.classification === 'unclassified'),
            []
        );

        // The editor shows the engine's own error findings exactly as the engine path does,
        // except in files whose diagnostics the provider caps at 1000 per file.
        const engineErrors: Array<{ file: string; line: number; code: string }> | undefined =
            existing.engine?.errors;
        if (engineErrors) {
            const capped = new Set(filesAtCap);
            const key = (e: { file: string; line: number; code: string }) =>
                `${e.file}:${e.line}:${e.code}`;
            const fromEngine = engineErrors
                .filter((e) => !capped.has(e.file))
                .map(key)
                .sort();
            const fromEditor = errors
                .filter((e) => e.source === 'ck3-engine' && !capped.has(e.file))
                .map(key)
                .sort();
            assert.deepStrictEqual(fromEditor, fromEngine);
        }
    });
});
