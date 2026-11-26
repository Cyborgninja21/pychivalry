import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { CHECK_KINDS, isAdvice, type CheckCode } from './finding.js';
import {
    CODE,
    isTextureName,
    pathFields,
    TEXTURE_EXTENSIONS,
    texturePathOf,
    texturePlaces,
} from './graphics-missing-file.js';
import { parse } from '../syntax/parser.js';
import {
    checkFixture,
    checkText,
    expectedFindings,
    specContext,
    type WrittenFinding,
} from './testing.js';
import type { WorkspaceNames } from './names.js';

const GAME = 'graphics';

const notAdvice = (found: WrittenFinding[]): WrittenFinding[] =>
    found.filter((f) => !isAdvice(f.code as CheckCode));

test(`${CODE} fires on its bad fixture, and only it`, () => {
    const found = notAdvice(checkFixture('graphics-missing-file-bad', { game: GAME }));
    assert.deepEqual(found, expectedFindings('graphics-missing-file-bad'));
    assert.equal(found.length, 5);
    assert.ok(found.every((f) => f.code === CODE && f.severity === 'warning'));
    assert.ok(found.every((f) => f.message.startsWith('Failed to load texture ')));
    // The constant's value is judged at the field that names it; a path that matches a base-game
    // file only in other letter case names that file, on Linux (the fixture's platform).
    assert.ok(found.some((f) => f.data['constant'] === '@fixture_constant_picture'));
    assert.deepEqual(found.find((f) => f.data['other_case'] !== undefined)?.data['other_case'], [
        'gfx/interface/illustrations/decisions/fixture_base_picture.dds',
    ]);
});

test(`${CODE} is silent on its good fixture: the mod's, the game's, a DLC pack's and jomini's textures`, () => {
    assert.deepEqual(notAdvice(checkFixture('graphics-missing-file-good', { game: GAME })), []);
});

test(`${CODE} is silent when no game folder is set`, () => {
    // Read with no base game: a texture the mod lacks may be the game's.
    assert.deepEqual(
        checkFixture('graphics-missing-file-bad').filter((f) => f.code === CODE),
        [],
    );
});

test(`${CODE} rests on its catalogue message`, () => {
    assert.equal(CHECK_KINDS[CODE].severity, 'warning');
    assert.equal(CHECK_KINDS[CODE].catalogue, 'failed_to_load_texture_X_file_not_found');
});

test(`${CODE} reads the fields the package documents as a file path and measures as paths`, () => {
    const spec = committedSpec();
    const fields = pathFields(spec);
    const all = [...fields.values()].flat().map((f) => `${f.directory} ${f.path.join('/')}`);
    // On 1.21.0.3, 13 fields of 8 folders (docs/graphics-check.md).
    assert.equal(all.length, 13);
    assert.equal(fields.size, 8);
    for (const expected of [
        'common/decisions picture/reference',
        'common/decisions extra_picture',
        'common/event_backgrounds background/reference',
        'events queue_icon',
    ]) {
        assert.ok(all.includes(expected), expected);
    }
    // Measured as a path but documented as a file name inside a define's folder: not read.
    assert.ok(!all.includes('common/buildings type_icon'));
    // Measured as a path but documented with no type: not read (the request to the spec work).
    assert.ok(!all.includes('common/accolade_types icon'));
    for (const field of [...fields.values()].flat()) {
        let level = spec.data.schema[field.directory]?.fields;
        let last;
        for (const key of field.path) {
            last = level?.[key];
            level = last?.fields;
        }
        assert.ok(last?.info_type?.includes('file_path') === true, field.path.join('/'));
        assert.ok(last.value_type?.split('|').includes('path') === true, field.path.join('/'));
    }
});

