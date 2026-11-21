/**
 * The graphics-file check (GFX001, post-2.0 Phase 3): every behaviour of pychivalry PR #56's
 * gfx_validator.py (its 43 unit and 3 integration tests, ported by intent) plus the
 * resolution against the base game's game/ and game/dlc/* folders, the case-insensitive
 * lookup and the directory cache the file watcher invalidates.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { CK3Parser } from 'pychivalry-engine';
import {
    baseGameRoots,
    createGraphicsResolver,
    DirectoryCache,
    extractGraphicsPath,
    GRAPHICS_EXTENSIONS,
    GRAPHICS_KEYS,
    GraphicsResolver,
    isGraphicsReference,
    resolveGraphicsPath,
    validateGraphics,
} from '../../server/ck3/validation/graphics';
import { extensionPlugins } from '../../server/plugins';

/** Create `files` (paths relative to `root`, '/' separators) with placeholder content. */
function touch(root: string, ...files: string[]): void {
    for (const file of files) {
        const full = path.join(root, ...file.split('/'));
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, 'placeholder');
    }
}

function parse(text: string) {
    return new CK3Parser({}).parse(text).ast;
}

/** A resolver over fixed roots (no file system). */
function fixed(existing: string[], baseGameKnown = true): GraphicsResolver {
    const lower = new Set(existing.map((p) => p.toLowerCase()));
    return {
        roots: [],
        baseGameKnown,
        resolve: (p) => (lower.has(p.toLowerCase()) ? p : undefined),
    };
}

