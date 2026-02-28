/**
 * Unit Tests for CK3 Parser
 */

import * as assert from 'assert';
import { CK3Parser, NodeType, ASTNode, ParsedDocument } from '../../server/core/parser';

describe('CK3Parser', () => {
    let parser: CK3Parser;

    beforeEach(() => {
        parser = new CK3Parser();
    });

    describe('parse()', () => {
        it('should return a ROOT node for empty input', () => {
            const result = parser.parse('');
            assert.strictEqual(result.ast.type, NodeType.ROOT);
            assert.deepStrictEqual(result.errors, []);
            assert.strictEqual(result.ast.children?.length ?? 0, 0);
        });

        it('should return a ROOT node for whitespace-only input', () => {
            const result = parser.parse('   \t\n  \n');
            assert.strictEqual(result.ast.type, NodeType.ROOT);
            assert.deepStrictEqual(result.errors, []);
        });
    });

    describe('simple assignments', () => {
        it('should parse key = string_value', () => {
            const result = parser.parse('name = my_event');
            const root = result.ast;
            assert.strictEqual(root.children?.length, 1);
            const node = root.children![0];
            assert.strictEqual(node.type, NodeType.ASSIGNMENT);
            assert.strictEqual(node.key, 'name');
            assert.strictEqual(node.value, 'my_event');
        });

        it('should parse key = number_value', () => {
            const result = parser.parse('weight = 100');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.ASSIGNMENT);
            assert.strictEqual(node.key, 'weight');
            assert.strictEqual(node.value, 100);
        });

        it('should parse key = negative_number', () => {
            const result = parser.parse('modifier = -5');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, -5);
        });

        it('should parse key = float_value', () => {
            const result = parser.parse('factor = 0.75');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, 0.75);
        });

        it('should parse key = yes as boolean true', () => {
            const result = parser.parse('is_triggered_only = yes');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, true);
        });

        it('should parse key = no as boolean false', () => {
            const result = parser.parse('hidden = no');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, false);
        });

        it('should parse key = "quoted string"', () => {
            const result = parser.parse('title = "My Event Title"');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.ASSIGNMENT);
            assert.strictEqual(node.key, 'title');
            assert.strictEqual(node.value, 'My Event Title');
        });

        it('should parse key with dots (scope chains)', () => {
            const result = parser.parse('root.liege.primary_title = some_value');
            const node = result.ast.children![0];
            assert.strictEqual(node.key, 'root.liege.primary_title');
        });

        it('should parse multiple assignments', () => {
            const result = parser.parse('name = test\ntype = character_event\nhidden = yes');
            assert.strictEqual(result.ast.children?.length, 3);
            assert.strictEqual(result.ast.children![0].key, 'name');
            assert.strictEqual(result.ast.children![1].key, 'type');
            assert.strictEqual(result.ast.children![2].key, 'hidden');
        });
    });

    describe('comparisons', () => {
        it('should parse key > value', () => {
            const result = parser.parse('age > 16');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.key, 'age');
            assert.strictEqual(node.operator, '>');
            assert.strictEqual(node.value, 16);
        });

        it('should parse key < value', () => {
            const result = parser.parse('gold < 100');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.operator, '<');
            assert.strictEqual(node.value, 100);
        });

        it('should parse key >= value', () => {
            const result = parser.parse('prestige >= 500');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.operator, '>=');
            assert.strictEqual(node.value, 500);
        });

        it('should parse key <= value', () => {
            const result = parser.parse('piety <= 200');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.operator, '<=');
            assert.strictEqual(node.value, 200);
        });
    });

    describe('blocks', () => {
        it('should parse empty block', () => {
            const result = parser.parse('trigger = { }');
            const node = result.ast.children![0];
            // Empty blocks with no children are still BLOCK type
            assert.ok(node.type === NodeType.BLOCK || node.type === NodeType.LIST);
            assert.strictEqual(node.key, 'trigger');
        });

        it('should parse block with assignments', () => {
            const result = parser.parse('effect = {\n\tadd_gold = 100\n\tadd_prestige = 50\n}');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.BLOCK);
            assert.strictEqual(node.key, 'effect');
            assert.strictEqual(node.children?.length, 2);
            assert.strictEqual(node.children![0].key, 'add_gold');
            assert.strictEqual(node.children![0].value, 100);
            assert.strictEqual(node.children![1].key, 'add_prestige');
            assert.strictEqual(node.children![1].value, 50);
        });

        it('should parse nested blocks', () => {
            const result = parser.parse(
                'my_event = {\n' +
                '\ttrigger = {\n' +
                '\t\tis_alive = yes\n' +
                '\t}\n' +
                '}'
            );
            const outerBlock = result.ast.children![0];
            assert.strictEqual(outerBlock.type, NodeType.BLOCK);
            assert.strictEqual(outerBlock.key, 'my_event');

            const innerBlock = outerBlock.children![0];
            assert.strictEqual(innerBlock.type, NodeType.BLOCK);
            assert.strictEqual(innerBlock.key, 'trigger');
            assert.strictEqual(innerBlock.children![0].key, 'is_alive');
            assert.strictEqual(innerBlock.children![0].value, true);
        });

        it('should parse deeply nested blocks', () => {
            const result = parser.parse(
                'a = {\n' +
                '\tb = {\n' +
                '\t\tc = {\n' +
                '\t\t\td = yes\n' +
                '\t\t}\n' +
                '\t}\n' +
                '}'
            );
            const a = result.ast.children![0];
            const b = a.children![0];
            const c = b.children![0];
            assert.strictEqual(c.children![0].key, 'd');
            assert.strictEqual(c.children![0].value, true);
        });
    });

    describe('lists', () => {
        it('should parse value lists', () => {
            const result = parser.parse('colors = { red green blue }');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.LIST);
            assert.strictEqual(node.key, 'colors');
            assert.strictEqual(node.children?.length, 3);
            assert.strictEqual(node.children![0].value, 'red');
            assert.strictEqual(node.children![1].value, 'green');
            assert.strictEqual(node.children![2].value, 'blue');
        });

        it('should parse number lists', () => {
            const result = parser.parse('weights = { 10 20 30 }');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.LIST);
            assert.strictEqual(node.children?.length, 3);
        });
    });

    describe('comments', () => {
        it('should parse single-line comments', () => {
            const result = parser.parse('# This is a comment');
            assert.strictEqual(result.ast.children?.length, 1);
            assert.strictEqual(result.ast.children![0].type, NodeType.COMMENT);
        });

        it('should parse comments mixed with code', () => {
            const result = parser.parse('# A comment\nname = test\n# Another comment');
            assert.strictEqual(result.ast.children?.length, 3);
            assert.strictEqual(result.ast.children![0].type, NodeType.COMMENT);
            assert.strictEqual(result.ast.children![1].type, NodeType.ASSIGNMENT);
            assert.strictEqual(result.ast.children![2].type, NodeType.COMMENT);
        });

        it('should parse comments inside blocks', () => {
            const result = parser.parse('effect = {\n\t# inline comment\n\tadd_gold = 100\n}');
            const block = result.ast.children![0];
            assert.strictEqual(block.type, NodeType.BLOCK);
            const hasComment = block.children!.some(c => c.type === NodeType.COMMENT);
            assert.ok(hasComment, 'Block should contain a comment node');
        });
    });

    describe('quoted strings', () => {
        it('should handle escaped quotes inside strings', () => {
            const result = parser.parse('desc = "He said \\"hello\\""');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, 'He said "hello"');
        });

        it('should handle empty quoted strings', () => {
            const result = parser.parse('name = ""');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, '');
        });
    });

    describe('identifier characters', () => {
        it('should parse identifiers with underscores', () => {
            const result = parser.parse('my_special_event = yes');
            assert.strictEqual(result.ast.children![0].key, 'my_special_event');
        });

        it('should parse identifiers starting with @', () => {
            const result = parser.parse('@local_var = 10');
            assert.strictEqual(result.ast.children![0].key, '@local_var');
        });

        it('should parse identifiers with colons', () => {
            const result = parser.parse('scope:my_scope = yes');
            assert.strictEqual(result.ast.children![0].key, 'scope:my_scope');
        });

        it('should parse identifiers with dots (scope chains)', () => {
            const result = parser.parse('root.primary_title = some_val');
            assert.strictEqual(result.ast.children![0].key, 'root.primary_title');
        });
    });

    describe('CK3-realistic scripts', () => {
        it('should parse a typical event definition', () => {
            const script = [
                'namespace = my_mod',
                '',
                'my_mod.0001 = {',
                '\ttype = character_event',
                '\ttitle = my_mod.0001.t',
                '\tdesc = my_mod.0001.desc',
                '\ttheme = intrigue',
                '',
                '\ttrigger = {',
                '\t\tis_alive = yes',
                '\t\tage >= 16',
                '\t}',
                '',
                '\toption = {',
                '\t\tname = my_mod.0001.a',
                '\t\tadd_gold = 100',
                '\t}',
                '}',
            ].join('\n');

            const result = parser.parse(script);
            assert.deepStrictEqual(result.errors, []);

            // Root should have namespace + event block
            const rootChildren = result.ast.children!.filter(c => c.type !== NodeType.COMMENT);
            assert.strictEqual(rootChildren.length, 2);

            // Namespace assignment
            assert.strictEqual(rootChildren[0].key, 'namespace');
            assert.strictEqual(rootChildren[0].value, 'my_mod');

            // Event block
            const event = rootChildren[1];
            assert.strictEqual(event.type, NodeType.BLOCK);
            assert.strictEqual(event.key, 'my_mod.0001');

            // Event children
            const eventChildren = event.children!.filter(c => c.type !== NodeType.COMMENT);
            assert.ok(eventChildren.length >= 5, `Expected at least 5 children, got ${eventChildren.length}`);
        });

        it('should parse a decision definition', () => {
            const script = [
                'my_decision = {',
                '\tis_shown = {',
                '\t\tis_ruler = yes',
                '\t}',
                '\teffect = {',
                '\t\tadd_prestige = 200',
                '\t}',
                '}',
            ].join('\n');

            const result = parser.parse(script);
            assert.deepStrictEqual(result.errors, []);
            const decision = result.ast.children![0];
            assert.strictEqual(decision.type, NodeType.BLOCK);
            assert.strictEqual(decision.key, 'my_decision');
        });
    });

    describe('error handling', () => {
        it('should report error for missing closing brace', () => {
            const result = parser.parse('block = {\n\tkey = value\n');
            assert.ok(result.errors.length > 0, 'Should have parse errors');
        });

        it('should report error for missing operator', () => {
            const result = parser.parse('key value');
            assert.ok(result.errors.length > 0, 'Should have parse errors');
        });

        it('should still produce an AST even with errors', () => {
            const result = parser.parse('good = yes\nbad\nok = no');
            assert.ok(result.ast.type === NodeType.ROOT);
            // Should still parse the valid parts
            const validNodes = result.ast.children!.filter(c => c.type === NodeType.ASSIGNMENT);
            assert.ok(validNodes.length >= 1, 'Should parse at least some valid nodes');
        });
    });

    describe('range tracking', () => {
        it('should track line and character positions', () => {
            const result = parser.parse('name = test');
            const node = result.ast.children![0];
            assert.strictEqual(node.range.start.line, 0);
            assert.strictEqual(node.range.start.character, 0);
        });

        it('should track correct line for multi-line input', () => {
            const result = parser.parse('first = a\nsecond = b\nthird = c');
            const nodes = result.ast.children!;
            assert.strictEqual(nodes[0].range.start.line, 0);
            assert.strictEqual(nodes[1].range.start.line, 1);
            assert.strictEqual(nodes[2].range.start.line, 2);
        });
    });

    describe('parser reuse', () => {
        it('should be reusable across multiple parse calls', () => {
            const result1 = parser.parse('a = 1');
            const result2 = parser.parse('b = 2');

            assert.strictEqual(result1.ast.children![0].key, 'a');
            assert.strictEqual(result2.ast.children![0].key, 'b');
            assert.deepStrictEqual(result1.errors, []);
            assert.deepStrictEqual(result2.errors, []);
        });

        it('should not carry over errors from previous parses', () => {
            parser.parse('bad');
            const result = parser.parse('good = yes');
            assert.deepStrictEqual(result.errors, []);
        });
    });

    describe('double equals operator (==)', () => {
        it('should parse key == numeric value as COMPARISON', () => {
            const result = parser.parse('prestige == 1000');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.key, 'prestige');
            assert.strictEqual(node.operator, '==');
            assert.strictEqual(node.value, 1000);
        });

        it('should parse == with identifier value', () => {
            const result = parser.parse('culture == norse');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.operator, '==');
            assert.strictEqual(node.value, 'norse');
        });

        it('should produce no errors for == operator', () => {
            const result = parser.parse('age == 16');
            assert.deepStrictEqual(result.errors, []);
        });

        it('should parse == inside a block', () => {
            const result = parser.parse('trigger = {\n\tprestige == 500\n}');
            assert.deepStrictEqual(result.errors, []);
            const block = result.ast.children![0];
            assert.strictEqual(block.type, NodeType.BLOCK);
            const child = block.children![0];
            assert.strictEqual(child.type, NodeType.COMPARISON);
            assert.strictEqual(child.operator, '==');
        });
    });

    describe('not equals operator (!=)', () => {
        it('should parse key != value as COMPARISON', () => {
            const result = parser.parse('culture != norse');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.key, 'culture');
            assert.strictEqual(node.operator, '!=');
            assert.strictEqual(node.value, 'norse');
        });

        it('should parse != with numeric value', () => {
            const result = parser.parse('gold != 0');
            const node = result.ast.children![0];
            assert.strictEqual(node.type, NodeType.COMPARISON);
            assert.strictEqual(node.operator, '!=');
            assert.strictEqual(node.value, 0);
        });

        it('should produce no errors for != operator', () => {
            const result = parser.parse('trait != brave');
            assert.deepStrictEqual(result.errors, []);
        });

        it('should parse != inside a block', () => {
            const result = parser.parse('trigger = {\n\tfaith != catholic\n}');
            assert.deepStrictEqual(result.errors, []);
            const block = result.ast.children![0];
            const child = block.children![0];
            assert.strictEqual(child.type, NodeType.COMPARISON);
            assert.strictEqual(child.operator, '!=');
        });
    });

    describe('numeric keys (random_list weights)', () => {
        it('should parse number = { block } inside a block', () => {
            const result = parser.parse('random_list = {\n\t50 = {\n\t\tadd_gold = 100\n\t}\n}');
            assert.deepStrictEqual(result.errors, []);
            const randomList = result.ast.children![0];
            assert.strictEqual(randomList.type, NodeType.BLOCK);
            assert.strictEqual(randomList.key, 'random_list');
            const weightBlock = randomList.children![0];
            assert.strictEqual(weightBlock.type, NodeType.BLOCK);
            assert.strictEqual(weightBlock.key, '50');
        });

        it('should parse number = simple_value as ASSIGNMENT', () => {
            const result = parser.parse('random_list = {\n\t50 = some_effect\n}');
            assert.deepStrictEqual(result.errors, []);
            const randomList = result.ast.children![0];
            const child = randomList.children![0];
            assert.strictEqual(child.type, NodeType.ASSIGNMENT);
            assert.strictEqual(child.key, '50');
            assert.strictEqual(child.value, 'some_effect');
        });

        it('should parse multiple numeric keys', () => {
            const result = parser.parse('random_list = {\n\t50 = { a = 1 }\n\t30 = { b = 2 }\n\t20 = { c = 3 }\n}');
            assert.deepStrictEqual(result.errors, []);
            const randomList = result.ast.children![0];
            assert.strictEqual(randomList.children!.length, 3);
            assert.strictEqual(randomList.children![0].key, '50');
            assert.strictEqual(randomList.children![1].key, '30');
            assert.strictEqual(randomList.children![2].key, '20');
        });
    });

    describe('backslash escape in strings', () => {
        it('should handle \\\\ escape sequence', () => {
            const result = parser.parse('path = "C:\\\\Users\\\\test"');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, 'C:\\Users\\test');
        });

        it('should handle mixed \\\\ and \\" escapes', () => {
            const result = parser.parse('desc = "He said \\"hello\\\\"');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, 'He said "hello\\');
        });

        it('should preserve unknown escape sequences literally', () => {
            const result = parser.parse('text = "line\\nbreak"');
            const node = result.ast.children![0];
            assert.strictEqual(node.value, 'line\\nbreak');
        });
    });

    describe('mixed operators in realistic CK3 script', () => {
        it('should parse a trigger block with ==, !=, >=, > operators', () => {
            const script = [
                'trigger = {',
                '\tculture == norse',
                '\tfaith != catholic',
                '\tage >= 16',
                '\tgold > 100',
                '}',
            ].join('\n');
            const result = parser.parse(script);
            assert.deepStrictEqual(result.errors, []);
            const trigger = result.ast.children![0];
            assert.strictEqual(trigger.type, NodeType.BLOCK);
            const children = trigger.children!;
            assert.strictEqual(children.length, 4);
            assert.strictEqual(children[0].operator, '==');
            assert.strictEqual(children[1].operator, '!=');
            assert.strictEqual(children[2].operator, '>=');
            assert.strictEqual(children[3].operator, '>');
        });

        it('should parse a full random_list with weighted blocks', () => {
            const script = [
                'random_list = {',
                '\t10 = {',
                '\t\tadd_trait = brave',
                '\t}',
                '\t10 = {',
                '\t\tadd_trait = craven',
                '\t}',
                '}',
            ].join('\n');
            const result = parser.parse(script);
            assert.deepStrictEqual(result.errors, []);
            const randomList = result.ast.children![0];
            assert.strictEqual(randomList.type, NodeType.BLOCK);
            assert.strictEqual(randomList.children!.length, 2);
            assert.strictEqual(randomList.children![0].key, '10');
            assert.strictEqual(randomList.children![1].key, '10');
            const inner = randomList.children![0].children![0];
            assert.strictEqual(inner.key, 'add_trait');
            assert.strictEqual(inner.value, 'brave');
        });
    });
});