test('a texture path is judged only when it is a path from the top of the game folders', () => {
    assert.deepEqual(TEXTURE_EXTENSIONS, ['.dds', '.png', '.tga']);
    assert.ok(isTextureName('gfx/a/b.DDS'));
    assert.ok(!isTextureName('gfx/a/b.bk2'));
    assert.deepEqual(texturePathOf('gfx/interface/x.dds'), {
        kind: 'texture',
        path: 'gfx/interface/x.dds',
    });
    assert.deepEqual(texturePathOf('gfx/interface/x.bk2'), { kind: 'not-texture' });
    assert.deepEqual(texturePathOf('event:/SFX/x'), { kind: 'not-texture' });
    const why = (value: string): string => {
        const reading = texturePathOf(value);
        return reading.kind === 'not-decided' ? reading.why : reading.kind;
    };
    assert.equal(why('x.dds'), 'no-folder');
    assert.equal(why('gfx/../gfx/x.dds'), 'parent-segment');
    assert.equal(why('./gfx/x.dds'), 'parent-segment');
    assert.equal(why('gfx//x.dds'), 'empty-segment');
    assert.equal(why('/gfx/x.dds'), 'from-root');
    assert.equal(why('C:/gfx/x.dds'), 'from-root');
    assert.equal(why('gfx\\interface\\x.dds'), 'backslash');
    assert.equal(why('gfx/$NAME$.dds'), 'parameter');
    assert.equal(why('gfx/[x].dds'), 'bracket');
});

test('an @constant is followed only when the file sets it at its top level', () => {
    const spec = committedSpec();
    const { folders } = specContext();
    const text = [
        '@top = "gfx/interface/top.dds"',
        'fixture_decision = {',
        '\tpicture = { reference = @top }',
        '\tpicture = { reference = @nowhere }',
        '\tpicture = { reference = @[ 1 + 1 ] }',
        '}',
    ].join('\n');
    const places = texturePlaces({
        spec,
        folders,
        file: 'common/decisions/x.txt',
        tree: parse(text).file,
    });
    assert.deepEqual(
        places.map((p) => [p.constant, p.reading]),
        [
            ['@top', { kind: 'texture', path: 'gfx/interface/top.dds' }],
            ['@nowhere', { kind: 'not-decided', why: 'constant-not-followed' }],
        ],
    );
});

/** The names of a base game holding the files `files` (in layer `game`), on a platform. */
function gameWith(files: readonly string[], pathCase: 'exact' | 'case-insensitive' | null) {
    const names: Partial<WorkspaceNames> = {
        baseGame: true,
        isScopeSaved: () => true,
        isLocalizationKey: () => true,
        isBaseGameLocalizationKey: () => true,
        isUsed: () => true,
        hasDefinition: () => true,
        isRecordName: () => true,
        isVariableSet: () => true,
        textScopeReads: () => [],
        unreadFilesAt: (path) =>
            files
                .filter((f) => f.toLowerCase() === path.toLowerCase())
                .map((f) => ({ layer: 'game', path: f })),
        unreadLayers: ['game'],
        pathCase,
    };
    return names;
}

const DECISION = 'fixture_decision = {\n\tpicture = { reference = "gfx/a/Picture.dds" }\n}\n';

test("letter case is the platform's path-case row: missing where exact, found where folded, undecided where no row", () => {
    const codes = (pathCase: 'exact' | 'case-insensitive' | null): string[] =>
        checkText('common/decisions/x.txt', DECISION, {}, gameWith(['gfx/a/picture.dds'], pathCase))
            .filter((f) => f.code === CODE)
            .map((f) => f.code);
    assert.deepEqual(codes('exact'), [CODE]);
    assert.deepEqual(codes('case-insensitive'), []);
    assert.deepEqual(codes(null), []);
});

test('the base game must be known: without its files nothing is missing', () => {
    const names = { ...gameWith([], 'exact'), unreadLayers: ['mod'] };
    assert.deepEqual(
        checkText('common/decisions/x.txt', DECISION, {}, names).filter((f) => f.code === CODE),
        [],
    );
    assert.equal(
        checkText('common/decisions/x.txt', DECISION, {}, gameWith([], 'exact')).filter(
            (f) => f.code === CODE,
        ).length,
        1,
    );
});
