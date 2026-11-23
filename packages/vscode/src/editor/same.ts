/**
 * The same-answers test (docs/PLAN.md, item 7.9; docs/MVP.md, definition of done 4), inside a
 * real VS Code: one mod through the editor, the command line and the agent server, and the three
 * finding lists must be identical.
 *
 * - **The editor:** once the language server's background pass has left nothing to check, every
 *   file of the mod is asked for its findings through the server's `pychivalry/findings`
 *   request, and the diagnostics VS Code shows for each file must be those findings.
 * - **The command line:** `pychivalry check --json --vanilla <game> <mod>`, typed into a terminal
 *   of this VS Code, so the `pychivalry` it runs is the one the extension put on the terminal's
 *   path (item 7.7).
 * - **The agent server:** started from the definition the extension gives VS Code's AI, which
 *   carries the game folder the setting `pychivalry.gamePath` names, and asked `check` with every
 *   severity, page after page to the end.
 *
 * Test code only, bundled into the editor tests.
 */

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import type { PychivalryApi } from '../extension.js';
import { checkAll } from './agent.js';
import {
    bySeverity,
    differences,
    fromAgent,
    fromCore,
    only,
    parseCliJson,
    sorted,
    type Answer,
    type Severity,
} from './answers.js';
import { waitFor } from './harness.js';

/** What the test found: the findings each surface reported, which are the same. */
export interface SameAnswersReport {
    readonly files: number;
    readonly findings: number;
    readonly bySeverity: Record<Severity, number>;
    readonly agentPages: number;
    readonly cliPath: string;
}

/** Every file below `dir`, relative to it and written with `/`. */
function filesUnder(dir: string, base = dir): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory()
            ? filesUnder(full, base)
            : [path.relative(base, full).split(path.sep).join('/')];
    });
}

/** A path relative to the mod, or null for a file outside it. */
function relativeTo(mod: string, file: string): string | null {
    const rel = path.relative(mod, file);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return null;
    }
    return rel.split(path.sep).join('/');
}

const SEVERITY: Readonly<Record<number, Severity>> = {
    [vscode.DiagnosticSeverity.Error]: 'error',
    [vscode.DiagnosticSeverity.Warning]: 'warning',
    [vscode.DiagnosticSeverity.Information]: 'information',
    [vscode.DiagnosticSeverity.Hint]: 'hint',
};

/** A diagnostic VS Code shows, as an answer without data or evidence (it shows neither). */
function fromDiagnostic(file: string, d: vscode.Diagnostic): Answer {
    const code =
        typeof d.code === 'object'
            ? String(d.code.value)
            : d.code === undefined
              ? ''
              : String(d.code);
    return {
        file,
        line: d.range.start.line,
        character: d.range.start.character,
        endLine: d.range.end.line,
        endCharacter: d.range.end.character,
        severity: SEVERITY[d.severity] ?? String(d.severity),
        code,
        message: d.message,
        data: null,
        evidence: null,
    };
}

/** The pychivalry diagnostics VS Code shows for the mod's files. */
function shownDiagnostics(mod: string): Answer[] {
    const out: Answer[] = [];
    for (const [uri, diagnostics] of vscode.languages.getDiagnostics()) {
        const rel = uri.scheme === 'file' ? relativeTo(mod, uri.fsPath) : null;
        if (rel === null) {
            continue;
        }
        for (const d of diagnostics) {
            if (d.source === 'pychivalry') {
                out.push(fromDiagnostic(rel, d));
            }
        }
    }
    return out;
}

