/**
 * The scope walk (docs/PLAN.md item 4.4): every way the scope of a block is known, changes or
 * becomes unknown, read from the committed spec package. Each case is a few lines of text read
 * as the file at a path in a mod; a key `fixture_probe` marks the block whose frame is shown,
 * as `<this>/<root>`, a scope type or `?<why it is not known>`.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Spec } from '../spec/reader.js';
import { committedSpec } from '../spec/testing.js';
import type { DirectorySchema } from '../spec/package.js';
import { parse } from '../syntax/parser.js';
import { blockOf, type Block, type FileNode, type Pair } from '../syntax/tree.js';
import { readContext } from './context.js';
import { headsOf, keywordUses, readScopes, type Scope, type ScopeReading } from './scope.js';
import { isAdvice } from './finding.js';
import { checkText, specContext } from './testing.js';

const PROBE = 'fixture_probe';

interface Walked {
    readonly tree: FileNode;
    readonly scopes: ScopeReading;
    readonly uses: ReturnType<typeof keywordUses>;
}

function walk(
    file: string,
    text: string,
    options: { spec?: Spec; defined?: Record<string, readonly string[]> } = {},
): Walked {
    const spec = options.spec ?? committedSpec();
    const defined = options.defined ?? {};
    const tree = parse(text).file;
    const input = {
        spec,
        folders: specContext().folders,
        file,
        tree,
        names: {
            isDefined: (name: string, database: string): boolean =>
                defined[database]?.includes(name) ?? false,
        },
    };
    const reading = readContext(input);
    const scopes = readScopes(input, reading);
    return { tree, scopes, uses: keywordUses(spec, reading, scopes) };
}

/** Every pair of the tree with the key `key`, in the order written. */
function pairsNamed(tree: FileNode, key: string): Pair[] {
    const out: Pair[] = [];
    const visit = (items: readonly FileNode['items'][number][]): void => {
        for (const item of items) {
            if (item.kind === 'pair') {
                if (item.key.text === key) {
                    out.push(item);
                }
                const body: Block | undefined = blockOf(item.value);
                if (body !== undefined && item.value?.kind === 'block') {
                    visit(body.items);
                }
            } else if (item.kind === 'block') {
                visit(item.items);
            }
        }
    };
    visit(tree.items);
    return out;
}

function show(scope: Scope): string {
    return scope.type ?? `?${scope.why}`;
}

/** The frame of each probe, in the order written: `<this>/<root>`. */
function probes(file: string, text: string, options: Parameters<typeof walk>[2] = {}): string[] {
    const { tree, scopes } = walk(file, text, options);
    return pairsNamed(tree, PROBE).map((pair) => {
        const frame = scopes.pairs.get(pair);
        return frame === undefined ? 'not reached' : `${show(frame.this)}/${show(frame.root)}`;
    });
}

const DECISION = 'common/decisions/fixture.txt';
const EVENT = 'events/fixture.txt';

/** A decision whose `is_shown` (a trigger block) holds `body`. */
function shown(body: string): string {
    return `fixture_decision = {\n\tis_shown = {\n${body}\n\t}\n}\n`;
}

/** A decision whose `effect` (an effect block) holds `body`. */
function effect(body: string): string {
    return `fixture_decision = {\n\teffect = {\n${body}\n\t}\n}\n`;
}

// ─── The heads of `scope_heads` ──────────────────────────────────────────────

test('which head of scope_heads is the root and which the current scope is read from the package', () => {
    assert.deepEqual(headsOf(committedSpec()), { root: 'root', this: 'this' });
});

// ─── A record's root ─────────────────────────────────────────────────────────

test("a record runs in its directory's root scope, and its fields keep it", () => {
    assert.deepEqual(probes(DECISION, shown(`${PROBE} = yes`)), ['character/character']);
    assert.deepEqual(
        probes(
            'common/buildings/fixture.txt',
            `fixture_building_01 = {\n\tis_enabled = { ${PROBE} = yes }\n}\n`,
        ),
        ['province/province'],
    );
});

