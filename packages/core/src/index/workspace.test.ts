/**
 * The index's answers for every kind of row in the rules table's vocabulary (docs/PLAN.md item
 * 3.6), on small tables written for the test, and incremental update (item 3.7): a changed
 * file updates its own entries and names the files that use the names it defines.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FolderTable } from './folders.js';
import { readRulesTable, type Platform } from './rules.js';
import { packageRules, specFolders, TEST_ROW } from './testing.js';
import { WorkspaceIndex, type Resolution } from './workspace.js';

const PATHS = ['common/x', 'common/y', 'events', 'history/characters', 'localization'];

const FOLDERS = new FolderTable(
    PATHS.map((path) => ({
        path,
        contentType: path,
        schema: false,
        schemaFields: 0,
        specRecords: null,
        specFiles: null,
        notDefinitions: [],
        nested: [],
        fileNamed: false,
        files: null,
    })),
);

function row(id: string, fields: Record<string, unknown>): Record<string, unknown> {
    return { id, overrides_rule: 5, title: id, ...TEST_ROW, ...fields };
}

/** Every test folder read with its subfolders, unless a test gives its own listing rows. */
const LISTED = row('listed', {
    kind: 'listing-depth',
    overrides_rule: 4,
    databases: PATHS,
    recursive: true,
});

function index(
    rows: Record<string, unknown>[],
    platform: Platform | undefined = 'linux',
): WorkspaceIndex {
    const listing = rows.some((r) => r['kind'] === 'listing-depth') ? [] : [LISTED];
    const rules = readRulesTable({
        format: 1,
        game_build: '1.21.0.3',
        rules: [...rows, ...listing],
    });
    return new WorkspaceIndex({ folders: FOLDERS, rules, platform });
}

const ORDER = (fields: Record<string, unknown> = {}): Record<string, unknown> =>
    row('order', {
        kind: 'file-order',
        compare: 'bytes',
        subfolders: 'by-path',
        layers: 'together',
        layer_order: ['game', 'mod'],
        ...fields,
    });
const LATER = row('later', {
    kind: 'key-resolution',
    databases: ['common/x'],
    resolve: 'later-wins',
    combine: 'whole',
});
const EARLIER = row('earlier', {
    kind: 'key-resolution',
    databases: ['common/x'],
    resolve: 'earlier-wins',
    combine: 'fields',
});

function winnerOf(r: Resolution): string | undefined {
    return r.status === 'winner' || r.status === 'single'
        ? `${r.winner.layer}:${r.winner.file}:${String(r.winner.start)}`
        : undefined;
}

test('with no row, a name defined twice is unknown, with both definitions and the reason', () => {
    const ix = index([]);
    ix.addFile('game', 'common/x/a.txt', 'k = 1\n');
    ix.addFile('mod', 'common/x/b.txt', 'k = 2\n');
    const r = ix.resolve('common/x', 'k');
    assert.equal(r.status, 'unknown');
    assert.equal(r.definitions.length, 2);
    assert.deepEqual(r.reasons, [{ kind: 'no-rule', database: 'common/x', forms: ['value'] }]);
    // Once defined, it is single; never defined, not-defined.
    ix.addFile('game', 'common/x/c.txt', 'once = 1\n');
    assert.equal(ix.resolve('common/x', 'once').status, 'single');
    assert.equal(ix.resolve('common/x', 'never').status, 'not-defined');
    assert.equal(
        ix.resolve('common/y', 'k').status,
        'not-defined',
        'another database is another name',
    );
});

test('later-wins and earlier-wins need a file-order row; with one they name the winner', () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('game', 'common/x/B.txt', 'k = 1\n');
        ix.addFile('game', 'common/x/a.txt', 'k = 2\nk = 3\n');
    };
    const noOrder = index([LATER]);
    files(noOrder);
    const r = noOrder.resolve('common/x', 'k');
    assert.equal(r.status, 'unknown');
    assert.deepEqual(r.reasons, [{ kind: 'no-order', database: 'common/x', rule: 'later' }]);

    const bytes = index([LATER, ORDER()]);
    files(bytes);
    // By bytes, B.txt sorts before a.txt; within a.txt the second definition is later.
    assert.equal(winnerOf(bytes.resolve('common/x', 'k')), 'game:common/x/a.txt:6');

    const folded = index([LATER, ORDER({ compare: 'case-insensitive' })]);
    files(folded);
    assert.equal(winnerOf(folded.resolve('common/x', 'k')), 'game:common/x/B.txt:0');

    const earlier = index([EARLIER, ORDER()]);
    files(earlier);
    const e = earlier.resolve('common/x', 'k');
    assert.equal(winnerOf(e), 'game:common/x/B.txt:0');
    assert.equal(e.status === 'winner' ? e.combine : undefined, 'fields');
});

