#!/usr/bin/env npx tsx

import { parseArgs, readGameFiles, extractTopLevelBlocks, writeYaml, inferScopeFromName, printSummary } from './lib/extractor-utils';

interface Trigger {
    description: string;
    detail: string;
    snippet: string;
    scopes: string[];
    example: string;
}

/**
 * Extracts trigger definitions from CK3 game files and outputs to YAML format.
 * Reads from game/common/scripted_triggers/*.txt and similar directories.
 */
function extractTriggers(): void {
    const options = parseArgs('extract-triggers.ts');

    const triggers: Record<string, Trigger> = {};

    // Read scripted triggers
    const scriptedTriggerFiles = readGameFiles(options.gamePath, 'common/scripted_triggers');

    for (const file of scriptedTriggerFiles) {
        const blocks = extractTopLevelBlocks(file.content);

        for (const [triggerName, blockContent] of blocks) {
            if (triggerName && !triggerName.startsWith('#')) {
                triggers[triggerName] = createTrigger(triggerName, blockContent);
            }
        }
    }

    // Sort triggers alphabetically
    const sortedTriggers = Object.keys(triggers)
        .sort()
        .reduce((acc, key) => {
            acc[key] = triggers[key];
            return acc;
        }, {} as Record<string, Trigger>);

    // Write output
    const outputData = {
        version: "1.0",
        triggers: sortedTriggers
    };

    writeYaml(options.outputPath, outputData);
    printSummary('triggers', Object.keys(sortedTriggers).length, options.outputPath);
}

function createTrigger(name: string, blockContent: string): Trigger {
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
    // Convert trigger name to readable description
    const words = name.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );

    // Add "check" context for triggers
    if (name.startsWith('is_')) {
        return `Checks if the target is ${words.slice(1).join(' ').toLowerCase()}`;
    } else if (name.startsWith('has_')) {
        return `Checks if the target has ${words.slice(1).join(' ').toLowerCase()}`;
    } else if (name.startsWith('can_')) {
        return `Checks if the target can ${words.slice(1).join(' ').toLowerCase()}`;
    } else if (name.startsWith('exists_')) {
        return `Checks if ${words.slice(1).join(' ').toLowerCase()} exists`;
    } else if (name.startsWith('any_')) {
        return `Checks if any ${words.slice(1).join(' ').toLowerCase()} meets condition`;
    } else if (name.startsWith('all_')) {
        return `Checks if all ${words.slice(1).join(' ').toLowerCase()} meet condition`;
    } else {
        return `Checks ${words.join(' ').toLowerCase()} condition`;
    }
}

function generateDetail(name: string): string {
    // Short phrase about what the trigger checks
    if (name.includes('alive')) {
        return 'Character alive check';
    } else if (name.includes('trait')) {
        return 'Trait possession check';
    } else if (name.includes('opinion')) {
        return 'Opinion level check';
    } else if (name.includes('gold') || name.includes('wealth')) {
        return 'Wealth comparison';
    } else if (name.includes('prestige')) {
        return 'Prestige comparison';
    } else if (name.includes('piety')) {
        return 'Piety comparison';
    } else if (name.includes('stress')) {
        return 'Stress level check';
    } else if (name.includes('war') || name.includes('battle')) {
        return 'War/combat state check';
    } else if (name.includes('title')) {
        return 'Title possession check';
    } else if (name.includes('culture')) {
        return 'Culture comparison';
    } else if (name.includes('faith') || name.includes('religion')) {
        return 'Faith/religion check';
    } else if (name.includes('age')) {
        return 'Age comparison';
    } else if (name.includes('married')) {
        return 'Marriage status check';
    } else if (name.includes('dynasty')) {
        return 'Dynasty check';
    } else {
        return 'Game condition check';
    }
}

function generateSnippet(name: string, blockContent: string): string {
    // Analyze block content to determine if it needs parameters
    const hasComplexBlock = blockContent.includes('=') && blockContent.includes('{');

    if (hasComplexBlock) {
        // Multi-line block snippet
        if (name.includes('any_') || name.includes('all_')) {
            return `${name} = {\n\t\${1:condition} = \${2:value}\n}`;
        } else if (name.includes('opinion')) {
            return `${name} = {\n\ttarget = \${1:scope}\n\tvalue = \${2:0}\n}`;
        } else if (name.includes('trait')) {
            return `${name} = \${1:trait_name}`;
        } else {
            return `${name} = {\n\t\${1:parameter} = \${2:value}\n}`;
        }
    } else {
        // Simple value snippet - most triggers are yes/no or comparisons
        if (name.includes('gold') || name.includes('prestige') || name.includes('piety') ||
            name.includes('stress') || name.includes('age')) {
            return `${name} \${1|>=,>,<,<=,=|} \${2:value}`;
        } else if (name.includes('trait') || name.includes('culture') || name.includes('faith')) {
            return `${name} = \${1:name}`;
        } else {
            return `${name} = \${1|yes,no|}`;
        }
    }
}

function generateExample(name: string, blockContent: string): string {
    // Generate a practical usage example
    if (name.includes('alive')) {
        return `${name} = yes`;
    } else if (name.includes('trait')) {
        return `${name} = brave`;
    } else if (name.includes('opinion')) {
        return `${name} = {\n  target = scope:liege\n  value >= 50\n}`;
    } else if (name.includes('gold')) {
        return `${name} >= 100`;
    } else if (name.includes('prestige')) {
        return `${name} >= 500`;
    } else if (name.includes('piety')) {
        return `${name} >= 250`;
    } else if (name.includes('stress')) {
        return `${name} <= 75`;
    } else if (name.includes('age')) {
        return `${name} >= 16`;
    } else if (name.includes('culture')) {
        return `${name} = norse`;
    } else if (name.includes('faith')) {
        return `${name} = catholic`;
    } else if (name.includes('married')) {
        return `${name} = yes`;
    } else if (name.includes('any_')) {
        return `${name} = {\n  is_alive = yes\n}`;
    } else if (name.includes('all_')) {
        return `${name} = {\n  age >= 16\n}`;
    } else {
        return `${name} = yes`;
    }
}

// Run the extraction
extractTriggers();