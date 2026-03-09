#!/usr/bin/env node

import {
    parseArgs,
    readGameFiles,
    extractTopLevelBlocks,
    parseBlockProperties,
    stripComment,
    extractListValues,
    writeYaml,
    printSummary
} from './lib/extractor-utils';

interface TraitData {
    category: string;
    opposites?: string[];
    description: string;
    skills?: Record<string, number>;
    opinions?: Record<string, number>;
    ruler_designer_cost?: number;
    stress?: Record<string, number>;
    modifiers?: Record<string, number>;
    flags?: string[];
}

/**
 * Extracts CK3 trait definitions from game files and writes categorized YAML output.
 * Reads from game/common/traits/*.txt and outputs to data/traits/{category}.yaml
 */
function main(): void {
    const options = parseArgs('extract-traits');
    const gameFiles = readGameFiles(options.gamePath, 'common/traits');

    const traitsByCategory = new Map<string, Map<string, TraitData>>();
    let totalTraits = 0;

    for (const file of gameFiles) {
        const blocks = extractTopLevelBlocks(file.content);

        for (const [traitName, blockContent] of blocks) {
            const trait = parseTraitDefinition(traitName, blockContent);

            if (!traitsByCategory.has(trait.category)) {
                traitsByCategory.set(trait.category, new Map());
            }

            traitsByCategory.get(trait.category)!.set(traitName, trait);
            totalTraits++;
        }
    }

    // Write output files by category
    for (const [category, traits] of traitsByCategory) {
        const outputPath = `${options.outputPath}/traits/${category}.yaml`;
        const data = Object.fromEntries(traits);
        const header = `# CK3 ${capitalizeCategory(category)} Traits\n# Auto-generated from CK3 game files\n# Total traits: ${traits.size}`;

        writeYaml(outputPath, data, header);
        printSummary(`${category} traits`, traits.size, outputPath);
    }

    console.log(`\nTotal traits extracted: ${totalTraits} across ${traitsByCategory.size} categories`);
}

function parseTraitDefinition(traitName: string, blockContent: string): TraitData {
    const properties = parseBlockProperties(blockContent);

    const trait: TraitData = {
        category: properties.get('category') || 'misc',
        description: generateDescription(traitName)
    };

    // Parse opposites list
    const opposites = extractListValues(blockContent, 'opposites');
    if (opposites.length > 0) {
        trait.opposites = opposites;
    }

    // Parse skill modifiers
    const skillNames = ['diplomacy', 'martial', 'stewardship', 'intrigue', 'learning', 'prowess'];
    const skills: Record<string, number> = {};
    for (const skill of skillNames) {
        const value = properties.get(skill);
        if (value && !isNaN(Number(value))) {
            skills[skill] = Number(value);
        }
    }
    if (Object.keys(skills).length > 0) {
        trait.skills = skills;
    }

    // Parse opinion modifiers
    const opinions: Record<string, number> = {};
    const stressModifiers: Record<string, number> = {};
    const modifiers: Record<string, number> = {};
    const flags: string[] = [];

    for (const [key, value] of properties) {
        if (key.endsWith('_opinion')) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                opinions[key] = numValue;
            }
        } else if (key.startsWith('stress_')) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                stressModifiers[key] = numValue;
            }
        } else if (key === 'ruler_designer_cost') {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                trait.ruler_designer_cost = numValue;
            }
        } else if (isModifierProperty(key)) {
            const numValue = Number(value);
            if (!isNaN(numValue)) {
                modifiers[key] = numValue;
            }
        } else if (isFlagProperty(key, value)) {
            flags.push(key);
        }
    }

    if (Object.keys(opinions).length > 0) {
        trait.opinions = opinions;
    }
    if (Object.keys(stressModifiers).length > 0) {
        trait.stress = stressModifiers;
    }
    if (Object.keys(modifiers).length > 0) {
        trait.modifiers = modifiers;
    }
    if (flags.length > 0) {
        trait.flags = flags;
    }

    // Parse flags from block content (handle list-style entries)
    const flagMatches = blockContent.match(/^\s*([a-z_]+)\s*$/gm);
    if (flagMatches) {
        const blockFlags = flagMatches
            .map(match => match.trim())
            .filter(flag => isFlagName(flag));

        if (blockFlags.length > 0) {
            trait.flags = [...(trait.flags || []), ...blockFlags];
        }
    }

    return trait;
}

function generateDescription(traitName: string): string {
    return traitName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

function capitalizeCategory(category: string): string {
    return category.charAt(0).toUpperCase() + category.slice(1);
}

function isModifierProperty(key: string): boolean {
    const modifierKeys = [
        'advantage', 'diplomacy_per_stress_level', 'martial_per_stress_level',
        'stewardship_per_stress_level', 'intrigue_per_stress_level',
        'learning_per_stress_level', 'prowess_per_stress_level',
        'fertility', 'health', 'monthly_character_piety', 'monthly_character_prestige',
        'dread_per_tyranny', 'dread_decay_mult', 'dread_baseline_add',
        'courtly_grandeur_baseline_add', 'stress_gain_mult', 'stress_loss_mult'
    ];

    return modifierKeys.includes(key) ||
        key.endsWith('_monthly_add') ||
        key.endsWith('_mult') ||
        key.endsWith('_baseline_add') ||
        key.endsWith('_per_stress_level');
}

function isFlagProperty(key: string, value: string): boolean {
    return value === 'yes' || value === 'true' ||
        key.endsWith('_interaction') ||
        key.includes('can_') ||
        key.includes('cannot_') ||
        key.includes('blocks_');
}

function isFlagName(name: string): boolean {
    return name.length > 0 &&
        /^[a-z_]+$/.test(name) &&
        (name.includes('can_') ||
            name.includes('cannot_') ||
            name.includes('blocks_') ||
            name.endsWith('_interaction') ||
            name.includes('dismiss') ||
            name.includes('execute') ||
            name.includes('interaction'));
}

if (require.main === module) {
    main();
}