test('a name resolved once is answered again from memory until a file changes', () => {
    const ix = index([LATER, ORDER()]);
    ix.addFile('game', 'common/x/a.txt', 'k = 1\n');
    ix.addFile('mod', 'common/x/b.txt', 'k = 2\n');
    const first = ix.resolve('common/x', 'k');
    assert.equal(winnerOf(first), 'mod:common/x/b.txt:0');
    assert.equal(ix.resolve('common/x', 'k'), first, 'the same answer, not worked out again');
    ix.addFile('mod', 'common/x/c.txt', 'k = 3\n');
    const after = ix.resolve('common/x', 'k');
    assert.notEqual(after, first);
    assert.equal(winnerOf(after), 'mod:common/x/c.txt:0');
    assert.equal(after.definitions.length, 3);
});

test("a file order places subfolders by path, or the folder's own files first, or last", () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('game', 'common/x/z.txt', 'k = 1\n');
        ix.addFile('game', 'common/x/sub/a.txt', 'k = 2\n');
    };
    const cases: [string, string][] = [
        ['by-path', 'game:common/x/z.txt:0'],
        ['files-first', 'game:common/x/sub/a.txt:0'],
        ['folders-first', 'game:common/x/z.txt:0'],
    ];
    for (const [subfolders, winner] of cases) {
        const ix = index([LATER, ORDER({ subfolders })]);
        files(ix);
        assert.equal(winnerOf(ix.resolve('common/x', 'k')), winner, subfolders);
    }
});

test('a file order reads layers together by path, or one layer after another', () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('game', 'common/x/zz.txt', 'k = 1\n');
        ix.addFile('mod', 'common/x/aa.txt', 'k = 2\n');
    };
    const together = index([LATER, ORDER()]);
    files(together);
    assert.equal(winnerOf(together.resolve('common/x', 'k')), 'game:common/x/zz.txt:0');
    const inOrder = index([LATER, ORDER({ layers: 'in-order' })]);
    files(inOrder);
    assert.equal(winnerOf(inOrder.resolve('common/x', 'k')), 'mod:common/x/aa.txt:0');
    // A layer the order does not list leaves the order unknown.
    const unlisted = index([LATER, ORDER({ layer_order: ['game'] })]);
    files(unlisted);
    assert.equal(unlisted.resolve('common/x', 'k').status, 'unknown');
});

test('priority: the largest wins, the default stands for a missing field, a tie at the top clashes', () => {
    const rows = [
        row('priority', {
            kind: 'key-resolution',
            databases: ['events'],
            forms: ['record'],
            resolve: 'priority',
            priority_field: 'p',
            priority_default: 1,
            combine: 'whole',
        }),
    ];
    const ix = index(rows);
    ix.addFile('game', 'events/a.txt', 'e.1 = { }\ne.2 = { p = 1 }\ne.3 = { p = 5 }\nns = x\n');
    ix.addFile('mod', 'events/b.txt', 'e.1 = { p = 2 }\ne.2 = { }\ne.3 = { p = 4 }\nns = x\n');
    assert.equal(winnerOf(ix.resolve('events', 'e.1')), 'mod:events/b.txt:0');
    assert.equal(ix.resolve('events', 'e.2').status, 'clash');
    assert.equal(winnerOf(ix.resolve('events', 'e.3')), 'game:events/a.txt:26');
    assert.deepEqual(
        ix.definitions('e.3').map((d) => d.priority),
        [5, 4],
    );
    // The row is for records: a value has no rule.
    assert.equal(ix.resolve('events', 'ns').status, 'unknown');
});

