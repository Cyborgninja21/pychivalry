/**
 * The `smoke` editor suite (docs/PLAN.md, items 7.9 and 7.11): the packaged extension, the
 * `.vsix` `task vscode:package` writes, installed by VS Code's own installer into a clean
 * extensions folder, on a copy of the planted-defect mod read over its game stub, which the
 * setting `pychivalry.gamePath` names. It activates; the language server's diagnostics appear;
 * hover and completion answer; the agent server's definition is given to VS Code's AI with the
 * game folder; the command line runs from the terminal's path; and the editor, the command line
 * and the agent server give the same findings.
 */

import { openSpec } from '@pychivalry/core';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import * as vscode from 'vscode';
import type { PychivalryApi } from '../extension.js';
import { EXTENSION_ID } from '../ids.js';
import { CLI_FILE, LSP_FILE, LSP_FOLDER, SERVER_FILE, SPEC_FOLDER } from '../launch.js';
import { BIN_FOLDER } from '../terminal.js';
import { isInside, sameFile, samePath } from './fixture.js';
import { given, type EditorCase } from './harness.js';
import { activeExtension, displayCase } from './main.js';
import { assertSameAnswers, assertSameFormatting, pychivalryInTerminal } from './same.js';

/** Every file below `dir`, relative to it and written with `/`. */
function filesUnder(dir: string, base = dir): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const full = path.join(dir, e.name);
        return e.isDirectory()
            ? filesUnder(full, base)
            : [path.relative(base, full).split(path.sep).join('/')];
    });
}

/** The line and character of the first `needle` in a file's text, plus `shift` characters. */
function at(text: string, needle: string, shift = 0): vscode.Position {
    const offset = text.indexOf(needle);
    assert.ok(offset >= 0, needle);
    const before = text.slice(0, offset + shift);
    const line = before.split('\n').length - 1;
    return new vscode.Position(line, before.length - before.lastIndexOf('\n') - 1);
}

function labelOf(item: vscode.CompletionItem): string {
    return typeof item.label === 'string' ? item.label : item.label.label;
}

