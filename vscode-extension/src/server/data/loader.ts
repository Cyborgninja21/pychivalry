/**
 * Data Loader - Loads YAML data files for effects, triggers, scopes, traits, etc.
 * 
 * This module provides lazy-loading and caching of game data from YAML files.
 * Data is loaded on first access and cached for performance.
 */

import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { serverLogger } from '../utils/logger';

/**
 * Effect definition from YAML
 */
export interface EffectDefinition {
    name: string;
    description?: string;
    detail?: string;
    snippet?: string;
    parameters?: Record<string, string>;
    scope?: string;  // Required scope type (singular, for backwards compat)
    scopes?: string[];  // Required scope types (array from YAML)
    target_scope?: string;  // Resulting scope type
    example?: string;
    examples?: string[];
}

/**
 * Trigger definition from YAML
 */
export interface TriggerDefinition {
    name: string;
    description?: string;
    detail?: string;
    snippet?: string;
    parameters?: Record<string, string>;
    scope?: string;  // Required scope type (singular, for backwards compat)
    scopes?: string[];  // Required scope types (array from YAML)
    return_type?: string;  // boolean, number, etc.
    example?: string;
    examples?: string[];
}

/**
 * On-action definition from YAML
 */
export interface OnActionDefinition {
    name: string;
    description?: string;
    scopes?: Record<string, string>;  // e.g., { root: 'character', actor: 'character' }
    events?: Array<string | { event: string; weight?: number }>;
    has_trigger?: boolean;
    has_effect?: boolean;
    is_pulse?: boolean;
}

/**
 * Interaction hook definition from YAML
 */
export interface InteractionHookDefinition {
    name: string;
    description?: string;
    scopes?: Record<string, string>;
}

/**
 * Scope definition from YAML
 */
export interface ScopeDefinition {
    name: string;
    description?: string;
    links?: Record<string, string>;  // scope_link -> target_scope_type
    lists?: Record<string, string> | string[];  // list_base -> result_scope_type (or legacy array)
    triggers?: string[];
    effects?: string[];
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
 * Game concept definition from YAML
 */
export interface ConceptDefinition {
    name: string;
    text?: string;
    source?: string;
}

/**
 * Icon definition from YAML
 */
export interface IconDefinition {
    name: string;
    category?: string;
    description?: string;
    reference?: string;
}

/**
 * Mod definition from YAML
 */
export interface ModDefinition {
    id: string;
    display_name?: string;
    description?: string;
    identifiers?: {
        descriptor_patterns?: string[];
        folder_patterns?: string[];
    };
}

/**
 * Data loading and caching system
 */
export class DataLoader {
    private static instance: DataLoader;
    private dataPath: string;
    private initialized = false;
    
    // Caches
    private effectsCache: Map<string, EffectDefinition> | null = null;
    private triggersCache: Map<string, TriggerDefinition> | null = null;
    private scopesCache: Map<string, ScopeDefinition> | null = null;
    private traitsCache: Map<string, TraitDefinition> | null = null;
    private animationsCache: Set<string> | null = null;
    private onActionsCache: Map<string, OnActionDefinition> | null = null;
    private conceptsCache: Map<string, ConceptDefinition> | null = null;
    private iconsCache: Map<string, IconDefinition> | null = null;
    private modsCache: Map<string, ModDefinition> | null = null;
    private interactionHooksCache: Map<string, InteractionHookDefinition> | null = null;
    
    private constructor(dataPath: string) {
        this.dataPath = dataPath;
    }
    
    /**
     * Get singleton instance (sync — call initialize() once at startup for async I/O)
     */
    public static getInstance(dataPath?: string): DataLoader {
        if (!DataLoader.instance) {
            DataLoader.instance = new DataLoader(dataPath || __dirname);
        }
        return DataLoader.instance;
    }