test('format 9: a priority tie clashes, and the row says which the game keeps (within same-priority)', () => {
    const rows = [
        row('priority', {
            kind: 'key-resolution',
            databases: ['events'],
            forms: ['record'],
            resolve: 'priority',
            priority_field: 'p',
            priority_default: 1,
            combine: 'whole',
            within: [
                {
                    scope: 'same-priority',
                    resolve: 'earlier-wins',
                    combine: 'whole',
                    message: 'msg-fixture-duplicate',
                },
            ],
        }),
        ORDER(),
    ];
    const ix = index(rows);
    ix.addFile('game', 'events/a.txt', 'e.2 = { p = 1 }\n');
    ix.addFile('mod', 'events/b.txt', 'e.2 = { }\n');
    const r = ix.resolve('events', 'e.2');
    assert.equal(r.status, 'clash');
    assert.equal(r.kept?.file, 'events/a.txt');
    assert.equal(r.message, 'msg-fixture-duplicate');
});

test('format 9: a path_match the index does not know makes a folder-wins row decide nothing', () => {
    const wins = row('wins', {
        kind: 'folder-wins',
        databases: ['localization'],
        segment: 'replace',
        path_match: { compare: 'bytes', where: 'fixture-elsewhere' },
    });
    const ix = index([wins]);
    ix.addFile('game', 'localization/english/a_l_english.yml', 'l_english:\n k: "a"\n');
    ix.addFile('mod', 'localization/english/replace/b_l_english.yml', 'l_english:\n k: "b"\n');
    assert.equal(ix.resolve('localization:l_english', 'k').status, 'unknown');
    // The package's own: the text `/replace/` anywhere in the path, byte for byte.
    const known = index([
        { ...wins, path_match: { compare: 'bytes', where: 'anywhere-in-path', text: '/replace/' } },
    ]);
    known.addFile('game', 'localization/english/a_l_english.yml', 'l_english:\n k: "a"\n');
    known.addFile('mod', 'localization/english/replace/b_l_english.yml', 'l_english:\n k: "b"\n');
    assert.equal(
        winnerOf(known.resolve('localization:l_english', 'k')),
        'mod:localization/english/replace/b_l_english.yml:12',
    );
});

test('a row covers definitions of mixed forms only if it names every form', () => {
    const forRecords = index([
        row('all', {
            kind: 'key-resolution',
            databases: ['common/x'],
            forms: ['record'],
            resolve: 'all',
        }),
    ]);
    forRecords.addFile('game', 'common/x/a.txt', 'k = { }\n');
    forRecords.addFile('game', 'common/x/b.txt', 'k = 1\n');
    assert.equal(forRecords.resolve('common/x', 'k').status, 'unknown');
    const forBoth = index([
        row('all', { kind: 'key-resolution', databases: ['common/x'], resolve: 'all' }),
    ]);
    forBoth.addFile('game', 'common/x/a.txt', 'k = { }\n');
    forBoth.addFile('game', 'common/x/b.txt', 'k = 1\n');
    assert.equal(forBoth.resolve('common/x', 'k').status, 'all');
});

test('containers add up; their entries are names of their own', () => {
    const ix = index([
        row('containers', { kind: 'containers', databases: ['common/x'], keys: ['box'] }),
    ]);
    ix.addFile('game', 'common/x/a.txt', 'box = { one = 1 two = 2 }\nloose = { }\n');
    ix.addFile('mod', 'common/x/b.txt', 'box = { two = 3 }\nloose = { }\n');
    const box = ix.resolve('common/x', 'box');
    assert.equal(box.status, 'all');
    assert.equal(ix.resolve('common/x', 'one', 'box').status, 'single');
    assert.equal(ix.resolve('common/x', 'two', 'box').status, 'unknown');
    assert.equal(
        ix.resolve('common/x', 'two').status,
        'not-defined',
        'an entry is known by its container',
    );
    assert.equal(
        ix.resolve('common/x', 'loose').status,
        'unknown',
        'only the named key is a container',
    );
});

test('a folder-wins row names the definition under that folder, its name written byte for byte', () => {
    const wins = row('wins', {
        kind: 'folder-wins',
        databases: ['localization'],
        segment: 'replace',
    });
    const ix = index([wins]);
    ix.addFile('game', 'localization/english/a_l_english.yml', 'l_english:\n k: "a"\n j: "a"\n');
    ix.addFile(
        'mod',
        'localization/english/replace/b_l_english.yml',
        'l_english:\n k: "b"\n j: "b"\n',
    );
    ix.addFile('mod', 'localization/english/Replace/c_l_english.yml', 'l_english:\n j: "c"\n');
    assert.equal(
        winnerOf(ix.resolve('localization:l_english', 'k')),
        'mod:localization/english/replace/b_l_english.yml:12',
    );
    // `Replace` is another folder: only b is under `replace`.
    assert.equal(
        winnerOf(ix.resolve('localization:l_english', 'j')),
        'mod:localization/english/replace/b_l_english.yml:20',
    );
});