describe('Graphics files (GFX001)', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ck3-gfx-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    describe('isGraphicsReference', () => {
        const keys = [
            'icon',
            'texture',
            'sprite',
            'background',
            'portrait_texture',
            'reference',
            'activity_window_background',
            'background_texture',
            'icon_texture',
        ];

        it('knows exactly the nine reference keys of PR #56', () => {
            assert.deepStrictEqual([...GRAPHICS_KEYS].sort(), [...keys].sort());
        });

        for (const key of keys) {
            it(`${key} with a graphics path is a reference`, () => {
                assert.strictEqual(isGraphicsReference(key, 'gfx/interface/x.dds'), true);
            });
        }

        it('other keys are not references', () => {
            for (const key of ['picture', 'name', 'desc', 'icons', 'Icon', 'file', undefined]) {
                assert.strictEqual(isGraphicsReference(key, 'gfx/interface/x.dds'), false);
            }
        });

        it('a reference key with a non-path value is not a reference', () => {
            assert.strictEqual(isGraphicsReference('icon', 'standard_character_event'), false);
        });
    });

    describe('extractGraphicsPath', () => {
        for (const ext of ['.dds', '.png', '.tga']) {
            it(`accepts ${ext}, in any case`, () => {
                assert.strictEqual(extractGraphicsPath(`gfx/a/b${ext}`), `gfx/a/b${ext}`);
                assert.strictEqual(
                    extractGraphicsPath(`gfx/a/b${ext.toUpperCase()}`),
                    `gfx/a/b${ext.toUpperCase()}`
                );
            });
        }

        it('lists exactly .dds, .png and .tga', () => {
            assert.deepStrictEqual([...GRAPHICS_EXTENSIONS].sort(), ['.dds', '.png', '.tga']);
        });

        it('rejects other extensions and values without one', () => {
            for (const v of ['gfx/a/b.jpg', 'gfx/a/b.bmp', 'gfx/a/b', 'gfx/a/b.dds.txt']) {
                assert.strictEqual(extractGraphicsPath(v), undefined, v);
            }
        });

        it('skips bare names and bare file names (database keys, database folders)', () => {
            assert.strictEqual(extractGraphicsPath('standard_character_event'), undefined);
            assert.strictEqual(extractGraphicsPath('death_unknown.dds'), undefined);
            assert.strictEqual(extractGraphicsPath('trait_brave'), undefined);
        });

        it('skips $VARIABLE$ placeholders and [...] expressions', () => {
            assert.strictEqual(extractGraphicsPath('gfx/icons/$ICON$.dds'), undefined);
            assert.strictEqual(extractGraphicsPath('$PATH$/x.dds'), undefined);
            assert.strictEqual(extractGraphicsPath('gfx/[GetIcon]/x.dds'), undefined);
        });

        it('strips quotes and whitespace, normalises backslashes and a leading ./', () => {
            assert.strictEqual(extractGraphicsPath('"gfx/a/b.dds"'), 'gfx/a/b.dds');
            assert.strictEqual(extractGraphicsPath("  'gfx/a/b.dds' "), 'gfx/a/b.dds');
            assert.strictEqual(extractGraphicsPath('gfx\\a\\b.dds'), 'gfx/a/b.dds');
            assert.strictEqual(extractGraphicsPath('./gfx/a/b.dds'), 'gfx/a/b.dds');
        });

        it('accepts content paths outside gfx/ (relative to a content root all the same)', () => {
            assert.strictEqual(extractGraphicsPath('gui/textures/x.png'), 'gui/textures/x.png');
        });

        it('skips absolute paths, .. segments and empty segments', () => {
            for (const v of [
                '/gfx/a.dds',
                'C:/gfx/a.dds',
                '../gfx/a.dds',
                'gfx//a.dds',
                'gfx/../a.dds',
            ]) {
                assert.strictEqual(extractGraphicsPath(v), undefined, v);
            }
        });

        it('skips non-strings and empty values', () => {
            for (const v of [undefined, 3, true, '', '""']) {
                assert.strictEqual(extractGraphicsPath(v), undefined, String(v));
            }
        });
    });

    describe('resolveGraphicsPath', () => {
        it('finds a file relative to the mod root', () => {
            touch(tmp, 'mod/gfx/interface/icons/a.dds');
            const mod = path.join(tmp, 'mod');
            assert.strictEqual(
                resolveGraphicsPath('gfx/interface/icons/a.dds', [mod], new DirectoryCache()),
                path.join(mod, 'gfx', 'interface', 'icons', 'a.dds')
            );
        });

        it('returns undefined when no root has the file', () => {
            touch(tmp, 'mod/gfx/interface/icons/a.dds');
            const cache = new DirectoryCache();
            const mod = path.join(tmp, 'mod');
            assert.strictEqual(
                resolveGraphicsPath('gfx/interface/icons/b.dds', [mod], cache),
                undefined
            );
            assert.strictEqual(resolveGraphicsPath('gfx/missing/a.dds', [mod], cache), undefined);
            assert.strictEqual(
                resolveGraphicsPath('gfx/a.dds', [path.join(tmp, 'no-such-root')], cache),
                undefined
            );
        });

        it('matches every segment case-insensitively', () => {
            touch(tmp, 'mod/GFX/Interface/Icons/Brave_Icon.DDS');
            const mod = path.join(tmp, 'mod');
            const found = resolveGraphicsPath(
                'gfx/interface/icons/brave_icon.dds',
                [mod],
                new DirectoryCache()
            );
            assert.strictEqual(
                found,
                path.join(mod, 'GFX', 'Interface', 'Icons', 'Brave_Icon.DDS')
            );
        });

        it('a directory is not a file, and a file is not a directory', () => {
            touch(tmp, 'mod/gfx/a.dds/inner.dds', 'mod/gfx/b.dds');
            const mod = path.join(tmp, 'mod');
            const cache = new DirectoryCache();
            assert.strictEqual(resolveGraphicsPath('gfx/a.dds', [mod], cache), undefined);
            assert.strictEqual(resolveGraphicsPath('gfx/b.dds/x.dds', [mod], cache), undefined);
        });

        it('searches the roots in order', () => {
            touch(tmp, 'first/gfx/a.dds', 'second/gfx/a.dds', 'second/gfx/b.dds');
            const roots = [path.join(tmp, 'first'), path.join(tmp, 'second')];
            const cache = new DirectoryCache();
            assert.strictEqual(
                resolveGraphicsPath('gfx/a.dds', roots, cache),
                path.join(tmp, 'first', 'gfx', 'a.dds')
            );
            assert.strictEqual(
                resolveGraphicsPath('gfx/b.dds', roots, cache),
                path.join(tmp, 'second', 'gfx', 'b.dds')
            );
        });

        it('reads each directory once', () => {
            touch(tmp, 'mod/gfx/icons/a.dds', 'mod/gfx/icons/b.dds');
            const mod = path.join(tmp, 'mod');
            const cache = new DirectoryCache();
            for (let i = 0; i < 10; i++) {
                resolveGraphicsPath('gfx/icons/a.dds', [mod], cache);
                resolveGraphicsPath('gfx/icons/b.dds', [mod], cache);
                resolveGraphicsPath('gfx/icons/c.dds', [mod], cache);
            }
            assert.strictEqual(cache.reads, 3, 'mod/, mod/gfx/, mod/gfx/icons/');
        });
    });

    describe('directory cache invalidation', () => {
        it('a file created after the first lookup is found once its creation is reported', () => {
            touch(tmp, 'mod/gfx/icons/a.dds');
            const mod = path.join(tmp, 'mod');
            const cache = new DirectoryCache();
            assert.strictEqual(resolveGraphicsPath('gfx/icons/new.dds', [mod], cache), undefined);
            touch(tmp, 'mod/gfx/icons/new.dds');
            // Not reported yet: the cached listing still answers.
            assert.strictEqual(resolveGraphicsPath('gfx/icons/new.dds', [mod], cache), undefined);
            cache.invalidate(path.join(mod, 'gfx', 'icons', 'new.dds'));
            assert.ok(resolveGraphicsPath('gfx/icons/new.dds', [mod], cache));
        });

        it('a deleted file is missing once its deletion is reported', () => {
            touch(tmp, 'mod/gfx/icons/a.dds');
            const mod = path.join(tmp, 'mod');
            const cache = new DirectoryCache();
            assert.ok(resolveGraphicsPath('gfx/icons/a.dds', [mod], cache));
            const file = path.join(mod, 'gfx', 'icons', 'a.dds');
            fs.rmSync(file);
            cache.invalidate(file);
            assert.strictEqual(resolveGraphicsPath('gfx/icons/a.dds', [mod], cache), undefined);
        });

        it('a file in new folders is found (the folders above it are listed again)', () => {
            touch(tmp, 'mod/gfx/a.dds');
            const mod = path.join(tmp, 'mod');
            const cache = new DirectoryCache();
            assert.strictEqual(resolveGraphicsPath('gfx/new/deep/b.dds', [mod], cache), undefined);
            touch(tmp, 'mod/gfx/new/deep/b.dds');
            cache.invalidate(path.join(mod, 'gfx', 'new', 'deep', 'b.dds'));
            assert.ok(resolveGraphicsPath('gfx/new/deep/b.dds', [mod], cache));
        });

        it('a deleted folder drops the listings below it', () => {
            touch(tmp, 'mod/gfx/sub/a.dds');
            const mod = path.join(tmp, 'mod');
            const cache = new DirectoryCache();
            assert.ok(resolveGraphicsPath('gfx/sub/a.dds', [mod], cache));
            const sub = path.join(mod, 'gfx', 'sub');
            fs.rmSync(sub, { recursive: true });
            cache.invalidate(sub);
            assert.strictEqual(resolveGraphicsPath('gfx/sub/a.dds', [mod], cache), undefined);
        });

        it('unrelated listings stay cached', () => {
            touch(tmp, 'mod/gfx/a/x.dds', 'mod/gfx/b/y.dds');
            const mod = path.join(tmp, 'mod');
            const cache = new DirectoryCache();
            resolveGraphicsPath('gfx/a/x.dds', [mod], cache);
            resolveGraphicsPath('gfx/b/y.dds', [mod], cache);
            const reads = cache.reads;
            cache.invalidate(path.join(mod, 'gfx', 'a', 'z.dds'));
            resolveGraphicsPath('gfx/b/y.dds', [mod], cache);
            // mod/ and mod/gfx/ were dropped (above the change) and read again; gfx/b/ was not.
            assert.strictEqual(cache.reads, reads + 2);
        });
    });

    describe('base game resolution', () => {
        it('the base game roots are game/ then every game/dlc/<dlc>/ in name order', () => {
            const game = path.join(tmp, 'game');
            touch(game, 'common/x.txt', 'dlc/dlc004_ep1/dlc004.dlc', 'dlc/dlc003_fp1/dlc003.dlc');
            assert.deepStrictEqual(baseGameRoots(game, new DirectoryCache()), [
                game,
                path.join(game, 'dlc', 'dlc003_fp1'),
                path.join(game, 'dlc', 'dlc004_ep1'),
            ]);
        });

        it('a game without dlc/ has game/ alone', () => {
            const game = path.join(tmp, 'game');
            touch(game, 'common/x.txt');
            assert.deepStrictEqual(baseGameRoots(game, new DirectoryCache()), [game]);
        });

        it('resolves against the mod, then game/, then the DLC folders', () => {
            const mod = path.join(tmp, 'mod');
            const game = path.join(tmp, 'game');
            touch(mod, 'gfx/mod.dds', 'gfx/both.dds');
            touch(game, 'gfx/base.dds', 'gfx/both.dds', 'dlc/dlc007_ep2/gfx/dlc.dds');
            const r = createGraphicsResolver([mod], game, new DirectoryCache());
            assert.strictEqual(r.baseGameKnown, true);
            assert.strictEqual(r.resolve('gfx/mod.dds'), path.join(mod, 'gfx', 'mod.dds'));
            assert.strictEqual(r.resolve('gfx/both.dds'), path.join(mod, 'gfx', 'both.dds'));
            assert.strictEqual(r.resolve('gfx/base.dds'), path.join(game, 'gfx', 'base.dds'));
            assert.strictEqual(
                r.resolve('gfx/DLC.dds'),
                path.join(game, 'dlc', 'dlc007_ep2', 'gfx', 'dlc.dds')
            );
            assert.strictEqual(r.resolve('gfx/none.dds'), undefined);
        });

        it('without a base game only the mod roots are searched', () => {
            const mod = path.join(tmp, 'mod');
            touch(mod, 'gfx/mod.dds');
            const r = createGraphicsResolver([mod], undefined, new DirectoryCache());
            assert.strictEqual(r.baseGameKnown, false);
            assert.deepStrictEqual(r.roots, [mod]);
        });
    });

    describe('validateGraphics', () => {
        const ast = (body: string) => parse(`test.0001 = {\n${body}\n}\n`);

        it('reports a missing file as GFX001, a warning, with the PR #56 message', () => {
            const d = validateGraphics(
                ast('\ticon = "gfx/interface/icons/missing.dds"'),
                fixed([])
            );
            assert.strictEqual(d.length, 1);
            assert.strictEqual(d[0].code, 'GFX001');
            assert.strictEqual(d[0].severity, DiagnosticSeverity.Warning);
            assert.strictEqual(
                d[0].message,
                'Graphics file not found: "gfx/interface/icons/missing.dds"'
            );
        });

        it('anchors the warning on the value', () => {
            const d = validateGraphics(ast('\ticon = "gfx/a/missing.dds"'), fixed([]));
            assert.deepStrictEqual(d[0].range, {
                start: { line: 1, character: 8 },
                end: { line: 1, character: 27 },
            });
        });

        it('reports nothing for files that exist', () => {
            const d = validateGraphics(
                ast('\ticon = "gfx/a/b.dds"\n\ttexture = "gfx/A/C.PNG"'),
                fixed(['gfx/a/b.dds', 'gfx/a/c.png'])
            );
            assert.deepStrictEqual(d, []);
        });

        for (const key of [...GRAPHICS_KEYS]) {
            it(`checks ${key}`, () => {
                const d = validateGraphics(ast(`\t${key} = "gfx/missing/${key}.dds"`), fixed([]));
                assert.strictEqual(d.length, 1);
            });
        }

        for (const ext of ['dds', 'png', 'tga']) {
            it(`checks .${ext} files`, () => {
                const d = validateGraphics(ast(`\ticon = "gfx/missing/x.${ext}"`), fixed([]));
                assert.strictEqual(d.length, 1);
            });
        }

        it('skips non-path values, bare file names, other extensions and $VARIABLE$ paths', () => {
            const d = validateGraphics(
                ast(
                    [
                        '\ticon = standard_character_event',
                        '\ticon = "death_unknown.dds"',
                        '\ttexture = "gfx/a/b.jpg"',
                        '\ticon = "gfx/icons/$ICON$.dds"',
                        '\tbackground = { reference = bp1_tavern }',
                        '\tpicture = "gfx/missing/picture.dds"',
                    ].join('\n')
                ),
                fixed([])
            );
            assert.deepStrictEqual(d, []);
        });

        it('finds references in nested blocks', () => {
            const d = validateGraphics(
                ast('\toption = { picture = { reference = "gfx/deep/missing.dds" } }'),
                fixed([])
            );
            assert.strictEqual(d.length, 1);
            assert.strictEqual(d[0].range.start.line, 1);
        });

        it('reports a path once per file, at its first reference (case-insensitively)', () => {
            const d = validateGraphics(
                ast(
                    [
                        '\ticon = "gfx/a/missing.dds"',
                        '\toption = { icon = "gfx/a/missing.dds" }',
                        '\toption = { icon = "GFX/A/Missing.dds" }',
                        '\ttexture = "gfx/a/other.dds"',
                    ].join('\n')
                ),
                fixed([])
            );
            assert.deepStrictEqual(
                d.map((x) => [x.range.start.line, x.message]),
                [
                    [1, 'Graphics file not found: "gfx/a/missing.dds"'],
                    [4, 'Graphics file not found: "gfx/a/other.dds"'],
                ]
            );
        });

        it('reads unquoted paths', () => {
            const d = validateGraphics(ast('\ticon = gfx/a/missing.dds'), fixed([]));
            assert.strictEqual(d.length, 1);
        });

        it('an empty file or one without graphics references has nothing to report', () => {
            assert.deepStrictEqual(validateGraphics(parse(''), fixed([])), []);
            assert.deepStrictEqual(
                validateGraphics(ast('\ttype = character_event\n\ttitle = x.t'), fixed([])),
                []
            );
        });

        it('mixes existing and missing files in real structures (activity, decision, event)', () => {
            const text = [
                'rq_grand_debauch = {',
                '\tactivity_window_background = "gfx/interface/activities/placeholder.dds"',
                '\tphases = {',
                '\t\tphase_1 = { icon = "gfx/interface/icons/activity_phase_1.dds" }',
                '\t\tphase_2 = { icon = "gfx/interface/icons/activity_phase_2.dds" }',
                '\t}',
                '}',
                'my_decision = {',
                '\tpicture = { reference = "gfx/interface/illustrations/decisions/decision_misc.dds" }',
                '}',
                'my_event.0001 = {',
                '\tbackground = "gfx/interface/illustrations/missing_scene.dds"',
                '}',
            ].join('\n');
            const d = validateGraphics(
                parse(text),
                fixed([
                    'gfx/interface/icons/activity_phase_1.dds',
                    'gfx/interface/illustrations/decisions/decision_misc.dds',
                ])
            );
            assert.deepStrictEqual(
                d.map((x) => x.range.start.line + 1),
                [2, 5, 12]
            );
        });

        it('with no roots at all every path is missing (once the base game is known)', () => {
            const r = createGraphicsResolver([], path.join(tmp, 'nothing'), new DirectoryCache());
            const d = validateGraphics(ast('\ticon = "gfx/a/b.dds"'), r);
            assert.strictEqual(d.length, 1);
        });

        it('reports nothing while the base game is unknown', () => {
            const d = validateGraphics(ast('\ticon = "gfx/a/missing.dds"'), fixed([], false));
            assert.deepStrictEqual(d, []);
        });
    });

    describe('the graphics plug-in', () => {
        it('is registered as `graphics` and emits engine diagnostics', () => {
            const mod = path.join(tmp, 'mod');
            const game = path.join(tmp, 'game');
            touch(mod, 'gfx/here.dds');
            touch(game, 'common/x.txt');
            const plugin = extensionPlugins({
                graphics: () => createGraphicsResolver([mod], game, new DirectoryCache()),
            }).find((p) => p.name === 'graphics');
            assert.ok(plugin);
            const text = 'x = {\n\ticon = "gfx/here.dds"\n\ticon = "gfx/gone.dds"\n}\n';
            const out = plugin.run({
                ast: parse(text),
                text,
                file: 'events/x.txt',
                uri: 'file:///mod/events/x.txt',
            } as Parameters<typeof plugin.run>[0]);
            assert.deepStrictEqual(
                out.map((d) => [d.code, d.severity, d.file, d.range.start.line, d.source]),
                [['GFX001', 'warning', 'events/x.txt', 2, 'plugin']]
            );
        });

        it('does nothing when switched off or without a resolver', () => {
            for (const env of [{}, { graphics: () => undefined }]) {
                const plugin = extensionPlugins(env).find((p) => p.name === 'graphics');
                assert.ok(plugin);
                const text = 'x = { icon = "gfx/gone.dds" }\n';
                const out = plugin.run({
                    ast: parse(text),
                    text,
                    file: 'events/x.txt',
                    uri: 'file:///mod/events/x.txt',
                } as Parameters<typeof plugin.run>[0]);
                assert.deepStrictEqual(out, []);
            }
        });
    });
});
