/**
 * Symbol model of the workspace index (ported from the extension's core/indexer.ts).
 */

import { Range } from '../syntax/ast';

export interface IndexSymbol {
    name: string;
    type: SymbolType;
    uri: string;
    range: Range;
    detail?: string;
    documentation?: string;
}

export enum SymbolType {
    EVENT = 'event',
    DECISION = 'decision',
    CHARACTER_INTERACTION = 'character_interaction',
    ON_ACTION = 'on_action',
    SCRIPTED_EFFECT = 'scripted_effect',
    SCRIPTED_TRIGGER = 'scripted_trigger',
    /** Added in the engine: common/scripted_lists definitions (iterator bases). */
    SCRIPTED_LIST = 'scripted_list',
    /** Added in the engine: common/scripted_modifiers definitions. */
    SCRIPTED_MODIFIER = 'scripted_modifier',
    /** Added in the engine: common/modifier_definition_formats (script-declared modifier types). */
    MODIFIER_FORMAT = 'modifier_format',
    SCRIPT_VALUE = 'script_value',
    TRAIT = 'trait',
    CULTURE = 'culture',
    RELIGION = 'religion',
    TITLE = 'title',
    MODIFIER = 'modifier',
    VARIABLE = 'variable',
    SCOPE = 'scope',
    NAMESPACE = 'namespace',
    STORY_CYCLE = 'story_cycle',
    ACTIVITY = 'activity',
    SCHEME = 'scheme',
    CHARACTER_FLAG = 'character_flag',
    OPINION_MODIFIER = 'opinion_modifier',
    SCRIPTED_GUI = 'scripted_gui',
    DECISION_GROUP_TYPE = 'decision_group_type',
    GENERIC = 'generic',
}

/** What the call graph needs from an index. */
export interface SymbolLookup {
    findSymbolsByName(name: string): IndexSymbol[];
    findSymbolsByType(type: SymbolType): IndexSymbol[];
}

/** The extension's name for an index symbol. */
export type { IndexSymbol as Symbol };
