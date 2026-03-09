#!/usr/bin/env ts-node

import {
    parseArgs,
    readGameFiles,
    extractTopLevelBlocks,
    parseBlockProperties,
    stripComment,
    extractListValues,
    writeYaml,
    inferScopeFromName,
    printSummary
} from './lib/extractor-utils';

interface ScopeAccessor {
    lists: Record<string, string>;
    links: Record<string, string>;
}

interface ScopeData {
    [scopeType: string]: ScopeAccessor;
}

/**
 * Extracts scope accessor chains from CK3 game files and writes organized output
 */
function main() {
    const options = parseArgs('extract-scopes.ts');

    console.log('🔍 Reading scope files from multiple directories...');

    // Read from multiple directories to find scope usage patterns
    const directories = [
        'common/scripted_triggers',
        'common/scripted_effects',
        'common/on_action',
        'common/decisions',
        'common/character_interactions'
    ];

    const scopeData: ScopeData = {};
    let totalAccessors = 0;

    for (const directory of directories) {
        console.log(`📖 Processing ${directory}...`);
        try {
            const files = readGameFiles(options.gamePath, directory);

            for (const file of files) {
                const accessors = extractScopeAccessors(file.content);
                mergeAccessors(scopeData, accessors);
                totalAccessors += Object.keys(accessors).length;
            }
        } catch (error) {
            console.warn(`⚠️  Could not read ${directory}: ${error}`);
        }
    }

    // Add some known global accessors that might not be found in files
    addKnownGlobalScopes(scopeData);

    // Sort all data alphabetically
    const sortedScopeData = sortScopeData(scopeData);

    // Write main output file
    const outputPath = `${options.outputPath}/scope_accessors.yaml`;
    writeYaml(outputPath, sortedScopeData, '# CK3 Scope Accessors');

    // Write individual scope files if we have enough data
    writeIndividualScopeFiles(options.outputPath, sortedScopeData);

    const totalScopes = Object.keys(sortedScopeData).length;
    printSummary('scope types', totalScopes, outputPath);
    console.log(`📊 Total accessors found: ${totalAccessors}`);
}

function extractScopeAccessors(content: string): ScopeData {
    const accessors: ScopeData = {};
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = stripComment(lines[i]).trim();
        if (!line) continue;

        // Look for list iterator patterns (any_*, every_*, random_*, ordered_*)
        const listMatch = line.match(/^\s*(any|every|random|ordered)_([a-zA-Z_]+)\s*=/);
        if (listMatch) {
            const [, prefix, scopeName] = listMatch;
            const accessorName = `${prefix}_${scopeName}`;

            // Try to infer source and target scopes
            const sourceScope = inferSourceScopeFromContext(lines, i);
            const targetScope = inferTargetScope(scopeName);

            if (sourceScope && targetScope) {
                ensureScopeExists(accessors, sourceScope);
                accessors[sourceScope].lists[accessorName] = targetScope;
            }
        }

        // Look for direct scope links (like liege = {, spouse = {, faith = {)
        const linkMatch = line.match(/^\s*([a-zA-Z_]+)\s*=\s*\{/);
        if (linkMatch) {
            const [, linkName] = linkMatch;

            // Skip common keywords that aren't scopes
            if (isKnownScopeLink(linkName)) {
                const sourceScope = inferSourceScopeFromContext(lines, i);
                const targetScope = inferTargetScope(linkName);

                if (sourceScope && targetScope && sourceScope !== targetScope) {
                    ensureScopeExists(accessors, sourceScope);
                    accessors[sourceScope].links[linkName] = targetScope;
                }
            }
        }

        // Look for scope: syntax
        const explicitScopeMatch = line.match(/scope:([a-zA-Z_]+)\s*=/);
        if (explicitScopeMatch) {
            const [, scopeName] = explicitScopeMatch;
            // This tells us about a saved scope, but we need more context
            // to determine the source scope type
        }
    }

    return accessors;
}

function inferSourceScopeFromContext(lines: string[], currentIndex: number): string | null {
    // Look backwards for context clues about what scope we're in
    for (let i = Math.max(0, currentIndex - 20); i < currentIndex; i++) {
        const line = stripComment(lines[i]).trim();

        // Look for scope comments or patterns that indicate scope type
        if (line.includes('# character scope') || line.includes('#character')) {
            return 'character';
        }
        if (line.includes('# title scope') || line.includes('#title')) {
            return 'title';
        }
        if (line.includes('# province scope') || line.includes('#province')) {
            return 'province';
        }
        if (line.includes('# faith scope') || line.includes('#faith')) {
            return 'faith';
        }
        if (line.includes('# culture scope') || line.includes('#culture')) {
            return 'culture';
        }

        // Look for function names that suggest scope type
        const functionMatch = line.match(/^([a-zA-Z_]+_[a-zA-Z_]+_trigger|[a-zA-Z_]+_[a-zA-Z_]+_effect)\s*=/);
        if (functionMatch) {
            const functionName = functionMatch[1];
            const inferredScopes = inferScopeFromName(functionName);
            if (inferredScopes.length > 0) {
                return inferredScopes[0];
            }
        }
    }

    return 'character'; // Default assumption
}

