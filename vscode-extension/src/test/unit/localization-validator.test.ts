/**
 * Unit Tests for Localization Validator
 */

import * as assert from 'assert';
import {
    validateLocalizationContent,
    DEFAULT_LOC_VALIDATION_CONFIG,
    isCharacterFunction,
    isTextFormattingCode,
    LocalizationValidationConfig,
} from '../../server/ck3/localization/validator';
import { LocalizationEntry } from '../../server/core/localization-index';

function makeEntry(text: string, overrides: Partial<LocalizationEntry> = {}): LocalizationEntry {
    return {
        key: 'test.key',
        text,
        fileUri: 'file:///test_l_english.yml',
        filePath: '/test_l_english.yml',
        line: 0,
        ...overrides,
    };
}

function makeConfig(overrides: Partial<LocalizationValidationConfig> = {}): LocalizationValidationConfig {
    return { ...DEFAULT_LOC_VALIDATION_CONFIG, ...overrides };
}

describe('Localization Validator', () => {

    describe('isCharacterFunction()', () => {
        it('recognises GetName', () => {
            assert.ok(isCharacterFunction('GetName'));
        });

        it('recognises GetSheHe', () => {
            assert.ok(isCharacterFunction('GetSheHe'));
        });

        it('rejects unknown functions', () => {
            assert.ok(!isCharacterFunction('GetFrobnicate'));
        });
    });

    describe('isTextFormattingCode()', () => {
        it('recognises #bold', () => {
            assert.ok(isTextFormattingCode('#bold'));
        });

        it('recognises #N (negative colour)', () => {
            assert.ok(isTextFormattingCode('#N'));
        });

        it('rejects unknown codes', () => {
            assert.ok(!isTextFormattingCode('#rainbow'));
        });
    });

    describe('bracket validation', () => {
        it('flags unbalanced brackets (LOC-005)', () => {
            const diags = validateLocalizationContent(makeEntry('[ROOT.GetName'), makeConfig());
            assert.ok(diags.some(d => d.code === 'LOC-005'));
        });

        it('passes balanced brackets', () => {
            const diags = validateLocalizationContent(makeEntry('[ROOT.GetName] is here'), makeConfig());
            const bracketErrors = diags.filter(d => d.code === 'LOC-005');
            assert.strictEqual(bracketErrors.length, 0);
        });
    });

    describe('character function validation', () => {
        it('accepts valid function calls', () => {
            const diags = validateLocalizationContent(
                makeEntry('[ROOT.GetName] gains gold'),
                makeConfig(),
            );
            const funcErrors = diags.filter(d => d.code === 'LOC-002');
            assert.strictEqual(funcErrors.length, 0);
        });

        it('flags unknown function names (LOC-002)', () => {
            const diags = validateLocalizationContent(
                makeEntry('[ROOT.GetFrobnicate] fails'),
                makeConfig(),
            );
            assert.ok(diags.some(d => d.code === 'LOC-002'));
        });

        it('accepts scope chains', () => {
            const diags = validateLocalizationContent(
                makeEntry('[scope:target.GetName]'),
                makeConfig(),
            );
            const funcErrors = diags.filter(d => d.code === 'LOC-002');
            assert.strictEqual(funcErrors.length, 0);
        });
    });

    describe('formatting code validation', () => {
        it('accepts known formatting codes', () => {
            const diags = validateLocalizationContent(
                makeEntry('#bold text #!'),
                makeConfig(),
            );
            const fmtErrors = diags.filter(d => d.code === 'LOC-003');
            assert.strictEqual(fmtErrors.length, 0);
        });

        it('flags unknown formatting codes (LOC-003)', () => {
            const diags = validateLocalizationContent(
                makeEntry('#rainbow text'),
                makeConfig(),
            );
            assert.ok(diags.some(d => d.code === 'LOC-003'));
        });
    });

    describe('icon reference validation', () => {
        it('accepts known built-in icons', () => {
            const diags = validateLocalizationContent(
                makeEntry('Gain @gold_icon! gold'),
                makeConfig(),
            );
            const iconErrors = diags.filter(d => d.code === 'LOC-004');
            assert.strictEqual(iconErrors.length, 0);
        });

        it('flags unknown icons (LOC-004)', () => {
            const diags = validateLocalizationContent(
                makeEntry('Gain @nonexistent_icon!'),
                makeConfig(),
            );
            assert.ok(diags.some(d => d.code === 'LOC-004'));
        });
    });

    describe('variable substitution validation', () => {
        it('accepts valid variable references', () => {
            const diags = validateLocalizationContent(
                makeEntry('You gain $GOLD$ coins'),
                makeConfig(),
            );
            const varErrors = diags.filter(d => d.code === 'LOC-007');
            assert.strictEqual(varErrors.length, 0);
        });

        it('accepts valid format specifiers', () => {
            const diags = validateLocalizationContent(
                makeEntry('$VALUE|+$ change'),
                makeConfig(),
            );
            const varErrors = diags.filter(d => d.code === 'LOC-007');
            assert.strictEqual(varErrors.length, 0);
        });

        it('flags unknown format specifiers (LOC-007)', () => {
            const diags = validateLocalizationContent(
                makeEntry('$VALUE|ZZZZ$ change'),
                makeConfig(),
            );
            assert.ok(diags.some(d => d.code === 'LOC-007'));
        });
    });

    describe('disabled checks', () => {
        it('returns no diagnostics when all disabled', () => {
            const diags = validateLocalizationContent(
                makeEntry('[ROOT.GetFrobnicate] #rainbow @bad_icon! $bad|ZZ$'),
                makeConfig({ enabled: false }),
            );
            assert.strictEqual(diags.length, 0);
        });

        it('skips function checks when disabled', () => {
            const diags = validateLocalizationContent(
                makeEntry('[ROOT.GetFrobnicate]'),
                makeConfig({ checkFunctions: false }),
            );
            const funcErrors = diags.filter(d => d.code === 'LOC-002');
            assert.strictEqual(funcErrors.length, 0);
        });
    });
});
