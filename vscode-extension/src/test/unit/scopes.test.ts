/**
 * Unit Tests for Scope Validation
 *
 * Tests scope chain validation, isScopeLink guard, and related helpers.
 * Uses the DataLoader fallback scopes (character, title, province, etc.).
 */

import * as assert from 'assert';
import {
    isScopeLink,
    validateScopeChain,
    getScopeLinks,
    getTargetScopeType,
} from '../../server/ck3/validation/scopes';
import { DataLoader } from '../../server/data/loader';

describe('Scope Validation', () => {

    before(() => {
        // Ensure the DataLoader singleton is initialised with fallback scopes
        DataLoader.getInstance();
    });

    describe('isScopeLink', () => {
        it('should recognise universal links', () => {
            for (const link of ['root', 'this', 'prev', 'from', 'fromfrom']) {
                assert.strictEqual(isScopeLink(link, 'character'), true, `${link} should be a scope link`);
            }
        });

        it('should recognise character scope links', () => {
            assert.strictEqual(isScopeLink('liege', 'character'), true);
            assert.strictEqual(isScopeLink('primary_title', 'character'), true);
            assert.strictEqual(isScopeLink('dynasty', 'character'), true);
        });

        it('should recognise title scope links', () => {
            assert.strictEqual(isScopeLink('holder', 'title'), true);
            assert.strictEqual(isScopeLink('de_jure_liege', 'title'), true);
        });

        it('should reject arbitrary names that are not scope links', () => {
            assert.strictEqual(isScopeLink('syntax_good', 'character'), false);
            assert.strictEqual(isScopeLink('my_namespace', 'character'), false);
            assert.strictEqual(isScopeLink('0001', 'character'), false);
        });

        it('should reject links that belong to a different scope type', () => {
            // 'holder' is a title link, not a character link
            assert.strictEqual(isScopeLink('holder', 'character'), false);
            // 'liege' is a character link, not a title link
            assert.strictEqual(isScopeLink('liege', 'title'), false);
        });

        it('should return false for unknown scope types', () => {
            assert.strictEqual(isScopeLink('liege', 'nonexistent_scope'), false);
        });
    });

    describe('validateScopeChain', () => {
        it('should accept valid single-step chains', () => {
            const [valid, resultType] = validateScopeChain('liege', 'character');
            assert.strictEqual(valid, true);
            assert.strictEqual(resultType, 'character');
        });

        it('should accept valid multi-step chains', () => {
            // character -> primary_title (title) -> holder (character)
            const [valid, resultType] = validateScopeChain('primary_title.holder', 'character');
            assert.strictEqual(valid, true);
            assert.strictEqual(resultType, 'character');
        });

        it('should accept universal link chains', () => {
            const [valid, resultType] = validateScopeChain('root.this', 'character');
            assert.strictEqual(valid, true);
            assert.strictEqual(resultType, 'character');
        });

        it('should reject chains with invalid first segment', () => {
            const [valid, , error] = validateScopeChain('syntax_good.0001', 'character');
            assert.strictEqual(valid, false);
            assert.ok(error && error.includes('syntax_good'));
        });

        it('should reject chains with invalid later segment', () => {
            // liege is valid from character, but 'nonexistent' is not valid from character
            const [valid, , error] = validateScopeChain('liege.nonexistent', 'character');
            assert.strictEqual(valid, false);
            assert.ok(error && error.includes('nonexistent'));
        });

        it('should treat empty/blank chains as valid', () => {
            const [valid1] = validateScopeChain('', 'character');
            assert.strictEqual(valid1, true);
            const [valid2] = validateScopeChain('  ', 'character');
            assert.strictEqual(valid2, true);
        });

        it('should pass through saved-scope segments (scope:name)', () => {
            const [valid, resultType] = validateScopeChain('scope:actor', 'character');
            assert.strictEqual(valid, true);
        });
    });

    describe('SCOPE-003 false positive prevention', () => {
        it('should not flag event IDs like namespace.number as scope chains', () => {
            // The guard in diagnostics.ts checks isScopeLink on the first segment.
            // Event IDs have a namespace prefix that is NOT a scope link.
            const eventId = 'syntax_good.0001';
            const firstSegment = eventId.split('.')[0];
            assert.strictEqual(isScopeLink(firstSegment, 'character'), false,
                'Event ID namespace should not be mistaken for a scope link');
        });

        it('should still flag actual broken scope chains', () => {
            // root IS a scope link, so root.bogus should be validated and rejected
            const chain = 'root.bogus';
            const firstSegment = chain.split('.')[0];
            assert.strictEqual(isScopeLink(firstSegment, 'character'), true,
                'root should be recognised as a scope link');
            const [valid] = validateScopeChain(chain, 'character');
            assert.strictEqual(valid, false, 'root.bogus should fail validation');
        });
    });
});
