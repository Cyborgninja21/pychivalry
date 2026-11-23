/**
 * Release 2.3.0's golden output of its command line, carried over as the first test of this
 * one (docs/PLAN.md item 5.2): `legacy/packages/engine/test/fixtures/example-mod.cli.txt`, what
 * `check "example mod"` printed, on the example mod `legacy/example mod/`. Both are read from
 * `legacy/` as data; nothing there changes. Build step 13, which removes `legacy/`, carries
 * them over first or retires this test.
 *
 * The codes are not 2.3.0's (docs/checks.md, "How release 2.3.0's codes relate"), so the
 * output cannot be equal byte for byte. What is compared, exactly:
 *
 * 1. **The shape.** Both outputs are read by one grammar, 2.3.0's: a file's path, a line
 *    `  <line>:<column>  <severity>  <code>  <message>` per finding, a blank line, and last
 *    `<n> files checked: <e> errors, <w> warnings, <o> other`, whose counts are those of the
 *    lines listed. Every line of each output must be read by it.
 * 2. **The files checked:** 54 in both.
 * 3. **The findings both tools have**, at the same file, line and column, with the same
 *    severity and message: 2.3.0's `unknown_trigger_X` and `unknown_effect_X` are
 *    `names/unknown-trigger` and `names/unknown-effect`; its `expected_after_arguments` is
 *    `syntax/missing-closing-brace`; its `unexpected_token_expected_key` is one of
 *    `syntax/unexpected-closing-brace`, `syntax/block-without-key` and
 *    `syntax/operator-without-key` (the "Replaces" column of docs/checks.md). Every 2.3.0
 *    finding with one of those four codes has its counterpart in the new output, and every new
 *    finding with one of those six codes has its counterpart in 2.3.0's, except the
 *    differences listed below, each with its reason. A new code a later check adds is outside
 *    this comparison.
 * 4. **Not compared:** 2.3.0's 34 `PYCH-S003` warnings ("declares event content, but <folder>
 *    loads no script content"). Their row, `structure/namespace-outside-events`, is advice of
 *    item 4.7 about a different place: in the game's layout below, every file 2.3.0 warned
 *    about is in `events/`, where a namespace belongs.
 *
 * The example mod keeps each kind of content in a numbered folder of its own (`01_syntax/`),
 * which the game does not read; 2.3.0 read every file as script whatever its folder. The new
 * checker reads a file by its folder, as the game does, so the test lays the mod out as the
 * game would read it: every script file under `events/` at its own path
 * (`events/01_syntax/bad_syntax.txt`), except the four folders of `13_call_hierarchy/` named
 * for a game folder, whose files go to that folder (`common/scripted_effects/`). 2.3.0 ran
 * with no base game and judged every name; the new checker, with no game, judges no name the
 * game might define, so the test gives it a stand-in game that defines only the two names of
 * the base game's the example mod uses, the scripted relations `rival` and `friend` (of
 * `has_relation_rival` and `has_relation_friend`, which 2.3.0 accepted on their template
 * alone); against it every other name is judged.
 */

import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { gameStub, REPO_ROOT, runCli, scratch } from './testing.js';

const LEGACY_MOD = path.join(REPO_ROOT, 'legacy', 'example mod');
const GOLDEN = path.join(
    REPO_ROOT,
    'legacy',
    'packages',
    'engine',
    'test',
    'fixtures',
    'example-mod.cli.txt',
);

/** The four folders of `13_call_hierarchy/` that name a game folder, and that folder. */
const GAME_FOLDERS: Readonly<Record<string, string>> = {
    decisions: 'common/decisions',
    on_actions: 'common/on_action',
    scripted_effects: 'common/scripted_effects',
    scripted_triggers: 'common/scripted_triggers',
};

/** Where a script file of the example mod goes in the game's layout. */
function laidOut(file: string): string {
    const m = /^13_call_hierarchy\/([a-z_]+)\/([^/]+)$/.exec(file);
    const folder = m?.[1] === undefined ? undefined : GAME_FOLDERS[m[1]];
    return folder !== undefined && m?.[2] !== undefined ? `${folder}/${m[2]}` : `events/${file}`;
}

function filesUnder(dir: string, base = ''): string[] {
    const out: string[] = [];
    for (const name of readdirSync(path.join(dir, base)).sort()) {
        const rel = base === '' ? name : `${base}/${name}`;
        if (statSync(path.join(dir, rel)).isDirectory()) {
            out.push(...filesUnder(dir, rel));
        } else {
            out.push(rel);
        }
    }
    return out;
}

interface Line {
    readonly file: string;
    readonly line: number;
    readonly column: number;
    readonly severity: string;
    readonly code: string;
    readonly message: string;
}

interface Output {
    readonly findings: readonly Line[];
    readonly files: number;
    readonly counts: { readonly errors: number; readonly warnings: number; readonly other: number };
}

const FINDING = /^ {2}([0-9]+):([0-9]+) {2}(error|warning|information|hint) {2}(\S+) {2}(.*)$/;
const SUMMARY = /^([0-9]+) files checked: ([0-9]+) errors, ([0-9]+) warnings, ([0-9]+) other$/;