function inferTargetScope(scopeName: string): string | null {
    // Map common scope names to their types
    const scopeMap: Record<string, string> = {
        // Character-related
        'character': 'character',
        'liege': 'character',
        'spouse': 'character',
        'primary_spouse': 'character',
        'vassal': 'character',
        'vassals': 'character',
        'child': 'character',
        'children': 'character',
        'parent': 'character',
        'sibling': 'character',
        'dynasty_member': 'character',
        'courtier': 'character',
        'guest': 'character',
        'prisoner': 'character',
        'knight': 'character',
        'councillor': 'character',
        'friend': 'character',
        'rival': 'character',
        'lover': 'character',
        'living_character': 'character',

        // Title-related
        'title': 'title',
        'held_title': 'title',
        'claim': 'title',
        'primary_title': 'title',
        'capital_county': 'title',
        'capital_province': 'province',

        // Geographic
        'province': 'province',
        'county': 'title',
        'duchy': 'title',
        'kingdom': 'title',
        'empire': 'title',
        'barony': 'title',

        // Social/Cultural
        'faith': 'faith',
        'religion': 'religion',
        'culture': 'culture',
        'dynasty': 'dynasty',
        'house': 'dynasty',

        // Military/War
        'war': 'war',
        'army': 'army',
        'commander': 'character',

        // Diplomatic
        'ally': 'character',
        'enemy': 'character',
        'scheme': 'scheme',
        'secret': 'secret'
    };

    // Try exact match first
    if (scopeMap[scopeName]) {
        return scopeMap[scopeName];
    }

    // Try partial matches for compound names
    for (const [key, value] of Object.entries(scopeMap)) {
        if (scopeName.includes(key) || key.includes(scopeName)) {
            return value;
        }
    }

    return null;
}

function isKnownScopeLink(linkName: string): boolean {
    // List of known scope accessors vs regular variables/properties
    const knownLinks = [
        'liege', 'spouse', 'primary_spouse', 'faith', 'culture', 'dynasty', 'house',
        'primary_title', 'capital_county', 'capital_province', 'top_liege',
        'mother', 'father', 'player_heir', 'current_heir', 'designated_heir',
        'war_target', 'attacker', 'defender', 'liege_or_court_owner'
    ];

    return knownLinks.includes(linkName) ||
        linkName.startsWith('scope:') ||
        linkName.includes('_character') ||
        linkName.includes('_title') ||
        linkName.includes('_province');
}

function mergeAccessors(target: ScopeData, source: ScopeData): void {
    for (const [scopeType, accessor] of Object.entries(source)) {
        if (!target[scopeType]) {
            target[scopeType] = { lists: {}, links: {} };
        }

        Object.assign(target[scopeType].lists, accessor.lists);
        Object.assign(target[scopeType].links, accessor.links);
    }
}

function ensureScopeExists(accessors: ScopeData, scopeType: string): void {
    if (!accessors[scopeType]) {
        accessors[scopeType] = { lists: {}, links: {} };
    }
}

function addKnownGlobalScopes(scopeData: ScopeData): void {
    // Add well-known global scopes that might not be found in files
    ensureScopeExists(scopeData, 'global');

    const globalLists = {
        'any_living_character': 'character',
        'random_living_character': 'character',
        'every_living_character': 'character',
        'ordered_living_character': 'character',
        'any_ruler': 'character',
        'random_ruler': 'character',
        'every_ruler': 'character',
        'any_independent_ruler': 'character',
        'any_player': 'character',
        'every_player': 'character'
    };

    Object.assign(scopeData.global.lists, globalLists);
}

function sortScopeData(scopeData: ScopeData): ScopeData {
    const sorted: ScopeData = {};
    const sortedKeys = Object.keys(scopeData).sort();

    for (const key of sortedKeys) {
        const accessor = scopeData[key];
        sorted[key] = {
            lists: {},
            links: {}
        };

        // Sort lists and links alphabetically
        const sortedListKeys = Object.keys(accessor.lists).sort();
        for (const listKey of sortedListKeys) {
            sorted[key].lists[listKey] = accessor.lists[listKey];
        }

        const sortedLinkKeys = Object.keys(accessor.links).sort();
        for (const linkKey of sortedLinkKeys) {
            sorted[key].links[linkKey] = accessor.links[linkKey];
        }
    }

    return sorted;
}

function writeIndividualScopeFiles(outputPath: string, scopeData: ScopeData): void {
    const scopesDir = `${outputPath}/scopes`;

    for (const [scopeType, accessor] of Object.entries(scopeData)) {
        const hasSignificantData = Object.keys(accessor.lists).length >= 3 ||
            Object.keys(accessor.links).length >= 2;

        if (hasSignificantData) {
            const filePath = `${scopesDir}/${scopeType}.yaml`;
            const data = {
                [scopeType]: accessor
            };

            try {
                writeYaml(filePath, data, `# ${scopeType.charAt(0).toUpperCase() + scopeType.slice(1)} Scope Accessors`);
                console.log(`📝 Wrote individual scope file: ${filePath}`);
            } catch (error) {
                console.warn(`⚠️  Could not write ${filePath}: ${error}`);
            }
        }
    }
}

if (require.main === module) {
    main();
}