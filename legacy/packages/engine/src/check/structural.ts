/**
 * Structural keywords: names the trigger and effect readers accept that are in none of the
 * spec package's six buckets. Each entry says why it is structural and what context its
 * block body is read in. The lists are kept as short as the vanilla 1.20 corpus allows:
 * every entry is needed for vanilla 1.20.0.2 to check clean (see README.md).
 *
 *   trigger / effect  the body is a trigger or effect block
 *   same              the body keeps the surrounding context
 *   none              the body holds parameters or values, not triggers or effects
 */

export type ChildContext = 'trigger' | 'effect' | 'same' | 'none';

export interface StructuralKeyword {
    child: ChildContext;
    why: string;
}

/** Valid anywhere in a trigger or effect block. */
export const STRUCTURAL: ReadonlyMap<string, StructuralKeyword> = new Map<
    string,
    StructuralKeyword
>([
    ['limit', { child: 'trigger', why: 'filter block of iterators, if/else_if and while' }],
    ['alternative_limit', { child: 'trigger', why: 'fallback filter of iterators' }],
    ['AND', { child: 'trigger', why: 'logical operator of the trigger reader' }],
    ['OR', { child: 'trigger', why: 'logical operator of the trigger reader' }],
    ['NOT', { child: 'trigger', why: 'logical operator of the trigger reader' }],
    ['NOR', { child: 'trigger', why: 'logical operator of the trigger reader' }],
    ['NAND', { child: 'trigger', why: 'logical operator of the trigger reader' }],
    ['root', { child: 'same', why: 'scope reference to the top scope; not in the links bucket' }],
]);

export interface IteratorParam {
    /** '*' for every list, otherwise the list bases whose iterators read the parameter. */
    lists: '*' | readonly string[];
    why: string;
}

/**
 * Iterator parameters: keys read by the list iterators themselves (any_/every_/random_/
 * ordered_ + list), valid only as direct children of an iterator block. Each entry is a key
 * vanilla 1.20 writes directly inside those iterators that is in none of the six buckets.
 */
export const ITERATOR_PARAMS: ReadonlyMap<string, IteratorParam> = new Map<string, IteratorParam>([
    ['custom', { lists: '*', why: 'tooltip key describing the iteration' }],
    ['order_by', { lists: '*', why: 'ordered_ iterators: the script value to sort by' }],
    ['position', { lists: '*', why: 'ordered_ iterators: which ranked item to pick' }],
    ['check_range_bounds', { lists: '*', why: 'ordered_ iterators: fail when out of range' }],
    ['max', { lists: '*', why: 'ordered_/random_ iterators: at most this many items' }],
    ['min', { lists: '*', why: 'ordered_/random_ iterators: at least this many items' }],
    ['count', { lists: '*', why: 'any_ iterators: how many items must match' }],
    ['percent', { lists: '*', why: 'any_ iterators: share of items that must match' }],
    ['weight', { lists: '*', why: 'random_ iterators: the weight script value' }],
    ['even_if_dead', { lists: '*', why: 'family iterators: include dead characters' }],
    ['only_if_dead', { lists: '*', why: 'family/house iterators: dead characters only' }],
    ['list', { lists: ['in_list', 'in_local_list', 'in_global_list'], why: 'variable list name' }],
    ['variable', { lists: ['in_list', 'in_local_list', 'in_global_list'], why: 'variable list' }],
    ['name', { lists: ['guest_subset', 'guest_subset_current_phase'], why: 'guest subset name' }],
    ['phase', { lists: ['guest_subset', 'guest_subset_current_phase'], why: 'activity phase' }],
    ['involvement', { lists: ['character_struggle'], why: 'struggle involvement filter' }],
    ['title_tier', { lists: ['held_title'], why: 'held title tier filter' }],
    ['region', { lists: ['county_in_region'], why: 'geographical region to iterate' }],
    ['vassal_stance', { lists: ['vassal', 'vassal_or_below'], why: 'vassal stance filter' }],
    ['memory_type', { lists: ['memory'], why: 'character memory type filter' }],
    [
        'task_contract_type',
        {
            lists: ['character_active_contract', 'character_task_contract', 'task_contract'],
            why: 'task contract type filter',
        },
    ],
    ['continue', { lists: ['in_de_jure_hierarchy'], why: 'trigger: descend further or not' }],
    ['filter', { lists: ['in_de_jure_hierarchy'], why: 'trigger selecting the titles visited' }],
    [
        'knowledge_filter',
        { lists: ['character_tenet', 'character_doctrine'], why: 'learned-knowledge filter' },
    ],
    [
        'rite_filter',
        { lists: ['character_doctrine', 'character_tenet', 'rite_tenet'], why: 'rite filter' },
    ],
    [
        'faith_filter',
        { lists: ['character_doctrine', 'character_tenet', 'rite_tenet'], why: 'faith filter' },
    ],
    ['status', { lists: ['rite_tenet', 'character_tenet'], why: 'tenet status filter' }],
    ['selection_count', { lists: ['desired_tenet', 'undesired_tenet'], why: 'tenets to select' }],
    ['only_positive', { lists: ['desired_tenet', 'undesired_tenet'], why: 'tenet filter' }],
    ['only_negative', { lists: ['desired_tenet', 'undesired_tenet'], why: 'tenet filter' }],
    ['threshold', { lists: ['desired_tenet', 'undesired_tenet'], why: 'selection threshold' }],
    ['known_tenets', { lists: ['desired_tenet', 'undesired_tenet'], why: 'known tenets only' }],
    [
        'secret_owner',
        { lists: ['known_secret', 'secret', 'targeting_secret', 'in_list'], why: 'owner filter' },
    ],
    ['accolade_parameter', { lists: ['active_accolade'], why: 'accolade parameter filter' }],
    ['faction_type', { lists: ['targeting_faction'], why: 'faction type filter' }],
    [
        'intensity',
        { lists: ['province_epidemic', 'county_province_epidemic'], why: 'epidemic intensity' },
    ],
    ['pressed', { lists: ['claim'], why: 'pressed/unpressed claim filter' }],
    ['explicit', { lists: ['claim'], why: 'explicit/implicit claim filter' }],
    ['category', { lists: ['trait_in_category'], why: 'trait category to iterate' }],
    ['candidate', { lists: ['succession_appointment_investors'], why: 'candidate filter' }],
    ['max_naval_distance', { lists: ['connected_county'], why: 'sea-crossing distance limit' }],
    ['invert', { lists: ['connected_county'], why: 'invert the connection test' }],
    ['allow_one_county_land_gap', { lists: ['connected_county'], why: 'one-county gap allowed' }],
    ['court_position_type', { lists: ['court_position_candidate'], why: 'position to rank for' }],
]);

/**
 * Parameters of conditional modifier blocks (`culture_modifier = { parameter = x … }`,
 * `councillor_modifier = { name = … scale = … }`): keys a modifier block reads that are not
 * modifier types. Each is used so in vanilla 1.20.
 */
export const MODIFIER_BLOCK_PARAMS: ReadonlyMap<string, string> = new Map<string, string>([
    ['parameter', 'culture/rite parameter the block is conditional on'],
    ['scale', 'script value scaling the modifier'],
    ['name', 'loc key naming the scaled modifier'],
    ['flag', 'government flag the block is conditional on'],
    ['invert_check', 'apply when the condition is false'],
    ['doctrine', 'doctrine the block is conditional on'],
    ['county_holder_dynasty_perk', 'dynasty perk of the county holder the block is conditional on'],
]);