test("two under the folder: the row's within (same-segment) decides, by the file order; without it, not known", () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('mod', 'localization/english/replace/a_l_english.yml', 'l_english:\n k: "a"\n');
        ix.addFile('mod', 'localization/english/replace/b_l_english.yml', 'l_english:\n k: "b"\n');
    };
    const bare = row('wins', {
        kind: 'folder-wins',
        databases: ['localization'],
        segment: 'replace',
    });
    const open = index([bare, ORDER()]);
    files(open);
    const r = open.resolve('localization:l_english', 'k');
    assert.equal(r.status, 'unknown');
    assert.equal(r.reasons[0]?.kind, 'not-settled');
    const later = index([
        {
            ...bare,
            within: [{ scope: 'same-segment', resolve: 'later-wins', combine: 'whole' }],
        },
        ORDER(),
    ]);
    files(later);
    assert.equal(
        winnerOf(later.resolve('localization:l_english', 'k')),
        'mod:localization/english/replace/b_l_english.yml:12',
    );
});

test("within (same-block): two definitions in one container block take the row's word there", () => {
    const rows = [
        row('box', { kind: 'containers', databases: ['common/x'], keys: ['*'] }),
        row('later', {
            kind: 'key-resolution',
            databases: ['common/x'],
            forms: ['entry'],
            resolve: 'later-wins',
            combine: 'whole',
            within: [{ scope: 'same-block', resolve: 'earlier-wins', combine: 'whole' }],
        }),
        ORDER(),
    ];
    const ix = index(rows);
    ix.addFile('game', 'common/x/a.txt', 'NGroup = { K = 1 K = 2 }\nNGroup = { J = 1 }\n');
    ix.addFile('game', 'common/x/b.txt', 'NGroup = { J = 2 J = 3 }\n');
    // Inside one block the first; across blocks and files the later.
    assert.equal(winnerOf(ix.resolve('common/x', 'K', 'NGroup')), 'game:common/x/a.txt:11');
    assert.equal(winnerOf(ix.resolve('common/x', 'J', 'NGroup')), 'game:common/x/b.txt:11');
});

test('listing-depth: a file below a subfolder is read as its row says, and not known without one', () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('game', 'common/x/a.txt', 'k = 1\n');
        ix.addFile('game', 'common/x/sub/b.txt', 's = 1\n');
        ix.addFile('game', 'common/y/sub/c.txt', 'y = 1\n');
    };
    const flat = index([
        row('flat', {
            kind: 'listing-depth',
            overrides_rule: 4,
            databases: ['common/x'],
            recursive: false,
        }),
    ]);
    files(flat);
    assert.equal(flat.fileStatus('game', 'common/x/a.txt')?.read, 'yes');
    assert.deepEqual(flat.fileStatus('game', 'common/x/sub/b.txt')?.notReadBecause, {
        rule: 'flat',
    });
    assert.equal(flat.resolve('common/x', 's').status, 'not-read');
    assert.deepEqual(flat.fileStatus('game', 'common/y/sub/c.txt')?.questions, [
        { kind: 'listing-depth', folder: 'common/y', rule: null },
    ]);
    const partial = index([
        row('deep', {
            kind: 'listing-depth',
            overrides_rule: 4,
            databases: ['common/x'],
            recursive: true,
            status: 'partial',
        }),
    ]);
    files(partial);
    assert.deepEqual(partial.fileStatus('game', 'common/x/sub/b.txt')?.questions, [
        { kind: 'listing-depth', folder: 'common/x', rule: 'deep' },
    ]);
});

test('a partial or open row decides nothing: the reason names it', () => {
    const ix = index([
        row('maybe', {
            kind: 'key-resolution',
            databases: ['common/x'],
            resolve: 'all',
            status: 'partial',
        }),
    ]);
    ix.addFile('game', 'common/x/a.txt', 'k = 1\n');
    ix.addFile('game', 'common/x/b.txt', 'k = 2\n');
    const r = ix.resolve('common/x', 'k');
    assert.equal(r.status, 'unknown');
    assert.deepEqual(r.reasons, [
        {
            kind: 'not-settled',
            database: 'common/x',
            rule: 'maybe',
            status: 'partial',
            overrides_rule: 5,
        },
    ]);
});

