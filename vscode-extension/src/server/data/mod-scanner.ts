/**
 * Mod Scanner — discovers and extracts data from installed CK3 mods
 * 
 * Workflow:
 * 1. Load mod_registry.yaml for known mod definitions and search paths
 * 2. Scan search paths for mod directories (via *.mod descriptors or folder names)
 * 3. Identify mods by matching against registry patterns
 * 4. Extract game data (traits, triggers, effects) using extraction rules
 * 5. Provide merged mod data for completions and hover
 */

import * as fsp from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { serverLogger } from '../utils/logger';
import { DataLoader, ModDefinition } from './loader';

/**
 * Extracted data from a single source rule
 */
interface ExtractionSource {
    path: string;
    pattern: string;
    include_prefixes?: string[];
}

/**
 * Extraction rules for a data category
 */
interface ExtractionRules {
    sources?: ExtractionSource[];
    documented?: Record<string, Record<string, unknown>>;
    manual_additions?: string[];
}

/**
 * Complete extraction rules for a mod
 */
interface ModExtractionRules {
    traits?: ExtractionRules;
    triggers?: ExtractionRules;
    effects?: ExtractionRules;
    opinion_modifiers?: ExtractionRules;
    relations?: ExtractionRules;
}

/**
 * Registry entry for a known mod (extends ModDefinition)
 */
interface ModRegistryEntry extends ModDefinition {
    extraction_rules?: ModExtractionRules;
    identifiers?: {
        descriptor_patterns?: string[];
        folder_patterns?: string[];
        required_files?: string[];
    };
}

/**
 * Extracted mod data item
 */
export interface ModDataItem {
    name: string;
    source: string; // mod display name
    sourceFile?: string;
    description?: string;
    scopes?: string[];
    parameters?: string[];
    autoExtracted: boolean;
}

/**
 * All data extracted from a mod
 */
export interface ModData {
    modId: string;
    displayName: string;
    modPath: string;
    traits: Map<string, ModDataItem>;
    triggers: Map<string, ModDataItem>;
    effects: Map<string, ModDataItem>;
    opinionModifiers: Map<string, ModDataItem>;
}

/**
 * Discovered mod info
 */
interface DiscoveredMod {
    id: string;
    displayName: string;
    path: string;
    registryEntry: ModRegistryEntry;
}

/**
 * Mod Scanner — discovers installed mods and extracts their data
 */
export class ModScanner {
    private registry: Map<string, ModRegistryEntry> = new Map();
    private searchPaths: string[] = [];
    private discoveredMods: Map<string, DiscoveredMod> = new Map();
    private extractedData: Map<string, ModData> = new Map();
    private registryLoaded = false;

    /**
     * Load the mod registry from the data loader's YAML
     */
    public async loadRegistry(): Promise<void> {
        if (this.registryLoaded) return;

        try {
            const dataLoader = DataLoader.getInstance();
            const dataPath = (dataLoader as any).dataPath;
            if (!dataPath) return;

            const registryPath = path.join(dataPath, 'mods', 'mod_registry.yaml');
            let content: string;
            try {
                content = await fsp.readFile(registryPath, 'utf-8');
            } catch {
                serverLogger.log('Mod registry not found, mod discovery disabled');
                this.registryLoaded = true;
                return;
            }

            // Simple YAML parsing for the registry structure
            // We rely on the DataLoader's YAML parser via js-yaml
            let yaml: any;
            try {
                const jsYaml = require('js-yaml');
                yaml = jsYaml.load(content);
            } catch {
                serverLogger.error('Failed to parse mod_registry.yaml');
                this.registryLoaded = true;
                return;
            }

            // Load mod definitions
            if (yaml?.mods) {
                for (const [id, info] of Object.entries(yaml.mods)) {
                    const entry = info as any;
                    this.registry.set(id, {
                        id,
                        display_name: entry.display_name,
                        description: entry.description,
                        identifiers: entry.identifiers,
                        extraction_rules: entry.extraction_rules,
                    });
                }
            }

            // Load search paths with environment variable expansion
            if (yaml?.discovery?.search_paths) {
                for (const p of yaml.discovery.search_paths) {
                    const expanded = this.expandPath(p);
                    if (expanded) {
                        this.searchPaths.push(expanded);
                    }
                }
            }

            this.registryLoaded = true;
            serverLogger.log(`Mod registry loaded: ${this.registry.size} mod definitions, ${this.searchPaths.length} search paths`);
        } catch (error) {
            serverLogger.error(`Failed to load mod registry: ${error}`);
            this.registryLoaded = true;
        }
    }

