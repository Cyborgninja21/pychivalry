/**
 * Data Loader - Loads YAML data files for effects, triggers, scopes, traits, etc.
 * 
 * This module provides lazy-loading and caching of game data from YAML files.
 * Data is loaded on first access and cached for performance.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

/**
 * Effect definition from YAML
 */
export interface EffectDefinition {
    name: string;
    description?: string;
    parameters?: Record<string, string>;
    scope?: string;  // Required scope type
    target_scope?: string;  // Resulting scope type
    examples?: string[];
}

/**
 * Trigger definition from YAML
 */
export interface TriggerDefinition {
    name: string;
    description?: string;
    parameters?: Record<string, string>;
    scope?: string;
    return_type?: string;  // boolean, number, etc.
    examples?: string[];
}

/**
 * Scope definition from YAML
 */
export interface ScopeDefinition {
    name: string;
    description?: string;
    links?: Record<string, string>;  // scope_link -> target_scope
    lists?: string[];  // List iterator bases
}

/**
 * Trait definition from YAML
 */
export interface TraitDefinition {
    id: string;
    name?: string;
    category?: string;
    opposites?: string[];
    level?: number;
}

/**
 * Data loading and caching system
 */
export class DataLoader {
    private static instance: DataLoader;
    private dataPath: string;
    
    // Caches
    private effectsCache: Map<string, EffectDefinition> | null = null;
    private triggersCache: Map<string, TriggerDefinition> | null = null;
    private scopesCache: Map<string, ScopeDefinition> | null = null;
    private traitsCache: Map<string, TraitDefinition> | null = null;
    private animationsCache: Set<string> | null = null;
    private onActionsCache: Set<string> | null = null;
    