    /**
     * Async initialization — resolves the data directory and preloads all caches.
     * Call once during server startup before any getters are used.
     */
    public async initialize(dataPath?: string): Promise<void> {
        if (this.initialized) return;

        const possiblePaths = [
            dataPath || '',
            path.join(__dirname, 'data'),
            path.join(__dirname, '..', 'data'),
            path.join(__dirname, '../../../../../data'),
            path.join(__dirname, '../../../../data'),
            path.join(__dirname, '../../../data'),
            path.join(process.cwd(), 'data'),
        ];

        for (const p of possiblePaths) {
            if (!p) continue;
            try {
                await fsp.access(p);
                const entries = await fsp.readdir(p);
                if (entries.length > 0) {
                    this.dataPath = p;
                    serverLogger.log(`Found data directory at: ${p}`);
                    break;
                }
            } catch {
                // Skip unreadable paths
            }
        }

        if (this.dataPath === __dirname) {
            serverLogger.warn('Data directory not found, using comprehensive fallback data');
        }

        // Preload all data asynchronously
        await this.preloadAll();
        this.initialized = true;
    }

    /**
     * Preload all data caches using async I/O
     */
    private async preloadAll(): Promise<void> {
        await Promise.all([
            this.loadEffectsAsync(),
            this.loadTriggersAsync(),
            this.loadScopesAsync(),
            this.loadTraitsAsync(),
            this.loadAnimationsAsync(),
            this.loadOnActionsAsync(),
            this.loadConceptsAsync(),
            this.loadIconsAsync(),
            this.loadModsAsync(),
            this.loadInteractionHooksAsync(),
        ]);
    }

    private async loadYamlFile(filePath: string): Promise<any> {
        try {
            await fsp.access(filePath);
            const content = await fsp.readFile(filePath, 'utf8');
            return yaml.load(content);
        } catch {
            return null;
        }
    }

