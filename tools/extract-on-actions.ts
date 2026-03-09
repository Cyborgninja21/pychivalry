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

interface OnActionData {
    description: string;
    events: string[];
    random_events: Array<{ event: string; weight: number }>;
    has_effect: boolean;
    has_trigger: boolean;
    scopes: {
        root: string;
    };
}

/**
 * Extracts on-action definitions from CK3 game files and writes to data/on_actions.yaml
 */
function main() {
    const options = parseArgs('extract-on-actions.ts');

    console.log('🔍 Reading on-action files...');
    const files = readGameFiles(options.gamePath, 'common/on_action');

    const onActions: Record<string, OnActionData> = {};
    let totalProcessed = 0;

    for (const file of files) {
        console.log(`📖 Processing ${file.filePath}...`);
        const blocks = extractTopLevelBlocks(file.content);

        for (const [blockName, blockContent] of blocks) {
            if (!blockName || blockName.startsWith('#')) continue;

            const onActionData = parseOnAction(blockName, blockContent);
            onActions[blockName] = onActionData;
            totalProcessed++;
        }
    }

    // Sort alphabetically by key
    const sortedOnActions: Record<string, OnActionData> = {};
    const sortedKeys = Object.keys(onActions).sort();

    for (const key of sortedKeys) {
        sortedOnActions[key] = onActions[key];
    }

    // Write output
    const outputPath = `${options.outputPath}/on_actions.yaml`;
    writeYaml(outputPath, sortedOnActions, '# CK3 On-Actions');

    printSummary('on-actions', totalProcessed, outputPath);
}

function parseOnAction(name: string, content: string): OnActionData {
    const properties = parseBlockProperties(content);

    // Extract events from events blocks
    const events = extractEventsFromBlock(content, 'events');

    // Extract random events with weights
    const randomEvents = extractRandomEvents(content);

    // Check for trigger and effect blocks
    const hasTrigger = content.includes('trigger = {') || content.includes('trigger={');
    const hasEffect = content.includes('effect = {') || content.includes('effect={');

    // Infer root scope from name patterns
    const scopeGuesses = inferScopeFromName(name);
    const rootScope = scopeGuesses.length > 0 ? scopeGuesses[0] : 'character';

    return {
        description: nameToDescription(name),
        events,
        random_events: randomEvents,
        has_effect: hasEffect,
        has_trigger: hasTrigger,
        scopes: {
            root: rootScope
        }
    };
}

function extractEventsFromBlock(content: string, blockName: string): string[] {
    const events: string[] = [];
    const regex = new RegExp(`${blockName}\\s*=\\s*\\{([^{}]*(?:\\{[^{}]*\\}[^{}]*)*)\\}`, 'g');
    let match;

    while ((match = regex.exec(content)) !== null) {
        const blockContent = match[1];
        const eventIds = extractListValues(blockContent, '');
        events.push(...eventIds);
    }

    return [...new Set(events)]; // Remove duplicates
}

function extractRandomEvents(content: string): Array<{ event: string; weight: number }> {
    const randomEvents: Array<{ event: string; weight: number }> = [];
    const regex = /random_events\s*=\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
        const blockContent = match[1];
        const eventBlocks = extractEventWithWeight(blockContent);
        randomEvents.push(...eventBlocks);
    }

    return randomEvents;
}

function extractEventWithWeight(content: string): Array<{ event: string; weight: number }> {
    const events: Array<{ event: string; weight: number }> = [];
    const lines = content.split('\n');

    let currentEvent = '';
    let currentWeight = 100; // Default weight

    for (let line of lines) {
        line = stripComment(line).trim();
        if (!line) continue;

        if (line.includes('=') && !line.includes('{')) {
            const [key, value] = line.split('=').map(s => s.trim());

            if (key === 'weight') {
                currentWeight = parseInt(value) || 100;
            } else if (value && !value.includes('{')) {
                // This looks like an event assignment
                currentEvent = value;
                if (currentEvent) {
                    events.push({ event: currentEvent, weight: currentWeight });
                    currentEvent = '';
                    currentWeight = 100; // Reset for next event
                }
            }
        }

        // Handle direct event IDs without explicit assignment
        const eventIdMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*\.[0-9]+)$/);
        if (eventIdMatch) {
            events.push({ event: eventIdMatch[1], weight: currentWeight });
            currentWeight = 100; // Reset
        }
    }

    return events;
}

function nameToDescription(name: string): string {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

if (require.main === module) {
    main();
}