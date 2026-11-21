/**
 * One test per plug-in code of data/diagnostics.yaml (2.2 evidence audit): each code is
 * triggered by a minimal case and reported with the severity the catalogue gives it; a code
 * at information or hint says "Convention" in its message. A catalogue code without a case
 * here fails the test, so a new code cannot ship without one.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { diagnose, LocalizationIndex, pathToUri, Workspace } from 'pychivalry-engine';
import { DiagnosticSeverity } from 'vscode-languageserver/node';
import { enginePlugins, localizationDiagnostics } from '../../server/plugins';
import { BaseGameData } from '../../server/data/base-game';
import { DataLoader } from '../../server/data/loader';
import { createGraphicsResolver, DirectoryCache } from '../../server/ck3/validation/graphics';

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const MOCK_GAME = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'test',
    'fixtures',
    'mock-ck3-game'
);

interface Case {
    /** Mod-relative file. */
    file: string;
    text: string;
}

const EVENT = (body: string) =>
    `namespace = t\nt.1 = {\n\ttype = character_event\n\ttitle = t.1.t\n\tdesc = t.1.desc\n\tleft_portrait = root\n${body}\n}\n`;
const OPTION = '\toption = { name = t.1.a }';

/** Script-file cases, by code. */
const SCRIPT: Record<string, Case> = {
    CK3550: {
        file: 'events/a.txt',
        text: EVENT(
            `\ttrigger = { scope:x = { is_adult = yes } }\n\timmediate = { save_scope_as = x }\n${OPTION}`
        ),
    },
    CK3551: {
        file: 'events/a.txt',
        text: EVENT(
            `\tdesc = { desc = scope:late }\n\toption = { name = t.1.a save_scope_as = late }`
        ),
    },
    CK3552: {
        file: 'events/a.txt',
        text: EVENT(
            `\tdesc = { triggered_desc = { trigger = { scope:late = { is_adult = yes } } desc = t.1.d } }\n\toption = { name = t.1.a save_scope_as = late }`
        ),
    },
    CK3553: {
        file: 'events/a.txt',
        text: EVENT(
            `\ttrigger = { has_local_variable = v }\n\timmediate = { set_local_variable = v }\n${OPTION}`
        ),
    },
    CK3554: {
        file: 'events/a.txt',
        text: EVENT(
            `\timmediate = { save_temporary_scope_as = tmp trigger_event = { id = t.2 scope = tmp } }\n${OPTION}`
        ),
    },
    CK3560: {
        file: 'events/a.txt',
        text: EVENT(
            `\toption = { name = t.1.a random_courtier = { save_scope_as = late } }`
        ).replace('desc = t.1.desc', 'desc = loc_desc_late'),
    },
    CK3561: {
        file: 'events/a.txt',
        text: EVENT(
            `\toption = { name = t.1.a random_courtier = { save_scope_as = late } }`
        ).replace('title = t.1.t', 'title = loc_title_late'),
    },
    CK3563: {
        file: 'events/a.txt',
        text: EVENT(
            `\timmediate = { random_courtier = { save_scope_as = h } }\n\toption = { name = t.1.a scope:h = { add_gold = 1 } }`
        ),
    },
    CK3301: { file: 'common/x.txt', text: 'a = {\n\t  b = c\n}\n' },
    CK3303: { file: 'common/x.txt', text: 'a = {\n    b = c\n}\n' },
    CK3304: { file: 'common/x.txt', text: 'a = b  \n' },
    CK3306: { file: 'common/x.txt', text: 'a=b\n' },
    CK3314: { file: 'common/x.txt', text: 'a = { }\n' },
    CK3316: { file: 'common/x.txt', text: `a = ${'x'.repeat(130)}\n` },
    CK3317: {
        file: 'common/x.txt',
        text: 'a = { b = { c = { d = { e = { f = { g = { h = { i = yes } } } } } } } }\n',
    },
    CK3330: { file: 'common/x.txt', text: 'a = {\n\tb = c\n' },
    CK3331: { file: 'common/x.txt', text: 'a = { b = c }\n}\n' },
    'COND-001': { file: 'common/x.txt', text: 'e = { if = { add_gold = 1 } }\n' },
    'COND-002': {
        file: 'common/x.txt',
        text: 'e = { if = { limit = { always = yes } } else = { limit = { always = yes } } }\n',
    },
    'COND-003': { file: 'common/x.txt', text: 'e = { else = { add_gold = 1 } }\n' },
    CK4100: {
        file: 'events/a.txt',
        text: EVENT(OPTION).replace('title = t.1.t', 'title = nope.t'),
    },
    CK4101: { file: 'events/a.txt', text: EVENT(OPTION).replace('title = t.1.t', 'title = "A b"') },
    CK4102: {
        file: 'events/a.txt',
        text: EVENT(`\toption = { name = t.1.a custom_tooltip = "A b" }`),
    },
    'EVENT-001': {
        file: 'events/a.txt',
        text: EVENT(OPTION).replace('character_event', 'story_cycle'),
    },
    'EVENT-002': {
        file: 'events/a.txt',
        text: EVENT(OPTION).replace('character_event', 'letter_event'),
    },
    'EVENT-010': { file: 'events/a.txt', text: EVENT(OPTION).replace('namespace = t\n', '') },
    'EVENT-016': {
        file: 'events/a.txt',
        text: EVENT(OPTION).replace('namespace = t', 'namespace = other'),
    },
    CK3005: { file: 'common/x.txt', text: 'e = { NOT = yes }\n' },
    CK3421: {
        file: 'events/a.txt',
        text: EVENT(`\tright_portrait = { animation = idle }\n${OPTION}`),
    },
    CK3422: {
        file: 'events/a.txt',
        text: EVENT(
            `\tright_portrait = { character = root animation = not_an_animation }\n${OPTION}`
        ),
    },
    CK3423: {
        file: 'events/a.txt',
        text: EVENT(
            `\tright_portrait = { character = root triggered_animation = { animation = idle } }\n${OPTION}`
        ),
    },
    CK3424: {
        file: 'events/a.txt',
        text: EVENT(
            `\tright_portrait = { character = root triggered_animation = { trigger = { always = yes } } }\n${OPTION}`
        ),
    },
    CK3425: {
        file: 'events/a.txt',
        text: EVENT(
            `\tright_portrait = { character = root triggered_outfit = { outfit_tags = { a } } }\n${OPTION}`
        ),
    },
    CK3426: { file: 'events/a.txt', text: EVENT(`\tleft_portrait = root\n${OPTION}`) },
    CK3430: { file: 'events/a.txt', text: EVENT(`\ttheme = not_a_theme\n${OPTION}`) },
    CK3431: {
        file: 'events/a.txt',
        text: EVENT(`\toverride_background = { reference = not_a_background }\n${OPTION}`),
    },
    CK3433: {
        file: 'events/a.txt',
        text: EVENT(
            `\ttheme = diplomacy\n\toverride_background = { reference = throne_room }\n${OPTION}`
        ),
    },
    CK3450: { file: 'events/a.txt', text: EVENT('\toption = { add_gold = 1 }') },
    CK3510: { file: 'common/x.txt', text: 'e = { trigger_else = { always = yes } }\n' },
    CK3511: {
        file: 'common/x.txt',
        text: 'e = { trigger_if = { limit = { always = yes } } trigger_else = { } trigger_else = { } }\n',
    },
    CK3520: { file: 'events/a.txt', text: EVENT('\thidden = yes\n\tafter = { add_gold = 1 }') },
    CK3521: { file: 'events/a.txt', text: EVENT('\tafter = { add_gold = 1 }') },
    CK3522: { file: 'events/a.txt', text: EVENT(`${OPTION}\n\tafter = { remove_variable = v }`) },
    CK3610: { file: 'common/x.txt', text: 'o = { ai_chance = { base = -5 } }\n' },
    CK3611: { file: 'common/x.txt', text: 'o = { ai_chance = { base = 0 } }\n' },
    CK3612: {
        file: 'common/x.txt',
        text: 'o = { ai_chance = { base = 5 modifier = { add = -10 is_adult = yes } } }\n',
    },
    CK3613: {
        file: 'events/a.txt',
        text: EVENT('\toption = { name = t.1.a }\n\toption = { name = t.1.b }'),
    },
    CK3614: {
        file: 'common/x.txt',
        text: 'o = { ai_chance = { base = 5 modifier = { add = 5 } } }\n',
    },
    CK3656: {
        file: 'common/x.txt',
        text: 'e = { add_opinion = { target = root opinion = 10 } }\n',
    },
    CK3762: { file: 'events/a.txt', text: EVENT(`\thidden = yes\n${OPTION}`) },
    CK3763: { file: 'events/a.txt', text: EVENT('') },
    CK3764: { file: 'events/a.txt', text: EVENT(OPTION).replace('\tdesc = t.1.desc\n', '') },
    CK3765: { file: 'events/a.txt', text: EVENT(OPTION).replace('\ttitle = t.1.t\n', '') },
    CK3766: {
        file: 'events/a.txt',
        text: EVENT(`${OPTION}\n\tafter = { add_gold = 1 }\n\tafter = { add_gold = 1 }`),
    },
    CK3767: { file: 'events/a.txt', text: 'namespace = t\nt.1 = { }\n' },
    CK3768: {
        file: 'events/a.txt',
        text: EVENT(`${OPTION}\n\timmediate = { add_gold = 1 }\n\timmediate = { add_gold = 1 }`),
    },
    CK3769: { file: 'events/a.txt', text: EVENT(OPTION).replace('\tleft_portrait = root\n', '') },
    CK3872: { file: 'common/x.txt', text: 'e = { trigger = { always = yes } }\n' },
    CK3873: { file: 'common/x.txt', text: 'e = { trigger = { always = no } }\n' },
    CK3875: { file: 'common/x.txt', text: 'e = { random_courtier = { add_gold = 1 } }\n' },
    CK3977: { file: 'common/x.txt', text: 'e = { every_courtier = { add_gold = 1 } }\n' },
    CK5137: { file: 'common/x.txt', text: 'e = { trigger = { is_alive = yes } }\n' },
    CK3701: { file: 'common/x.txt', text: 'e = { trigger = { has_variable = never_set } }\n' },
    CK3702: { file: 'common/x.txt', text: 'e = { set_variable = never_read }\n' },
    CK3703: {
        file: 'common/x.txt',
        text: 'e = { set_global_variable = g if = { limit = { has_variable = g } } }\n',
    },
    CK3705: {
        file: 'common/x.txt',
        text: 'e = { set_variable = { name = b value = 1 } add_to_variable_list = { name = b target = root } if = { limit = { has_variable = b } } }\n',
    },
    CK3800: { file: 'common/x.txt', text: 'e = { add_trait = not_a_trait }\n' },
    CK3956: { file: 'common/scripted_effects/x.txt', text: 'my_e = { my_e = yes }\n' },
    'VALUE-002': { file: 'common/x.txt', text: 'script_values = { r = { min = 5 max = 1 } }\n' },
    'VALUE-004': {
        file: 'common/x.txt',
        text: 'script_values = { v = { value = 1 if = { } else = { } else_if = { } } }\n',
    },
    'VALUE-005': { file: 'common/x.txt', text: 'script_values = { v = { add = 1 } }\n' },
    'VALUE-006': {
        file: 'common/x.txt',
        text: 'script_values = { v = { value = 1 round_to = -1 } }\n',
    },
    'ITER-003': { file: 'common/x.txt', text: 'e = { ordered_courtier = { max = 1 } }\n' },
    'ITER-004': { file: 'common/x.txt', text: 'e = { ordered_courtier = { order_by = age } }\n' },
    'SWITCH-001': { file: 'common/x.txt', text: 'e = { switch = { a = { add_gold = 1 } } }\n' },
    'SWITCH-002': { file: 'common/x.txt', text: 'e = { switch = { trigger = has_trait } }\n' },
    'SWITCH-003': {
        file: 'common/x.txt',
        text: 'e = { switch = { trigger = not_a_trigger a = { add_gold = 1 } } }\n',
    },
    GFX001: { file: 'common/x.txt', text: 'e = { icon = "gfx/interface/icons/not_there.dds" }\n' },
};