test('statements: every definition is read and none wins', () => {
    const ix = index([
        row('statements', {
            kind: 'key-resolution',
            databases: ['common/x'],
            resolve: 'statements',
        }),
    ]);
    ix.addFile('game', 'common/x/a.txt', '1 = plains\n');
    ix.addFile('game', 'common/x/b.txt', '1 = { winter = 1 }\n');
    assert.equal(ix.resolve('common/x', '1').status, 'statements');
});

test('file-replace: the named layer replaces the other at an exact path; other pairs are open', () => {
    const ix = index([row('replace', { kind: 'file-replace', layer: 'mod', over: ['game'] })]);
    ix.addFile('game', 'common/x/a.txt', 'gone = 1\nk = 1\n');
    ix.addFile('mod', 'common/x/a.txt', 'k = 2\n');
    ix.addFile('jomini', 'common/x/j.txt', 'j = 1\n');
    ix.addFile('game', 'common/x/j.txt', 'j = 2\n');
    assert.equal(ix.resolve('common/x', 'gone').status, 'not-read');
    assert.equal(winnerOf(ix.resolve('common/x', 'k')), 'mod:common/x/a.txt:0');
    assert.deepEqual(ix.fileStatus('game', 'common/x/a.txt')?.replacedBy, {
        layer: 'mod',
        path: 'common/x/a.txt',
        rule: 'replace',
    });
    const j = ix.resolve('common/x', 'j');
    assert.equal(j.status, 'unknown');
    assert.deepEqual(
        j.reasons.map((r) => r.kind),
        ['file-unknown', 'file-unknown'],
    );
});

test('path-case: without a row a case difference is open; exact and case-insensitive decide it', () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('game', 'common/x/a.txt', 'k = 1\n');
        ix.addFile('mod', 'common/x/A.TXT', 'k = 2\n');
        ix.addFile('mod', 'Common/Y/b.txt', 'u = 1\n');
    };
    const replace = row('replace', { kind: 'file-replace', layer: 'mod', over: ['game'] });
    const open = index([replace]);
    files(open);
    assert.equal(open.fileStatus('game', 'common/x/a.txt')?.read, 'unknown');
    assert.equal(open.fileStatus('mod', 'Common/Y/b.txt')?.read, 'unknown');
    const exact = index([replace, row('case', { kind: 'path-case', compare: 'exact' })]);
    files(exact);
    assert.equal(exact.fileStatus('game', 'common/x/a.txt')?.read, 'yes', 'two different paths');
    assert.equal(exact.resolve('common/x', 'k').status, 'unknown', 'then a key row is missing');
    assert.equal(exact.fileStatus('mod', 'Common/Y/b.txt')?.read, 'no');
    const folded = index([
        replace,
        row('case', { kind: 'path-case', compare: 'case-insensitive' }),
    ]);
    files(folded);
    assert.equal(folded.fileStatus('game', 'common/x/a.txt')?.read, 'no');
    assert.equal(winnerOf(folded.resolve('common/x', 'k')), 'mod:common/x/A.TXT:0');
    assert.equal(folded.fileStatus('mod', 'Common/Y/b.txt')?.read, 'yes');
});

test('replace_path: without a row the files under it are open; with one they are hidden', () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('game', 'common/x/a.txt', 'k = 1\n');
        ix.addFile('game', 'common/x/sub/b.txt', 's = 1\n');
        ix.addFile('game', 'common/y/c.txt', 'y = 1\n');
        ix.addFile('mod', 'common/x/m.txt', 'm = 1\n');
        ix.setReplacePaths(['common/x']);
    };
    const open = index([]);
    files(open);
    assert.deepEqual(open.getReplacePaths(), ['common/x']);
    assert.deepEqual(open.fileStatus('game', 'common/x/a.txt')?.questions, [
        { kind: 'replace-path', path: 'common/x' },
    ]);
    assert.equal(open.fileStatus('game', 'common/x/sub/b.txt')?.read, 'unknown');
    assert.equal(open.fileStatus('game', 'common/y/c.txt')?.read, 'yes');
    assert.equal(
        open.fileStatus('mod', 'common/x/m.txt')?.read,
        'yes',
        'the mod never hides its own files',
    );
    const deep = index([row('rp', { kind: 'replace-path', hides: ['game'], subfolders: true })]);
    files(deep);
    assert.equal(deep.fileStatus('game', 'common/x/a.txt')?.read, 'no');
    assert.equal(deep.fileStatus('game', 'common/x/sub/b.txt')?.read, 'no');
    assert.equal(deep.resolve('common/x', 'k').status, 'not-read');
    // The folder is matched byte for byte: another spelling hides nothing.
    for (const written of ['common\\x', 'common/x/', 'Common/x']) {
        const other = index([
            row('rp', { kind: 'replace-path', hides: ['game'], subfolders: false }),
        ]);
        files(other);
        other.setReplacePaths([written]);
        assert.equal(other.fileStatus('game', 'common/x/a.txt')?.read, 'yes', written);
    }
});