test("an event's scope sets its root (part D4); a value that is no scope type leaves it unknown", () => {
    const event = (scope: string): string =>
        `namespace = fixture\nfixture.0001 = {\n\t${scope}\n\ttrigger = { ${PROBE} = yes }\n}\n`;
    assert.deepEqual(probes(EVENT, event('')), ['character/character']);
    assert.deepEqual(probes(EVENT, event('scope = province')), ['province/province']);
    assert.deepEqual(probes(EVENT, event('scope = none')), ['?not-a-scope-type/?not-a-scope-type']);
});

test("an on-action's root is the one scope the game's documentation expects it in", () => {
    const action = (name: string): string => `${name} = {\n\teffect = { ${PROBE} = yes }\n}\n`;
    const file = 'common/on_action/fixture.txt';
    assert.deepEqual(probes(file, action('on_birth_child')), ['character/character']);
    assert.deepEqual(probes(file, action('on_county_faith_change')), ['landed_title/landed_title']);
    // Expected in no scope (`none`), and an on-action the game does not document.
    assert.deepEqual(probes(file, action('on_game_start')), ['?on-action-scope/?on-action-scope']);
    assert.deepEqual(probes(file, action('fixture_on_action')), [
        '?on-action-scope/?on-action-scope',
    ]);
});

test('a definition other script calls by name runs in its caller scope: unknown', () => {
    assert.deepEqual(
        probes('common/scripted_effects/fixture.txt', `fixture_effect = { ${PROBE} = yes }\n`),
        ['?called/?called'],
    );
    // Format 9: scripted modifiers have no root; they run in the scope of the place that names
    // them (`root_scope_rule: caller`, item 3 of the request of 2026-11-25).
    const modifiers = committedSpec().data.schema['common/scripted_modifiers'];
    assert.deepEqual([modifiers?.root_scope, modifiers?.root_scope_rule], [undefined, 'caller']);
    assert.deepEqual(
        probes(
            'common/scripted_modifiers/fixture.txt',
            `fixture_modifier = {\n\tmodifier = {\n\t\tadd = 5\n\t\t${PROBE} = yes\n\t}\n}\n`,
        ),
        ['?called/?called'],
    );
});

test('an inline scripted trigger, and a root that is no scope type, are unknown', () => {
    assert.deepEqual(probes(EVENT, `scripted_trigger fixture_inline = { ${PROBE} = yes }\n`), [
        '?inline-definition/?inline-definition',
    ]);
    // An event whose `scope` names no scope type of the package.
    assert.deepEqual(
        probes(
            EVENT,
            `fixture.1 = {\n\ttype = character_event\n\tscope = fixture_no_type\n\timmediate = { ${PROBE} = yes }\n}\n`,
        ),
        ['?not-a-scope-type/?not-a-scope-type'],
    );
});

test('format 9: a root is judged only where its rule is fixed, and not on the wiki seed alone', () => {
    // history/titles: the root `landed_title` (it was `title`, no scope type, in format 8).
    assert.deepEqual(
        probes(
            'history/titles/fixture.txt',
            `k_fixture = {\n\t1066.1.1 = {\n\t\teffect = { ${PROBE} = yes }\n\t}\n}\n`,
        ),
        ['landed_title/landed_title'],
    );
    // common/laws: the root `character` (`Root scope = ruler`), fixed, confirmed by its .info.
    const laws = committedSpec().data.schema['common/laws'];
    assert.deepEqual(
        [laws?.root_scope, laws?.root_scope_rule, laws?.root_scope_evidence?.status],
        ['character', 'fixed', 'confirmed'],
    );
    // A rule other than `fixed`: the root comes from a field of the record (scripted GUIs).
    assert.deepEqual(
        probes(
            'common/scripted_guis/fixture.txt',
            `fixture_gui = {\n\tscope = character\n\teffect = { ${PROBE} = yes }\n}\n`,
        ),
        ['?root-rule/?root-rule'],
    );
    // A root only the wiki-era seed gives (common/nicknames: wiki-only) is not judged.
    assert.equal(
        committedSpec().data.schema['common/nicknames']?.root_scope_evidence?.status,
        'wiki-only',
    );
    assert.deepEqual(
        probes(
            'common/nicknames/fixture.txt',
            `fixture_nickname = {\n\tis_bad = yes\n\tfixture_block = { ${PROBE} = yes }\n}\n`,
        ),
        ['?root-wiki-only/?root-wiki-only'],
    );
});

