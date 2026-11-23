/**
 * What the advice checks of item 4.7 share: part D4's rows as they read them, the measured
 * conditions, the saved-scope link, the units each check judges, and the cases their fixture
 * pairs do not show. Each check's own fixture pair is tested in its own file.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { committedSpec } from '../spec/testing.js';
import { parse } from '../syntax/parser.js';
import { blockOf, type Block } from '../syntax/tree.js';
import { ADVICE_CHECKS, runAdvice } from './advice-checks.js';
import { descriptionRow, eventModelOf, eventRow } from './advice-events.js';
import { keywordRolesOf, parseTerm, termsHold } from './advice-roles.js';
import { savedScopeLink } from './advice-scopes.js';
import { ADVICE_KINDS } from './advice-kinds.js';
import type { CheckCode } from './finding.js';
import { checkText, specContext } from './testing.js';

const spec = committedSpec();

/** The findings of one code on a text read as `file`, as `[line, args]`. */
function found(
    code: CheckCode,
    file: string,
    text: string,
    defined: Record<string, readonly string[]> = {},
): [number, readonly string[]][] {
    return checkText(file, text, defined)
        .filter((f) => f.code === code)
        .map((f) => [f.range.start.line + 1, f.args]);
}

/** What each advice check judged on a text read as `file`. */
function judged(file: string, text: string): Map<CheckCode, number> {
    const parsed = parse(text);
    const out = new Map<CheckCode, number>();
    const results = runAdvice({
        spec,
        folders: specContext().folders,
        file,
        tree: parsed.file,
        names: { isDefined: () => false },
        context: { lines: parsed.lines },
    });
    for (const [code, result] of results) {
        out.set(code, result.judged);
    }
    return out;
}

function firstBlock(text: string): Block {
    const item = parse(text).file.items[0];
    const block = item?.kind === 'pair' ? blockOf(item.value) : undefined;
    assert.ok(block !== undefined);
    return block;
}

test('every advice code has a check, and every check a code', () => {
    assert.deepEqual(
        ADVICE_CHECKS.map((c) => c.code).sort(),
        (Object.keys(ADVICE_KINDS) as CheckCode[]).sort(),
    );
    for (const kind of Object.values(ADVICE_KINDS)) {
        assert.ok(kind.severity === 'information' || kind.severity === 'hint');
        assert.equal(kind.catalogue, null);
        assert.equal((kind.text?.match(/%s/g) ?? []).length, kind.slots.length);
    }
});

test("a measured count's terms: four forms are read, any other gives no term", () => {
    assert.deepEqual(parseTerm('has:after'), { form: 'has', key: 'after' });
    assert.deepEqual(parseTerm('no:desc'), { form: 'no', key: 'desc' });
    assert.deepEqual(parseTerm('type=letter_event'), {
        form: 'is',
        key: 'type',
        value: 'letter_event',
    });
    assert.deepEqual(parseTerm('hidden!=yes'), { form: 'is-not', key: 'hidden', value: 'yes' });
    assert.equal(parseTerm('several:after'), undefined);
    assert.equal(parseTerm('any:animation|scripted_animation'), undefined);
    assert.equal(parseTerm('chance>100'), undefined);
    const block = firstBlock('e = { hidden = yes after = { } }');
    assert.ok(termsHold([{ form: 'has', key: 'after' }], block));
    assert.ok(!termsHold([{ form: 'is-not', key: 'hidden', value: 'yes' }], block));
    assert.ok(termsHold([{ form: 'no', key: 'option' }], block));
});

test("part D4's events, as the checks read them from the committed package", () => {
    const model = eventModelOf(spec);
    assert.deepEqual(model.directories, ['events']);
    assert.equal(descriptionRow(model)?.keyword, 'desc');
    assert.equal(eventRow(model, 'required', 'event_option')?.keyword, 'option');
    assert.equal(eventRow(model, 'needs_sibling')?.keyword, 'after');
    const hides = eventRow(model, 'hides_from_player');
    assert.ok(hides !== undefined);
    assert.equal(model.roles.setValue(hides), 'yes');
    const desc = descriptionRow(model);
    assert.ok(desc !== undefined);
    assert.deepEqual(model.roles.condition(desc, 'no:desc'), [
        { form: 'is-not', key: 'hidden', value: 'yes' },
    ]);
    const sender = eventRow(model, 'required', 'restricted');
    assert.ok(sender !== undefined);
    assert.deepEqual(model.roles.condition(sender, 'no:sender'), [
        { form: 'is', key: 'type', value: 'letter_event' },
    ]);
    // A count that holds on some base-game record is no rule.
    assert.equal(model.roles.condition(desc, 'has:option'), undefined);
});

test('the link that reads a saved scope comes from the evidence of the table save_keys', () => {
    assert.equal(savedScopeLink(spec), 'scope');
    assert.ok(keywordRolesOf(spec).rows.length > 0);
});

test('each check says how many units it judged on a file', () => {
    const events = judged(
        'events/fixture.txt',
        'namespace = f\nf.1 = { hidden = yes }\nf.2 = { type = letter_event desc = k option = { } sender = root }\n',
    );
    assert.equal(events.get('structure/event-empty'), 2);
    assert.equal(events.get('structure/event-without-desc'), 1);
    assert.equal(events.get('structure/event-letter-without-sender'), 1);
    assert.equal(events.get('structure/event-unknown-type'), 1);
    assert.equal(events.get('structure/namespace-outside-events'), 0);
    const effects = judged('common/scripted_effects/fixture.txt', 'e = { if = { } else = { } }\n');
    assert.equal(effects.get('structure/else-without-if'), 1);
    assert.equal(effects.get('structure/namespace-outside-events'), 1);
    assert.equal(effects.get('structure/event-empty'), 0);
});