test('without a file-identity row, files of one name in different folders are open', () => {
    const files = (ix: WorkspaceIndex): void => {
        ix.addFile('game', 'common/x/same.txt', 'a = 1\n');
        ix.addFile('game', 'common/y/same.txt', 'b = 1\n');
    };
    const open = index([]);
    files(open);
    assert.equal(open.resolve('common/x', 'a').status, 'unknown');
    const settled = index([
        row('identity', { kind: 'file-identity', by: 'relative-path', overrides_rule: 2 }),
    ]);
    files(settled);
    assert.equal(settled.resolve('common/x', 'a').status, 'single');
});

test('the rows of another platform do not hold', () => {
    const rows = [
        row('later', {
            kind: 'key-resolution',
            databases: ['common/x'],
            resolve: 'all',
            platforms: ['windows'],
        }),
    ];
    for (const [platform, status] of [
        ['linux', 'unknown'],
        ['windows', 'all'],
    ] as const) {
        const ix = index(rows, platform);
        ix.addFile('game', 'common/x/a.txt', 'k = 1\n');
        ix.addFile('game', 'common/x/b.txt', 'k = 2\n');
        assert.equal(ix.resolve('common/x', 'k').status, status, platform);
    }
});

// ─── Incremental update (item 3.7) ────────────────────────────────────────

const IDENTITY = row('identity', { kind: 'file-identity', by: 'relative-path', overrides_rule: 2 });
const REPLACE = row('replace', {
    kind: 'file-replace',
    layer: 'mod',
    over: ['game'],
    overrides_rule: 1,
});

function workspace(): WorkspaceIndex {
    const ix = index([IDENTITY, REPLACE]);
    ix.addFile('game', 'common/x/effects.txt', 'my_effect = { }\nother_effect = { }\n');
    ix.addFile('game', 'common/y/uses.txt', 'u = { my_effect = yes }\n');
    ix.addFile('game', 'common/y/unrelated.txt', 'v = { add_gold = 1 }\n');
    ix.addFile('mod', 'events/e.txt', 'e.1 = { immediate = { other_effect = yes } }\n');
    return ix;
}

test('a changed file updates its own entries and names the files that use what it defined or defines', () => {
    const ix = workspace();
    const result = ix.setFile(
        'game',
        'common/x/effects.txt',
        'renamed_effect = { }\nother_effect = { }\n',
    );
    assert.deepEqual(result.names, ['my_effect', 'other_effect', 'renamed_effect']);
    assert.deepEqual(
        result.dependents.map((f) => `${f.layer}:${f.path}`),
        ['game:common/y/uses.txt', 'mod:events/e.txt'],
    );
    assert.equal(ix.resolve('common/x', 'my_effect').status, 'not-defined');
    assert.equal(ix.resolve('common/x', 'renamed_effect').status, 'single');
    // The index equals one built from the new texts.
    const fresh = index([IDENTITY, REPLACE]);
    fresh.addFile('mod', 'events/e.txt', 'e.1 = { immediate = { other_effect = yes } }\n');
    fresh.addFile('game', 'common/y/unrelated.txt', 'v = { add_gold = 1 }\n');
    fresh.addFile('game', 'common/y/uses.txt', 'u = { my_effect = yes }\n');
    fresh.addFile('game', 'common/x/effects.txt', 'renamed_effect = { }\nother_effect = { }\n');
    assert.equal(ix.digest(), fresh.digest());
});

