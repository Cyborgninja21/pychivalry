/**
 * CK3 Language Definitions - Data-driven keyword classification
 *
 * Provides isEffect()/isTrigger() for quick keyword classification in
 * semantic tokens, diagnostics, and validation. Sets are populated from
 * DataLoader YAML files at startup via initialize(). A small hardcoded
 * fallback covers the period before DataLoader is ready.
 */

/**
 * CK3 Language definitions with data-driven keyword sets
 */
export class CK3Language {
    /** Fallback effects used before DataLoader initializes */
    private static readonly FALLBACK_EFFECTS = new Set([
        'add_gold', 'add_prestige', 'add_piety', 'add_stress',
        'add_trait', 'remove_trait', 'death', 'save_scope_as',
        'save_temporary_scope_as', 'trigger_event', 'set_variable',
        'change_variable', 'add_opinion', 'remove_opinion', 'reverse_add_opinion',
        'start_war', 'create_title', 'destroy_title',
        'add_character_flag', 'remove_character_flag',
        'set_culture', 'set_faith', 'imprison', 'release_from_prison',
        'add_hook', 'use_hook', 'create_character', 'marry',
        'every_vassal', 'every_ally', 'every_child', 'every_courtier',
        'random_vassal', 'random_courtier', 'ordered_vassal',
        'if', 'else_if', 'else', 'switch', 'while',
        'random_list', 'weighted_random_list', 'hidden_effect', 'show_as_tooltip',
    ]);

    /** Fallback triggers used before DataLoader initializes */
    private static readonly FALLBACK_TRIGGERS = new Set([
        'has_trait', 'gold', 'prestige', 'piety', 'stress', 'age',
        'is_alive', 'is_ruler', 'is_at_war', 'is_imprisoned',
        'is_adult', 'has_variable', 'has_character_flag',
        'culture', 'faith', 'religion', 'has_perk',
        'any_vassal', 'any_ally', 'any_child', 'any_courtier',
        'any_spouse', 'any_realm_province',
        'OR', 'AND', 'NOT', 'NOR', 'NAND',
        'trigger_if', 'trigger_else_if', 'trigger_else',
        'has_claim_on', 'has_hook', 'is_female', 'is_male',
        'realm_size', 'num_of_vassals',
    ]);

    /** Active effect names — starts as fallback, replaced by data-driven set */
    private static effectNames: Set<string> = CK3Language.FALLBACK_EFFECTS;

    /** Active trigger names — starts as fallback, replaced by data-driven set */
    private static triggerNames: Set<string> = CK3Language.FALLBACK_TRIGGERS;

    /** Whether initialize() has been called */
    private static initialized = false;

    /**
     * Initialize keyword sets from DataLoader.
     * Call this after DataLoader is ready (e.g. in server.ts constructor).
     */
    public static initialize(effectKeys: Iterable<string>, triggerKeys: Iterable<string>): void {
        const effects = new Set(effectKeys);
        const triggers = new Set(triggerKeys);

        // Merge fallbacks to ensure core keywords are always present
        for (const name of CK3Language.FALLBACK_EFFECTS) effects.add(name);
        for (const name of CK3Language.FALLBACK_TRIGGERS) triggers.add(name);

        CK3Language.effectNames = effects;
        CK3Language.triggerNames = triggers;
        CK3Language.initialized = true;
    }

    /**
     * Whether the data-driven sets have been loaded
     */
    public static isInitialized(): boolean {
        return CK3Language.initialized;
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
            'court_event',
            'activity_event',
            'fullscreen_event',
            'duel_event',
            'feast_event',
            'story_cycle',
        ];
    }

    /**
     * Get event themes
     */
    public static getEventThemes(): string[] {
        return [
            'default', 'diplomacy', 'intrigue', 'martial', 'stewardship',
            'learning', 'seduction', 'temptation', 'romance', 'faith',
            'culture', 'war', 'death', 'dread', 'dungeon', 'feast',
            'hunt', 'travel', 'pet', 'friendly', 'unfriendly',
            'healthcare', 'physical_health', 'mental_health', 'childhood',
            'pregnancy', 'family', 'realm', 'vassal', 'courtier', 'liege', 'tax',
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

    /** Logical operators — subset of triggers that deserve distinct highlighting */
    private static readonly LOGICAL_OPERATORS = new Set([
        'AND', 'OR', 'NOT', 'NOR', 'NAND',
    ]);

    /**
     * Check if a keyword is an effect
     */
    public static isEffect(keyword: string): boolean {
        return this.effectNames.has(keyword);
    }

    /**
     * Check if a keyword is a trigger
     */
    public static isTrigger(keyword: string): boolean {
        return this.triggerNames.has(keyword);
    }

    /**
     * Check if a keyword is a logical operator (AND, OR, NOT, NOR, NAND)
     */
    public static isLogicalOperator(keyword: string): boolean {
        return this.LOGICAL_OPERATORS.has(keyword);
    }

    /**
     * Check if a keyword is a trait
     */
    public static isTrait(keyword: string): boolean {
        return this.getTraits().includes(keyword);
    }
}