test('a hidden event is not judged for its description or options', () => {
    const text = 'namespace = f\nf.1 = {\n\thidden = yes\n}\nf.2 = {\n\thidden = no\n}\n';
    assert.deepEqual(found('structure/event-without-desc', 'events/f.txt', text), [
        [5, ['f.2', 'desc']],
    ]);
    assert.deepEqual(found('structure/event-without-desc', 'common/decisions/f.txt', text), []);
});

test('a logical operator is read in any letter case; a block, a missing value are not findings', () => {
    const text = 't = {\n\tOr = yes\n\tNAND = { a = yes }\n\tNOT =\n}\n';
    assert.deepEqual(
        found('structure/logic-operator-without-block', 'common/scripted_triggers/t.txt', text),
        [[2, ['Or']]],
    );
});

test('an else after a comment that follows its if is directly after it', () => {
    const text =
        'e = {\n\tif = { }\n\t# the other case\n\telse = { }\n\tadd_gold = 1\n\telse_if = { }\n}\n';
    assert.deepEqual(found('structure/else-without-if', 'common/scripted_effects/e.txt', text), [
        [6, ['else_if', "'if' or 'else_if'"]],
    ]);
});

test('fields/usually-present: placeholder fields, and sub-fields by the records that set their field', () => {
    // Every base-game event whose center_portrait is a block sets its character; a center
    // portrait written as a single value holds no field.
    const text =
        'namespace = f\nf.1 = {\n\thidden = yes\n\tcenter_portrait = {\n\t\tanimation = idle\n\t}\n}\nf.2 = {\n\thidden = yes\n\tcenter_portrait = root\n}\n';
    assert.deepEqual(found('fields/usually-present', 'events/f.txt', text), [
        [4, ['f.1.center_portrait', 'character', '807']],
    ]);
    // A dated history entry is the placeholder field `<date>`.
    const dated = (text: string): boolean =>
        found('fields/usually-present', 'history/characters/f.txt', text).some(
            ([, args]) => args[1] === '<date>',
        );
    assert.ok(dated('c = { }\n'));
    assert.ok(!dated('c = { 1066.1.1 = { } }\n'));
});

test('fields/unusual-value judges bare words of closed sets only', () => {
    const file = 'common/nicknames/f.txt';
    assert.deepEqual(found('fields/unusual-value', file, 'n = {\n\tis_bad = no\n}\n'), [
        [2, ['no', 'is_bad', "'yes'"]],
    ]);
    assert.deepEqual(
        found('fields/unusual-value', file, 'n = { is_bad = "no" is_prefix = $X$ }\n'),
        [],
    );
    // An on-action's fallback names an on-action (part D6): a mod's own is no unusual value.
    assert.deepEqual(
        found('fields/unusual-value', 'common/on_action/f.txt', 'a = { fallback = my_own }\n', {
            'common/on_action': ['my_own'],
        }),
        [],
    );
    // Numbers are no closed set.
    assert.deepEqual(
        found('fields/unusual-value', 'common/opinion_modifiers/f.txt', 'o = { years = 8 }\n'),
        [],
    );
});

test('references/unknown-name: a name the index holds, a chain or a parameter is not a finding', () => {
    const text =
        'namespace = f\nf.1 = {\n\thidden = yes\n\tright_portrait = {\n\t\tanimation = known\n\t\ttriggered_animation = {\n\t\t\ttrigger = { always = yes }\n\t\t\tanimation = unknown_one\n\t\t}\n\t}\n\tleft_portrait = {\n\t\tanimation = $ANIM$\n\t}\n}\n';
    assert.deepEqual(
        found('references/unknown-name', 'events/f.txt', text, { 'gfx/portraits': ['known'] }),
        [[8, ['unknown_one', 'gfx/portraits']]],
    );
});

test('scope/saved-late-read-in-desc: reads in a triggered_desc trigger and scopes saved early are not judged', () => {
    const text = [
        'namespace = f',
        'f.1 = {',
        '\tdesc = {',
        '\t\tfirst_valid = {',
        '\t\t\ttriggered_desc = {',
        '\t\t\t\ttrigger = { exists = scope:late }',
        '\t\t\t\tdesc = k',
        '\t\t\t}',
        '\t\t\tdesc = scope:early',
        '\t\t}',
        '\t}',
        '\timmediate = { save_scope_as = early }',
        '\toption = { save_scope_as = late save_scope_as = early }',
        '\tafter = { save_temporary_scope_as = later }',
        '}',
        '',
    ].join('\n');
    assert.deepEqual(found('scope/saved-late-read-in-desc', 'events/f.txt', text), []);
    assert.equal(judged('events/f.txt', text).get('scope/saved-late-read-in-desc'), 1);
    const late = text.replace('desc = scope:early', 'desc = scope:later.liege');
    assert.deepEqual(found('scope/saved-late-read-in-desc', 'events/f.txt', late), [
        [9, ['scope:later.liege', 'desc', "'option' or 'after'"]],
    ]);
});

test('structure/switch-without-branches: a case of any kind is a branch, the selector and the fallback are not', () => {
    const file = 'common/scripted_effects/e.txt';
    assert.deepEqual(
        found(
            'structure/switch-without-branches',
            file,
            'e = { switch = { trigger = has_trait } }\n',
        ),
        [[1, ['switch']]],
    );
    assert.deepEqual(
        found(
            'structure/switch-without-branches',
            file,
            'e = { switch = { trigger = has_trait flag:x = { } } }\n',
        ),
        [],
    );
});
