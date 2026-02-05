/**
 * CK3 Language Definitions - Effects, Triggers, Scopes, and other game constants
 * 
 * This module provides definitions for CK3 scripting language elements.
 * In a full implementation, this would load from YAML data files.
 */

export interface EffectDefinition {
    description?: string;
    documentation?: string;
    hasBlock?: boolean;
    parameters?: string[];
    scopes?: string[];
}

export interface TriggerDefinition {
    description?: string;
    documentation?: string;
    hasBlock?: boolean;
    parameters?: string[];
    scopes?: string[];
}

/**
 * CK3 Language static definitions
 */
export class CK3Language {
    /**
     * Get all CK3 effects
     */
    public static getEffects(): Record<string, EffectDefinition> {
        return {
            // Common effects (subset - full list would be loaded from YAML)
            'add_gold': {
                description: 'Add gold to character',
                hasBlock: false,
                scopes: ['character'],
            },
            'add_prestige': {
                description: 'Add prestige to character',
                hasBlock: false,
                scopes: ['character'],
            },
            'add_piety': {
                description: 'Add piety to character',
                hasBlock: false,
                scopes: ['character'],
            },
            'add_trait': {
                description: 'Add trait to character',
                hasBlock: false,
                scopes: ['character'],
            },
            'remove_trait': {
                description: 'Remove trait from character',
                hasBlock: false,
                scopes: ['character'],
            },
            'death': {
                description: 'Kill character',
                hasBlock: true,
                scopes: ['character'],
            },
            'save_scope_as': {
                description: 'Save current scope with a name',
                hasBlock: false,
            },
            'save_temporary_scope_as': {
                description: 'Save current scope temporarily',
                hasBlock: false,
            },
            'trigger_event': {
                description: 'Trigger an event',
                hasBlock: true,
            },
            'set_variable': {
                description: 'Set a variable',
                hasBlock: true,
            },
            'change_variable': {
                description: 'Change a variable value',
                hasBlock: true,
            },
            'add_opinion': {
                description: 'Add opinion modifier',
                hasBlock: true,
                scopes: ['character'],
            },
            'remove_opinion': {
                description: 'Remove opinion modifier',
                hasBlock: true,
                scopes: ['character'],
            },
            'start_war': {
                description: 'Start a war',
                hasBlock: true,
                scopes: ['character'],
            },
            'create_title': {
                description: 'Create a title',
                hasBlock: true,
            },
            'destroy_title': {
                description: 'Destroy a title',
                hasBlock: false,
                scopes: ['title'],
            },
        };
    }

    /**
     * Get all CK3 triggers
     */
    public static getTriggers(): Record<string, TriggerDefinition> {
        return {
            // Common triggers (subset - full list would be loaded from YAML)
            'has_trait': {
                description: 'Check if character has trait',
                hasBlock: false,
                scopes: ['character'],
            },
            'gold': {
                description: 'Compare character gold',
                hasBlock: false,
                scopes: ['character'],
            },
            'prestige': {
                description: 'Compare character prestige',
                hasBlock: false,
                scopes: ['character'],
            },
            'piety': {
                description: 'Compare character piety',
                hasBlock: false,
                scopes: ['character'],
            },
            'age': {
                description: 'Compare character age',
                hasBlock: false,
                scopes: ['character'],
            },
            'is_alive': {
                description: 'Check if character is alive',
                hasBlock: false,
                scopes: ['character'],
            },
            'is_ruler': {
                description: 'Check if character is a ruler',
                hasBlock: false,
                scopes: ['character'],
            },
            'is_at_war': {
                description: 'Check if character is at war',
                hasBlock: false,
                scopes: ['character'],
            },
            'has_variable': {
                description: 'Check if variable exists',
                hasBlock: false,
            },
            'any_vassal': {
                description: 'Check if any vassal matches conditions',
                hasBlock: true,
                scopes: ['character'],
            },
            'any_ally': {
                description: 'Check if any ally matches conditions',
                hasBlock: true,
                scopes: ['character'],
            },
            'OR': {
                description: 'Logical OR',
                hasBlock: true,
            },
            'AND': {
                description: 'Logical AND',
                hasBlock: true,
            },
            'NOT': {
                description: 'Logical NOT',
                hasBlock: true,
            },
            'NOR': {
                description: 'Logical NOR',
                hasBlock: true,
            },
            'NAND': {
                description: 'Logical NAND',
                hasBlock: true,
            },
        };
    }