// ─── A record's fields ───────────────────────────────────────────────────────

test('a field the schema gives a scope runs in it, with its root not known', () => {
    const file = 'common/factions/fixture.txt';
    assert.deepEqual(
        probes(file, `fixture_faction = {\n\tcan_character_join = { ${PROBE} = yes }\n}\n`),
        ['character/?field-scope'],
    );
    assert.deepEqual(
        probes(file, `fixture_faction = {\n\tcounty_power = { ${PROBE} = yes }\n}\n`),
        ['?field-several-scopes/?field-scope'],
    );
    assert.deepEqual(
        probes(
            'common/casus_belli_types/fixture.txt',
            `fixture_cb = {\n\ton_victory = { ${PROBE} = yes }\n}\n`,
        ),
        ['casus_belli/?field-scope'],
    );
});

test('a field of the table fields_outside_root is unknown', () => {
    assert.deepEqual(
        probes(
            'common/character_interactions/fixture.txt',
            `fixture_interaction = {\n\tcan_be_picked_artifact = { ${PROBE} = yes }\n}\n`,
        ),
        ['?field-outside-root/?field-outside-root'],
    );
});

test(".info scope notes are a hint beside the root: one naming another scope type stops the field's scope", () => {
    const spec = committedSpec();
    const withNote = (type: string): Spec => {
        const decisions = spec.data.schema['common/decisions'] as DirectorySchema;
        const isShown = decisions.fields['is_shown'];
        assert.ok(isShown !== undefined);
        const schema = {
            ...spec.data.schema,
            'common/decisions': {
                ...decisions,
                fields: {
                    ...decisions.fields,
                    is_shown: { ...isShown, info_scope: [{ scope: 'root', type }] },
                },
            },
        };
        return new Spec({ ...spec.data, schema }, spec.sha256, spec.dir);
    };
    assert.deepEqual(probes(DECISION, shown(`${PROBE} = yes`), { spec: withNote('Province') }), [
        '?info-scope-disagrees/character',
    ]);
    // The record's own type, and a type the package does not have, say nothing.
    assert.deepEqual(probes(DECISION, shown(`${PROBE} = yes`), { spec: withNote('Character') }), [
        'character/character',
    ]);
    assert.deepEqual(probes(DECISION, shown(`${PROBE} = yes`), { spec: withNote('title') }), [
        'character/character',
    ]);
});

test("a dated entry holds the record's own fields; a field's own fields are unknown, their root too", () => {
    assert.deepEqual(
        probes(
            'history/characters/fixture.txt',
            `fixture_character = {\n\t1066.1.1 = {\n\t\teffect = { ${PROBE} = yes }\n\t}\n}\n`,
        ),
        ['character/character'],
    );
    // A decision's widget runs its title_valid with the title as root.
    assert.deepEqual(
        probes(
            DECISION,
            `fixture_decision = {\n\twidget = {\n\t\ttitle_valid = { ${PROBE} = yes }\n\t}\n}\n`,
        ),
        ['?sub-field/?sub-field'],
    );
});

// ─── Links and chains ────────────────────────────────────────────────────────

test('a link written as a block key gives its output scope; the root stays', () => {
    assert.deepEqual(
        probes(DECISION, shown(`liege = { ${PROBE} = yes }\nprimary_title = { ${PROBE} = yes }`)),
        ['character/character', 'landed_title/character'],
    );
});

test('a chain gives the output of its last link; a link that takes data by its data form', () => {
    assert.deepEqual(
        probes(
            DECISION,
            shown(
                [
                    `root.primary_title = { ${PROBE} = yes }`,
                    `primary_title.holder = { ${PROBE} = yes }`,
                    `title:k_fixture = { ${PROBE} = yes }`,
                    `title:k_fixture.title_province = { ${PROBE} = yes }`,
                ].join('\n'),
            ),
        ),
        [
            'landed_title/character',
            'character/character',
            'landed_title/character',
            'province/character',
        ],
    );
});