/** Read an output by 2.3.0's grammar; any line it cannot read fails the test. */
function read(text: string, what: string): Output {
    const lines = text.split(/\r?\n/);
    assert.equal(lines.pop(), '', `${what} ends with a new line`);
    const summary = SUMMARY.exec(lines.pop() ?? '');
    assert.ok(summary !== null, `${what} ends with the summary line`);
    const findings: Line[] = [];
    let file: string | null = null;
    lines.forEach((text, i) => {
        const finding = FINDING.exec(text);
        if (text === '') {
            assert.ok(file !== null, `${what} line ${String(i + 1)}: a blank line ends a file`);
            file = null;
        } else if (finding !== null) {
            assert.ok(file !== null, `${what} line ${String(i + 1)}: a finding under a file`);
            findings.push({
                file,
                line: Number(finding[1]),
                column: Number(finding[2]),
                severity: finding[3] ?? '',
                code: finding[4] ?? '',
                message: finding[5] ?? '',
            });
        } else {
            assert.ok(file === null && /^\S/.test(text), `${what} line ${String(i + 1)}: ${text}`);
            file = text;
        }
    });
    assert.equal(file, null, `${what}: the last file ends with a blank line`);
    const counts = {
        errors: Number(summary[2]),
        warnings: Number(summary[3]),
        other: Number(summary[4]),
    };
    assert.deepEqual(
        counts,
        {
            errors: findings.filter((f) => f.severity === 'error').length,
            warnings: findings.filter((f) => f.severity === 'warning').length,
            other: findings.filter((f) => f.severity === 'information' || f.severity === 'hint')
                .length,
        },
        `${what}: the summary counts the lines listed`,
    );
    return { findings, files: Number(summary[1]), counts };
}

/** 2.3.0's codes this comparison covers, and the new codes each one is. */
const SHARED: Readonly<Record<string, readonly string[]>> = {
    unknown_trigger_X: ['names/unknown-trigger'],
    unknown_effect_X: ['names/unknown-effect'],
    expected_after_arguments: ['syntax/missing-closing-brace'],
    unexpected_token_expected_key: [
        'syntax/unexpected-closing-brace',
        'syntax/block-without-key',
        'syntax/operator-without-key',
    ],
};
const NEW_CODES = new Set(Object.values(SHARED).flat());

/**
 * The findings only one tool has, each `<file>:<line>:<column> <message>` in 2.3.0's paths,
 * with the reason.
 */
const ONLY_2_3_0: Readonly<Record<string, string>> = {
    "02_semantic/bad_scopes.txt:328:3 Unknown trigger 'every_spouse'":
        'an every_ iterator over a list that exists, in a trigger block: the iterator sub-case of names/unknown-trigger, which waits on the owner (docs/checks.md, 4.2)',
};
const REMOVED_IN_1_21 =
    "removed in game 1.21.0.3: the spec package's `retired` list says so, and the finding's data carries it; 2.3.0's golden output was made on the 1.20.0.2 spec";
const ONLY_NEW: Readonly<Record<string, string>> = {
    "07_decisions/good_decisions.txt:217:4 Unknown trigger 'development_level'": REMOVED_IN_1_21,
    "07_decisions/good_decisions.txt:228:4 Unknown effect 'change_development_level'":
        REMOVED_IN_1_21,
};

/** The stand-in game: the scripted relations the example mod names. */
const STAND_IN_GAME: Readonly<Record<string, string>> = {
    'common/scripted_relations/stand_in_relations.txt': 'rival = { }\nfriend = { }\n',
};

const key = (f: Line): string => `${f.file}:${String(f.line)}:${String(f.column)} ${f.message}`;

test("release 2.3.0's golden output on its example mod: the same shape and the findings both have", (t) => {
    const dir = scratch(t);
    const mod = path.join(dir, 'example mod');
    const back = new Map<string, string>();
    for (const file of filesUnder(LEGACY_MOD)) {
        const target = file.endsWith('.txt') ? laidOut(file) : file;
        back.set(target, file);
        mkdirSync(path.dirname(path.join(mod, target)), { recursive: true });
        cpSync(path.join(LEGACY_MOD, file), path.join(mod, target));
    }
    const game = gameStub(path.join(dir, 'install'), STAND_IN_GAME);
    const result = runCli(['check', mod, '--vanilla', game], { cache: path.join(dir, 'cache') });
    assert.equal(result.code, 1, 'exit code 1: errors are reported');

    const old = read(readFileSync(GOLDEN, 'utf8'), "2.3.0's golden output");
    const now = read(result.stdout, 'the new output');
    assert.equal(old.files, 54);
    assert.equal(now.files, old.files, 'the same files are checked');

    const asOld = now.findings.map((f) => ({ ...f, file: back.get(f.file) ?? f.file }));
    const compared = old.findings.filter((f) => f.code in SHARED);
    const counterpart = new Map(asOld.filter((f) => NEW_CODES.has(f.code)).map((f) => [key(f), f]));
    const missing: string[] = [];
    for (const f of compared) {
        const found = counterpart.get(key(f));
        if (found === undefined) {
            missing.push(key(f));
            continue;
        }
        assert.ok(SHARED[f.code]?.includes(found.code), `${key(f)}: ${f.code} is ${found.code}`);
        assert.equal(found.severity, f.severity, key(f));
    }
    assert.deepEqual(missing.sort(), Object.keys(ONLY_2_3_0).sort(), 'only in 2.3.0');
    const known = new Set(compared.map(key));
    const extra = [...counterpart.keys()].filter((k) => !known.has(k));
    assert.deepEqual(extra.sort(), Object.keys(ONLY_NEW).sort(), 'only in the new output');
    assert.ok(compared.length >= 100, `${String(compared.length)} findings compared`);
    assert.deepEqual(
        old.findings.filter((f) => !(f.code in SHARED)).map((f) => f.code),
        Array<string>(34).fill('PYCH-S003'),
        "2.3.0's other findings are its 34 PYCH-S003 warnings",
    );
});
