#!/usr/bin/env npx ts-node

import {
    parseArgs,
    readGameFiles,
    extractTopLevelBlocks,
    parseBlockProperties,
    writeYaml,
    printSummary
} from './lib/extractor-utils';

interface BackgroundData {
    description: string;
    texture?: string;
    environment?: string;
    ambience?: string;
    [key: string]: unknown;
}

/**
 * Extracts CK3 event background definitions from game files.
 * Reads from game/common/event_backgrounds/*.txt and outputs to data/backgrounds.yaml
 */
function main(): void {
    const options = parseArgs('extract-backgrounds.ts');

    console.log('🖼️ Reading event background files...');
    const files = readGameFiles(options.gamePath, 'common/event_backgrounds');

    const backgrounds: Record<string, BackgroundData> = {};
    let totalProcessed = 0;

    for (const file of files) {
        console.log(`📖 Processing ${file.filePath}...`);
        const blocks = extractTopLevelBlocks(file.content);

        for (const [backgroundName, blockContent] of blocks) {
            if (!backgroundName || backgroundName.startsWith('#')) continue;

            const backgroundData = parseBackground(backgroundName, blockContent);
            backgrounds[backgroundName] = backgroundData;
            totalProcessed++;
        }
    }

    // Sort alphabetically by key
    const sortedBackgrounds: Record<string, BackgroundData> = {};
    const sortedKeys = Object.keys(backgrounds).sort();

    for (const key of sortedKeys) {
        sortedBackgrounds[key] = backgrounds[key];
    }

    // Write output
    const outputPath = `${options.outputPath}/backgrounds.yaml`;
    const header = '# CK3 Event Backgrounds\n# Auto-generated from CK3 game files\n';
    writeYaml(outputPath, sortedBackgrounds, header);

    printSummary('backgrounds', totalProcessed, outputPath);
}

function parseBackground(name: string, content: string): BackgroundData {
    const properties = parseBlockProperties(content);

    // Generate description from background name
    const description = generateDescription(name);

    const backgroundData: BackgroundData = {
        description
    };

    // Extract known background properties
    if (properties.has('texture')) {
        backgroundData.texture = properties.get('texture')!.replace(/"/g, '');
    }

    if (properties.has('environment')) {
        backgroundData.environment = properties.get('environment')!.replace(/"/g, '');
    }

    if (properties.has('ambience')) {
        backgroundData.ambience = properties.get('ambience')!.replace(/"/g, '');
    }

    // Add any other properties found in the background block
    for (const [key, value] of properties) {
        if (!['texture', 'environment', 'ambience'].includes(key)) {
            backgroundData[key] = value.replace(/"/g, '');
        }
    }

    return backgroundData;
}

function generateDescription(name: string): string {
    // Convert background name to readable description
    // Split on underscores and capitalize each word
    const words = name.split('_').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    );

    return words.join(' ');
}

// Run the extraction
main();