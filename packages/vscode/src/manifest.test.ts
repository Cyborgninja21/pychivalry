/**
 * The extension's manifest, `package.json`, held to the code, to the language server and to the
 * spec package: the ids the code registers, the activation, the VS Code floor (item 7.2), the
 * file patterns of the two languages, which are the spec's own folders, and the settings, which
 * are the language server's own (items 7.4 and 7.6).
 */

import { openSpec } from '@pychivalry/core';
import {
    BACKGROUND_DONE as LSP_BACKGROUND_DONE,
    DEFAULT_SETTINGS,
    FINDINGS_REQUEST as LSP_FINDINGS_REQUEST,
    readSettings,
    SETTINGS_SECTION as LSP_SETTINGS_SECTION,
    SHARING_REQUEST as LSP_SHARING_REQUEST,
} from '@pychivalry/lsp';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    BACKGROUND_DONE,
    EXTENSION_ID,
    FINDINGS_REQUEST,
    GAME_PATH_SETTING,
    LANGUAGES,
    PROVIDER_ID,
    SET_UP_CLAUDE_CODE,
    SETTINGS_SECTION,
    SHARING_REQUEST,
} from './ids.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');

interface Manifest {
    name: string;
    publisher: string;
    version: string;
    preview: boolean;
    main: string;
    engines: { vscode: string };
    activationEvents: string[];
    devDependencies: Record<string, string>;
    contributes: {
        languages: { id: string; filenamePatterns: string[] }[];
        commands: { command: string; title: string; category: string }[];
        mcpServerDefinitionProviders: { id: string; label: string }[];
        configuration: {
            title: string;
            properties: Record<
                string,
                {
                    type: string;
                    default: unknown;
                    markdownDescription?: string;
                    enum?: string[];
                    enumDescriptions?: string[];
                }
            >;
        };
    };
}

const manifest = JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as Manifest;

/** The VS Code floor (item 7.2): see `docs/references/editors-and-agents.md`. */
const FLOOR = '1.146.0';

test('the identity: cyborgninja21.pychivalry, a 0.x preview, its bundle as the entry point', () => {
    assert.equal(`${manifest.publisher}.${manifest.name}`, EXTENSION_ID);
    assert.match(manifest.version, /^0\.\d+\.\d+$/);
    assert.equal(manifest.preview, true);
    assert.equal(manifest.main, './dist/bundle/extension.cjs');
});

test('the floor is pinned, and the API types are no newer than it', () => {
    assert.equal(manifest.engines.vscode, `^${FLOOR}`);
    const types = manifest.devDependencies['@types/vscode'] ?? '';
    const [floor, typed] = [FLOOR, types].map((v) => v.split('.').map(Number));
    assert.ok(floor !== undefined && typed !== undefined && /^\d+\.\d+\.\d+$/.test(types), types);
    // VS Code's packaging refuses API types newer than the floor.
    const newer =
        (typed[0] ?? 0) * 1e6 + (typed[1] ?? 0) * 1e3 >
        (floor[0] ?? 0) * 1e6 + (floor[1] ?? 0) * 1e3;
    assert.ok(!newer, `@types/vscode ${types} is newer than the floor ${FLOOR}`);
    for (const pinned of Object.values(manifest.devDependencies)) {
        assert.match(pinned, /^\d+\.\d+\.\d+$/, 'every tool pinned to an exact version');
    }
});

test('the agent-server provider and the command are the ones the code registers', () => {
    assert.deepEqual(manifest.contributes.mcpServerDefinitionProviders, [
        { id: PROVIDER_ID, label: 'pychivalry' },
    ]);
    assert.deepEqual(manifest.contributes.commands, [
        { command: SET_UP_CLAUDE_CODE, title: 'Set up for Claude Code', category: 'pychivalry' },
    ]);
});

test('it activates on a CK3 script, a localization file, or a folder holding a mod descriptor', () => {
    assert.deepEqual(manifest.activationEvents, [
        'onLanguage:ck3',
        'onLanguage:ck3-localization',
        'workspaceContains:**/descriptor.mod',
    ]);
});

test("the languages' file patterns are the spec package's own top folders", () => {
    const spec = openSpec(path.join(REPO, 'spec'));
    const tops = [...new Set(spec.data.directories.map((d) => d.path.split('/')[0] ?? ''))].sort();
    assert.ok(tops.includes('common') && tops.includes('localization'), tops.join(', '));
    const patterns = Object.fromEntries(
        manifest.contributes.languages.map((l) => [l.id, l.filenamePatterns]),
    );
    assert.deepEqual(patterns, {
        ck3: tops.filter((t) => t !== 'localization').map((t) => `**/${t}/**/*.txt`),
        'ck3-localization': ['**/localization/**/*.yml'],
    });
});

test('the two languages are the ones the code gives the language client', () => {
    assert.deepEqual(
        manifest.contributes.languages.map((l) => l.id),
        [...LANGUAGES],
    );
});

test("the settings are the language server's five, each with its default and a description", () => {
    const { title, properties } = manifest.contributes.configuration;
    assert.equal(title, 'pychivalry');
    assert.equal(SETTINGS_SECTION, LSP_SETTINGS_SECTION);
    assert.deepEqual(Object.keys(properties).sort(), [
        'pychivalry.background.fileLimit',
        'pychivalry.encoding.fallback',
        'pychivalry.gamePath',
        'pychivalry.inlayHints.enabled',
        'pychivalry.localization.unusedKeys',
    ]);
    assert.ok(`${SETTINGS_SECTION}.${GAME_PATH_SETTING}` in properties);
    // The defaults the manifest declares, read as the language server reads the section, are its own.
    const section = Object.fromEntries(
        Object.entries(properties).map(([key, p]) => [
            key.slice(SETTINGS_SECTION.length + 1),
            p.default,
        ]),
    );
    assert.deepEqual(readSettings(section), DEFAULT_SETTINGS);
    for (const [key, p] of Object.entries(properties)) {
        assert.ok((p.markdownDescription ?? '').length > 80, `${key} has a description`);
    }
    const fallback = properties['pychivalry.encoding.fallback'];
    assert.deepEqual(fallback?.enum, ['none', 'windows-1252']);
    assert.equal(fallback.enumDescriptions?.length, 2);
    assert.equal(
        readSettings({ 'encoding.fallback': 'windows-1252' }).fallbackEncoding,
        'windows-1252',
    );
});

test("the language server's own requests are the ones the extension sends and listens to", () => {
    assert.equal(FINDINGS_REQUEST, LSP_FINDINGS_REQUEST);
    assert.equal(BACKGROUND_DONE, LSP_BACKGROUND_DONE);
    assert.equal(SHARING_REQUEST, LSP_SHARING_REQUEST);
});
