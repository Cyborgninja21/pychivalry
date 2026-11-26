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
 * Since build step 10 it covers going to a GUI file's definitions too (`assertSameDefinitions`).
 *
 * Since build step 8 it covers formatting too (`assertSameFormatting`): every script and
 * localization file of the mod formatted by the editor's Format Document, by the command line's
 * `format` typed into a terminal on a copy of the mod, and by the agent server's `format`, with
 * sharing the base game's index on and off, gives the same text.
 *
 * Test code only, bundled into the editor tests.
 */

import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import { formatKindOf, fixTooLongToList, type WorkspaceFinding } from '@pychivalry/core';
import type { PychivalryApi } from '../extension.js';
import { checkAll, findDefinitions, formatAll } from './agent.js';
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
    /** What the language server answered for the others (docs/shared-index.md). */
    readonly shared: { readonly cli: number; readonly mcp: number };
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
        fix: null,
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
    env: Readonly<Record<string, string>> = {},
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
                ...Object.entries(env).map(([k, v]) => `set ${k}=${v}`),
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
                ...Object.entries(env).map(([k, v]) => `export ${k}=${shWord(v)}`),
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
 * A finding as the agent server gives it: a fix too long for a result has its edits left out
 * and marked (`fixTooLongToList`; the agent server's `check`).
 */
function asTheAgentGives(f: WorkspaceFinding): WorkspaceFinding {
    if (f.fix === null || !fixTooLongToList(f.fix)) {
        return f;
    }
    return {
        ...f,
        fix: {
            ...f.fix,
            alternatives: f.fix.alternatives.map((a) => ({
                title: a.title,
                edits: [],
                edits_omitted: true,
            })),
        },
    };
}

/** The variable that turns sharing the base game's index off (docs/shared-index.md). */
const SHARING_OFF = { PYCHIVALRY_SHARED_INDEX: 'off' } as const;

/**
 * Run the same-answers test on the mod VS Code has open, read over the game `game`; `work` is a
 * folder for the terminal's files. Fails naming the findings that differ.
 *
 * With sharing on (docs/shared-index.md), as a user has it: the language server lends its base
 * game, and the command line and the agent server must have been answered by it, which its
 * `pychivalry/sharing` status counts. Then both run again with sharing turned off, each loading
 * the base game itself, and must give the same findings again.
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

    // The editor: every file's findings from the language server; and as the agent server gives
    // them, a formatting fix too long for a result without its edits.
    const editor: Answer[] = [];
    const forAgent: Answer[] = [];
    for (const rel of filesUnder(mod)) {
        const result = await api.language.findings(
            vscode.Uri.file(path.join(mod, ...rel.split('/'))),
        );
        if (result.file !== null) {
            assert.equal(result.file, rel);
            editor.push(...result.findings.map(fromCore));
            forAgent.push(...result.findings.map((f) => fromCore(asTheAgentGives(f))));
        }
    }
    // What VS Code shows is what the server found, once its last diagnostics have arrived.
    const plain = only(editor, { data: false, evidence: false, fix: false });
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
    const cliGame = fromCli.summary['game'] as { shared?: unknown } | null;
    assert.equal(cliGame?.shared, true, 'the language server answered the command line');

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
    assertSame(only(forAgent, { data: true, evidence: false }), agent.findings.map(fromAgent), [
        'the editor',
        'the agent server',
    ]);
    assert.equal(agent.filesChecked, files, 'the files the agent server checked');
    const sharing = await api.language.sharing();
    assert.equal(sharing.lending, true, 'the language server lends its base game');
    const shared = { cli: sharing.answered['cli'] ?? 0, mcp: sharing.answered['mcp'] ?? 0 };
    assert.ok(shared.cli >= 1, `the command line was answered by it: ${JSON.stringify(sharing)}`);
    assert.ok(
        shared.mcp >= agent.pages,
        `every page of the agent server was answered by it: ${JSON.stringify(sharing)}`,
    );

    // The same with sharing off: the command line and the agent server each load the base game.
    const alone = await pychivalryInTerminal(
        path.join(work, 'cli-alone'),
        ['check', '--json', '--vanilla', game, mod],
        600_000,
        SHARING_OFF,
    );
    const fromAlone = parseCliJson(alone.stdout);
    assertSame(editor, fromAlone.findings, ['the editor', 'the command line alone']);
    const aloneGame = fromAlone.summary['game'] as { shared?: unknown } | null;
    assert.equal(aloneGame?.shared, false, 'the command line read the base game itself');
    const agentAlone = await checkAll({
        command: definition.command,
        args: definition.args,
        env: { ...definition.env, ...SHARING_OFF },
        ...(definition.cwd === undefined ? {} : { cwd: definition.cwd.fsPath }),
    });
    assertSame(
        only(forAgent, { data: true, evidence: false }),
        agentAlone.findings.map(fromAgent),
        ['the editor', 'the agent server alone'],
    );
    const after = await api.language.sharing();
    assert.deepEqual(
        after.answered,
        sharing.answered,
        'nothing was asked of the language server with sharing off',
    );

    return {
        files,
        findings: editor.length,
        bySeverity: bySeverity(editor),
        agentPages: agent.pages,
        cliPath: cli.found,
        shared,
    };
}

/** What the same-formatting test found: the files formatted, and those each surface left. */
export interface SameFormattingReport {
    readonly files: number;
    readonly changed: number;
    readonly left: number;
}

/**
 * Format Document on one file, the way a person runs it: the file shown in an editor, the
 * command run, the formatted text read back, then the file reverted and closed so nothing is
 * saved. The real command is used, not `vscode.executeFormatDocumentProvider`: that API command
 * cannot hand back an edit that sets the end of line (VS Code gives it a line of -1), and setting
 * `\r\n` on a file with `\n` breaks is part of what is being tested.
 */
async function formattedInEditor(uri: vscode.Uri): Promise<string> {
    const document = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(document, { preview: false });
    await vscode.commands.executeCommand('editor.action.formatDocument');
    const text = document.getText();
    await vscode.commands.executeCommand('workbench.action.files.revert');
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
    return text;
}

/**
 * Run the same-formatting test on the mod VS Code has open: each file the language server checks
 * is formatted by the editor (Format Document), the command line (`pychivalry format` on a copy
 * of the mod, typed into a terminal) and the agent server (`format`, page after page, with the
 * base game's index shared and not), and the three texts must be the same. A file left as it is
 * (a parse error) must be left by all three. Fails naming the files that differ.
 */
export async function assertSameFormatting(
    api: PychivalryApi,
    mod: string,
    work: string,
): Promise<SameFormattingReport> {
    // The files the language server checks that are script or localization files: the
    // descriptor is checked but not formatted, by any of the three.
    const files: string[] = [];
    const notFormatted: string[] = [];
    for (const rel of filesUnder(mod)) {
        const result = await api.language.findings(
            vscode.Uri.file(path.join(mod, ...rel.split('/'))),
        );
        if (result.file !== null) {
            (formatKindOf(rel) === undefined ? notFormatted : files).push(rel);
        }
    }
    assert.ok(files.length > 0, 'the mod has files to format');
    for (const rel of notFormatted) {
        const file = path.join(mod, ...rel.split('/'));
        const original = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
        assert.equal(
            await formattedInEditor(vscode.Uri.file(file)),
            original,
            `Format Document leaves ${rel} as it is`,
        );
    }

    // The editor: Format Document on each file, in an editor, then reverted.
    const editor = new Map<string, string>();
    for (const rel of files) {
        editor.set(
            rel,
            await formattedInEditor(vscode.Uri.file(path.join(mod, ...rel.split('/')))),
        );
    }

    // The command line, on a copy of the mod, from the terminal's path.
    const copy = path.join(work, 'format-copy');
    cpSync(mod, copy, { recursive: true });
    const cli = await pychivalryInTerminal(path.join(work, 'format-cli'), ['format', copy]);
    assert.equal(cli.code, 0, `pychivalry format exited ${String(cli.code)}:\n${cli.stderr}`);
    const fromCli = new Map<string, { text: string; bom: boolean }>();
    for (const rel of files) {
        const text = readFileSync(path.join(copy, ...rel.split('/')), 'utf8');
        fromCli.set(rel, { text: text.replace(/^\uFEFF/, ''), bom: text.startsWith('\uFEFF') });
    }

    // The agent server, from the definition VS Code's AI is given, sharing on and then off.
    const [definition] = await api.definitions();
    assert.ok(definition !== undefined, 'the extension gives VS Code an agent server');
    const entry = {
        command: definition.command,
        args: definition.args,
        env: definition.env,
        ...(definition.cwd === undefined ? {} : { cwd: definition.cwd.fsPath }),
    };
    const before = (await api.language.sharing()).answered['mcp'] ?? 0;
    const shared = await formatAll(entry, files);
    const after = (await api.language.sharing()).answered['mcp'] ?? 0;
    assert.ok(after - before >= files.length, 'the language server answered every format call');
    const alone = await formatAll({ ...entry, env: { ...entry.env, ...SHARING_OFF } }, files);
    assert.deepEqual(alone, shared, 'the agent server alone gives what the language server gave');

    const differ: string[] = [];
    let changed = 0;
    let left = 0;
    for (const [i, rel] of files.entries()) {
        const original = readFileSync(path.join(mod, ...rel.split('/')), 'utf8').replace(
            /^\uFEFF/,
            '',
        );
        const agent = shared[i];
        const fromAgent = agent?.changed === true ? agent.text : original;
        const inEditor = editor.get(rel) ?? '';
        const inCli = fromCli.get(rel);
        if (agent?.formatted === false) {
            left++;
        } else if (agent?.changed === true) {
            changed++;
            if (inCli?.bom !== true) {
                differ.push(`${rel}: the command line wrote no byte-order mark`);
            }
        }
        if (inEditor !== fromAgent || inCli?.text !== fromAgent) {
            differ.push(
                `${rel}: the editor ${JSON.stringify(inEditor.slice(0, 80))}, the command line ${JSON.stringify(inCli?.text.slice(0, 80))}, the agent server ${JSON.stringify(fromAgent.slice(0, 80))}`,
            );
        }
    }
    assert.deepEqual(differ, [], 'the three surfaces format alike');
    return { files: files.length, changed, left };
}

/** A definition a surface goes to, as `<layer> <file>:<line>`, the line counted from 1. */
type Target = string;

/**
 * The targets of a definition answer as the editor shows them (the language server's rule): in
 * each group, the one definition in force where the override rules name it, every definition
 * where not.
 */
function shownTargets(
    groups: readonly {
        readonly definitions: readonly {
            readonly layer: string;
            readonly file: string;
            readonly inForce: string;
            readonly line: number;
        }[];
    }[],
): Target[] {
    return groups
        .flatMap((g) => {
            const inForce = g.definitions.filter((d) => d.inForce === 'yes');
            return inForce.length === 1 ? inForce : g.definitions;
        })
        .map((d) => `${d.layer} ${d.file}:${String(d.line)}`)
        .sort();
}

/**
 * Go to definition on every place given, of one GUI file of the mod VS Code has open (build step
 * 10): VS Code's definition provider (the language server), the command line's `lookup --json` of
 * the name written there, typed into a terminal, and the agent server's `find_definition` at the
 * place must go to the same definitions. `places` are the names, each found at its first place in
 * the file where it is written as a use. Returns how many places were compared.
 */
export async function assertSameDefinitions(
    api: PychivalryApi,
    mod: string,
    game: string,
    work: string,
    file: string,
    names: readonly string[],
): Promise<number> {
    const uri = vscode.Uri.file(path.join(mod, ...file.split('/')));
    const text = readFileSync(uri.fsPath, 'utf8').replace(/^\uFEFF/, '');
    const document = await vscode.workspace.openTextDocument(uri);
    const gameRoot = path.dirname(game);
    const targetOf = (location: vscode.Location | vscode.LocationLink): Target => {
        const target = 'targetUri' in location ? location.targetUri : location.uri;
        const range = 'targetUri' in location ? location.targetRange : location.range;
        const inMod = relativeTo(mod, target.fsPath);
        if (inMod !== null) {
            return `mod ${inMod}:${String(range.start.line + 1)}`;
        }
        const inGame = relativeTo(gameRoot, target.fsPath) ?? target.fsPath;
        const [layer = '', ...rest] = inGame.split('/');
        return `${layer} ${rest.join('/')}:${String(range.start.line + 1)}`;
    };
    const [definition] = await api.definitions();
    assert.ok(definition !== undefined, 'the extension gives VS Code an agent server');
    const places = names.map((name) => {
        // Its first place as a use: a value after `=`, or a key at the start of its line.
        const offset = text.search(
            new RegExp(`(?<==[ \\t]*)${name}\\b|(?<=^[ \\t]*)${name}(?=[ \\t]*=)`, 'm'),
        );
        assert.ok(offset >= 0, name);
        const position = document.positionAt(offset + 1);
        return { name, position };
    });
    const agent = await findDefinitions(
        {
            command: definition.command,
            args: definition.args,
            env: definition.env,
            ...(definition.cwd === undefined ? {} : { cwd: definition.cwd.fsPath }),
        },
        places.map((p) => ({
            file,
            line: p.position.line + 1,
            column: p.position.character + 1,
        })),
    );
    const differ: string[] = [];
    for (const [i, place] of places.entries()) {
        const located = await vscode.commands.executeCommand<
            (vscode.Location | vscode.LocationLink)[]
        >('vscode.executeDefinitionProvider', uri, place.position);
        const inEditor = located.map(targetOf).sort();
        const answer = agent[i] ?? {};
        const fromAgent = shownTargets(
            (answer['definitions'] ?? []) as Parameters<typeof shownTargets>[0],
        );
        const cli = await pychivalryInTerminal(path.join(work, `lookup-${String(i)}`), [
            'lookup',
            place.name,
            '--json',
            '--vanilla',
            game,
            '--mod',
            mod,
        ]);
        assert.equal(cli.code, 0, `pychivalry lookup exited ${String(cli.code)}:\n${cli.stderr}`);
        const printed = JSON.parse(cli.stdout) as {
            definitions: {
                groups?: {
                    definitions: {
                        layer: string;
                        file: string;
                        inForce: string;
                        range: { start: { line: number } };
                    }[];
                }[];
            };
        };
        const fromCli = shownTargets(
            (printed.definitions.groups ?? []).map((g) => ({
                definitions: g.definitions.map((d) => ({ ...d, line: d.range.start.line + 1 })),
            })),
        );
        if (inEditor.length === 0) {
            differ.push(`${place.name}: the editor goes nowhere`);
        }
        if (
            JSON.stringify(inEditor) !== JSON.stringify(fromAgent) ||
            JSON.stringify(inEditor) !== JSON.stringify(fromCli)
        ) {
            differ.push(
                `${place.name}: the editor ${JSON.stringify(inEditor)}, the command line ${JSON.stringify(fromCli)}, the agent server ${JSON.stringify(fromAgent)}`,
            );
        }
    }
    assert.deepEqual(differ, [], 'the three surfaces go to the same definitions');
    return places.length;
}
