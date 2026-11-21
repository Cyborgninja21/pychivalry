/**
 * Real-mod corpus, editor path (post-2.0 Phase 1 step 1.5b). runTest.ts opens one corpus
 * mod as the workspace folder of the Extension Development Host, with
 * ck3LanguageServer.gamePath set; this suite waits for the server's first full background
 * pass, then records what the editor shows, from vscode.languages.getDiagnostics()
 * restricted to the ck3-engine and ck3-plugin sources, under the `editor` key of
 * packages/engine/test/corpus/real-mods/<slug>.counts.json: files, time to first full
 * result (activation to idle), peak server RSS, the count per code, every error.
 *
 * A second test smoke-tests the 2.3 editor features on the same mod and records them under
 * the `features` key (the `editor` diagnostics record is written before and not touched):
 * the colours of one `.gui`/`.gfx` file, an on-type edit on one script file, and the CK3
 * Explorer tree (category counts, the time of its requests, one reveal checked).
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { defaultSpec, gameInfo } from 'pychivalry-engine';
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
            // The base game the server loaded (it can be another build than the spec's exe).
            game: gameInfo(
                config.get<string>('gamePath') || undefined,
                defaultSpec().data.manifest.exe.sha256
            ),
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

        // The editor shows the engine's own error findings exactly as the engine path does, in
        // every file: a file over the per-file cap keeps its errors first (2.2), so capped
        // files are compared too.
        const engineErrors: Array<{ file: string; line: number; code: string }> | undefined =
            existing.engine?.errors;
        if (engineErrors) {
            const key = (e: { file: string; line: number; code: string }) =>
                `${e.file}:${e.line}:${e.code}`;
            const fromEngine = engineErrors.map(key).sort();
            const fromEditor = errors
                .filter((e) => e.source === 'ck3-engine')
                .map(key)
                .sort();
            assert.deepStrictEqual(fromEditor, fromEngine);
        }
    });
});

/** Files under `root` with one of `extensions`, mod-relative with '/', sorted. */
function filesOf(root: string, extensions: string[]): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (extensions.includes(path.extname(entry.name).toLowerCase())) {
                out.push(path.relative(root, full).split(path.sep).join('/'));
            }
        }
    };
    walk(root);
    return out.sort();
}