    /**
     * Expand environment variables and ~ in a path
     */
    private expandPath(p: string): string | null {
        let expanded = p;

        // Expand ~ to home directory
        if (expanded.startsWith('~')) {
            expanded = path.join(os.homedir(), expanded.slice(1));
        }

        // Expand ${VAR} patterns
        expanded = expanded.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
            return process.env[varName] || '';
        });

        // Skip paths with unresolved variables
        if (expanded.includes('${') || expanded === '') {
            return null;
        }

        return expanded;
    }

    /**
     * Discover mods in all search paths
     */
    public async discoverMods(additionalPaths?: string[]): Promise<number> {
        await this.loadRegistry();
        this.discoveredMods.clear();

        const allPaths = [...this.searchPaths];
        if (additionalPaths) {
            allPaths.push(...additionalPaths);
        }

        for (const searchPath of allPaths) {
            try {
                await this.scanSearchPath(searchPath);
            } catch {
                // Path doesn't exist or no permission
            }
        }

        serverLogger.log(`Discovered ${this.discoveredMods.size} mod(s)`);
        return this.discoveredMods.size;
    }

    /**
     * Scan a search path for mod directories
     */
    private async scanSearchPath(searchPath: string): Promise<void> {
        let entries: import('fs').Dirent[];
        try {
            entries = await fsp.readdir(searchPath, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(searchPath, entry.name);

            if (entry.isFile() && entry.name.endsWith('.mod')) {
                // Parse .mod descriptor to find mod path
                const modPath = await this.parseModDescriptor(fullPath);
                if (modPath) {
                    await this.identifyAndRegister(modPath);
                }
            } else if (entry.isDirectory()) {
                // Check if directory is a mod
                await this.identifyAndRegister(fullPath);
            }
        }
    }

    /**
     * Parse a .mod descriptor file to extract the mod path
     */
    private async parseModDescriptor(descriptorPath: string): Promise<string | null> {
        try {
            const content = await fsp.readFile(descriptorPath, 'utf-8');
            // CK3 .mod format: path="C:/path/to/mod" or path="mod/subfolder"
            const pathMatch = /path\s*=\s*"([^"]+)"/.exec(content);
            if (pathMatch) {
                const modPath = pathMatch[1];
                // Handle relative paths
                if (path.isAbsolute(modPath)) {
                    return modPath;
                }
                return path.resolve(path.dirname(descriptorPath), modPath);
            }
        } catch {
            // Can't read descriptor
        }
        return null;
    }

    /**
     * Identify a mod directory against registry entries and register it
     */
    private async identifyAndRegister(modPath: string): Promise<void> {
        const folderName = path.basename(modPath).toLowerCase();

        for (const [id, entry] of this.registry) {
            if (this.discoveredMods.has(id)) continue;

            // Check folder patterns
            if (entry.identifiers?.folder_patterns) {
                const matched = entry.identifiers.folder_patterns.some(
                    pattern => folderName === pattern.toLowerCase()
                );
                if (matched) {
                    // Verify required files
                    if (await this.verifyRequiredFiles(modPath, entry.identifiers.required_files)) {
                        this.discoveredMods.set(id, {
                            id,
                            displayName: entry.display_name || id,
                            path: modPath,
                            registryEntry: entry,
                        });
                        serverLogger.log(`Discovered mod: ${entry.display_name || id} at ${modPath}`);
                        return;
                    }
                }
            }

            // Check descriptor patterns
            if (entry.identifiers?.descriptor_patterns) {
                const descriptorPath = path.join(modPath, 'descriptor.mod');
                try {
                    const content = await fsp.readFile(descriptorPath, 'utf-8');
                    const matched = entry.identifiers.descriptor_patterns.some(
                        pattern => content.includes(pattern)
                    );
                    if (matched) {
                        this.discoveredMods.set(id, {
                            id,
                            displayName: entry.display_name || id,
                            path: modPath,
                            registryEntry: entry,
                        });
                        serverLogger.log(`Discovered mod: ${entry.display_name || id} at ${modPath}`);
                        return;
                    }
                } catch {
                    // No descriptor.mod
                }
            }
        }
    }

    /**
     * Verify required files exist in a mod directory
     */
    private async verifyRequiredFiles(modPath: string, requiredFiles?: string[]): Promise<boolean> {
        if (!requiredFiles || requiredFiles.length === 0) return true;

        for (const file of requiredFiles) {
            try {
                await fsp.access(path.join(modPath, file));
            } catch {
                return false;
            }
        }
        return true;
    }

    /**
     * Extract data from all discovered mods
     */
    public async extractAllModData(): Promise<void> {
        for (const [id, mod] of this.discoveredMods) {
            if (!this.extractedData.has(id)) {
                await this.extractModData(mod);
            }
        }
    }

    /**
     * Extract data from a single mod
     */
    private async extractModData(mod: DiscoveredMod): Promise<void> {
        const rules = mod.registryEntry.extraction_rules;
        if (!rules) return;

        const data: ModData = {
            modId: mod.id,
            displayName: mod.displayName,
            modPath: mod.path,
            traits: new Map(),
            triggers: new Map(),
            effects: new Map(),
            opinionModifiers: new Map(),
        };

        if (rules.traits) {
            await this.extractCategory(mod, rules.traits, data.traits, 'trait');
        }
        if (rules.triggers) {
            await this.extractCategory(mod, rules.triggers, data.triggers, 'trigger');
        }
        if (rules.effects) {
            await this.extractCategory(mod, rules.effects, data.effects, 'effect');
        }
        if (rules.opinion_modifiers) {
            await this.extractCategory(mod, rules.opinion_modifiers, data.opinionModifiers, 'opinion_modifier');
        }

        this.extractedData.set(mod.id, data);
        serverLogger.log(`Extracted data from ${mod.displayName}: ${data.traits.size} traits, ${data.triggers.size} triggers, ${data.effects.size} effects`);
    }

    /**
     * Extract items from a data category using extraction rules
     */
    private async extractCategory(
        mod: DiscoveredMod,
        rules: ExtractionRules,
        target: Map<string, ModDataItem>,
        category: string
    ): Promise<void> {
        // Process sources (auto-extraction from files)
        if (rules.sources) {
            for (const source of rules.sources) {
                await this.extractFromSource(mod, source, target);
            }
        }

        // Add manual additions
        if (rules.manual_additions) {
            for (const name of rules.manual_additions) {
                if (!target.has(name)) {
                    target.set(name, {
                        name,
                        source: mod.displayName,
                        autoExtracted: false,
                    });
                }
            }
        }

        // Merge documented metadata into existing entries
        if (rules.documented) {
            for (const [name, meta] of Object.entries(rules.documented)) {
                const existing = target.get(name);
                if (existing) {
                    existing.description = meta.description as string | undefined;
                    existing.scopes = meta.scopes as string[] | undefined;
                    existing.parameters = meta.parameters as string[] | undefined;
                    existing.autoExtracted = false;
                } else {
                    target.set(name, {
                        name,
                        source: mod.displayName,
                        description: meta.description as string | undefined,
                        scopes: meta.scopes as string[] | undefined,
                        parameters: meta.parameters as string[] | undefined,
                        autoExtracted: false,
                    });
                }
            }
        }
    }

    /**
     * Extract item names from files matching a source pattern
     */
    private async extractFromSource(
        mod: DiscoveredMod,
        source: ExtractionSource,
        target: Map<string, ModDataItem>
    ): Promise<void> {
        // Resolve glob-like path into directory + filter
        const sourcePath = source.path;
        const dirPart = path.dirname(sourcePath);
        const filePart = path.basename(sourcePath);
        const fullDir = path.join(mod.path, dirPart);

        let files: string[];
        try {
            const entries = await fsp.readdir(fullDir);
            // Convert glob pattern to regex for matching
            const globRegex = new RegExp(
                '^' + filePart.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
            );
            files = entries.filter(f => globRegex.test(f)).map(f => path.join(fullDir, f));
        } catch {
            return; // Directory doesn't exist
        }

        const regex = new RegExp(source.pattern, 'gm');

        for (const file of files) {
            try {
                const content = await fsp.readFile(file, 'utf-8');
                let match: RegExpExecArray | null;
                while ((match = regex.exec(content)) !== null) {
                    const name = match[1];

                    // Apply prefix filter
                    if (source.include_prefixes && source.include_prefixes.length > 0) {
                        if (!source.include_prefixes.some(prefix => name.startsWith(prefix))) {
                            continue;
                        }
                    }

                    if (!target.has(name)) {
                        target.set(name, {
                            name,
                            source: mod.displayName,
                            sourceFile: path.basename(file),
                            autoExtracted: true,
                        });
                    }
                }
                // Reset regex lastIndex for next file
                regex.lastIndex = 0;
            } catch {
                // Skip unreadable files
            }
        }
    }

    /**
     * Get all extracted mod data merged across all mods
     */
    public getAllTraits(): Map<string, ModDataItem> {
        const merged = new Map<string, ModDataItem>();
        for (const data of this.extractedData.values()) {
            for (const [name, item] of data.traits) {
                merged.set(name, item);
            }
        }
        return merged;
    }

    public getAllTriggers(): Map<string, ModDataItem> {
        const merged = new Map<string, ModDataItem>();
        for (const data of this.extractedData.values()) {
            for (const [name, item] of data.triggers) {
                merged.set(name, item);
            }
        }
        return merged;
    }

    public getAllEffects(): Map<string, ModDataItem> {
        const merged = new Map<string, ModDataItem>();
        for (const data of this.extractedData.values()) {
            for (const [name, item] of data.effects) {
                merged.set(name, item);
            }
        }
        return merged;
    }

    /**
     * Get the source mod for a given identifier
     */
    public getSourceMod(identifier: string): string | undefined {
        for (const data of this.extractedData.values()) {
            if (data.traits.has(identifier) || data.triggers.has(identifier) ||
                data.effects.has(identifier) || data.opinionModifiers.has(identifier)) {
                return data.displayName;
            }
        }
        return undefined;
    }

    /**
     * Check if any mods have been discovered
     */
    public hasDiscoveredMods(): boolean {
        return this.discoveredMods.size > 0;
    }

    /**
     * Get list of discovered mod names
     */
    public getDiscoveredModNames(): string[] {
        return Array.from(this.discoveredMods.values()).map(m => m.displayName);
    }

    /**
     * Clear all data (for re-scanning)
     */
    public clear(): void {
        this.discoveredMods.clear();
        this.extractedData.clear();
    }
}