    /**
     * Get all CK3 traits
     */
    public static getTraits(): string[] {
        return [
            // Personality traits
            'brave', 'craven', 'calm', 'wrathful', 'patient', 'impatient',
            'gregarious', 'shy', 'ambitious', 'content', 'arrogant', 'humble',
            'deceitful', 'honest', 'greedy', 'generous', 'vengeful', 'forgiving',
            'zealous', 'cynical', 'paranoid', 'trusting', 'compassionate', 'callous',
            'sadistic', 'stubborn', 'fickle', 'lustful', 'chaste', 'gluttonous',
            'temperate', 'lazy', 'diligent',
            
            // Education traits
            'education_diplomacy_1', 'education_diplomacy_2', 'education_diplomacy_3', 'education_diplomacy_4',
            'education_martial_1', 'education_martial_2', 'education_martial_3', 'education_martial_4',
            'education_stewardship_1', 'education_stewardship_2', 'education_stewardship_3', 'education_stewardship_4',
            'education_intrigue_1', 'education_intrigue_2', 'education_intrigue_3', 'education_intrigue_4',
            'education_learning_1', 'education_learning_2', 'education_learning_3', 'education_learning_4',
            
            // Childhood traits
            'bossy', 'rowdy', 'curious', 'pensive', 'charming', 'cautious',
            
            // Health traits
            'ill', 'wounded', 'maimed', 'infirm', 'incapable',
            'blind', 'one_eyed', 'disfigured', 'scarred',
            'physique_bad_1', 'physique_bad_2', 'physique_bad_3',
            'physique_good_1', 'physique_good_2', 'physique_good_3',
            'intellect_bad_1', 'intellect_bad_2', 'intellect_bad_3',
            'intellect_good_1', 'intellect_good_2', 'intellect_good_3',
            
            // Fame/lifestyle traits
            'lifestyle_blademaster', 'lifestyle_hunter', 'lifestyle_physician',
            'lifestyle_architect', 'lifestyle_strategist', 'lifestyle_gallant',
            'lifestyle_poet', 'lifestyle_mystic', 'lifestyle_herbalist',
        ];
    }

    /**
     * Get scope types
     */
    public static getScopeTypes(): string[] {
        return [
            'character',
            'title',
            'province',
            'faith',
            'culture',
            'dynasty',
            'house',
            'war',
            'secret',
            'scheme',
            'story',
            'artifact',
        ];
    }

    /**
     * Get scope accessors for a given scope type
     */
    public static getScopeAccessors(scopeType: string): string[] {
        switch (scopeType) {
            case 'character':
                return [
                    'liege', 'primary_title', 'capital_county',
                    'father', 'mother', 'primary_heir', 'spouse',
                    'faith', 'culture', 'house', 'dynasty',
                    'killer', 'employer', 'host',
                ];
            case 'title':
                return [
                    'holder', 'previous_holder', 'de_jure_liege',
                    'capital_county', 'barony',
                ];
            case 'province':
                return [
                    'county', 'title', 'holder', 'kingdom', 'empire',
                ];
            case 'faith':
                return [
                    'religious_head', 'holy_order',
                ];
            case 'culture':
                return [
                    'culture_head',
                ];
            default:
                return [];
        }
    }

    /**
     * Get event types
     */
    public static getEventTypes(): string[] {
        return [
            'character_event',
            'letter_event',
            'duel_event',
            'court_event',
            'empty',
        ];
    }

    /**
     * Get event themes
     */
    public static getEventThemes(): string[] {
        return [
            'court',
            'family',
            'realm',
            'war',
            'diplomacy',
            'intrigue',
            'stewardship',
            'learning',
            'martial',
            'education',
            'health',
            'imprisonment',
            'death',
            'religion',
            'culture',
            'vassal',
            'courtier',
        ];
    }

    /**
     * Get animation types
     */
    public static getAnimations(): string[] {
        return [
            'personality_rational',
            'personality_bold',
            'personality_callous',
            'personality_compassionate',
            'personality_content',
            'personality_greedy',
            'personality_honorable',
            'personality_vengeful',
            'personality_zealous',
            'grief',
            'shock',
            'sadness',
            'happiness',
            'fear',
            'anger',
            'disgust',
            'love',
            'schadenfreude',
        ];
    }

    /**
     * Check if a keyword is an effect
     */
    public static isEffect(keyword: string): boolean {
        return keyword in this.getEffects();
    }

    /**
     * Check if a keyword is a trigger
     */
    public static isTrigger(keyword: string): boolean {
        return keyword in this.getTriggers();
    }

    /**
     * Check if a keyword is a trait
     */
    public static isTrait(keyword: string): boolean {
        return this.getTraits().includes(keyword);
    }
}
