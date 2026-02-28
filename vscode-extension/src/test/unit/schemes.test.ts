/**
 * Unit Tests for CK3 Scheme Validation
 */

import * as assert from 'assert';
import { NodeType, ASTNode } from '../../server/core/parser';
import { validateSchemes, DEFAULT_SCHEME_CONFIG } from '../../server/ck3/validation/schemes';

function makeAssignment(key: string, value: string | boolean): ASTNode {
    return {
        type: NodeType.ASSIGNMENT,
        key,
        value,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
}

function makeBlock(key: string, children: ASTNode[] = []): ASTNode {
    return {
        type: NodeType.BLOCK,
        key,
        children,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } },
    };
}

describe('Scheme Validation', () => {
    describe('SCHEME-001: missing skill field', () => {
        it('should flag scheme without skill', () => {
            const root = makeBlock('ROOT', [
                makeBlock('murder_scheme', [
                    makeBlock('on_ready', [makeAssignment('trigger_event', 'yes')]),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(diags.some(d => d.code === 'SCHEME-001'), 'Should flag missing skill');
        });

        it('should not flag scheme with skill', () => {
            const root = makeBlock('ROOT', [
                makeBlock('murder_scheme', [
                    makeAssignment('skill', 'intrigue'),
                    makeBlock('on_ready', []),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(!diags.some(d => d.code === 'SCHEME-001'));
        });
    });

    describe('SCHEME-004: invalid skill type', () => {
        it('should flag invalid skill type', () => {
            const root = makeBlock('ROOT', [
                makeBlock('bad_scheme', [
                    makeAssignment('skill', 'swimming'),
                    makeBlock('on_ready', []),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(diags.some(d => d.code === 'SCHEME-004'), 'Should flag invalid skill');
        });

        it('should accept valid skill types', () => {
            const validSkills = ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning', 'prowess'];
            for (const skill of validSkills) {
                const root = makeBlock('ROOT', [
                    makeBlock('test_scheme', [
                        makeAssignment('skill', skill),
                        makeBlock('on_ready', []),
                    ]),
                ]);
                const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
                assert.ok(!diags.some(d => d.code === 'SCHEME-004'), `Skill '${skill}' should be valid`);
            }
        });
    });

    describe('SCHEME-002: no lifecycle effects', () => {
        it('should flag scheme with no effect blocks', () => {
            const root = makeBlock('ROOT', [
                makeBlock('empty_scheme', [
                    makeAssignment('skill', 'intrigue'),
                    makeBlock('allow', []),
                    makeBlock('valid', []),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(diags.some(d => d.code === 'SCHEME-002'), 'Should flag missing effects');
        });

        it('should not flag scheme with on_ready', () => {
            const root = makeBlock('ROOT', [
                makeBlock('test_scheme', [
                    makeAssignment('skill', 'intrigue'),
                    makeBlock('on_ready', []),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(!diags.some(d => d.code === 'SCHEME-002'));
        });
    });

    describe('SCHEME-003: uses agents without valid_agent', () => {
        it('should flag uses_agents=yes without valid_agent', () => {
            const root = makeBlock('ROOT', [
                makeBlock('agent_scheme', [
                    makeAssignment('skill', 'intrigue'),
                    makeAssignment('uses_agents', 'yes'),
                    makeBlock('on_ready', []),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(diags.some(d => d.code === 'SCHEME-003'), 'Should flag missing valid_agent');
        });

        it('should not flag when valid_agent is present', () => {
            const root = makeBlock('ROOT', [
                makeBlock('agent_scheme', [
                    makeAssignment('skill', 'intrigue'),
                    makeAssignment('uses_agents', 'yes'),
                    makeBlock('valid_agent', []),
                    makeBlock('on_ready', []),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(!diags.some(d => d.code === 'SCHEME-003'));
        });
    });

    describe('SCHEME-005: missing on_ready', () => {
        it('should flag scheme with on_start but no on_ready', () => {
            const root = makeBlock('ROOT', [
                makeBlock('incomplete_scheme', [
                    makeAssignment('skill', 'intrigue'),
                    makeBlock('on_start', []),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///common/schemes/test.txt');
            assert.ok(diags.some(d => d.code === 'SCHEME-005'), 'Should flag missing on_ready');
        });
    });

    describe('File path filtering', () => {
        it('should skip non-scheme files', () => {
            const root = makeBlock('ROOT', [
                makeBlock('test', [
                    makeAssignment('skill', 'intrigue'),
                ]),
            ]);
            const diags = validateSchemes(root, DEFAULT_SCHEME_CONFIG, 'file:///events/test.txt');
            assert.strictEqual(diags.length, 0);
        });
    });
});