test('a saved scope or a variable has no type the package gives; a link after it still gives its output', () => {
    assert.deepEqual(
        probes(
            DECISION,
            shown(
                [
                    `scope:fixture_target = { ${PROBE} = yes }`,
                    `var:fixture_variable = { ${PROBE} = yes }`,
                    `scope:fixture_target.liege = { ${PROBE} = yes }`,
                ].join('\n'),
            ),
        ),
        ['?link-output/character', '?link-output/character', 'character/character'],
    );
});

test('after a link applied to a scope it cannot start from, the scope is unknown', () => {
    assert.deepEqual(
        probes(DECISION, shown(`primary_title = {\n\tliege = { ${PROBE} = yes }\n}`)),
        ['?after-wrong-link/character'],
    );
});

test('the scope heads: the root, the current scope (any letter case); the previous one is not followed', () => {
    assert.deepEqual(
        probes(
            DECISION,
            shown(
                `primary_title = {\n\troot = { ${PROBE} = yes }\n\tROOT = { ${PROBE} = yes }\n\tthis = { ${PROBE} = yes }\n\tprev = { ${PROBE} = yes }\n\troot.primary_title = { ${PROBE} = yes }\n}`,
            ),
        ),
        [
            'character/character',
            'character/character',
            'landed_title/character',
            '?previous-scope/character',
            'landed_title/character',
        ],
    );
});

// ─── Iterators, structure and parameters ─────────────────────────────────────

test("an iterator gives its list's element scope; a list with no one element type is unknown", () => {
    assert.deepEqual(
        probes(
            DECISION,
            effect(
                `every_held_title = { ${PROBE} = yes }\nevery_vassal = { ${PROBE} = yes }\nevery_in_list = {\n\tlist = fixture_list\n\t${PROBE} = yes\n}`,
            ),
        ),
        ['landed_title/character', 'character/character', '?list-element/character'],
    );
});

test('logical operators, filters, containers and case blocks keep the frame', () => {
    assert.deepEqual(
        probes(
            DECISION,
            shown(
                `primary_title = {\n\tNOT = { ${PROBE} = yes }\n\tNor = { ${PROBE} = yes }\n\ttrigger_if = {\n\t\tlimit = { ${PROBE} = yes }\n\t\t${PROBE} = yes\n\t}\n}`,
            ),
        ),
        Array<string>(4).fill('landed_title/character'),
    );
    assert.deepEqual(
        probes(
            DECISION,
            effect(
                `primary_title = {\n\tif = { ${PROBE} = yes }\n\trandom_list = {\n\t\t10 = { ${PROBE} = yes }\n\t}\n\tswitch = {\n\t\ttrigger = has_title_law\n\t\tfixture_law = { ${PROBE} = yes }\n\t}\n}`,
            ),
        ),
        Array<string>(3).fill('landed_title/character'),
    );
});

test("a keyword's own block runs with scopes of its own; a parameter block keeps the root", () => {
    assert.deepEqual(
        probes(
            DECISION,
            effect(`add_opinion = {\n\ttarget = root\n\tlimit = { ${PROBE} = yes }\n}`),
        ),
        ['?parameters/?parameters'],
    );
    assert.deepEqual(
        probes(DECISION, shown(`any_in_de_jure_hierarchy = {\n\tfilter = { ${PROBE} = yes }\n}`)),
        ['?parameter-block/character'],
    );
    assert.deepEqual(
        probes(DECISION, shown(`fixture_scripted_trigger = { ${PROBE} = yes }`), {
            defined: { 'common/scripted_triggers': ['fixture_scripted_trigger'] },
        }),
        ['?parameters/?parameters'],
    );
});

test("a field of a trigger or effect block (an event option's trigger) is unknown, its root kept", () => {
    assert.deepEqual(
        probes(
            EVENT,
            `namespace = fixture\nfixture.0001 = {\n\toption = {\n\t\ttrigger = { ${PROBE} = yes }\n\t\t${PROBE} = yes\n\t}\n}\n`,
        ),
        ['?sub-field/character', 'character/character'],
    );
});

// ─── Script values ───────────────────────────────────────────────────────────

