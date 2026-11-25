/**
 * The skills themselves (docs/PLAN.md, items 9.1 and 9.2): the repository's `skills/` folder
 * holds the three skills in the one form both harnesses load (VS Code 1.147 and Claude Code
 * 2.1.220, as read from each and from their documentation: docs/references/editors-and-agents.md);
 * each names only the agent server's tools and the command line's commands and options that
 * exist, read from their own registries; and everything a skill writes as code is pychivalry's
 * own vocabulary or a name the spec package has, so a skill makes no claim about a CK3 keyword
 * the spec cannot back. The authoring skill states the rules of item 9.2.
 */

import { COMMANDS, TOOL as COMMAND_LINE } from '@pychivalry/cli';
import { folderTableFromSpec, inventoryRows, lookup, openSpec, type Spec } from '@pychivalry/core';
import { TOOLS } from '@pychivalry/mcp';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { readSkills, SKILL_FILE, SKILLS_FOLDER, type Skill } from './skills.js';

const PACKAGE = fileURLToPath(new URL('../', import.meta.url));
const REPO = path.resolve(PACKAGE, '..', '..');
const SKILLS = path.join(REPO, SKILLS_FOLDER);

/** The three skills of item 9.1: explain an error, fix an error, write new content. */
const NAMES = ['pychivalry-explain-error', 'pychivalry-fix-error', 'pychivalry-write-content'];

/** The tools each skill drives: each must be named in it, and be one of the server's. */
const DRIVES: Readonly<Record<string, readonly string[]>> = {
    'pychivalry-explain-error': ['check', 'explain_code', 'lookup', 'find_definition', 'source'],
    'pychivalry-fix-error': [
        'check',
        'explain_code',
        'lookup',
        'find_definition',
        'find_references',
        'list_definitions',
        'source',
        'format',
        'apply_format',
    ],
    'pychivalry-write-content': [
        'check',
        'lookup',
        'find_definition',
        'list_definitions',
        'find_references',
        'source',
        'explain_code',
        'format',
        'apply_format',
    ],
};

/** The prefix a client may list the tools under: Claude Code's, `mcp__<server>__`. */
const PREFIXED = /^mcp__pychivalry__([a-z_]+)$/;

const skills = readSkills(SKILLS);
const textOf = (skill: Skill): string => {
    const file = skill.files.find((f) => f.path === SKILL_FILE);
    assert.ok(file !== undefined, `${skill.name} has no ${SKILL_FILE}`);
    return file.bytes.toString('utf8');
};

/** A SKILL.md split into its frontmatter's pairs and its body. */
interface Parsed {
    readonly keys: readonly string[];
    readonly values: Readonly<Record<string, string>>;
    readonly body: string;
}

/**
 * The frontmatter as both harnesses read it: between a first line `---` and the next, one
 * `key: value` pair a line, each value a plain YAML scalar that both YAML readers read as the
 * same one-line string (no quotes, no indicator first, no `: ` or ` #` inside).
 */