/** Localization-file cases (one entry line each), by code. */
const YML: Record<string, string> = {
    'LOC-001': ' bad key:0 "x"',
    'LOC-002': ' k:0 "[ROOT.Char.GetNotAFunction]"',
    'LOC-003': ' k:0 "#not_a_code text#!"',
    'LOC-004': ' k:0 "@not_an_icon_at_all!"',
    'LOC-005': ' k:0 "[ROOT.GetName"',
    'LOC-006': ' k:0 "[not_a_concept_at_all|E]"',
    'LOC-007': ' k:0 "$VALUE|zz$"',
};

const SEVERITY: Record<string, DiagnosticSeverity> = {
    error: DiagnosticSeverity.Error,
    warning: DiagnosticSeverity.Warning,
    information: DiagnosticSeverity.Information,
    hint: DiagnosticSeverity.Hint,
};
const ENGINE_SEVERITY: Record<string, string> = {
    error: 'error',
    warning: 'warning',
    information: 'information',
    hint: 'hint',
};

describe('Every catalogue code: its case, its severity, "Convention" without evidence', () => {
    const catalogue = (
        yaml.load(fs.readFileSync(path.join(REPO, 'data', 'diagnostics.yaml'), 'utf8')) as {
            diagnostics: Record<string, { plugin: string; severity: string }>;
        }
    ).diagnostics;
    let root: string;
    let workspace: Workspace;
    let baseGame: BaseGameData;
    const localization = new LocalizationIndex();

    before(async function () {
        this.timeout(30_000);
        const data = path.join(REPO, 'data');
        await DataLoader.getInstance(data).initialize(data);
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-catalogue-'));
        // The mock base game: localization keys, traits, event themes and backgrounds.
        workspace = new Workspace(root, { vanilla: MOCK_GAME }).load();
        baseGame = await new BaseGameData(MOCK_GAME).load();
        localization.indexText(
            path.join(root, 'localization', 'english', 'cases_l_english.yml'),
            [
                'l_english:',
                ' t.1.t: "T"',
                ' t.1.desc: "D"',
                ' t.1.a: "A"',
                ' t.1.b: "B"',
                ' t.1.d: "D"',
                ' loc_desc_late: "[late.GetFirstName]"',
                ' loc_title_late: "[late.GetFirstName]"',
            ].join('\n')
        );
    });

    after(() => fs.rmSync(root, { recursive: true, force: true }));

    it('has a case for every code of data/diagnostics.yaml', () => {
        const missing = Object.keys(catalogue).filter(
            (code) =>
                !(catalogue[code].plugin === 'localization'
                    ? YML[code]
                    : (SCRIPT[code] ?? YML[code]))
        );
        assert.deepStrictEqual(missing, []);
    });

    for (const [code, c] of Object.entries(SCRIPT)) {
        it(`${code} (script file)`, () => {
            const entry = catalogue[code];
            assert.ok(entry, `${code} is in the catalogue`);
            const file = path.join(root, ...c.file.split('/'));
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, c.text);
            const plugins = enginePlugins({
                localization,
                workspace,
                baseGame: () => baseGame,
                graphics: () => createGraphicsResolver([root], MOCK_GAME, new DirectoryCache()),
            });
            const found = diagnose(workspace, file, { text: c.text, plugins }).filter(
                (d) => d.source === 'plugin' && d.code === code
            );
            assert.ok(found.length > 0, `${code} is reported for its case`);
            for (const d of found) {
                assert.strictEqual(d.severity, ENGINE_SEVERITY[entry.severity], d.message);
                if (entry.severity === 'information' || entry.severity === 'hint') {
                    assert.ok(d.message.startsWith('Convention'), d.message);
                }
            }
        });
    }

    for (const [code, line] of Object.entries(YML)) {
        it(`${code} (localization file)`, () => {
            const entry = catalogue[code];
            const index = new LocalizationIndex();
            const file = path.join(root, 'localization', 'english', 'x_l_english.yml');
            const text = `l_english:\n${line}\n`;
            index.indexText(file, text);
            const found = localizationDiagnostics(index, pathToUri(file), text).filter(
                (d) => d.code === code
            );
            assert.ok(found.length > 0, `${code} is reported for its case`);
            for (const d of found) {
                assert.strictEqual(d.severity, SEVERITY[entry.severity], d.message);
                if (entry.severity === 'information' || entry.severity === 'hint') {
                    assert.ok(d.message.startsWith('Convention'), d.message);
                }
            }
        });
    }
});
