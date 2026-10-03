/**
 * Unit tests for the paradox-checks plug-in codes added or changed in 2.2 (post-2.0 Phase 4):
 * ai_chance (#21-#23).
 */

import * as assert from 'assert';
import { CK3Parser } from 'pychivalry-engine';
import { DiagnosticSeverity } from 'vscode-languageserver';
import {
    checkAiChance,
    checkMissingAiChance,
    validateParadoxConventions,
} from '../../server/ck3/validation/paradox-checks';

function parse(text: string) {
    return new CK3Parser().parse(text).ast;
}

function aiChance(body: string) {
    return checkAiChance(parse(`option = { ai_chance = { ${body} } }`));
}

describe('paradox-checks: ai_chance (#21-#23)', () => {
    it('CK3611: base 0 and no modifier that adds weight (information)', () => {
        const d = aiChance('base = 0 modifier = { factor = 2 has_trait = brave }');
        assert.deepStrictEqual(
            d.map((x) => [x.code, x.severity]),
            [['CK3611', DiagnosticSeverity.Information]]
        );
        assert.ok(d[0].message.startsWith('Convention:'));
    });

    it('CK3611: an unconditional factor = 0', () => {
        assert.ok(aiChance('base = 50 modifier = { factor = 0 }').some((x) => x.code === 'CK3611'));
    });

    it('not CK3611 when a modifier can add weight (the base game pattern)', () => {
        assert.deepStrictEqual(
            aiChance('base = 0 modifier = { add = 50 has_trait = brave }').map((x) => x.code),
            []
        );
        // A script value add may be positive.
        assert.deepStrictEqual(
            aiChance('base = 0 modifier = { add = my_value has_trait = brave }').map((x) => x.code),
            []
        );
    });

    it('CK3612: base plus the negative adds is below zero (information)', () => {
        const d = aiChance('base = 10 modifier = { add = -20 has_trait = craven }');
        assert.deepStrictEqual(
            d.map((x) => [x.code, x.severity]),
            [['CK3612', DiagnosticSeverity.Information]]
        );
        assert.deepStrictEqual(
            aiChance('base = 30 modifier = { add = -20 has_trait = craven }').map((x) => x.code),
            []
        );
    });

    it('no total is judged when the block holds other modifier kinds', () => {
        assert.deepStrictEqual(
            aiChance('base = 0 opinion_modifier = { who = root opinion_target = scope:x }').map(
                (x) => x.code
            ),
            []
        );
    });

    it('a negative base is CK3610, not CK3612', () => {
        assert.deepStrictEqual(
            aiChance('base = -5').map((x) => x.code),
            ['CK3610']
        );
    });

    it('no longer reports a base above 100 (ai_chance is a relative weight)', () => {
        assert.deepStrictEqual(
            aiChance('base = 200').map((x) => x.code),
            []
        );
    });

    it('CK3613: an option without ai_chance in an event with several options (hint)', () => {
        const event = parse(
            [
                'a.1 = {',
                '  option = { name = a.1.a ai_chance = { base = 10 } }',
                '  option = { name = a.1.b }',
                '}',
            ].join('\n')
        ).children![0];
        const d = checkMissingAiChance(event);
        assert.deepStrictEqual(
            d.map((x) => [x.code, x.severity, x.range.start.line]),
            [['CK3613', DiagnosticSeverity.Hint, 2]]
        );
    });

    it('not CK3613 for a single option, ai_will_select, or a hidden event', () => {
        const one = parse('a.1 = { option = { name = a.1.a } }').children![0];
        assert.deepStrictEqual(checkMissingAiChance(one), []);
        const will = parse(
            'a.2 = { option = { name = x ai_will_select = { base = 1 } } option = { name = y ai_chance = { base = 1 } } }'
        ).children![0];
        assert.deepStrictEqual(checkMissingAiChance(will), []);
        const codes = validateParadoxConventions(
            parse('a.3 = { hidden = yes option = { name = x } option = { name = y } }'),
            undefined,
            { file: 'events/a.txt' }
        ).map((x) => x.code);
        assert.ok(!codes.includes('CK3613'));
    });
});