/** A POSIX shell word: single quotes, each `'` closed, escaped and opened again. */
function shWord(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * An argument in a batch file that `call`s another: in double quotes. `call` reads the line a
 * second time, expanding `%` and doubling `^` once more, so an argument holding either, or a
 * quote, is refused; the tests' paths hold none.
 */
function cmdWord(value: string): string {
    if (/["%^!\r\n]/.test(value)) {
        throw new Error(`a terminal test argument cannot hold " % ^ ! or a line break: ${value}`);
    }
    return `"${value}"`;
}

/**
 * Type `pychivalry <args>` into a new terminal of this VS Code, as a person would, with its
 * output, its error output and the path of the `pychivalry` the terminal found written to files
 * in `work`; wait for it to finish. On Linux the terminal runs `/bin/sh`, on Windows `cmd.exe`,
 * each running a script file, so no shell's own profile is read.
 */
export async function pychivalryInTerminal(
    work: string,
    args: readonly string[],
    ms = 600_000,
): Promise<{
    readonly code: number;
    readonly stdout: string;
    readonly stderr: string;
    readonly found: string;
}> {
    mkdirSync(work, { recursive: true });
    const at = (name: string): string => path.join(work, name);
    const win = process.platform === 'win32';
    let shellPath: string;
    let shellArgs: string[];
    if (win) {
        const q = (p: string): string => `"${p.replace(/%/g, '%%')}"`;
        // `call` runs the launcher, a batch file, and comes back.
        writeFileSync(
            at('run.cmd'),
            [
                '@echo off',
                `where pychivalry > ${q(at('found'))}`,
                `call pychivalry ${args.map(cmdWord).join(' ')} > ${q(at('out'))} 2> ${q(at('err'))}`,
                // The redirection first: `echo 1> file` would redirect stream 1 instead.
                `> ${q(at('code.tmp'))} echo %ERRORLEVEL%`,
                `move /y ${q(at('code.tmp'))} ${q(at('code'))} > nul`,
                '',
            ].join('\r\n'),
        );
        shellPath = process.env['ComSpec'] ?? 'cmd.exe';
        shellArgs = ['/d', '/c', at('run.cmd')];
    } else {
        writeFileSync(
            at('run.sh'),
            [
                `command -v pychivalry > ${shWord(at('found'))}`,
                `pychivalry ${args.map(shWord).join(' ')} > ${shWord(at('out'))} 2> ${shWord(at('err'))}`,
                `echo $? > ${shWord(at('code.tmp'))}`,
                `mv ${shWord(at('code.tmp'))} ${shWord(at('code'))}`,
                '',
            ].join('\n'),
        );
        shellPath = '/bin/sh';
        shellArgs = [at('run.sh')];
    }
    const terminal = vscode.window.createTerminal({
        name: 'pychivalry test',
        shellPath,
        shellArgs,
        cwd: work,
    });
    terminal.show(true);
    try {
        await waitFor('the command in the terminal to finish', () => existsSync(at('code')), ms);
    } finally {
        terminal.dispose();
    }
    return {
        code: Number(readFileSync(at('code'), 'utf8').trim()),
        stdout: readFileSync(at('out'), 'utf8'),
        stderr: existsSync(at('err')) ? readFileSync(at('err'), 'utf8') : '',
        found: readFileSync(at('found'), 'utf8').trim(),
    };
}

function assertSame(
    left: readonly Answer[],
    right: readonly Answer[],
    names: readonly [string, string],
): void {
    const diff = differences(sorted(left), sorted(right), names);
    assert.deepEqual(
        diff,
        [],
        `${names[0]} (${String(left.length)}) and ${names[1]} (${String(right.length)}) differ:\n${diff.join('\n')}`,
    );
}

/**
 * Run the same-answers test on the mod VS Code has open, read over the game `game`; `work` is a
 * folder for the terminal's files. Fails naming the findings that differ.
 */
export async function assertSameAnswers(
    api: PychivalryApi,
    mod: string,
    game: string,
    work: string,
): Promise<SameAnswersReport> {
    // The files the language server checks: every file of its background pass, all of them.
    const full = await api.language.firstFullResult;
    assert.ok(full.done.complete && !full.done.limited, JSON.stringify(full.done));
    const files = full.done.total;

    // The editor: every file's findings from the language server.
    const editor: Answer[] = [];
    for (const rel of filesUnder(mod)) {
        const result = await api.language.findings(
            vscode.Uri.file(path.join(mod, ...rel.split('/'))),
        );
        if (result.file !== null) {
            assert.equal(result.file, rel);
            editor.push(...result.findings.map(fromCore));
        }
    }
    // What VS Code shows is what the server found, once its last diagnostics have arrived.
    const plain = only(editor, { data: false, evidence: false });
    let shown: Answer[] = [];
    await waitFor(
        "VS Code's diagnostics to be the server's findings",
        () => {
            shown = shownDiagnostics(mod);
            return differences(sorted(plain), sorted(shown), ['', '']).length === 0;
        },
        60_000,
    ).catch(() => undefined);
    assertSame(plain, shown, ['the language server', 'VS Code']);

    // The command line, from the terminal's path.
    const cli = await pychivalryInTerminal(path.join(work, 'cli'), [
        'check',
        '--json',
        '--vanilla',
        game,
        mod,
    ]);
    assert.ok(
        cli.code === 0 || cli.code === 1,
        `pychivalry check exited ${String(cli.code)}:\n${cli.stderr}`,
    );
    const fromCli = parseCliJson(cli.stdout);
    assertSame(editor, fromCli.findings, ['the editor', 'the command line']);
    assert.equal(fromCli.summary['files_checked'], files, 'the files the command line checked');

    // The agent server, from the definition VS Code's AI is given.
    const [definition] = await api.definitions();
    assert.ok(definition !== undefined, 'the extension gives VS Code an agent server');
    assert.deepEqual(
        definition.args.slice(-2),
        ['--vanilla', game],
        'the game folder setting reaches the agent server',
    );
    const agent = await checkAll({
        command: definition.command,
        args: definition.args,
        env: definition.env,
        ...(definition.cwd === undefined ? {} : { cwd: definition.cwd.fsPath }),
    });
    assertSame(only(editor, { data: true, evidence: false }), agent.findings.map(fromAgent), [
        'the editor',
        'the agent server',
    ]);
    assert.equal(agent.filesChecked, files, 'the files the agent server checked');

    return {
        files,
        findings: editor.length,
        bySeverity: bySeverity(editor),
        agentPages: agent.pages,
        cliPath: cli.found,
    };
}
