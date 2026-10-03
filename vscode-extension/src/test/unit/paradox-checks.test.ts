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