test('an edit that defines nothing new names only the users of what it defined', () => {
    const ix = workspace();
    const result = ix.setFile('game', 'common/y/unrelated.txt', 'v = { add_gold = 2 }\n');
    assert.deepEqual(result.names, ['v']);
    assert.deepEqual(result.dependents, []);
});

test("a mod file at a game file's path also names the users of what the game file defined", () => {
    const ix = workspace();
    const result = ix.setFile('mod', 'common/x/effects.txt', 'other_effect = { }\n');
    assert.deepEqual(result.names, ['my_effect', 'other_effect']);
    assert.deepEqual(
        result.dependents.map((f) => `${f.layer}:${f.path}`),
        ['game:common/y/uses.txt', 'mod:events/e.txt'],
    );
    assert.equal(ix.resolve('common/x', 'my_effect').status, 'not-read');
    // Removing it again restores the game file.
    const removed = ix.removeFile('mod', 'common/x/effects.txt');
    assert.deepEqual(removed.names, ['my_effect', 'other_effect']);
    assert.equal(ix.resolve('common/x', 'my_effect').status, 'single');
    assert.equal(ix.removeFile('mod', 'nothing.txt').file, null);
});

test('a file of a kind the index does not read is ignored', () => {
    const ix = workspace();
    assert.equal(ix.setFile('mod', 'gui/a.gui', 'x = { }').file, null);
    assert.equal(ix.addFile('mod', 'gfx/a.dds', new Uint8Array()), false);
});

test('uses are recorded with their places and the read status of their file', () => {
    const ix = workspace();
    assert.deepEqual(
        ix.references('my_effect').map((u) => [u.layer, u.file, u.range.start, u.read]),
        [['game', 'common/y/uses.txt', { line: 0, character: 6 }, 'yes']],
    );
    assert.deepEqual(ix.references('nobody'), []);
    assert.ok([...ix.usedNames()].includes('add_gold'));
});

test('groups lists every name of a database defined more than once', () => {
    const ix = index([]);
    ix.addFile('game', 'common/x/a.txt', 'k = 1\nonce = 1\n');
    ix.addFile('game', 'common/x/b.txt', 'k = 2\n');
    ix.addFile('game', 'common/y/c.txt', 'k = 3\n');
    assert.deepEqual(
        [...ix.groups()],
        [{ database: 'common/x', container: null, name: 'k', count: 2 }],
    );
    assert.deepEqual(ix.totals(), { files: 3, definitions: 4, uses: 4, lines: 7, names: 7 });
});

// ─── What parts D2 and D3 make a definition ──────────────────────────────

test("parts D2 and D3: namespace is no name, a constant is its file's, nested and file-named definitions", () => {
    const ix = new WorkspaceIndex({
        folders: specFolders(),
        rules: packageRules(),
        platform: 'linux',
    });
    ix.addFile('mod', 'events/a.txt', 'namespace = fixture\nfixture.1 = { }\n');
    ix.addFile('mod', 'events/b.txt', 'namespace = fixture\n');
    ix.addFile('mod', 'common/script_values/a.txt', '@x = 1\nv = @x\n');
    ix.addFile('mod', 'common/script_values/b.txt', '@x = 2\n');
    ix.addFile(
        'mod',
        'common/landed_titles/a.txt',
        'e_x = { k_x = { d_x = { c_x = { color = { 1 2 3 } b_x = { province = 1 } } } } }\n',
    );
    ix.addFile(
        'mod',
        'common/activities/activity_types/a.txt',
        'act_a = { options = { cat = { opt = { } } } }\nact_b = { options = { cat = { opt = { } } } }\n',
    );
    ix.addFile('mod', 'history/cultures/norse.txt', '867.1.1 = { }\n');
    // `namespace` declares a namespace by its value: no definition, written in two files.
    assert.equal(ix.resolve('events', 'namespace').status, 'not-defined');
    assert.equal(ix.resolve('events', 'fixture.1').status, 'single');
    // A constant holds for its file: two files, two names.
    assert.equal(ix.resolve('constants:common/script_values/a.txt', '@x').status, 'single');
    assert.equal(ix.resolve('constants:common/script_values/b.txt', '@x').status, 'single');
    // A landed title at any depth, and not the fields between.
    for (const title of ['e_x', 'k_x', 'd_x', 'c_x', 'b_x']) {
        assert.equal(ix.resolve('common/landed_titles', title).status, 'single', title);
    }
    assert.equal(ix.resolve('common/landed_titles', 'color').status, 'not-defined');
    assert.deepEqual(ix.references('c_x'), [], "a nested definition's own key is not a use");
    // An activity's option is known by its category, and the category by its record (part
    // D3's scope_parent, format 8): the same name under two is two objects.
    const db = 'common/activities/activity_types#activity_option';
    assert.equal(ix.resolve(db, 'opt', 'act_a/options/cat').status, 'single');
    assert.equal(ix.resolve(db, 'opt', 'act_b/options/cat').status, 'single');
    const category = ix.resolve(
        'common/activities/activity_types#activity_option_category',
        'cat',
        'act_a',
    );
    assert.equal(category.status, 'single');
    assert.equal(category.definitions[0]?.parent, 'act_a/options');
    // A culture's history is named by its file.
    const culture = ix.definitions('norse', { database: 'history/cultures' });
    assert.deepEqual(
        culture.map((d) => [d.form, d.start, d.end]),
        [['file', 0, 0]],
    );
});

