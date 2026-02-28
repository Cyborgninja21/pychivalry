/**
 * Unit Tests for CK3Language data-driven keyword classification
 */

import * as assert from 'assert';
import { CK3Language } from '../../server/ck3/language';

describe('CK3Language', () => {

    describe('initialize()', () => {
        it('should populate effect names from provided keys', () => {
            CK3Language.initialize(
                ['add_gold', 'add_prestige', 'custom_new_effect'],
                ['has_trait', 'is_alive'],
            );

            assert.ok(CK3Language.isInitialized(), 'Should be initialized');
            assert.ok(CK3Language.isEffect('add_gold'), 'add_gold should be an effect');
            assert.ok(CK3Language.isEffect('custom_new_effect'), 'data-driven effect should be recognized');
        });

        it('should populate trigger names from provided keys', () => {
            CK3Language.initialize(
                ['add_gold'],
                ['has_trait', 'is_alive', 'custom_new_trigger'],
            );

            assert.ok(CK3Language.isTrigger('has_trait'), 'has_trait should be a trigger');
            assert.ok(CK3Language.isTrigger('custom_new_trigger'), 'data-driven trigger should be recognized');
        });

        it('should merge fallback keywords into data-driven sets', () => {
            // Initialize with empty sets — fallbacks should still be present
            CK3Language.initialize([], []);

            // Core fallback effects
            assert.ok(CK3Language.isEffect('add_gold'), 'Fallback effect add_gold should remain');
            assert.ok(CK3Language.isEffect('trigger_event'), 'Fallback effect trigger_event should remain');
            assert.ok(CK3Language.isEffect('if'), 'Fallback effect if should remain');
            assert.ok(CK3Language.isEffect('switch'), 'Fallback effect switch should remain');
            assert.ok(CK3Language.isEffect('hidden_effect'), 'Fallback effect hidden_effect should remain');

            // Core fallback triggers
            assert.ok(CK3Language.isTrigger('has_trait'), 'Fallback trigger has_trait should remain');
            assert.ok(CK3Language.isTrigger('AND'), 'Fallback trigger AND should remain');
            assert.ok(CK3Language.isTrigger('OR'), 'Fallback trigger OR should remain');
            assert.ok(CK3Language.isTrigger('trigger_if'), 'Fallback trigger trigger_if should remain');
        });
    });

    describe('isEffect()', () => {
        before(() => {
            CK3Language.initialize(
                [
                    'add_gold', 'add_prestige', 'add_piety', 'add_trait', 'remove_trait',
                    'if', 'else_if', 'else', 'switch', 'while',
                    'random_list', 'weighted_random_list', 'hidden_effect', 'show_as_tooltip',
                    'every_vassal', 'random_courtier', 'ordered_vassal',
                ],
                ['has_trait', 'is_alive', 'AND', 'OR', 'NOT'],
            );
        });

        it('should recognize standard effects', () => {
            assert.ok(CK3Language.isEffect('add_gold'));
            assert.ok(CK3Language.isEffect('add_prestige'));
            assert.ok(CK3Language.isEffect('add_trait'));
            assert.ok(CK3Language.isEffect('remove_trait'));
        });

        it('should recognize control flow as effects', () => {
            assert.ok(CK3Language.isEffect('if'));
            assert.ok(CK3Language.isEffect('else_if'));
            assert.ok(CK3Language.isEffect('else'));
            assert.ok(CK3Language.isEffect('switch'));
            assert.ok(CK3Language.isEffect('while'));
        });

        it('should recognize meta effects', () => {
            assert.ok(CK3Language.isEffect('random_list'));
            assert.ok(CK3Language.isEffect('weighted_random_list'));
            assert.ok(CK3Language.isEffect('hidden_effect'));
            assert.ok(CK3Language.isEffect('show_as_tooltip'));
        });

        it('should recognize iterator effects', () => {
            assert.ok(CK3Language.isEffect('every_vassal'));
            assert.ok(CK3Language.isEffect('random_courtier'));
            assert.ok(CK3Language.isEffect('ordered_vassal'));
        });

        it('should return false for triggers', () => {
            assert.ok(!CK3Language.isEffect('has_trait'));
            assert.ok(!CK3Language.isEffect('is_alive'));
        });

        it('should return false for unknown keywords', () => {
            assert.ok(!CK3Language.isEffect('completely_unknown_keyword'));
        });
    });

    describe('isTrigger()', () => {
        before(() => {
            CK3Language.initialize(
                ['add_gold'],
                [
                    'has_trait', 'is_alive', 'is_ruler', 'age', 'gold',
                    'AND', 'OR', 'NOT', 'NOR', 'NAND',
                    'trigger_if', 'trigger_else_if', 'trigger_else',
                    'any_vassal', 'any_courtier',
                ],
            );
        });

        it('should recognize standard triggers', () => {
            assert.ok(CK3Language.isTrigger('has_trait'));
            assert.ok(CK3Language.isTrigger('is_alive'));
            assert.ok(CK3Language.isTrigger('is_ruler'));
        });

        it('should recognize logical operators as triggers', () => {
            assert.ok(CK3Language.isTrigger('AND'));
            assert.ok(CK3Language.isTrigger('OR'));
            assert.ok(CK3Language.isTrigger('NOT'));
            assert.ok(CK3Language.isTrigger('NOR'));
            assert.ok(CK3Language.isTrigger('NAND'));
        });

        it('should recognize trigger control flow', () => {
            assert.ok(CK3Language.isTrigger('trigger_if'));
            assert.ok(CK3Language.isTrigger('trigger_else_if'));
            assert.ok(CK3Language.isTrigger('trigger_else'));
        });

        it('should recognize iterator triggers', () => {
            assert.ok(CK3Language.isTrigger('any_vassal'));
            assert.ok(CK3Language.isTrigger('any_courtier'));
        });

        it('should return false for effects', () => {
            assert.ok(!CK3Language.isTrigger('add_gold'));
        });
    });

    describe('isLogicalOperator()', () => {
        it('should recognize all logical operators', () => {
            assert.ok(CK3Language.isLogicalOperator('AND'));
            assert.ok(CK3Language.isLogicalOperator('OR'));
            assert.ok(CK3Language.isLogicalOperator('NOT'));
            assert.ok(CK3Language.isLogicalOperator('NOR'));
            assert.ok(CK3Language.isLogicalOperator('NAND'));
        });

        it('should return false for non-operator keywords', () => {
            assert.ok(!CK3Language.isLogicalOperator('has_trait'));
            assert.ok(!CK3Language.isLogicalOperator('add_gold'));
            assert.ok(!CK3Language.isLogicalOperator('trigger_if'));
            assert.ok(!CK3Language.isLogicalOperator('if'));
        });

        it('should be case-sensitive', () => {
            assert.ok(!CK3Language.isLogicalOperator('and'));
            assert.ok(!CK3Language.isLogicalOperator('or'));
            assert.ok(!CK3Language.isLogicalOperator('not'));
        });
    });

    describe('static helpers', () => {
        it('should return traits', () => {
            const traits = CK3Language.getTraits();
            assert.ok(traits.includes('brave'));
            assert.ok(traits.includes('craven'));
            assert.ok(traits.includes('education_diplomacy_4'));
            assert.ok(traits.length > 50);
        });

        it('should check traits', () => {
            assert.ok(CK3Language.isTrait('brave'));
            assert.ok(!CK3Language.isTrait('not_a_real_trait'));
        });

        it('should return scope types', () => {
            const scopes = CK3Language.getScopeTypes();
            assert.ok(scopes.includes('character'));
            assert.ok(scopes.includes('title'));
            assert.ok(scopes.includes('province'));
        });

        it('should return scope accessors for character', () => {
            const accessors = CK3Language.getScopeAccessors('character');
            assert.ok(accessors.includes('liege'));
            assert.ok(accessors.includes('spouse'));
            assert.ok(accessors.includes('father'));
        });

        it('should return event types', () => {
            const types = CK3Language.getEventTypes();
            assert.ok(types.includes('character_event'));
            assert.ok(types.includes('letter_event'));
            assert.ok(types.includes('activity_event'));
            assert.ok(types.includes('fullscreen_event'));
            assert.ok(types.includes('feast_event'));
            assert.ok(types.includes('story_cycle'));
            assert.ok(!types.includes('empty'), 'empty should not be an event type');
        });

        it('should return animations', () => {
            const anims = CK3Language.getAnimations();
            assert.ok(anims.includes('personality_bold'));
            assert.ok(anims.includes('grief'));
        });
    });
});
