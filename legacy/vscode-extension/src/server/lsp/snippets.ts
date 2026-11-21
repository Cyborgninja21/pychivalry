/**
 * Hand-written snippet tables of the editor features (Phase 4).
 *
 * These are editing conveniences, not CK3 vocabulary: which names exist, where they are
 * valid and what they mean comes from the engine's spec package. The snippets the scraped
 * keyword YAML carried (`snippet:` keys on triggers and effects) are gone with that data.
 *
 * - KEYWORD_SNIPPETS: block bodies for the structural keywords (the engine's STRUCTURAL
 *   set) and the trigger/effect containers whose body is itself a trigger or effect block.
 * - RECORD_TEMPLATES: whole-record templates offered at the top level of a file, keyed by
 *   the spec directory the file is in.
 */

export interface Snippet {
    label: string;
    detail: string;
    body: string;
}

/** Keyword → block snippet (insert text in VS Code snippet syntax). */
export const KEYWORD_SNIPPETS: ReadonlyMap<string, string> = new Map([
    ['limit', 'limit = {\n\t$0\n}'],
    ['alternative_limit', 'alternative_limit = {\n\t$0\n}'],
    ['AND', 'AND = {\n\t$0\n}'],
    ['OR', 'OR = {\n\t$0\n}'],
    ['NOT', 'NOT = { $0 }'],
    ['NOR', 'NOR = {\n\t$0\n}'],
    ['NAND', 'NAND = {\n\t$0\n}'],
    ['if', 'if = {\n\tlimit = {\n\t\t$1\n\t}\n\t$0\n}'],
    ['else_if', 'else_if = {\n\tlimit = {\n\t\t$1\n\t}\n\t$0\n}'],
    ['else', 'else = {\n\t$0\n}'],
    ['trigger_if', 'trigger_if = {\n\tlimit = {\n\t\t$1\n\t}\n\t$0\n}'],
    ['trigger_else_if', 'trigger_else_if = {\n\tlimit = {\n\t\t$1\n\t}\n\t$0\n}'],
    ['trigger_else', 'trigger_else = {\n\t$0\n}'],
    ['switch', 'switch = {\n\ttrigger = ${1:trigger}\n\t${2:value} = {\n\t\t$0\n\t}\n}'],
    ['random_list', 'random_list = {\n\t${1:50} = {\n\t\t$2\n\t}\n\t${3:50} = {\n\t\t$0\n\t}\n}'],
    ['hidden_effect', 'hidden_effect = {\n\t$0\n}'],
    ['while', 'while = {\n\tlimit = {\n\t\t$1\n\t}\n\t$0\n}'],
]);

const EVENT_TEMPLATE =
    'namespace = ${1:my_namespace}\n\n' +
    '${1:my_namespace}.${2:0001} = {\n' +
    '\ttype = ${3:character_event}\n' +
    '\ttitle = ${1:my_namespace}.${2:0001}.t\n' +
    '\tdesc = ${1:my_namespace}.${2:0001}.desc\n' +
    '\n' +
    '\ttrigger = {\n' +
    '\t\t${4}\n' +
    '\t}\n' +
    '\n' +
    '\timmediate = {\n' +
    '\t\t${5}\n' +
    '\t}\n' +
    '\n' +
    '\toption = {\n' +
    '\t\tname = ${1:my_namespace}.${2:0001}.a\n' +
    '\t\t${0}\n' +
    '\t}\n' +
    '}\n';

const DECISION_TEMPLATE =
    '${1:my_decision} = {\n' +
    '\tis_shown = {\n' +
    '\t\t${2}\n' +
    '\t}\n' +
    '\n' +
    '\tis_valid = {\n' +
    '\t\t${3}\n' +
    '\t}\n' +
    '\n' +
    '\teffect = {\n' +
    '\t\t${4}\n' +
    '\t}\n' +
    '\n' +
    '\tai_check_interval = ${5:120}\n' +
    '\tai_will_do = {\n' +
    '\t\tbase = ${0:0}\n' +
    '\t}\n' +
    '}';

const STORY_CYCLE_TEMPLATE =
    '${1:my_story_cycle} = {\n' +
    '\ton_setup = {\n' +
    '\t\t${2}\n' +
    '\t}\n' +
    '\n' +
    '\ton_end = {\n' +
    '\t\t${3}\n' +
    '\t}\n' +
    '\n' +
    '\ton_owner_death = {\n' +
    '\t\tend_story = yes\n' +
    '\t}\n' +
    '\n' +
    '\teffect_group = {\n' +
    '\t\tdays = { ${4:30} ${5:60} }\n' +
    '\t\ttriggered_effect = {\n' +
    '\t\t\ttrigger = {\n' +
    '\t\t\t\t${6}\n' +
    '\t\t\t}\n' +
    '\t\t\teffect = {\n' +
    '\t\t\t\t${0}\n' +
    '\t\t\t}\n' +
    '\t\t}\n' +
    '\t}\n' +
    '}';

/** Spec directory → record templates offered at the top level of its files. */
export const RECORD_TEMPLATES: ReadonlyMap<string, readonly Snippet[]> = new Map([
    ['events', [{ label: 'event_template', detail: 'Event record', body: EVENT_TEMPLATE }]],
    [
        'common/decisions',
        [{ label: 'decision_template', detail: 'Decision record', body: DECISION_TEMPLATE }],
    ],
    [
        'common/story_cycles',
        [
            {
                label: 'story_cycle_template',
                detail: 'Story cycle record',
                body: STORY_CYCLE_TEMPLATE,
            },
        ],
    ],
]);

/** Snippet for a field or keyword that opens a block (`key = {\n\t$0\n}`). */
export function blockSnippet(key: string): string {
    return KEYWORD_SNIPPETS.get(key) ?? `${key} = {\n\t$0\n}`;
}