export function smokeCases(): readonly EditorCase[] {
    const mod = given('PYCHIVALRY_TEST_MOD');
    const game = given('PYCHIVALRY_TEST_GAME');
    const work = given('PYCHIVALRY_TEST_WORK');
    const extensionsDir = given('PYCHIVALRY_TEST_EXTENSIONS');
    const version = given('PYCHIVALRY_TEST_VERSION');
    let ext: vscode.Extension<PychivalryApi> | undefined;
    const theExt = (): vscode.Extension<PychivalryApi> => {
        assert.ok(ext !== undefined, 'the extension did not activate');
        return ext;
    };
    const spec = (): ReturnType<typeof openSpec> =>
        openSpec(path.join(theExt().extensionPath, 'dist', 'bundle', 'server', SPEC_FOLDER));

    return [
        displayCase(),
        {
            name: '7.11: the packaged extension, installed from its .vsix, activates on its own on the mod',
            run: async () => {
                ext = await activeExtension();
                assert.equal((ext.packageJSON as { version: string }).version, version);
                assert.equal(
                    path.relative(extensionsDir, ext.extensionPath),
                    `${EXTENSION_ID}-${version}`,
                );
                const files = filesUnder(ext.extensionPath);
                for (const want of [
                    'package.json',
                    'dist/bundle/extension.cjs',
                    `dist/bundle/${LSP_FOLDER}/${LSP_FILE}`,
                    `dist/bundle/server/${SERVER_FILE}`,
                    `dist/bundle/server/${CLI_FILE}`,
                    'dist/bundle/server/manifest.json',
                ]) {
                    assert.ok(files.includes(want), `${want} is in the installed extension`);
                }
                assert.ok(files.some((f) => f.startsWith(`dist/bundle/server/${SPEC_FOLDER}/`)));
                const unwanted = files.filter((f) =>
                    /(^|\/)(src|legacy|fixtures|test-bundle|node_modules)\/|\.(ts|map)$|\.test\./.test(
                        f,
                    ),
                );
                assert.deepEqual(unwanted, [], 'no source, test, fixture or source map');
                const folders = vscode.workspace.workspaceFolders ?? [];
                assert.ok(samePath(folders[0]?.uri.fsPath ?? '', mod));
            },
        },
        {
            name: '7.11: the language server checks the whole mod and its diagnostics appear',
            run: async () => {
                const full = await theExt().exports.language.firstFullResult;
                assert.ok(full.done.complete, JSON.stringify(full.done));
                assert.ok(
                    full.done.checked === full.done.total && full.done.total > 0,
                    JSON.stringify(full.done),
                );
                const shown = vscode.languages
                    .getDiagnostics()
                    .filter(([uri]) => isInside(uri.fsPath, mod))
                    .flatMap(([, ds]) => ds.filter((d) => d.source === 'pychivalry'));
                const codes = new Set(
                    shown.map((d) => (typeof d.code === 'object' ? String(d.code.value) : '')),
                );
                assert.ok(codes.has('syntax/missing-closing-brace'), [...codes].join(', '));
                assert.ok(
                    shown.some((d) => d.severity === vscode.DiagnosticSeverity.Error) &&
                        shown.some((d) => d.severity === vscode.DiagnosticSeverity.Warning),
                    'errors and warnings',
                );
            },
        },
        {
            name: "7.11: hover answers with the spec's description",
            run: async () => {
                const file = path.join(mod, 'events', 'harvest_events.txt');
                const text = readFileSync(file, 'utf8');
                const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
                    'vscode.executeHoverProvider',
                    vscode.Uri.file(file),
                    at(text, 'is_adult', 3),
                );
                const value = hovers
                    .flatMap((h) => h.contents)
                    .map((c) => (c instanceof vscode.MarkdownString ? c.value : ''))
                    .join('\n');
                const doc = spec().data.buckets.triggers['is_adult']?.doc ?? '';
                assert.ok(doc !== '', 'the spec describes is_adult');
                // The hover escapes Markdown; its text without the escapes is the spec's own.
                assert.ok(value.replace(/\\(.)/g, '$1').includes(doc), `${value}\n---\n${doc}`);
                assert.match(value, /is_adult/);
            },
        },
        {
            name: '7.11: completion answers with what is valid at the place',
            run: async () => {
                const file = path.join(mod, 'events', 'harvest_events.txt');
                const text = readFileSync(file, 'utf8');
                const buckets = spec().data.buckets;
                const triggerOnly = Object.keys(buckets.triggers).filter(
                    (n) => !(n in buckets.effects) && !(n in buckets.links),
                );
                const effectOnly = Object.keys(buckets.effects).filter(
                    (n) => !(n in buckets.triggers) && !(n in buckets.links),
                );
                const list = await vscode.commands.executeCommand<vscode.CompletionList>(
                    'vscode.executeCompletionItemProvider',
                    vscode.Uri.file(file),
                    at(text, 'save_scope_as = harvest_host'),
                );
                const offered = new Set(list.items.map(labelOf));
                assert.ok(
                    effectOnly.some((n) => offered.has(n)),
                    'an effect in the immediate block',
                );
                assert.deepEqual(
                    triggerOnly.filter((n) => offered.has(n)),
                    [],
                    'no trigger in an effect block',
                );
            },
        },
        {
            name: "7.11: the agent server's definition is given to VS Code's AI, with the game folder",
            run: async () => {
                const definitions = await theExt().exports.definitions();
                assert.equal(definitions.length, 1);
                const installed = await theExt().exports.agentServer;
                assert.ok(!isInside(installed.dir, theExt().extensionPath), installed.dir);
                assert.deepEqual(definitions[0]?.args.slice(-2), ['--vanilla', game]);
            },
        },
        {
            name: "7.7, 7.11: the command line runs from the terminal's path",
            run: async () => {
                const launcher = await theExt().exports.commandLine;
                const run = await pychivalryInTerminal(path.join(work, 'version'), ['--version']);
                assert.equal(run.code, 0, run.stderr);
                assert.match(run.stdout, /^pychivalry \d+\.\d+\.\d+\r?\n$/);
                // The `pychivalry` the terminal found is the launcher in global storage.
                const found = run.found.split(/\r?\n/)[0] ?? '';
                assert.ok(sameFile(found, launcher), `${found} is not ${launcher}`);
                assert.equal(path.basename(path.dirname(found)), BIN_FOLDER);
            },
        },
        {
            name: '7.9: the editor, the command line and the agent server give the same findings',
            run: async () => {
                const report = await assertSameAnswers(theExt().exports, mod, game, work);
                console.log(`  same answers: ${JSON.stringify(report)}`);
                assert.ok(report.bySeverity.error > 0 && report.bySeverity.warning > 0);
            },
        },
        {
            name: '8.9: the editor, the command line and the agent server format alike',
            run: async () => {
                const report = await assertSameFormatting(theExt().exports, mod, work);
                console.log(`  same formatting: ${JSON.stringify(report)}`);
                // The planted mod is in the format but for its formatting defect; the copy's one
                // file written with `\n` breaks (run.ts) is the other file each surface changes.
                assert.ok(report.changed >= 2, 'files the formatter changes');
                assert.ok(report.left > 0, 'files with a parse error, left as they are');
            },
        },
        {
            name: '8.5: on-type formatting answers in the editor: a } typed first on its line',
            run: async () => {
                const file = path.join(work, 'on-type', 'common', 'scripted_effects', 'typed.txt');
                mkdirSync(path.dirname(file), { recursive: true });
                writeFileSync(file, 'typed_effect = {\n\tadd_gold = 1\n\t\t}\n');
                const uri = vscode.Uri.file(file);
                await vscode.workspace.openTextDocument(uri);
                const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
                    'vscode.executeFormatOnTypeProvider',
                    uri,
                    new vscode.Position(2, 3),
                    '}',
                    { tabSize: 4, insertSpaces: true },
                );
                assert.equal(edits.length, 1);
                assert.equal(edits[0]?.newText, '');
            },
        },
    ];
}