    private constructor(dataPath: string) {
        this.dataPath = dataPath;
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(dataPath?: string): DataLoader {
        if (!DataLoader.instance) {
            // Try to find data directory
            const possiblePaths = [
                dataPath || '',
                path.join(__dirname, '../../../../../pychivalry/data'),
                path.join(__dirname, '../../../../pychivalry/data'),
                path.join(__dirname, '../../../pychivalry/data'),
                path.join(process.cwd(), 'pychivalry/data'),
                path.join(process.cwd(), 'data'),
            ];
            
            let foundPath = '';
            for (const p of possiblePaths) {
                if (p && fs.existsSync(p)) {
                    foundPath = p;
                    console.log(`Found data directory at: ${p}`);
                    break;
                }
            }
            
            if (!foundPath) {
                console.warn('Data directory not found, using fallback data');
                foundPath = __dirname;  // Fallback
            }
            
            DataLoader.instance = new DataLoader(foundPath);
        }
        return DataLoader.instance;
    }
    
    /**
     * Load effects from YAML
     */
    public getEffects(): Map<string, EffectDefinition> {
        if (this.effectsCache) {
            return this.effectsCache;
        }
        
        this.effectsCache = new Map();
        
        try {
            const effectsFile = path.join(this.dataPath, 'effects/effects.yaml');
            if (fs.existsSync(effectsFile)) {
                const content = fs.readFileSync(effectsFile, 'utf8');
                const data = yaml.load(content) as any;
                
                if (data && data.effects) {
                    for (const effect of data.effects) {
                        this.effectsCache.set(effect.name, effect);
                    }
                    console.log(`Loaded ${this.effectsCache.size} effects from YAML`);
                }
            }
        } catch (error) {
            console.error('Failed to load effects:', error);
        }
        
        // Add fallback hardcoded effects if file not found
        if (this.effectsCache.size === 0) {
            this.addFallbackEffects();
            console.log('Using fallback effects');
        }
        
        return this.effectsCache;
    }
    
    /**
     * Load triggers from YAML
     */
    public getTriggers(): Map<string, TriggerDefinition> {
        if (this.triggersCache) {
            return this.triggersCache;
        }
        
        this.triggersCache = new Map();
        
        try {
            const triggersFile = path.join(this.dataPath, 'triggers/triggers.yaml');
            if (fs.existsSync(triggersFile)) {
                const content = fs.readFileSync(triggersFile, 'utf8');
                const data = yaml.load(content) as any;
                
                if (data && data.triggers) {
                    for (const trigger of data.triggers) {
                        this.triggersCache.set(trigger.name, trigger);
                    }
                    console.log(`Loaded ${this.triggersCache.size} triggers from YAML`);
                }
            }
        } catch (error) {
            console.error('Failed to load triggers:', error);
        }
        
        // Add fallback hardcoded triggers if file not found
        if (this.triggersCache.size === 0) {
            this.addFallbackTriggers();
            console.log('Using fallback triggers');
        }
        
        return this.triggersCache;
    }
    
    /**
     * Load scopes from YAML
     */
    public getScopes(): Map<string, ScopeDefinition> {
        if (this.scopesCache) {
            return this.scopesCache;
        }
        
        this.scopesCache = new Map();
        
        try {
            const scopeFiles = [
                'scopes/character.yaml',
                'scopes/title.yaml',
                'scopes/province.yaml',
            ];
            
            for (const file of scopeFiles) {
                const scopeFile = path.join(this.dataPath, file);
                if (fs.existsSync(scopeFile)) {
                    const content = fs.readFileSync(scopeFile, 'utf8');
                    const data = yaml.load(content) as any;
                    
                    if (data) {
                        this.scopesCache.set(data.name, data);
                    }
                }
            }
            
            if (this.scopesCache.size > 0) {
                console.log(`Loaded ${this.scopesCache.size} scopes from YAML`);
            }
        } catch (error) {
            console.error('Failed to load scopes:', error);
        }
        
        // Add fallback scopes if files not found
        if (this.scopesCache.size === 0) {
            this.addFallbackScopes();
            console.log('Using fallback scopes');
        }
        
        return this.scopesCache;
    }
    
    /**
     * Load traits from YAML
     */
    public getTraits(): Map<string, TraitDefinition> {
        if (this.traitsCache) {
            return this.traitsCache;
        }
        
        this.traitsCache = new Map();
        
        try {
            const traitFiles = [
                'traits/childhood.yaml',
                'traits/education.yaml',
                'traits/fame.yaml',
                'traits/health.yaml',
                'traits/lifestyle.yaml',
                'traits/personality.yaml',
                'traits/special.yaml',
            ];
            
            for (const file of traitFiles) {
                const traitFile = path.join(this.dataPath, file);
                if (fs.existsSync(traitFile)) {
                    const content = fs.readFileSync(traitFile, 'utf8');
                    const data = yaml.load(content) as any;
                    
                    if (data && Array.isArray(data)) {
                        for (const trait of data) {
                            this.traitsCache.set(trait.id, trait);
                        }
                    }
                }
            }
            
            if (this.traitsCache.size > 0) {
                console.log(`Loaded ${this.traitsCache.size} traits from YAML`);
            }
        } catch (error) {
            console.error('Failed to load traits:', error);
        }
        
        // Add fallback traits if files not found
        if (this.traitsCache.size === 0) {
            this.addFallbackTraits();
            console.log('Using fallback traits');
        }
        
        return this.traitsCache;
    }
    
    /**
     * Load animations
     */
    public getAnimations(): Set<string> {
        if (this.animationsCache) {
            return this.animationsCache;
        }
        
        this.animationsCache = new Set();
        
        try {
            const animFile = path.join(this.dataPath, 'animations.yaml');
            if (fs.existsSync(animFile)) {
                const content = fs.readFileSync(animFile, 'utf8');
                const data = yaml.load(content) as any;
                
                if (data && Array.isArray(data)) {
                    for (const anim of data) {
                        this.animationsCache.add(anim);
                    }
                    console.log(`Loaded ${this.animationsCache.size} animations from YAML`);
                }
            }
        } catch (error) {
            console.error('Failed to load animations:', error);
        }
        
        // Add fallback animations
        if (this.animationsCache.size === 0) {
            this.addFallbackAnimations();
            console.log('Using fallback animations');
        }
        
        return this.animationsCache;
    }
    
    /**
     * Load on-actions
     */
    public getOnActions(): Set<string> {
        if (this.onActionsCache) {
            return this.onActionsCache;
        }
        
        this.onActionsCache = new Set();
        
        try {
            const onActionsFile = path.join(this.dataPath, 'on_actions.yaml');
            if (fs.existsSync(onActionsFile)) {
                const content = fs.readFileSync(onActionsFile, 'utf8');
                const data = yaml.load(content) as any;
                
                if (data && Array.isArray(data)) {
                    for (const onAction of data) {
                        this.onActionsCache.add(onAction);
                    }
                    console.log(`Loaded ${this.onActionsCache.size} on-actions from YAML`);
                }
            }
        } catch (error) {
            console.error('Failed to load on-actions:', error);
        }
        
        // Add fallback on-actions
        if (this.onActionsCache.size === 0) {
            this.addFallbackOnActions();
            console.log('Using fallback on-actions');
        }
        
        return this.onActionsCache;
    }
    
    /**
     * Reload all data from files
     */
    public reload(): void {
        this.effectsCache = null;
        this.triggersCache = null;
        this.scopesCache = null;
        this.traitsCache = null;
        this.animationsCache = null;
        this.onActionsCache = null;
        console.log('Data cache cleared, will reload on next access');
    }
    
    // Fallback data methods
    
    private addFallbackEffects(): void {
        const fallbackEffects: EffectDefinition[] = [
            { name: 'add_gold', description: 'Add gold to character', scope: 'character' },
            { name: 'add_prestige', description: 'Add prestige to character', scope: 'character' },
            { name: 'add_piety', description: 'Add piety to character', scope: 'character' },
            { name: 'add_trait', description: 'Add trait to character', scope: 'character' },
            { name: 'remove_trait', description: 'Remove trait from character', scope: 'character' },
            { name: 'death', description: 'Kill character', scope: 'character' },
            { name: 'add_opinion', description: 'Modify opinion', scope: 'character' },
            { name: 'trigger_event', description: 'Trigger an event', scope: 'any' },
            { name: 'save_scope_as', description: 'Save current scope', scope: 'any' },
            { name: 'add_character_flag', description: 'Add character flag', scope: 'character' },
            { name: 'add_stress', description: 'Add stress', scope: 'character' },
            { name: 'add_tyranny', description: 'Add tyranny', scope: 'character' },
            { name: 'change_title_holder', description: 'Change title holder', scope: 'title' },
            { name: 'create_alliance', description: 'Create alliance', scope: 'character' },
            { name: 'start_war', description: 'Start a war', scope: 'character' },
        ];
        
        for (const effect of fallbackEffects) {
            this.effectsCache!.set(effect.name, effect);
        }
    }
    
    private addFallbackTriggers(): void {
        const fallbackTriggers: TriggerDefinition[] = [
            { name: 'is_adult', description: 'Character is adult (16+)', scope: 'character' },
            { name: 'is_alive', description: 'Character is alive', scope: 'character' },
            { name: 'is_ruler', description: 'Character is a ruler', scope: 'character' },
            { name: 'has_trait', description: 'Character has trait', scope: 'character' },
            { name: 'gold', description: 'Character gold amount', scope: 'character' },
            { name: 'prestige', description: 'Character prestige amount', scope: 'character' },
            { name: 'piety', description: 'Character piety amount', scope: 'character' },
            { name: 'age', description: 'Character age', scope: 'character' },
            { name: 'has_character_flag', description: 'Character has flag', scope: 'character' },
            { name: 'is_at_war', description: 'Character is at war', scope: 'character' },
            { name: 'is_landed', description: 'Character is landed', scope: 'character' },
            { name: 'is_imprisoned', description: 'Character is imprisoned', scope: 'character' },
            { name: 'dynasty', description: 'Dynasty ID', scope: 'character' },
            { name: 'culture', description: 'Culture ID', scope: 'character' },
            { name: 'faith', description: 'Faith ID', scope: 'character' },
        ];
        
        for (const trigger of fallbackTriggers) {
            this.triggersCache!.set(trigger.name, trigger);
        }
    }
    
    private addFallbackScopes(): void {
        const characterScope: ScopeDefinition = {
            name: 'character',
            description: 'Character scope',
            links: {
                'liege': 'character',
                'primary_title': 'title',
                'capital_province': 'province',
                'root': 'character',
                'employer': 'character',
                'host': 'character',
                'killer': 'character',
                'mother': 'character',
                'father': 'character',
            },
            lists: ['vassal', 'heir', 'child', 'spouse', 'sibling', 'courtier'],
        };
        
        const titleScope: ScopeDefinition = {
            name: 'title',
            description: 'Landed title scope',
            links: {
                'holder': 'character',
                'capital_county': 'title',
                'de_jure_liege': 'title',
                'previous_holder': 'character',
            },
            lists: ['vassal', 'de_jure_vassal', 'claim'],
        };
        
        const provinceScope: ScopeDefinition = {
            name: 'province',
            description: 'Province scope',
            links: {
                'county': 'title',
                'holder': 'character',
                'barony': 'title',
            },
            lists: ['neighboring_province'],
        };
        
        this.scopesCache!.set('character', characterScope);
        this.scopesCache!.set('title', titleScope);
        this.scopesCache!.set('province', provinceScope);
    }
    
    private addFallbackTraits(): void {
        const fallbackTraits: TraitDefinition[] = [
            { id: 'brave', name: 'Brave', category: 'personality' },
            { id: 'craven', name: 'Craven', category: 'personality', opposites: ['brave'] },
            { id: 'ambitious', name: 'Ambitious', category: 'personality' },
            { id: 'content', name: 'Content', category: 'personality', opposites: ['ambitious'] },
            { id: 'greedy', name: 'Greedy', category: 'personality' },
            { id: 'generous', name: 'Generous', category: 'personality', opposites: ['greedy'] },
            { id: 'wrathful', name: 'Wrathful', category: 'personality' },
            { id: 'calm', name: 'Calm', category: 'personality', opposites: ['wrathful'] },
            { id: 'genius', name: 'Genius', category: 'education' },
            { id: 'imbecile', name: 'Imbecile', category: 'education', opposites: ['genius'] },
            { id: 'quick', name: 'Quick', category: 'education' },
            { id: 'slow', name: 'Slow', category: 'education', opposites: ['quick'] },
            { id: 'shrewd', name: 'Shrewd', category: 'education' },
            { id: 'dull', name: 'Dull', category: 'education', opposites: ['shrewd'] },
        ];
        
        for (const trait of fallbackTraits) {
            this.traitsCache!.set(trait.id, trait);
        }
    }
    
    private addFallbackAnimations(): void {
        const animations = [
            'personality_bold', 'personality_cautious', 'personality_compassionate',
            'personality_rational', 'personality_gregarious', 'personality_honorable',
            'scheme', 'war', 'shock', 'fear', 'disgust', 'rage', 'happiness', 'sadness',
            'personality_vengeful', 'personality_forgiving', 'flirtation', 'boredom',
        ];
        
        for (const anim of animations) {
            this.animationsCache!.add(anim);
        }
    }
    
    private addFallbackOnActions(): void {
        const onActions = [
            'on_birth', 'on_death', 'on_marriage', 'on_divorce', 'on_declared_war',
            'on_peace_agreement', 'on_title_gain', 'on_title_loss', 'on_yearly_pulse',
            'on_monthly_pulse', 'on_5_year_pulse', 'on_raid_action',
        ];
        
        for (const onAction of onActions) {
            this.onActionsCache!.add(onAction);
        }
    }
}

// Export singleton getter
export function getDataLoader(): DataLoader {
    return DataLoader.getInstance();
}