    private async loadEffectsAsync(): Promise<void> {
        this.effectsCache = new Map();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'effects/effects.yaml'));
        if (data?.effects && typeof data.effects === 'object') {
            for (const [name, info] of Object.entries(data.effects as Record<string, any>)) {
                this.effectsCache.set(name, { name, ...info });
            }
            serverLogger.log(`Loaded ${this.effectsCache.size} effects from YAML`);
        }
        if (this.effectsCache.size === 0) this.addFallbackEffects();
    }

    private async loadTriggersAsync(): Promise<void> {
        this.triggersCache = new Map();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'triggers/triggers.yaml'));
        if (data?.triggers && typeof data.triggers === 'object') {
            for (const [name, info] of Object.entries(data.triggers as Record<string, any>)) {
                this.triggersCache.set(name, { name, ...info });
            }
            serverLogger.log(`Loaded ${this.triggersCache.size} triggers from YAML`);
        }
        if (this.triggersCache.size === 0) this.addFallbackTriggers();
    }

    private async loadScopesAsync(): Promise<void> {
        this.scopesCache = new Map();
        const scopeDir = path.join(this.dataPath, 'scopes');
        try {
            const files = await fsp.readdir(scopeDir);
            for (const file of files.filter(f => f.endsWith('.yaml'))) {
                const data = await this.loadYamlFile(path.join(scopeDir, file));
                if (data && typeof data === 'object') {
                    const scopeName = Object.keys(data)[0];
                    if (scopeName) {
                        this.scopesCache.set(scopeName, { name: scopeName, ...data[scopeName] });
                    }
                }
            }
        } catch {
            // Scope directory not found
        }
        if (this.scopesCache.size === 0) this.addFallbackScopes();
        else serverLogger.log(`Loaded ${this.scopesCache.size} scopes from YAML`);
    }

    private async loadTraitsAsync(): Promise<void> {
        this.traitsCache = new Map();
        const traitFiles = [
            'traits/childhood.yaml', 'traits/education.yaml', 'traits/fame.yaml',
            'traits/health.yaml', 'traits/lifestyle.yaml', 'traits/personality.yaml',
            'traits/special.yaml',
        ];
        for (const file of traitFiles) {
            const data = await this.loadYamlFile(path.join(this.dataPath, file));
            if (data && Array.isArray(data)) {
                for (const trait of data) this.traitsCache.set(trait.id, trait);
            }
        }
        if (this.traitsCache.size === 0) this.addFallbackTraits();
        else serverLogger.log(`Loaded ${this.traitsCache.size} traits from YAML`);
    }

    private async loadAnimationsAsync(): Promise<void> {
        this.animationsCache = new Set();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'animations.yaml'));
        if (data && Array.isArray(data)) {
            for (const anim of data) this.animationsCache.add(anim);
            serverLogger.log(`Loaded ${this.animationsCache.size} animations from YAML`);
        }
        if (this.animationsCache.size === 0) this.addFallbackAnimations();
    }

    private async loadOnActionsAsync(): Promise<void> {
        this.onActionsCache = new Map();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'on_actions.yaml'));
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            for (const [name, info] of Object.entries(data as Record<string, any>)) {
                if (name === 'version') continue;  // Skip metadata fields
                this.onActionsCache.set(name, { name, ...info });
            }
            serverLogger.log(`Loaded ${this.onActionsCache.size} on-actions from YAML`);
        }
        if (this.onActionsCache.size === 0) this.addFallbackOnActions();
    }

    private async loadInteractionHooksAsync(): Promise<void> {
        this.interactionHooksCache = new Map();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'interaction_hooks.yaml'));
        if (data?.hooks && typeof data.hooks === 'object') {
            for (const [name, info] of Object.entries(data.hooks as Record<string, any>)) {
                this.interactionHooksCache.set(name, { name, ...info });
            }
            serverLogger.log(`Loaded ${this.interactionHooksCache.size} interaction hooks from YAML`);
        }
    }

    private async loadConceptsAsync(): Promise<void> {
        this.conceptsCache = new Map();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'concepts/concepts.yaml'));
        if (data && typeof data === 'object') {
            for (const [name, info] of Object.entries(data as Record<string, any>)) {
                this.conceptsCache.set(name, { name, text: info?.text, source: info?.source });
            }
            serverLogger.log(`Loaded ${this.conceptsCache.size} concepts from YAML`);
        }
    }

    private async loadIconsAsync(): Promise<void> {
        this.iconsCache = new Map();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'icons/icons.yaml'));
        if (data && typeof data === 'object') {
            for (const [name, info] of Object.entries(data as Record<string, any>)) {
                this.iconsCache.set(name, { name, category: info?.category, description: info?.description, reference: info?.reference });
            }
            serverLogger.log(`Loaded ${this.iconsCache.size} icons from YAML`);
        }
    }

    private async loadModsAsync(): Promise<void> {
        this.modsCache = new Map();
        const data = await this.loadYamlFile(path.join(this.dataPath, 'mods/mod_registry.yaml'));
        if (data?.mods && typeof data.mods === 'object') {
            for (const [id, info] of Object.entries(data.mods as Record<string, any>)) {
                this.modsCache.set(id, { id, display_name: info?.display_name, description: info?.description, identifiers: info?.identifiers });
            }
            serverLogger.log(`Loaded ${this.modsCache.size} mod definitions from registry`);
        }
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

                if (data && data.effects && typeof data.effects === 'object') {
                    for (const [name, info] of Object.entries(data.effects as Record<string, any>)) {
                        this.effectsCache.set(name, { name, ...info });
                    }
                    serverLogger.log(`Loaded ${this.effectsCache.size} effects from YAML`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load effects:', error);
        }

        // Add fallback hardcoded effects if file not found
        if (this.effectsCache.size === 0) {
            this.addFallbackEffects();
            serverLogger.log('Using fallback effects');
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

                if (data && data.triggers && typeof data.triggers === 'object') {
                    for (const [name, info] of Object.entries(data.triggers as Record<string, any>)) {
                        this.triggersCache.set(name, { name, ...info });
                    }
                    serverLogger.log(`Loaded ${this.triggersCache.size} triggers from YAML`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load triggers:', error);
        }

        // Add fallback hardcoded triggers if file not found
        if (this.triggersCache.size === 0) {
            this.addFallbackTriggers();
            serverLogger.log('Using fallback triggers');
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
            const scopeDir = path.join(this.dataPath, 'scopes');
            if (fs.existsSync(scopeDir)) {
                const files = fs.readdirSync(scopeDir).filter(f => f.endsWith('.yaml'));
                for (const file of files) {
                    const content = fs.readFileSync(path.join(scopeDir, file), 'utf8');
                    const data = yaml.load(content) as any;
                    if (data && typeof data === 'object') {
                        const scopeName = Object.keys(data)[0];
                        if (scopeName) {
                            this.scopesCache.set(scopeName, { name: scopeName, ...data[scopeName] });
                        }
                    }
                }
            }

            if (this.scopesCache.size > 0) {
                serverLogger.log(`Loaded ${this.scopesCache.size} scopes from YAML`);
            }
        } catch (error) {
            serverLogger.error('Failed to load scopes:', error);
        }

        // Add fallback scopes if files not found
        if (this.scopesCache.size === 0) {
            this.addFallbackScopes();
            serverLogger.log('Using fallback scopes');
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
                serverLogger.log(`Loaded ${this.traitsCache.size} traits from YAML`);
            }
        } catch (error) {
            serverLogger.error('Failed to load traits:', error);
        }
        
        // Add fallback traits if files not found
        if (this.traitsCache.size === 0) {
            this.addFallbackTraits();
            serverLogger.log('Using fallback traits');
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
                    serverLogger.log(`Loaded ${this.animationsCache.size} animations from YAML`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load animations:', error);
        }
        
        // Add fallback animations
        if (this.animationsCache.size === 0) {
            this.addFallbackAnimations();
            serverLogger.log('Using fallback animations');
        }
        
        return this.animationsCache;
    }
    
    /**
     * Load on-actions
     */
    public getOnActions(): Map<string, OnActionDefinition> {
        if (this.onActionsCache) {
            return this.onActionsCache;
        }

        this.onActionsCache = new Map();

        try {
            const onActionsFile = path.join(this.dataPath, 'on_actions.yaml');
            if (fs.existsSync(onActionsFile)) {
                const content = fs.readFileSync(onActionsFile, 'utf8');
                const data = yaml.load(content) as any;

                if (data && typeof data === 'object' && !Array.isArray(data)) {
                    for (const [name, info] of Object.entries(data as Record<string, any>)) {
                        if (name === 'version') continue;
                        this.onActionsCache.set(name, { name, ...info });
                    }
                    serverLogger.log(`Loaded ${this.onActionsCache.size} on-actions from YAML`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load on-actions:', error);
        }

        // Add fallback on-actions
        if (this.onActionsCache.size === 0) {
            this.addFallbackOnActions();
            serverLogger.log('Using fallback on-actions');
        }

        return this.onActionsCache;
    }

    /**
     * Load interaction hooks
     */
    public getInteractionHooks(): Map<string, InteractionHookDefinition> {
        if (this.interactionHooksCache) {
            return this.interactionHooksCache;
        }

        this.interactionHooksCache = new Map();

        try {
            const hooksFile = path.join(this.dataPath, 'interaction_hooks.yaml');
            if (fs.existsSync(hooksFile)) {
                const content = fs.readFileSync(hooksFile, 'utf8');
                const data = yaml.load(content) as any;

                if (data?.hooks && typeof data.hooks === 'object') {
                    for (const [name, info] of Object.entries(data.hooks as Record<string, any>)) {
                        this.interactionHooksCache.set(name, { name, ...info });
                    }
                    serverLogger.log(`Loaded ${this.interactionHooksCache.size} interaction hooks from YAML`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load interaction hooks:', error);
        }

        return this.interactionHooksCache;
    }

    /**
     * Load game concepts from YAML
     */
    public getConcepts(): Map<string, ConceptDefinition> {
        if (this.conceptsCache) {
            return this.conceptsCache;
        }

        this.conceptsCache = new Map();

        try {
            const conceptsFile = path.join(this.dataPath, 'concepts/concepts.yaml');
            if (fs.existsSync(conceptsFile)) {
                const content = fs.readFileSync(conceptsFile, 'utf8');
                const data = yaml.load(content) as Record<string, any>;

                if (data && typeof data === 'object') {
                    for (const [name, info] of Object.entries(data)) {
                        this.conceptsCache.set(name, {
                            name,
                            text: info?.text,
                            source: info?.source,
                        });
                    }
                    serverLogger.log(`Loaded ${this.conceptsCache.size} concepts from YAML`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load concepts:', error);
        }

        return this.conceptsCache;
    }

    /**
     * Load icon definitions from YAML
     */
    public getIcons(): Map<string, IconDefinition> {
        if (this.iconsCache) {
            return this.iconsCache;
        }

        this.iconsCache = new Map();

        try {
            const iconsFile = path.join(this.dataPath, 'icons/icons.yaml');
            if (fs.existsSync(iconsFile)) {
                const content = fs.readFileSync(iconsFile, 'utf8');
                const data = yaml.load(content) as Record<string, any>;

                if (data && typeof data === 'object') {
                    for (const [name, info] of Object.entries(data)) {
                        this.iconsCache.set(name, {
                            name,
                            category: info?.category,
                            description: info?.description,
                            reference: info?.reference,
                        });
                    }
                    serverLogger.log(`Loaded ${this.iconsCache.size} icons from YAML`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load icons:', error);
        }

        return this.iconsCache;
    }

    /**
     * Load mod registry from YAML
     */
    public getMods(): Map<string, ModDefinition> {
        if (this.modsCache) {
            return this.modsCache;
        }

        this.modsCache = new Map();

        try {
            const modsFile = path.join(this.dataPath, 'mods/mod_registry.yaml');
            if (fs.existsSync(modsFile)) {
                const content = fs.readFileSync(modsFile, 'utf8');
                const data = yaml.load(content) as any;

                if (data && data.mods && typeof data.mods === 'object') {
                    for (const [id, info] of Object.entries(data.mods as Record<string, any>)) {
                        this.modsCache.set(id, {
                            id,
                            display_name: info?.display_name,
                            description: info?.description,
                            identifiers: info?.identifiers,
                        });
                    }
                    serverLogger.log(`Loaded ${this.modsCache.size} mod definitions from registry`);
                }
            }
        } catch (error) {
            serverLogger.error('Failed to load mod registry:', error);
        }

        return this.modsCache;
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
        this.conceptsCache = null;
        this.iconsCache = null;
        this.modsCache = null;
        this.interactionHooksCache = null;
        serverLogger.log('Data cache cleared, will reload on next access');
    }
    
    // Fallback data methods
    
    private addFallbackEffects(): void {
        const fallbackEffects: EffectDefinition[] = [
            // Character effects
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
            { name: 'remove_character_flag', description: 'Remove character flag', scope: 'character' },
            { name: 'add_stress', description: 'Add stress', scope: 'character' },
            { name: 'add_tyranny', description: 'Add tyranny', scope: 'character' },
            { name: 'change_title_holder', description: 'Change title holder', scope: 'title' },
            { name: 'create_alliance', description: 'Create alliance', scope: 'character' },
            { name: 'start_war', description: 'Start a war', scope: 'character' },
            { name: 'imprison', description: 'Imprison a character', scope: 'character' },
            { name: 'release_from_prison', description: 'Release from prison', scope: 'character' },
            { name: 'add_dread', description: 'Add dread', scope: 'character' },
            { name: 'add_dynasty_prestige', description: 'Add dynasty prestige', scope: 'character' },
            { name: 'set_variable', description: 'Set a variable', scope: 'any' },
            { name: 'set_local_variable', description: 'Set a local variable', scope: 'any' },
            { name: 'set_global_variable', description: 'Set a global variable', scope: 'any' },
            { name: 'change_variable', description: 'Change a variable value', scope: 'any' },
            { name: 'add_character_modifier', description: 'Add character modifier', scope: 'character' },
            { name: 'remove_character_modifier', description: 'Remove character modifier', scope: 'character' },
            { name: 'add_claim', description: 'Add claim on title', scope: 'character' },
            { name: 'remove_claim', description: 'Remove claim on title', scope: 'character' },
            { name: 'marry', description: 'Arrange marriage', scope: 'character' },
            { name: 'add_hook', description: 'Add hook on character', scope: 'character' },
            { name: 'remove_hook', description: 'Remove hook', scope: 'character' },
            { name: 'add_secret', description: 'Add a secret', scope: 'character' },
            { name: 'create_character', description: 'Create a new character', scope: 'any' },
            { name: 'spawn_army', description: 'Spawn an army', scope: 'character' },
            { name: 'give_title', description: 'Give title to character', scope: 'character' },
            { name: 'revoke_title', description: 'Revoke title from holder', scope: 'character' },
            { name: 'add_martial_lifestyle_xp', description: 'Add martial lifestyle XP', scope: 'character' },
            { name: 'add_diplomacy_lifestyle_xp', description: 'Add diplomacy lifestyle XP', scope: 'character' },
            { name: 'add_stewardship_lifestyle_xp', description: 'Add stewardship lifestyle XP', scope: 'character' },
            { name: 'add_intrigue_lifestyle_xp', description: 'Add intrigue lifestyle XP', scope: 'character' },
            { name: 'add_learning_lifestyle_xp', description: 'Add learning lifestyle XP', scope: 'character' },
            // Scope effects
            { name: 'random_list', description: 'Weighted random selection', scope: 'any' },
            { name: 'if', description: 'Conditional block', scope: 'any' },
            { name: 'else', description: 'Else block', scope: 'any' },
            { name: 'else_if', description: 'Else-if block', scope: 'any' },
            { name: 'switch', description: 'Switch block', scope: 'any' },
            { name: 'while', description: 'While loop', scope: 'any' },
            // Iterator effects
            { name: 'every_vassal', description: 'Iterate over all vassals', scope: 'character' },
            { name: 'random_vassal', description: 'Random vassal', scope: 'character' },
            { name: 'any_vassal', description: 'Check any vassal', scope: 'character' },
            { name: 'every_child', description: 'Iterate over all children', scope: 'character' },
            { name: 'random_child', description: 'Random child', scope: 'character' },
            { name: 'every_spouse', description: 'Iterate over all spouses', scope: 'character' },
            { name: 'every_courtier', description: 'Iterate over all courtiers', scope: 'character' },
            { name: 'random_courtier', description: 'Random courtier', scope: 'character' },
        ];

        for (const effect of fallbackEffects) {
            this.effectsCache!.set(effect.name, effect);
        }
    }
    
    private addFallbackTriggers(): void {
        const fallbackTriggers: TriggerDefinition[] = [
            // Character state triggers
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
            // Additional character triggers
            { name: 'exists', description: 'Scope exists', scope: 'any' },
            { name: 'is_female', description: 'Character is female', scope: 'character' },
            { name: 'is_male', description: 'Character is male', scope: 'character' },
            { name: 'is_married', description: 'Character is married', scope: 'character' },
            { name: 'has_religion', description: 'Character has religion', scope: 'character' },
            { name: 'has_culture', description: 'Character has culture', scope: 'character' },
            { name: 'has_claim_on', description: 'Character has claim on title', scope: 'character' },
            { name: 'has_hook', description: 'Has hook on character', scope: 'character' },
            { name: 'has_opinion_modifier', description: 'Has opinion modifier', scope: 'character' },
            { name: 'has_character_modifier', description: 'Has character modifier', scope: 'character' },
            { name: 'diplomacy', description: 'Diplomacy skill', scope: 'character' },
            { name: 'martial', description: 'Martial skill', scope: 'character' },
            { name: 'stewardship', description: 'Stewardship skill', scope: 'character' },
            { name: 'intrigue', description: 'Intrigue skill', scope: 'character' },
            { name: 'learning', description: 'Learning skill', scope: 'character' },
            { name: 'prowess', description: 'Prowess skill', scope: 'character' },
            { name: 'stress', description: 'Stress level', scope: 'character' },
            { name: 'dread', description: 'Dread level', scope: 'character' },
            // Variable triggers
            { name: 'has_variable', description: 'Has variable set', scope: 'any' },
            { name: 'has_local_variable', description: 'Has local variable', scope: 'any' },
            { name: 'has_global_variable', description: 'Has global variable', scope: 'any' },
            // Logic triggers
            { name: 'always', description: 'Always true/false', scope: 'any' },
            { name: 'AND', description: 'All conditions must be true', scope: 'any' },
            { name: 'OR', description: 'Any condition must be true', scope: 'any' },
            { name: 'NOT', description: 'Condition must be false', scope: 'any' },
            { name: 'NOR', description: 'No condition must be true', scope: 'any' },
            { name: 'NAND', description: 'Not all conditions true', scope: 'any' },
            // Title triggers
            { name: 'tier', description: 'Title tier', scope: 'title' },
            { name: 'is_de_jure_liege_or_above_of', description: 'De jure liege check', scope: 'title' },
            // List triggers
            { name: 'any_vassal', description: 'Any vassal matches', scope: 'character' },
            { name: 'any_child', description: 'Any child matches', scope: 'character' },
            { name: 'any_spouse', description: 'Any spouse matches', scope: 'character' },
            { name: 'any_courtier', description: 'Any courtier matches', scope: 'character' },
            { name: 'any_held_title', description: 'Any held title matches', scope: 'character' },
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
                'top_liege': 'character',
                'primary_title': 'title',
                'capital_province': 'province',
                'capital_county': 'title',
                'root': 'character',
                'employer': 'character',
                'host': 'character',
                'killer': 'character',
                'mother': 'character',
                'father': 'character',
                'primary_spouse': 'character',
                'dynasty': 'dynasty',
                'house': 'dynasty',
                'culture': 'culture',
                'faith': 'faith',
                'realm_priest': 'character',
                'primary_heir': 'character',
                'court_owner': 'character',
                'warden': 'character',
                'guardian': 'character',
            },
            lists: ['vassal', 'heir', 'child', 'spouse', 'sibling', 'courtier',
                     'prisoner', 'knight', 'close_family_member', 'held_title',
                     'claim', 'directly_owned_province', 'realm_province'],
        };

        const titleScope: ScopeDefinition = {
            name: 'title',
            description: 'Landed title scope',
            links: {
                'holder': 'character',
                'capital_county': 'title',
                'de_jure_liege': 'title',
                'previous_holder': 'character',
                'title_province': 'province',
                'lessee': 'character',
            },
            lists: ['vassal', 'de_jure_vassal', 'claim', 'county_province',
                     'de_jure_county', 'in_de_jure_hierarchy'],
        };

        const provinceScope: ScopeDefinition = {
            name: 'province',
            description: 'Province scope',
            links: {
                'county': 'title',
                'holder': 'character',
                'barony': 'title',
                'culture': 'culture',
                'faith': 'faith',
            },
            lists: ['neighboring_province'],
        };

        const dynastyScope: ScopeDefinition = {
            name: 'dynasty',
            description: 'Dynasty scope',
            links: {
                'dynasty_head': 'character',
                'dynast': 'character',
            },
            lists: ['dynasty_member'],
        };

        const cultureScope: ScopeDefinition = {
            name: 'culture',
            description: 'Culture scope',
            links: {
                'culture_head': 'character',
            },
            lists: ['culture_county'],
        };

        const faithScope: ScopeDefinition = {
            name: 'faith',
            description: 'Faith scope',
            links: {
                'religious_head': 'character',
            },
            lists: ['faith_county', 'holy_site'],
        };

        this.scopesCache!.set('character', characterScope);
        this.scopesCache!.set('title', titleScope);
        this.scopesCache!.set('province', provinceScope);
        this.scopesCache!.set('dynasty', dynastyScope);
        this.scopesCache!.set('culture', cultureScope);
        this.scopesCache!.set('faith', faithScope);
    }
    
    private addFallbackTraits(): void {
        const fallbackTraits: TraitDefinition[] = [
            // Personality traits
            { id: 'brave', name: 'Brave', category: 'personality' },
            { id: 'craven', name: 'Craven', category: 'personality', opposites: ['brave'] },
            { id: 'ambitious', name: 'Ambitious', category: 'personality' },
            { id: 'content', name: 'Content', category: 'personality', opposites: ['ambitious'] },
            { id: 'greedy', name: 'Greedy', category: 'personality' },
            { id: 'generous', name: 'Generous', category: 'personality', opposites: ['greedy'] },
            { id: 'wrathful', name: 'Wrathful', category: 'personality' },
            { id: 'calm', name: 'Calm', category: 'personality', opposites: ['wrathful'] },
            { id: 'honest', name: 'Honest', category: 'personality' },
            { id: 'deceitful', name: 'Deceitful', category: 'personality', opposites: ['honest'] },
            { id: 'zealous', name: 'Zealous', category: 'personality' },
            { id: 'cynical', name: 'Cynical', category: 'personality', opposites: ['zealous'] },
            { id: 'compassionate', name: 'Compassionate', category: 'personality' },
            { id: 'callous', name: 'Callous', category: 'personality', opposites: ['compassionate'] },
            { id: 'just', name: 'Just', category: 'personality' },
            { id: 'arbitrary', name: 'Arbitrary', category: 'personality', opposites: ['just'] },
            { id: 'patient', name: 'Patient', category: 'personality' },
            { id: 'impatient', name: 'Impatient', category: 'personality', opposites: ['patient'] },
            { id: 'diligent', name: 'Diligent', category: 'personality' },
            { id: 'lazy', name: 'Lazy', category: 'personality', opposites: ['diligent'] },
            { id: 'chaste', name: 'Chaste', category: 'personality' },
            { id: 'lustful', name: 'Lustful', category: 'personality', opposites: ['chaste'] },
            { id: 'temperate', name: 'Temperate', category: 'personality' },
            { id: 'gluttonous', name: 'Gluttonous', category: 'personality', opposites: ['temperate'] },
            { id: 'gregarious', name: 'Gregarious', category: 'personality' },
            { id: 'shy', name: 'Shy', category: 'personality', opposites: ['gregarious'] },
            { id: 'forgiving', name: 'Forgiving', category: 'personality' },
            { id: 'vengeful', name: 'Vengeful', category: 'personality', opposites: ['forgiving'] },
            // Congenital traits
            { id: 'genius', name: 'Genius', category: 'education' },
            { id: 'imbecile', name: 'Imbecile', category: 'education', opposites: ['genius'] },
            { id: 'quick', name: 'Quick', category: 'education' },
            { id: 'slow', name: 'Slow', category: 'education', opposites: ['quick'] },
            { id: 'shrewd', name: 'Shrewd', category: 'education' },
            { id: 'dull', name: 'Dull', category: 'education', opposites: ['shrewd'] },
            { id: 'beautiful', name: 'Beautiful', category: 'congenital' },
            { id: 'ugly', name: 'Ugly', category: 'congenital', opposites: ['beautiful'] },
            { id: 'strong', name: 'Strong', category: 'congenital' },
            { id: 'weak', name: 'Weak', category: 'congenital', opposites: ['strong'] },
            { id: 'fecund', name: 'Fecund', category: 'congenital' },
            { id: 'infertile', name: 'Infertile', category: 'congenital', opposites: ['fecund'] },
            // Health traits
            { id: 'ill', name: 'Ill', category: 'health' },
            { id: 'wounded', name: 'Wounded', category: 'health' },
            { id: 'maimed', name: 'Maimed', category: 'health' },
            { id: 'blind', name: 'Blind', category: 'health' },
            { id: 'lunatic', name: 'Lunatic', category: 'health' },
            { id: 'possessed', name: 'Possessed', category: 'health' },
            // Fame traits
            { id: 'renowned', name: 'Renowned', category: 'fame' },
            { id: 'famous', name: 'Famous', category: 'fame' },
            // Education traits
            { id: 'education_diplomacy_1', name: 'Naive Appeaser', category: 'education' },
            { id: 'education_diplomacy_2', name: 'Underhanded Rogue', category: 'education' },
            { id: 'education_diplomacy_3', name: 'Charismatic Negotiator', category: 'education' },
            { id: 'education_diplomacy_4', name: 'Grey Eminence', category: 'education' },
            { id: 'education_martial_1', name: 'Misguided Warrior', category: 'education' },
            { id: 'education_martial_2', name: 'Tough Soldier', category: 'education' },
            { id: 'education_martial_3', name: 'Skilled Tactician', category: 'education' },
            { id: 'education_martial_4', name: 'Brilliant Strategist', category: 'education' },
            { id: 'education_stewardship_1', name: 'Indulgent Wastrel', category: 'education' },
            { id: 'education_stewardship_2', name: 'Thrifty Clerk', category: 'education' },
            { id: 'education_stewardship_3', name: 'Fortune Builder', category: 'education' },
            { id: 'education_stewardship_4', name: 'Midas Touched', category: 'education' },
            { id: 'education_intrigue_1', name: 'Amateurish Plotter', category: 'education' },
            { id: 'education_intrigue_2', name: 'Flamboyant Trickster', category: 'education' },
            { id: 'education_intrigue_3', name: 'Intricate Webweaver', category: 'education' },
            { id: 'education_intrigue_4', name: 'Elusive Shadow', category: 'education' },
            { id: 'education_learning_1', name: 'Conscientious Scribe', category: 'education' },
            { id: 'education_learning_2', name: 'Diligent Student', category: 'education' },
            { id: 'education_learning_3', name: 'Scholar', category: 'education' },
            { id: 'education_learning_4', name: 'Mastermind Philosopher', category: 'education' },
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

        for (const name of onActions) {
            this.onActionsCache!.set(name, { name, description: `On-action: ${name}` });
        }
    }
}

// Export singleton getter
export function getDataLoader(): DataLoader {
    return DataLoader.getInstance();
}
