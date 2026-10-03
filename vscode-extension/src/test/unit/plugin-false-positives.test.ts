/**
 * The plug-in false positives found on the real-mod corpus (issues #91 to #97), each pinned by
 * the corpus case the issue names (an excerpt of the published mod's file, at the same
 * mod-relative path), run through the whole plug-in list the way the editor runs it.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { diagnose, Diagnostic, LocalizationIndex, Workspace } from 'pychivalry-engine';
import { enginePlugins, localizationDiagnostics } from '../../server/plugins';

let root: string;
let workspace: Workspace;

function run(rel: string, text: string): Diagnostic[] {
    const file = path.join(root, ...rel.split('/'));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    const plugins = enginePlugins({ localization: new LocalizationIndex(), workspace });
    return diagnose(workspace, file, { text, plugins }).filter((d) => d.source === 'plugin');
}

function codes(diags: Diagnostic[]): string[] {
    return diags.map((d) => d.code);
}

function errors(diags: Diagnostic[]): Diagnostic[] {
    return diags.filter((d) => d.severity === 'error');
}

describe('Plug-in false positives of the real-mod corpus (#91-#97)', () => {
    before(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-fp-'));
        workspace = new Workspace(root).load();
    });

    after(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('#91 CK5142: `employer = root` in create_character and `liege = root` are not reported', () => {
        // RICE common/scripted_effects/RICE_manichean_effects.txt:329
        const text = [
            'RICE_manichean_create_archegos_effect = {',
            '\thidden_effect = {',
            '\t\tcreate_character = {',
            '\t\t\tgender = male',
            '\t\t\temployer = root',
            '\t\t\tsave_scope_as = new_archegos',
            '\t\t}',
            '\t}',
            '\tif = { limit = { scope:new_archegos = { liege = root } } }',
            '}',
        ].join('\n');
        const diags = run('common/scripted_effects/RICE_manichean_effects.txt', text);
        assert.ok(!codes(diags).includes('CK5142'));
        assert.deepStrictEqual(errors(diags), []);
    });

    it('#92 CK3873: `always = no` (content switched off) is a hint, not an error', () => {
        // RICE common/buildings/RICE_harran_buildings.txt:12
        const text = [
            'RICE_harran_temple_of_the_moon = {',
            '\tcan_construct_potential = {',
            '\t\tbarony = title:b_tall_mahra',
            '\t\talways = no',
            '\t}',
            '}',
        ].join('\n');
        const diags = run('common/buildings/RICE_harran_buildings.txt', text);
        const always = diags.filter((d) => d.code === 'CK3873');
        assert.strictEqual(always.length, 1);
        assert.strictEqual(always[0].severity, 'hint');
        assert.deepStrictEqual(errors(diags), []);
    });

    it('#93 CK3950/CK3951: colour values rgb { } / hsv { } are not scripted calls', () => {
        // Elf Destiny common/coat_of_arms/coat_of_arms/coa_elf_test_template.txt:4
        const text = [
            'template = {',
            '\taeluran_a ={',
            '\t\tpattern="pattern_vertical_stripes_02.dds"',
            '\t\tcolor1=rgb { 144 143 143 }',
            '\t\tcolor2=hsv { 0.1 0.2 0.3 }',
            '\t}',
            '}',
        ].join('\n');
        const diags = run('common/coat_of_arms/coat_of_arms/coa_elf_test_template.txt', text);
        assert.ok(!codes(diags).includes('CK3950'));
        assert.ok(!codes(diags).includes('CK3951'));
        assert.deepStrictEqual(errors(diags), []);
    });

    it('#94 CK3420: portrait cameras and highlight_portrait are not portrait positions', () => {
        // Elf Destiny gfx/portraits/cameras/elf_dest_portrait_cameras.txt:27
        const camera = [
            'face_away_right_portrait = {',
            '\tcamera = {',
            '\t\tposition_node = { default = camera_torso_look_at }',
            '\t}',
            '}',
        ].join('\n');
        // Elf Destiny events/aeluran/aeluran_matchmaking_events.txt:1062
        const event = [
            'namespace = aeluran_matchmaking',
            'aeluran_matchmaking.0025 = {',
            '\ttype = character_event',
            '\ttitle = aeluran_matchmaking.0025.t',
            '\tdesc = aeluran_matchmaking.0025.desc',
            '\tleft_portrait = root',
            '\toption = {',
            '\t\tname = aeluran_matchmaking.0025.option_1',
            '\t\thighlight_portrait = scope:left_portrait_match_final',
            '\t}',
            '}',
        ].join('\n');
        const a = run('gfx/portraits/cameras/elf_dest_portrait_cameras.txt', camera);
        const b = run('events/aeluran/aeluran_matchmaking_events.txt', event);
        assert.ok(!codes([...a, ...b]).includes('CK3420'));
        assert.deepStrictEqual(errors([...a, ...b]), []);
    });

    it('#95 CK3552: a triggered_desc trigger may read a scope immediate saves', () => {
        // RICE events/RICE_socotra_events.txt:821 (socotra.0010)
        const event = (saveIn: 'immediate' | 'option') =>
            [
                'namespace = socotra',
                'socotra.0010 = {',
                '\ttype = character_event',
                '\ttitle = socotra.0010.t',
                '\tdesc = {',
                '\t\tfirst_valid = {',
                '\t\t\ttriggered_desc = {',
                '\t\t\t\ttrigger = {',
                '\t\t\t\t\tscope:scope_RICE_socotran_spawn_runaway_slave = { is_female = yes }',
                '\t\t\t\t}',
                '\t\t\t\tdesc = socotra.0010.desc.f',
                '\t\t\t}',
                '\t\t\tdesc = socotra.0010.desc',
                '\t\t}',
                '\t}',
                '\tleft_portrait = root',
                saveIn === 'immediate'
                    ? '\timmediate = { random_courtier = { save_scope_as = scope_RICE_socotran_spawn_runaway_slave } }'
                    : '\timmediate = { add_prestige = 1 }',
                '\toption = {',
                '\t\tname = socotra.0010.a',
                saveIn === 'option'
                    ? '\t\trandom_courtier = { save_scope_as = scope_RICE_socotran_spawn_runaway_slave }'
                    : '\t\tadd_gold = 1',
                '\t}',
                '}',
            ].join('\n');
        const immediate = run('events/RICE_socotra_events.txt', event('immediate'));
        assert.ok(!codes(immediate).includes('CK3552'), 'immediate runs before the window');
        assert.deepStrictEqual(errors(immediate), []);
        // Saved only in an option: the window is shown before the option runs.
        const late = run('events/RICE_socotra_events.txt', event('option')).filter(
            (d) => d.code === 'CK3552'
        );
        assert.strictEqual(late.length, 1);
        assert.strictEqual(late[0].severity, 'information');
    });

    it('#96 CK3550: a scope saved earlier in the same trigger is available', () => {
        // Elf Destiny events/aeluran/aeluran_advisor_task_events.txt:696 and :702
        const event = (order: 'save-first' | 'read-first') =>
            [
                'namespace = aeluran_advisor_task',
                'aeluran_advisor_task.0302 = {',
                '\ttype = character_event',
                '\ttitle = aeluran_advisor_task.0302.t',
                '\tdesc = aeluran_advisor_task.0302.desc',
                '\tleft_portrait = root',
                '\ttrigger = {',
                '\t\tany_held_title = {',
                order === 'read-first'
                    ? '\t\t\troot = { NOT = { has_claim_on = scope:duchy } }'
                    : '\t\t\tsave_temporary_scope_as = duchy',
                order === 'read-first'
                    ? '\t\t\tsave_temporary_scope_as = duchy'
                    : '\t\t\troot = { NOT = { has_claim_on = scope:duchy } }',
                '\t\t}',
                '\t}',
                '\timmediate = { random_held_title = { save_scope_as = duchy } }',
                '\toption = { name = aeluran_advisor_task.0302.a }',
                '}',
            ].join('\n');
        const saved = run('events/aeluran/aeluran_advisor_task_events.txt', event('save-first'));
        assert.ok(!codes(saved).includes('CK3550'));
        assert.deepStrictEqual(errors(saved), []);
        const early = run('events/aeluran/aeluran_advisor_task_events.txt', event('read-first'));
        const found = early.filter((d) => d.code === 'CK3550');
        assert.strictEqual(found.length, 1);
        assert.strictEqual(found[0].severity, 'information');
    });

    it('#97 CK3553: a variable set by an earlier firing may be checked in the trigger', () => {
        // RICE events/RICE_sicily_events.txt:922 (sicily.0016)
        const event = (local: boolean) =>
            [
                'namespace = sicily',
                'sicily.0016 = {',
                '\ttype = character_event',
                '\ttitle = sicily.0016.t',
                '\tdesc = sicily.0016.desc',
                '\tleft_portrait = root',
                '\ttrigger = {',
                '\t\tany_held_title = {',
                local
                    ? '\t\t\tNOT = { exists = local_var:RICE_had_siculo_arabic_county_conversion }'
                    : '\t\t\tNOT = { exists = var:RICE_had_siculo_arabic_county_conversion }',
                '\t\t}',
                '\t}',
                '\timmediate = {',
                '\t\trandom_held_title = {',
                local
                    ? '\t\t\tset_local_variable = RICE_had_siculo_arabic_county_conversion'
                    : '\t\t\tset_variable = RICE_had_siculo_arabic_county_conversion',
                '\t\t}',
                '\t}',
                '\toption = { name = sicily.0016.a }',
                '}',
            ].join('\n');
        const persistent = run('events/RICE_sicily_events.txt', event(false));
        assert.ok(!codes(persistent).includes('CK3553'));
        assert.deepStrictEqual(errors(persistent), []);
        // A local variable does not outlive the effect that sets it.
        const local = run('events/RICE_sicily_events.txt', event(true)).filter(
            (d) => d.code === 'CK3553'
        );
        assert.strictEqual(local.length, 1);
        assert.strictEqual(local[0].severity, 'information');
    });
});

describe('After blocks (#19): CK3523 is the engine registry check', () => {
    let dir: string;
    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-after-'));
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('a trigger in an after block is reported by the engine (unknown_effect_X), not a plug-in', () => {
        const file = path.join(dir, 'events', 'after.txt');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const text = [
            'namespace = my_event',
            'my_event.3 = {',
            '\ttitle = my_event.3.t',
            '\tdesc = my_event.3.desc',
            '\tleft_portrait = root',
            '\toption = { name = my_event.3.a }',
            '\tafter = { is_adult = yes }',
            '}',
        ].join('\n');
        fs.writeFileSync(file, text);
        const ws = new Workspace(dir).load();
        const diags = diagnose(ws, file, {
            text,
            plugins: enginePlugins({ localization: new LocalizationIndex(), workspace: ws }),
        });
        const atAfter = diags.filter((d) => d.range.start.line === 6);
        assert.deepStrictEqual(
            atAfter.map((d) => [d.code, d.source ?? 'engine']),
            [['unknown_effect_X', 'engine']]
        );
    });
});

describe('Scope timing, the localization half and the trigger guard (#60)', () => {
    let dir: string;
    let ws: Workspace;
    const loc = new LocalizationIndex();

    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-timing-'));
        ws = new Workspace(dir).load();
        loc.indexText(
            path.join(dir, 'localization', 'english', 'timing_l_english.yml'),
            [
                'l_english:',
                ' timing.1.t: "Meeting [rival.GetFirstName]"',
                ' timing.1.desc:0 "[friend.GetFirstName] and [SCOPE.sC(\'guest\').GetName] arrive."',
                ' timing.1.a: "Fine"',
            ].join('\n')
        );
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    function codesAt(text: string): Array<[string, string]> {
        const file = path.join(dir, 'events', 'timing.txt');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
        return diagnose(ws, file, {
            text,
            plugins: enginePlugins({ localization: loc, workspace: ws }),
        })
            .filter((d) => d.source === 'plugin' && /^CK35[56]/.test(d.code))
            .map((d) => [d.code, d.severity]);
    }

    it('CK3560 / CK3561: desc and title texts read scopes saved only in an option (information)', () => {
        const text = [
            'namespace = timing',
            'timing.1 = {',
            '\ttitle = timing.1.t',
            '\tdesc = timing.1.desc',
            '\tleft_portrait = root',
            '\timmediate = { random_courtier = { save_scope_as = friend } }',
            '\toption = {',
            '\t\tname = timing.1.a',
            '\t\trandom_courtier = { save_scope_as = rival }',
            '\t\trandom_courtier = { save_scope_as = guest }',
            '\t}',
            '}',
        ].join('\n');
        const found = codesAt(text);
        // friend is saved in immediate: the window can read it (#95), no finding for it.
        assert.deepStrictEqual(
            found.filter(([c]) => c === 'CK3560'),
            [['CK3560', 'information']]
        );
        assert.deepStrictEqual(
            found.filter(([c]) => c === 'CK3561'),
            [['CK3561', 'information']]
        );
    });

    it('CK3563: a random_ save used by an option without an any_ guard (information)', () => {
        const event = (guard: boolean) =>
            [
                'namespace = timing',
                'timing.2 = {',
                '\ttitle = timing.1.t',
                '\tdesc = timing.1.desc',
                '\tleft_portrait = root',
                guard
                    ? '\ttrigger = { any_courtier = { is_adult = yes } }'
                    : '\ttrigger = { is_adult = yes }',
                '\timmediate = { random_courtier = { save_scope_as = helper } }',
                '\toption = { name = timing.1.a scope:helper = { add_gold = 5 } }',
                '}',
            ].join('\n');
        assert.deepStrictEqual(
            codesAt(event(false)).filter(([c]) => c === 'CK3563'),
            [['CK3563', 'information']]
        );
        assert.deepStrictEqual(
            codesAt(event(true)).filter(([c]) => c === 'CK3563'),
            []
        );
    });
});

describe('LOC split (2.2): CK4101/CK4102 in script files, LOC-001/LOC-002 in .yml files', () => {
    let dir: string;
    before(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pych-loc-split-'));
    });
    after(() => fs.rmSync(dir, { recursive: true, force: true }));

    it('script files report CK4101 / CK4102 (warnings), never LOC-001 / LOC-002', () => {
        const file = path.join(dir, 'events', 'loc.txt');
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const text = [
            'namespace = loc',
            'loc.1 = {',
            '\ttitle = "Some literal title"',
            '\tdesc = loc.1.desc',
            '\tleft_portrait = root',
            '\toption = { name = loc.1.a custom_tooltip = "Literal tooltip text" }',
            '}',
        ].join('\n');
        fs.writeFileSync(file, text);
        const ws = new Workspace(dir).load();
        const found = diagnose(ws, file, {
            text,
            plugins: enginePlugins({ localization: new LocalizationIndex(), workspace: ws }),
        })
            .filter((d) => d.source === 'plugin' && /^(CK410[12]|LOC-)/.test(d.code))
            .map((d) => [d.code, d.severity, d.range.start.line]);
        assert.deepStrictEqual(found, [
            ['CK4101', 'warning', 2],
            ['CK4102', 'warning', 5],
        ]);
    });

    it('.yml files report LOC-001 (information) for a key the index cannot read', () => {
        const diags = localizationDiagnostics(
            new LocalizationIndex(),
            'file:///x_l_english.yml',
            'l_english:\n bad key:0 "x"\n'
        );
        assert.deepStrictEqual(
            diags.map((d) => [d.code, d.severity]),
            [['LOC-001', 3]]
        );
    });
});