function parse(name: string, text: string): Parsed {
    assert.ok(!text.startsWith('﻿'), `${name}: no byte-order mark before the frontmatter`);
    assert.ok(!text.includes('\r'), `${name}: line breaks are \\n`);
    assert.ok(text.startsWith('---\n'), `${name}: the frontmatter starts the file`);
    const end = text.indexOf('\n---\n', 3);
    assert.ok(end > 0, `${name}: the frontmatter is closed`);
    const keys: string[] = [];
    const values: Record<string, string> = {};
    for (const line of text.slice(4, end).split('\n')) {
        const m = /^([a-z][a-z-]*): (.+)$/.exec(line);
        assert.ok(m !== null, `${name}: a frontmatter line is one key and its value: ${line}`);
        const [, key = '', value = ''] = m;
        assert.ok(!/^[-?:,[\]{}#&*!|>'"%@`]/.test(value), `${name}: ${key} is a plain scalar`);
        assert.ok(!/: | #|\s$/.test(value), `${name}: ${key} reads as one string`);
        keys.push(key);
        values[key] = value;
    }
    return { keys, values, body: text.slice(end + 5) };
}

test('the skills folder holds the three skills, and the manifest gives each to VS Code', () => {
    assert.deepEqual(
        skills.map((s) => s.name),
        NAMES,
    );
    // Every folder of skills/ is a skill: nothing else would be copied or contributed.
    const folders = readdirSync(SKILLS, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
    assert.deepEqual(folders, NAMES);
    for (const skill of skills) {
        assert.deepEqual(
            skill.files.map((f) => f.path),
            [SKILL_FILE],
            `${skill.name}: one file, the one the .vsix may hold`,
        );
    }
    const manifest = JSON.parse(readFileSync(path.join(PACKAGE, 'package.json'), 'utf8')) as {
        contributes: { chatSkills: { path: string }[] };
    };
    assert.deepEqual(
        manifest.contributes.chatSkills,
        NAMES.map((n) => ({ path: `./dist/bundle/${SKILLS_FOLDER}/${n}/${SKILL_FILE}` })),
    );
    // The bundle, when it is built (task test builds it first), holds the same bytes.
    const bundled = path.join(PACKAGE, 'dist', 'bundle', SKILLS_FOLDER);
    if (existsSync(bundled)) {
        assert.deepEqual(
            readSkills(bundled).map((s) => [s.name, s.files.map((f) => [f.path, f.sha256])]),
            skills.map((s) => [s.name, s.files.map((f) => [f.path, f.sha256])]),
        );
    }
});

test('each SKILL.md is in the form both harnesses load: a name that is its folder, a description', () => {
    for (const skill of skills) {
        const { keys, values, body } = parse(skill.name, textOf(skill));
        // Only the two fields both harnesses read the same way: a field one of them does not
        // know is ignored by Claude Code and flagged by VS Code.
        assert.deepEqual(keys, ['name', 'description'], skill.name);
        const name = values['name'] ?? '';
        // VS Code: lowercase letters, digits and hyphens, at most 64, no hyphen at either end and
        // none doubled, the folder's own name, or the skill does not load.
        assert.match(name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
        assert.ok(name.length <= 64, name);
        assert.equal(name, skill.name, 'the name is the folder name');
        const description = values['description'] ?? '';
        // VS Code: at most 1,024 characters. Claude Code: the listing keeps 1,536; it shows
        // < and > as entities.
        assert.ok(description.length > 0 && description.length <= 1024, `${name}: description`);
        assert.ok(!/[<>]/.test(description), `${name}: no angle brackets in the description`);
        assert.match(description, /Crusader Kings 3 \(CK3\)/, `${name}: says what it is for`);
        assert.match(description, /\bUse when\b/, `${name}: says when to load it`);
        // Claude Code advises under 500 lines; these are short by design.
        const lines = body.split('\n').length;
        assert.ok(lines > 10 && lines < 200, `${name}: ${String(lines)} lines`);
        assert.ok(!body.includes('```'), `${name}: no script block (an example names keywords)`);
    }
});

/**
 * Every span of inline code in `text`. Each must sit on one line, so that a line of the skill
 * holds an even number of backticks: a span broken across lines would be read wrong here.
 */
function spans(text: string): string[] {
    for (const line of text.split('\n')) {
        assert.equal((line.match(/`/g) ?? []).length % 2, 0, `a span of code on one line: ${line}`);
    }
    return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1] ?? '');
}

/** The tools' own vocabulary: their names, and every property and value their shapes declare. */
function toolVocabulary(): Set<string> {
    const words = new Set<string>();
    const walk = (schema: unknown): void => {
        if (Array.isArray(schema)) {
            schema.forEach(walk);
            return;
        }
        if (typeof schema !== 'object' || schema === null) {
            return;
        }
        const s = schema as Record<string, unknown>;
        if (typeof s['properties'] === 'object' && s['properties'] !== null) {
            for (const [key, value] of Object.entries(s['properties'])) {
                words.add(key);
                walk(value);
            }
        }
        if (Array.isArray(s['enum'])) {
            for (const v of s['enum']) {
                if (typeof v === 'string') {
                    words.add(v);
                }
            }
        }
        walk(s['items']);
        walk(s['additionalProperties']);
    };
    for (const tool of TOOLS) {
        words.add(tool.name);
        walk(tool.input);
        walk(tool.output);
    }
    return words;
}

/** Why a span of a command line is not one the command line has, or null when it is. */
function commandLineProblem(span: string): string | null {
    const [program, name, ...rest] = span.split(/\s+/);
    if (program !== 'pychivalry' || name === undefined) {
        return `not a command line: ${span}`;
    }
    if (name === '--version' || name === '--help') {
        return rest.length === 0 ? null : `${name} takes nothing: ${span}`;
    }
    const command = COMMANDS.find((c) => c.name === name);
    if (command === undefined) {
        return `the command line has no command ${name}: ${span}`;
    }
    for (const word of rest) {
        if (word.startsWith('--')) {
            if (!command.options.some((o) => o.name === word) && word !== '--help') {
                return `${name} has no option ${word}: ${span}`;
            }
        } else if (!/^(<[a-z |]+>|\.)$/.test(word)) {
            return `an argument is a placeholder or the mod's folder (.): ${word} in ${span}`;
        }
    }
    return null;
}

/** Each skill's spans, and the problem of each span that is no name pychivalry or the spec has. */
function unbacked(spec: Spec): Map<string, string[]> {
    const tools = new Set(TOOLS.map((t) => t.name));
    const vocabulary = toolVocabulary();
    const codes: readonly string[] = inventoryRows().map((r) => r.code);
    const families = new Set(codes.map((c) => c.slice(0, c.indexOf('/'))));
    const folders = new Set(folderTableFromSpec(spec.data).folders.map((f) => f.path));
    const known = (name: string): boolean => !lookup(name, { spec, suggestions: false }).unknown;
    const problems = new Map<string, string[]>();
    for (const skill of skills) {
        const found: string[] = [];
        const { body } = parse(skill.name, textOf(skill));
        for (const span of spans(body)) {
            const prefixed = PREFIXED.exec(span);
            if (span.startsWith('pychivalry ')) {
                const problem = commandLineProblem(span);
                if (problem !== null) {
                    found.push(problem);
                }
            } else if (prefixed !== null) {
                if (!tools.has(prefixed[1] ?? '')) {
                    found.push(`no tool ${span}`);
                }
            } else if (
                span === COMMAND_LINE ||
                /^<[^<>]+>$/.test(span) ||
                vocabulary.has(span) ||
                codes.includes(span) ||
                (/^[a-z]+\/(\*)?$/.test(span) && families.has(span.slice(0, span.indexOf('/')))) ||
                folders.has(span.replace(/\/$/, ''))
            ) {
                continue;
            } else if (!known(span)) {
                found.push(`neither pychivalry's nor the spec package's: ${span}`);
            }
        }
        // A name written outside code would escape the judgement: snake_case words and code
        // families go in code.
        const prose = body.replace(/`[^`\n]+`/g, ' ');
        for (const m of prose.matchAll(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b|\b[a-z]+\/[a-z*-]+/g)) {
            found.push(`a name outside code: ${m[0]}`);
        }
        if (found.length > 0) {
            problems.set(skill.name, found);
        }
    }
    return problems;
}

test("each skill names only the agent server's tools and the command line's commands that exist", () => {
    const tools = new Set(TOOLS.map((t) => t.name));
    for (const skill of skills) {
        const { values, body } = parse(skill.name, textOf(skill));
        const named = new Set(spans(body).filter((s) => tools.has(s)));
        const wanted = DRIVES[skill.name] ?? [];
        assert.ok(wanted.length > 0, skill.name);
        for (const tool of wanted) {
            assert.ok(tools.has(tool), `${tool} is no tool of the agent server`);
            assert.ok(named.has(tool), `${skill.name} does not name ${tool}`);
        }
        // The tools a description names, in its brackets, are tools too.
        for (const group of (values['description'] ?? '').matchAll(/agent server \(([^)]*)\)/g)) {
            for (const name of (group[1] ?? '').split(/,\s*/)) {
                assert.ok(tools.has(name), `${skill.name}'s description names ${name}`);
            }
        }
        // The command lines a skill gives are ones the command line takes.
        for (const span of spans(body).filter((s) => s.startsWith('pychivalry '))) {
            assert.equal(commandLineProblem(span), null);
        }
    }
    // The judge itself: a made-up tool, command or option is caught.
    assert.match(commandLineProblem('pychivalry lint .') ?? '', /no command lint/);
    assert.match(commandLineProblem('pychivalry check --everything .') ?? '', /no option/);
    assert.equal(commandLineProblem('pychivalry check --fix .'), null);
    assert.equal(commandLineProblem('pychivalry format <file>'), null);
});

test("each skill gives Claude Code's name of every tool it drives, and what a call of the short name does", () => {
    // Both scored authoring runs had sessions call a server tool by the short name the skills
    // write (10 calls in the first, 13 in the second), which Claude Code answers with no such
    // tool: the skills say what to call instead, for every tool they drive.
    for (const skill of skills) {
        const { body } = parse(skill.name, textOf(skill));
        const named = new Set(spans(body));
        for (const tool of DRIVES[skill.name] ?? []) {
            assert.ok(
                named.has(`mcp__pychivalry__${tool}`),
                `${skill.name} names mcp__pychivalry__${tool}`,
            );
        }
        const prose = body.replace(/\s+/g, ' ');
        assert.match(prose, /a call of a short name reaches nothing/, skill.name);
        assert.match(prose, /call the same tool again by its listed name/, skill.name);
    }
});

test('each skill says when to read the game itself with source, and never a game place with file tools', () => {
    // The expert requests' development run: one session read a place lookup had named in the
    // base game as if it were under its mod (a folder it guessed), the run's one trial that did
    // not hold. Since tool schema version 4 a place outside the mod says read_with, and source
    // shows its text; each skill says so, and that lookup answers every name whole.
    for (const skill of skills) {
        const { body } = parse(skill.name, textOf(skill));
        const prose = body.replace(/\s+/g, ' ');
        assert.match(prose, /`source`/, skill.name);
        assert.match(
            prose,
            /whose `layer` is not `mod` is a file of the installed game/,
            skill.name,
        );
        assert.match(prose, /never with your own file tools/, skill.name);
        assert.match(prose, /listed in `not_answered`/, skill.name);
        assert.doesNotMatch(prose, /next_cursor` for the rest of a long answer/, skill.name);
    }
    const write = skills.find((s) => s.name === 'pychivalry-write-content');
    assert.ok(write !== undefined);
    const prose = parse(write.name, textOf(write)).body.replace(/\s+/g, ' ');
    assert.match(prose, /See how the game itself writes it/);
    assert.match(prose, /with `folder` set to that folder/);
});

test("everything a skill writes as code is pychivalry's own or a name the spec package has", () => {
    const spec = openSpec(path.join(REPO, 'spec'));
    assert.deepEqual(Object.fromEntries(unbacked(spec)), {});
    // The judge itself: a keyword the game does not have, or one outside code, is caught.
    assert.ok(!lookup('add_gold', { spec, suggestions: false }).unknown);
    assert.ok(lookup('add_golden_crown', { spec, suggestions: false }).unknown);
});

test('the authoring skill states the rules of item 9.2, in order, for the four kinds of content', () => {
    const skill = skills.find((s) => s.name === 'pychivalry-write-content');
    assert.ok(skill !== undefined);
    const { body } = parse(skill.name, textOf(skill));
    const rules = [
        'Look names up before using them.',
        'Write events with their localization.',
        'Run the checker.',
        'Repair from the findings.',
        'Stop at zero errors, or after 5 rounds.',
        'Never claim success with errors left.',
        // The owner's principle: best practice and cleanliness over what an author wrote.
        'Format what you write.',
    ];
    let at = body.indexOf('## The rules');
    assert.ok(at >= 0);
    rules.forEach((rule, i) => {
        const next = body.indexOf(`${String(i + 1)}. **${rule}**`, at);
        assert.ok(next > at, `rule ${String(i + 1)}: ${rule}`);
        at = next;
    });
    // No style/ warning left: the format's two warnings are named as counting as errors.
    assert.match(
        body,
        /`style\/not-formatted`\s+and `style\/not-utf8` are\s+warnings, and count as errors here/,
    );
    // Formatting is written by the agent server: an AI harness's own file tools may not write
    // Windows line breaks (the first scored authoring run, item 9.8).
    assert.match(body, /Run `apply_format` on each file you wrote or\s+changed/);
    for (const kind of [
        'An event, with its localization',
        'A decision',
        'A scripted effect',
        'A scripted trigger',
    ]) {
        assert.ok(body.includes(`| ${kind} |`), kind);
    }
});