test('in a script value its operations keep the frame; links and iterators switch it', () => {
    assert.deepEqual(
        probes(
            'common/script_values/fixture.txt',
            `fixture_value = {\n\tvalue = 1\n\tadd = { ${PROBE} = 1 }\n\tevery_vassal = { ${PROBE} = 1 }\n\tliege = { ${PROBE} = 1 }\n\tif = {\n\t\tlimit = { ${PROBE} = yes }\n\t}\n}\n`,
        ),
        ['?called/?called', 'character/?called', 'character/?called', '?called/?called'],
    );
});

test('an inline `value = { }` is a script value, not the link value', () => {
    const { tree, scopes } = walk(
        DECISION,
        effect(
            `capital_county = {\n\tset_variable = {\n\t\tname = fixture_variable\n\t\tvalue = {\n\t\t\tif = {\n\t\t\t\tlimit = {\n\t\t\t\t\tcapital_province = { ${PROBE} = yes }\n\t\t\t\t}\n\t\t\t\tadd = 1\n\t\t\t}\n\t\t}\n\t}\n}`,
        ),
    );
    const step = scopes.links.find((s) => s.link === 'capital_province');
    assert.ok(step !== undefined);
    assert.deepEqual(step.input, { type: null, why: 'parameters' });
    assert.deepEqual(
        pairsNamed(tree, PROBE).map((p) => scopes.pairs.get(p)?.this),
        [{ type: 'province' }],
    );
});

test("a switch's case label in a script value is a value compared, not a scope switch", () => {
    assert.deepEqual(
        probes(
            'common/script_values/fixture.txt',
            `fixture_value = {\n\tswitch = {\n\t\ttrigger = scope:fixture_target\n\t\tdoctrine:fixture_doctrine = { ${PROBE} = 1 }\n\t}\n}\n`,
        ),
        ['?called/?called'],
    );
});

// ─── Keyword uses ────────────────────────────────────────────────────────────

test('a keyword use is judged where its scope is known and its scope data declares a requirement', () => {
    const { uses } = walk(
        DECISION,
        shown(
            'is_adult = yes\nexists = liege\nai_value_divergence = { }\nfaith = { has_doctrine = fixture_doctrine }\nscope:fixture_target = { is_adult = yes }',
        ),
    );
    assert.deepEqual(
        uses.map((u) => [u.name, u.verdict.judged ? u.verdict.fits : u.verdict.why]),
        [
            ['is_adult', true],
            ['exists', 'no-requirement'],
            ['ai_value_divergence', 'no-scope-data'],
            ['faith', 'scope-switch'],
            ['has_doctrine', true],
            ['is_adult', 'link-output'],
        ],
    );
});

// ─── Lessons from 2.3.0 (docs/MVP.md) ────────────────────────────────────────

test('lesson: `x = root` is a comparison, not a scope switch', () => {
    // If `primary_title = root` switched the scope, is_adult would be judged in a title.
    const text = shown('primary_title = root\nholder = root\nis_adult = yes');
    assert.deepEqual(
        checkText(DECISION, text).filter((f) => !isAdvice(f.code)),
        [],
    );
    const { uses, scopes } = walk(DECISION, text);
    assert.deepEqual(
        uses.filter((u) => u.name === 'is_adult').map((u) => u.verdict),
        [{ judged: true, current: 'character', expected: ['character'], fits: true }],
    );
    assert.deepEqual(scopes.links, []);
});

test('lesson: trait groups count as traits, and a trait group as data is a trait', () => {
    // `lunatic` is a group of traits (lunatic_1, lunatic_genetic), written as a trait.
    const text = shown(`has_trait = lunatic\ntrait:lunatic = { ${PROBE} = yes }`);
    assert.deepEqual(
        checkText(DECISION, text).filter((f) => f.code.startsWith('scope/')),
        [],
    );
    assert.deepEqual(probes(DECISION, text), ['trait/character']);
});

test('lesson: a colour value is not a call, and not a block of script', () => {
    const text = effect('primary_title = hsv { 0.5 0.5 0.5 }\nadd_gold = 5');
    assert.deepEqual(
        checkText(DECISION, text).filter((f) => !isAdvice(f.code)),
        [],
    );
    const { uses, scopes } = walk(DECISION, text);
    assert.deepEqual(scopes.links, []);
    assert.deepEqual(
        uses.map((u) => [u.name, u.verdict.judged && u.verdict.current]),
        [['add_gold', 'character']],
    );
});
