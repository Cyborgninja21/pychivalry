/**
 * Enhanced Workspace Manager - Cross-File Validation and Mod Analysis
 * 
 * This module extends the basic WorkspaceManager with comprehensive cross-file
 * features including:
 * - Complete mod descriptor parsing and validation
 * - Cross-file reference tracking (undefined symbols)
 * - Event chain validation (trigger_event calls)
 * - Localization coverage analysis
 * - Dependency resolution
 * - Version compatibility checking
 * - Workspace-wide diagnostics aggregation
 * 
 * DIAGNOSTIC CODES:
 *     CK4300: Undefined reference (event/decision/effect/trigger)
 *     CK4400: Unused symbol
 *     CK4500: Circular dependency
 *     CK4100: Missing localization key
 *     CK4150: Orphaned localization key
 *     CK6000: Invalid mod descriptor
 *     CK6001: Mod version compatibility issue
 *     CK6002: Missing dependency
 *     CK6003: Broken event chain
 */

import { WorkspaceFolder, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver/node';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import { promisify } from 'util';
import { ASTNode, NodeType } from './parser';
import { serverLogger } from '../utils/logger';

const readFile = promisify(fs.readFile);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

// =============================================================================
// DATA STRUCTURES
// =============================================================================

export interface CompleteModDescriptor {
    name: string;
    version: string;
    supportedVersion: string;
    path: string;
    dependencies: string[];
    replacePaths: string[];
    tags: string[];
    picture?: string;
    remoteFileId?: string;
}

export interface UndefinedReference {
    symbol: string;
    symbolType: 'event' | 'decision' | 'effect' | 'trigger' | 'trait' | 'variable';
    file: string;
    line: number;
    column: number;
    context: string; // Context where reference appears
}

export interface EventChainLink {
    sourceEvent: string;
    targetEvent: string;
    sourceFile: string;
    sourceLine: number;
    targetExists: boolean;
}

export interface LocalizationCoverage {
    totalEvents: number;
    eventsWithLocalization: number;
    missingKeys: string[];
    coveragePercentage: number;
}

export interface WorkspaceStatistics {
    totalFiles: number;
    eventFiles: number;
    decisionFiles: number;
    scriptedEffectsCount: number;
    scriptedTriggersCount: number;
    eventsCount: number;
    decisionsCount: number;
    undefinedReferencesCount: number;
    brokenEventChainsCount: number;
    localizationCoverage: number;
}

export interface DecisionGroupValidation {
    groupName: string;
    decisions: string[];
    hasIcon: boolean;
    hasPicture: boolean;
    sortOrder?: number;
    issues: string[];
}

// =============================================================================
// ENHANCED WORKSPACE MANAGER
// =============================================================================

export class EnhancedWorkspaceManager {
    private workspaceFolders: Map<string, WorkspaceFolder> = new Map();
    private modDescriptors: Map<string, CompleteModDescriptor> = new Map();
    
    // Symbol tracking
    private definedEvents: Map<string, string> = new Map(); // event_id -> file_path
    private definedDecisions: Map<string, string> = new Map();
    private definedScriptedEffects: Map<string, string> = new Map();
    private definedScriptedTriggers: Map<string, string> = new Map();
    private definedTraits: Map<string, string> = new Map();
    
    // Reference tracking
    private undefinedReferences: UndefinedReference[] = [];
    private eventChains: EventChainLink[] = [];
    
    // Localization tracking
    private requiredLocKeys: Set<string> = new Set();
    private definedLocKeys: Set<string> = new Set();

    // Asset tracking
    private assetPaths: Set<string> = new Set();
    
    /**
     * Add workspace folder and perform initial scan
     */
    public async addWorkspaceFolder(folder: WorkspaceFolder): Promise<void> {
        this.workspaceFolders.set(folder.uri, folder);
        
        // Discover and parse mod descriptor
        await this.discoverModDescriptor(folder);
        
        // Initial workspace scan
        await this.scanWorkspace(folder);
    }

    /**
     * Remove workspace folder
     */
    public removeWorkspaceFolder(uri: string): void {
        this.workspaceFolders.delete(uri);
        this.modDescriptors.delete(uri);
        this.clearWorkspaceData(uri);
    }

    /**
     * Get all workspace folders
     */
    public getWorkspaceFolders(): WorkspaceFolder[] {
        return Array.from(this.workspaceFolders.values());
    }

    /**
     * Get known asset paths collected during workspace scan
     */
    public getKnownAssets(): Set<string> {
        return this.assetPaths;
    }

    /**
     * Get mod descriptor for workspace
     */
    public getModDescriptor(uri: string): CompleteModDescriptor | undefined {
        return this.modDescriptors.get(uri);
    }

    /**
     * Get workspace statistics
     */
    public getWorkspaceStatistics(): WorkspaceStatistics {
        const locCoverage = this.calculateLocalizationCoverage();
        
        return {
            totalFiles: 0, // Would count actual files
            eventFiles: 0,
            decisionFiles: 0,
            scriptedEffectsCount: this.definedScriptedEffects.size,
            scriptedTriggersCount: this.definedScriptedTriggers.size,
            eventsCount: this.definedEvents.size,
            decisionsCount: this.definedDecisions.size,
            undefinedReferencesCount: this.undefinedReferences.length,
            brokenEventChainsCount: this.eventChains.filter(c => !c.targetExists).length,
            localizationCoverage: locCoverage.coveragePercentage,
        };
    }

    /**
     * Get undefined references
     */
    public getUndefinedReferences(): UndefinedReference[] {
        return this.undefinedReferences;
    }

    /**
     * Get broken event chains
     */
    public getBrokenEventChains(): EventChainLink[] {
        return this.eventChains.filter(chain => !chain.targetExists);
    }

    /**
     * Get localization coverage
     */
    public getLocalizationCoverage(): LocalizationCoverage {
        return this.calculateLocalizationCoverage();
    }

    /**
     * Check if symbol is defined
     */
    public isSymbolDefined(symbol: string, type: string): boolean {
        switch (type) {
            case 'event':
                return this.definedEvents.has(symbol);
            case 'decision':
                return this.definedDecisions.has(symbol);
            case 'effect':
                return this.definedScriptedEffects.has(symbol);
            case 'trigger':
                return this.definedScriptedTriggers.has(symbol);
            case 'trait':
                return this.definedTraits.has(symbol);
            default:
                return false;
        }
    }

    /**
     * Add symbol definition
     */
    public addSymbolDefinition(symbol: string, type: string, filePath: string): void {
        switch (type) {
            case 'event':
                this.definedEvents.set(symbol, filePath);
                break;
            case 'decision':
                this.definedDecisions.set(symbol, filePath);
                break;
            case 'effect':
                this.definedScriptedEffects.set(symbol, filePath);
                break;
            case 'trigger':
                this.definedScriptedTriggers.set(symbol, filePath);
                break;
            case 'trait':
                this.definedTraits.set(symbol, filePath);
                break;
        }
    }

    /**
     * Add undefined reference
     */
    public addUndefinedReference(ref: UndefinedReference): void {
        this.undefinedReferences.push(ref);
    }

    /**
     * Add event chain link
     */
    public addEventChain(link: EventChainLink): void {
        this.eventChains.push(link);
    }

    /**
     * Add required localization key
     */
    public addRequiredLocKey(key: string): void {
        this.requiredLocKeys.add(key);
    }

    /**
     * Add defined localization key
     */
    public addDefinedLocKey(key: string): void {
        this.definedLocKeys.add(key);
    }

    /**
     * Validate decision groups
     */
    public validateDecisionGroups(ast: ASTNode): DecisionGroupValidation[] {
        const validations: DecisionGroupValidation[] = [];
        
        // Find all decision groups in AST
        if (ast.type === NodeType.ROOT && ast.children) {
            for (const child of ast.children) {
                if (child.type === NodeType.ASSIGNMENT && child.key) {
                    const validation: DecisionGroupValidation = {
                        groupName: child.key,
                        decisions: [],
                        hasIcon: false,
                        hasPicture: false,
                        issues: [],
                    };
                    
                    // Check for icon and picture in children
                    if (child.children) {
                        for (const field of child.children) {
                            if (field.key === 'icon' && field.value) {
                                validation.hasIcon = true;
                            }
                            if (field.key === 'picture' && field.value) {
                                validation.hasPicture = true;
                            }
                            if (field.key === 'sort_order' && typeof field.value === 'number') {
                                validation.sortOrder = field.value;
                            }
                        }
                    }
                    
                    // Validate
                    if (!validation.hasIcon) {
                        validation.issues.push('Missing icon field');
                    }
                    if (!validation.hasPicture) {
                        validation.issues.push('Missing picture field');
                    }
                    
                    validations.push(validation);
                }
            }
        }
        
        return validations;
    }

    // =============================================================================
    // PRIVATE METHODS
    // =============================================================================

    /**
     * Discover and parse mod descriptor
     */
    private async discoverModDescriptor(folder: WorkspaceFolder): Promise<void> {
        try {
            const folderPath = this.uriToPath(folder.uri);
            const descriptorPath = path.join(folderPath, 'descriptor.mod');
            
            let descriptorExists = false;
            try { await fsp.access(descriptorPath); descriptorExists = true; } catch {}
            if (descriptorExists) {
                const content = await readFile(descriptorPath, 'utf-8');
                const descriptor = this.parseModDescriptor(content);
                
                if (descriptor) {
                    this.modDescriptors.set(folder.uri, descriptor);
                }
            }
        } catch (error) {
            serverLogger.error(`Failed to discover mod descriptor: ${error}`);
        }
    }

    /**
     * Parse mod descriptor file
     */
    private parseModDescriptor(content: string): CompleteModDescriptor | null {
        if (!content.trim()) {
            return null;
        }
        
        // Extract fields using regex
        const nameMatch = content.match(/name\s*=\s*"([^"]+)"/);
        const versionMatch = content.match(/version\s*=\s*"([^"]+)"/);
        const supportedMatch = content.match(/supported_version\s*=\s*"([^"]+)"/);
        const pathMatch = content.match(/path\s*=\s*"([^"]+)"/);
        const pictureMatch = content.match(/picture\s*=\s*"([^"]+)"/);
        const remoteMatch = content.match(/remote_file_id\s*=\s*"([^"]+)"/);
        
        if (!nameMatch) {
            return null; // Name is required
        }
        
        // Parse array fields
        const tagsMatch = content.match(/tags\s*=\s*\{([^}]+)\}/);
        const tags: string[] = [];
        if (tagsMatch) {
            const tagMatches = tagsMatch[1].matchAll(/"([^"]+)"/g);
            for (const match of tagMatches) {
                tags.push(match[1]);
            }
        }
        
        const depsMatch = content.match(/dependencies\s*=\s*\{([^}]+)\}/);
        const dependencies: string[] = [];
        if (depsMatch) {
            const depMatches = depsMatch[1].matchAll(/"([^"]+)"/g);
            for (const match of depMatches) {
                dependencies.push(match[1]);
            }
        }
        
        const replaceMatches = content.matchAll(/replace_path\s*=\s*"([^"]+)"/g);
        const replacePaths: string[] = [];
        for (const match of replaceMatches) {
            replacePaths.push(match[1]);
        }
        
        return {
            name: nameMatch[1],
            version: versionMatch ? versionMatch[1] : '',
            supportedVersion: supportedMatch ? supportedMatch[1] : '',
            path: pathMatch ? pathMatch[1] : '',
            dependencies,
            replacePaths,
            tags,
            picture: pictureMatch ? pictureMatch[1] : undefined,
            remoteFileId: remoteMatch ? remoteMatch[1] : undefined,
        };
    }

    /**
     * Scan workspace for symbols and references
     */
    private async scanWorkspace(folder: WorkspaceFolder): Promise<void> {
        const folderPath = this.uriToPath(folder.uri);
        const ck3Files = await this.findCK3FilesRecursive(folderPath);

        for (const filePath of ck3Files) {
            try {
                const content = await readFile(filePath, 'utf-8');
                this.extractSymbolsFromContent(content, filePath);
            } catch {
                // Skip unreadable files
            }
        }

        // Scan for asset files (graphics, sound, animations, GUI)
        await this.scanAssetFiles(folderPath);
    }

    /**
     * Scan workspace for asset files and register their relative paths
     */
    private async scanAssetFiles(rootPath: string): Promise<void> {
        const ASSET_EXTENSIONS = new Set(['.dds', '.tga', '.png', '.wav', '.ogg', '.mp3', '.anim', '.gui', '.gfx', '.asset']);
        const scanDir = async (dirPath: string): Promise<void> => {
            try {
                const entries = await readdir(dirPath);
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry);
                    try {
                        const info = await stat(fullPath);
                        if (info.isDirectory()) {
                            if (entry === 'node_modules' || entry === '.git' || entry === '.vscode') continue;
                            await scanDir(fullPath);
                        } else if (info.isFile()) {
                            const ext = path.extname(entry).toLowerCase();
                            if (ASSET_EXTENSIONS.has(ext)) {
                                // Store relative path from workspace root (forward slashes)
                                const relPath = path.relative(rootPath, fullPath).replace(/\\/g, '/');
                                this.assetPaths.add(relPath);
                            }
                        }
                    } catch {
                        // Skip inaccessible entries
                    }
                }
            } catch {
                // Skip inaccessible directories
            }
        };
        await scanDir(rootPath);
    }

    /**
     * Recursively find CK3 script files
     */
    private async findCK3FilesRecursive(dirPath: string): Promise<string[]> {
        const files: string[] = [];
        try {
            const entries = await readdir(dirPath);
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry);
                try {
                    const info = await stat(fullPath);
                    if (info.isDirectory()) {
                        if (entry === 'node_modules' || entry === '.git' || entry === '.vscode') {
                            continue;
                        }
                        const subFiles = await this.findCK3FilesRecursive(fullPath);
                        files.push(...subFiles);
                    } else if (info.isFile()) {
                        const ext = path.extname(entry).toLowerCase();
                        if (ext === '.txt' || ext === '.gui' || ext === '.gfx' || ext === '.asset') {
                            files.push(fullPath);
                        }
                    }
                } catch {
                    // Skip inaccessible entries
                }
            }
        } catch {
            // Skip inaccessible directories
        }
        return files;
    }

    /**
     * Extract symbol definitions from file content using regex patterns
     */
    private extractSymbolsFromContent(content: string, filePath: string): void {
        // Extract event definitions: namespace.number = {
        const eventPattern = /^(\w+\.\d+)\s*=\s*\{/gm;
        let match;
        while ((match = eventPattern.exec(content)) !== null) {
            this.definedEvents.set(match[1], filePath);
        }

        // Extract namespace declarations
        const nsPattern = /^namespace\s*=\s*(\w+)/gm;
        while ((match = nsPattern.exec(content)) !== null) {
            // Track namespace for reference
        }

        // Extract trigger_event references for event chains
        const triggerPattern = /trigger_event\s*=\s*(?:\{\s*id\s*=\s*)?(\w+\.\d+)/g;
        while ((match = triggerPattern.exec(content)) !== null) {
            // Could build event chain tracking here
        }

        // Check parent directory name for context
        const parentDir = path.basename(path.dirname(filePath)).toLowerCase();

        if (parentDir === 'scripted_effects' || parentDir === 'common') {
            const effectPattern = /^(\w+)\s*=\s*\{/gm;
            while ((match = effectPattern.exec(content)) !== null) {
                if (!match[1].includes('.')) {
                    this.definedScriptedEffects.set(match[1], filePath);
                }
            }
        }

        if (parentDir === 'scripted_triggers') {
            const trigPattern = /^(\w+)\s*=\s*\{/gm;
            while ((match = trigPattern.exec(content)) !== null) {
                if (!match[1].includes('.')) {
                    this.definedScriptedTriggers.set(match[1], filePath);
                }
            }
        }

        if (parentDir === 'decisions') {
            const decPattern = /^(\w+)\s*=\s*\{/gm;
            while ((match = decPattern.exec(content)) !== null) {
                if (!match[1].includes('.')) {
                    this.definedDecisions.set(match[1], filePath);
                }
            }
        }

        // Extract localization key references (title, desc, name fields)
        const locRefPattern = /(?:title|desc|name)\s*=\s*(\w[\w.]*)/g;
        while ((match = locRefPattern.exec(content)) !== null) {
            this.requiredLocKeys.add(match[1]);
        }
    }

    /**
     * Clear workspace data
     */
    private clearWorkspaceData(uri: string): void {
        // Remove all symbols from this workspace
        // This is simplified - would need to track which symbols belong to which workspace
        this.undefinedReferences = this.undefinedReferences.filter(
            ref => !ref.file.startsWith(uri)
        );
        this.eventChains = this.eventChains.filter(
            chain => !chain.sourceFile.startsWith(uri)
        );
    }

    /**
     * Calculate localization coverage
     */
    private calculateLocalizationCoverage(): LocalizationCoverage {
        const missingKeys = Array.from(this.requiredLocKeys).filter(
            key => !this.definedLocKeys.has(key)
        );
        
        const totalEvents = this.definedEvents.size;
        const eventsWithLoc = totalEvents - missingKeys.length;
        const coverage = totalEvents > 0 ? (eventsWithLoc / totalEvents) * 100 : 100;
        
        return {
            totalEvents,
            eventsWithLocalization: eventsWithLoc,
            missingKeys,
            coveragePercentage: coverage,
        };
    }

    /**
     * Validate mod descriptor
     */
    public validateModDescriptor(descriptor: CompleteModDescriptor): string[] {
        const errors: string[] = [];
        
        if (!descriptor.name) {
            errors.push('Mod name is required');
        }
        
        if (!descriptor.path) {
            errors.push('Mod path is required');
        }
        
        if (descriptor.supportedVersion && !/\d+\.\d+\.\*/.test(descriptor.supportedVersion)) {
            errors.push(`Invalid supported_version format: ${descriptor.supportedVersion}`);
        }
        
        return errors;
    }

    /**
     * Validate event chain
     */
    public validateEventChain(sourceEvent: string, targetEvent: string, 
                               sourceFile: string, sourceLine: number): EventChainLink {
        const targetExists = this.definedEvents.has(targetEvent);
        
        const link: EventChainLink = {
            sourceEvent,
            targetEvent,
            sourceFile,
            sourceLine,
            targetExists,
        };
        
        this.addEventChain(link);
        return link;
    }

    /**
     * Find undefined scripted effects
     */
    public findUndefinedScriptedEffects(usedEffects: Set<string>): string[] {
        const undefined: string[] = [];
        for (const effect of usedEffects) {
            if (!this.definedScriptedEffects.has(effect)) {
                undefined.push(effect);
            }
        }
        return undefined.sort();
    }

    /**
     * Find undefined scripted triggers
     */
    public findUndefinedScriptedTriggers(usedTriggers: Set<string>): string[] {
        const undefined: string[] = [];
        for (const trigger of usedTriggers) {
            if (!this.definedScriptedTriggers.has(trigger)) {
                undefined.push(trigger);
            }
        }
        return undefined.sort();
    }

    /**
     * Extract localization keys from event node
     */
    public extractLocalizationKeysFromEvent(eventNode: ASTNode): string[] {
        const keys: string[] = [];
        
        if (eventNode.type !== NodeType.ASSIGNMENT) {
            return keys;
        }
        
        // Look for title, desc, and option names in children
        if (eventNode.children) {
            for (const child of eventNode.children) {
                if (child.key === 'title' && typeof child.value === 'string') {
                    keys.push(child.value);
                }
                if (child.key === 'desc' && typeof child.value === 'string') {
                    keys.push(child.value);
                }
                // Options would be in children as separate nodes
                if (child.key === 'option' && child.children) {
                    for (const optChild of child.children) {
                        if (optChild.key === 'name' && typeof optChild.value === 'string') {
                            keys.push(optChild.value);
                        }
                    }
                }
            }
        }
        
        return keys;
    }

    /**
     * Find broken event chains
     */
    public findBrokenEventChains(): EventChainLink[] {
        return this.eventChains.filter(chain => !chain.targetExists);
    }

    /**
     * Get workspace diagnostics summary
     */
    public getWorkspaceDiagnosticsSummary(): string {
        const stats = this.getWorkspaceStatistics();
        const broken = this.getBrokenEventChains();
        const undefined = this.getUndefinedReferences();
        const locCoverage = this.getLocalizationCoverage();
        
        return `Workspace Summary:
  Events: ${stats.eventsCount}
  Decisions: ${stats.decisionsCount}
  Scripted Effects: ${stats.scriptedEffectsCount}
  Scripted Triggers: ${stats.scriptedTriggersCount}
  
  Issues:
  - Undefined References: ${undefined.length}
  - Broken Event Chains: ${broken.length}
  - Missing Localization Keys: ${locCoverage.missingKeys.length}
  - Localization Coverage: ${locCoverage.coveragePercentage.toFixed(1)}%
`;
    }

    /**
     * Get dependency-ordered file list for validation.
     * Level 5 (infrastructure: on_actions, scripted_triggers/effects) validated first,
     * down to Level 1 (events) validated last.
     * Returns files grouped by level for ordered processing.
     */
    public getDependencyOrderedFiles(): Map<number, string[]> {
        const { DirectoryRegistry } = require('../data/directory-registry');
        const registry = DirectoryRegistry.getInstance();
        const orderedFiles = new Map<number, string[]>();

        // Collect all indexed files and sort by dependency level
        for (const [uri, folder] of this.workspaceFolders) {
            const folderPath = this.uriToPath(folder.uri);
            this.collectFilesForOrdering(folderPath, registry, orderedFiles);
        }

        return orderedFiles;
    }

    private collectFilesForOrdering(
        dirPath: string,
        registry: any,
        result: Map<number, string[]>
    ): void {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    this.collectFilesForOrdering(fullPath, registry, result);
                } else if (entry.name.endsWith('.txt')) {
                    const level = registry.isLoaded() ? registry.getLevel(fullPath) : 0;
                    const effectiveLevel = level >= 0 ? level : 0;
                    if (!result.has(effectiveLevel)) {
                        result.set(effectiveLevel, []);
                    }
                    result.get(effectiveLevel)!.push(fullPath);
                }
            }
        } catch {
            // Directory not readable
        }
    }

    /**
     * Detect circular dependencies between files.
     * Returns CK4500 diagnostics for any cycles found.
     */
    public detectCircularDependencies(
        dependencyGraph: Map<string, Set<string>>
    ): Array<{ file: string; cycle: string[] }> {
        const cycles: Array<{ file: string; cycle: string[] }> = [];
        const visited = new Set<string>();
        const inStack = new Set<string>();

        const dfs = (node: string, path: string[]): void => {
            if (inStack.has(node)) {
                // Found a cycle
                const cycleStart = path.indexOf(node);
                cycles.push({
                    file: node,
                    cycle: path.slice(cycleStart),
                });
                return;
            }
            if (visited.has(node)) return;

            visited.add(node);
            inStack.add(node);
            path.push(node);

            const deps = dependencyGraph.get(node);
            if (deps) {
                for (const dep of deps) {
                    dfs(dep, [...path]);
                }
            }

            inStack.delete(node);
        };

        for (const node of dependencyGraph.keys()) {
            if (!visited.has(node)) {
                dfs(node, []);
            }
        }

        return cycles;
    }

    /**
     * Validate saved scope references across the workspace.
     * Returns diagnostics for undefined scope references and unused definitions.
     *
     * SCOPE-011: Undefined saved scope (referenced but never defined)
     * SCOPE-012: Unused saved scope (defined but never referenced)
     */
    public validateSavedScopes(indexer: import('./indexer-enhanced').EnhancedIndexer): {
        undefinedScopes: string[];
        unusedScopes: import('./indexer-enhanced').SavedScopeEntry[];
    } {
        return {
            undefinedScopes: indexer.getUndefinedSavedScopes(),
            unusedScopes: indexer.getUnusedSavedScopes(),
        };
    }

    /**
     * Convert URI to file path
     */
    private uriToPath(uri: string): string {
        if (uri.startsWith('file:///')) {
            let p = decodeURIComponent(uri.substring(8));
            // On Windows, paths start with drive letter after file:///
            if (/^[a-zA-Z]:/.test(p)) {
                return p;
            }
            return '/' + p;
        }
        if (uri.startsWith('file://')) {
            return decodeURIComponent(uri.substring(7));
        }
        return uri;
    }
}
