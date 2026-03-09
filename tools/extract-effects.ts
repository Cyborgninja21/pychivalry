#!/usr/bin/env npx tsx

import { parseArgs, readGameFiles, extractTopLevelBlocks, writeYaml, inferScopeFromName, printSummary } from './lib/extractor-utils';

interface Effect {
    description: string;
    detail: string;
    snippet: string;
    scopes: string[];
    example: string;
}

/**
 * Extracts effect definitions from CK3 game files and outputs to YAML format.
 * Reads from game/common/scripted_effects/*.txt and similar directories.
 */
function extractEffects(): void {
    const options = parseArgs('extract-effects.ts');

    const effects: Record<string, Effect> = {};

    // Read scripted effects
    const scriptedEffectFiles = readGameFiles(options.gamePath, 'common/scripted_effects');

    for (const file of scriptedEffectFiles) {
        const blocks = extractTopLevelBlocks(file.content);

        for (const [effectName, blockContent] of blocks) {
            if (effectName && !effectName.startsWith('#')) {
                effects[effectName] = createEffect(effectName, blockContent);
            }
        }
    }

    // Sort effects alphabetically
    const sortedEffects = Object.keys(effects)
        .sort()
        .reduce((acc, key) => {
            acc[key] = effects[key];
            return acc;
        }, {} as Record<string, Effect>);

    // Write output
    const outputData = {
        version: "1.0",
        effects: sortedEffects
    };

    writeYaml(options.outputPath, outputData);
    printSummary('effects', Object.keys(sortedEffects).length, options.outputPath);
}

function createEffect(name: string, blockContent: string): Effect {
    const description = generateDescription(name);
    const detail = generateDetail(name);
    const scopes = inferScopeFromName(name);
    const snippet = generateSnippet(name, blockContent);
    const example = generateExample(name, blockContent);

    return {
        description,
        detail,
        snippet,
        scopes,
        example
    };
}

function generateDescription(name: string): string {
    // Convert effect name to readable description
    const words = name.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );

    // Add "effect" context
    if (name.startsWith('add_')) {
        return `Adds ${words.slice(1).join(' ').toLowerCase()} to the target`;
    } else if (name.startsWith('remove_')) {
        return `Removes ${words.slice(1).join(' ').toLowerCase()} from the target`;
    } else if (name.startsWith('set_')) {
        return `Sets ${words.slice(1).join(' ').toLowerCase()} for the target`;
    } else if (name.startsWith('create_')) {
        return `Creates ${words.slice(1).join(' ').toLowerCase()}`;
    } else if (name.startsWith('spawn_')) {
        return `Spawns ${words.slice(1).join(' ').toLowerCase()}`;
    } else {
        return `${words.join(' ')} effect`;
    }
}

function generateDetail(name: string): string {
    // Short phrase about what the effect does
    if (name.includes('modifier')) {
        return 'Character modifier effect';
    } else if (name.includes('trait')) {
        return 'Trait modification';
    } else if (name.includes('opinion')) {
        return 'Opinion change';
    } else if (name.includes('gold') || name.includes('wealth')) {
        return 'Wealth modification';
    } else if (name.includes('prestige')) {
        return 'Prestige effect';
    } else if (name.includes('piety')) {
        return 'Piety effect';
    } else if (name.includes('stress')) {
        return 'Stress effect';
    } else if (name.includes('event')) {
        return 'Event trigger';
    } else if (name.includes('war') || name.includes('battle')) {
        return 'War/combat effect';
    } else if (name.includes('title')) {
        return 'Title modification';
    } else {
        return 'Game effect';
    }
}

function generateSnippet(name: string, blockContent: string): string {
    // Analyze block content to determine if it needs parameters
    const hasComplexBlock = blockContent.includes('=') && blockContent.includes('{');

    if (hasComplexBlock) {
        // Multi-line block snippet
        if (name.includes('modifier')) {
            return `${name} = {\n\tmodifier = \${1:modifier_name}\n\t\${2|days,months,years|} = \${3:30}\n}`;
        } else if (name.includes('trait')) {
            return `${name} = {\n\ttrait = \${1:trait_name}\n}`;
        } else if (name.includes('opinion')) {
            return `${name} = {\n\ttarget = \${1:scope}\n\tmodifier = \${2:modifier_name}\n}`;
        } else if (name.includes('event')) {
            return `${name} = {\n\tid = \${1:event_id}\n\t\${2|days,months,years|} = \${3:30}\n}`;
        } else {
            return `${name} = {\n\t\${1:parameter} = \${2:value}\n}`;
        }
    } else {
        // Simple value snippet
        if (name.includes('add_') || name.includes('remove_')) {
            return `${name} = \${1:amount}`;
        } else {
            return `${name} = \${1|yes,no|}`;
        }
    }
}

function generateExample(name: string, blockContent: string): string {
    // Generate a practical usage example
    if (name.includes('modifier')) {
        return `${name} = {\n  modifier = stress_level_1\n  years = 5\n}`;
    } else if (name.includes('trait')) {
        return `${name} = {\n  trait = brave\n}`;
    } else if (name.includes('opinion')) {
        return `${name} = {\n  target = scope:liege\n  modifier = grateful\n}`;
    } else if (name.includes('gold')) {
        return `${name} = 100`;
    } else if (name.includes('prestige')) {
        return `${name} = 50`;
    } else if (name.includes('piety')) {
        return `${name} = 25`;
    } else if (name.includes('stress')) {
        return `${name} = 20`;
    } else if (name.includes('event')) {
        return `${name} = {\n  id = my_event.001\n  days = 30\n}`;
    } else {
        return `${name} = yes`;
    }
}

// Run the extraction
extractEffects();