suite('Real-mod corpus (editor features smoke)', () => {
    const slug = process.env.CK3_CORPUS_SLUG ?? '';
    const out = process.env.CK3_CORPUS_OUT ?? '';

    test(`${slug}: colours, on-type formatting and the CK3 Explorer`, async function () {
        this.timeout(10 * 60 * 1000);
        const extension = vscode.extensions.getExtension<CK3ExtensionApi>(
            'cyborgninja21.ck3-language-support'
        );
        assert.ok(extension, 'the extension is installed');
        const api = extension.isActive ? extension.exports : await extension.activate();
        await api.health.whenFirstFullResult();
        const folder = vscode.workspace.workspaceFolders?.[0];
        assert.ok(folder, 'the corpus mod is the workspace folder');
        const root = folder.uri.fsPath;

        // Colours: the first .gui/.gfx file (sorted) that writes a colour key with a list
        // outside a comment and in which the provider finds colour values.
        const guiFiles = filesOf(root, ['.gui', '.gfx']);
        const colourKey = /\b(color|tintcolor|fontcolor|fonttintcolor)\s*=\s*\{/;
        const candidates = guiFiles.filter((f) =>
            fs
                .readFileSync(path.join(root, f), 'utf8')
                .split(/\r?\n/)
                .some((line) => colourKey.test(line.replace(/#.*$/, '')))
        );
        let colors: Record<string, unknown> | null = null;
        let tried = 0;
        for (const candidate of candidates) {
            tried++;
            const document = await vscode.workspace.openTextDocument(
                vscode.Uri.file(path.join(root, candidate))
            );
            const found =
                (await vscode.commands.executeCommand<vscode.ColorInformation[]>(
                    'vscode.executeDocumentColorProvider',
                    document.uri
                )) ?? [];
            if (found.length === 0) {
                continue;
            }
            colors = {
                file: candidate,
                guiAndGfxFiles: guiFiles.length,
                candidatesTried: tried,
                values: found.length,
                first: document.getText(found[0].range),
            };
            break;
        }
        if (candidates.length > 0) {
            assert.ok(colors, `colour values in one of ${candidates.length} candidate files`);
        }

        // On-type: in the first script file (sorted) under events/ or common/ with a line
        // ending in '{', type Enter at the end of that line in the editor (in memory: the file
        // on disk is not touched, the editor is reverted after), ask for the on-type edits,
        // apply them, and compare the new line's indentation with the file's own first line
        // of the block.
        const scripts = filesOf(root, ['.txt']).filter((f) => /^(events|common)\//.test(f));
        let onType: Record<string, unknown> | null = null;
        for (const file of scripts) {
            const text = fs.readFileSync(path.join(root, file), 'utf8');
            const lines = text.split(/\r?\n/);
            const at = lines.findIndex(
                (l, i) => /\{\s*$/.test(l) && !l.trimStart().startsWith('#') && i + 1 < lines.length
            );
            if (at < 0) {
                continue;
            }
            const document = await vscode.workspace.openTextDocument(
                vscode.Uri.file(path.join(root, file))
            );
            const editor = await vscode.window.showTextDocument(document);
            const lineEnd = document.lineAt(at).range.end;
            const typed = new vscode.WorkspaceEdit();
            typed.insert(document.uri, lineEnd, '\n');
            assert.ok(await vscode.workspace.applyEdit(typed), 'Enter typed');
            const position = new vscode.Position(at + 1, 0);
            const edits =
                (await vscode.commands.executeCommand<vscode.TextEdit[]>(
                    'vscode.executeFormatOnTypeProvider',
                    document.uri,
                    position,
                    '\n',
                    { tabSize: 4, insertSpaces: false }
                )) ?? [];
            const formatted = new vscode.WorkspaceEdit();
            formatted.set(document.uri, edits);
            await vscode.workspace.applyEdit(formatted);
            const newIndent = document.lineAt(at + 1).text;
            const blockIndent = /^[ \t]*/.exec(lines[at + 1])![0];
            onType = {
                file,
                line: at + 2,
                typed: 'Enter at the end of a line ending in {',
                edits: edits.map((e) => ({
                    line: e.range.start.line + 1,
                    newText: JSON.stringify(e.newText),
                })),
                newLineIndentation: JSON.stringify(newIndent),
                blockFirstLineIndentation: JSON.stringify(blockIndent),
                agrees: newIndent === blockIndent,
            };
            await vscode.window.showTextDocument(editor.document);
            await vscode.commands.executeCommand('workbench.action.files.revert');
            assert.strictEqual(document.isDirty, false, 'the editor is reverted');
            assert.ok(edits.length > 0, 'an on-type edit for the new line');
            break;
        }

        // CK3 Explorer: the categories, the time of the top request and of the whole tree,
        // and one reveal.
        const started = Date.now();
        const top = await api.modExplorer.request({});
        const topMs = Date.now() - started;
        let nodes = top.length;
        let firstItem: (typeof top)[number] | undefined;
        const walkStarted = Date.now();
        const queue = [...top];
        while (queue.length > 0) {
            const node = queue.shift()!;
            const children = await api.modExplorer.getChildren(node);
            nodes += children.length;
            for (const child of children) {
                if (child.children) {
                    queue.push(child);
                } else if (!firstItem && child.location) {
                    firstItem = child;
                }
            }
        }
        const wholeTreeMs = Date.now() - walkStarted;
        let reveal: Record<string, unknown> | null = null;
        if (firstItem?.location) {
            await vscode.commands.executeCommand(
                'ck3LanguageServer.revealModItem',
                firstItem.location.uri,
                firstItem.location.range
            );
            const editor = vscode.window.activeTextEditor;
            const ok =
                editor !== undefined &&
                editor.document.uri.toString() ===
                    vscode.Uri.parse(firstItem.location.uri).toString() &&
                editor.selection.active.line === firstItem.location.range.start.line;
            reveal = {
                item: firstItem.label,
                category: firstItem.category,
                file: path
                    .relative(root, vscode.Uri.parse(firstItem.location.uri).fsPath)
                    .split(path.sep)
                    .join('/'),
                line: firstItem.location.range.start.line + 1,
                ok,
            };
            assert.ok(ok, `reveal ${firstItem.label}`);
        }
        await vscode.commands.executeCommand('workbench.action.closeAllEditors');

        const features = {
            colors,
            onType,
            tree: {
                categories: Object.fromEntries(top.map((n) => [n.label, n.count])),
                topRequestMs: topMs,
                wholeTreeMs,
                nodes,
                reveal,
            },
        };
        const file = path.join(out, `${slug}.counts.json`);
        const existing = JSON.parse(fs.readFileSync(file, 'utf8'));
        fs.writeFileSync(file, `${JSON.stringify({ ...existing, features }, null, 4)}\n`);
        assert.ok(top.length > 0, 'the tree has categories');
    });
});