describe('paradox-checks: after blocks (#19)', () => {
    const run = (text: string) =>
        validateParadoxConventions(parse(text), undefined, {
            file: 'events/a.txt',
            isEffect: (name) => name === 'remove_variable' || name === 'clear_saved_scope',
        });

    it('CK3520: an after block in a hidden event (information)', () => {
        const d = run(
            'a.1 = { hidden = yes immediate = { add_gold = 1 } after = { add_gold = 1 } }'
        );
        const found = d.filter((x) => x.code === 'CK3520');
        assert.strictEqual(found.length, 1);
        assert.strictEqual(found[0].severity, DiagnosticSeverity.Information);
    });

    it('CK3521: an after block in an event without options (information)', () => {
        const d = run('a.2 = { title = t desc = d left_portrait = root after = { add_gold = 1 } }');
        assert.ok(d.some((x) => x.code === 'CK3521'));
    });

    it('CK3522: an after block that only cleans up (hint), not one with other effects', () => {
        const cleanup = run(
            'a.3 = { title = t desc = d left_portrait = root option = { name = o } after = { remove_variable = x clear_saved_scope = y } }'
        );
        assert.deepStrictEqual(
            cleanup.filter((x) => x.code === 'CK3522').map((x) => x.severity),
            [DiagnosticSeverity.Hint]
        );
        const mixed = run(
            'a.4 = { title = t desc = d left_portrait = root option = { name = o } after = { remove_variable = x add_gold = 5 } }'
        );
        assert.ok(!mixed.some((x) => x.code === 'CK3522'));
    });
});

describe('paradox-checks: events (#25, #27, #28)', () => {
    const knowledge = {
        file: 'events/a.txt',
        isKnownTheme: (t: string) => ['diplomacy', 'intrigue'].includes(t),
        isKnownBackground: (b: string) => ['throne_room', 'study'].includes(b),
        themeDefaultBackground: (t: string) => (t === 'diplomacy' ? 'throne_room' : undefined),
    };
    const run = (text: string) =>
        validateParadoxConventions(parse(text), undefined, knowledge).map((x) => [
            x.code,
            x.severity,
        ]);
    const codesOf = (text: string) => run(text).map(([c]) => c);

    it('CK3765: a non-hidden event without title (information); not for hidden events', () => {
        const d = run('a.1 = { desc = d left_portrait = root option = { name = o } }');
        assert.ok(d.some(([c, s]) => c === 'CK3765' && s === DiagnosticSeverity.Information));
        assert.ok(
            !codesOf('a.2 = { hidden = yes immediate = { add_gold = 1 } }').includes('CK3765')
        );
        assert.ok(
            !codesOf(
                'a.3 = { title = t desc = d left_portrait = root option = { name = o } }'
            ).includes('CK3765')
        );
    });

    it('CK3423 / CK3424: triggered_animation without trigger, without animation', () => {
        const codes = codesOf(
            [
                'a.4 = { title = t desc = d option = { name = o }',
                '  left_portrait = {',
                '    character = root',
                '    triggered_animation = { animation = fear }',
                '    triggered_animation = { trigger = { is_adult = yes } }',
                '    triggered_animation = { trigger = { is_adult = no } scripted_animation = x }',
                '  }',
                '}',
            ].join('\n')
        );
        assert.deepStrictEqual(
            codes.filter((c) => c === 'CK3423' || c === 'CK3424'),
            ['CK3423', 'CK3424']
        );
    });

    it('CK3425: triggered_outfit without trigger; CK3426: a position given twice', () => {
        const codes = codesOf(
            [
                'a.5 = { title = t desc = d option = { name = o }',
                '  left_portrait = { character = root triggered_outfit = { outfit_tags = { armor } } }',
                '  left_portrait = { character = scope:other }',
                '}',
            ].join('\n')
        );
        assert.ok(codes.includes('CK3425'));
        assert.ok(codes.includes('CK3426'));
    });

    it('CK3430 and CK3431 (warnings) judge themes and backgrounds against what is known', () => {
        const d = run(
            [
                'a.6 = { title = t desc = d left_portrait = root option = { name = o }',
                '  theme = not_a_theme',
                '  override_background = { reference = not_a_background }',
                '}',
            ].join('\n')
        );
        assert.ok(d.some(([c, s]) => c === 'CK3430' && s === DiagnosticSeverity.Warning));
        assert.ok(d.some(([c, s]) => c === 'CK3431' && s === DiagnosticSeverity.Warning));
        // Without the base game (no knowledge) neither reports.
        const silent = validateParadoxConventions(
            parse('a.7 = { theme = not_a_theme override_background = { reference = nope } }'),
            undefined,
            { file: 'events/a.txt' }
        ).map((x) => x.code);
        assert.ok(!silent.includes('CK3430') && !silent.includes('CK3431'));
    });

    it('CK3433: an untriggered override equal to the theme default background (information)', () => {
        const redundant = run(
            'a.8 = { title = t desc = d left_portrait = root option = { name = o } theme = diplomacy override_background = { reference = throne_room } }'
        );
        assert.ok(
            redundant.some(([c, s]) => c === 'CK3433' && s === DiagnosticSeverity.Information)
        );
        const triggered = codesOf(
            'a.9 = { title = t desc = d left_portrait = root option = { name = o } theme = diplomacy override_background = { trigger = { is_adult = yes } reference = throne_room } }'
        );
        assert.ok(!triggered.includes('CK3433'));
        const other = codesOf(
            'a.10 = { title = t desc = d left_portrait = root option = { name = o } theme = diplomacy override_background = { reference = study } }'
        );
        assert.ok(!other.includes('CK3433'));
    });
});