test('format 8, part D3: a name whose scope is not settled, under two parents, has no winner', () => {
    const ix = new WorkspaceIndex({
        folders: specFolders(),
        rules: packageRules(),
        platform: 'linux',
    });
    // activity_window_character: parent record, resting on the measurement alone.
    ix.addFile(
        'mod',
        'common/activities/activity_types/a.txt',
        'act_a = { window_characters = { host = { } } }\nact_b = { window_characters = { host = { } } }\n',
    );
    const db = 'common/activities/activity_types#activity_window_character';
    const r = ix.resolve(db, 'host');
    assert.equal(r.status, 'unknown');
    assert.deepEqual(r.reasons, [
        {
            kind: 'name-scope',
            database: db,
            parents: ['act_a/window_characters', 'act_b/window_characters'],
        },
    ]);
    assert.ok(r.definitions.every((d) => d.scope === 'not-settled'));
});

test('format 8, part D1: an alias line of a coat of arms is replayed in read order', () => {
    const ix = new WorkspaceIndex({
        folders: specFolders(),
        rules: packageRules(),
        platform: 'linux',
    });
    const db = 'common/coat_of_arms/coat_of_arms';
    ix.addFile(
        'game',
        `${db}/00_a.txt`,
        'early = late\nbase = { pattern = "a" }\nother = base\nlate = { }\ntemplate = { t = { } }\n',
    );
    ix.addFile('mod', `${db}/zz_b.txt`, 'other = { pattern = "b" }\n');
    // A target not read yet: the line does nothing, and nothing is in force for its key.
    assert.equal(ix.resolve(db, 'early').status, 'not-in-force');
    // An alias, then a block for the key: the block fills the object both names share.
    const base = ix.resolve(db, 'base');
    assert.equal(base.status, 'winner');
    assert.equal(base.winner.file, `${db}/00_a.txt`);
    assert.equal(base.shared?.filledBy.file, `${db}/zz_b.txt`);
    assert.deepEqual(base.shared.names, ['base', 'other']);
    const other = ix.resolve(db, 'other');
    assert.equal(other.status === 'winner' ? other.winner.layer : null, 'mod');
    // A name no alias line touches answers as before.
    assert.equal(ix.resolve(db, 'late').status, 'single');
    assert.equal(ix.resolve(db, 't', 'template').status, 'single');
});

test('format 8, part D1: a localization file without a byte-order mark adds no keys; editor text is read as written', () => {
    const ix = new WorkspaceIndex({
        folders: specFolders(),
        rules: packageRules(),
        platform: 'windows',
    });
    const body = 'l_english:\n key_a: "a"\n';
    ix.addFile('mod', 'localization/english/a_l_english.yml', Buffer.from(body, 'utf8'));
    ix.addFile(
        'mod',
        'localization/english/b_l_english.yml',
        Buffer.from(`\uFEFF${body.replace('key_a', 'key_b')}`, 'utf8'),
    );
    ix.addFile('mod', 'localization/english/c_l_english.yml', body.replace('key_a', 'key_c'));
    assert.equal(
        ix.getFile('mod', 'localization/english/a_l_english.yml')?.noDefinitions,
        'msg-localization-missing-bom',
    );
    assert.equal(ix.definitions('key_a').length, 0);
    assert.equal(ix.definitions('key_b').length, 1);
    assert.equal(ix.definitions('key_c').length, 1);
});
